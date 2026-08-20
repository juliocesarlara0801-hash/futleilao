import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLocalGame } from '../../context/LocalGameContext';
import PlayerCard from '../PlayerCard';
import Button from '../ui/Button';
import LocalPassDevice from './LocalPassDevice';
import SquadViewer from '../SquadViewer';
import { formatMoney } from '../../utils/helpers';

export default function LocalAuction() {
  const { state, submitBid, openRaise, openPass, openHammer, continueAfterResult, maxBidFor, canTeamBid } = useLocalGame();
  const { currentPlayer, lastResult, teams, turnOrder, turnPointer, config } = state;

  const [gateOpen, setGateOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [raiseAmount, setRaiseAmount] = useState('');
  const [justPassed, setJustPassed] = useState(false);

  useEffect(() => {
    setGateOpen(false);
    setAmount('');
    setError(null);
    setJustPassed(false);
  }, [currentPlayer?.id, turnPointer]);

  useEffect(() => {
    if (state.openHighest) setRaiseAmount(String(state.openHighest.amount + 1));
    else setRaiseAmount('1');
  }, [state.openHighest, currentPlayer?.id]);

  const showingResult = !currentPlayer && !!lastResult;

  if (!currentPlayer && !showingResult) return null;

  const currentTeam = teams.find((t) => t.id === turnOrder[turnPointer]) ?? null;

  function handleSealedBid() {
    if (!currentTeam || !currentPlayer) return;
    const value = Number(amount);
    const max = maxBidFor(currentTeam);
    if (!Number.isInteger(value) || value < 1) {
      setError('Digite um valor inteiro de no mínimo R$ 1.');
      return;
    }
    if (value > max) {
      setError(`Máximo permitido: R$ ${max} (reserva de saldo para as vagas restantes).`);
      return;
    }
    submitBid(currentTeam.id, value);
  }

  function handlePass() {
    if (!currentTeam) return;
    setJustPassed(true);
    setTimeout(() => submitBid(currentTeam.id, null), 700);
  }

  function handleOpenPass(teamId: string) {
    openPass(teamId);
  }

  function handleOpenRaise(teamId: string) {
    const value = Number(raiseAmount);
    const team = teams.find((t) => t.id === teamId)!;
    const max = maxBidFor(team);
    const minAllowed = (state.openHighest?.amount ?? 0) + 1;
    if (!Number.isInteger(value) || value < Math.max(1, minAllowed) || value > max) return;
    openRaise(teamId, value);
  }

  return (
    <div className="min-h-screen flex flex-col items-center gap-5 p-4 sm:p-6">
      <div className="text-sm text-white/50">
        Jogador {state.auctionIndex} / {state.poolTotal}
      </div>

      <AnimatePresence mode="wait">
        {currentPlayer && (
          <motion.div key={currentPlayer.id} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
            <PlayerCard player={currentPlayer} size="lg" animate />
          </motion.div>
        )}
      </AnimatePresence>

      {showingResult && lastResult && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center bg-white/5 border border-gold/40 rounded-2xl px-6 py-4 max-w-sm">
          {lastResult.winnerTeamName ? (
            <p className="text-lg">
              💰 <span className="font-bold text-gold">{lastResult.winnerTeamName}</span> levou <span className="font-bold">{lastResult.player.name}</span> por{' '}
              {formatMoney(lastResult.amount)}!
            </p>
          ) : (
            <p className="text-lg text-white/60">📉 Ninguém deu lance em {lastResult.player.name}. Descartado.</p>
          )}
          <Button onClick={continueAfterResult} className="mt-4 w-full">
            Continuar
          </Button>
        </motion.div>
      )}

      {/* ---- MODO FECHADO: passa o aparelho ---- */}
      {config.auctionStyle === 'sealed' && currentPlayer && currentTeam && !gateOpen && (
        <LocalPassDevice
          teamName={currentTeam.teamName}
          ownerName={currentTeam.ownerName}
          subtitle={`É a sua vez de dar lance em ${currentPlayer.name}`}
          onReady={() => setGateOpen(true)}
        />
      )}

      {config.auctionStyle === 'sealed' && currentPlayer && currentTeam && gateOpen && justPassed && (
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-1 w-full max-w-xs text-center">
          <p className="text-2xl">✋</p>
          <p className="text-white/80">{currentTeam.teamName} passou nesse jogador.</p>
        </motion.div>
      )}

      {config.auctionStyle === 'sealed' && currentPlayer && currentTeam && gateOpen && !justPassed && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center gap-2 w-full max-w-xs">
          <p className="text-white/70 text-sm">
            {currentTeam.teamName} — saldo R$ {currentTeam.budget}
          </p>
          <div className="flex gap-2 w-full">
            <input
              type="number"
              min={1}
              max={maxBidFor(currentTeam)}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`Máx: R$ ${maxBidFor(currentTeam)}`}
              className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/20 text-white text-lg text-center focus:outline-none focus:ring-2 focus:ring-gold"
              autoFocus
            />
            <Button onClick={handleSealedBid}>Dar Lance</Button>
          </div>
          <Button variant="ghost" onClick={handlePass} className="w-full text-sm">
            Passar (não quero)
          </Button>
          {error && <p className="text-red-400 text-sm">{error}</p>}
        </motion.div>
      )}

      {/* ---- MODO ABERTO: tela pública ---- */}
      {config.auctionStyle === 'open' && currentPlayer && (
        <div className="flex flex-col items-center gap-4 w-full max-w-md">
          <p className="text-white/80">
            {state.openHighest ? (
              <>
                Maior lance: <span className="font-bold text-gold">{formatMoney(state.openHighest.amount)}</span> por{' '}
                {teams.find((t) => t.id === state.openHighest!.teamId)?.teamName}
              </>
            ) : (
              'Nenhum lance ainda.'
            )}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
            {teams
              .filter((t) => canTeamBid(t))
              .map((t) => {
                const isLeading = state.openHighest?.teamId === t.id;
                const hasPassed = state.openPassed.includes(t.id);
                return (
                  <div key={t.id} className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
                    <span className="flex-1 truncate text-sm">{t.teamName}</span>
                    {isLeading ? (
                      <span className="text-green-400 text-xs font-bold">🥇 na frente</span>
                    ) : hasPassed ? (
                      <span className="text-white/40 text-xs">✋ passou</span>
                    ) : (
                      <>
                        <input
                          type="number"
                          min={(state.openHighest?.amount ?? 0) + 1}
                          max={maxBidFor(t)}
                          defaultValue={(state.openHighest?.amount ?? 0) + 1}
                          onChange={(e) => setRaiseAmount(e.target.value)}
                          className="w-16 px-2 py-1 rounded bg-white/10 text-center text-sm"
                        />
                        <button
                          onClick={() => handleOpenRaise(t.id)}
                          className="px-3 py-1 rounded-lg bg-gold text-pitch-darker font-bold text-sm"
                        >
                          Cobrir
                        </button>
                        <button
                          onClick={() => handleOpenPass(t.id)}
                          className="px-2 py-1 rounded-lg bg-white/10 text-white/70 text-xs"
                        >
                          Não cobrir
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
          </div>
          <Button variant="danger" onClick={openHammer} className="w-full">
            🔨 Arrematar
          </Button>

          <SquadViewer teams={teams} />
        </div>
      )}

      <TeamsBudgetStrip teams={teams} />
    </div>
  );
}

function TeamsBudgetStrip({ teams }: { teams: { id: string; teamName: string; budget: number }[] }) {
  return (
    <div className="w-full max-w-2xl grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
      {teams.map((t) => (
        <div
          key={t.id}
          className={`px-3 py-2 rounded-xl border text-sm flex items-center justify-between ${
            t.budget < 3 ? 'border-red-500/50 bg-red-950/30' : 'border-white/10 bg-white/5'
          }`}
        >
          <span className="truncate">{t.teamName}</span>
          <span className={`font-bold ${t.budget < 3 ? 'text-red-400' : 'text-gold'}`}>R$ {t.budget}</span>
        </div>
      ))}
    </div>
  );
}
