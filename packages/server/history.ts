import {
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
  statSync,
} from "fs";
import { join } from "path";
import { homedir } from "os";
import type { PlanVersion } from "@planar/shared";

// Re-exported so existing importers (server, hook) keep their import paths.
export type { PlanVersion };

// Retention policy. Without one, ~/.planar/history grows forever: a new
// session dir per Claude Code session, each with one file per plan revision.
// We cap per-session revisions and drop whole sessions left untouched for a
// while, so long-time users don't accumulate unbounded disk.
const MAX_VERSIONS_PER_SESSION = 50;
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function rootHistoryDir(): string {
  return join(homedir(), ".planar", "history");
}

function historyDir(sessionId: string): string {
  return join(rootHistoryDir(), sessionId);
}

// Removes session directories whose most recent activity is older than the
// retention window. Cheap (one stat per session dir) and best-effort: any
// unreadable/locked entry is skipped rather than throwing.
export function pruneHistory(now: number = Date.now()): void {
  let sessions: string[];
  try {
    sessions = readdirSync(rootHistoryDir());
  } catch {
    return; // history root doesn't exist yet — nothing to prune
  }
  for (const sid of sessions) {
    const dir = join(rootHistoryDir(), sid);
    try {
      const stat = statSync(dir);
      if (stat.isDirectory() && now - stat.mtimeMs > RETENTION_MS) {
        rmSync(dir, { recursive: true, force: true });
      }
    } catch {
      // skip unreadable/locked entries
    }
  }
}

export function loadHistory(sessionId: string): PlanVersion[] {
  const dir = historyDir(sessionId);
  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  } catch {
    return [];
  }
  return files
    .sort()
    .map((f) => {
      try {
        return JSON.parse(readFileSync(join(dir, f), "utf-8")) as PlanVersion;
      } catch {
        return null;
      }
    })
    .filter((v): v is PlanVersion => v !== null);
}

export function saveVersion(sessionId: string, plan: string): PlanVersion {
  const dir = historyDir(sessionId);
  mkdirSync(dir, { recursive: true });

  const existing = loadHistory(sessionId);
  // Skip writes for unchanged plans — Claude often re-invokes the hook with
  // identical content after a "request changes" round, and unbounded
  // duplicate entries bloat both disk and the UI's history payload.
  const last = existing.at(-1);
  if (last && last.plan === plan) return last;

  // Derive the next version from the highest existing one, not the count —
  // once the retention cap starts deleting the oldest files, a count-based
  // number would collide with and overwrite a surviving revision.
  const version = (last?.version ?? 0) + 1;
  const entry: PlanVersion = { version, plan, timestamp: Date.now() };

  writeFileSync(
    join(dir, `${String(version).padStart(4, "0")}.json`),
    JSON.stringify(entry),
  );

  // Cap retained revisions for this session, dropping the oldest first.
  // Filenames are zero-padded version numbers, so a lexical sort is oldest→newest.
  try {
    const all = readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .sort();
    if (all.length > MAX_VERSIONS_PER_SESSION) {
      for (const f of all.slice(0, all.length - MAX_VERSIONS_PER_SESSION)) {
        try {
          rmSync(join(dir, f));
        } catch {
          // ignore individual failures
        }
      }
    }
  } catch {
    // readdir failure here is non-fatal — the version was still written
  }

  // Opportunistically prune stale sessions. saveVersion runs once per hook
  // invocation, so this keeps the store bounded without a separate scheduler.
  pruneHistory();

  return entry;
}
