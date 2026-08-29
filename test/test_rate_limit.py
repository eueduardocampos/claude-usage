# -*- coding: utf-8 -*-
"""Prova que 429 NAO derruba a autenticacao e que o backoff cresce."""
import os, sys, time
sys.path.insert(0, os.getcwd())
import server, usage_api, auth

server.Ctx.cfg = server.load_config()
server.Ctx.store = type("S", (), {
    "scan": lambda self, log=None: None,
    "insert_snapshot": lambda self, d: None,
})()
server.Ctx.token_store = None
server.Ctx.auth_connected = True          # estado saudavel antes do 429
server.Ctx.profile_ts = time.time()       # evita chamada de perfil
server.Ctx.fx_ts = time.time()            # evita chamada de cambio

falhas = []
def check(cond, label):
    print(("  PASS  " if cond else "  FALHA ") + label)
    if not cond: falhas.append(label)

# --- 429 seguidos ---
usage_api.fetch_usage = lambda store, log=print: (_ for _ in ()).throw(usage_api.RateLimited(None))
esperas = []
for i in range(3):
    server.poll_once(log=lambda *a: None)
    esperas.append(round(server.Ctx.next_poll_at - time.time()))
    check(server.Ctx.auth_connected is True, f"429 #{i+1}: continua conectado (nao pede reconexao)")
    check(server.Ctx.rate_limited is True, f"429 #{i+1}: marcado como limitado")

check(esperas == sorted(esperas) and esperas[0] < esperas[-1],
      f"backoff cresce a cada 429: {esperas}s")
check(esperas[-1] <= server.BACKOFF_MAX_S, f"backoff respeita o teto de {server.BACKOFF_MAX_S}s")

# --- Retry-After do servidor e respeitado ---
server.Ctx.rate_limit_hits = 0
usage_after = usage_api.RateLimited(900)
usage_api.fetch_usage = lambda store, log=print: (_ for _ in ()).throw(usage_after)
server.poll_once(log=lambda *a: None)
check(round(server.Ctx.next_poll_at - time.time()) >= 900, "respeita o Retry-After do servidor")

# --- recuperacao: volta ao normal ---
usage_api.fetch_usage = lambda store, log=print: {"five_hour": {"utilization": 10}}
usage_api.normalize = lambda raw: {"windows": {}, "extra_usage": None}
server.poll_once(log=lambda *a: None)
check(server.Ctx.rate_limited is False, "sucesso limpa o estado de limitado")
check(server.Ctx.rate_limit_hits == 0, "sucesso zera o contador de backoff")
check(round(server.Ctx.next_poll_at - time.time()) <= server.POLL_SECONDS, "volta ao ritmo normal")

# --- AuthError de verdade AINDA desconecta ---
usage_api.fetch_usage = lambda store, log=print: (_ for _ in ()).throw(auth.AuthError("sem token"))
server.poll_once(log=lambda *a: None)
check(server.Ctx.auth_connected is False, "AuthError real continua marcando desconectado")
check(server.Ctx.rate_limited is False, "AuthError real nao e confundido com rate limit")

# --- TransientAuthError nao desconecta ---
server.Ctx.auth_connected = True
usage_api.fetch_usage = lambda store, log=print: (_ for _ in ()).throw(auth.TransientAuthError("HTTP 429 ao renovar"))
server.poll_once(log=lambda *a: None)
check(server.Ctx.auth_connected is True, "429 no refresh do token nao desconecta")

# --- falha no boot: recupera rapido em vez de esperar o ritmo normal ---
# (rede ou disco ainda subindo depois de reiniciar a maquina)
server.Ctx.last_poll = None
server.Ctx.boot_retries = 0
server.Ctx.store.latest_state = lambda self=None: None
usage_api.fetch_usage = lambda store, log=print: (_ for _ in ()).throw(auth.AuthError("sem token"))
esperas_boot = []
for _ in range(6):
    server.poll_once(log=lambda *a: None)
    esperas_boot.append(round(server.Ctx.next_poll_at - time.time()))
check(esperas_boot[0] <= 15, f"falha no boot: 1a retentativa rapida ({esperas_boot[0]}s)")
check(esperas_boot == sorted(esperas_boot), f"espera cresce se persistir: {esperas_boot}s")
check(esperas_boot[-1] <= server.POLL_COLD, "converge para o ritmo normal (nao martela)")

usage_api.fetch_usage = lambda store, log=print: {}
usage_api.normalize = lambda raw: {"windows": {}, "extra_usage": None}
server.poll_once(log=lambda *a: None)
check(server.Ctx.boot_retries == 0, "sucesso zera o contador de boot")

print()
print(("%d FALHA(S)" % len(falhas)) if falhas else "TUDO PASSOU")
sys.exit(1 if falhas else 0)
