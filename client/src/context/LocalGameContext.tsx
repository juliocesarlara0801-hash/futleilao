// Contexto do modo "mesmo aparelho" (hot-seat): tudo roda no navegador, sem Socket.IO.
// Só chama o servidor pra simular cada partida (POST /api/simulate-match), sem sala/estado no back.
import React, { createContext, useCallback, useContext, useReducer, useRef } from 'react';
import type { Award, Bid, MatchResult, Player, Position, RoomConfig, Team, TournamentStanding } from '../types';
import type { Toast } from '../types/client';
import { ALL_PLAYERS } from '../data/players';
import {
  applyJokers,
  canBidOnPosition,
  computeAutoAssignments,
  generatePool,
  getFormationRequirements,
  maxAllowedBid,
  remainingVacancies,
  resolveBids,
  shuffle,
} from '../game/localAuction';
import {
  buildKnockoutFinalStandings,
  buildKnockoutFirstRound,
  buildLeagueMatches,
  buildNextKnockoutRound,
  buildWorldCupGroups,
  computeAwards,
  computeStandings,
  groupStandings,
} from '../game/localTournament';

const POSITIONS: Position[] = ['atacante', 'meia', 'defensor', 'goleiro'];

export interface LocalPlayerSetup {
  ownerName: string;
  teamName: string;
}

export type LocalPhase = 'setup' | 'auction' | 'review' | 'tournament' | 'awards';

interface LastResult {
  player: Player;
  winnerTeamId: string | null;
  winnerTeamName: string | null;
  amount: number;
  reason: 'highestBid' | 'noBids' | 'tieBreak';
}

interface LocalState {
  phase: LocalPhase;
  config: RoomConfig;
  teams: Team[];
  revealQueue: Player[];
  poolTotal: number;
  auctionIndex: number;
  currentPlayer: Player | null;
  turnOrder: string[];
  turnPointer: number;
  roundBids: Bid[];
  openHighest: { teamId: string; amount: number } | null;
  lastResult: LastResult | null;
  matches: MatchResult[];
  standings: TournamentStanding[];
  awards: Award[];
  toasts: Toast[];
}

const DEFAULT_CONFIG: RoomConfig = {
  mode: 'futsal',
  formation: 'futsal',
  budget: 20,
  bidTimer: 30,
  tournamentFormat: 'league',
  maxPlayers: 6,
  auctionStyle: 'sealed',
  jokersEnabled: false,
  vetoEnabled: false,
};

const initialState: LocalState = {
  phase: 'setup',
  config: DEFAULT_CONFIG,
  teams: [],
  revealQueue: [],
  poolTotal: 0,
  auctionIndex: 0,
  currentPlayer: null,
  turnOrder: [],
  turnPointer: 0,
  roundBids: [],
  openHighest: null,
  lastResult: null,
  matches: [],
  standings: [],
  awards: [],
  toasts: [],
};

function mkToast(message: string, kind: Toast['kind'] = 'info'): Toast {
  return { id: crypto.randomUUID(), message, kind };
}

/** Roda a distribuição automática até estabilizar, depois revela a próxima carta (ou fecha o leilão). */
function advance(state: LocalState): LocalState {
  let teams = state.teams;
  let revealQueue = [...state.revealQueue];
  const requirements = getFormationRequirements(state.config);
  const toasts = [...state.toasts].slice(-6);

  let changed = true;
  while (changed) {
    changed = false;
    for (const position of POSITIONS) {
      const assignments = computeAutoAssignments(revealQueue, teams, requirements, position);
      if (assignments.length === 0) continue;
      for (const a of assignments) {
        const idx = revealQueue.findIndex((p) => p.id === a.playerId);
        if (idx < 0) continue;
        const [player] = revealQueue.splice(idx, 1);
        teams = teams.map((t) =>
          t.id === a.teamId ? { ...t, players: [...t.players, player], budget: t.budget - Math.min(1, t.budget), spent: t.spent + Math.min(1, t.budget) } : t
        );
        const team = teams.find((t) => t.id === a.teamId)!;
        toasts.push(mkToast(`🎲 ${player.name} distribuído automaticamente para ${team.teamName} por R$ 1!`));
        if (remainingVacancies(team, requirements) <= 0) toasts.push(mkToast(`✅ ${team.teamName} completou o elenco!`, 'success'));
      }
      changed = true;
    }
  }

  const allComplete = teams.every((t) => remainingVacancies(t, requirements) <= 0);
  if (allComplete || revealQueue.length === 0) {
    return { ...state, teams, revealQueue, phase: 'review', currentPlayer: null, toasts };
  }

  while (revealQueue.length > 0) {
    const candidate = revealQueue[0];
    const eligible = teams.filter((t) => canBidOnPosition(t, requirements, candidate.position));
    if (eligible.length > 0) break;
    revealQueue = revealQueue.slice(1);
  }
  if (revealQueue.length === 0) {
    return { ...state, teams, revealQueue, phase: 'review', currentPlayer: null, toasts };
  }

  const player = revealQueue[0];
  revealQueue = revealQueue.slice(1);
  const eligibleIds = shuffle(teams.filter((t) => canBidOnPosition(t, requirements, player.position)).map((t) => t.id));

  return {
    ...state,
    teams,
    revealQueue,
    auctionIndex: state.auctionIndex + 1,
    currentPlayer: player,
    turnOrder: eligibleIds,
    turnPointer: 0,
    roundBids: [],
    openHighest: null,
    lastResult: null,
    toasts,
  };
}

function resolveRound(state: LocalState): LocalState {
  const player = state.currentPlayer;
  if (!player) return state;
  const requirements = getFormationRequirements(state.config);

  let winnerTeamId: string | null = null;
  let amount = 0;
  let reason: LastResult['reason'] = 'noBids';

  if (state.config.auctionStyle === 'open') {
    if (state.openHighest) {
      winnerTeamId = state.openHighest.teamId;
      amount = state.openHighest.amount;
      reason = 'highestBid';
    }
  } else {
    const resolution = resolveBids(state.roundBids, state.teams, player.position);
    winnerTeamId = resolution.winnerTeamId;
    amount = resolution.amount;
    reason = resolution.reason;
  }

  let teams = state.teams;
  const toasts = [...state.toasts].slice(-6);
  let winnerTeamName: string | null = null;

  if (winnerTeamId) {
    teams = teams.map((t) => (t.id === winnerTeamId ? { ...t, players: [...t.players, player], budget: t.budget - amount, spent: t.spent + amount } : t));
    const team = teams.find((t) => t.id === winnerTeamId)!;
    winnerTeamName = team.teamName;
    toasts.push(mkToast(`💰 ${team.teamName} comprou ${player.name} por R$ ${amount}!`, 'success'));
    if (remainingVacancies(team, requirements) <= 0) toasts.push(mkToast(`✅ ${team.teamName} completou o elenco!`, 'success'));
  } else {
    toasts.push(mkToast(`📉 Ninguém deu lance em ${player.name}. Descartado.`));
  }

  return {
    ...state,
    teams,
    currentPlayer: null,
    lastResult: { player, winnerTeamId, winnerTeamName, amount, reason },
    toasts,
  };
}

type Action =
  | { type: 'SETUP'; players: LocalPlayerSetup[]; config: RoomConfig }
  | { type: 'SUBMIT_BID'; teamId: string; amount: number | null }
  | { type: 'OPEN_RAISE'; teamId: string; amount: number }
  | { type: 'OPEN_HAMMER' }
  | { type: 'CONTINUE' }
  | { type: 'TOURNAMENT_START' }
  | { type: 'MATCH_PLAYED'; match: MatchResult }
  | { type: 'STANDINGS'; standings: TournamentStanding[] }
  | { type: 'TOURNAMENT_END'; standings: TournamentStanding[]; awards: Award[] }
  | { type: 'DISMISS_TOAST'; id: string }
  | { type: 'RESET' };

function reducer(state: LocalState, action: Action): LocalState {
  switch (action.type) {
    case 'SETUP': {
      const requirements = getFormationRequirements(action.config);
      const teams: Team[] = action.players.map((p) => ({
        id: crypto.randomUUID(),
        socketId: null,
        ownerName: p.ownerName,
        teamName: p.teamName,
        players: [],
        budget: action.config.budget,
        spent: 0,
        isHost: false,
        isReady: true,
        isSpectator: false,
        vetoUsed: false,
        connected: true,
      }));
      let pool = generatePool(ALL_PLAYERS, requirements, teams.length);
      if (action.config.jokersEnabled) pool = applyJokers(pool);
      return advance({ ...initialState, config: action.config, teams, revealQueue: pool, poolTotal: pool.length, phase: 'auction' });
    }
    case 'SUBMIT_BID': {
      let roundBids = state.roundBids;
      if (action.amount != null) roundBids = [...roundBids, { teamId: action.teamId, amount: action.amount, timestamp: Date.now() }];
      const turnPointer = state.turnPointer + 1;
      const next = { ...state, roundBids, turnPointer };
      return turnPointer >= state.turnOrder.length ? resolveRound(next) : next;
    }
    case 'OPEN_RAISE':
      return { ...state, openHighest: { teamId: action.teamId, amount: action.amount } };
    case 'OPEN_HAMMER':
      return resolveRound(state);
    case 'CONTINUE':
      return advance(state);
    case 'TOURNAMENT_START':
      return { ...state, phase: 'tournament', matches: [] };
    case 'MATCH_PLAYED':
      return { ...state, matches: [...state.matches, action.match] };
    case 'STANDINGS':
      return { ...state, standings: action.standings };
    case 'TOURNAMENT_END':
      return { ...state, standings: action.standings, awards: action.awards, phase: 'awards' };
    case 'DISMISS_TOAST':
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.id) };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

async function simulateOne(match: MatchResult, teams: Team[], mode: RoomConfig['mode'], isKnockout: boolean): Promise<MatchResult> {
  const home = teams.find((t) => t.id === match.homeTeamId)!;
  const away = teams.find((t) => t.id === match.awayTeamId)!;
  const response = await fetch('/api/simulate-match', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ homeTeam: home, awayTeam: away, mode, isKnockout }),
  });
  if (!response.ok) throw new Error('Falha ao simular partida');
  const data = await response.json();
  return { ...match, ...data, played: true };
}

interface LocalGameContextValue {
  state: LocalState;
  requirements: ReturnType<typeof getFormationRequirements>;
  setup(players: LocalPlayerSetup[], config: RoomConfig): void;
  submitBid(teamId: string, amount: number | null): void;
  openRaise(teamId: string, amount: number): void;
  openHammer(): void;
  continueAfterResult(): void;
  startTournament(): void;
  dismissToast(id: string): void;
  reset(): void;
  maxBidFor(team: Team): number;
  canTeamBid(team: Team): boolean;
}

const LocalGameContext = createContext<LocalGameContextValue | null>(null);

export function LocalGameProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const setup = useCallback((players: LocalPlayerSetup[], config: RoomConfig) => {
    dispatch({ type: 'SETUP', players, config });
  }, []);

  const submitBid = useCallback((teamId: string, amount: number | null) => {
    dispatch({ type: 'SUBMIT_BID', teamId, amount });
  }, []);

  const openRaise = useCallback((teamId: string, amount: number) => {
    dispatch({ type: 'OPEN_RAISE', teamId, amount });
  }, []);

  const openHammer = useCallback(() => dispatch({ type: 'OPEN_HAMMER' }), []);
  const continueAfterResult = useCallback(() => dispatch({ type: 'CONTINUE' }), []);
  const dismissToast = useCallback((id: string) => dispatch({ type: 'DISMISS_TOAST', id }), []);
  const reset = useCallback(() => dispatch({ type: 'RESET' }), []);

  const startTournament = useCallback(() => {
    const teams = stateRef.current.teams;
    const config = stateRef.current.config;
    dispatch({ type: 'TOURNAMENT_START' });

    (async () => {
      const allPlayed: MatchResult[] = [];

      async function playAll(matches: MatchResult[], isKnockout: boolean) {
        for (const m of matches) {
          const played = await simulateOne(m, teams, config.mode, isKnockout);
          allPlayed.push(played);
          dispatch({ type: 'MATCH_PLAYED', match: played });
          dispatch({ type: 'STANDINGS', standings: computeStandings(allPlayed, teams) });
        }
      }

      let finalStandings: TournamentStanding[] = [];

      if (config.tournamentFormat === 'league') {
        await playAll(buildLeagueMatches(teams), false);
        finalStandings = computeStandings(allPlayed, teams);
      } else if (config.tournamentFormat === 'knockout') {
        const first = buildKnockoutFirstRound(teams);
        await playAll(first.matches, true);
        let current = first.matches;
        while (current[0]?.round !== 'Final') {
          const next = buildNextKnockoutRound(current, teams);
          if (!next) break;
          await playAll(next.matches, true);
          current = next.matches;
        }
        finalStandings = buildKnockoutFinalStandings(allPlayed, current, teams);
      } else {
        const { matches: groupMatches, groups } = buildWorldCupGroups(teams);
        await playAll(groupMatches, false);
        const qualifiers: string[] = [];
        for (const g of Object.keys(groups)) {
          const table = groupStandings(allPlayed, groups[g], teams);
          qualifiers.push(...table.slice(0, 2).map((t) => t.teamId));
        }
        const qualifiedTeams = teams.filter((t) => qualifiers.includes(t.id));
        const first = buildKnockoutFirstRound(qualifiedTeams);
        const koMatches = first.matches.map((m) => ({ ...m, round: 'Oitavas de final' }));
        await playAll(koMatches, true);
        let current = koMatches;
        while (current[0]?.round !== 'Final') {
          const next = buildNextKnockoutRound(current, teams);
          if (!next) break;
          await playAll(next.matches, true);
          current = next.matches;
        }
        finalStandings = buildKnockoutFinalStandings(allPlayed, current, teams);
      }

      const awards = computeAwards(allPlayed, teams, finalStandings);
      dispatch({ type: 'TOURNAMENT_END', standings: finalStandings, awards });
    })();
  }, []);

  const requirements = getFormationRequirements(state.config);
  const maxBidFor = useCallback((team: Team) => maxAllowedBid(team, requirements), [requirements]);
  const canTeamBid = useCallback(
    (team: Team) => (state.currentPlayer ? canBidOnPosition(team, requirements, state.currentPlayer.position) : false),
    [requirements, state.currentPlayer]
  );

  const value: LocalGameContextValue = {
    state,
    requirements,
    setup,
    submitBid,
    openRaise,
    openHammer,
    continueAfterResult,
    startTournament,
    dismissToast,
    reset,
    maxBidFor,
    canTeamBid,
  };

  return <LocalGameContext.Provider value={value}>{children}</LocalGameContext.Provider>;
}

export function useLocalGame() {
  const ctx = useContext(LocalGameContext);
  if (!ctx) throw new Error('useLocalGame precisa estar dentro de <LocalGameProvider>');
  return ctx;
}
