import { FORMATION_REQUIREMENTS, type Position } from '../types';
import type { PublicTeam } from '../types/client';
import type { RoomConfig } from '../types';

export function getFormationRequirements(config: Pick<RoomConfig, 'mode' | 'formation'>) {
  const key = config.mode === 'futsal' ? 'futsal' : config.formation;
  return FORMATION_REQUIREMENTS[key] ?? FORMATION_REQUIREMENTS['4-3-3'];
}

export function countByPosition(team: PublicTeam, position: Position): number {
  return team.players.filter((p) => p.position === position).length;
}

export function remainingVacancies(team: PublicTeam, config: Pick<RoomConfig, 'mode' | 'formation'>): number {
  const req = getFormationRequirements(config);
  const total = Object.values(req).reduce((a, b) => a + b, 0);
  return total - team.players.length;
}

export function vacanciesForPosition(team: PublicTeam, config: Pick<RoomConfig, 'mode' | 'formation'>, position: Position): number {
  const req = getFormationRequirements(config);
  return req[position] - countByPosition(team, position);
}

export function isPositionComplete(team: PublicTeam, config: Pick<RoomConfig, 'mode' | 'formation'>, position: Position): boolean {
  return vacanciesForPosition(team, config, position) <= 0;
}

/** Espelha server/src/game/auction.ts#maxAllowedBid — usado só para feedback imediato na UI. */
export function maxAllowedBid(team: PublicTeam, config: Pick<RoomConfig, 'mode' | 'formation'>): number {
  const vacanciesAfterThis = remainingVacancies(team, config) - 1;
  const reserved = Math.max(0, vacanciesAfterThis);
  return Math.max(0, team.budget - reserved);
}

export function canBidOnPosition(team: PublicTeam, config: Pick<RoomConfig, 'mode' | 'formation'>, position: Position): boolean {
  if (isPositionComplete(team, config, position)) return false;
  if (team.budget <= 0) return false;
  return maxAllowedBid(team, config) >= 1;
}

export function formatMoney(value: number): string {
  return `R$ ${value}`;
}

export function averageRating(team: PublicTeam): number {
  if (team.players.length === 0) return 0;
  return Math.round(team.players.reduce((sum, p) => sum + p.rating, 0) / team.players.length);
}
