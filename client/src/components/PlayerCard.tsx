import React from 'react';
import { motion } from 'framer-motion';
import type { Player } from '../types';

const POSITION_ABBR: Record<Player['position'], string> = {
  atacante: 'ATA',
  meia: 'MEI',
  defensor: 'DEF',
  goleiro: 'GOL',
};

function rarityStyle(rating: number, isJoker?: boolean) {
  if (isJoker) return 'from-fuchsia-500 via-purple-600 to-indigo-700 border-fuchsia-300';
  if (rating >= 95) return 'from-gold via-yellow-300 to-amber-500 border-gold text-pitch-darker';
  if (rating >= 85) return 'from-yellow-600 via-yellow-500 to-amber-700 border-yellow-300';
  if (rating >= 75) return 'from-slate-300 via-slate-400 to-slate-500 border-slate-200 text-pitch-darker';
  return 'from-orange-800 via-orange-900 to-amber-950 border-orange-600';
}

interface PlayerCardProps {
  player: Player;
  size?: 'sm' | 'md' | 'lg';
  animate?: boolean;
  className?: string;
}

const SIZES = {
  sm: 'w-24 h-32 text-[10px]',
  md: 'w-36 h-48 text-xs',
  lg: 'w-56 h-72 text-sm',
};

export default function PlayerCard({ player, size = 'md', animate = false, className = '' }: PlayerCardProps) {
  const rarity = rarityStyle(player.rating, player.isJoker);

  const content = (
    <div
      className={`relative ${SIZES[size]} rounded-2xl border-2 bg-gradient-to-br ${rarity} shadow-xl flex flex-col items-center px-2 py-3 select-none ${className}`}
    >
      {player.isJoker && (
        <div className="absolute -top-2 -right-2 bg-fuchsia-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow rotate-12">
          CORINGA
        </div>
      )}
      <div className="w-full flex justify-between items-start">
        <div className="font-extrabold leading-none text-lg sm:text-xl">{player.rating}</div>
        <div className="font-bold opacity-80">{POSITION_ABBR[player.position]}</div>
      </div>

      <div className="flex-1 flex items-center justify-center text-3xl sm:text-4xl my-1">
        {player.nationalityFlag}
      </div>

      <div className="w-full text-center">
        <div className="font-bold leading-tight truncate">{player.name}</div>
        <div className="opacity-70 truncate">{player.positionDetail}</div>
      </div>

      <div className="w-full flex justify-between items-center mt-1 opacity-80">
        <span>{player.nationality}</span>
        <span>{player.era === 'legend' ? '⭐ Lenda' : '🔥 Atual'}</span>
      </div>
    </div>
  );

  if (!animate) return content;

  return (
    <motion.div
      initial={{ rotateY: 90, opacity: 0 }}
      animate={{ rotateY: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      style={{ transformStyle: 'preserve-3d' }}
      className="card-3d"
    >
      {content}
    </motion.div>
  );
}
