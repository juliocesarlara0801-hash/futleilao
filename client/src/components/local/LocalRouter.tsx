import React from 'react';
import { LocalGameProvider, useLocalGame } from '../../context/LocalGameContext';
import LocalSetup from './LocalSetup';
import LocalAuction from './LocalAuction';
import TeamReview from '../TeamReview';
import MatchSimulation from '../MatchSimulation';
import Awards from '../Awards';
import ToastContainer from '../ui/ToastContainer';

function LocalScreens({ onExit }: { onExit: () => void }) {
  const { state, dismissToast, startTournament } = useLocalGame();

  return (
    <>
      <ToastContainer toasts={state.toasts} onDismiss={dismissToast} />
      {(() => {
        switch (state.phase) {
          case 'setup':
            return <LocalSetup onExit={onExit} />;
          case 'auction':
            return <LocalAuction />;
          case 'review':
            return <TeamReview teams={state.teams} canStart onStartTournament={startTournament} startLabel="🏁 Iniciar Torneio" />;
          case 'tournament':
            return <MatchSimulation matches={state.matches} standings={state.standings} />;
          case 'awards':
            return <Awards awards={state.awards} standings={state.standings} />;
          default:
            return null;
        }
      })()}
    </>
  );
}

export default function LocalRouter({ onExit }: { onExit: () => void }) {
  return (
    <LocalGameProvider>
      <LocalScreens onExit={onExit} />
    </LocalGameProvider>
  );
}
