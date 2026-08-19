import React, { useEffect, useState } from 'react';
import Select from './ui/Select';
import type { Player, Position } from '../types';

const ROWS: Position[] = ['atacante', 'meia', 'defensor', 'goleiro'];
const POS_LABEL: Record<Position, string> = {
  atacante: 'Atacantes',
  meia: 'Meias',
  defensor: 'Defensores',
  goleiro: 'Goleiro',
};

interface SquadTeam {
  id: string;
  teamName: string;
  ownerName: string;
  players: Player[];
}

interface SquadViewerProps {
  teams: SquadTeam[];
  myTeamId?: string | null;
}

/** Painel de escalação com seletor de time — evita lotar a tela mostrando um time por vez. */
export default function SquadViewer({ teams, myTeamId }: SquadViewerProps) {
  const [selectedId, setSelectedId] = useState<string>(myTeamId ?? teams[0]?.id ?? '');

  useEffect(() => {
    if (myTeamId) setSelectedId(myTeamId);
  }, [myTeamId]);

  if (teams.length === 0) return null;
  const team = teams.find((t) => t.id === selectedId) ?? teams[0];

  return (
    <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-3 flex flex-col gap-3">
      <Select
        label="⚽ Ver escalação"
        value={team.id}
        onChange={(e) => setSelectedId(e.target.value)}
        options={teams.map((t) => ({
          value: t.id,
          label: t.id === myTeamId ? `${t.teamName} (você)` : t.teamName,
        }))}
      />
      <div className="flex flex-col gap-2 max-h-[45vh] overflow-y-auto pr-1">
        {ROWS.map((pos) => {
          const players = team.players.filter((p) => p.position === pos);
          if (players.length === 0) return null;
          return (
            <div key={pos}>
              <p className="text-white/40 text-[11px] uppercase tracking-wide mb-1">{POS_LABEL[pos]}</p>
              <div className="flex flex-wrap gap-1.5">
                {players.map((p) => (
                  <div key={p.id} className="bg-pitch-darker/80 border border-gold/30 rounded-lg px-2 py-1 text-center min-w-[64px]">
                    <div className="text-gold font-bold text-xs">{p.rating}</div>
                    <div className="text-[10px] leading-tight truncate max-w-[64px]">{p.name}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {team.players.length === 0 && <p className="text-white/40 text-sm text-center py-4">Nenhum jogador ainda.</p>}
      </div>
    </div>
  );
}
