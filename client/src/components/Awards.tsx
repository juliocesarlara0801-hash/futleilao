import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { motion } from 'framer-motion';
import Standings from './Standings';
import Button from './ui/Button';
import type { Award, AwardType, TournamentStanding } from '../types';

const AWARD_META: Record<AwardType, { icon: string; label: string }> = {
  champion: { icon: '🏆', label: 'Campeão' },
  runnerUp: { icon: '🥈', label: 'Vice-campeão' },
  third: { icon: '🥉', label: 'Terceiro lugar' },
  goldenBoot: { icon: '⚽', label: 'Chuteira de Ouro' },
  assistKing: { icon: '🎯', label: 'Rei das Assistências' },
  goldenGlove: { icon: '🧤', label: 'Luva de Ouro' },
  goldenBall: { icon: '⭐', label: 'Bola de Ouro' },
  bestGoal: { icon: '💎', label: 'Melhor Gol do Torneio' },
};

function fireConfetti() {
  const duration = 3000;
  const end = Date.now() + duration;
  (function frame() {
    confetti({ particleCount: 4, angle: 60, spread: 60, origin: { x: 0 }, colors: ['#FFD700', '#1B5E20', '#FFFFFF'] });
    confetti({ particleCount: 4, angle: 120, spread: 60, origin: { x: 1 }, colors: ['#FFD700', '#1B5E20', '#FFFFFF'] });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}

interface AwardsProps {
  awards: Award[];
  standings: TournamentStanding[];
  onBackToLobby?: () => void;
  backToLobbyLabel?: string;
}

export default function Awards({ awards, standings, onBackToLobby, backToLobbyLabel = '🏠 Voltar ao Lobby' }: AwardsProps) {
  useEffect(() => {
    fireConfetti();
  }, []);

  const champion = awards.find((a) => a.type === 'champion');

  return (
    <div className="min-h-screen p-4 sm:p-6 max-w-5xl mx-auto flex flex-col gap-8 items-center">
      <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="text-center mt-6">
        <div className="text-7xl mb-2">🏆</div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-gold">Fim de Torneio!</h1>
        {champion && <p className="text-2xl mt-2 font-bold">{champion.teamName} é o campeão!</p>}
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
        {awards.map((a, i) => (
          <AwardCard key={a.type} award={a} delay={i * 0.08} />
        ))}
      </div>

      <div className="w-full">
        <Standings standings={standings} title="📊 Classificação Final" />
      </div>

      {onBackToLobby && (
        <Button onClick={onBackToLobby} className="text-lg px-8">
          {backToLobbyLabel}
        </Button>
      )}
    </div>
  );
}

function AwardCard({ award, delay }: { award: Award; delay: number }) {
  const meta = AWARD_META[award.type];
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="bg-gradient-to-br from-white/10 to-transparent border border-gold/30 rounded-2xl p-4 text-center flex flex-col items-center gap-1"
    >
      <span className="text-4xl">{meta.icon}</span>
      <p className="text-gold font-bold text-sm">{meta.label}</p>
      <p className="font-semibold">{award.winner}</p>
      <p className="text-white/50 text-xs truncate">{award.teamName}</p>
      {award.description && <p className="text-white/40 text-xs italic mt-1">{award.description}</p>}
    </motion.div>
  );
}
