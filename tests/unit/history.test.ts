import { describe, test, expect, afterEach } from "bun:test";
import {
  saveVersion,
  loadHistory,
  pruneHistory,
} from "../../packages/server/history";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const usedSessions = new Set<string>();

function uniqSession(label: string): string {
  const id = `planar-test-history-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  usedSessions.add(id);
  return id;
}

afterEach(() => {
  for (const sid of usedSessions) {
    try {
      rmSync(join(homedir(), ".planar", "history", sid), { recursive: true });
    } catch {}
  }
  usedSessions.clear();
});

describe("history dedupe", () => {
  test("saveVersion writes a new file for a new plan", () => {
    const sid = uniqSession("fresh");
    const v = saveVersion(sid, "# Plan A");
    expect(v.version).toBe(1);
    expect(loadHistory(sid)).toHaveLength(1);
  });

  test("saveVersion does not duplicate identical consecutive plans", () => {
    const sid = uniqSession("dedupe");
    const a = saveVersion(sid, "# Plan A");
    const b = saveVersion(sid, "# Plan A");
    expect(b.version).toBe(a.version);
    expect(b.timestamp).toBe(a.timestamp);
    expect(loadHistory(sid)).toHaveLength(1);
  });

  test("saveVersion writes a new version when the plan actually changes", () => {
    const sid = uniqSession("changes");
    saveVersion(sid, "# Plan A");
    saveVersion(sid, "# Plan A"); // dedupe — no-op
    saveVersion(sid, "# Plan B");
    saveVersion(sid, "# Plan B"); // dedupe — no-op
    saveVersion(sid, "# Plan C");
    const versions = loadHistory(sid);
    expect(versions.map((v) => v.plan)).toEqual([
      "# Plan A",
      "# Plan B",
      "# Plan C",
    ]);
  });
});

describe("history retention", () => {
  test("caps retained revisions per session at 50, dropping the oldest", () => {
    const sid = uniqSession("cap");
    for (let i = 1; i <= 55; i++) saveVersion(sid, `# Plan ${i}`);
    const versions = loadHistory(sid);
    expect(versions).toHaveLength(50);
    // Oldest 5 dropped → first kept revision is "# Plan 6".
    expect(versions[0].plan).toBe("# Plan 6");
    expect(versions.at(-1)!.plan).toBe("# Plan 55");
  });

  test("pruneHistory removes sessions older than the retention window", () => {
    const sid = uniqSession("stale");
    saveVersion(sid, "# Old plan");
    expect(loadHistory(sid)).toHaveLength(1);

    // A fresh session is NOT pruned at the real current time.
    pruneHistory(Date.now());
    expect(loadHistory(sid)).toHaveLength(1);

    // Advancing "now" past the 30-day window prunes the whole session dir.
    pruneHistory(Date.now() + 31 * 24 * 60 * 60 * 1000);
    expect(loadHistory(sid)).toHaveLength(0);
  });
});
