import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useGame } from '../context/GameContext';
import Button from './ui/Button';
import ChatPanel from './ChatPanel';

const MODE_LABEL: Record<string, string> = { futsal: 'Futsal', full: 'Futebol Completo' };
const FORMAT_LABEL: Record<string, string> = { league: 'Pontos corridos', knockout: 'Mata-mata', worldcup: 'Copa do Mundo' };

export default function Lobby() {
  const { state, toggleReady, startAuction, isHost, myTeam } = useGame();
  const [copied, setCopied] = useState(false);
  const room = state.room;
  if (!room) return null;

  const players = room.teams.filter((t) => !t.isSpectator);
  const spectators = room.teams.filter((t) => t.isSpectator);
  const allReady = players.length >= 2 && players.every((t) => t.isReady || t.isHost);
  const canStart = isHost && allReady;

  function copyCode() {
    navigator.clipboard?.writeText(room!.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row gap-6 p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex-1 flex flex-col gap-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <p className="text-white/60 text-sm">Código da sala</p>
          <button onClick={copyCode} className="text-4xl sm:text-5xl font-extrabold text-gold tracking-widest">
            {room.code}
          </button>
          <p className="text-white/40 text-xs mt-1">{copied ? 'Copiado!' : 'Toque para copiar'}</p>
        </motion.div>

        {state.qrCode && (
          <div className="flex justify-center">
            <img src={state.qrCode} alt="QR Code da sala" className="w-40 h-40 rounded-xl bg-white p-2" />
          </div>
        )}

        <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
          <h3 className="text-gold font-bold mb-2">⚙️ Configurações</h3>
          <div className="grid grid-cols-2 gap-2 text-sm text-white/80">
            <span>Modo: {MODE_LABEL[room.config.mode]}</span>
            <span>Formação: {room.config.mode === 'futsal' ? 'Futsal 1-2-1-1' : room.config.formation}</span>
            <span>Budget: R$ {room.config.budget}</span>
            <span>Tempo/lance: {room.config.bidTimer}s</span>
            <span>Torneio: {FORMAT_LABEL[room.config.tournamentFormat]}</span>
            <span>Leilão: {room.config.auctionStyle === 'open' ? 'Aberto' : 'Fechado'}</span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="text-gold font-bold">👥 Times ({players.length}/{room.config.maxPlayers})</h3>
          {players.map((t) => (
            <div key={t.id} className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-3 border border-white/10">
              <div>
                <p className="font-semibold">{t.teamName}</p>
                <p className="text-xs text-white/50">
                  {t.ownerName} {t.isHost && '👑'}
                </p>
              </div>
              <span className={`text-xs font-bold px-3 py-1 rounded-full ${t.isReady || t.isHost ? 'bg-green-500/20 text-green-300' : 'bg-white/10 text-white/50'}`}>
                {t.isHost ? 'Host' : t.isReady ? 'Pronto' : 'Aguardando'}
              </span>
            </div>
          ))}
          {spectators.length > 0 && (
            <>
              <h3 className="text-white/50 font-semibold mt-2 text-sm">👀 Espectadores</h3>
              {spectators.map((t) => (
                <div key={t.id} className="text-sm text-white/50 px-4">
                  {t.ownerName}
                </div>
              ))}
            </>
          )}
        </div>

        <div className="flex gap-3 mt-auto">
          {!isHost && myTeam && (
            <Button variant={myTeam.isReady ? 'secondary' : 'primary'} onClick={toggleReady} className="flex-1">
              {myTeam.isReady ? '✅ Pronto (clique para cancelar)' : 'Marcar como pronto'}
            </Button>
          )}
          {isHost && (
            <Button onClick={startAuction} disabled={!canStart} className="flex-1">
              {allReady ? '🔨 Iniciar Leilão' : `Aguardando jogadores prontos (mín. 2)`}
            </Button>
          )}
        </div>
      </div>

      <div className="w-full lg:w-80">
        <ChatPanel />
      </div>
    </div>
  );
}
