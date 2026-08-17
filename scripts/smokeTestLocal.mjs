// Valida a lógica do modo "mesmo aparelho" (hot-seat) rodando as MESMAS funções puras
// que o LocalGameContext usa no navegador (client/src/game/*.ts), fora do React, e
// chamando o servidor de verdade em /api/simulate-match pra simular as partidas.
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
} from '../client/src/game/localAuction.ts';
import {
  buildKnockoutFinalStandings,
  buildKnockoutFirstRound,
  buildLeagueMatches,
  buildNextKnockoutRound,
  buildWorldCupGroups,
  computeAwards,
  computeStandings,
  groupStandings,
} from '../client/src/game/localTournament.ts';
import { ALL_PLAYERS } from '../client/src/data/players.ts';

const POSITIONS = ['atacante', 'meia', 'defensor', 'goleiro'];

function mkTeam(ownerName, teamName, budget) {
  return {
    id: crypto.randomUUID(),
    socketId: null,
    ownerName,
    teamName,
    players: [],
    budget,
    spent: 0,
    isHost: false,
    isReady: true,
    isSpectator: false,
    vetoUsed: false,
    connected: true,
  };
}

function runAuction(teams, config) {
  const requirements = getFormationRequirements(config);
  let pool = generatePool(ALL_PLAYERS, requirements, teams.length);
  if (config.jokersEnabled) pool = applyJokers(pool);
  let revealQueue = [...pool];
  let rounds = 0;

  function autoAssignLoop() {
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
          const team = teams.find((t) => t.id === a.teamId);
          const amt = Math.min(1, team.budget);
          team.players.push(player);
          team.budget -= amt;
          team.spent += amt;
        }
        changed = true;
      }
    }
  }

  autoAssignLoop();
  while (true) {
    const allComplete = teams.every((t) => remainingVacancies(t, requirements) <= 0);
    if (allComplete || revealQueue.length === 0) break;

    while (revealQueue.length > 0) {
      const candidate = revealQueue[0];
      const eligible = teams.filter((t) => canBidOnPosition(t, requirements, candidate.position));
      if (eligible.length > 0) break;
      revealQueue = revealQueue.slice(1);
    }
    if (revealQueue.length === 0) break;

    const player = revealQueue[0];
    revealQueue = revealQueue.slice(1);
    const eligible = shuffle(teams.filter((t) => canBidOnPosition(t, requirements, player.position)));
    rounds++;

    // cada time elegível dá lance de R$1 (equivalente ao smokeTest.mjs online)
    const bids = eligible.map((t) => ({ teamId: t.id, amount: 1, timestamp: Date.now() }));
    const resolution = resolveBids(bids, teams, player.position);
    if (resolution.winnerTeamId) {
      const team = teams.find((t) => t.id === resolution.winnerTeamId);
      team.players.push(player);
      team.budget -= resolution.amount;
      team.spent += resolution.amount;
    }
    autoAssignLoop();
  }

  const requirementsTotal = Object.values(requirements).reduce((a, b) => a + b, 0);
  for (const t of teams) {
    if (t.players.length !== requirementsTotal) {
      throw new Error(`Time ${t.teamName} terminou com ${t.players.length} jogadores, esperado ${requirementsTotal}`);
    }
    const posCounts = POSITIONS.map((p) => `${p}:${t.players.filter((pl) => pl.position === p).length}/${requirements[p]}`).join(' ');
    console.log(`  ${t.teamName}: ${posCounts} | gasto R$${t.spent} | saldo R$${t.budget}`);
  }
  console.log(`  (${rounds} rodadas de leilão, pool de ${pool.length})`);
  return teams;
}

async function simulateOne(match, teams, mode, isKnockout) {
  const home = teams.find((t) => t.id === match.homeTeamId);
  const away = teams.find((t) => t.id === match.awayTeamId);
  const res = await fetch('http://localhost:3001/api/simulate-match', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ homeTeam: home, awayTeam: away, mode, isKnockout }),
  });
  if (!res.ok) throw new Error(`simulate-match falhou: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return { ...match, ...data, played: true };
}

async function playAll(matches, isKnockout, allPlayed, teams, mode) {
  for (const m of matches) {
    const played = await simulateOne(m, teams, mode, isKnockout);
    allPlayed.push(played);
    console.log(`  [${played.round}] ${played.homeTeamName} ${played.homeGoals} x ${played.awayGoals} ${played.awayTeamName}${played.penaltyWinner ? ` (pen: ${played.penaltyWinner})` : ''}`);
  }
}

async function runTournament(teams, config) {
  const allPlayed = [];
  let finalStandings;

  if (config.tournamentFormat === 'league') {
    await playAll(buildLeagueMatches(teams), false, allPlayed, teams, config.mode);
    finalStandings = computeStandings(allPlayed, teams);
  } else if (config.tournamentFormat === 'knockout') {
    const first = buildKnockoutFirstRound(teams);
    await playAll(first.matches, true, allPlayed, teams, config.mode);
    let current = first.matches;
    while (current[0]?.round !== 'Final') {
      const next = buildNextKnockoutRound(current, teams);
      if (!next) break;
      await playAll(next.matches, true, allPlayed, teams, config.mode);
      current = next.matches;
    }
    finalStandings = buildKnockoutFinalStandings(allPlayed, current, teams);
  } else {
    const { matches: groupMatches, groups } = buildWorldCupGroups(teams);
    await playAll(groupMatches, false, allPlayed, teams, config.mode);
    const qualifiers = [];
    for (const g of Object.keys(groups)) {
      const table = groupStandings(allPlayed, groups[g], teams);
      qualifiers.push(...table.slice(0, 2).map((t) => t.teamId));
    }
    const qualifiedTeams = teams.filter((t) => qualifiers.includes(t.id));
    const first = buildKnockoutFirstRound(qualifiedTeams);
    const koMatches = first.matches.map((m) => ({ ...m, round: 'Oitavas de final' }));
    await playAll(koMatches, true, allPlayed, teams, config.mode);
    let current = koMatches;
    while (current[0]?.round !== 'Final') {
      const next = buildNextKnockoutRound(current, teams);
      if (!next) break;
      await playAll(next.matches, true, allPlayed, teams, config.mode);
      current = next.matches;
    }
    finalStandings = buildKnockoutFinalStandings(allPlayed, current, teams);
  }

  const awards = computeAwards(allPlayed, teams, finalStandings);
  console.log('  Classificação final:', finalStandings.map((s) => `${s.teamName}(${s.points}pts)`).join(' > '));
  console.log('  Premiações:', awards.map((a) => `${a.type}=${a.winner}`).join(', '));
}

async function main() {
  console.log('=== Teste 1: futsal, 3 times, pontos corridos, lance fechado ===');
  const teams1 = [mkTeam('Ana', 'Time A', 20), mkTeam('Bia', 'Time B', 20), mkTeam('Caio', 'Time C', 20)];
  runAuction(teams1, { mode: 'futsal', formation: 'futsal', budget: 20, tournamentFormat: 'league', auctionStyle: 'sealed', jokersEnabled: false });
  await runTournament(teams1, { mode: 'futsal', tournamentFormat: 'league' });

  console.log('\n=== Teste 2: completo 4-4-2, 4 times, mata-mata, com coringas ===');
  const teams2 = [mkTeam('D', 'D FC', 50), mkTeam('E', 'E FC', 50), mkTeam('F', 'F FC', 50), mkTeam('G', 'G FC', 50)];
  runAuction(teams2, { mode: 'full', formation: '4-4-2', budget: 50, tournamentFormat: 'knockout', auctionStyle: 'sealed', jokersEnabled: true });
  await runTournament(teams2, { mode: 'full', tournamentFormat: 'knockout' });

  console.log('\nTESTE LOCAL COMPLETO COM SUCESSO ✅✅✅');
}

main().catch((err) => {
  console.error('TESTE LOCAL FALHOU ❌', err);
  process.exit(1);
});
