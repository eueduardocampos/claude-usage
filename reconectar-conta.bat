@echo off
REM Reconecta a conta Anthropic (login OAuth no navegador).
REM Use se o painel mostrar "desconectado".
cd /d "%~dp0"
python auth.py login
pause
