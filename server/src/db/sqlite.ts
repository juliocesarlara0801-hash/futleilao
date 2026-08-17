// Persistência local em SQLite (node:sqlite, nativo do Node 22+, zero config).
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, '../../data');
mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(path.join(dataDir, 'futleilao.sqlite'));

db.exec(`
  CREATE TABLE IF NOT EXISTS tournament_history (
    id TEXT PRIMARY KEY,
    room_code TEXT NOT NULL,
    mode TEXT NOT NULL,
    standings_json TEXT NOT NULL,
    awards_json TEXT NOT NULL,
    matches_json TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS ranking (
    owner_name TEXT PRIMARY KEY,
    total_points INTEGER NOT NULL DEFAULT 0,
    titles INTEGER NOT NULL DEFAULT 0,
    tournaments_played INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL
  );
`);

export interface TournamentHistoryRow {
  id: string;
  room_code: string;
  mode: string;
  standings_json: string;
  awards_json: string;
  matches_json: string;
  created_at: number;
}

export function saveTournamentHistory(row: Omit<TournamentHistoryRow, 'created_at'>) {
  const stmt = db.prepare(
    `INSERT INTO tournament_history (id, room_code, mode, standings_json, awards_json, matches_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  stmt.run(row.id, row.room_code, row.mode, row.standings_json, row.awards_json, row.matches_json, Date.now());
}

export function getTournamentHistoryForRoom(roomCode: string): TournamentHistoryRow[] {
  const stmt = db.prepare(
    `SELECT * FROM tournament_history WHERE room_code = ? ORDER BY created_at DESC LIMIT 50`
  );
  return stmt.all(roomCode) as unknown as TournamentHistoryRow[];
}

export function bumpRanking(ownerName: string, pointsGained: number, wonTitle: boolean) {
  const existing = db
    .prepare(`SELECT * FROM ranking WHERE owner_name = ?`)
    .get(ownerName) as { owner_name: string; total_points: number; titles: number; tournaments_played: number } | undefined;

  if (existing) {
    db.prepare(
      `UPDATE ranking SET total_points = total_points + ?, titles = titles + ?, tournaments_played = tournaments_played + 1, updated_at = ? WHERE owner_name = ?`
    ).run(pointsGained, wonTitle ? 1 : 0, Date.now(), ownerName);
  } else {
    db.prepare(
      `INSERT INTO ranking (owner_name, total_points, titles, tournaments_played, updated_at) VALUES (?, ?, ?, 1, ?)`
    ).run(ownerName, pointsGained, wonTitle ? 1 : 0, Date.now());
  }
}

export function getGlobalRanking() {
  return db.prepare(`SELECT * FROM ranking ORDER BY total_points DESC LIMIT 100`).all();
}

export default db;
