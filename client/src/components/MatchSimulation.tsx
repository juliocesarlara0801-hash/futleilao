import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import Standings from './Standings';
import type { MatchEvent, MatchResult, TournamentStanding } from '../types';

const EVENT_ICON: Record<MatchEvent['type'], string> = {
  goal: '⚽',
  nearMiss: '💨',
  save: '🥅',
  yellowCard: '🟨',
  redCard: '🟥',
  foul: '🚫',
  penalty: '🎯',
};

function ScorePill({ match }: { match: MatchResult }) {
  const hg = match.homeGoals + (match.extraTime?.homeGoals ?? 0);
  const ag = match.awayGoals + (match.extraTime?.awayGoals ?? 0);
  return (
    <span className="font-bold text-gold text-lg">
      {hg} x {ag}
    </span>
  );
}

function QuickResult({ match }: { match: MatchResult }) {
  const allEvents = [...match.events, ...(match.extraTime?.events ?? [])];
  const goals = allEvents.filter((e) => e.type === 'goal');
  const nearMisses = allEvents.filter((e) => e.type === 'nearMiss');
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-xl font-bold">
        <span className="truncate max-w-[40%]">{match.homeTeamName}</span>
        <ScorePill match={match} />
        <span className="truncate max-w-[40%] text-right">{match.awayTeamName}</span>
      </div>
      {match.penalties && (
        <p className="text-center text-sm text-white/60">
          Pênaltis: {match.penalties.home.filter(Boolean).length} x {match.penalties.away.filter(Boolean).length}
        </p>
      )}
      <div className="flex flex-col gap-1">
        {goals.map((g, i) => (
          <p key={i} className="text-sm text-white/80">
            ⚽ {g.minute}' — <span className="font-semibold">{g.player}</span> ({g.team === 'home' ? match.homeTeamName : match.awayTeamName})
            {g.assist && <span className="text-white/50"> · assist: {g.assist}</span>}
          </p>
        ))}
        {goals.length === 0 && <p className="text-white/40 text-sm">Nenhum gol na partida.</p>}
      </div>
      {nearMisses.length > 0 && <p className="text-sm text-white/50">💨 {nearMisses.length} lances perigosos na partida</p>}
      {match.manOfTheMatch && (
        <p className="text-sm text-gold">
          🌟 Craque da partida: <span className="font-semibold">{match.manOfTheMatch}</span>
        </p>
      )}
      <p className="text-white/60 text-sm italic">{match.narration}</p>
    </div>
  );
}

function FullNarration({ match }: { match: MatchResult }) {
  const allEvents = useMemo(() => [...match.events, ...(match.extraTime?.events ?? [])].sort((a, b) => a.minute - b.minute), [match]);
  const [visibleCount, setVisibleCount] = useState(1);

  useEffect(() => {
    setVisibleCount(1);
    if (allEvents.length <= 1) return;
    const interval = setInterval(() => {
      setVisibleCount((c) => {
        if (c >= allEvents.length) {
          clearInterval(interval);
          return c;
        }
        return c + 1;
      });
    }, 550);
    return () => clearInterval(interval);
  }, [match.id, allEvents.length]);

  return (
    <div className="flex flex-col gap-2 max-h-[50vh] overflow-y-auto pr-1">
      {allEvents.slice(0, visibleCount).map((e, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className={`flex gap-3 items-start px-3 py-2 rounded-lg ${e.type === 'goal' ? 'bg-gold/10 border border-gold/30' : 'bg-white/5'}`}
        >
          <span className="text-white/50 font-mono text-sm w-8 shrink-0">{e.minute}'</span>
          <span className="text-lg">{EVENT_ICON[e.type]}</span>
          <div className="text-sm">
            <p>
              <span className="font-semibold">{e.player}</span> {e.assist && <span className="text-white/50">(assist: {e.assist})</span>}
            </p>
            <p className="text-white/60">{e.description}</p>
          </div>
        </motion.div>
      ))}
      {visibleCount >= allEvents.length && match.manOfTheMatch && (
        <p className="text-sm text-gold mt-2">
          🌟 Craque da partida: <span className="font-semibold">{match.manOfTheMatch}</span>
        </p>
      )}
    </div>
  );
}

interface MatchSimulationProps {
  matches: MatchResult[];
  standings: TournamentStanding[];
}

export default function MatchSimulation({ matches, standings }: MatchSimulationProps) {
  const [mode, setMode] = useState<'quick' | 'full'>('full');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = matches.find((m) => m.id === selectedId) ?? matches[matches.length - 1] ?? null;

  useEffect(() => {
    if (matches.length > 0) setSelectedId(matches[matches.length - 1].id);
  }, [matches.length]);

  return (
    <div className="min-h-screen p-4 sm:p-6 max-w-6xl mx-auto flex flex-col gap-6">
      <h1 className="text-3xl font-extrabold text-gold text-center">⚽ Simulando o Torneio</h1>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        <div className="flex flex-col gap-2 max-h-[70vh] overflow-y-auto">
          {matches
            .slice()
            .reverse()
            .map((m) => (
              <button
                key={m.id}
                onClick={() => setSelectedId(m.id)}
                className={`text-left px-3 py-2 rounded-xl border text-sm transition ${
                  selected?.id === m.id ? 'border-gold bg-gold/10' : 'border-white/10 bg-white/5 hover:bg-white/10'
                }`}
              >
                <p className="text-white/50 text-xs">{m.round}</p>
                <p className="font-semibold truncate">
                  {m.homeTeamName} <ScorePill match={m} /> {m.awayTeamName}
                </p>
              </button>
            ))}
          {matches.length === 0 && <p className="text-white/40 text-sm px-2">Aguardando primeira partida...</p>}
        </div>

        <div className="flex flex-col gap-4">
          {selected && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <div className="flex justify-between items-center mb-4">
                <p className="text-white/50 text-sm">{selected.round}</p>
                <div className="flex gap-1 bg-white/5 rounded-full p-1">
                  <button
                    onClick={() => setMode('full')}
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${mode === 'full' ? 'bg-gold text-pitch-darker' : 'text-white/60'}`}
                  >
                    Narração
                  </button>
                  <button
                    onClick={() => setMode('quick')}
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${mode === 'quick' ? 'bg-gold text-pitch-darker' : 'text-white/60'}`}
                  >
                    Resultado Rápido
                  </button>
                </div>
              </div>
              {mode === 'full' ? <FullNarration key={selected.id} match={selected} /> : <QuickResult match={selected} />}
            </div>
          )}

          <Standings standings={standings} title="📊 Classificação (ao vivo)" />
        </div>
      </div>
    </div>
  );
}
