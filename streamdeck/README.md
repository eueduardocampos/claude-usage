# Claude Usage no Stream Deck

Plugin oficial do painel para Elgato Stream Deck (Windows e macOS). Cada dado é
uma **ação dedicada** — arraste a tecla e ela já funciona, sem configurar nada,
desde que o painel (`python main.py`) esteja rodando em `localhost:8090`.

O plugin é vitrine, não coletor: ele lê `GET /api/state` e `/api/total` do
painel local. Não fala com a API da Anthropic e não guarda chave nenhuma.
Node puro, zero dependências.

## Teclas

| Ação | Mostra |
| --- | --- |
| **Janela crítica** | a janela de uso com menos folga (5h ou 7d), anel colorido pela projeção |
| **Sessão 5h + Semana 7d** | as duas janelas empilhadas, com barra e tempo pro reset |
| **Fonte dos tokens** | `LICENCA` (verde) ou `EXTRAS` (vermelho, com R$/h) — se o uso atual está sendo cobrado à parte |
| **Estouro** | `OK`, ou a hora em que a janela estoura (só quando cai antes do reset) |
| **Trocar de modelo?** | veredito: dá pra usar Opus agora? |
| **Custo hoje** | custo estimado do dia em R$ |
| **Balanço do mês** | alavancagem da licença (consumo equivalente ÷ desembolso) |
| **Queima agora** | tokens/h do modelo dominante — vira `R$/h` vermelho ao queimar extras |

Pressionar qualquer tecla abre o painel no navegador.

## Dials (Stream Deck +)

| Dial | Girar faz |
| --- | --- |
| **Horizonte** | ajusta o "pretendo trabalhar mais" (30m–4h) — grava no painel e o veredito recalcula na hora |
| **Janelas** | alterna 5h / 7d (valor = usado, barra = projetado) |
| **Custos** | alterna hoje / semana / mês / extras |
| **Vida toda** | alterna tokens totais / custo total / interações |

Pressionar abre o painel; tocar no strip força uma atualização.

## Instalar

1. Baixe o `digital.astronauta.claudeusage.streamDeckPlugin` na
   [página de releases](https://github.com/eueduardocampos/claude-usage/releases)
   e dê **dois cliques** — o app do Stream Deck instala sozinho.
2. (Stream Deck +) importe o perfil pronto `Claude Usage (SD+).streamDeckProfile`
   do mesmo release: as 8 teclas e os 4 dials aparecem montados de uma vez.

Instalação manual (dev): copie a pasta `digital.astronauta.claudeusage.sdPlugin`
para `%APPDATA%\Elgato\StreamDeck\Plugins\` (Windows) ou
`~/Library/Application Support/com.elgato.StreamDeck/Plugins/` (macOS) e
reinicie o app do Stream Deck.

## Configuração

Tudo global (vale para todas as teclas), em qualquer inspector: URL do painel
(default `http://127.0.0.1:8090`), intervalo de atualização (default 10s,
mínimo 2 — a leitura é local, sem custo), polaridade usado/restante e
limiares de cor. A ação **Consumo (configurável)** é a genérica da v2, mantida
por compatibilidade com perfis antigos.

## A tecla nunca fica em branco

| Na tela | Significa | O que fazer |
| --- | --- | --- |
| `OFF` | o painel não está rodando | `python main.py` |
| `--` + "reconectar" | painel de pé, conta sem token válido | `python auth.py login` |
| `12%!` | dado antigo, de antes da conta desconectar | reconectar a conta |

## Testar sem o hardware

`test/fake_sd.js` sobe um Stream Deck falso (protocolo real) + um painel falso,
spawna o plugin de verdade, gira os dials e confere cada `setImage`/`setFeedback`:

```bash
node streamdeck/test/fake_sd.js
```
