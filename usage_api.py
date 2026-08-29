"""
usage_api.py — le os limites de uso ao vivo da conta via OAuth usage API.

GET https://api.anthropic.com/api/oauth/usage
Headers: Authorization: Bearer <token> | anthropic-beta: oauth-2025-04-20

Janelas retornadas: five_hour, seven_day, seven_day_sonnet, seven_day_opus,
seven_day_omelette (design) e extra_usage (creditos/excedente).
"""

import json
import urllib.request
import urllib.error

import auth

class RateLimited(Exception):
    """429 da API de uso. E transitorio e da conta inteira (todas as sessoes do
    Claude Code somam no mesmo limite) — NAO significa token invalido, entao o
    painel NUNCA deve pedir reconexao por causa disso."""

    def __init__(self, retry_after=None):
        self.retry_after = retry_after
        super().__init__("limite de requisicoes da conta")


def _retry_after(e) -> float | None:
    """Le o Retry-After da resposta, quando o servidor manda."""
    try:
        v = e.headers.get("Retry-After")
        return float(v) if v else None
    except Exception:
        return None


USAGE_URL = "https://api.anthropic.com/api/oauth/usage"
PROFILE_URL = "https://api.anthropic.com/api/oauth/profile"
BETA_HEADER = "oauth-2025-04-20"

# duracao de cada janela em horas (para projecao por elapsed_frac)
WINDOW_HOURS = {
    "five_hour": 5,
    "seven_day": 7 * 24,
    "seven_day_sonnet": 7 * 24,
    "seven_day_opus": 7 * 24,
    "seven_day_omelette": 7 * 24,
}


def _get(url, token):
    req = urllib.request.Request(url, headers={
        "Authorization": f"Bearer {token}",
        "anthropic-beta": BETA_HEADER,
        "Accept": "application/json",
    }, method="GET")
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def fetch_usage(store: auth.TokenStore, log=print) -> dict:
    """Busca o uso ao vivo. Em 401, renova uma vez e tenta de novo."""
    token = auth.get_valid_token(store, log=log)
    try:
        raw = _get(USAGE_URL, token)
    except urllib.error.HTTPError as e:
        if e.code == 429:
            raise RateLimited(_retry_after(e)) from e
        if e.code == 401:
            log("[usage] 401, renovando token e tentando de novo...")
            token = auth.force_refresh(store, log=log)
            try:
                raw = _get(USAGE_URL, token)
            except urllib.error.HTTPError as e2:
                if e2.code == 429:
                    raise RateLimited(_retry_after(e2)) from e2
                raise
        else:
            raise
    return raw


def fetch_profile(store: auth.TokenStore, log=print) -> dict:
    """Perfil da conta (tipo de organizacao, tier do assento) — p/ detectar a licenca."""
    token = auth.get_valid_token(store, log=log)
    try:
        return _get(PROFILE_URL, token)
    except urllib.error.HTTPError as e:
        if e.code == 429:
            raise RateLimited(_retry_after(e)) from e
        if e.code == 401:
            token = auth.force_refresh(store, log=log)
            return _get(PROFILE_URL, token)
        raise


def normalize(raw: dict) -> dict:
    """Extrai as janelas num formato simples e estavel."""
    out = {"windows": {}, "extra_usage": None}
    for key in WINDOW_HOURS:
        w = raw.get(key)
        if isinstance(w, dict):
            out["windows"][key] = {
                "utilization": w.get("utilization"),
                "resets_at": w.get("resets_at"),
            }
    eu = raw.get("extra_usage")
    if isinstance(eu, dict):
        out["extra_usage"] = {
            "is_enabled": eu.get("is_enabled"),
            "monthly_limit": eu.get("monthly_limit"),
            "used_credits": eu.get("used_credits"),
            "utilization": eu.get("utilization"),
        }
    return out


if __name__ == "__main__":
    import os
    st = auth.TokenStore(os.path.dirname(os.path.abspath(__file__)))
    raw = fetch_usage(st)
    print("=== RAW ===")
    print(json.dumps(raw, indent=2, ensure_ascii=False))
    print("=== NORMALIZADO ===")
    print(json.dumps(normalize(raw), indent=2, ensure_ascii=False))
