import {
  startServer,
  type PlanarServer,
  type SessionInput,
  type SessionDecision,
} from "../packages/server/index.ts";
import { openBrowser } from "../packages/server/browser.ts";
import { loadHistory, saveVersion } from "../packages/server/history.ts";
import { checkForUpdate } from "../packages/server/update.ts";
import { resolveSnippets } from "../packages/server/snippets.ts";
import { readPlanFromDisk } from "../packages/server/plan-file.ts";
import {
  runGitDiff,
  parseUnifiedDiff,
  type DiffMode,
} from "../packages/server/git-diff.ts";
import {
  resolvePort,
  resolveStdinTimeoutMs,
} from "../packages/server/config.ts";
import { onceSignals, offSignals } from "./signals.ts";
import { outputDecision } from "./outputs.ts";
import { sessionContextMain } from "./graph-guide.ts";

const VERSION = "dev";
const STDIN_TIMEOUT_MS = resolveStdinTimeoutMs();

// Platform-aware upgrade hint printed to stderr when a newer release exists.
const UPGRADE_HINT =
  process.platform === "win32"
    ? "irm https://raw.githubusercontent.com/steinivan/planar/main/install.ps1 | iex"
    : "curl -fsSL https://raw.githubusercontent.com/steinivan/planar/main/install.sh | bash";

interface HookInput {
  tool_input: {
    plan?: string;
    [key: string]: unknown;
  };
  session_id?: string;
  permission_mode?: string;
  cwd?: string;
  transcript_path?: string;
  [key: string]: unknown;
}

async function readStdinWithTimeout(timeoutMs: number): Promise<string> {
  const chunks: Buffer[] = [];
  const reader = Bun.stdin.stream().getReader();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error("stdin read timeout")),
      timeoutMs,
    );
  });
  try {
    while (true) {
      const { value, done } = await Promise.race([reader.read(), timeout]);
      if (done) break;
      if (value) chunks.push(Buffer.from(value));
    }
  } finally {
    clearTimeout(timer);
    try {
      reader.releaseLock();
    } catch {
      // ignore
    }
  }
  return Buffer.concat(chunks).toString("utf-8");
}

// Bootstrap signal handler: covers the window between process start and the
// moment runOneShotReview has wired session-aware handlers. Without this, a
// SIGTERM during stdin read or snippet resolution would default-kill the
// process and Claude Code would see an empty stdout.
function bootstrapSignalHandler(): void {
  outputDecision("deny", "Planar: hook canceled before review started");
  process.exit(0);
}

function startServerWithFallback(
  preferredPort: number | undefined,
  latestVersion: string | undefined,
): PlanarServer {
  if (preferredPort !== undefined) {
    try {
      return startServer({
        port: preferredPort,
        version: VERSION,
        latestVersion,
      });
    } catch (err: unknown) {
      const code =
        err && typeof err === "object" && "code" in err
          ? (err as { code: string }).code
          : undefined;
      if (code === "EADDRINUSE") {
        console.error(
          `Planar: port ${preferredPort} in use, falling back to ephemeral port`,
        );
      } else {
        // Unknown error shape — log it and still fall back. Failing to fall
        // back means the user's plan gets denied because of a port issue,
        // which is worse UX than running on an OS-assigned port.
        const message = err instanceof Error ? err.message : String(err);
        console.error(
          `Planar: failed to bind preferred port ${preferredPort} (${message}); falling back to ephemeral port`,
        );
      }
    }
  }
  return startServer({ version: VERSION, latestVersion });
}

function getPreferredPort(): number | undefined {
  // PLANAR_PORT env wins, then ~/.planar/config.json's "port".
  return resolvePort();
}

async function runOneShotReview(
  input: SessionInput,
  latestVersion: string | undefined,
): Promise<SessionDecision> {
  const server = startServerWithFallback(getPreferredPort(), latestVersion);
  const decisionPromise = server.addSession(input);

  // We swap the bootstrap fallback handler (registered in main()) for one
  // that resolves the in-flight session as `deny`, so the await below
  // unblocks and the finally clause stops the server cleanly.
  offSignals(bootstrapSignalHandler);
  const onSignal = () => {
    server.resolveSession(input.sessionId, {
      behavior: "deny",
      feedback: "Hook canceled (parent process exited)",
    });
  };
  onceSignals(onSignal);

  const url = `http://localhost:${server.port}`;
  console.error(
    `Planar ${VERSION} listening on ${url} (session=${input.sessionId})`,
  );
  openBrowser(url);

  try {
    return await decisionPromise;
  } finally {
    offSignals(onSignal);
    server.stop();
  }
}

async function main() {
  onceSignals(bootstrapSignalHandler);

  let raw: string;
  try {
    raw = await readStdinWithTimeout(STDIN_TIMEOUT_MS);
  } catch (err) {
    console.error(`Planar: ${err}`);
    outputDecision("deny", "Planar: no input received from Claude Code");
    process.exit(1);
  }

  let input: HookInput;
  try {
    input = JSON.parse(raw);
  } catch {
    console.error("Planar: failed to parse stdin JSON");
    outputDecision("deny", "Planar: invalid input JSON");
    process.exit(1);
  }

  const plan =
    input.tool_input?.plan || readPlanFromDisk(input.transcript_path);
  const permissionMode = input.permission_mode || "default";
  const sessionId = input.session_id || `anon-${Date.now()}`;

  console.error(
    `Planar: session=${sessionId} permissionMode=${permissionMode}`,
  );

  if (!plan) {
    console.error("Planar: no plan found in stdin or on disk");
    outputDecision(
      "deny",
      "Planar could not find a plan. Ensure ~/.claude/plans/ contains a plan file.",
    );
    process.exit(1);
  }

  saveVersion(sessionId, plan);
  // history.ts skips duplicate writes, so the current plan only appears in
  // history if it's distinct from the prior version. Show the rest as
  // "previous" for the diff UI.
  const previousPlans = loadHistory(sessionId).slice(0, -1);

  const cwd = input.cwd || process.cwd();
  const fileSnippets = await resolveSnippets(plan, cwd);

  const latestVersion = (await checkForUpdate(VERSION)) || undefined;
  if (latestVersion) {
    console.error(
      `\nPlanar ${latestVersion} is available (current: ${VERSION}). Upgrade: ${UPGRADE_HINT}\n`,
    );
  }

  const decision = await runOneShotReview(
    {
      sessionId,
      plan,
      permissionMode,
      previousPlans,
      fileSnippets,
    },
    latestVersion,
  );
  outputDecision(decision.behavior, decision.feedback, decision.acceptMode);
}

async function diffReviewMain() {
  onceSignals(bootstrapSignalHandler);

  const drIdx = process.argv.indexOf("diff-review");
  const args = drIdx >= 0 ? process.argv.slice(drIdx + 1) : [];
  let diffMode: DiffMode = "unstaged";
  if (args.includes("--staged")) diffMode = "staged";
  else if (args.includes("--all")) diffMode = "all";

  const cwd = process.cwd();
  console.error(`Planar diff-review: mode=${diffMode} cwd=${cwd}`);

  let raw: string;
  try {
    raw = await runGitDiff(cwd, diffMode);
  } catch (err) {
    console.error(`Planar: git diff failed: ${err}`);
    outputDecision("deny", `git diff failed: ${err}`);
    process.exit(1);
  }

  const fileDiffs = parseUnifiedDiff(raw);
  if (fileDiffs.length === 0) {
    console.error("No changes to review.");
    process.exit(0);
  }
  console.error(`Planar: ${fileDiffs.length} file(s) changed`);

  const sessionId = `review-${Date.now()}`;
  const latestVersion = (await checkForUpdate(VERSION)) || undefined;
  if (latestVersion) {
    console.error(
      `\nPlanar ${latestVersion} is available (current: ${VERSION}). Upgrade: ${UPGRADE_HINT}\n`,
    );
  }

  const decision = await runOneShotReview(
    {
      sessionId,
      plan: "",
      permissionMode: "review",
      mode: "diff-review",
      fileDiffs,
      cwd,
    },
    latestVersion,
  );
  outputDecision(decision.behavior, decision.feedback, decision.acceptMode);
}

// `planar --version` / `-v`: print the build version and exit. Handled before
// the hook dispatch so it never blocks on stdin.
if (process.argv.includes("--version") || process.argv.includes("-v")) {
  console.log(VERSION);
  process.exit(0);
}

const subcommand = process.argv.find(
  (a) => a === "diff-review" || a === "session-context",
);

if (subcommand === "session-context") {
  sessionContextMain();
} else if (subcommand === "diff-review") {
  diffReviewMain().catch((err) => {
    console.error("Planar fatal error:", err);
    outputDecision("deny", "Planar internal error. Please retry.");
    process.exit(1);
  });
} else {
  main().catch((err) => {
    console.error("Planar fatal error:", err);
    outputDecision("deny", "Planar internal error. Please retry.");
    process.exit(1);
  });
}
