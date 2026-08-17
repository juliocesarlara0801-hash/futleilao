// Espelha server/src/game/tournament.ts — roda 100% no navegador pro modo "mesmo aparelho" (hot-seat).
import type { Award, AwardType, BracketRound, MatchEvent, MatchResult, Team, TournamentStanding } from '../types';
import { shuffle } from './localAuction';

export interface ScheduledMatch {
  id: string;
  round: string;
  homeTeamId: string;
  awayTeamId: string;
}

function emptyMatch(sm: ScheduledMatch, teams: Team[]): MatchResult {
  const home = teams.find((t) => t.id === sm.homeTeamId)!;
  const away = teams.find((t) => t.id === sm.awayTeamId)!;
  return {
    id: sm.id,
    round: sm.round,
    homeTeamId: sm.homeTeamId,
    awayTeamId: sm.awayTeamId,
    homeTeamName: home.teamName,
    awayTeamName: away.teamName,
    homeGoals: 0,
    awayGoals: 0,
    events: [],
    extraTime: null,
    penalties: null,
    penaltyWinner: null,
    manOfTheMatch: '',
    narration: '',
    played: false,
  };
}

export function buildLeagueMatches(teams: Team[]): MatchResult[] {
  const scheduled: ScheduledMatch[] = [];
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      scheduled.push({ id: crypto.randomUUID(), round: 'Fase única', homeTeamId: teams[i].id, awayTeamId: teams[j].id });
    }
  }
  return shuffle(scheduled).map((sm) => emptyMatch(sm, teams));
}

export function buildKnockoutFirstRound(teams: Team[]): { matches: MatchResult[]; bracket: BracketRound[] } {
  const playable = shuffle(teams);
  const roundName = playable.length === 8 ? 'Quartas de final' : playable.length === 4 ? 'Semifinal' : 'Mata-mata';
  const scheduled: ScheduledMatch[] = [];
  for (let i = 0; i < playable.length; i += 2) {
    scheduled.push({ id: crypto.randomUUID(), round: roundName, homeTeamId: playable[i].id, awayTeamId: playable[i + 1].id });
  }
  const matches = scheduled.map((sm) => emptyMatch(sm, teams));
  return { matches, bracket: [{ name: roundName, matchIds: matches.map((m) => m.id) }] };
}

const NEXT_ROUND_NAME: Record<string, string> = {
  'Quartas de final': 'Semifinal',
  Semifinal: 'Final',
  'Oitavas de final': 'Quartas de final',
};

export function buildNextKnockoutRound(previousRoundMatches: MatchResult[], teams: Team[]): { matches: MatchResult[]; roundName: string } | null {
  const roundName = NEXT_ROUND_NAME[previousRoundMatches[0].round];
  if (!roundName) return null;

  const winners = shuffle(previousRoundMatches.map((m) => winnerOf(m)));
  const scheduled: ScheduledMatch[] = [];
  for (let i = 0; i < winners.length; i += 2) {
    scheduled.push({ id: crypto.randomUUID(), round: roundName, homeTeamId: winners[i], awayTeamId: winners[i + 1] });
  }
  return { matches: scheduled.map((sm) => emptyMatch(sm, teams)), roundName };
}

export function winnerOf(match: MatchResult): string {
  if (match.penaltyWinner) return match.penaltyWinner === 'home' ? match.homeTeamId : match.awayTeamId;
  if (match.extraTime) {
    const hg = match.homeGoals + match.extraTime.homeGoals;
    const ag = match.awayGoals + match.extraTime.awayGoals;
    return hg >= ag ? match.homeTeamId : match.awayTeamId;
  }
  return match.homeGoals >= match.awayGoals ? match.homeTeamId : match.awayTeamId;
}

export function buildWorldCupGroups(teams: Team[]): { matches: MatchResult[]; groups: Record<string, string[]> } {
  const playable = shuffle(teams);
  const groupNames = ['A', 'B', 'C', 'D'];
  const groups: Record<string, string[]> = { A: [], B: [], C: [], D: [] };
  playable.forEach((t, i) => groups[groupNames[i % 4]].push(t.id));

  const matches: MatchResult[] = [];
  for (const g of groupNames) {
    const ids = groups[g];
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        matches.push(emptyMatch({ id: crypto.randomUUID(), round: `Grupo ${g}`, homeTeamId: ids[i], awayTeamId: ids[j] }, teams));
      }
    }
  }
  return { matches: shuffle(matches), groups };
}

export function groupStandings(matches: MatchResult[], teamIds: string[], teams: Team[]): TournamentStanding[] {
  return computeStandings(
    matches.filter((m) => teamIds.includes(m.homeTeamId) && teamIds.includes(m.awayTeamId)),
    teams.filter((t) => teamIds.includes(t.id))
  );
}

export function computeStandings(matches: MatchResult[], teams: Team[]): TournamentStanding[] {
  const table = new Map<string, TournamentStanding>();
  for (const t of teams) {
    table.set(t.id, {
      teamId: t.id,
      teamName: t.teamName,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
    });
  }

  for (const m of matches.filter((m) => m.played)) {
    const home = table.get(m.homeTeamId);
    const away = table.get(m.awayTeamId);
    if (!home || !away) continue;
    home.played++;
    away.played++;
    home.goalsFor += m.homeGoals;
    home.goalsAgainst += m.awayGoals;
    away.goalsFor += m.awayGoals;
    away.goalsAgainst += m.homeGoals;

    if (m.homeGoals > m.awayGoals) {
      home.won++;
      home.points += 3;
      away.lost++;
    } else if (m.homeGoals < m.awayGoals) {
      away.won++;
      away.points += 3;
      home.lost++;
    } else {
      home.drawn++;
      away.drawn++;
      home.points += 1;
      away.points += 1;
    }
  }

  for (const s of table.values()) s.goalDifference = s.goalsFor - s.goalsAgainst;

  const headToHead = (aId: string, bId: string): number => {
    const direct = matches.filter(
      (m) => m.played && ((m.homeTeamId === aId && m.awayTeamId === bId) || (m.homeTeamId === bId && m.awayTeamId === aId))
    );
    let aPts = 0;
    let bPts = 0;
    for (const m of direct) {
      const aIsHome = m.homeTeamId === aId;
      const aGoals = aIsHome ? m.homeGoals : m.awayGoals;
      const bGoals = aIsHome ? m.awayGoals : m.homeGoals;
      if (aGoals > bGoals) aPts += 3;
      else if (bGoals > aGoals) bPts += 3;
      else {
        aPts += 1;
        bPts += 1;
      }
    }
    return aPts - bPts;
  };

  return [...table.values()].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return headToHead(a.teamId, b.teamId) !== 0 ? -headToHead(a.teamId, b.teamId) : 0;
  });
}

interface PlayerAggregate {
  name: string;
  teamId: string;
  teamName: string;
  goals: number;
  assists: number;
  saves: number;
  matchScore: number;
}

function aggregatePlayers(matches: MatchResult[], teams: Team[]): Map<string, PlayerAggregate> {
  const agg = new Map<string, PlayerAggregate>();
  const teamOf = (teamId: string, playerName: string) => {
    if (!agg.has(playerName)) {
      const team = teams.find((t) => t.id === teamId);
      agg.set(playerName, { name: playerName, teamId, teamName: team?.teamName ?? '', goals: 0, assists: 0, saves: 0, matchScore: 0 });
    }
    return agg.get(playerName)!;
  };

  for (const m of matches.filter((mm) => mm.played)) {
    const allEvents: MatchEvent[] = [...m.events, ...(m.extraTime?.events ?? [])];
    for (const ev of allEvents) {
      const teamId = ev.team === 'home' ? m.homeTeamId : m.awayTeamId;
      if (ev.type === 'goal') {
        teamOf(teamId, ev.player).goals++;
        teamOf(teamId, ev.player).matchScore += 4;
        if (ev.assist) {
          teamOf(teamId, ev.assist).assists++;
          teamOf(teamId, ev.assist).matchScore += 2;
        }
      } else if (ev.type === 'save') {
        teamOf(teamId, ev.player).saves++;
        teamOf(teamId, ev.player).matchScore += 1;
      }
    }
    if (m.manOfTheMatch) {
      const motmTeam = allEvents.find((e) => e.player === m.manOfTheMatch);
      const teamId = motmTeam ? (motmTeam.team === 'home' ? m.homeTeamId : m.awayTeamId) : m.homeTeamId;
      teamOf(teamId, m.manOfTheMatch).matchScore += 3;
    }
  }
  return agg;
}

export function computeAwards(matches: MatchResult[], teams: Team[], finalStandings: TournamentStanding[]): Award[] {
  const awards: Award[] = [];
  const agg = aggregatePlayers(matches, teams);
  const list = [...agg.values()];

  if (finalStandings[0]) awards.push({ type: 'champion', winner: finalStandings[0].teamName, teamName: finalStandings[0].teamName });
  if (finalStandings[1]) awards.push({ type: 'runnerUp', winner: finalStandings[1].teamName, teamName: finalStandings[1].teamName });
  if (finalStandings[2]) awards.push({ type: 'third', winner: finalStandings[2].teamName, teamName: finalStandings[2].teamName });

  const topScorer = [...list].sort((a, b) => b.goals - a.goals)[0];
  if (topScorer && topScorer.goals > 0) {
    awards.push({ type: 'goldenBoot', winner: topScorer.name, teamName: topScorer.teamName, stat: topScorer.goals, description: `${topScorer.goals} gols` });
  }

  const topAssist = [...list].sort((a, b) => b.assists - a.assists)[0];
  if (topAssist && topAssist.assists > 0) {
    awards.push({ type: 'assistKing', winner: topAssist.name, teamName: topAssist.teamName, stat: topAssist.assists, description: `${topAssist.assists} assistências` });
  }

  const topGk = [...list].sort((a, b) => b.saves - a.saves)[0];
  if (topGk && topGk.saves > 0) {
    awards.push({ type: 'goldenGlove', winner: topGk.name, teamName: topGk.teamName, stat: topGk.saves, description: `${topGk.saves} defesas` });
  }

  const bestOverall = [...list].sort((a, b) => b.matchScore - a.matchScore)[0];
  if (bestOverall) {
    awards.push({ type: 'goldenBall', winner: bestOverall.name, teamName: bestOverall.teamName, description: 'Melhor jogador do torneio' });
  }

  const allGoals = matches
    .filter((m) => m.played)
    .flatMap((m) => [...m.events, ...(m.extraTime?.events ?? [])].filter((e) => e.type === 'goal').map((e) => ({ e, m })));
  if (allGoals.length > 0) {
    const best = allGoals[Math.floor(Math.random() * allGoals.length)];
    awards.push({
      type: 'bestGoal',
      winner: best.e.player,
      teamName: best.e.team === 'home' ? best.m.homeTeamName : best.m.awayTeamName,
      description: best.e.description,
    });
  }

  return awards;
}

export function buildKnockoutFinalStandings(allMatches: MatchResult[], finalRoundMatches: MatchResult[], teams: Team[]): TournamentStanding[] {
  const finalMatch = finalRoundMatches[0];
  const championId = winnerOf(finalMatch);
  const runnerUpId = championId === finalMatch.homeTeamId ? finalMatch.awayTeamId : finalMatch.homeTeamId;

  const semis = allMatches.filter((m) => m.round === 'Semifinal');
  const semiLosers = semis
    .map((m) => (winnerOf(m) === m.homeTeamId ? m.awayTeamId : m.homeTeamId))
    .filter((id) => id !== championId && id !== runnerUpId);

  const overall = computeStandings(allMatches, teams);
  const thirdId = semiLosers.sort((a, b) => {
    const sa = overall.find((s) => s.teamId === a)?.goalDifference ?? 0;
    const sb = overall.find((s) => s.teamId === b)?.goalDifference ?? 0;
    return sb - sa;
  })[0];

  const order = [championId, runnerUpId, thirdId].filter(Boolean) as string[];
  const rest = overall.filter((s) => !order.includes(s.teamId)).map((s) => s.teamId);
  const finalOrder = [...order, ...rest];

  return finalOrder.map((id) => overall.find((s) => s.teamId === id)).filter((s): s is TournamentStanding => Boolean(s));
}
