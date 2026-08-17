// Teste E2E do formato mata-mata (4 times) para validar progressão de chaveamento.
import { io } from 'socket.io-client';

const URL = 'http://localhost:3001';
const log = (who, ...args) => console.log(`[${who}]`, ...args);

function connect() {
  return new Promise((resolve) => {
    const s = io(URL, { transports: ['websocket'] });
    s.on('connect', () => resolve(s));
  });
}

async function main() {
  const sockets = await Promise.all([connect(), connect(), connect(), connect()]);
  const [host, p2, p3, p4] = sockets;

  let roomCode;
  await new Promise((resolve, reject) => {
    host.emit(
      'create_room',
      { hostName: 'H', teamName: 'Time1', mode: 'futsal', config: { budget: 20, bidTimer: 2, tournamentFormat: 'knockout' } },
      (res) => (res.ok ? (resolve((roomCode = res.roomCode)), log('host', 'sala', roomCode)) : reject(new Error(res.error)))
    );
  });

  for (const [i, s] of [p2, p3, p4].entries()) {
    await new Promise((resolve, reject) => {
      s.emit('join_room', { roomCode, playerName: `P${i + 2}`, teamName: `Time${i + 2}` }, (res) => (res.ok ? resolve() : reject(new Error(res.error))));
    });
  }
  log('host', '4 times na sala');

  sockets.forEach((s) => {
    s.on('reveal_player', () => {
      setTimeout(() => s.emit('place_bid', { roomCode, amount: 1 }, () => {}), 100);
    });
  });

  let allComplete = false;
  host.on('all_teams_complete', () => (allComplete = true));
  host.emit('start_auction', { roomCode });

  const t0 = Date.now();
  while (!allComplete && Date.now() - t0 < 120000) await new Promise((r) => setTimeout(r, 300));
  if (!allComplete) throw new Error('leilão não terminou');
  log('host', 'leilão OK, iniciando torneio mata-mata');

  let ended = false;
  host.on('match_result', (r) =>
    log('host', r.match.round, '-', r.match.homeTeamName, r.match.homeGoals, 'x', r.match.awayGoals, r.match.awayTeamName, r.match.penaltyWinner ? `(pen: ${r.match.penaltyWinner})` : '')
  );
  host.on('tournament_end', (payload) => {
    ended = true;
    log('host', 'FIM 🏆', payload.standings.map((s) => s.teamName).join(' > '));
    log('host', 'Premiações:', payload.awards.map((a) => `${a.type}=${a.winner}`).join(', '));
  });

  host.emit('start_tournament', { roomCode });
  const t1 = Date.now();
  while (!ended && Date.now() - t1 < 60000) await new Promise((r) => setTimeout(r, 300));
  if (!ended) throw new Error('torneio não terminou');

  log('host', 'TESTE MATA-MATA OK ✅✅✅');
  process.exit(0);
}

main().catch((err) => {
  console.error('FALHOU ❌', err);
  process.exit(1);
});
