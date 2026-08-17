// Teste end-to-end: simula 2 jogadores criando sala, leiloando, e rodando o torneio inteiro.
import { io } from 'socket.io-client';

const URL = 'http://localhost:3001';
const log = (who, ...args) => console.log(`[${who}]`, ...args);

function connect(name) {
  return new Promise((resolve) => {
    const s = io(URL, { transports: ['websocket'] });
    s.on('connect', () => resolve(s));
  });
}

async function main() {
  const host = await connect('host');
  const p2 = await connect('p2');

  let roomCode;
  await new Promise((resolve, reject) => {
    host.emit(
      'create_room',
      { hostName: 'Julio', teamName: 'Galacticos', mode: 'futsal', config: { budget: 20, bidTimer: 2, tournamentFormat: 'league' } },
      (res) => {
        if (!res.ok) return reject(new Error(res.error));
        roomCode = res.roomCode;
        log('host', 'sala criada', roomCode);
        resolve();
      }
    );
  });

  await new Promise((resolve, reject) => {
    p2.emit('join_room', { roomCode, playerName: 'Amigo', teamName: 'Rivais FC' }, (res) => {
      if (!res.ok) return reject(new Error(res.error));
      log('p2', 'entrou na sala');
      resolve();
    });
  });

  host.emit('player_ready', { roomCode }); // host auto-ready? vamos garantir ambos prontos
  p2.emit('player_ready', { roomCode });

  let auctionErrors = 0;
  let bidsPlaced = 0;
  let allComplete = false;

  function autoBid(socket, who) {
    socket.on('reveal_player', (payload) => {
      const amount = 1;
      setTimeout(() => {
        socket.emit('place_bid', { roomCode, amount }, (res) => {
          bidsPlaced++;
          if (!res.ok && !res.error?.includes('completa') && !res.error?.includes('saldo')) {
            auctionErrors++;
            log(who, 'ERRO lance:', res.error, 'jogador:', payload.player.name);
          }
        });
      }, 100);
    });
  }
  autoBid(host, 'host');
  autoBid(p2, 'p2');

  host.on('all_teams_complete', () => {
    allComplete = true;
    log('host', 'TODOS OS TIMES COMPLETOS ✅');
  });

  [host, p2].forEach((s, i) => {
    s.on('bid_result', (r) => log(i === 0 ? 'host' : 'p2', 'bid_result', r.player.name, '->', r.winnerTeamName ?? 'ninguém', r.amount));
    s.on('auto_assign', (r) => log(i === 0 ? 'host' : 'p2', 'auto_assign', r.player.name, '->', r.teamName));
  });

  setTimeout(() => {
    log('host', 'iniciando leilão...');
    host.emit('start_auction', { roomCode });
  }, 500);

  // espera o leilão terminar (timeout de segurança)
  const start = Date.now();
  while (!allComplete && Date.now() - start < 90000) {
    await new Promise((r) => setTimeout(r, 300));
  }
  if (!allComplete) throw new Error('Leilão não terminou a tempo');
  log('host', `Leilão OK. Lances processados: ${bidsPlaced}, erros inesperados: ${auctionErrors}`);

  let tournamentEnded = false;
  host.on('tournament_end', (payload) => {
    tournamentEnded = true;
    log('host', 'TORNEIO ENCERRADO 🏆', JSON.stringify(payload.standings.map((s) => `${s.teamName}:${s.points}`)));
    log('host', 'Premiações:', payload.awards.map((a) => `${a.type}=${a.winner}`).join(', '));
  });
  host.on('match_result', (r) => log('host', 'match_result', r.match.homeTeamName, r.match.homeGoals, 'x', r.match.awayGoals, r.match.awayTeamName));

  setTimeout(() => {
    log('host', 'iniciando torneio...');
    host.emit('start_tournament', { roomCode });
  }, 500);

  const start2 = Date.now();
  while (!tournamentEnded && Date.now() - start2 < 90000) {
    await new Promise((r) => setTimeout(r, 300));
  }
  if (!tournamentEnded) throw new Error('Torneio não terminou a tempo');

  log('host', 'TESTE COMPLETO COM SUCESSO ✅✅✅');
  process.exit(0);
}

main().catch((err) => {
  console.error('TESTE FALHOU ❌', err);
  process.exit(1);
});
