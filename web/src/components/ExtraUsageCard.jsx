import { Card } from 'konsta/react';
import { fmtMoney } from '../format';

export default function ExtraUsageCard({ used, limit, currency }) {
  const pct = limit && used != null ? Math.round((used / limit) * 100) : null;
  return (
    <Card className="!m-0">
      <div className="font-semibold">Excedente (créditos)</div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{fmtMoney(used, currency)}</div>
      <div className="text-xs text-black/50 dark:text-white/55">
        {limit != null
          ? `limite ${fmtMoney(limit, currency)}${pct != null ? ` · ${pct}%` : ''}`
          : 'sem limite definido'}
      </div>
    </Card>
  );
}
