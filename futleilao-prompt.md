# PROMPT — FutLeilão (Claude Code)

## Visão Geral

Crie um jogo web multiplayer em tempo real chamado **FutLeilão**. O jogo consiste em um leilão de jogadores de futebol (reais, famosos e aposentados) entre 2 a 16 jogadores humanos, que montam seus times por lances de dinheiro virtual. Após todos os times serem montados, o sistema simula partidas narradas por IA e gera uma classificação final com premiações.

O app deve funcionar como **PWA responsiva** (desktop, Android, iOS), com **sincronização em tempo real** via WebSockets para que vários amigos joguem simultaneamente de dispositivos diferentes.

---

## 1. Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| Frontend | React 18 + TypeScript + Tailwind CSS |
| Realtime | Socket.IO (WebSocket com fallback) |
| Backend | Node.js + Express |
| Banco de dados | SQLite (arquivo local, zero config) para persistir salas e partidas |
| IA / Simulação | API da Anthropic (Claude Sonnet) para narração de partidas |
| Deploy | O projeto deve rodar com `npm run dev` em desenvolvimento e `npm run build && npm start` em produção |

---

## 2. Banco de Jogadores (seed estático em JSON)

Gere um arquivo `players.json` com jogadores reais de futebol, distribuídos assim:

- **100 atacantes** (pontas, centroavantes, falso 9, segundo atacante)
- **100 meias** (meias ofensivos, meias centrais, volantes, meias armadores)
- **100 defensores** (zagueiros, laterais-direitos, laterais-esquerdos)
- **50 goleiros**

**Total: 350 jogadores.**

### Critérios de seleção dos jogadores

- Misture jogadores **aposentados lendários** (Pelé, Maradona, Ronaldo Fenômeno, Zidane, Beckenbauer, Maldini, Yashin etc.) com **estrelas atuais** (Mbappé, Haaland, Vini Jr, Bellingham etc.) e **jogadores conhecidos mas não tão famosos** (Kepa, Barcola, Havertz, Hakimi, Mount etc.)
- Cada jogador deve ter um **rating overall de 70 a 99** que reflete seu nível no auge da carreira
- Distribua os ratings em uma curva: poucos 95-99, um grupo maior 85-94, a maioria entre 75-84, e alguns entre 70-74

### Schema de cada jogador

```json
{
  "id": "uuid",
  "name": "Zinedine Zidane",
  "nationality": "França",
  "nationalityFlag": "🇫🇷",
  "position": "meia",
  "positionDetail": "Meia ofensivo",
  "rating": 96,
  "era": "legend",
  "imageUrl": null
}
```

- `position`: um de `"atacante" | "meia" | "defensor" | "goleiro"`
- `era`: `"legend"` (aposentado) ou `"current"` (ativo)
- `rating`: 70-99

---

## 3. Modos de Jogo

O usuário escolhe o modo ao criar a sala:

### 3.1 Modo Futsal (2 a 6 jogadores)

- **Formação por time:** 1 atacante + 2 meias + 1 defensor + 1 goleiro = **5 jogadores**
- **Pool gerado:** para N times, o sistema gera aleatoriamente a partir do banco:
  - Atacantes: `N + 2` (ex: 3 times → 5 atacantes)
  - Meias: `(N × 2) + 4` (ex: 3 times → 10 meias)
  - Defensores: `N + 2`
  - Goleiros: `N + 2`
- **Budget inicial:** R$ 20 por time (configurável pelo criador da sala: R$ 10, R$ 15, R$ 20, R$ 30, R$ 50)
- **Lance mínimo:** R$ 1
- **Formato de torneio:** Pontos corridos (todos contra todos). Vitória = 3 pts, empate = 1 pt, derrota = 0 pts. Desempate: saldo de gols → gols pró → confronto direto

### 3.2 Modo Futebol Completo (2 a 16 jogadores)

- **Formação por time:** o criador escolhe entre:
  - 4-3-3: 3 atacantes + 3 meias + 4 defensores + 1 goleiro
  - 4-4-2: 2 atacantes + 4 meias + 4 defensores + 1 goleiro
  - 3-5-2: 2 atacantes + 5 meias + 3 defensores + 1 goleiro
- **Pool gerado:** segue a mesma lógica proporcional (posições necessárias × N times + excedente)
- **Budget inicial:** R$ 50 por time (configurável: R$ 30, R$ 40, R$ 50, R$ 75, R$ 100)
- **Lance mínimo:** R$ 1
- **Formato de torneio:**
  - 2 a 6 jogadores: Pontos corridos
  - 4 jogadores: opção de Semifinal + Final (mata-mata)
  - 8 jogadores: opção de Quartas + Semi + Final
  - 16 jogadores: opção de Copa do Mundo (fase de grupos 4×4 + oitavas + quartas + semi + final)

---

## 4. Fluxo do Jogo

### Fase 1 — Lobby / Criação de Sala

1. O **host** cria a sala e recebe um **código de 6 caracteres** (ex: `FUT-A3K9`)
2. Os demais jogadores entram digitando o código ou escaneando QR Code
3. Cada jogador escolhe um **nome de time** (ex: "Galácticos do Júlio")
4. O host configura: modo (futsal/completo), budget, formação, formato de torneio
5. Quando todos estão prontos, o host clica em **"Iniciar Leilão"**

### Fase 2 — Leilão

1. O sistema sorteia a ordem dos jogadores do pool e revela **um por vez** para todos simultaneamente
2. O jogador aparece em uma **carta estilo card** com nome, nacionalidade, bandeira, posição, rating e era
3. Cada participante tem **30 segundos** (configurável: 15s, 30s, 45s, 60s) para dar um lance
4. O lance é feito digitando o valor (inteiro, mínimo R$ 1) e clicando "Dar Lance"
5. Todos os lances são **fechados/secretos** (simultâneos) — ao final do timer, o sistema revela todos os lances e o **maior lance leva o jogador**
6. Em caso de empate no lance, o jogador vai para quem tem **menos jogadores naquela posição**; se ainda empatar, sorteio
7. Se **ninguém der lance** (todos passam), o jogador é descartado
8. O jogador comprado vai automaticamente para o elenco do time comprador
9. O saldo restante de cada time é atualizado em tempo real para todos verem

### Lógica inteligente do leilão

- Se um time já completou uma posição, ele **não pode dar lance** em jogadores daquela posição (o botão fica desabilitado)
- Se restam exatamente N jogadores de uma posição no pool e N times ainda precisam preencher essa posição, os jogadores restantes são **distribuídos automaticamente** por R$ 1 cada (ninguém mais pode disputar, seria injusto forçar lances)
- O sistema mostra um **aviso visual** quando um time está perto de ficar sem dinheiro (saldo < 3)
- Se um time tem saldo R$ 0, ele não pode dar nenhum lance (recebe jogadores apenas pela distribuição automática)
- Cada time precisa reservar saldo suficiente para preencher as vagas restantes (mínimo R$ 1 por vaga). Ex: se faltam 3 vagas e tem R$ 5, o lance máximo é R$ 3 (guarda R$ 1 para cada vaga restante). O sistema deve calcular e limitar automaticamente.

### Fase 3 — Revisão dos Times

1. Tela mostrando todos os times montados lado a lado
2. Cada time exibe seus jogadores em formação visual (campo de futebol/futsal)
3. Mostra o rating médio do time, gasto total, saldo não usado
4. Botão para o host: **"Iniciar Torneio"**

### Fase 4 — Simulação de Partidas

O sistema simula cada jogo usando a **API Claude (Sonnet)** como motor narrativo.

#### Prompt de simulação (enviado à API Anthropic)

Para cada partida, enviar um prompt com:

- Os dois times com seus jogadores (nome, posição, rating)
- O modo (futsal ou futebol completo)
- A duração da partida (futsal: 40 min / futebol: 90 min)
- Se é fase de grupos (pode empatar) ou mata-mata (precisa de vencedor → prorrogação → pênaltis)
- Instrução para considerar o **rating dos jogadores** na probabilidade de eventos (jogador 95 tem mais chance de gol/assistência/defesa que um 75)
- Instrução para gerar resposta em JSON:

```json
{
  "homeGoals": 2,
  "awayGoals": 1,
  "events": [
    {
      "minute": 13,
      "type": "goal",
      "team": "home",
      "player": "Ronaldo Fenômeno",
      "assist": "Xavi Hernández",
      "description": "Arrancada absurda pela esquerda, driblou o zagueiro e tocou na saída do goleiro"
    },
    {
      "minute": 27,
      "type": "nearMiss",
      "team": "away",
      "player": "Mbappé",
      "description": "Chutou forte de fora da área, a bola explodiu na trave!"
    },
    {
      "minute": 34,
      "type": "goal",
      "team": "home",
      "player": "Xavi Hernández",
      "assist": null,
      "description": "Golaço de fora da área, bola no ângulo sem chance pro goleiro"
    },
    {
      "minute": 67,
      "type": "save",
      "team": "home",
      "player": "Buffon",
      "description": "Defesaça! Voou no canto e espalmou o chute de Rivaldo"
    },
    {
      "minute": 78,
      "type": "goal",
      "team": "away",
      "player": "Rivaldo",
      "assist": "Modrić",
      "description": "Bicicleta de Rivaldo! O bruxo fez um gol impossível!"
    }
  ],
  "extraTime": null,
  "penalties": null,
  "manOfTheMatch": "Ronaldo Fenômeno",
  "narration": "Partida emocionante marcada pelo duelo entre dois ataques letais..."
}
```

Se mata-mata e empate: `extraTime` e `penalties` são preenchidos com a mesma estrutura.

#### Dois modos de visualização da partida

O usuário pode alternar entre:

1. **Modo Narração Completa:** exibe evento por evento com animação de scroll automático, mostrando o minuto, o ícone do evento (⚽ gol, 🥅 defesa, 💨 quase gol, 🟨 cartão), o texto narrativo. Estilo de "live ticker" de jogo ao vivo
2. **Modo Resultado Rápido:** mostra apenas o placar final, os gols (jogador + minuto + assistência) e o craque da partida

### Fase 5 — Classificação e Premiações

Após todas as partidas:

1. **Tabela de classificação** — pontos, vitórias, empates, derrotas, gols pró, gols contra, saldo
2. **Premiações automáticas:**
   - 🏆 Campeão
   - 🥈 Vice-campeão
   - 🥉 Terceiro lugar
   - ⚽ Chuteira de Ouro (artilheiro)
   - 🎯 Rei das Assistências
   - 🧤 Luva de Ouro (goleiro menos vazado)
   - ⭐ Bola de Ouro (melhor jogador geral — somando gols, assistências, defesas, notas de craque)
   - 💎 Melhor Gol do Torneio
3. **Tela final** mostrando tudo em formato de cerimônia de premiação

---

## 5. Interface / UX

### Layout geral

- **Mobile-first**, mas responsivo para desktop
- Tema escuro com detalhes em dourado/amarelo (#FFD700) e verde campo (#1B5E20)
- Fonte principal: Inter ou Poppins
- Cards de jogador inspirados em cartas do FIFA Ultimate Team

### Telas principais

1. **Home** — Logo FutLeilão + botões "Criar Sala" / "Entrar na Sala"
2. **Lobby** — Lista de jogadores conectados, configurações, botão Iniciar
3. **Leilão** — Card do jogador atual no centro, timer, campo de lance, placar de saldos de todos os times
4. **Revisão** — Times montados em visual de campo
5. **Partida** — Live ticker da narração OU resultado rápido
6. **Tabela** — Classificação atualizada após cada rodada
7. **Premiação** — Tela final com troféus e estatísticas

### Componentes importantes

- **Timer circular animado** no leilão (contagem regressiva visual)
- **Toast notifications** para eventos: "Fulano comprou Zidane por R$ 5!"
- **Animação de revelação** quando o card do jogador aparece (flip card)
- **Sound effects** opcionais: apito, torcida, moeda caindo
- **Confetti** na tela de premiação final

---

## 6. Estrutura de Pastas

```
futleilao/
├── client/                     # Frontend React
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── components/
│   │   │   ├── Home.tsx
│   │   │   ├── Lobby.tsx
│   │   │   ├── Auction.tsx
│   │   │   ├── PlayerCard.tsx
│   │   │   ├── TeamReview.tsx
│   │   │   ├── MatchSimulation.tsx
│   │   │   ├── Standings.tsx
│   │   │   ├── Awards.tsx
│   │   │   ├── Timer.tsx
│   │   │   └── ui/ (botões, inputs, modais)
│   │   ├── hooks/
│   │   │   ├── useSocket.ts
│   │   │   └── useGame.ts
│   │   ├── context/
│   │   │   └── GameContext.tsx
│   │   ├── types/
│   │   │   └── index.ts
│   │   ├── data/
│   │   │   └── players.json
│   │   ├── utils/
│   │   │   └── helpers.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── package.json
├── server/
│   ├── src/
│   │   ├── index.ts
│   │   ├── socket/
│   │   │   ├── handlers.ts
│   │   │   └── rooms.ts
│   │   ├── game/
│   │   │   ├── auction.ts
│   │   │   ├── simulation.ts
│   │   │   └── tournament.ts
│   │   ├── ai/
│   │   │   └── matchNarrator.ts
│   │   └── db/
│   │       └── sqlite.ts
│   ├── tsconfig.json
│   └── package.json
├── shared/
│   └── types.ts
├── package.json
└── README.md
```

---

## 7. WebSocket Events

### Client → Server

| Evento | Payload | Descrição |
|---|---|---|
| `create_room` | `{ hostName, teamName, mode, config }` | Cria sala |
| `join_room` | `{ roomCode, playerName, teamName }` | Entra na sala |
| `player_ready` | `{ roomCode }` | Marca como pronto |
| `start_auction` | `{ roomCode }` | Host inicia o leilão |
| `place_bid` | `{ roomCode, playerId, amount }` | Dá um lance |
| `pass_bid` | `{ roomCode }` | Passa a vez (não quer o jogador) |
| `start_tournament` | `{ roomCode }` | Host inicia simulações |
| `request_match_details` | `{ roomCode, matchId }` | Pede narração completa |

### Server → Client

| Evento | Payload | Descrição |
|---|---|---|
| `room_created` | `{ roomCode, qrCode }` | Sala criada com código |
| `player_joined` | `{ players[] }` | Atualiza lista de jogadores |
| `auction_started` | `{ pool[] }` | Leilão iniciou, pool completo |
| `reveal_player` | `{ player, remainingCount, poolStatus }` | Novo jogador revelado |
| `timer_tick` | `{ secondsLeft }` | Countdown sync |
| `bid_result` | `{ player, winner, amount, allBids[] }` | Resultado do lance |
| `auto_assign` | `{ player, team, reason }` | Atribuição automática |
| `team_complete` | `{ teamName }` | Time completou o elenco |
| `all_teams_complete` | `{ teams[] }` | Todos prontos pra torneio |
| `match_result` | `{ match }` | Resultado de uma partida |
| `match_narration` | `{ matchId, events[] }` | Narração detalhada |
| `standings_update` | `{ standings[] }` | Tabela atualizada |
| `tournament_end` | `{ standings, awards }` | Torneio encerrado + prêmios |

---

## 8. Modelo de Dados (TypeScript)

```typescript
// shared/types.ts

type Position = 'atacante' | 'meia' | 'defensor' | 'goleiro';
type Era = 'legend' | 'current';
type GameMode = 'futsal' | 'full';
type TournamentFormat = 'league' | 'knockout' | 'worldcup';
type MatchEventType = 'goal' | 'nearMiss' | 'save' | 'yellowCard' | 'redCard' | 'foul' | 'penalty';

interface Player {
  id: string;
  name: string;
  nationality: string;
  nationalityFlag: string;
  position: Position;
  positionDetail: string;
  rating: number;
  era: Era;
}

interface Team {
  id: string;
  ownerName: string;
  teamName: string;
  players: Player[];
  budget: number;
  spent: number;
}

interface Bid {
  teamId: string;
  amount: number;
  timestamp: number;
}

interface MatchEvent {
  minute: number;
  type: MatchEventType;
  team: 'home' | 'away';
  player: string;
  assist?: string;
  description: string;
}

interface MatchResult {
  id: string;
  homeTeam: Team;
  awayTeam: Team;
  homeGoals: number;
  awayGoals: number;
  events: MatchEvent[];
  extraTime?: { homeGoals: number; awayGoals: number; events: MatchEvent[] };
  penalties?: { home: boolean[]; away: boolean[] };
  manOfTheMatch: string;
  narration: string;
}

interface TournamentStanding {
  team: Team;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

interface Award {
  type: 'champion' | 'goldenBoot' | 'goldenGlove' | 'goldenBall' | 'bestGoal' | 'assistKing';
  winner: string;
  teamName: string;
  stat?: number;
  description?: string;
}

interface RoomConfig {
  mode: GameMode;
  formation?: string; // '4-3-3' | '4-4-2' | '3-5-2' (only for full mode)
  budget: number;
  bidTimer: number; // seconds
  tournamentFormat: TournamentFormat;
  maxPlayers: number;
}
```

---

## 9. Regras de Negócio Críticas

1. **Reserva de saldo obrigatória:** Um time nunca pode gastar a ponto de não conseguir completar o elenco. Se faltam `V` vagas, o lance máximo permitido é `saldo - V` (porque cada vaga custa no mínimo R$ 1). O frontend deve calcular e bloquear lances acima disso.

2. **Distribuição automática:** Quando o número de jogadores restantes de uma posição é igual ao número de times que ainda precisam dessa posição, os jogadores são distribuídos automaticamente a R$ 1 por sorteio (não por rating — para manter a imprevisibilidade).

3. **Bloqueio de posição:** Se um time já tem todas as vagas de uma posição preenchidas, o botão de lance fica desabilitado e aparece "Posição completa".

4. **Simulação baseada em rating:** A IA deve usar os ratings como peso probabilístico. Um ataque com média 93 tem muito mais chance de marcar contra uma defesa com média 78 do que o contrário. Mas upsets devem ser possíveis (~15% de chance).

5. **Mata-mata exige vencedor:** Em fases eliminatórias, se empatar no tempo normal, vai pra prorrogação (2 tempos de 15min / 5min no futsal). Se empatar de novo, pênaltis (5 cobranças alternadas, depois morte súbita).

6. **Artilharia e assistências** devem ser rastreadas ao longo de todo o torneio para premiar no final.

7. **Seed do pool:** O sistema escolhe jogadores aleatoriamente do banco de 350, respeitando a quantidade necessária por posição. A ordem de apresentação no leilão também é aleatória (todas as posições misturadas).

---

## 10. API Anthropic — Simulação

No backend, usar a API da Anthropic para simular cada partida:

```typescript
// server/src/ai/matchNarrator.ts

const response = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': process.env.ANTHROPIC_API_KEY,
    'anthropic-version': '2023-06-01'
  },
  body: JSON.stringify({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    system: `Você é um narrador esportivo brasileiro empolgante. Simule partidas de futebol/futsal considerando os ratings dos jogadores. Responda APENAS em JSON válido, sem markdown, sem backticks.`,
    messages: [{
      role: 'user',
      content: `Simule esta partida: ${JSON.stringify(matchData)}`
    }]
  })
});
```

A chave da API deve ser configurada via variável de ambiente `ANTHROPIC_API_KEY`.

---

## 11. Considerações Finais

- O projeto deve ser **funcional e jogável** de ponta a ponta
- Priorize a **experiência mobile** (touch-friendly, inputs grandes, scroll suave)
- Use **animações sutis** (Framer Motion ou CSS transitions) para tornar o leilão dinâmico
- O código deve ter **tipagem completa** TypeScript, sem `any`
- Inclua um `README.md` com instruções de setup e uso
- Garanta que o jogo funcione com **2 jogadores** no cenário mínimo

---

## 12. Sugestões Adicionais (Features Bônus)

Essas são ideias que podem enriquecer o jogo. Implemente se possível:

1. **Modo Spectator:** Amigos que não querem jogar podem assistir o leilão e as partidas em tempo real, como espectadores, sem poder dar lances.

2. **Chat ao vivo:** Um chat lateral durante o leilão pra galera zoar e provocar ("Pagou caro demais!", "Roubou!").

3. **Histórico de torneios:** Salvar os resultados de torneios anteriores da sala para consultar depois (quem já ganhou quantas vezes).

4. **Ranking permanente:** Um sistema de pontos acumulados entre torneios — tipo um ranking geral entre amigos.

5. **Modo Leilão Aberto (alternativo):** Além do lance fechado (secreto), ter opção de leilão aberto estilo "quem dá mais" — um jogador abre com R$ 1, outro cobre com R$ 2, e assim até ninguém mais cobrir (timer de 10s resetando a cada novo lance).

6. **Poder de Veto:** Cada jogador tem 1 "veto" por torneio — pode anular a compra de um adversário (o jogador volta pro pool e é leiloado novamente na rodada seguinte).

7. **Coringas:** O sistema tem 2-3 jogadores "coringa" escondidos no pool que só são revelados quando aparecem. Podem ser jogadores absurdamente bons (Pelé, Maradona) ou memes (um jogador fictício com rating 60). Adiciona emoção.

8. **Replay do torneio:** No final, gerar um resumo em texto ou visual de todas as partidas, tipo uma crônica esportiva do campeonato inteiro.

9. **Compartilhar resultado:** Botão para gerar uma imagem (card) com o resultado do torneio para compartilhar no WhatsApp/Instagram.
