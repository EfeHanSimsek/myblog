import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '../data/db.json');
const BACKUP_DIR = path.join(__dirname, '../data/backups');

export async function readDb() {
  const raw = await fs.readFile(DB_PATH, 'utf8');
  return JSON.parse(raw);
}

export async function writeDb(data) {
  await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2));
}

export async function snapshotDb(reason = 'manual') {
  const db = await readDb();
  await fs.mkdir(BACKUP_DIR, { recursive: true });
  const safeReason = String(reason).replace(/[^a-z0-9-]/gi, '-').toLowerCase().slice(0, 40) || 'manual';
  const filename = `${new Date().toISOString().replace(/[:.]/g, '-')}-${safeReason}.json`;
  const filePath = path.join(BACKUP_DIR, filename);
  await fs.writeFile(filePath, JSON.stringify(db, null, 2));
  return { filename, path: filePath };
}
