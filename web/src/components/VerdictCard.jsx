import { Card, Segmented, SegmentedButton } from 'konsta/react';
import { statusInfo } from '../format';

const HOURS = [0.5, 1, 2, 3, 4];
const HLABEL = { 0.5: '30m', 1: '1h', 2: '2h', 3: '3h', 4: '4h' };

function short(m) {
  if (!m) return '—';
  if (m.includes('opus')) return 'Opus';
  if (m.includes('sonnet')) return 'Sonnet';
  if (m.includes('haiku')) return 'Haiku';
  return m;
}

// Veredito de troca de modelo (o cartao principal).
export default function VerdictCard({
  verdict, message, windows = {}, intendedHours = 2, dominant, factor, onChangeHours,
}) {
  const s = statusInfo(verdict);
  const w5 = windows.five_hour;
  const w7 = windows.seven_day;
  return (
    <Card className={`!m-0 border-l-4 ${s.bar.replace('bg-', 'border-')}`}>
      <div className="text-xs font-medium uppercase tracking-wider text-black/50 dark:text-white/60">
        É seguro trocar de modelo?
      </div>
      <div className={`mt-1 text-xl font-bold ${s.text}`}>
        {message || 'Coletando dados…'}
      </div>
      <div className="mt-1 text-sm text-black/55 dark:text-white/65">
        {w5 && <>sessão → {Math.round(w5.projected)}% </>}
        {w7 && <>· semana → {Math.round(w7.projected)}%</>}
      </div>
      {dominant && (
        <div className="mt-1 text-xs text-black/40 dark:text-white/50">
          modelo atual: {short(dominant)}{factor ? ` · Opus pesa ~${factor}× mais` : ''} · estimativa
        </div>
      )}
      <div className="mt-3 text-xs text-black/45 dark:text-white/55">Pretendo trabalhar mais:</div>
      <div className="mt-1">
        <Segmented strong>
          {HOURS.map((h) => (
            <SegmentedButton
              key={h}
              active={Number(intendedHours) === h}
              onClick={() => onChangeHours && onChangeHours(h)}
            >
              {HLABEL[h]}
            </SegmentedButton>
          ))}
        </Segmented>
      </div>
    </Card>
  );
}
