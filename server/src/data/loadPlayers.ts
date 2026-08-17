import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Player } from '../types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// server/src/data e server/dist/data têm a mesma profundidade a partir de server/,
// então subir 3 níveis leva à raiz do projeto tanto em dev (tsx) quanto em build (dist).
const sharedPath = path.resolve(__dirname, '../../../shared/players.json');

const raw = readFileSync(sharedPath, 'utf-8');
export const ALL_PLAYERS: Player[] = JSON.parse(raw);
