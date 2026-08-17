import 'dotenv/config';
import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerSocketHandlers } from './socket/handlers.js';
import { simulateMatch } from './ai/matchNarrator.js';
import type { Team } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 3001);
const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173';

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '512kb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'futleilao-server', time: Date.now() });
});

/**
 * Endpoint stateless usado pelo modo "mesmo aparelho" (hot-seat): o client roda o leilão
 * e o torneio inteiramente no navegador e só chama isso pra simular cada partida com IA
 * (mantendo a ANTHROPIC_API_KEY só no servidor).
 */
app.post('/api/simulate-match', async (req, res) => {
  try {
    const { homeTeam, awayTeam, mode, isKnockout } = req.body as {
      homeTeam: Team;
      awayTeam: Team;
      mode: 'futsal' | 'full';
      isKnockout: boolean;
    };
    if (!homeTeam?.players?.length || !awayTeam?.players?.length || (mode !== 'futsal' && mode !== 'full')) {
      return res.status(400).json({ error: 'Payload inválido' });
    }
    if (homeTeam.players.length > 20 || awayTeam.players.length > 20) {
      return res.status(400).json({ error: 'Elenco grande demais' });
    }
    const result = await simulateMatch({ homeTeam, awayTeam, mode, isKnockout: !!isKnockout });
    res.json(result);
  } catch (err) {
    console.error('Erro em /api/simulate-match', err);
    res.status(500).json({ error: 'Falha ao simular partida' });
  }
});

// Em produção, serve o build do client (npm run build gera client/dist).
const clientDist = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(clientDist, 'index.html'), (err) => {
    if (err) next();
  });
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: FRONTEND_URL === 'http://localhost:5173' ? '*' : FRONTEND_URL },
});

registerSocketHandlers(io);

httpServer.listen(PORT, () => {
  console.log(`FutLeilão server rodando em http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('⚠️  ANTHROPIC_API_KEY não configurada — as partidas usarão o simulador local (sem narração de IA).');
  }
});
