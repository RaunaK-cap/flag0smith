// Keeps every run and its events.
// - Events are saved in SQLite so a run can be replayed after a refresh or a restart.
// - Live listeners (open SSE connections) get each new event straight away.

import { Database } from "bun:sqlite";
import type { RunEvent, RunStatus, StoredEvent } from "@flagpilot/shared";

// DATA_DIR lets Docker/Railway keep the file on a persistent volume.
const db = new Database(`${process.env.DATA_DIR ?? "."}/flagpilot.sqlite`, { create: true });
db.run(`CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  question TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL
)`);
db.run(`CREATE TABLE IF NOT EXISTS events (
  run_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  data TEXT NOT NULL,
  PRIMARY KEY (run_id, seq)
)`);

// Columns added after the first version. ALTER fails if the column already exists, which is fine.
for (const column of ["mode TEXT", "history TEXT"]) {
  try {
    db.run(`ALTER TABLE runs ADD COLUMN ${column}`);
  } catch {}
}

type Listener = (event: StoredEvent) => void;

// In-memory state for runs that are active in this process.
const listeners = new Map<string, Set<Listener>>();
const nextSeq = new Map<string, number>();

export function createRun(question: string, mode: "demo" | "connected" = "demo"): string {
  const id = crypto.randomUUID();
  db.run("INSERT INTO runs (id, question, status, created_at, mode) VALUES (?, ?, ?, ?, ?)", [
    id,
    question,
    "running",
    Date.now(),
    mode,
  ]);
  nextSeq.set(id, 1);
  return id;
}

export function emit(runId: string, event: RunEvent) {
  // After a restart the counter is gone, so continue from the last saved event.
  if (!nextSeq.has(runId)) nextSeq.set(runId, lastSeq(runId) + 1);
  const seq = nextSeq.get(runId)!;
  nextSeq.set(runId, seq + 1);

  const stored: StoredEvent = { ...event, seq, at: Date.now() };
  db.run("INSERT INTO events (run_id, seq, data) VALUES (?, ?, ?)", [runId, seq, JSON.stringify(stored)]);

  if (event.type === "run.status" || event.type === "run.finished") {
    db.run("UPDATE runs SET status = ? WHERE id = ?", [event.status, runId]);
  }

  for (const listener of listeners.get(runId) ?? []) listener(stored);
}

export function getEvents(runId: string, afterSeq = 0): StoredEvent[] {
  const rows = db
    .query("SELECT data FROM events WHERE run_id = ? AND seq > ? ORDER BY seq")
    .all(runId, afterSeq) as { data: string }[];
  return rows.map((row) => JSON.parse(row.data));
}

function lastSeq(runId: string): number {
  const row = db.query("SELECT MAX(seq) AS seq FROM events WHERE run_id = ?").get(runId) as { seq: number | null };
  return row.seq ?? 0;
}

export function getRun(runId: string) {
  return db.query("SELECT id, question, status, created_at, mode FROM runs WHERE id = ?").get(runId) as
    | { id: string; question: string; status: RunStatus; created_at: number; mode: "demo" | "connected" | null }
    | null;
}

// The agent's conversation so far (SDK "history" items), so a chat can be continued later.
export function saveHistory(runId: string, history: unknown[]) {
  db.run("UPDATE runs SET history = ? WHERE id = ?", [JSON.stringify(history), runId]);
}

export function loadHistory(runId: string): unknown[] {
  const row = db.query("SELECT history FROM runs WHERE id = ?").get(runId) as { history: string | null } | null;
  return row?.history ? JSON.parse(row.history) : [];
}

export function listRuns(limit = 50) {
  return db.query("SELECT id, question, status, created_at FROM runs ORDER BY created_at DESC LIMIT ?").all(limit);
}

// Returns an unsubscribe function.
export function subscribe(runId: string, listener: Listener): () => void {
  if (!listeners.has(runId)) listeners.set(runId, new Set());
  listeners.get(runId)!.add(listener);
  return () => listeners.get(runId)?.delete(listener);
}

// A global live feed (not tied to a run, not saved): e.g. Flagsmith webhooks.
const globalListeners = new Set<(event: RunEvent & { at: number }) => void>();

export function broadcast(event: RunEvent) {
  for (const listener of globalListeners) listener({ ...event, at: Date.now() });
}

export function subscribeGlobal(listener: (event: RunEvent & { at: number }) => void): () => void {
  globalListeners.add(listener);
  return () => globalListeners.delete(listener);
}
