// Tipos client-only (não fazem parte do shared/types.ts, então não são sobrescritos pelo sync).
import type {
  Award,
  BracketRound,
  GamePhase,
  MatchResult,
  RoomConfig,
  Team,
  TournamentStanding,
} from './index';

export type PublicTeam = Omit<Team, 'socketId'>;

export interface RoomSnapshot {
  code: string;
  hostTeamId: string;
  config: RoomConfig;
  teams: PublicTeam[];
  phase: GamePhase;
  standings: TournamentStanding[];
  awards: Award[];
  matches: MatchResult[];
  bracket: BracketRound[];
}

export interface Toast {
  id: string;
  message: string;
  kind: 'info' | 'success' | 'warning';
}
