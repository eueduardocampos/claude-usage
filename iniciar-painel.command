#!/bin/bash
# Inicia o Painel de Consumo do Claude e abre no navegador. (macOS/Linux)
# No macOS da pra dar dois cliques neste arquivo no Finder.
cd "$(dirname "$0")" || exit 1
exec python3 main.py
