import type { Server, Socket } from 'socket.io';
import QRCode from 'qrcode';
import { randomUUID } from 'node:crypto';
import type {
  AuctionPlayerState,
  Award,
  Bid,
  ChatMessage,
  CreateRoomPayload,
  JoinRoomPayload,
  MatchResult,
  Player,
  Position,
  Team,
  TournamentStanding,
} from '../types.js';
import { ALL_PLAYERS } from '../data/loadPlayers.js';
import { createRoom, findRoomBySocket, getRoom, joinRoom, removeRoomIfEmpty, type RuntimeRoom } from './rooms.js';
import {
  allTeamsComplete,
  applyJokers,
  canBidOnPosition,
  computeAutoAssignments,
  generatePool,
  getFormationRequirements,
  maxAllowedBid,
  remainingVacancies,
  resolveBids,
  vacanciesForPosition,
} from '../game/auction.js';
import {
  buildKnockoutFirstRound,
  buildLeagueMatches,
  buildNextKnockoutRound,
  buildWorldCupGroups,
  computeAwards,
  computeStandings,
  groupStandings,
  winnerOf,
} from '../game/tournament.js';
import { simulateMatch } from '../ai/matchNarrator.js';
import { bumpRanking, getGlobalRanking, getTournamentHistoryForRoom, saveTournamentHistory } from '../db/sqlite.js';

const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173';
const OPEN_AUCTION_TIMER = 10;

function publicTeam(t: Team) {
  const { socketId, ...rest } = t;
  return rest;
}

function roomSnapshot(room: RuntimeRoom) {
  return {
    code: room.code,
    hostTeamId: room.hostTeamId,
    config: room.config,
    teams: room.teams.map(publicTeam),
    phase: room.phase,
    standings: room.standings,
    awards: room.awards,
    matches: room.matches.map((m) => ({ ...m, events: m.played ? m.events : [] })),
    bracket: room.bracket ?? [],
  };
}

function emitRoomState(io: Server, room: RuntimeRoom) {
  io.to(room.code).emit('room_state', roomSnapshot(room));
}

function systemChat(io: Server, room: RuntimeRoom, message: string) {
  const chat: ChatMessage = { id: randomUUID(), playerName: 'Sistema', message, timestamp: Date.now(), system: true };
  io.to(room.code).emit('chat_message', chat);
}

export function registerSocketHandlers(io: Server) {
  io.on('connection', (socket: Socket) => {
    socket.on('create_room', async (payload: CreateRoomPayload, ack?: (res: any) => void) => {
      try {
        const room = createRoom(payload.hostName, payload.teamName, payload.mode, payload.config ?? {}, socket.id);
        socket.join(room.code);
        // Usa a origem real de onde o navegador conectou (funciona em qualquer deploy,
        // sem precisar configurar FRONTEND_URL manualmente); cai pro env var como fallback.
        const origin = socket.handshake.headers.origin ?? FRONTEND_URL;
        const qrCode = await QRCode.toDataURL(`${origin}/join/${room.code}`);
        ack?.({ ok: true, roomCode: room.code, qrCode, hostTeamId: room.hostTeamId });
        emitRoomState(io, room);
      } catch (err: any) {
        ack?.({ ok: false, error: err.message ?? 'Erro ao criar sala' });
      }
    });

    socket.on('join_room', (payload: JoinRoomPayload, ack?: (res: any) => void) => {
      const team = joinRoom(payload.roomCode, payload.playerName, payload.teamName, socket.id, payload.spectator);
      if (!team) {
        ack?.({ ok: false, error: 'Não foi possível entrar na sala (código inválido, sala cheia ou já iniciada).' });
        return;
      }
      const room = getRoom(payload.roomCode)!;
      socket.join(room.code);
      ack?.({ ok: true, teamId: team.id, room: roomSnapshot(room) });
      io.to(room.code).emit('player_joined', { players: room.teams.map(publicTeam) });
      systemChat(io, room, `${team.isSpectator ? '👀 ' : ''}${payload.playerName} entrou na sala.`);
    });

    socket.on('player_ready', ({ roomCode }: { roomCode: string }) => {
      const room = getRoom(roomCode);
      const team = room?.teams.find((t) => t.socketId === socket.id);
      if (!room || !team) return;
      team.isReady = !team.isReady;
      emitRoomState(io, room);
    });

    socket.on('update_config', ({ roomCode, config }: { roomCode: string; config: Partial<RuntimeRoom['config']> }) => {
      const room = getRoom(roomCode);
      if (!room) return;
      const team = room.teams.find((t) => t.socketId === socket.id);
      if (!team?.isHost) return;
      room.config = { ...room.config, ...config };
      room.teams.forEach((t) => {
        if (!t.isSpectator) t.budget = room.config.budget;
      });
      emitRoomState(io, room);
    });

    socket.on('start_auction', ({ roomCode }: { roomCode: string }) => {
      const room = getRoom(roomCode);
      const team = room?.teams.find((t) => t.socketId === socket.id);
      if (!room || !team?.isHost || room.phase !== 'lobby') return;
      startAuction(io, room);
    });

    socket.on('place_bid', ({ roomCode, amount }: { roomCode: string; amount: number }, ack?: (res: any) => void) => {
      const room = getRoom(roomCode);
      const team = room?.teams.find((t) => t.socketId === socket.id);
      if (!room || !team || room.phase !== 'auction' || !room.currentAuctionPlayer) {
        ack?.({ ok: false, error: 'Leilão não está ativo.' });
        return;
      }
      const requirements = getFormationRequirements(room.config);
      const position = room.currentAuctionPlayer.position;

      if (team.isSpectator) return ack?.({ ok: false, error: 'Espectadores não podem dar lances.' });
      if (!canBidOnPosition(team, requirements, position)) {
        return ack?.({ ok: false, error: 'Posição completa ou saldo insuficiente.' });
      }
      const max = maxAllowedBid(team, requirements);
      if (!Number.isInteger(amount) || amount < 1 || amount > max) {
        return ack?.({ ok: false, error: `Lance inválido. Máximo permitido: R$ ${max}.` });
      }

      if (room.config.auctionStyle === 'open') {
        if (room.openAuctionPassed.has(team.id)) {
          return ack?.({ ok: false, error: 'Você já passou nesse jogador.' });
        }
        if (room.openAuctionHighestBid && amount <= room.openAuctionHighestBid.amount) {
          return ack?.({ ok: false, error: 'O lance precisa ser maior que o lance atual.' });
        }
        room.openAuctionHighestBid = { teamId: team.id, amount };
        room.timerSecondsLeft = OPEN_AUCTION_TIMER;
        io.to(room.code).emit('open_bid_update', { teamId: team.id, teamName: team.teamName, amount });
        ack?.({ ok: true });
        return;
      }

      const existing = room.currentBids.find((b) => b.teamId === team.id);
      if (existing) existing.amount = amount;
      else room.currentBids.push({ teamId: team.id, amount, timestamp: Date.now() });
      ack?.({ ok: true });
    });

    socket.on('pass_bid', ({ roomCode }: { roomCode: string }, ack?: (res: any) => void) => {
      const room = getRoom(roomCode);
      const team = room?.teams.find((t) => t.socketId === socket.id);
      if (!room || !team || room.phase !== 'auction' || !room.currentAuctionPlayer) {
        ack?.({ ok: false });
        return;
      }

      if (room.config.auctionStyle === 'open') {
        if (room.openAuctionHighestBid?.teamId === team.id) {
          ack?.({ ok: false, error: 'Você está na frente do lance, não dá pra passar.' });
          return;
        }
        room.openAuctionPassed.add(team.id);
        io.to(room.code).emit('open_bid_pass', { teamId: team.id, teamName: team.teamName });
        ack?.({ ok: true });
        if (allEligibleTeamsDecided(room)) {
          if (room.timerHandle) {
            clearInterval(room.timerHandle);
            room.timerHandle = null;
          }
          resolveRound(io, room);
        }
        return;
      }

      room.currentBids = room.currentBids.filter((b) => b.teamId !== team.id);
      ack?.({ ok: true });
    });

    socket.on('veto_purchase', ({ roomCode, targetTeamId, playerId }: { roomCode: string; targetTeamId: string; playerId: string }) => {
      const room = getRoom(roomCode);
      const vetoer = room?.teams.find((t) => t.socketId === socket.id);
      if (!room || !vetoer || !room.config.vetoEnabled) return;
      if (vetoer.vetoUsed || vetoer.id === targetTeamId) return;
      const target = room.teams.find((t) => t.id === targetTeamId);
      const playerIdx = target?.players.findIndex((p) => p.id === playerId) ?? -1;
      if (!target || playerIdx < 0) return;

      const [player] = target.players.splice(playerIdx, 1);
      // devolve o valor gasto e o jogador volta pro pool para ser leiloado de novo
      const spentEntry = target.spent;
      target.spent = Math.max(0, target.spent - estimateSpentFor(target, player));
      target.budget += estimateSpentFor(target, player) || 0;
      vetoer.vetoUsed = true;
      room.revealQueue.push(player);
      systemChat(io, room, `🚫 ${vetoer.teamName} vetou a compra de ${player.name} pelo ${target.teamName}! Ele volta pro leilão.`);
      emitRoomState(io, room);
    });

    socket.on('chat_message', ({ roomCode, message }: { roomCode: string; message: string }) => {
      const room = getRoom(roomCode);
      const team = room?.teams.find((t) => t.socketId === socket.id);
      if (!room || !team || !message?.trim()) return;
      const chat: ChatMessage = {
        id: randomUUID(),
        playerName: `${team.ownerName} (${team.teamName})`,
        message: message.trim().slice(0, 280),
        timestamp: Date.now(),
      };
      io.to(room.code).emit('chat_message', chat);
    });

    socket.on('start_tournament', ({ roomCode }: { roomCode: string }) => {
      const room = getRoom(roomCode);
      const team = room?.teams.find((t) => t.socketId === socket.id);
      if (!room || !team?.isHost || room.phase !== 'review') return;
      runTournament(io, room).catch((err) => console.error('Erro ao rodar torneio', err));
    });

    socket.on('return_to_lobby', ({ roomCode }: { roomCode: string }) => {
      const room = getRoom(roomCode);
      const team = room?.teams.find((t) => t.socketId === socket.id);
      if (!room || !team?.isHost || room.phase !== 'awards') return;
      resetRoomToLobby(room);
      systemChat(io, room, '🔁 O host voltou pro lobby. Configurem e iniciem um novo leilão quando quiserem!');
      emitRoomState(io, room);
    });

    socket.on('request_match_details', ({ roomCode, matchId }: { roomCode: string; matchId: string }) => {
      const room = getRoom(roomCode);
      const match = room?.matches.find((m) => m.id === matchId);
      if (!match) return;
      socket.emit('match_narration', { matchId, events: match.events, extraTime: match.extraTime, penalties: match.penalties });
    });

    socket.on('get_tournament_history', ({ roomCode }: { roomCode: string }, ack?: (res: any) => void) => {
      ack?.(getTournamentHistoryForRoom(roomCode));
    });

    socket.on('get_global_ranking', (_payload: unknown, ack?: (res: any) => void) => {
      ack?.(getGlobalRanking());
    });

    socket.on('disconnect', () => {
      const found = findRoomBySocket(socket.id);
      if (!found) return;
      const { room, team } = found;
      team.connected = false;
      io.to(room.code).emit('player_joined', { players: room.teams.map(publicTeam) });
      removeRoomIfEmpty(room.code);
    });
  });
}

/** Reseta a sala pro lobby (mesmo código, mesmos jogadores conectados) pra jogar de novo do zero. */
function resetRoomToLobby(room: RuntimeRoom) {
  if (room.timerHandle) {
    clearInterval(room.timerHandle);
    room.timerHandle = null;
  }
  room.phase = 'lobby';
  room.pool = [];
  room.revealQueue = [];
  room.auctionIndex = 0;
  room.currentAuctionPlayer = null;
  room.currentBids = [];
  room.openAuctionHighestBid = null;
  room.openAuctionPassed = new Set();
  room.matches = [];
  room.standings = [];
  room.awards = [];
  room.bracket = [];
  room.worldCupGroups = null;

  for (const team of room.teams) {
    if (team.isSpectator) continue;
    team.players = [];
    team.budget = room.config.budget;
    team.spent = 0;
    team.vetoUsed = false;
    team.isReady = team.isHost;
  }
}

function estimateSpentFor(team: Team, player: Player): number {
  // aproximação simples: gasto médio por jogador do time (não guardamos preço individual)
  return team.players.length > 0 ? Math.round(team.spent / (team.players.length + 1)) : 0;
}

// ---------------------------------------------------------------------------
// LEILÃO
// ---------------------------------------------------------------------------

function startAuction(io: Server, room: RuntimeRoom) {
  const requirements = getFormationRequirements(room.config);
  const numTeams = room.teams.filter((t) => !t.isSpectator).length;
  let pool = generatePool(ALL_PLAYERS, requirements, numTeams, room.config.playerPool);
  if (room.config.jokersEnabled) pool = applyJokers(pool);

  room.pool = pool;
  room.revealQueue = [...pool];
  room.auctionIndex = 0;
  room.phase = 'auction';
  room.currentBids = [];
  room.openAuctionHighestBid = null;
  room.openAuctionPassed = new Set();

  io.to(room.code).emit('auction_started', { pool });
  emitRoomState(io, room);
  revealNextPlayer(io, room);
}

function requirements(room: RuntimeRoom) {
  return getFormationRequirements(room.config);
}

/** No leilão aberto: true quando todo time que ainda pode dar lance já é o líder ou já passou (não precisa esperar o timer). */
function allEligibleTeamsDecided(room: RuntimeRoom): boolean {
  if (!room.currentAuctionPlayer) return false;
  const req = requirements(room);
  const eligible = room.teams.filter((t) => !t.isSpectator && canBidOnPosition(t, req, room.currentAuctionPlayer!.position));
  const highestTeamId = room.openAuctionHighestBid?.teamId ?? null;
  return eligible.every((t) => t.id === highestTeamId || room.openAuctionPassed.has(t.id));
}

function revealNextPlayer(io: Server, room: RuntimeRoom) {
  runAutoAssignChecks(io, room);

  if (allTeamsComplete(room, requirements(room)) || room.revealQueue.length === 0) {
    finishAuction(io, room);
    return;
  }

  const req = requirements(room);
  const eligibleTeams = room.teams.filter(
    (t) => !t.isSpectator && vacanciesForPosition(t, req, room.revealQueue[0].position) > 0
  );
  if (eligibleTeams.length === 0) {
    // ninguém precisa dessa posição (não deveria acontecer com o pool proporcional, mas por segurança)
    room.revealQueue.shift();
    revealNextPlayer(io, room);
    return;
  }

  const player = room.revealQueue.shift()!;
  room.currentAuctionPlayer = player;
  room.currentBids = [];
  room.openAuctionHighestBid = null;
  room.openAuctionPassed = new Set();
  room.auctionIndex++;

  const poolStatus = {
    atacante: room.revealQueue.filter((p) => p.position === 'atacante').length,
    meia: room.revealQueue.filter((p) => p.position === 'meia').length,
    defensor: room.revealQueue.filter((p) => p.position === 'defensor').length,
    goleiro: room.revealQueue.filter((p) => p.position === 'goleiro').length,
  };

  const payload: AuctionPlayerState = {
    player,
    remainingCount: room.revealQueue.length,
    poolStatus,
    index: room.auctionIndex,
    total: room.pool.length,
  };
  io.to(room.code).emit('reveal_player', payload);

  room.timerSecondsLeft = room.config.auctionStyle === 'open' ? OPEN_AUCTION_TIMER : room.config.bidTimer;
  startTimer(io, room);
}

function startTimer(io: Server, room: RuntimeRoom) {
  if (room.timerHandle) clearInterval(room.timerHandle);
  io.to(room.code).emit('timer_tick', { secondsLeft: room.timerSecondsLeft });
  room.timerHandle = setInterval(() => {
    room.timerSecondsLeft--;
    io.to(room.code).emit('timer_tick', { secondsLeft: room.timerSecondsLeft });
    if (room.timerSecondsLeft <= 0) {
      clearInterval(room.timerHandle!);
      room.timerHandle = null;
      resolveRound(io, room);
    }
  }, 1000);
}

function resolveRound(io: Server, room: RuntimeRoom) {
  const player = room.currentAuctionPlayer;
  if (!player) return;
  const req = requirements(room);

  let winnerTeamId: string | null = null;
  let amount = 0;
  let reason: 'highestBid' | 'noBids' | 'tieBreak' = 'noBids';
  let allBids: Bid[] = room.currentBids;

  if (room.config.auctionStyle === 'open') {
    if (room.openAuctionHighestBid) {
      winnerTeamId = room.openAuctionHighestBid.teamId;
      amount = room.openAuctionHighestBid.amount;
      reason = 'highestBid';
      allBids = [{ teamId: winnerTeamId, amount, timestamp: Date.now() }];
    }
  } else {
    const resolution = resolveBids(room.currentBids, room.teams, player.position);
    winnerTeamId = resolution.winnerTeamId;
    amount = resolution.amount;
    reason = resolution.reason;
  }

  const winnerTeam = winnerTeamId ? room.teams.find((t) => t.id === winnerTeamId) ?? null : null;
  if (winnerTeam) {
    winnerTeam.players.push(player);
    winnerTeam.budget -= amount;
    winnerTeam.spent += amount;
  }

  io.to(room.code).emit('bid_result', {
    player,
    winnerTeamId,
    winnerTeamName: winnerTeam?.teamName ?? null,
    amount,
    allBids,
    reason,
  });

  if (winnerTeam) {
    systemChat(io, room, `💰 ${winnerTeam.teamName} comprou ${player.name} por R$ ${amount}!`);
    if (remainingVacancies(winnerTeam, req) <= 0) {
      io.to(room.code).emit('team_complete', { teamName: winnerTeam.teamName });
    }
  } else {
    systemChat(io, room, `📉 Ninguém deu lance em ${player.name}. Jogador descartado.`);
  }

  room.currentAuctionPlayer = null;
  room.currentBids = [];
  room.openAuctionHighestBid = null;
  room.openAuctionPassed = new Set();
  emitRoomState(io, room);
  revealNextPlayer(io, room);
}

function runAutoAssignChecks(io: Server, room: RuntimeRoom) {
  const req = requirements(room);
  const positions: Position[] = ['atacante', 'meia', 'defensor', 'goleiro'];
  let changed = true;

  while (changed) {
    changed = false;
    for (const position of positions) {
      const assignments = computeAutoAssignments(room.revealQueue, room.teams, req, position);
      if (assignments.length === 0) continue;

      for (const a of assignments) {
        const idx = room.revealQueue.findIndex((p) => p.id === a.playerId);
        if (idx < 0) continue;
        const [player] = room.revealQueue.splice(idx, 1);
        const team = room.teams.find((t) => t.id === a.teamId);
        if (!team) continue;
        const amount = Math.min(1, team.budget);
        team.players.push(player);
        team.budget -= amount;
        team.spent += amount;
        io.to(room.code).emit('auto_assign', { player, teamId: team.id, teamName: team.teamName, reason: 'Distribuição automática (posição esgotada)' });
        if (remainingVacancies(team, req) <= 0) {
          io.to(room.code).emit('team_complete', { teamName: team.teamName });
        }
      }
      changed = true;
    }
  }
}

function finishAuction(io: Server, room: RuntimeRoom) {
  room.phase = 'review';
  room.currentAuctionPlayer = null;
  io.to(room.code).emit('all_teams_complete', { teams: room.teams.map(publicTeam) });
  emitRoomState(io, room);
}

// ---------------------------------------------------------------------------
// TORNEIO
// ---------------------------------------------------------------------------

async function simulateAndBroadcast(io: Server, room: RuntimeRoom, match: MatchResult, isKnockout: boolean) {
  const home = room.teams.find((t) => t.id === match.homeTeamId)!;
  const away = room.teams.find((t) => t.id === match.awayTeamId)!;

  const result = await simulateMatch({ homeTeam: home, awayTeam: away, mode: room.config.mode, isKnockout });

  match.homeGoals = result.homeGoals;
  match.awayGoals = result.awayGoals;
  match.events = result.events;
  match.extraTime = result.extraTime;
  match.penalties = result.penalties;
  match.penaltyWinner = result.penaltyWinner;
  match.manOfTheMatch = result.manOfTheMatch;
  match.narration = result.narration;
  match.played = true;

  room.matches.push(match);
  io.to(room.code).emit('match_result', { match });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function playMatches(io: Server, room: RuntimeRoom, matches: MatchResult[], isKnockout: boolean) {
  for (const match of matches) {
    await simulateAndBroadcast(io, room, match, isKnockout);
    const standings = computeStandings(room.matches, room.teams.filter((t) => !t.isSpectator));
    room.standings = standings;
    io.to(room.code).emit('standings_update', { standings });
    // Dá tempo pra narração (lances perigosos + gols) rodar na tela antes de mandar a próxima partida.
    const eventCount = match.events.length + (match.extraTime?.events.length ?? 0);
    await sleep(Math.min(4000, 1200 + eventCount * 350));
  }
}

async function runTournament(io: Server, room: RuntimeRoom) {
  room.phase = 'tournament';
  room.matches = [];
  emitRoomState(io, room);
  const playableTeams = room.teams.filter((t) => !t.isSpectator);
  let finalStandings: TournamentStanding[] = [];

  if (room.config.tournamentFormat === 'league') {
    const matches = buildLeagueMatches(room.teams);
    await playMatches(io, room, matches, false);
    finalStandings = computeStandings(room.matches, playableTeams);
  } else if (room.config.tournamentFormat === 'knockout') {
    let { matches, bracket } = buildKnockoutFirstRound(room.teams);
    room.bracket = bracket;
    await playMatches(io, room, matches, true);
    let currentRoundMatches = matches;

    while (currentRoundMatches[0]?.round !== 'Final') {
      const next = buildNextKnockoutRound(currentRoundMatches, room.teams);
      if (!next) break;
      room.bracket = [...(room.bracket ?? []), { name: next.roundName, matchIds: next.matches.map((m) => m.id) }];
      await playMatches(io, room, next.matches, true);
      currentRoundMatches = next.matches;
    }

    finalStandings = buildKnockoutFinalStandings(room, currentRoundMatches);
  } else {
    // worldcup
    const { matches: groupMatches, groups } = buildWorldCupGroups(room.teams);
    room.worldCupGroups = groups;
    await playMatches(io, room, groupMatches, false);

    const qualifiers: string[] = [];
    for (const g of Object.keys(groups)) {
      const table = groupStandings(room.matches, groups[g], room.teams);
      qualifiers.push(...table.slice(0, 2).map((t) => t.teamId));
    }
    const qualifiedTeams = room.teams.filter((t) => qualifiers.includes(t.id));
    let { matches: koMatches, bracket } = buildKnockoutFirstRound(qualifiedTeams);
    koMatches = koMatches.map((m) => ({ ...m, round: 'Oitavas de final' }));
    room.bracket = [{ name: 'Oitavas de final', matchIds: koMatches.map((m) => m.id) }];
    await playMatches(io, room, koMatches, true);
    let currentRoundMatches = koMatches;

    while (currentRoundMatches[0]?.round !== 'Final') {
      const next = buildNextKnockoutRound(currentRoundMatches, room.teams);
      if (!next) break;
      room.bracket = [...(room.bracket ?? []), { name: next.roundName, matchIds: next.matches.map((m) => m.id) }];
      await playMatches(io, room, next.matches, true);
      currentRoundMatches = next.matches;
    }

    finalStandings = buildKnockoutFinalStandings(room, currentRoundMatches);
  }

  const awards = computeAwards(room.matches, playableTeams, finalStandings);
  room.awards = awards;
  room.standings = finalStandings;
  room.phase = 'awards';

  saveTournamentHistory({
    id: randomUUID(),
    room_code: room.code,
    mode: room.config.mode,
    standings_json: JSON.stringify(finalStandings),
    awards_json: JSON.stringify(awards),
    matches_json: JSON.stringify(room.matches),
  });
  for (const t of playableTeams) {
    const isChampion = finalStandings[0]?.teamId === t.id;
    const points = isChampion ? 10 : finalStandings.findIndex((s) => s.teamId === t.id) === 1 ? 6 : 3;
    bumpRanking(t.ownerName, points, isChampion);
  }

  io.to(room.code).emit('tournament_end', { standings: finalStandings, awards });
  emitRoomState(io, room);
}

function buildKnockoutFinalStandings(room: RuntimeRoom, finalRoundMatches: MatchResult[]): TournamentStanding[] {
  const finalMatch = finalRoundMatches[0];
  const championId = winnerOf(finalMatch);
  const runnerUpId = championId === finalMatch.homeTeamId ? finalMatch.awayTeamId : finalMatch.homeTeamId;

  const semis = room.matches.filter((m) => m.round === 'Semifinal');
  const semiLosers = semis
    .filter((m) => m.id !== undefined)
    .map((m) => (winnerOf(m) === m.homeTeamId ? m.awayTeamId : m.homeTeamId))
    .filter((id) => id !== championId && id !== runnerUpId);

  const overall = computeStandings(room.matches, room.teams.filter((t) => !t.isSpectator));
  const thirdId = semiLosers.sort((a, b) => {
    const sa = overall.find((s) => s.teamId === a)?.goalDifference ?? 0;
    const sb = overall.find((s) => s.teamId === b)?.goalDifference ?? 0;
    return sb - sa;
  })[0];

  const order = [championId, runnerUpId, thirdId].filter(Boolean) as string[];
  const rest = overall.filter((s) => !order.includes(s.teamId)).map((s) => s.teamId);
  const finalOrder = [...order, ...rest];

  return finalOrder
    .map((id) => overall.find((s) => s.teamId === id))
    .filter((s): s is TournamentStanding => Boolean(s));
}
