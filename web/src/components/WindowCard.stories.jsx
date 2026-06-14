import WindowCard from './WindowCard';

export default {
  title: 'Painel/WindowCard',
  component: WindowCard,
};

export const Seguro = {
  args: {
    label: 'Semana (7d)', utilization: 20, projected: 33, status: 'SEGURO',
    hoursToReset: 3.8, resetsAt: '2026-06-14T00:59:59+00:00',
  },
};

export const Atencao = {
  args: {
    label: 'Sessão (5h)', utilization: 72, projected: 88, status: 'ATENCAO',
    hoursToReset: 2.1, resetsAt: '2026-06-13T23:30:00+00:00',
  },
};

export const Risco = {
  args: {
    label: 'Sessão (5h)', utilization: 94, projected: 137, status: 'RISCO',
    hoursToReset: 1.3, resetsAt: '2026-06-13T22:29:59+00:00',
    eta100: '2026-06-13T21:23:32+00:00',
  },
};
