import { randomUUID } from 'node:crypto';
import type { GameMode, Player, Room, RoomConfig, Team } from '../types.js';

/** Extensão server-only do Room: fila de revelação, timer de leilão e estágio do bracket. */
export interface RuntimeRoom extends Room {
  revealQueue: Player[];
  timerHandle: ReturnType<typeof setInterval> | null;
  timerSecondsLeft: number;
  openAuctionHighestBid: { teamId: string; amount: number } | null;
  openAuctionPassed: Set<string>;
  worldCupGroups: Record<string, string[]> | null;
}

const rooms = new Map<string, RuntimeRoom>();

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem O/0/I/1 para evitar confusão

export function generateRoomCode(): string {
  let suffix = '';
  for (let i = 0; i < 4; i++) suffix += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  const code = `FUT-${suffix}`;
  return rooms.has(code) ? generateRoomCode() : code;
}

const DEFAULT_CONFIGS: Record<GameMode, RoomConfig> = {
  futsal: {
    mode: 'futsal',
    formation: 'futsal',
    budget: 20,
    bidTimer: 30,
    tournamentFormat: 'league',
    maxPlayers: 6,
    auctionStyle: 'sealed',
    playerPool: 'mixed',
    jokersEnabled: false,
    vetoEnabled: false,
  },
  full: {
    mode: 'full',
    formation: '4-3-3',
    budget: 50,
    bidTimer: 30,
    tournamentFormat: 'league',
    maxPlayers: 16,
    auctionStyle: 'sealed',
    playerPool: 'mixed',
    jokersEnabled: false,
    vetoEnabled: false,
  },
};

export function createRoom(hostName: string, teamName: string, mode: GameMode, config: Partial<RoomConfig>, socketId: string): RuntimeRoom {
  const code = generateRoomCode();
  const hostTeam: Team = {
    id: randomUUID(),
    socketId,
    ownerName: hostName,
    teamName,
    players: [],
    budget: 0,
    spent: 0,
    isHost: true,
    isReady: false,
    isSpectator: false,
    vetoUsed: false,
    connected: true,
  };

  const room: RuntimeRoom = {
    code,
    hostTeamId: hostTeam.id,
    config: { ...DEFAULT_CONFIGS[mode], ...config, mode },
    teams: [hostTeam],
    phase: 'lobby',
    pool: [],
    auctionIndex: 0,
    currentAuctionPlayer: null,
    currentBids: [],
    matches: [],
    standings: [],
    awards: [],
    createdAt: Date.now(),
    revealQueue: [],
    timerHandle: null,
    timerSecondsLeft: 0,
    openAuctionHighestBid: null,
    openAuctionPassed: new Set(),
    worldCupGroups: null,
  };
  hostTeam.budget = room.config.budget;

  rooms.set(code, room);
  return room;
}

export function getRoom(code: string): RuntimeRoom | undefined {
  return rooms.get(code.toUpperCase());
}

export function joinRoom(code: string, playerName: string, teamName: string, socketId: string, spectator = false): Team | null {
  const room = getRoom(code);
  if (!room) return null;
  if (room.phase !== 'lobby' && !spectator) return null;
  if (room.teams.filter((t) => !t.isSpectator).length >= room.config.maxPlayers && !spectator) return null;

  const team: Team = {
    id: randomUUID(),
    socketId,
    ownerName: playerName,
    teamName,
    players: [],
    budget: spectator ? 0 : room.config.budget,
    spent: 0,
    isHost: false,
    isReady: false,
    isSpectator: spectator,
    vetoUsed: false,
    connected: true,
  };
  room.teams.push(team);
  return team;
}

export function removeRoomIfEmpty(code: string) {
  const room = getRoom(code);
  if (room && room.teams.every((t) => !t.connected)) {
    rooms.delete(code);
  }
}

export function findRoomBySocket(socketId: string): { room: RuntimeRoom; team: Team } | null {
  for (const room of rooms.values()) {
    const team = room.teams.find((t) => t.socketId === socketId);
    if (team) return { room, team };
  }
  return null;
}

export function allRooms(): Room[] {
  return [...rooms.values()];
}
