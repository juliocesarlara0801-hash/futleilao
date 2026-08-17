# ⚽💰 FutLeilão

Leilão de craques do futebol (reais, lendas e atuais) entre 2 e 16 amigos, em tempo real. Cada um monta seu
time no lance, depois a IA simula o campeonato inteiro com narração ao vivo, e no final rola cerimônia de
premiação com troféus.

PWA responsiva (funciona instalada no celular), sincronizada por WebSocket (Socket.IO) para todo mundo jogar
junto de dispositivos diferentes.

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React 18 + TypeScript + Tailwind CSS + Vite (PWA) |
| Realtime | Socket.IO |
| Backend | Node.js + Express |
| Banco de dados | SQLite (`node:sqlite`, nativo do Node 22+, zero config) |
| IA de simulação | API da Anthropic (Claude) — com fallback local se não houver chave |

## Pré-requisitos

- **Node.js 22.5 ou superior** (o projeto usa o módulo nativo `node:sqlite`; Node 24 é o recomendado/testado).
- npm 10+.

## Setup

```bash
# 1. Instalar tudo (raiz, client e server via npm workspaces)
npm run install:all

# 2. (Opcional) configurar a chave da Anthropic para narração por IA
cp server/.env.example server/.env
# edite server/.env e preencha ANTHROPIC_API_KEY=sk-ant-...
```

> Sem `ANTHROPIC_API_KEY`, o jogo funciona 100% normalmente — as partidas usam um simulador local
> (probabilístico, baseado nos ratings dos jogadores) no lugar da narração gerada por IA.

O arquivo `shared/players.json` (banco com os 350 jogadores) e os tipos compartilhados já vêm gerados no
repositório. Se quiser regenerar o banco de jogadores do zero (embaralha os ratings de novo):

```bash
npm run seed:players
```

## Rodando em desenvolvimento

```bash
npm run dev
```

Isso sobe o server (`http://localhost:3001`) e o client (`http://localhost:5173`) juntos, com hot-reload dos
dois lados. Abra `http://localhost:5173` no navegador — para jogar com amigos na mesma rede, use o IP da sua
máquina (`http://SEU-IP:5173`) ou rode `npm run dev -w client -- --host` para expor na rede.

## Rodando em produção

```bash
npm run build
npm start
```

O `build` compila o server (TypeScript → `server/dist`) e o client (Vite → `client/dist`). O `start` sobe
apenas o server (`server/dist/index.js`), que também serve os arquivos estáticos do client em produção — ou
seja, um único processo/porta (`PORT`, padrão `3001`) atende tudo.

## Como jogar

1. Um jogador cria a sala (**Criar Sala**), escolhe o modo (Futsal ou Futebol Completo), budget, formação,
   tempo de lance e formato de torneio, e recebe um **código de 6 caracteres** (ex: `FUT-A3K9`) e um QR Code.
2. Os amigos entram digitando o código (ou escaneando o QR) e escolhem o nome do time.
3. Quando todos estiverem prontos, o host clica em **Iniciar Leilão**.
4. Jogadores são revelados um por vez; cada participante dá um lance fechado (ou disputa em lance aberto,
   dependendo da configuração) dentro do tempo do timer. Quem der o maior lance leva o jogador.
5. Quando os elencos estiverem completos, o host revisa os times e clica em **Iniciar Torneio**.
6. A IA simula cada partida (narração completa ou resultado rápido, à escolha do usuário) e a tabela de
   classificação atualiza em tempo real.
7. No final, tela de premiação com Campeão, Chuteira de Ouro, Bola de Ouro, Luva de Ouro, Melhor Gol e mais.

## Funcionalidades implementadas

- Leilão em tempo real com lance fechado (secreto) e lance aberto (estilo "quem dá mais", com reset de timer).
- Regras de reserva de saldo (não deixa o time ficar sem dinheiro pra completar o elenco), bloqueio de posição
  completa, distribuição automática por R$1 quando sobra exatamente 1 jogador da posição por time restante,
  e desempate de lances por quem tem menos jogadores daquela posição.
- Três formatos de torneio: pontos corridos, mata-mata (semifinal/quartas + final, com prorrogação e
  pênaltis quando necessário) e Copa do Mundo (grupos de 4 + oitavas até a final).
- Narração de partidas por IA (Claude) com fallback probabilístico local baseado no rating dos jogadores
  (upsets acontecem ~15% das vezes).
- Dois modos de visualização de partida: narração completa (ticker ao vivo) e resultado rápido.
- Premiações automáticas ao final: Campeão, Vice, Terceiro lugar, Chuteira de Ouro, Rei das Assistências,
  Luva de Ouro, Bola de Ouro e Melhor Gol do Torneio, com confetes na tela final.
- **Bônus implementados:** modo espectador, chat ao vivo na sala e durante o leilão, jogadores coringa
  (incluindo um craque fictício de meme), poder de veto (1 por time, anula uma compra do adversário e o
  jogador volta pro leilão), histórico de torneios e ranking permanente por dono de time — persistidos em
  SQLite (`server/data/futleilao.sqlite`).

## Estrutura

```
futleilao/
├── client/        # Frontend React + Vite (PWA)
├── server/        # Backend Express + Socket.IO + SQLite
├── shared/        # Tipos TypeScript e banco de jogadores compartilhados (fonte da verdade)
└── scripts/       # Geração do banco de jogadores e sincronização de tipos
```

`shared/types.ts` e `shared/players.json` são a fonte da verdade; `npm run sync` (roda automaticamente antes
de `dev`/`build`) copia os tipos para dentro de `client/src/types` e `server/src/types.ts`, já que cada
workspace compila isoladamente.

## Testando o fluxo completo sem abrir o navegador

Os scripts `scripts/smokeTest.mjs` (pontos corridos) e `scripts/smokeTestKnockout.mjs` (mata-mata) simulam
2–4 jogadores via Socket.IO fazendo o fluxo inteiro (criar sala → leiloar → torneio → premiação). Úteis para
validar mudanças no servidor rapidamente:

```bash
npm run dev -w server &   # sobe só o server
node scripts/smokeTest.mjs
```
