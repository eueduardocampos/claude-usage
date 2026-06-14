import { Card } from 'konsta/react';
import { fmtDuration, localTime, statusInfo, statusKey } from '../format';

// Cartao-semaforo de uma janela (sessao 5h, semana 7d, sonnet 7d).
export default function WindowCard({
  label, utilization, projected, status, hoursToReset, resetsAt, eta100,
}) {
  const s = statusInfo(status);
  const util = utilization == null ? null : Math.round(utilization);
  const proj = projected == null ? null : Math.round(projected);
  return (
    <Card className="!m-0">
      <div className="flex items-center justify-between">
        <span className="font-semibold">{label}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold text-white ${s.dot}`}>
          {s.label}
        </span>
      </div>
      <div className="mt-1 text-3xl font-bold tabular-nums">
        {util == null ? '—' : util + '%'}
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/15">
        <div className={`h-full rounded-full ${s.bar}`} style={{ width: Math.min(util || 0, 100) + '%' }} />
      </div>
      <div className="mt-2 text-sm">
        projeção no reset: <b className={s.text}>{proj == null ? '—' : proj + '%'}</b>
      </div>
      <div className="text-xs text-black/50 dark:text-white/55">
        reseta em {fmtDuration(hoursToReset)} · {localTime(resetsAt)}
      </div>
      {eta100 && statusKey(status) === 'RISCO' && (
        <div className="text-xs font-semibold text-red-500">bate 100% ~{localTime(eta100)}</div>
      )}
    </Card>
  );
}
