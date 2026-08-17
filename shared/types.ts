// shared/types.ts
// Shared between client and server. Copied into each workspace's src at build time
// via a small pre-build step (see server/src/db and client/src/types re-exports).

export type Position = 'atacante' | 'meia' | 'defensor' | 'goleiro';
export type Era = 'legend' | 'current';
export type GameMode = 'futsal' | 'full';
export type TournamentFormat = 'league' | 'knockout' | 'worldcup';
export type MatchEventType =
  | 'goal'
  | 'nearMiss'
  | 'save'
  | 'yellowCard'
  | 'redCard'
  | 'foul'
  | 'penalty';

export interface Player {
  id: string;
  name: string;
  nationality: string;
  nationalityFlag: string;
  position: Position;
  positionDetail: string;
  rating: number;
  era: Era;
  imageUrl: string | null;
  isJoker?: boolean;
}

export interface Team {
  id: string;
  socketId: string | null;
  ownerName: string;
  teamName: string;
  players: Player[];
  budget: number;
  spent: number;
  isHost: boolean;
  isReady: boolean;
  isSpectator: boolean;
  vetoUsed: boolean;
  connected: boolean;
}

export interface Bid {
  teamId: string;
  amount: number;
  timestamp: number;
}

export interface MatchEvent {
  minute: number;
  type: MatchEventType;
  team: 'home' | 'away';
  player: string;
  assist?: string | null;
  description: string;
}

export interface ExtraPeriod {
  homeGoals: number;
  awayGoals: number;
  events: MatchEvent[];
}

export interface PenaltyShootout {
  home: boolean[];
  away: boolean[];
}

export interface MatchResult {
  id: string;
  round: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  homeGoals: number;
  awayGoals: number;
  events: MatchEvent[];
  extraTime?: ExtraPeriod | null;
  penalties?: PenaltyShootout | null;
  penaltyWinner?: 'home' | 'away' | null;
  manOfTheMatch: string;
  narration: string;
  played: boolean;
}

export interface TournamentStanding {
  teamId: string;
  teamName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export type AwardType =
  | 'champion'
  | 'runnerUp'
  | 'third'
  | 'goldenBoot'
  | 'assistKing'
  | 'goldenGlove'
  | 'goldenBall'
  | 'bestGoal';

export interface Award {
  type: AwardType;
  winner: string;
  teamName: string;
  stat?: number;
  description?: string;
}

export interface RoomConfig {
  mode: GameMode;
  formation: '4-3-3' | '4-4-2' | '3-5-2' | 'futsal';
  budget: number;
  bidTimer: 15 | 30 | 45 | 60;
  tournamentFormat: TournamentFormat;
  maxPlayers: number;
  auctionStyle: 'sealed' | 'open';
  jokersEnabled: boolean;
  vetoEnabled: boolean;
}

export const FORMATION_REQUIREMENTS: Record<
  string,
  { atacante: number; meia: number; defensor: number; goleiro: number }
> = {
  futsal: { atacante: 1, meia: 2, defensor: 1, goleiro: 1 },
  '4-3-3': { atacante: 3, meia: 3, defensor: 4, goleiro: 1 },
  '4-4-2': { atacante: 2, meia: 4, defensor: 4, goleiro: 1 },
  '3-5-2': { atacante: 2, meia: 5, defensor: 3, goleiro: 1 },
};

export type GamePhase =
  | 'lobby'
  | 'auction'
  | 'review'
  | 'tournament'
  | 'standings'
  | 'awards';

export interface ChatMessage {
  id: string;
  playerName: string;
  message: string;
  timestamp: number;
  system?: boolean;
}

export interface AuctionPlayerState {
  player: Player;
  remainingCount: number;
  poolStatus: { atacante: number; meia: number; defensor: number; goleiro: number };
  index: number;
  total: number;
}

export interface Room {
  code: string;
  hostTeamId: string;
  config: RoomConfig;
  teams: Team[];
  phase: GamePhase;
  pool: Player[];
  auctionIndex: number;
  currentAuctionPlayer: Player | null;
  currentBids: Bid[];
  matches: MatchResult[];
  standings: TournamentStanding[];
  awards: Award[];
  bracket?: BracketRound[];
  createdAt: number;
}

export interface BracketRound {
  name: string;
  matchIds: string[];
}

// ---------- WebSocket payloads ----------

export interface CreateRoomPayload {
  hostName: string;
  teamName: string;
  mode: GameMode;
  config: Partial<RoomConfig>;
}

export interface JoinRoomPayload {
  roomCode: string;
  playerName: string;
  teamName: string;
  spectator?: boolean;
}

export interface PlaceBidPayload {
  roomCode: string;
  amount: number;
}

export interface BidResultPayload {
  player: Player;
  winnerTeamId: string | null;
  winnerTeamName: string | null;
  amount: number;
  allBids: Bid[];
  reason?: 'highestBid' | 'noBids' | 'tieBreak';
}

export interface AutoAssignPayload {
  player: Player;
  teamId: string;
  teamName: string;
  reason: string;
}
