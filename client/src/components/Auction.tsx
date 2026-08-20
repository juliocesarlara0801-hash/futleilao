import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGame } from '../context/GameContext';
import PlayerCard from './PlayerCard';
import Timer from './Timer';
import Button from './ui/Button';
import ChatPanel from './ChatPanel';
import SquadViewer from './SquadViewer';
import { canBidOnPosition, formatMoney, maxAllowedBid } from '../utils/helpers';
import type { PublicTeam } from '../types/client';

export default function Auction() {
  const { state, placeBid, passBid, myTeam } = useGame();
  const room = state.room;
  const [amount, setAmount] = useState('');
  const [bidError, setBidError] = useState<string | null>(null);
  const [myBidSubmitted, setMyBidSubmitted] = useState(false);
  const [myPassed, setMyPassed] = useState(false);

  useEffect(() => {
    setAmount('');
    setBidError(null);
    setMyBidSubmitted(false);
    setMyPassed(false);
  }, [state.currentAuctionPlayer?.player.id]);

  if (!room) return null;
  const player = state.currentAuctionPlayer?.player ?? state.lastBidResult?.player ?? null;
  const showingResult = !state.currentAuctionPlayer && !!state.lastBidResult;

  const config = room.config;
  const teams = room.teams.filter((t) => !t.isSpectator);
  const myCanBid = myTeam && player && canBidOnPosition(myTeam, config, player.position);
  const myMax = myTeam ? maxAllowedBid(myTeam, config) : 0;
  const isHighestBidder = config.auctionStyle === 'open' && !!myTeam && state.openBid?.teamId === myTeam.id;

  async function handleBid() {
    const value = Number(amount);
    if (!Number.isInteger(value) || value < 1) {
      setBidError('Digite um valor inteiro de no mínimo R$ 1.');
      return;
    }
    if (value > myMax) {
      setBidError(`Máximo permitido: R$ ${myMax} (reserva de saldo para as vagas restantes).`);
      return;
    }
    const res = await placeBid(value);
    if (!res.ok) setBidError(res.error ?? 'Lance inválido');
    else setMyBidSubmitted(true);
  }

  async function handlePass() {
    const res = await passBid();
    if (res.ok) setMyPassed(true);
    else if (res.error) setBidError(res.error);
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row gap-4 p-3 sm:p-6 max-w-7xl mx-auto">
      <div className="flex-1 flex flex-col items-center gap-4">
        <div className="flex items-center justify-between w-full max-w-md text-sm text-white/60">
          <span>
            Jogador {state.currentAuctionPlayer?.index ?? '-'} / {state.currentAuctionPlayer?.total ?? '-'}
          </span>
          <span>{config.auctionStyle === 'open' ? '🔓 Lance aberto' : '🔒 Lance fechado'}</span>
        </div>

        <div className="flex flex-col items-center gap-3">
          <AnimatePresence mode="wait">
            {player && (
              <motion.div key={player.id} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
                <PlayerCard player={player} size="lg" animate />
              </motion.div>
            )}
          </AnimatePresence>

          {!showingResult && state.currentAuctionPlayer && <Timer secondsLeft={state.secondsLeft} total={config.auctionStyle === 'open' ? 10 : config.bidTimer} />}
        </div>

        {showingResult && state.lastBidResult && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center bg-white/5 border border-gold/40 rounded-2xl px-6 py-4 max-w-sm">
            {state.lastBidResult.winnerTeamName ? (
              <p className="text-lg">
                💰 <span className="font-bold text-gold">{state.lastBidResult.winnerTeamName}</span> levou{' '}
                <span className="font-bold">{state.lastBidResult.player.name}</span> por {formatMoney(state.lastBidResult.amount)}!
              </p>
            ) : (
              <p className="text-lg text-white/60">📉 Ninguém deu lance em {state.lastBidResult.player.name}. Descartado.</p>
            )}
          </motion.div>
        )}

        {config.auctionStyle === 'open' && state.currentAuctionPlayer && (
          <div className="text-center">
            {state.openBid ? (
              <p className="text-white/80">
                Maior lance: <span className="font-bold text-gold">{formatMoney(state.openBid.amount)}</span> por {state.openBid.teamName}
              </p>
            ) : (
              <p className="text-white/50">Nenhum lance ainda. Lance inicial: R$ 1</p>
            )}
            {state.openPassedTeamIds.length > 0 && (
              <p className="text-white/40 text-xs mt-1">
                ✋ Passaram: {state.openPassedTeamIds.map((id) => teams.find((t) => t.id === id)?.teamName ?? '?').join(', ')}
              </p>
            )}
          </div>
        )}

        {!showingResult && state.currentAuctionPlayer && myTeam && !myTeam.isSpectator && (
          <div className="flex flex-col items-center gap-2 w-full max-w-xs">
            {!myCanBid ? (
              <p className="text-white/50 text-sm text-center">
                {myTeam.budget <= 0 ? 'Sem saldo disponível.' : 'Posição completa — você não pode dar lance.'}
              </p>
            ) : myPassed ? (
              <p className="text-white/60 text-sm text-center">✋ Você passou nesse jogador.</p>
            ) : isHighestBidder ? (
              <p className="text-green-400 text-sm text-center">🥇 Você está na frente do lance!</p>
            ) : (
              <>
                <div className="flex gap-2 w-full">
                  <input
                    type="number"
                    min={1}
                    max={myMax}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder={`Máx: R$ ${myMax}`}
                    disabled={myBidSubmitted && config.auctionStyle === 'sealed'}
                    className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/20 text-white text-lg text-center focus:outline-none focus:ring-2 focus:ring-gold disabled:opacity-40"
                  />
                  <Button onClick={handleBid} disabled={myBidSubmitted && config.auctionStyle === 'sealed'}>
                    {config.auctionStyle === 'open' ? 'Cobrir' : 'Dar Lance'}
                  </Button>
                </div>
                {!(myBidSubmitted && config.auctionStyle === 'sealed') && (
                  <Button variant="ghost" onClick={handlePass} className="w-full text-sm">
                    {config.auctionStyle === 'open' ? 'Não cobrir (passar)' : 'Passar (não quero)'}
                  </Button>
                )}
                {bidError && <p className="text-red-400 text-sm">{bidError}</p>}
                {myBidSubmitted && config.auctionStyle === 'sealed' && <p className="text-green-400 text-sm">Lance registrado ✅ (secreto até o fim do timer)</p>}
              </>
            )}
          </div>
        )}

        <TeamsBudgetBar teams={teams} currentPosition={player?.position} config={config} />
      </div>

      <div className="w-full lg:w-72 flex flex-col gap-4">
        {config.auctionStyle === 'open' && <SquadViewer teams={teams} myTeamId={myTeam?.id ?? null} />}
        <ChatPanel />
      </div>
    </div>
  );
}

function TeamsBudgetBar({
  teams,
  currentPosition,
  config,
}: {
  teams: PublicTeam[];
  currentPosition?: string;
  config: any;
}) {
  return (
    <div className="w-full grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
      {teams.map((t) => {
        const low = t.budget < 3;
        const complete = currentPosition ? !canBidOnPosition(t, config, currentPosition as any) : false;
        return (
          <div
            key={t.id}
            className={`px-3 py-2 rounded-xl border text-sm flex items-center justify-between ${
              low ? 'border-red-500/50 bg-red-950/30' : 'border-white/10 bg-white/5'
            } ${complete ? 'opacity-50' : ''}`}
          >
            <span className="truncate">{t.teamName}</span>
            <span className={`font-bold ${low ? 'text-red-400' : 'text-gold'}`}>R$ {t.budget}</span>
          </div>
        );
      })}
    </div>
  );
}
