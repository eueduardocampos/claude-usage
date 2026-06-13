"""
server.py — monta o estado do painel e serve o dashboard em localhost.
Poller em thread separada chama a API de uso a cada refresh_seconds e grava
snapshots; o servidor le sempre o ultimo snapshot do banco (desacoplado da rede).
"""

import datetime as dt
import json
import os
import threading
import time
import traceback
from datetime import timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import auth
import forecast
import store as store_mod
import usage_api

HERE = os.path.dirname(os.path.abspath(__file__))
STATIC = os.path.join(HERE, "static")

WINDOW_HOURS = {"five_hour": 5, "seven_day": 168, "seven_day_sonnet": 168}
WINDOW_LABELS = {"five_hour": "Sessao (5h)", "seven_day": "Semana (7d)",
                 "seven_day_sonnet": "Sonnet (7d)"}


class Ctx:
    store = None
    cfg = None
    token_store = None
    last_error = None
    last_poll = None
    auth_connected = False
    _login_thread = None


# --- montagem do estado ------------------------------------------------------

def build_state() -> dict:
    cfg = Ctx.cfg
    latest = Ctx.store.latest_state()
    windows_out, states = {}, {}
    if latest:
        for win, hrs in WINDOW_HOURS.items():
            wd = latest["windows"].get(win)
            if not wd or wd.get("utilization") is None:
                continue
            snap_rate = Ctx.store.snapshot_rate(win)
            st = forecast.project_window(wd["utilization"], wd["resets_at"],
                                         hrs, snap_rate=snap_rate)
            st["label"] = WINDOW_LABELS[win]
            st["window"] = win
            windows_out[win] = st
            states[win] = st

    burn = Ctx.store.recent_tokph(2)
    dominant = max(burn, key=burn.get) if burn else None
    verdict = (forecast.switch_verdict(states, dominant,
                                       cfg.get("intended_hours", 2.0))
               if states else None)

    extra = None
    if latest and latest.get("extra_usage"):
        eu = latest["extra_usage"]
        div = cfg.get("credits_divisor", 100) or 1
        extra = {
            "used": (eu["used_credits"] / div) if eu.get("used_credits") is not None else None,
            "limit": (eu["monthly_limit"] / div) if eu.get("monthly_limit") is not None else None,
            "currency": eu.get("currency") or cfg.get("currency"),
        }

    history = {sc: Ctx.store.scope_summary(sc)
               for sc in ("geral", "mes", "semana", "dia")}

    return {
        "generated_at": dt.datetime.now(timezone.utc).isoformat(),
        "snapshot_ts": latest["ts"] if latest else None,
        "auth_connected": Ctx.auth_connected,
        "last_error": Ctx.last_error,
        "windows": windows_out,
        "switch": verdict,
        "burn_tokph": {k: round(v) for k, v in burn.items()},
        "dominant_model": dominant,
        "extra_usage": extra,
        "history": history,
        "config": {"refresh_seconds": cfg.get("refresh_seconds"),
                   "intended_hours": cfg.get("intended_hours"),
                   "currency": cfg.get("currency")},
    }


# --- poller ------------------------------------------------------------------

def poll_once(log=print):
    """Escaneia logs e grava um snapshot da API. Atualiza flags de auth."""
    try:
        Ctx.store.scan(log=lambda *a: None)
    except Exception as e:
        log(f"[poll] scan falhou: {e}")
    try:
        raw = usage_api.fetch_usage(Ctx.token_store, log=log)
        Ctx.store.insert_snapshot(usage_api.normalize(raw))
        Ctx.auth_connected = True
        Ctx.last_error = None
        Ctx.last_poll = time.time()
    except auth.AuthError as e:
        Ctx.auth_connected = False
        Ctx.last_error = f"auth: {e}"
        log(f"[poll] sem token valido: {e}")
    except Exception as e:
        Ctx.auth_connected = False
        Ctx.last_error = str(e)
        log(f"[poll] erro: {e}")


def poller_loop():
    poll_once()
    while True:
        time.sleep(max(15, int(Ctx.cfg.get("refresh_seconds", 120))))
        poll_once()


SCAN_INTERVAL = 10  # scan incremental frequente para o total "quase em tempo real"


def scan_loop():
    while True:
        time.sleep(SCAN_INTERVAL)
        try:
            Ctx.store.scan(log=lambda *a: None)
        except Exception as e:
            print(f"[scan_loop] {e}")


def start_login_thread():
    if Ctx._login_thread and Ctx._login_thread.is_alive():
        return
    def _run():
        try:
            auth.run_pkce_login(Ctx.token_store,
                                callback_port=Ctx.cfg.get("callback_port", 54545))
            poll_once()
        except Exception as e:
            Ctx.last_error = f"login: {e}"
    Ctx._login_thread = threading.Thread(target=_run, daemon=True)
    Ctx._login_thread.start()


# --- HTTP handler ------------------------------------------------------------

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _send(self, code, body, ctype="application/json; charset=utf-8"):
        data = body if isinstance(body, bytes) else body.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _serve_static(self, name, ctype):
        path = os.path.join(STATIC, name)
        if not os.path.isfile(path):
            self._send(404, "not found", "text/plain")
            return
        with open(path, "rb") as f:
            self._send(200, f.read(), ctype)

    def do_GET(self):
        p = self.path.split("?")[0]
        try:
            if p in ("/", "/index.html"):
                self._serve_static("index.html", "text/html; charset=utf-8")
            elif p == "/app.js":
                self._serve_static("app.js", "application/javascript; charset=utf-8")
            elif p == "/style.css":
                self._serve_static("style.css", "text/css; charset=utf-8")
            elif p == "/api/state":
                self._send(200, json.dumps(build_state(), ensure_ascii=False))
            elif p == "/api/total":
                self._send(200, json.dumps(Ctx.store.total_summary(), ensure_ascii=False))
            elif p == "/api/history":
                out = {
                    "snapshots": Ctx.store.snapshot_history(48),
                    "daily": Ctx.store.daily_series(Ctx.cfg.get("daily_days", 30)),
                    "hour_of_day": Ctx.store.hour_of_day_avg(),
                }
                self._send(200, json.dumps(out, ensure_ascii=False))
            elif p == "/auth/start":
                start_login_thread()
                self._send(200, json.dumps({"started": True}))
            else:
                self._send(404, "not found", "text/plain")
        except Exception:
            self._send(500, json.dumps({"error": traceback.format_exc()}))

    def do_POST(self):
        p = self.path.split("?")[0]
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length) if length else b"{}"
        try:
            body = json.loads(raw or b"{}")
        except json.JSONDecodeError:
            body = {}
        if p == "/api/config":
            for k in ("refresh_seconds", "intended_hours"):
                if k in body:
                    Ctx.cfg[k] = body[k]
            save_config(Ctx.cfg)
            self._send(200, json.dumps({"ok": True, "config": Ctx.cfg}))
        elif p == "/api/refresh":
            poll_once()
            self._send(200, json.dumps({"ok": True}))
        else:
            self._send(404, "not found", "text/plain")


# --- config + run ------------------------------------------------------------

CONFIG_PATH = os.path.join(HERE, "config.json")
DEFAULTS = {"port": 8090, "refresh_seconds": 120, "currency": "BRL",
            "credits_divisor": 100, "intended_hours": 2.0, "daily_days": 30,
            "callback_port": 54545, "open_browser": True}


def load_config():
    cfg = dict(DEFAULTS)
    try:
        with open(CONFIG_PATH, encoding="utf-8") as f:
            cfg.update(json.load(f))
    except (FileNotFoundError, json.JSONDecodeError):
        pass
    return cfg


def save_config(cfg):
    try:
        with open(CONFIG_PATH, "w", encoding="utf-8") as f:
            json.dump(cfg, f, indent=2, ensure_ascii=False)
    except OSError:
        pass


def run():
    Ctx.cfg = load_config()
    Ctx.store = store_mod.Store(os.path.join(HERE, "painel.db"))
    Ctx.token_store = auth.TokenStore(HERE)

    threading.Thread(target=poller_loop, daemon=True).start()
    threading.Thread(target=scan_loop, daemon=True).start()

    port = int(Ctx.cfg.get("port", 8090))
    httpd = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    url = f"http://localhost:{port}"
    print(f"[painel] rodando em {url}  (refresh={Ctx.cfg['refresh_seconds']}s)")
    if Ctx.cfg.get("open_browser"):
        try:
            import webbrowser
            webbrowser.open(url)
        except Exception:
            pass
    httpd.serve_forever()


if __name__ == "__main__":
    run()
