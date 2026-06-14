import { useEffect, useState } from 'react';
import { Block, BlockTitle, Button } from 'konsta/react';

export default function ConfigCard({ refreshSeconds = 120, onSave, connected = true, onReconnect }) {
  const [val, setVal] = useState(refreshSeconds);
  const [msg, setMsg] = useState('');
  useEffect(() => { setVal(refreshSeconds); }, [refreshSeconds]);
  return (
    <>
      <BlockTitle>Configuração</BlockTitle>
      <Block strong inset className="space-y-3">
        <label className="block text-sm">
          Atualizar a cada
          <input
            type="number" min="15" step="15" value={val}
            onChange={(e) => setVal(e.target.value)}
            className="mx-2 w-24 rounded-lg border border-black/15 bg-transparent px-2 py-1 dark:border-white/20"
          />
          segundos
        </label>
        <div className="flex items-center gap-2">
          <Button
            inline
            onClick={() => { onSave && onSave(Number(val)); setMsg('salvo ✓'); setTimeout(() => setMsg(''), 2000); }}
          >
            Salvar
          </Button>
          {!connected && (
            <Button inline tonal onClick={onReconnect}>Reconectar conta</Button>
          )}
          {msg && <span className="text-sm text-green-600">{msg}</span>}
        </div>
      </Block>
    </>
  );
}
