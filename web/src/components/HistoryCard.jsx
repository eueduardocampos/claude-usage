import { List, ListItem, BlockTitle } from 'konsta/react';
import { fmtTokens } from '../format';

const LABELS = { geral: 'Geral', mes: 'Este mês', semana: 'Esta semana', dia: 'Hoje' };

export default function HistoryCard({ history = {} }) {
  return (
    <>
      <BlockTitle>Histórico de consumo</BlockTitle>
      <List strong inset>
        {['geral', 'mes', 'semana', 'dia'].map((sc) => {
          const d = history[sc];
          if (!d) return null;
          return (
            <ListItem
              key={sc}
              title={LABELS[sc]}
              after={fmtTokens(d.total_tokens) + ' tok'}
              subtitle={`média/h ${fmtTokens(d.tokens_per_hour)} · ${d.active_hours}h ativas`}
              text={`custo estimado $ ${(d.total_cost || 0).toFixed(2)}`}
            />
          );
        })}
      </List>
    </>
  );
}
