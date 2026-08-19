import type { ExtraPeriod, MatchEvent, PenaltyShootout, Player, Team } from '../types.js';

export interface SimulateMatchInput {
  homeTeam: Team;
  awayTeam: Team;
  mode: 'futsal' | 'full';
  isKnockout: boolean;
}

export interface SimulatedMatchData {
  homeGoals: number;
  awayGoals: number;
  events: MatchEvent[];
  extraTime: ExtraPeriod | null;
  penalties: PenaltyShootout | null;
  penaltyWinner: 'home' | 'away' | null;
  manOfTheMatch: string;
  narration: string;
}

const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-5';

function slimPlayer(p: Player) {
  return { name: p.name, position: p.position, rating: p.rating, era: p.era };
}

function buildPrompt(input: SimulateMatchInput): string {
  const duration = input.mode === 'futsal' ? 40 : 90;
  return JSON.stringify({
    mode: input.mode,
    durationMinutes: duration,
    isKnockout: input.isKnockout,
    rule: input.isKnockout
      ? 'Precisa de um vencedor. Se empatar no tempo normal, gere extraTime (2 tempos, 15min futebol / 5min futsal). Se ainda empatar, gere penalties (5 cobranças alternadas, depois morte súbita) e informe penaltyWinner ("home" ou "away").'
      : 'Pode terminar empatado (fase de pontos corridos). Não gere extraTime nem penalties.',
    homeTeam: { name: input.homeTeam.teamName, players: input.homeTeam.players.map(slimPlayer) },
    awayTeam: { name: input.awayTeam.teamName, players: input.awayTeam.players.map(slimPlayer) },
  });
}

const SYSTEM_PROMPT = `Você é um narrador esportivo brasileiro empolgante, especialista em futebol e futsal.
Simule a partida considerando os ratings dos jogadores (70-99): jogadores com rating mais alto têm MUITO mais
chance de participar de gols, assistências e defesas do que jogadores com rating baixo, mas upsets acontecem
(~15% de chance de um time inferior surpreender). O time com elenco mais forte (média de rating maior) deve
ter mais chances de fazer gol e vencer, proporcional à diferença de nível — não faça o jogo determinístico,
mas a força dos times deve pesar de verdade no placar. Não entregue só o placar seco: além dos gols (com o
minuto exato e quem marcou/deu assistência), inclua VÁRIOS eventos "nearMiss" (lances perigosos: bola na
trave, chute pra fora, defesa milagrosa) espalhados pelos minutos da partida, mais concentrados nos jogadores
de rating mais alto, pra dar a sensação de jogo em construção antes de cada gol. Use apenas nomes de jogadores
fornecidos nas listas dos dois times. Responda ESTRITAMENTE em JSON válido, sem markdown, sem texto fora do
JSON, sem backticks, seguindo exatamente este formato:
{
  "homeGoals": number,
  "awayGoals": number,
  "events": [{"minute": number, "type": "goal"|"nearMiss"|"save"|"yellowCard"|"redCard"|"foul"|"penalty", "team": "home"|"away", "player": string, "assist": string|null, "description": string}],
  "extraTime": {"homeGoals": number, "awayGoals": number, "events": [...]} | null,
  "penalties": {"home": boolean[], "away": boolean[]} | null,
  "penaltyWinner": "home"|"away"|null,
  "manOfTheMatch": string,
  "narration": string
}`;

async function callAnthropic(input: SimulateMatchInput): Promise<SimulatedMatchData | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 4000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: `Simule esta partida: ${buildPrompt(input)}` }],
      }),
    });

    if (!response.ok) {
      console.error('Anthropic API error', response.status, await response.text());
      return null;
    }

    const data = (await response.json()) as { content?: { type: string; text?: string }[] };
    const text = data.content?.find((c) => c.type === 'text')?.text;
    if (!text) return null;

    const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '');
    const parsed = JSON.parse(cleaned) as SimulatedMatchData;
    return normalize(parsed);
  } catch (err) {
    console.error('Falha ao chamar API Anthropic, usando simulação local:', err);
    return null;
  }
}

function normalize(data: SimulatedMatchData): SimulatedMatchData {
  return {
    homeGoals: data.homeGoals ?? 0,
    awayGoals: data.awayGoals ?? 0,
    events: data.events ?? [],
    extraTime: data.extraTime ?? null,
    penalties: data.penalties ?? null,
    penaltyWinner: data.penaltyWinner ?? null,
    manOfTheMatch: data.manOfTheMatch ?? '',
    narration: data.narration ?? '',
  };
}

// ---------- Simulação local (fallback sem API key / falha de rede) ----------

function teamStrength(team: Team, positions: string[]): number {
  const relevant = team.players.filter((p) => positions.includes(p.position));
  if (relevant.length === 0) return 75;
  return relevant.reduce((sum, p) => sum + p.rating, 0) / relevant.length;
}

function weightedPick<T extends { rating: number }>(players: T[]): T {
  const weights = players.map((p) => Math.pow(1.06, p.rating));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < players.length; i++) {
    r -= weights[i];
    if (r <= 0) return players[i];
  }
  return players[players.length - 1];
}

function simulateGoals(attack: number, defense: number, minutes: number): number {
  const ratio = attack / defense;
  const baseExpected = (minutes / 90) * 1.35 * ratio;
  const upsetFactor = Math.random() < 0.15 ? 0.6 + Math.random() * 0.8 : 1;
  const expected = Math.max(0.1, baseExpected * upsetFactor);
  // Poisson sample
  let L = Math.exp(-expected);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= Math.random();
  } while (p > L);
  return k - 1;
}

function localGoalEvents(
  team: Team,
  opponentGk: Player | undefined,
  goals: number,
  side: 'home' | 'away',
  minuteRange: [number, number]
): MatchEvent[] {
  const attackers = team.players.filter((p) => p.position === 'atacante' || p.position === 'meia');
  const scorerPool = attackers.length > 0 ? attackers : team.players;
  const events: MatchEvent[] = [];
  for (let i = 0; i < goals; i++) {
    const scorer = weightedPick(scorerPool);
    const assistCandidates = team.players.filter((p) => p.id !== scorer.id);
    const hasAssist = Math.random() < 0.65 && assistCandidates.length > 0;
    const assister = hasAssist ? weightedPick(assistCandidates) : null;
    const minute = Math.floor(minuteRange[0] + Math.random() * (minuteRange[1] - minuteRange[0]));
    events.push({
      minute,
      type: 'goal',
      team: side,
      player: scorer.name,
      assist: assister ? assister.name : null,
      description: describeGoal(scorer.name, assister?.name ?? null, opponentGk?.name),
    });
  }
  return events;
}

const GOAL_DESCRIPTIONS = [
  (p: string) => `${p} arranca em velocidade, encara a defesa e bate cruzado para o gol!`,
  (p: string) => `${p} recebe na entrada da área e manda uma bomba no ângulo!`,
  (p: string) => `Jogada coletiva termina com ${p} só empurrando para as redes.`,
  (p: string) => `${p} cabeceia forte após cobrança de escanteio, sem chance para o goleiro.`,
  (p: string) => `Que golaço! ${p} ajeita e chuta de primeira, indefensável.`,
];

function describeGoal(scorer: string, assist: string | null, gk?: string): string {
  const base = GOAL_DESCRIPTIONS[Math.floor(Math.random() * GOAL_DESCRIPTIONS.length)](scorer);
  const assistText = assist ? ` Assistência de ${assist}.` : '';
  const gkText = gk ? ` ${gk} nada pôde fazer.` : '';
  return base + assistText + gkText;
}

const NEAR_MISS_DESCRIPTIONS = [
  (p: string) => `${p} chuta forte, mas a bola explode no travessão!`,
  (p: string) => `${p} recebe livre na área e manda por cima do gol — perdeu um golaço!`,
  (p: string) => `Que perigo! ${p} finaliza e a bola passa raspando a trave.`,
  (p: string) => `${p} arrisca de fora da área, tira tinta da trave!`,
  (p: string) => `${p} tenta o drible na entrada da área, mas a zaga corta no susto.`,
  (p: string) => `${p} cabeceia após cruzamento, a bola vai para fora por pouco.`,
];

function describeNearMiss(scorer: string): string {
  return NEAR_MISS_DESCRIPTIONS[Math.floor(Math.random() * NEAR_MISS_DESCRIPTIONS.length)](scorer);
}

/** Quantidade esperada de lances perigosos (chances claras) do ataque, escalando com a força relativa do time. */
function expectedChances(attack: number, defense: number, minutes: number): number {
  const ratio = attack / defense;
  const expected = (minutes / 90) * 2.4 * ratio;
  return Math.max(0, Math.round(expected * (0.5 + Math.random())));
}

function localNearMissEvents(team: Team, count: number, side: 'home' | 'away', minuteRange: [number, number]): MatchEvent[] {
  const attackers = team.players.filter((p) => p.position === 'atacante' || p.position === 'meia');
  const pool = attackers.length > 0 ? attackers : team.players;
  const events: MatchEvent[] = [];
  for (let i = 0; i < count; i++) {
    const player = weightedPick(pool);
    const minute = Math.floor(minuteRange[0] + Math.random() * (minuteRange[1] - minuteRange[0]));
    events.push({
      minute,
      type: 'nearMiss',
      team: side,
      player: player.name,
      assist: null,
      description: describeNearMiss(player.name),
    });
  }
  return events;
}

function localSaveEvents(team: Team, count: number, side: 'home' | 'away', minuteRange: [number, number]): MatchEvent[] {
  const gk = team.players.find((p) => p.position === 'goleiro');
  if (!gk) return [];
  const events: MatchEvent[] = [];
  for (let i = 0; i < count; i++) {
    const minute = Math.floor(minuteRange[0] + Math.random() * (minuteRange[1] - minuteRange[0]));
    events.push({
      minute,
      type: 'save',
      team: side,
      player: gk.name,
      description: `Defesaça de ${gk.name}! Voou para espalmar um chute perigoso.`,
    });
  }
  return events;
}

function simulatePeriod(home: Team, away: Team, minutes: number, minuteOffset: number): { homeGoals: number; awayGoals: number; events: MatchEvent[] } {
  const homeAttack = teamStrength(home, ['atacante', 'meia']);
  const awayAttack = teamStrength(away, ['atacante', 'meia']);
  const homeDefense = teamStrength(home, ['defensor', 'goleiro']) + 3; // leve vantagem de mando
  const awayDefense = teamStrength(away, ['defensor', 'goleiro']);

  const homeGoals = simulateGoals(homeAttack, awayDefense, minutes);
  const awayGoals = simulateGoals(awayAttack, homeDefense, minutes);

  const homeGk = home.players.find((p) => p.position === 'goleiro');
  const awayGk = away.players.find((p) => p.position === 'goleiro');

  const homeChances = expectedChances(homeAttack, awayDefense, minutes);
  const awayChances = expectedChances(awayAttack, homeDefense, minutes);

  const events = [
    ...localGoalEvents(home, awayGk, homeGoals, 'home', [minuteOffset + 1, minuteOffset + minutes]),
    ...localGoalEvents(away, homeGk, awayGoals, 'away', [minuteOffset + 1, minuteOffset + minutes]),
    ...localNearMissEvents(home, homeChances, 'home', [minuteOffset + 1, minuteOffset + minutes]),
    ...localNearMissEvents(away, awayChances, 'away', [minuteOffset + 1, minuteOffset + minutes]),
    ...localSaveEvents(away, Math.floor(Math.random() * 3), 'away', [minuteOffset + 1, minuteOffset + minutes]),
    ...localSaveEvents(home, Math.floor(Math.random() * 3), 'home', [minuteOffset + 1, minuteOffset + minutes]),
  ].sort((a, b) => a.minute - b.minute);

  return { homeGoals, awayGoals, events };
}

function simulatePenalties(home: Team, away: Team): { penalties: PenaltyShootout; winner: 'home' | 'away' } {
  const kick = (team: Team) => {
    const gkOpp = 0.72; // taxa de conversão base
    return Math.random() < gkOpp;
  };
  const homeKicks: boolean[] = [];
  const awayKicks: boolean[] = [];
  for (let i = 0; i < 5; i++) {
    homeKicks.push(kick(home));
    awayKicks.push(kick(away));
  }
  let homeScore = homeKicks.filter(Boolean).length;
  let awayScore = awayKicks.filter(Boolean).length;
  while (homeScore === awayScore) {
    const h = kick(home);
    const a = kick(away);
    homeKicks.push(h);
    awayKicks.push(a);
    if (h) homeScore++;
    if (a) awayScore++;
    if (homeKicks.length > 20) break; // safety valve
  }
  return { penalties: { home: homeKicks, away: awayKicks }, winner: homeScore > awayScore ? 'home' : 'away' };
}

function pickManOfTheMatch(events: MatchEvent[], home: Team, away: Team): string {
  const scoreByPlayer = new Map<string, number>();
  for (const e of events) {
    if (e.type === 'goal') scoreByPlayer.set(e.player, (scoreByPlayer.get(e.player) ?? 0) + 3);
    if (e.type === 'save') scoreByPlayer.set(e.player, (scoreByPlayer.get(e.player) ?? 0) + 1);
    if (e.assist) scoreByPlayer.set(e.assist, (scoreByPlayer.get(e.assist) ?? 0) + 2);
  }
  if (scoreByPlayer.size === 0) {
    const all = [...home.players, ...away.players];
    return weightedPick(all).name;
  }
  return [...scoreByPlayer.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

function simulateLocally(input: SimulateMatchInput): SimulatedMatchData {
  const minutes = input.mode === 'futsal' ? 40 : 90;
  const main = simulatePeriod(input.homeTeam, input.awayTeam, minutes, 0);

  let extraTime: ExtraPeriod | null = null;
  let penalties: PenaltyShootout | null = null;
  let penaltyWinner: 'home' | 'away' | null = null;

  if (input.isKnockout && main.homeGoals === main.awayGoals) {
    const etMinutes = input.mode === 'futsal' ? 10 : 30;
    const et = simulatePeriod(input.homeTeam, input.awayTeam, etMinutes, minutes);
    extraTime = { homeGoals: et.homeGoals, awayGoals: et.awayGoals, events: et.events };

    if (et.homeGoals === et.awayGoals) {
      const result = simulatePenalties(input.homeTeam, input.awayTeam);
      penalties = result.penalties;
      penaltyWinner = result.winner;
    }
  }

  const allEvents = [...main.events, ...(extraTime?.events ?? [])];
  const manOfTheMatch = pickManOfTheMatch(allEvents, input.homeTeam, input.awayTeam);

  const narration = `${input.homeTeam.teamName} ${main.homeGoals} x ${main.awayGoals} ${input.awayTeam.teamName}. ${
    allEvents.length > 0 ? 'Partida movimentada com boas chances para os dois lados.' : 'Jogo travado, poucas chances claras.'
  }${extraTime ? ' Foi para a prorrogação!' : ''}${penalties ? ' Definido nos pênaltis!' : ''}`;

  return {
    homeGoals: main.homeGoals,
    awayGoals: main.awayGoals,
    events: main.events,
    extraTime,
    penalties,
    penaltyWinner,
    manOfTheMatch,
    narration,
  };
}

export async function simulateMatch(input: SimulateMatchInput): Promise<SimulatedMatchData> {
  const aiResult = await callAnthropic(input);
  if (aiResult) return aiResult;
  return simulateLocally(input);
}
