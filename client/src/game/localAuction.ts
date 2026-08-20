// Espelha server/src/game/auction.ts — roda 100% no navegador pro modo "mesmo aparelho" (hot-seat).
// Qualquer regra de leilão alterada lá deve ser replicada aqui também.
import { FORMATION_REQUIREMENTS, type Bid, type GameMode, type Player, type Position, type Team } from '../types';

export type FormationRequirements = Record<Position, number>;

export function getFormationRequirements(config: { mode: GameMode; formation: string }): FormationRequirements {
  const key = config.mode === 'futsal' ? 'futsal' : config.formation;
  const req = FORMATION_REQUIREMENTS[key];
  if (!req) throw new Error(`Formação desconhecida: ${key}`);
  return req;
}

export function generatePool(
  allPlayers: Player[],
  requirements: FormationRequirements,
  numTeams: number,
  playerPool: 'mixed' | 'current' | 'legends' = 'mixed'
): Player[] {
  const positions: Position[] = ['atacante', 'meia', 'defensor', 'goleiro'];
  const pool: Player[] = [];
  const eligiblePlayers =
    playerPool === 'mixed' ? allPlayers : allPlayers.filter((p) => p.era === (playerPool === 'current' ? 'current' : 'legend'));

  for (const position of positions) {
    const required = requirements[position];
    if (!required) continue;
    const need = Math.min(required * (numTeams + 2), eligiblePlayers.filter((p) => p.position === position).length);
    const candidates = shuffle(eligiblePlayers.filter((p) => p.position === position));
    pool.push(...candidates.slice(0, need));
  }

  return shuffle(pool);
}

export function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function countByPosition(players: Player[], position: Position): number {
  return players.filter((p) => p.position === position).length;
}

export function remainingVacancies(team: Team, requirements: FormationRequirements): number {
  const total = Object.values(requirements).reduce((a, b) => a + b, 0);
  return total - team.players.length;
}

export function vacanciesForPosition(team: Team, requirements: FormationRequirements, position: Position): number {
  return requirements[position] - countByPosition(team.players, position);
}

export function isPositionComplete(team: Team, requirements: FormationRequirements, position: Position): boolean {
  return vacanciesForPosition(team, requirements, position) <= 0;
}

export function maxAllowedBid(team: Team, requirements: FormationRequirements): number {
  const vacanciesAfterThis = remainingVacancies(team, requirements) - 1;
  const reserved = Math.max(0, vacanciesAfterThis);
  const max = team.budget - reserved;
  return Math.max(0, max);
}

export function canBidOnPosition(team: Team, requirements: FormationRequirements, position: Position): boolean {
  if (isPositionComplete(team, requirements, position)) return false;
  if (team.budget <= 0) return false;
  return maxAllowedBid(team, requirements) >= 1;
}

export interface BidResolution {
  winnerTeamId: string | null;
  amount: number;
  reason: 'highestBid' | 'noBids' | 'tieBreak';
}

export function resolveBids(bids: Bid[], teams: Team[], position: Position): BidResolution {
  if (bids.length === 0) {
    return { winnerTeamId: null, amount: 0, reason: 'noBids' };
  }

  const highest = Math.max(...bids.map((b) => b.amount));
  const topBids = bids.filter((b) => b.amount === highest);

  if (topBids.length === 1) {
    return { winnerTeamId: topBids[0].teamId, amount: highest, reason: 'highestBid' };
  }

  const withCounts = topBids.map((b) => {
    const team = teams.find((t) => t.id === b.teamId)!;
    return { teamId: b.teamId, count: countByPosition(team.players, position) };
  });
  const minCount = Math.min(...withCounts.map((w) => w.count));
  const fewest = withCounts.filter((w) => w.count === minCount);

  const winner = fewest[Math.floor(Math.random() * fewest.length)];
  return { winnerTeamId: winner.teamId, amount: highest, reason: 'tieBreak' };
}

export interface AutoAssignResult {
  playerId: string;
  teamId: string;
}

export function computeAutoAssignments(
  remainingPool: Player[],
  teams: Team[],
  requirements: FormationRequirements,
  position: Position
): AutoAssignResult[] {
  const playersOfPosition = remainingPool.filter((p) => p.position === position);
  const teamsNeeding = teams.filter((t) => vacanciesForPosition(t, requirements, position) > 0);

  if (playersOfPosition.length === 0 || playersOfPosition.length !== teamsNeeding.length) {
    return [];
  }

  const shuffledPlayers = shuffle(playersOfPosition);
  const shuffledTeams = shuffle(teamsNeeding);

  return shuffledPlayers.map((player, i) => ({ playerId: player.id, teamId: shuffledTeams[i].id }));
}

export function allTeamsComplete(teams: Team[], requirements: FormationRequirements): boolean {
  return teams.every((t) => remainingVacancies(t, requirements) <= 0);
}

const MEME_JOKERS: { name: string; positionDetail: string }[] = [
  { name: 'Robertinho da Pesada', positionDetail: 'Zagueiro amador de fim de semana' },
  { name: 'Juninho Pé-de-Anjo', positionDetail: 'Craque do campinho do bairro' },
  { name: 'Careca do Buteco', positionDetail: 'Lenda da pelada de domingo' },
];

export function applyJokers(pool: Player[]): Player[] {
  const result = [...pool];
  const highRated = result.filter((p) => p.rating >= 95);
  const jokerCount = Math.min(2, highRated.length);
  const chosen = shuffle(highRated).slice(0, jokerCount);
  for (const p of chosen) {
    const idx = result.findIndex((rp) => rp.id === p.id);
    if (idx >= 0) result[idx] = { ...result[idx], isJoker: true };
  }

  const meme = MEME_JOKERS[Math.floor(Math.random() * MEME_JOKERS.length)];
  const positions: Position[] = ['atacante', 'meia', 'defensor', 'goleiro'];
  const memePlayer: Player = {
    id: `joker-${Date.now()}`,
    name: meme.name,
    nationality: 'Brasil',
    nationalityFlag: '🇧🇷',
    position: positions[Math.floor(Math.random() * positions.length)],
    positionDetail: meme.positionDetail,
    rating: 60,
    era: 'current',
    imageUrl: null,
    isJoker: true,
  };
  const insertAt = Math.floor(Math.random() * (result.length + 1));
  result.splice(insertAt, 0, memePlayer);
  return result;
}
