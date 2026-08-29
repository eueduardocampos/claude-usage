import { fmtDuration, localTime, statusInfo, statusKey } from '../format';

const R = 40;
const ARC_LEN = Math.PI * R; // 125.66 — semicircle

const STATUS_STROKE = {
  SEGURO: '#16a34a',
  ATENCAO: '#d97706',
  RISCO: '#dc2626',
  INDETERMINADO: '#9ca3af',
};

function ArcGauge({ utilization, status }) {
  const util = Math.min(Math.max(utilization || 0, 0), 100);
  const fill = ARC_LEN * (util / 100);
  const dashOffset = ARC_LEN - fill;
  const color = STATUS_STROKE[status] || STATUS_STROKE.INDETERMINADO;

  return (
    <svg viewBox="0 0 100 58" className="w-full max-w-[132px] mx-auto overflow-visible">
      {/* Track */}
      <path
        d="M 10 54 A 40 40 0 0 1 90 54"
        fill="none"
        stroke="currentColor"
        className="text-black/[0.07] dark:text-white/[0.10]"
        strokeWidth="8"
        strokeLinecap="round"
      />
      {/* Fill */}
      <path
        d="M 10 54 A 40 40 0 0 1 90 54"
        fill="none"
        stroke={color}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={`${ARC_LEN} ${ARC_LEN}`}
        strokeDashoffset={dashOffset}
        style={{ transition: 'stroke-dashoffset 0.65s cubic-bezier(0.4,0,0.2,1)' }}
      />
      {/* Percentage */}
      <text
        x="50" y="46"
        textAnchor="middle"
        fontSize="21"
        fontWeight="700"
        fill={utilization == null ? '#9ca3af' : color}
        fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
      >
        {utilization == null ? '—' : Math.round(utilization) + '%'}
      </text>
    </svg>
  );
}

export default function WindowCard({
  label, utilization, projected, projectedLinear, status, hoursToReset, resetsAt, eta100, smart,
}) {
  const s = statusInfo(status);
  const proj = projected == null ? null : Math.round(projected);
  const projLin = projectedLinear == null ? null : Math.round(projectedLinear);
  const showLinear = smart && projLin != null && proj != null && Math.abs(projLin - proj) >= 5;

  return (
    <div className="rounded-2xl bg-white dark:bg-white/[0.04] border border-black/[0.07] dark:border-white/[0.09] p-4">
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-black/35 dark:text-white/35 leading-none mt-0.5">
          {label}
        </span>
        <span className={`shrink-0 ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold text-white leading-none ${s.dot}`}>
          {s.label}
        </span>
      </div>

      {/* Arc gauge */}
      <ArcGauge utilization={utilization} status={status} />

      {/* Projection */}
      <div className="mt-1 text-center">
        <div className="text-[10px] uppercase tracking-widest text-black/30 dark:text-white/30 mb-1">
          projeção no reset
        </div>
        <div className={`text-xl font-bold tabular-nums ${s.text}`}>
          {proj == null ? '—' : proj + '%'}
        </div>
        {showLinear && (
          <div className="text-[10px] text-black/30 dark:text-white/30 mt-0.5">
            sem perfil horário: {projLin}%
          </div>
        )}
        {smart && !showLinear && proj != null && (
          <div className="text-[10px] text-black/25 dark:text-white/25 mt-0.5">
            ajustado ao perfil
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-3 pt-3 border-t border-black/[0.05] dark:border-white/[0.07] text-center">
        <div className="text-[11px] text-black/40 dark:text-white/40 leading-relaxed">
          reseta em{' '}
          <span className="font-semibold text-black/60 dark:text-white/60">
            {fmtDuration(hoursToReset)}
          </span>
          <br />
          <span className="font-mono text-[10px]">{localTime(resetsAt)}</span>
        </div>
        {eta100 && statusKey(status) === 'RISCO' && (
          <div className="mt-2 text-[11px] font-semibold text-red-500">
            bate 100% ~{localTime(eta100)}
          </div>
        )}
      </div>
    </div>
  );
}
