import React from 'react';
import type { TournamentStanding } from '../types';

export default function Standings({ standings, title = '📊 Classificação' }: { standings: TournamentStanding[]; title?: string }) {
  if (standings.length === 0) return null;
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-white/10 font-bold text-gold">{title}</div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs sm:text-sm">
          <thead>
            <tr className="text-white/50 text-left">
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Time</th>
              <th className="px-2 py-2 text-center">P</th>
              <th className="px-2 py-2 text-center">V</th>
              <th className="px-2 py-2 text-center">E</th>
              <th className="px-2 py-2 text-center">D</th>
              <th className="px-2 py-2 text-center">GP</th>
              <th className="px-2 py-2 text-center">GC</th>
              <th className="px-2 py-2 text-center">SG</th>
              <th className="px-2 py-2 text-center font-bold">Pts</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s, i) => (
              <tr key={s.teamId} className={`border-t border-white/5 ${i === 0 ? 'bg-gold/10' : ''}`}>
                <td className="px-3 py-2">{i + 1}</td>
                <td className="px-3 py-2 font-semibold truncate max-w-[120px]">{s.teamName}</td>
                <td className="px-2 py-2 text-center">{s.played}</td>
                <td className="px-2 py-2 text-center">{s.won}</td>
                <td className="px-2 py-2 text-center">{s.drawn}</td>
                <td className="px-2 py-2 text-center">{s.lost}</td>
                <td className="px-2 py-2 text-center">{s.goalsFor}</td>
                <td className="px-2 py-2 text-center">{s.goalsAgainst}</td>
                <td className="px-2 py-2 text-center">{s.goalDifference}</td>
                <td className="px-2 py-2 text-center font-bold text-gold">{s.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
