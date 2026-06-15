import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api';
import { fmtTokens, fmtInt, statusKey } from './format';

const WINDOWS = [
  { key: 'five_hour', short: '5h' },
  { key: 'seven_day', short: '7d' },
  { key: 'seven_day_sonnet', short: 'Sonnet' },
];

const POLL_MS = 5000;

const STATUS_COLOR = {
  SEGURO: '#34c759',
  ATENCAO: '#ff9f0a',
  RISCO: '#ff453a',
  INDETERMINADO: '#8e8e93',
};

// Converte IDs do backend (ex.: "claude-opus-4-7", "claude-haiku-4-5-20251001")
// em rótulos amigáveis ("Opus 4.7", "Haiku 4.5"), preservando a versão.
function modelLabel(model) {
  if (!model) return '—';
  const stripped = String(model).replace(/^claude-/i, '');
  const parts = stripped.split('-');
  if (!parts.length) return String(model);
  const family = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  const version = [];
  for (let i = 1; i < parts.length; i++) {
    const p = parts[i];
    if (/^\d{8}$/.test(p)) break;      // sufixo de data (YYYYMMDD)
    if (/^\d+$/.test(p)) version.push(p);
    else break;
  }
  return version.length ? `${family} ${version.join('.')}` : family;
}

function fmtClock(ts) {
  if (!ts) return '—:—:—';
  return new Date(ts).toLocaleTimeString('pt-BR', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
}

function Ring({ size, stroke, value, status, children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = value == null ? 0 : Math.max(0, Math.min(value, 100));
  const dash = (pct / 100) * c;
  const color = STATUS_COLOR[statusKey(status)] || STATUS_COLOR.INDETERMINADO;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          className="widget-ring-track"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          style={{ transition: 'stroke-dasharray 700ms cubic-bezier(0.22,1,0.36,1), stroke 300ms ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}

function useAnimatedNumber(target, duration = 800) {
  const [val, setVal] = useState(target ?? 0);
  const valRef = useRef(target ?? 0);
  const initialized = useRef(false);
  useEffect(() => { valRef.current = val; }, [val]);
  useEffect(() => {
    if (target == null) return;
    if (!initialized.current) {
      initialized.current = true;
      setVal(target);
      valRef.current = target;
      return;
    }
    const from = valRef.current;
    const start = performance.now();
    let raf;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(from + (target - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function fmtCountdown(ms) {
  if (ms == null || isNaN(ms)) return '—';
  const sec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

// "quando" reinicia, com consciência de dia: às 22:29 / amanhã 01:30 / qua 01:30
function fmtResetWhen(ts, nowMs) {
  if (!ts) return null;
  const d = new Date(ts);
  const hhmm = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false });
  const now = new Date(nowMs);
  const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dayDiff = Math.round((startOf(d) - startOf(now)) / 86400000);
  if (dayDiff <= 0) return `às ${hhmm}`;
  if (dayDiff === 1) return `amanhã ${hhmm}`;
  const wd = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
  return `${wd} ${hhmm}`;
}

export default function Widget() {
  const [state, setState] = useState(null);
  const [total, setTotal] = useState(null);
  const lastUpdate = useRef(null);

  const load = useCallback(async () => {
    try {
      const [s, t] = await Promise.all([api.state(), api.total()]);
      setState(s);
      setTotal(t);
      lastUpdate.current = Date.now();
    } catch { /* próximo tick tenta de novo */ }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  const now = useNow(1000);

  // hero fixo: 5h é a janela que trava o uso na prática
  const HERO_KEY = 'five_hour';
  const hero = state?.windows?.[HERO_KEY];
  const secondaries = WINDOWS.filter((w) => w.key !== HERO_KEY);
  const heroResetTs = hero?.resets_at ? new Date(hero.resets_at).getTime() : null;

  const heroAnimated = useAnimatedNumber(hero?.utilization == null ? null : hero.utilization, 800);

  const dominant = state?.dominant_model;
  const burnDominant = dominant ? state?.burn_tokph?.[dominant] : null;

  const leaderboard = useMemo(() => {
    const arr = state?.history?.dia?.by_model || [];
    const totalTok = arr.reduce((s, x) => s + (x.tokens || 0), 0);
    if (!totalTok) return [];
    return arr
      .map((x) => ({ model: x.model, tokens: x.tokens || 0, pct: ((x.tokens || 0) / totalTok) * 100 }))
      .sort((a, b) => b.tokens - a.tokens)
      .slice(0, 4);
  }, [state]);

  const fresh = lastUpdate.current && (now - lastUpdate.current) < (POLL_MS * 2);

  const { isHorizontal, isNative } = useMemo(() => {
    if (typeof window === 'undefined') return { isHorizontal: false, isNative: false };
    const sp = new URLSearchParams(window.location.search);
    return {
      isHorizontal: sp.get('layout') === 'horizontal',
      isNative: sp.get('native') === '1',
    };
  }, []);

  // Em modo nativo (Tauri), a janela inteira é arrastável.
  const dragProps = isNative ? { 'data-tauri-drag-region': '' } : {};

  // Regulador de transparência (modo nativo): controla o alpha do vidro CSS.
  const [glassAlpha, setGlassAlpha] = useState(() => {
    if (typeof window === 'undefined') return 0.4;
    const v = parseFloat(window.localStorage.getItem('glassAlpha'));
    return Number.isFinite(v) ? v : 0.4;
  });
  useEffect(() => {
    if (!isNative) return;
    document.documentElement.style.setProperty('--glass-alpha', String(glassAlpha));
    try { window.localStorage.setItem('glassAlpha', String(glassAlpha)); } catch { /* */ }
  }, [glassAlpha, isNative]);

  const glassControl = isNative ? (
    <div
      className="widget-glass-ctl"
      onMouseDown={(e) => e.stopPropagation()}
      title="Transparência"
    >
      <input
        type="range"
        min="0.12"
        max="0.85"
        step="0.01"
        value={glassAlpha}
        onChange={(e) => setGlassAlpha(parseFloat(e.target.value))}
      />
    </div>
  ) : null;

  if (isHorizontal) {
    return (
      <div className="widget-shell">
        <div className="widget-card widget-card-h" {...dragProps}>
          <div className="widget-h-header">
            <div className="widget-row widget-gap-2">
              <span className={`widget-live ${fresh ? 'is-fresh' : ''}`} />
              <span className="widget-eyebrow">Claude · ao vivo</span>
            </div>
            <span className="widget-clock" title="Última atualização">
              {fmtClock(lastUpdate.current)}
            </span>
          </div>

          <div className="widget-h-body">
            <div className="widget-h-col-hero">
              <Ring size={108} stroke={9} value={hero?.utilization} status={hero?.status}>
                <div className="widget-hero-inner">
                  <span className="widget-hero-pct-h">
                    {hero?.utilization == null ? '—' : Math.round(heroAnimated) + '%'}
                  </span>
                  <span className="widget-hero-proj">
                    {hero?.projected != null ? `→ ${Math.round(hero.projected)}%` : ' '}
                  </span>
                </div>
              </Ring>
              <span className="widget-h-hero-label">Sessão 5h</span>
            </div>

            <div className="widget-h-col-rings">
              {secondaries.map(({ key, short }) => {
                const w = state?.windows?.[key];
                return (
                  <div key={key} className="widget-h-mini-row">
                    <Ring size={38} stroke={4} value={w?.utilization} status={w?.status}>
                      <span className="widget-h-mini-pct">
                        {w?.utilization == null ? '—' : Math.round(w.utilization) + '%'}
                      </span>
                    </Ring>
                    <span className="widget-h-mini-label">{short}</span>
                  </div>
                );
              })}
            </div>

            <div className="widget-h-col-info">
              <div>
                <div className="widget-footer-label">Modelo mais usado</div>
                <div className="widget-h-info-value">
                  {dominant ? modelLabel(dominant) : '—'}
                  {burnDominant != null && (
                    <span className="widget-h-info-rate"> · {fmtTokens(burnDominant)}/h</span>
                  )}
                </div>
              </div>
              <div>
                <div className="widget-footer-label">Reinicia em</div>
                <div className="widget-footer-value">
                  {heroResetTs ? fmtCountdown(heroResetTs - now) : '—'}
                </div>
                {heroResetTs && (
                  <div className="widget-reset-when">{fmtResetWhen(heroResetTs, now)}</div>
                )}
              </div>
            </div>
          </div>

          <div className="widget-total-strip">
            <span className="widget-total-label">Total de tokens</span>
            <span className="widget-total-count">{fmtInt(total?.total_tokens)}</span>
          </div>
          {glassControl}
        </div>
      </div>
    );
  }

  return (
    <div className="widget-shell">
      <div className="widget-card" {...dragProps}>
        <div className="widget-row widget-header">
          <div className="widget-row widget-gap-2">
            <span className={`widget-live ${fresh ? 'is-fresh' : ''}`} />
            <span className="widget-eyebrow">Claude · ao vivo</span>
          </div>
          <span className="widget-clock" title="Última atualização">
            {fmtClock(lastUpdate.current)}
          </span>
        </div>

        <div className="widget-hero">
          <Ring size={148} stroke={12} value={hero?.utilization} status={hero?.status}>
            <div className="widget-hero-inner">
              <span className="widget-hero-pct">
                {hero?.utilization == null ? '—' : Math.round(heroAnimated) + '%'}
              </span>
              <span className="widget-hero-proj">
                {hero?.projected != null ? `→ ${Math.round(hero.projected)}%` : ' '}
              </span>
            </div>
          </Ring>
          {(dominant || burnDominant != null) && (
            <div className="widget-dominant">
              <div className="widget-dominant-caption">Modelo mais usado na sessão</div>
              <div className="widget-dominant-line">
                {dominant && <span className="widget-dominant-name">{modelLabel(dominant)}</span>}
                {burnDominant != null && (
                  <span className="widget-dominant-rate">· {fmtTokens(burnDominant)}/h</span>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="widget-secondaries">
          {secondaries.map(({ key, short }) => {
            const w = state?.windows?.[key];
            return (
              <div key={key} className="widget-secondary">
                <Ring size={56} stroke={5.5} value={w?.utilization} status={w?.status}>
                  <span className="widget-secondary-pct">
                    {w?.utilization == null ? '—' : Math.round(w.utilization) + '%'}
                  </span>
                </Ring>
                <span className="widget-secondary-label">{short}</span>
              </div>
            );
          })}
        </div>

        {leaderboard.length > 0 && (
          <div className="widget-leaderboard">
            <div className="widget-leaderboard-title">Hoje por modelo</div>
            <div className="widget-leaderboard-list">
              {leaderboard.map((m) => (
                <div key={m.model} className="widget-leaderboard-row">
                  <span className="widget-model-tag">{modelLabel(m.model)}</span>
                  <div className="widget-bar-track">
                    <div className="widget-bar-fill" style={{ width: m.pct + '%' }} />
                  </div>
                  <span className="widget-leaderboard-pct">{Math.round(m.pct)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="widget-footer">
          <div>
            <div className="widget-footer-label">Total de tokens</div>
            <div className="widget-footer-value widget-total-count">{fmtInt(total?.total_tokens)}</div>
          </div>
          <div className="widget-footer-right">
            <div className="widget-footer-label">Reinicia em</div>
            <div className="widget-footer-value">
              {heroResetTs ? fmtCountdown(heroResetTs - now) : '—'}
            </div>
            {heroResetTs && (
              <div className="widget-reset-when">{fmtResetWhen(heroResetTs, now)}</div>
            )}
          </div>
        </div>
        {glassControl}
      </div>
    </div>
  );
}
