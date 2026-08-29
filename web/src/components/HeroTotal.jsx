import { useEffect, useRef, useState } from 'react';
import { fmtInt, fmtMoneyUSD } from '../format';

function useCountUp(target, dur = 1100) {
  const [val, setVal] = useState(target || 0);
  const fromRef = useRef(target || 0);
  const rafRef = useRef(0);
  useEffect(() => {
    const from = fromRef.current;
    const start = performance.now();
    const diff = (target || 0) - from;
    cancelAnimationFrame(rafRef.current);
    const step = (now) => {
      const t = Math.min((now - start) / dur, 1);
      const e = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setVal(Math.round(from + diff * e));
      if (t < 1) rafRef.current = requestAnimationFrame(step);
      else fromRef.current = target || 0;
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, dur]);
  return val;
}

// Banner "liquid glass" com o total absoluto de tokens da vida toda.
export default function HeroTotal({ tokens = 0, cost = 0, turns = 0 }) {
  const shown = useCountUp(tokens);
  return (
    <div className="mx-4 mt-4 rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] px-6 py-5">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-black/50 dark:text-white/60">
        Total de tokens · vida toda <span className="live-dot" />
      </div>
      <div className="mt-1 text-5xl font-extrabold tabular-nums text-black dark:text-white">
        {fmtInt(shown)}
      </div>
      <div className="mt-1 text-sm text-black/55 dark:text-white/65">
        {fmtMoneyUSD(cost)} estimado · {fmtInt(turns)} interações
      </div>
    </div>
  );
}
