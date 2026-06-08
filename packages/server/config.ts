import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// Optional config file at ~/.planar/config.json. Lets users set defaults
// without exporting environment variables on every run. Environment variables
// still win over the file (see the resolve* helpers below), and the file is
// entirely optional — a missing or malformed file yields an empty config.
export interface PlanarConfig {
  /** Preferred port (falls back to an OS-assigned ephemeral port if busy). */
  port?: number;
  /** Browser launch command, e.g. "firefox --new-window". */
  browser?: string;
  /** Stdin read deadline in milliseconds. */
  stdinTimeoutMs?: number;
}

function configPath(): string {
  return process.env.PLANAR_CONFIG || join(homedir(), ".planar", "config.json");
}

// Only copies known, well-typed keys so a hand-edited file can't inject
// unexpected values into the rest of the app.
function sanitize(raw: Record<string, unknown>): PlanarConfig {
  const cfg: PlanarConfig = {};
  if (typeof raw.port === "number" && raw.port > 0) cfg.port = raw.port;
  if (typeof raw.browser === "string" && raw.browser.trim())
    cfg.browser = raw.browser;
  if (typeof raw.stdinTimeoutMs === "number" && raw.stdinTimeoutMs > 0)
    cfg.stdinTimeoutMs = raw.stdinTimeoutMs;
  return cfg;
}

export function loadConfig(path: string = configPath()): PlanarConfig {
  try {
    const parsed = JSON.parse(readFileSync(path, "utf-8")) as Record<
      string,
      unknown
    >;
    return sanitize(parsed);
  } catch {
    return {}; // no file, unreadable, or invalid JSON → no config
  }
}

/** Preferred port: PLANAR_PORT env wins, then the config file, else undefined. */
export function resolvePort(
  config: PlanarConfig = loadConfig(),
): number | undefined {
  const env = process.env.PLANAR_PORT;
  if (env) {
    const parsed = parseInt(env, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return config.port;
}

/** Browser command: PLANAR_BROWSER env wins, then the config file. */
export function resolveBrowser(
  config: PlanarConfig = loadConfig(),
): string | undefined {
  return process.env.PLANAR_BROWSER ?? config.browser;
}

/** Stdin timeout: PLANAR_STDIN_TIMEOUT_MS env wins, then config, else 30s. */
export function resolveStdinTimeoutMs(
  config: PlanarConfig = loadConfig(),
): number {
  const env = Number(process.env.PLANAR_STDIN_TIMEOUT_MS);
  if (env > 0) return env;
  return config.stdinTimeoutMs ?? 30_000;
}
