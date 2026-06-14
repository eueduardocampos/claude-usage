export function fmtTokens(n) {
  n = n || 0;
  if (n >= 1e9) return (n / 1e9).toFixed(2) + ' B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + ' M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + ' K';
  return String(Math.round(n));
}

export function fmtInt(n) {
  return (n || 0).toLocaleString('pt-BR');
}

export function fmtMoneyUSD(n) {
  return '$ ' + (n || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
}

export function fmtMoney(n, cur) {
  if (n == null) return '—';
  const sym = cur === 'BRL' ? 'R$ ' : cur ? cur + ' ' : '$ ';
  return sym + n.toLocaleString('pt-BR', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
}

export function fmtDuration(h) {
  if (h == null) return '—';
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return (hh > 0 ? hh + 'h ' : '') + mm + 'm';
}

export function localTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

export function statusKey(s) {
  return (s || 'INDETERMINADO').toUpperCase();
}

// cor por status do semaforo (classes Tailwind)
export const STATUS = {
  SEGURO: { label: 'Seguro', dot: 'bg-green-500', text: 'text-green-600 dark:text-green-400', bar: 'bg-green-500' },
  ATENCAO: { label: 'Atenção', dot: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400', bar: 'bg-amber-500' },
  RISCO: { label: 'Risco', dot: 'bg-red-500', text: 'text-red-600 dark:text-red-400', bar: 'bg-red-500' },
  INDETERMINADO: { label: 'Sem dados', dot: 'bg-gray-400', text: 'text-gray-500', bar: 'bg-gray-400' },
};
export function statusInfo(s) {
  return STATUS[statusKey(s)] || STATUS.INDETERMINADO;
}
