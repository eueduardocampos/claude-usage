import { Chart, registerables } from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';

Chart.register(...registerables);

const TICK = '#8e8e93';
const GRID = 'rgba(120,120,128,0.2)';
const base = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { labels: { color: TICK } } },
  scales: {
    x: { ticks: { color: TICK }, grid: { color: GRID } },
    y: { ticks: { color: TICK }, grid: { color: GRID } },
  },
};

export function DailyChart({ daily = [] }) {
  return (
    <div className="h-56">
      <Bar
        data={{
          labels: daily.map((d) => d.day.slice(5)),
          datasets: [{ label: 'tokens', data: daily.map((d) => d.tokens), backgroundColor: '#0a84ff', borderRadius: 6 }],
        }}
        options={base}
      />
    </div>
  );
}

export function HourChart({ hourOfDay = [] }) {
  const m = {};
  hourOfDay.forEach((r) => { m[r.hour] = r.avg_tokens; });
  const labels = [...Array(24).keys()];
  return (
    <div className="h-56">
      <Bar
        data={{
          labels: labels.map((h) => h + 'h'),
          datasets: [{ label: 'média de tokens', data: labels.map((h) => m[h] || 0), backgroundColor: '#34c759', borderRadius: 6 }],
        }}
        options={base}
      />
    </div>
  );
}

export function SnapChart({ snapshots = [] }) {
  const wins = { five_hour: 'Sessão (5h)', seven_day: 'Semana (7d)', seven_day_sonnet: 'Sonnet (7d)' };
  const colors = { five_hour: '#0a84ff', seven_day: '#ff9f0a', seven_day_sonnet: '#34c759' };
  const ts = [...new Set(snapshots.map((s) => s.ts))].sort();
  const datasets = Object.keys(wins).map((w) => {
    const mm = {};
    snapshots.filter((s) => s.window === w).forEach((s) => { mm[s.ts] = s.utilization; });
    return {
      label: wins[w],
      data: ts.map((t) => (t in mm ? mm[t] : null)),
      borderColor: colors[w], backgroundColor: colors[w], spanGaps: true, tension: 0.3,
    };
  });
  const opt = { ...base, scales: { ...base.scales, y: { ...base.scales.y, min: 0, suggestedMax: 100 } } };
  return (
    <div className="h-56">
      <Line
        data={{ labels: ts.map((t) => new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })), datasets }}
        options={opt}
      />
    </div>
  );
}
