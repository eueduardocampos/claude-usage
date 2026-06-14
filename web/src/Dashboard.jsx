import { useCallback, useEffect, useRef, useState } from 'react';
import { Page, Navbar, Block, BlockTitle, Link } from 'konsta/react';
import { api } from './api';
import { localTime } from './format';
import HeroTotal from './components/HeroTotal';
import WindowCard from './components/WindowCard';
import VerdictCard from './components/VerdictCard';
import ExtraUsageCard from './components/ExtraUsageCard';
import HistoryCard from './components/HistoryCard';
import ConfigCard from './components/ConfigCard';
import { DailyChart, HourChart, SnapChart } from './components/Charts';

const WIN_ORDER = ['five_hour', 'seven_day', 'seven_day_sonnet'];

export default function Dashboard() {
  const [state, setState] = useState(null);
  const [total, setTotal] = useState(null);
  const [history, setHistory] = useState(null);
  const stateTimer = useRef(0);

  const loadState = useCallback(async () => { try { setState(await api.state()); } catch { /* */ } }, []);
  const loadHistory = useCallback(async () => { try { setHistory(await api.history()); } catch { /* */ } }, []);
  const loadTotal = useCallback(async () => { try { setTotal(await api.total()); } catch { /* */ } }, []);

  useEffect(() => { loadState(); loadHistory(); loadTotal(); }, [loadState, loadHistory, loadTotal]);

  // banner quase em tempo real
  useEffect(() => {
    const id = setInterval(loadTotal, 4000);
    return () => clearInterval(id);
  }, [loadTotal]);

  // estado + historico no intervalo configurado
  useEffect(() => {
    const sec = state?.config?.refresh_seconds || 120;
    clearInterval(stateTimer.current);
    stateTimer.current = setInterval(() => { loadState(); loadHistory(); }, Math.max(15, sec) * 1000);
    return () => clearInterval(stateTimer.current);
  }, [state?.config?.refresh_seconds, loadState, loadHistory]);

  const setHours = async (h) => { await api.setConfig({ intended_hours: h }); loadState(); };
  const saveRefresh = async (sec) => { await api.setConfig({ refresh_seconds: sec }); loadState(); };
  const refreshNow = async () => { await api.refresh(); loadState(); loadHistory(); loadTotal(); };
  const reconnect = async () => { await api.authStart(); };

  const connected = state?.auth_connected;
  const cur = state?.config?.currency || 'BRL';

  return (
    <Page>
      <Navbar
        title="Consumo do Claude"
        subtitle={connected ? 'conta conectada' : state ? 'desconectado' : 'conectando…'}
        right={<Link onClick={refreshNow}>Atualizar</Link>}
      />

      <div className="mx-auto w-full max-w-2xl pb-10">
        <HeroTotal tokens={total?.total_tokens} cost={total?.total_cost} turns={total?.total_turns} />

        <Block className="!mt-4">
          <VerdictCard
            verdict={state?.switch?.verdict}
            message={state?.switch?.message}
            windows={state?.switch?.windows}
            intendedHours={state?.config?.intended_hours}
            dominant={state?.dominant_model}
            factor={state?.switch?.factor}
            onChangeHours={setHours}
          />
        </Block>

        <BlockTitle>Limites ao vivo</BlockTitle>
        <Block className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {WIN_ORDER.map((k) => {
            const w = state?.windows?.[k];
            if (!w) return null;
            return (
              <WindowCard
                key={k}
                label={w.label}
                utilization={w.utilization}
                projected={w.projected}
                status={w.status}
                hoursToReset={w.hours_to_reset}
                resetsAt={w.resets_at}
                eta100={w.eta_100}
              />
            );
          })}
          {state?.extra_usage && (
            <ExtraUsageCard used={state.extra_usage.used} limit={state.extra_usage.limit} currency={cur} />
          )}
        </Block>

        <HistoryCard history={state?.history || {}} />

        <BlockTitle>Gráficos</BlockTitle>
        <Block strong inset className="space-y-6">
          <div>
            <div className="mb-1 text-sm font-semibold">Tokens por dia</div>
            <DailyChart daily={history?.daily || []} />
          </div>
          <div>
            <div className="mb-1 text-sm font-semibold">Média por hora do dia</div>
            <HourChart hourOfDay={history?.hour_of_day || []} />
          </div>
          <div>
            <div className="mb-1 text-sm font-semibold">Utilização das janelas (%)</div>
            <SnapChart snapshots={history?.snapshots || []} />
          </div>
        </Block>

        <ConfigCard
          refreshSeconds={state?.config?.refresh_seconds}
          onSave={saveRefresh}
          connected={connected}
          onReconnect={reconnect}
        />

        <Block className="text-center text-xs text-black/40 dark:text-white/40">
          atualizado {localTime(state?.generated_at)} · roda em localhost, uso pessoal
        </Block>
      </div>
    </Page>
  );
}
