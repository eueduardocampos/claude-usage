import VerdictCard from './VerdictCard';

export default {
  title: 'Painel/VerdictCard',
  component: VerdictCard,
};

export const PodeTrocar = {
  args: {
    verdict: 'SEGURO',
    message: 'Pode trocar pra Opus com folga.',
    windows: { five_hour: { projected: 40 }, seven_day: { projected: 18 } },
    intendedHours: 2, dominant: 'claude-sonnet-4-6', factor: 1.67,
  },
};

export const NaoTroque = {
  args: {
    verdict: 'RISCO',
    message: 'NÃO troque pra Opus agora: deve estourar o limite antes do reset.',
    windows: { five_hour: { projected: 137 }, seven_day: { projected: 22 } },
    intendedHours: 0.5, dominant: 'claude-opus-4-8', factor: 1,
  },
};
