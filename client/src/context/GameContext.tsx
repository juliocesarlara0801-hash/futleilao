import React, { createContext, useCallback, useContext, useEffect, useReducer, useRef } from 'react';
import { getSocket } from '../hooks/useSocket';
import type {
  AuctionPlayerState,
  AutoAssignPayload,
  Award,
  BidResultPayload,
  ChatMessage,
  GameMode,
  MatchEvent,
  MatchResult,
  Player,
  RoomConfig,
  TournamentStanding,
} from '../types';
import type { RoomSnapshot, Toast } from '../types/client';

interface OpenBidState {
  teamId: string;
  teamName: string;
  amount: number;
}

interface GameState {
  connected: boolean;
  roomCode: string | null;
  myTeamId: string | null;
  qrCode: string | null;
  room: RoomSnapshot | null;
  currentAuctionPlayer: AuctionPlayerState | null;
  secondsLeft: number;
  lastBidResult: BidResultPayload | null;
  openBid: OpenBidState | null;
  toasts: Toast[];
  chat: ChatMessage[];
  liveMatches: MatchResult[];
  liveStandings: TournamentStanding[];
  narrationCache: Record<string, MatchEvent[]>;
  error: string | null;
}

const initialState: GameState = {
  connected: false,
  roomCode: null,
  myTeamId: null,
  qrCode: null,
  room: null,
  currentAuctionPlayer: null,
  secondsLeft: 0,
  lastBidResult: null,
  openBid: null,
  toasts: [],
  chat: [],
  liveMatches: [],
  liveStandings: [],
  narrationCache: {},
  error: null,
};

type Action =
  | { type: 'CONNECTED'; connected: boolean }
  | { type: 'JOINED'; roomCode: string; teamId: string; room: RoomSnapshot; qrCode?: string }
  | { type: 'ROOM_STATE'; room: RoomSnapshot }
  | { type: 'REVEAL_PLAYER'; payload: AuctionPlayerState }
  | { type: 'TIMER_TICK'; secondsLeft: number }
  | { type: 'BID_RESULT'; payload: BidResultPayload }
  | { type: 'OPEN_BID'; payload: OpenBidState }
  | { type: 'AUTO_ASSIGN'; payload: AutoAssignPayload }
  | { type: 'TOAST'; message: string; kind?: Toast['kind'] }
  | { type: 'CHAT'; message: ChatMessage }
  | { type: 'MATCH_RESULT'; match: MatchResult }
  | { type: 'STANDINGS_UPDATE'; standings: TournamentStanding[] }
  | { type: 'TOURNAMENT_END'; standings: TournamentStanding[]; awards: Award[] }
  | { type: 'NARRATION'; matchId: string; events: MatchEvent[] }
  | { type: 'ERROR'; error: string | null }
  | { type: 'DISMISS_TOAST'; id: string }
  | { type: 'LEAVE' };

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'CONNECTED':
      return { ...state, connected: action.connected };
    case 'JOINED':
      return { ...state, roomCode: action.roomCode, myTeamId: action.teamId, room: action.room, qrCode: action.qrCode ?? state.qrCode };
    case 'ROOM_STATE':
      return { ...state, room: action.room, roomCode: action.room.code };
    case 'REVEAL_PLAYER':
      return { ...state, currentAuctionPlayer: action.payload, lastBidResult: null, openBid: null };
    case 'TIMER_TICK':
      return { ...state, secondsLeft: action.secondsLeft };
    case 'BID_RESULT':
      return { ...state, lastBidResult: action.payload, currentAuctionPlayer: null };
    case 'OPEN_BID':
      return { ...state, openBid: action.payload };
    case 'AUTO_ASSIGN':
      return state;
    case 'TOAST': {
      const toast: Toast = { id: crypto.randomUUID(), message: action.message, kind: action.kind ?? 'info' };
      return { ...state, toasts: [...state.toasts, toast].slice(-5) };
    }
    case 'CHAT':
      return { ...state, chat: [...state.chat, action.message].slice(-200) };
    case 'MATCH_RESULT':
      return { ...state, liveMatches: [...state.liveMatches, action.match] };
    case 'STANDINGS_UPDATE':
      return { ...state, liveStandings: action.standings };
    case 'TOURNAMENT_END':
      return { ...state, liveStandings: action.standings };
    case 'NARRATION':
      return { ...state, narrationCache: { ...state.narrationCache, [action.matchId]: action.events } };
    case 'ERROR':
      return { ...state, error: action.error };
    case 'DISMISS_TOAST':
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.id) };
    case 'LEAVE':
      return { ...initialState, connected: state.connected };
    default:
      return state;
  }
}

interface GameContextValue {
  state: GameState;
  createRoom(payload: { hostName: string; teamName: string; mode: GameMode; config: Partial<RoomConfig> }): Promise<{ ok: boolean; error?: string; qrCode?: string }>;
  joinRoom(payload: { roomCode: string; playerName: string; teamName: string; spectator?: boolean }): Promise<{ ok: boolean; error?: string }>;
  toggleReady(): void;
  updateConfig(config: Partial<RoomConfig>): void;
  startAuction(): void;
  placeBid(amount: number): Promise<{ ok: boolean; error?: string }>;
  passBid(): void;
  vetoPurchase(targetTeamId: string, playerId: string): void;
  sendChat(message: string): void;
  startTournament(): void;
  requestMatchDetails(matchId: string): void;
  dismissToast(id: string): void;
  myTeam: RoomSnapshot['teams'][number] | null;
  isHost: boolean;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const socketRef = useRef(getSocket());

  useEffect(() => {
    const socket = socketRef.current;
    const onConnect = () => dispatch({ type: 'CONNECTED', connected: true });
    const onDisconnect = () => dispatch({ type: 'CONNECTED', connected: false });
    const onRoomState = (room: RoomSnapshot) => dispatch({ type: 'ROOM_STATE', room });
    const onReveal = (payload: AuctionPlayerState) => dispatch({ type: 'REVEAL_PLAYER', payload });
    const onTimer = (payload: { secondsLeft: number }) => dispatch({ type: 'TIMER_TICK', secondsLeft: payload.secondsLeft });
    const onBidResult = (payload: BidResultPayload) => dispatch({ type: 'BID_RESULT', payload });
    const onOpenBid = (payload: OpenBidState) => dispatch({ type: 'OPEN_BID', payload });
    const onAutoAssign = (payload: AutoAssignPayload) => {
      dispatch({ type: 'AUTO_ASSIGN', payload });
      dispatch({ type: 'TOAST', message: `🎲 ${payload.player.name} distribuído automaticamente para ${payload.teamName} por R$ 1!`, kind: 'info' });
    };
    const onTeamComplete = (payload: { teamName: string }) =>
      dispatch({ type: 'TOAST', message: `✅ ${payload.teamName} completou o elenco!`, kind: 'success' });
    const onChat = (message: ChatMessage) => dispatch({ type: 'CHAT', message });
    const onMatchResult = (payload: { match: MatchResult }) => dispatch({ type: 'MATCH_RESULT', match: payload.match });
    const onStandings = (payload: { standings: TournamentStanding[] }) => dispatch({ type: 'STANDINGS_UPDATE', standings: payload.standings });
    const onTournamentEnd = (payload: { standings: TournamentStanding[]; awards: Award[] }) =>
      dispatch({ type: 'TOURNAMENT_END', standings: payload.standings, awards: payload.awards });
    const onNarration = (payload: { matchId: string; events: MatchEvent[] }) => dispatch({ type: 'NARRATION', matchId: payload.matchId, events: payload.events });
    const onPlayerJoined = () => {};

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('room_state', onRoomState);
    socket.on('reveal_player', onReveal);
    socket.on('timer_tick', onTimer);
    socket.on('bid_result', onBidResult);
    socket.on('open_bid_update', onOpenBid);
    socket.on('auto_assign', onAutoAssign);
    socket.on('team_complete', onTeamComplete);
    socket.on('chat_message', onChat);
    socket.on('match_result', onMatchResult);
    socket.on('standings_update', onStandings);
    socket.on('tournament_end', onTournamentEnd);
    socket.on('match_narration', onNarration);
    socket.on('player_joined', onPlayerJoined);

    if (socket.connected) dispatch({ type: 'CONNECTED', connected: true });

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('room_state', onRoomState);
      socket.off('reveal_player', onReveal);
      socket.off('timer_tick', onTimer);
      socket.off('bid_result', onBidResult);
      socket.off('open_bid_update', onOpenBid);
      socket.off('auto_assign', onAutoAssign);
      socket.off('team_complete', onTeamComplete);
      socket.off('chat_message', onChat);
      socket.off('match_result', onMatchResult);
      socket.off('standings_update', onStandings);
      socket.off('tournament_end', onTournamentEnd);
      socket.off('match_narration', onNarration);
      socket.off('player_joined', onPlayerJoined);
    };
  }, []);

  const createRoom = useCallback((payload: { hostName: string; teamName: string; mode: GameMode; config: Partial<RoomConfig> }) => {
    return new Promise<{ ok: boolean; error?: string; qrCode?: string }>((resolve) => {
      socketRef.current.emit('create_room', payload, (res: any) => {
        if (res.ok)
          dispatch({
            type: 'JOINED',
            roomCode: res.roomCode,
            teamId: res.hostTeamId,
            room: { code: res.roomCode } as RoomSnapshot,
            qrCode: res.qrCode,
          });
        resolve(res);
      });
    });
  }, []);

  const joinRoom = useCallback((payload: { roomCode: string; playerName: string; teamName: string; spectator?: boolean }) => {
    return new Promise<{ ok: boolean; error?: string }>((resolve) => {
      const roomCode = payload.roomCode.trim().toUpperCase();
      socketRef.current.emit('join_room', { ...payload, roomCode }, (res: any) => {
        if (res.ok) dispatch({ type: 'JOINED', roomCode, teamId: res.teamId, room: res.room });
        resolve(res);
      });
    });
  }, []);

  const toggleReady = useCallback(() => {
    if (!state.roomCode) return;
    socketRef.current.emit('player_ready', { roomCode: state.roomCode });
  }, [state.roomCode]);

  const updateConfig = useCallback(
    (config: Partial<RoomConfig>) => {
      if (!state.roomCode) return;
      socketRef.current.emit('update_config', { roomCode: state.roomCode, config });
    },
    [state.roomCode]
  );

  const startAuction = useCallback(() => {
    if (!state.roomCode) return;
    socketRef.current.emit('start_auction', { roomCode: state.roomCode });
  }, [state.roomCode]);

  const placeBid = useCallback(
    (amount: number) => {
      return new Promise<{ ok: boolean; error?: string }>((resolve) => {
        if (!state.roomCode) return resolve({ ok: false, error: 'Sem sala ativa' });
        socketRef.current.emit('place_bid', { roomCode: state.roomCode, amount }, (res: any) => resolve(res));
      });
    },
    [state.roomCode]
  );

  const passBid = useCallback(() => {
    if (!state.roomCode) return;
    socketRef.current.emit('pass_bid', { roomCode: state.roomCode });
  }, [state.roomCode]);

  const vetoPurchase = useCallback(
    (targetTeamId: string, playerId: string) => {
      if (!state.roomCode) return;
      socketRef.current.emit('veto_purchase', { roomCode: state.roomCode, targetTeamId, playerId });
    },
    [state.roomCode]
  );

  const sendChat = useCallback(
    (message: string) => {
      if (!state.roomCode) return;
      socketRef.current.emit('chat_message', { roomCode: state.roomCode, message });
    },
    [state.roomCode]
  );

  const startTournament = useCallback(() => {
    if (!state.roomCode) return;
    socketRef.current.emit('start_tournament', { roomCode: state.roomCode });
  }, [state.roomCode]);

  const requestMatchDetails = useCallback(
    (matchId: string) => {
      if (!state.roomCode) return;
      socketRef.current.emit('request_match_details', { roomCode: state.roomCode, matchId });
    },
    [state.roomCode]
  );

  const dismissToast = useCallback((id: string) => {
    dispatch({ type: 'DISMISS_TOAST', id });
  }, []);

  const myTeam = state.room?.teams.find((t) => t.id === state.myTeamId) ?? null;
  const isHost = !!myTeam?.isHost;

  const value: GameContextValue = {
    state,
    createRoom,
    joinRoom,
    toggleReady,
    updateConfig,
    startAuction,
    placeBid,
    passBid,
    vetoPurchase,
    sendChat,
    startTournament,
    requestMatchDetails,
    dismissToast,
    myTeam,
    isHost,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame precisa estar dentro de <GameProvider>');
  return ctx;
}
