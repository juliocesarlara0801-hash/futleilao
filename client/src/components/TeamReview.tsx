import React from 'react';
import { motion } from 'framer-motion';
import Button from './ui/Button';
import { averageRating } from '../utils/helpers';
import type { PublicTeam } from '../types/client';
import type { Position } from '../types';

const ROWS: Position[] = ['atacante', 'meia', 'defensor', 'goleiro'];

function TeamField({ team }: { team: PublicTeam }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-white/10">
        <p className="font-bold text-gold truncate">{team.teamName}</p>
        <p className="text-xs text-white/50">{team.ownerName}</p>
      </div>
      <div className="field-lines p-3 flex flex-col gap-3">
        {ROWS.map((pos) => {
          const players = team.players.filter((p) => p.position === pos);
          if (players.length === 0) return null;
          return (
            <div key={pos} className="flex flex-wrap justify-center gap-2">
              {players.map((p) => (
                <div key={p.id} className="bg-pitch-darker/80 border border-gold/40 rounded-lg px-2 py-1 text-center min-w-[70px]">
                  <div className="text-gold font-bold text-sm">{p.rating}</div>
                  <div className="text-[10px] leading-tight truncate max-w-[70px]">{p.name}</div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
      <div className="px-4 py-3 border-t border-white/10 grid grid-cols-3 gap-2 text-center text-xs">
        <div>
          <p className="text-white/50">Média</p>
          <p className="font-bold text-gold">{averageRating(team)}</p>
        </div>
        <div>
          <p className="text-white/50">Gasto</p>
          <p className="font-bold">R$ {team.spent}</p>
        </div>
        <div>
          <p className="text-white/50">Saldo livre</p>
          <p className="font-bold text-green-400">R$ {team.budget}</p>
        </div>
      </div>
    </div>
  );
}

interface TeamReviewProps {
  teams: PublicTeam[];
  canStart: boolean;
  onStartTournament: () => void;
  startLabel?: string;
}

export default function TeamReview({ teams, canStart, onStartTournament, startLabel = '🏁 Iniciar Torneio' }: TeamReviewProps) {
  return (
    <div className="min-h-screen p-4 sm:p-6 max-w-6xl mx-auto flex flex-col gap-6">
      <motion.h1 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-3xl font-extrabold text-gold text-center">
        📋 Times Montados
      </motion.h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {teams.map((t) => (
          <TeamField key={t.id} team={t} />
        ))}
      </div>

      {canStart && (
        <div className="flex justify-center">
          <Button onClick={onStartTournament} className="text-lg px-8">
            {startLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
