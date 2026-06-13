"""
forecast.py — funcoes puras de projecao, semaforo e veredito de troca de modelo.
Sem I/O. Recebe os dados ja lidos (uso ao vivo + taxas) e devolve dicts.

Projecao por janela:
  - taxa preferida: %/hora medida por amostragem (snap_rate)
  - fallback: taxa implicita = utilization / horas_decorridas (= util/elapsed_frac no reset)
Semaforo: <80 SEGURO | 80-100 ATENCAO | >=100 RISCO | sem dados INDETERMINADO

Veredito de troca: a conta nao expoe bucket de Opus, entao o Opus pesa sobre a
sessao (5h) e o semanal geral (7d). Estima-se o burn do Opus aplicando um fator
de intensidade (peso de preco do Opus / peso do modelo dominante atual).
"""

import datetime as dt
from datetime import timezone

# peso aproximado de "intensidade" por modelo (preco de output, USD/1M)
OUTPUT_WEIGHT = {"opus": 25.0, "sonnet": 15.0, "haiku": 5.0}
_ORDER = {"SEGURO": 0, "ATENCAO": 1, "RISCO": 2, "INDETERMINADO": 0}


def _model_key(model: str):
    m = (model or "").lower()
    if "opus" in m:
        return "opus"
    if "sonnet" in m:
        return "sonnet"
    if "haiku" in m:
        return "haiku"
    return None


def parse_iso(s):
    if not s:
        return None
    try:
        d = dt.datetime.fromisoformat(s.replace("Z", "+00:00"))
    except ValueError:
        return None
    if d.tzinfo is None:
        d = d.replace(tzinfo=timezone.utc)
    return d


def classify(projected):
    if projected is None:
        return "INDETERMINADO"
    if projected < 80:
        return "SEGURO"
    if projected < 100:
        return "ATENCAO"
    return "RISCO"


def project_window(util, resets_at, window_hours, snap_rate=None, now=None):
    now = now or dt.datetime.now(timezone.utc)
    reset = parse_iso(resets_at)
    out = {"utilization": util, "resets_at": resets_at, "hours_to_reset": None,
           "projected": None, "status": "INDETERMINADO", "rate": None,
           "eta_100": None}
    if util is None or reset is None:
        return out
    start = reset - dt.timedelta(hours=window_hours)
    elapsed_h = max((now - start).total_seconds() / 3600, 0.0)
    htr = max((reset - now).total_seconds() / 3600, 0.0)
    out["hours_to_reset"] = htr

    elapsed_frac = elapsed_h / window_hours if window_hours else 0
    measured = snap_rate if (snap_rate is not None and snap_rate >= 0) else None
    if measured is not None:
        rate = measured                       # taxa medida (span suficiente)
        projected = util + rate * htr
    elif elapsed_frac >= 0.10 and elapsed_h > 0:
        rate = util / elapsed_h               # media desde a abertura da janela
        projected = util + rate * htr         # == util / elapsed_frac
    else:
        rate = None                           # cedo demais para projetar
        projected = None
    out["rate"] = rate
    if projected is not None:
        projected = min(projected, 999.0)
    out["projected"] = projected
    out["status"] = classify(projected)

    if rate and rate > 0 and util is not None and util < 100:
        h100 = (100 - util) / rate
        out["eta_100"] = (now + dt.timedelta(hours=h100)).isoformat()
    return out


def switch_verdict(windows_state, dominant_model, intended_hours, target="opus"):
    """Estima o impacto de trabalhar `intended_hours` no modelo `target`
    sobre as janelas que ele consome (5h e 7d geral)."""
    cur_key = _model_key(dominant_model) or "sonnet"
    factor = OUTPUT_WEIGHT.get(target, 25.0) / OUTPUT_WEIGHT.get(cur_key, 15.0)
    results = {}
    worst = "SEGURO"
    for win in ("five_hour", "seven_day"):
        st = windows_state.get(win)
        if not st or st.get("utilization") is None:
            continue
        rate = st.get("rate") or 0.0
        htr = st.get("hours_to_reset") or 0.0
        hrs = min(intended_hours, htr) if htr else intended_hours
        proj = st["utilization"] + rate * factor * hrs
        cls = classify(min(proj, 999.0))
        results[win] = {"projected": min(proj, 999.0), "status": cls,
                        "hours_to_reset": htr}
        if _ORDER[cls] > _ORDER[worst]:
            worst = cls

    msg = {
        "SEGURO": f"Pode trocar pra {target.title()} com folga.",
        "ATENCAO": f"Da pra trocar pra {target.title()}, mas acompanhe de perto.",
        "RISCO": f"NAO troque pra {target.title()} agora: deve estourar o limite "
                 f"antes do reset.",
        "INDETERMINADO": "Ainda sem dados suficientes para decidir (colete algumas amostras).",
    }[worst]
    return {"verdict": worst, "message": msg, "factor": round(factor, 2),
            "dominant_model": dominant_model, "target": target,
            "intended_hours": intended_hours, "windows": results}


if __name__ == "__main__":
    # cenarios de teste
    now = dt.datetime(2026, 6, 13, 22, 0, tzinfo=timezone.utc)
    print("--- sessao 55%, reset em 3h30 (sem snapshot) ---")
    s = project_window(55.0, "2026-06-14T01:30:00+00:00", 5, now=now)
    print(s["status"], "projecao=", round(s["projected"], 1),
          "taxa=", round(s["rate"], 1), "htr=", round(s["hours_to_reset"], 2))
    print("--- semana 15%, reset em 6h ---")
    w = project_window(15.0, "2026-06-14T04:00:00+00:00", 7 * 24, now=now)
    print(w["status"], "projecao=", round(w["projected"], 2))
    print("--- veredito trocar pra opus (dominante sonnet, 2h) ---")
    print(switch_verdict({"five_hour": s, "seven_day": w},
                         "claude-sonnet-4-6", 2.0))
    print("--- cenario RISCO: sessao 70% com 1h decorrida, reset em 4h ---")
    r = project_window(70.0, "2026-06-14T02:00:00+00:00", 5, now=now)
    print(r["status"], "projecao=", round(r["projected"], 1), "eta100=", r["eta_100"])
