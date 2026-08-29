import { useRef, useState } from 'react';

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const HOURS = [...Array(24).keys()];
const DOW_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Seg → Dom

function levelClass(norm) {
  if (norm === 0)   return 'bg-black/[0.04] dark:bg-white/[0.04]';
  if (norm < 0.12)  return 'bg-amber-100 dark:bg-amber-900/40';
  if (norm < 0.28)  return 'bg-amber-200 dark:bg-amber-800/60';
  if (norm < 0.50)  return 'bg-orange-300 dark:bg-orange-700/80';
  if (norm < 0.72)  return 'bg-orange-500 dark:bg-orange-500';
  if (norm < 0.88)  return 'bg-red-500 dark:bg-red-500';
  return                   'bg-red-700 dark:bg-red-400';
}

function fmtTokens(v) {
  if (!v) return '—';
  if (v >= 1e9) return (v / 1e9).toFixed(2) + ' B';
  if (v >= 1e6) return (v / 1e6).toFixed(1) + ' M';
  if (v >= 1e3) return (v / 1e3).toFixed(0) + ' k';
  return String(Math.round(v));
}

export default function HeatmapChart({ heatmap = [] }) {
  const containerRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);

  if (!heatmap.length) return null;

  const matrix = {};
  const dayTotals = {};
  let peak = 0;

  heatmap.forEach(({ dow, hour, avg_tokens }) => {
    if (!matrix[dow]) matrix[dow] = {};
    matrix[dow][hour] = avg_tokens;
    dayTotals[dow] = (dayTotals[dow] || 0) + avg_tokens;
    if (avg_tokens > peak) peak = avg_tokens;
  });

  const maxDayTotal = Math.max(...Object.values(dayTotals), 1);

  const handleEnter = (e, dow, hour, v) => {
    if (!containerRef.current) return;
    const cRect = containerRef.current.getBoundingClientRect();
    const tRect = e.currentTarget.getBoundingClientRect();
    setTooltip({
      dow, hour, v,
      x: tRect.left - cRect.left + tRect.width / 2,
      y: tRect.top - cRect.top,
    });
  };

  return (
    <div
      ref={containerRef}
      className="relative select-none"
      onMouseLeave={() => setTooltip(null)}
    >
      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute z-20 pointer-events-none"
          style={{
            left: tooltip.x,
            top: tooltip.y > 80 ? tooltip.y - 68 : tooltip.y + 26,
            transform: 'translateX(-50%)',
          }}
        >
          <div className="bg-gray-950 dark:bg-white text-white dark:text-gray-950 text-xs rounded-xl px-3 py-2 shadow-2xl whitespace-nowrap">
            <div className="font-semibold tracking-tight">
              {DAYS[tooltip.dow]}, {tooltip.hour}h–{tooltip.hour + 1}h
            </div>
            <div className="mt-0.5 opacity-60 font-mono tabular-nums">
              {fmtTokens(tooltip.v)} tokens (média)
            </div>
          </div>
        </div>
      )}

      {/* Hour header */}
      <div className="flex mb-1.5">
        <div className="w-10 shrink-0" />
        <div className="flex flex-1 gap-[2px]">
          {HOURS.map(h => (
            <div key={h} className="flex-1 text-center text-[9px] text-black/20 dark:text-white/20 leading-none font-mono">
              {h % 6 === 0 ? `${h}h` : ''}
            </div>
          ))}
        </div>
        <div className="w-14 shrink-0" />
      </div>

      {/* Rows */}
      {DOW_ORDER.map(dow => (
        <div key={dow} className="flex items-center gap-1 mb-[3px]">
          <div className="w-10 shrink-0 text-xs font-medium text-black/40 dark:text-white/40 text-right pr-2 tracking-tight">
            {DAYS[dow]}
          </div>
          <div className="flex flex-1 gap-[2px]">
            {HOURS.map(h => {
              const v = matrix[dow]?.[h] || 0;
              const n = peak > 0 ? v / peak : 0;
              return (
                <div
                  key={h}
                  className={`flex-1 rounded-[3px] cursor-default transition-transform duration-75 hover:scale-125 hover:z-10 relative ${levelClass(n)}`}
                  style={{ aspectRatio: '1' }}
                  onMouseEnter={(e) => handleEnter(e, dow, h, v)}
                />
              );
            })}
          </div>
          {/* Day total */}
          <div className="w-14 shrink-0 flex items-center pl-2">
            <div className="w-full h-1.5 rounded-full bg-black/5 dark:bg-white/8 overflow-hidden">
              <div
                className="h-full rounded-full bg-orange-400 dark:bg-orange-500"
                style={{ width: `${((dayTotals[dow] || 0) / maxDayTotal) * 100}%` }}
              />
            </div>
          </div>
        </div>
      ))}

      {/* Legend */}
      <div className="flex items-center justify-end gap-[3px] mt-3">
        <span className="text-[10px] text-black/25 dark:text-white/25 mr-1.5 tracking-tight">menos</span>
        {[
          'bg-black/[0.04] dark:bg-white/[0.04]',
          'bg-amber-100 dark:bg-amber-900/40',
          'bg-amber-200 dark:bg-amber-800/60',
          'bg-orange-300 dark:bg-orange-700/80',
          'bg-orange-500',
          'bg-red-500',
          'bg-red-700 dark:bg-red-400',
        ].map((c, i) => (
          <div key={i} className={`w-3 h-3 rounded-[3px] ${c}`} />
        ))}
        <span className="text-[10px] text-black/25 dark:text-white/25 ml-1.5 tracking-tight">mais</span>
      </div>
    </div>
  );
}
