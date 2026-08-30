"""
tray.py — 3 icones na bandeja do Windows (sessao 5h, semana 7d, semaforo geral).

So le o painel (GET /api/state em localhost:8090), nao calcula nada por conta
propria -- os numeros e o status (SEGURO/ATENCAO/RISCO/INDETERMINADO) sao os
mesmos que ja saem prontos do backend (ver forecast.py), so desenhados como
bitmap. Paleta identica ao widget flutuante (web/src/Widget.jsx).

Requer pystray + Pillow (Pillow ja vem com o projeto; pystray e so pra bandeja).
Rodar com o mesmo `python` usado pro backend (main.py) -- nao precisa de
compilador nenhum, ao contrario do app Tauri.
"""

import ctypes
import io
import json
import sys
import threading
import time
import urllib.error
import urllib.request
import webbrowser

from PIL import Image, ImageDraw, ImageFont

API_BASE = "http://localhost:8090"
DEFAULT_REFRESH_SECONDS = 5
MIN_REFRESH_SECONDS = 5
ICON_SIZE = 64
FONT_CANDIDATES = [
    # Windows
    "C:\\Windows\\Fonts\\segoeuib.ttf",
    "C:\\Windows\\Fonts\\arialbd.ttf",
    # macOS
    "/System/Library/Fonts/SFNSDisplay.ttf",
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/Library/Fonts/Arial Bold.ttf",
    # Linux
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
]

STATUS_COLOR = {
    "SEGURO": (52, 199, 89),        # #34c759
    "ATENCAO": (255, 159, 10),      # #ff9f0a
    "RISCO": (255, 69, 58),         # #ff453a
    "INDETERMINADO": (142, 142, 147),  # #8e8e93
}
OFFLINE_COLOR = (108, 108, 112)


def _load_font(size):
    for path in FONT_CANDIDATES:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


# Sem fundo colorido -- so o numero, na cor do status, com contorno escuro
# pra segurar contraste tanto em barra de tarefas escura quanto clara.
# Fonte grande o bastante pra sobreviver ao downscale do Windows (32px do
# GDI ate os ~16-20px reais da bandeja). Calibrado visualmente contra os
# piores casos (digitos com "contador" fechado: 8, 9, 0) -- ver
# icon_experiment3.py no scratchpad da sessao que definiu estes numeros.
_FONT_DIGITS = _load_font(int(ICON_SIZE * 0.78))
_STROKE_WIDTH = max(1, round(ICON_SIZE * 0.05))
_DIGIT_GAP = round(ICON_SIZE * 0.07)


def _status_color(status):
    return STATUS_COLOR.get(status, STATUS_COLOR["INDETERMINADO"])


def _outline_color(color):
    return tuple(max(0, c - 110) for c in color[:3])


def _draw_spaced_text(d, text, fill, stroke_fill):
    """Desenha cada caractere separadamente com gap manual, centralizado
    como grupo. Sem isso, dois digitos finos (ex. "11") tendem a grudar
    em tamanho de bandeja."""
    widths = []
    for ch in text:
        bbox = d.textbbox((0, 0), ch, font=_FONT_DIGITS, stroke_width=_STROKE_WIDTH)
        widths.append(bbox[2] - bbox[0])
    total_w = sum(widths) + _DIGIT_GAP * (len(text) - 1)

    asc, desc = _FONT_DIGITS.getmetrics()
    th = asc + desc
    x = (ICON_SIZE - total_w) / 2
    y = (ICON_SIZE - th) / 2 - desc / 2.2
    for ch, w in zip(text, widths):
        d.text((x, y), ch, fill=fill, font=_FONT_DIGITS,
                stroke_width=_STROKE_WIDTH, stroke_fill=stroke_fill)
        x += w + _DIGIT_GAP


def render_percent_icon(value, status, offline=False):
    """So o numero (0-99), na cor do status, contorno escuro, fundo
    transparente -- sem bloco/circulo atras (feedback: bloco colorido
    contra a bandeja escura ficava esquisito; so a bolinha-resumo deve
    ser uma forma solida)."""
    color = OFFLINE_COLOR if offline else _status_color(status)
    img = Image.new("RGBA", (ICON_SIZE, ICON_SIZE), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    text = "?" if (offline or value is None) else f"{min(int(value), 99):02d}"
    fill = color + (255,) if len(color) == 3 else color
    _draw_spaced_text(d, text, fill, _outline_color(color) + (255,))
    return img


def render_dot_icon(status, offline=False):
    """Bolinha lisa (sem numero) -- semaforo geral. Fica redonda de
    proposito (diferente dos quadrados numericos) pra bater o olho e
    separar na hora "isso e o resumo, aqueles dois sao metricas"."""
    color = OFFLINE_COLOR if offline else _status_color(status)
    img = Image.new("RGBA", (ICON_SIZE, ICON_SIZE), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    pad = 3
    d.ellipse([pad, pad, ICON_SIZE - pad, ICON_SIZE - pad], fill=color)
    return img


_ORDER = {"SEGURO": 0, "ATENCAO": 1, "RISCO": 2, "INDETERMINADO": 0}


def worst_status(a, b):
    if _ORDER.get(a, 0) >= _ORDER.get(b, 0):
        return a
    return b


def fetch_state():
    req = urllib.request.Request(f"{API_BASE}/api/state", headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=4) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _patch_pystray_small_icon_size():
    """pystray (backend win32) carrega o icone via LoadImage com
    LR_DEFAULTSIZE, que usa o tamanho de icone GRANDE do Windows
    (GetSystemMetrics(SM_CXICON), tipicamente 32px) -- nao o tamanho
    pequeno real da bandeja (SM_CXSMICON, tipicamente 16px). O Explorer
    entao encolhe esse HICON de 32px pra caber no slot pequeno da
    notification area, e essa segunda reducao (fora do nosso controle,
    feita pelo shell) e o que borra os digitos -- confirmado comparando
    o frame de 16px que o Pillow gera (nitido) com o que aparece de
    verdade na bandeja (borrado).

    Corrige carregando direto no tamanho pequeno via GetSystemMetrics,
    sem LR_DEFAULTSIZE -- o Windows entao usa o frame de 16px ja
    embutido no ICO (o Pillow gera varios tamanhos automaticamente ao
    salvar), sem nenhum stretch depois.

    Fora do Windows nao ha o que corrigir: o backend do pystray e outro
    (AppKit no macOS, GTK/AppIndicator no Linux) e `ctypes.windll` nem
    existe. Sai sem fazer nada, em vez de derrubar a bandeja inteira."""
    if sys.platform != "win32":
        return

    import pystray._win32 as _w32mod

    win32 = _w32mod.win32
    serialized_image = _w32mod.serialized_image
    user32 = ctypes.windll.user32
    SM_CXSMICON, SM_CYSMICON = 49, 50

    def _assert_icon_handle(self):
        if self._icon_handle:
            return
        cx = user32.GetSystemMetrics(SM_CXSMICON)
        cy = user32.GetSystemMetrics(SM_CYSMICON)
        with serialized_image(self.icon, "ICO") as icon_path:
            self._icon_handle = win32.LoadImage(
                None, icon_path, win32.IMAGE_ICON, cx, cy,
                win32.LR_LOADFROMFILE)

    _w32mod.Icon._assert_icon_handle = _assert_icon_handle


def fmt_window_tooltip(label, w):
    if not w or w.get("utilization") is None:
        return f"{label}: sem dados ainda"
    util = round(w["utilization"])
    proj = w.get("projected")
    proj_txt = f"{round(proj)}%" if proj is not None else "?"
    htr = w.get("hours_to_reset")
    htr_txt = f"{int(htr)}h{int((htr % 1) * 60):02d}" if htr is not None else "?"
    return f"{label}: {util}% usado ({w.get('status', '?')})\nProjecao no reset: {proj_txt} - reset em {htr_txt}"


class TrayApp:
    def __init__(self):
        self.refresh_seconds = DEFAULT_REFRESH_SECONDS
        self._stop = threading.Event()

        import pystray

        _patch_pystray_small_icon_size()
        self.pystray = pystray
        open_item = pystray.MenuItem("Abrir painel", self._open_panel, default=True)
        refresh_item = pystray.MenuItem("Atualizar agora", self._force_refresh)
        quit_item = pystray.MenuItem("Sair", self._quit)
        menu = pystray.Menu(open_item, refresh_item, pystray.Menu.SEPARATOR, quit_item)

        blank = render_percent_icon(None, "INDETERMINADO", offline=True)
        blank_dot = render_dot_icon("INDETERMINADO", offline=True)

        self.icon_5h = pystray.Icon("claude-usage-5h", blank, "Sessao (5h): conectando...", menu)
        self.icon_7d = pystray.Icon("claude-usage-7d", blank, "Semana (7d): conectando...", menu)
        self.icon_status = pystray.Icon("claude-usage-status", blank_dot, "Consumo do Claude: conectando...", menu)

    def _open_panel(self, *_):
        webbrowser.open(API_BASE)

    def _force_refresh(self, *_):
        threading.Thread(target=self._tick, daemon=True).start()

    def _quit(self, *_):
        self._stop.set()
        self.icon_5h.stop()
        self.icon_7d.stop()
        self.icon_status.stop()

    def _tick(self):
        try:
            state = fetch_state()
        except (urllib.error.URLError, TimeoutError, OSError, ValueError):
            self._set_offline()
            return

        windows = state.get("windows", {})
        five = windows.get("five_hour", {})
        seven = windows.get("seven_day", {})
        five_status = five.get("status", "INDETERMINADO")
        seven_status = seven.get("status", "INDETERMINADO")
        overall = worst_status(five_status, seven_status)

        last_error = state.get("last_error")

        self.icon_5h.icon = render_percent_icon(five.get("utilization"), five_status)
        self.icon_5h.title = fmt_window_tooltip("Sessao (5h)", five)[:127]

        self.icon_7d.icon = render_percent_icon(seven.get("utilization"), seven_status)
        self.icon_7d.title = fmt_window_tooltip("Semana (7d)", seven)[:127]

        self.icon_status.icon = render_dot_icon(overall)
        status_txt = f"Estado geral: {overall}"
        if last_error:
            status_txt += f"\n(aviso: {last_error})"
        self.icon_status.title = status_txt[:127]

        cfg = state.get("config", {})
        rs = cfg.get("refresh_seconds")
        if isinstance(rs, (int, float)) and rs >= MIN_REFRESH_SECONDS:
            self.refresh_seconds = rs

    def _set_offline(self):
        blank = render_percent_icon(None, "INDETERMINADO", offline=True)
        blank_dot = render_dot_icon("INDETERMINADO", offline=True)
        offline_msg = "Painel offline - rode main.py em app-source/"
        self.icon_5h.icon = blank
        self.icon_5h.title = f"Sessao (5h): {offline_msg}"[:127]
        self.icon_7d.icon = blank
        self.icon_7d.title = f"Semana (7d): {offline_msg}"[:127]
        self.icon_status.icon = blank_dot
        self.icon_status.title = offline_msg[:127]

    def _poll_loop(self):
        while not self._stop.is_set():
            self._tick()
            self._stop.wait(self.refresh_seconds)

    def run(self):
        threading.Thread(target=self._poll_loop, daemon=True).start()
        self.icon_5h.run_detached()
        self.icon_7d.run_detached()
        self.icon_status.run()  # bloqueia a thread principal


if __name__ == "__main__":
    TrayApp().run()
