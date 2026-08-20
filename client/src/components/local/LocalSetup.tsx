import React, { useState } from 'react';
import { motion } from 'framer-motion';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import { useLocalGame, type LocalPlayerSetup } from '../../context/LocalGameContext';
import type { GameMode, RoomConfig } from '../../types';

interface Row {
  id: string;
  ownerName: string;
  teamName: string;
}

function newRow(): Row {
  return { id: crypto.randomUUID(), ownerName: '', teamName: '' };
}

export default function LocalSetup({ onExit }: { onExit: () => void }) {
  const { setup } = useLocalGame();
  const [rows, setRows] = useState<Row[]>([newRow(), newRow()]);
  const [mode, setMode] = useState<GameMode>('futsal');
  const [budget, setBudget] = useState(20);
  const [formation, setFormation] = useState<RoomConfig['formation']>('4-3-3');
  const [tournamentFormat, setTournamentFormat] = useState<'league' | 'knockout' | 'worldcup'>('league');
  const [auctionStyle, setAuctionStyle] = useState<'sealed' | 'open'>('sealed');
  const [playerPool, setPlayerPool] = useState<'mixed' | 'current' | 'legends'>('mixed');
  const [jokersEnabled, setJokersEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const maxPlayers = mode === 'futsal' ? 6 : 16;
  const budgetOptions = mode === 'futsal' ? [10, 15, 20, 30, 50] : [30, 40, 50, 75, 100];

  const validRows = rows.filter((r) => r.ownerName.trim() && r.teamName.trim());
  const count = validRows.length;

  const formatOptions = [
    { value: 'league', label: 'Pontos corridos (qualquer nº de times)', enabled: count >= 2 },
    { value: 'knockout', label: 'Mata-mata (precisa de 4 ou 8 times)', enabled: count === 4 || count === 8 },
    { value: 'worldcup', label: 'Copa do Mundo (precisa de 16 times)', enabled: count === 16 },
  ];

  function updateRow(id: string, field: 'ownerName' | 'teamName', value: string) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  function addRow() {
    if (rows.length >= maxPlayers) return;
    setRows((rs) => [...rs, newRow()]);
  }

  function removeRow(id: string) {
    setRows((rs) => (rs.length > 2 ? rs.filter((r) => r.id !== id) : rs));
  }

  function handleStart() {
    if (count < 2) {
      setError('Adicione pelo menos 2 jogadores.');
      return;
    }
    if (count > maxPlayers) {
      setError(`Máximo de ${maxPlayers} jogadores no modo ${mode === 'futsal' ? 'Futsal' : 'Futebol Completo'}.`);
      return;
    }
    const selectedFormat = formatOptions.find((f) => f.value === tournamentFormat);
    if (!selectedFormat?.enabled) {
      setError('O formato de torneio escolhido não é compatível com o número de jogadores.');
      return;
    }
    const names = new Set(validRows.map((r) => r.teamName.trim().toLowerCase()));
    if (names.size !== validRows.length) {
      setError('Os nomes dos times precisam ser únicos.');
      return;
    }

    setError(null);
    const players: LocalPlayerSetup[] = validRows.map((r) => ({ ownerName: r.ownerName.trim(), teamName: r.teamName.trim() }));
    setup(players, {
      mode,
      formation,
      budget,
      bidTimer: 30,
      tournamentFormat: selectedFormat.enabled ? tournamentFormat : 'league',
      maxPlayers,
      auctionStyle,
      playerPool,
      jokersEnabled,
      vetoEnabled: false,
    });
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 max-w-2xl mx-auto flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <button onClick={onExit} className="text-white/50 hover:text-white text-sm">
          ← Voltar
        </button>
      </div>

      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-center">
        <div className="text-5xl mb-2">📱⚽</div>
        <h1 className="text-3xl font-extrabold text-gold">Jogar no mesmo aparelho</h1>
        <p className="text-white/60 text-sm mt-1">Cadastre todo mundo agora — depois é só ir passando o celular na hora do lance.</p>
      </motion.div>

      <div className="flex flex-col gap-3">
        <h3 className="text-gold font-bold">👥 Jogadores ({count})</h3>
        {rows.map((row, i) => (
          <div key={row.id} className="flex gap-2 items-center">
            <span className="text-white/40 text-sm w-5 text-center">{i + 1}</span>
            <Input placeholder="Nome do jogador" value={row.ownerName} onChange={(e) => updateRow(row.id, 'ownerName', e.target.value)} />
            <Input placeholder="Nome do time" value={row.teamName} onChange={(e) => updateRow(row.id, 'teamName', e.target.value)} />
            {rows.length > 2 && (
              <button onClick={() => removeRow(row.id)} className="text-red-400 px-2 text-lg">
                ✕
              </button>
            )}
          </div>
        ))}
        {rows.length < maxPlayers && (
          <Button variant="ghost" onClick={addRow} className="text-sm py-2">
            + Adicionar jogador
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-3 bg-white/5 border border-white/10 rounded-2xl p-4">
        <h3 className="text-gold font-bold">⚙️ Configurações</h3>
        <Select
          label="Modo de jogo"
          value={mode}
          onChange={(e) => {
            const m = e.target.value as GameMode;
            setMode(m);
            setBudget(m === 'futsal' ? 20 : 50);
          }}
          options={[
            { value: 'futsal', label: 'Futsal (2 a 6 jogadores)' },
            { value: 'full', label: 'Futebol Completo (2 a 16 jogadores)' },
          ]}
        />
        {mode === 'full' && (
          <Select
            label="Formação"
            value={formation}
            onChange={(e) => setFormation(e.target.value as RoomConfig['formation'])}
            options={[
              { value: '4-3-3', label: '4-3-3' },
              { value: '4-4-2', label: '4-4-2' },
              { value: '3-5-2', label: '3-5-2' },
            ]}
          />
        )}
        <Select label="Budget inicial" value={budget} onChange={(e) => setBudget(Number(e.target.value))} options={budgetOptions.map((v) => ({ value: v, label: `R$ ${v}` }))} />
        <Select
          label="Estilo do leilão"
          value={auctionStyle}
          onChange={(e) => setAuctionStyle(e.target.value as 'sealed' | 'open')}
          options={[
            { value: 'sealed', label: 'Lance fechado (passa o aparelho, cada um dá seu lance em segredo)' },
            { value: 'open', label: 'Lance aberto (todo mundo vê e vai cobrindo, na tela pública)' },
          ]}
        />
        <Select
          label="Craques do leilão"
          value={playerPool}
          onChange={(e) => setPlayerPool(e.target.value as 'mixed' | 'current' | 'legends')}
          options={[
            { value: 'mixed', label: 'Todos (atuais + lendas no auge)' },
            { value: 'current', label: 'Só atuais (nota de hoje)' },
            { value: 'legends', label: 'Só lendas (nota no auge/prime)' },
          ]}
        />
        <Select
          label="Formato do torneio"
          value={tournamentFormat}
          onChange={(e) => setTournamentFormat(e.target.value as any)}
          options={formatOptions.map((f) => ({ value: f.value, label: f.enabled ? f.label : `${f.label} — indisponível` }))}
        />
        <label className="flex items-center gap-2 text-sm text-white/80">
          <input type="checkbox" checked={jokersEnabled} onChange={(e) => setJokersEnabled(e.target.checked)} />
          🃏 Ativar jogadores coringa
        </label>
      </div>

      {error && <p className="text-red-400 text-sm text-center">{error}</p>}

      <Button onClick={handleStart} className="text-lg py-4">
        🔨 Começar Leilão
      </Button>
    </div>
  );
}
