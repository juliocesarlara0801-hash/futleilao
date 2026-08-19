import React, { useState } from 'react';
import { useGame } from './context/GameContext';
import Home from './components/Home';
import Lobby from './components/Lobby';
import Auction from './components/Auction';
import TeamReview from './components/TeamReview';
import MatchSimulation from './components/MatchSimulation';
import Awards from './components/Awards';
import ToastContainer from './components/ui/ToastContainer';
import LocalRouter from './components/local/LocalRouter';

export default function App() {
  const [mode, setMode] = useState<'online' | 'local'>('online');

  if (mode === 'local') {
    return <LocalRouter onExit={() => setMode('online')} />;
  }

  return <OnlineApp onPlayLocal={() => setMode('local')} />;
}

function OnlineApp({ onPlayLocal }: { onPlayLocal: () => void }) {
  const { state, isHost, startTournament, returnToLobby, dismissToast } = useGame();
  const phase = state.room?.phase;

  return (
    <>
      {!state.connected && (
        <div className="fixed top-0 left-0 right-0 bg-red-600 text-white text-center text-sm py-1 z-[200]">
          Reconectando ao servidor...
        </div>
      )}
      <ToastContainer toasts={state.toasts} onDismiss={dismissToast} />
      {renderScreen(phase, { state, isHost, startTournament, returnToLobby, onPlayLocal })}
    </>
  );
}

function renderScreen(
  phase: string | undefined,
  ctx: {
    state: ReturnType<typeof useGame>['state'];
    isHost: boolean;
    startTournament: () => void;
    returnToLobby: () => void;
    onPlayLocal: () => void;
  }
) {
  switch (phase) {
    case 'lobby':
      return <Lobby />;
    case 'auction':
      return <Auction />;
    case 'review':
      return (
        <TeamReview
          teams={ctx.state.room!.teams.filter((t) => !t.isSpectator)}
          canStart={ctx.isHost}
          onStartTournament={ctx.startTournament}
        />
      );
    case 'tournament':
      return <MatchSimulation matches={ctx.state.liveMatches} standings={ctx.state.liveStandings} />;
    case 'awards':
      return (
        <Awards
          awards={ctx.state.room!.awards}
          standings={ctx.state.room!.standings.length > 0 ? ctx.state.room!.standings : ctx.state.liveStandings}
          onBackToLobby={ctx.isHost ? ctx.returnToLobby : undefined}
        />
      );
    default:
      return <Home onPlayLocal={ctx.onPlayLocal} />;
  }
}
