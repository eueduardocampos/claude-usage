"""
main.py — ponto de entrada do painel de consumo do Claude.
Uso:
  python main.py            inicia o painel (escaneia logs, faz poll da API,
                            abre http://localhost:<port>)
  python auth.py login      (re)conecta a conta via login OAuth
"""

import server

if __name__ == "__main__":
    server.run()
