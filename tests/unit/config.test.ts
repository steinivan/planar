import { describe, test, expect, afterEach } from "bun:test";
import {
  loadConfig,
  resolvePort,
  resolveBrowser,
  resolveStdinTimeoutMs,
} from "../../packages/server/config";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const tmpDirs: string[] = [];
function writeConfig(obj: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), "planar-test-config-"));
  tmpDirs.push(dir);
  const path = join(dir, "config.json");
  writeFileSync(path, typeof obj === "string" ? obj : JSON.stringify(obj));
  return path;
}

const savedEnv = { ...process.env };
afterEach(() => {
  process.env = { ...savedEnv };
  for (const d of tmpDirs.splice(0)) {
    try {
      rmSync(d, { recursive: true, force: true });
    } catch {}
  }
});

describe("loadConfig", () => {
  test("reads and sanitizes a valid config", () => {
    const path = writeConfig({
      port: 8080,
      browser: "firefox",
      stdinTimeoutMs: 5000,
    });
    expect(loadConfig(path)).toEqual({
      port: 8080,
      browser: "firefox",
      stdinTimeoutMs: 5000,
    });
  });

  test("drops invalid/unknown keys", () => {
    const path = writeConfig({
      port: -1,
      browser: "   ",
      stdinTimeoutMs: "nope",
      evil: "ignored",
    });
    expect(loadConfig(path)).toEqual({});
  });

  test("returns empty config for a missing file", () => {
    expect(loadConfig(join(tmpdir(), "does-not-exist-xyz.json"))).toEqual({});
  });

  test("returns empty config for malformed JSON", () => {
    const path = writeConfig("{ not valid json");
    expect(loadConfig(path)).toEqual({});
  });
});

describe("resolve* precedence (env > file > default)", () => {
  test("resolvePort prefers env over file", () => {
    process.env.PLANAR_PORT = "9999";
    expect(resolvePort({ port: 8080 })).toBe(9999);
    delete process.env.PLANAR_PORT;
    expect(resolvePort({ port: 8080 })).toBe(8080);
    expect(resolvePort({})).toBeUndefined();
  });

  test("resolveBrowser prefers env over file", () => {
    process.env.PLANAR_BROWSER = "chromium";
    expect(resolveBrowser({ browser: "firefox" })).toBe("chromium");
    delete process.env.PLANAR_BROWSER;
    expect(resolveBrowser({ browser: "firefox" })).toBe("firefox");
    expect(resolveBrowser({})).toBeUndefined();
  });

  test("resolveStdinTimeoutMs falls back env → file → 30s", () => {
    process.env.PLANAR_STDIN_TIMEOUT_MS = "1234";
    expect(resolveStdinTimeoutMs({ stdinTimeoutMs: 5000 })).toBe(1234);
    delete process.env.PLANAR_STDIN_TIMEOUT_MS;
    expect(resolveStdinTimeoutMs({ stdinTimeoutMs: 5000 })).toBe(5000);
    expect(resolveStdinTimeoutMs({})).toBe(30_000);
  });
});
