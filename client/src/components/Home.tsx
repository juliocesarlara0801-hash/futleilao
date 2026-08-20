import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useGame } from '../context/GameContext';
import Button from './ui/Button';
import Input from './ui/Input';
import Select from './ui/Select';
import Modal from './ui/Modal';
import type { GameMode, RoomConfig } from '../types';

type ModalKind = null | 'create' | 'join';

export default function Home({ onPlayLocal }: { onPlayLocal: () => void }) {
  const { createRoom, joinRoom } = useGame();
  const [modal, setModal] = useState<ModalKind>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // criação
  const [hostName, setHostName] = useState('');
  const [teamName, setTeamName] = useState('');
  const [mode, setMode] = useState<GameMode>('futsal');
  const [budget, setBudget] = useState(20);
  const [bidTimer, setBidTimer] = useState(30);
  const [formation, setFormation] = useState<RoomConfig['formation']>('4-3-3');
  const [tournamentFormat, setTournamentFormat] = useState<'league' | 'knockout' | 'worldcup'>('league');
  const [auctionStyle, setAuctionStyle] = useState<'sealed' | 'open'>('sealed');
  const [playerPool, setPlayerPool] = useState<'mixed' | 'current' | 'legends'>('mixed');
  const [jokersEnabled, setJokersEnabled] = useState(false);
  const [vetoEnabled, setVetoEnabled] = useState(false);

  // entrada
  const [roomCode, setRoomCode] = useState('');
  const [joinName, setJoinName] = useState('');
  const [joinTeamName, setJoinTeamName] = useState('');
  const [spectator, setSpectator] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!hostName.trim() || !teamName.trim()) return;
    setLoading(true);
    setError(null);
    const res = await createRoom({
      hostName: hostName.trim(),
      teamName: teamName.trim(),
      mode,
      config: { mode, budget, bidTimer: bidTimer as 15 | 30 | 45 | 60, formation, tournamentFormat, auctionStyle, playerPool, jokersEnabled, vetoEnabled },
    });
    setLoading(false);
    if (!res.ok) setError(res.error ?? 'Erro ao criar sala');
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!roomCode.trim() || !joinName.trim() || !joinTeamName.trim()) return;
    setLoading(true);
    setError(null);
    const res = await joinRoom({ roomCode: roomCode.trim(), playerName: joinName.trim(), teamName: joinTeamName.trim(), spectator });
    setLoading(false);
    if (!res.ok) setError(res.error ?? 'Erro ao entrar na sala');
  }

  const budgetOptions = mode === 'futsal' ? [10, 15, 20, 30, 50] : [30, 40, 50, 75, 100];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10 gap-10 field-lines">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
        <div className="text-6xl mb-2">⚽💰</div>
        <h1 className="text-5xl sm:text-6xl font-extrabold text-gold drop-shadow-[0_2px_8px_rgba(255,215,0,0.4)]">FutLeilão</h1>
        <p className="text-white/70 mt-2 text-base sm:text-lg">Monte seu time no lance e vire campeão com os amigos</p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="flex flex-col gap-4 w-full max-w-xs">
        <Button onClick={() => setModal('create')} className="text-lg py-4">
          🏆 Criar Sala
        </Button>
        <Button variant="secondary" onClick={() => setModal('join')} className="text-lg py-4">
          🚪 Entrar na Sala
        </Button>
        <Button variant="ghost" onClick={onPlayLocal} className="text-lg py-4">
          📱 Jogar no mesmo aparelho
        </Button>
      </motion.div>

      <Modal open={modal === 'create'} onClose={() => setModal(null)}>
        <h2 className="text-2xl font-bold text-gold mb-4">Criar Sala</h2>
        <form onSubmit={handleCreate} className="flex flex-col gap-3 max-h-[70vh] overflow-y-auto pr-1">
          <Input label="Seu nome" value={hostName} onChange={(e) => setHostName(e.target.value)} placeholder="Ex: Júlio" required />
          <Input label="Nome do seu time" value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="Ex: Galácticos do Júlio" required />
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
          <Select
            label="Budget inicial"
            value={budget}
            onChange={(e) => setBudget(Number(e.target.value))}
            options={budgetOptions.map((v) => ({ value: v, label: `R$ ${v}` }))}
          />
          <Select
            label="Tempo por lance"
            value={bidTimer}
            onChange={(e) => setBidTimer(Number(e.target.value))}
            options={[15, 30, 45, 60].map((v) => ({ value: v, label: `${v}s` }))}
          />
          <Select
            label="Estilo do leilão"
            value={auctionStyle}
            onChange={(e) => setAuctionStyle(e.target.value as 'sealed' | 'open')}
            options={[
              { value: 'sealed', label: 'Lance fechado (secreto)' },
              { value: 'open', label: 'Lance aberto (quem dá mais)' },
            ]}
          />
          <Select
            label="Formato do torneio"
            value={tournamentFormat}
            onChange={(e) => setTournamentFormat(e.target.value as any)}
            options={[
              { value: 'league', label: 'Pontos corridos' },
              { value: 'knockout', label: 'Mata-mata (4 ou 8 times)' },
              { value: 'worldcup', label: 'Copa do Mundo (16 times)' },
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
          <div className="flex flex-col gap-2 text-sm text-white/80 mt-1">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={jokersEnabled} onChange={(e) => setJokersEnabled(e.target.checked)} />
              🃏 Ativar jogadores coringa
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={vetoEnabled} onChange={(e) => setVetoEnabled(e.target.checked)} />
              🚫 Ativar poder de veto (1 por jogador)
            </label>
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <Button type="submit" disabled={loading} className="mt-2">
            {loading ? 'Criando...' : 'Criar sala'}
          </Button>
        </form>
      </Modal>

      <Modal open={modal === 'join'} onClose={() => setModal(null)}>
        <h2 className="text-2xl font-bold text-gold mb-4">Entrar na Sala</h2>
        <form onSubmit={handleJoin} className="flex flex-col gap-3">
          <Input
            label="Código da sala"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            placeholder="FUT-A3K9"
            required
          />
          <Input label="Seu nome" value={joinName} onChange={(e) => setJoinName(e.target.value)} required />
          {!spectator && (
            <Input label="Nome do seu time" value={joinTeamName} onChange={(e) => setJoinTeamName(e.target.value)} required={!spectator} />
          )}
          <label className="flex items-center gap-2 text-sm text-white/80">
            <input type="checkbox" checked={spectator} onChange={(e) => setSpectator(e.target.checked)} />
            👀 Entrar apenas como espectador
          </label>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <Button type="submit" disabled={loading} className="mt-2">
            {loading ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
