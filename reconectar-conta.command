#!/bin/bash
# Reconecta a conta Anthropic (login OAuth no navegador). (macOS/Linux)
# Use se o painel mostrar "desconectado".
cd "$(dirname "$0")" || exit 1
exec python3 auth.py login
