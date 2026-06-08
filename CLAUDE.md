# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is Planar

Planar — a Claude Code hook that intercepts `ExitPlanMode`, opens a browser-based plan review UI (PR-style inline comments, plus a `planar-graph` narrative view that reads problem → cause → fix), and sends the user's decision back to Claude Code via stdout.

## Commands

```sh
bun install                # install dependencies
bun run build              # build UI then compile self-contained binary → ./planar
bun run test               # unit + integration tests (bun test tests/unit tests/integration)
bun run test:e2e           # Playwright browser tests (requires chromium)
bun run test:all           # all tests
bun run format             # prettier auto-fix
bun run format:check       # prettier check only
cd packages/ui && bun run dev  # Vite dev server with mock API at localhost:5173
```

Manual test the binary: `printf '{"tool_input":{"plan":"# Test\\n\\nStep 1"},"permission_mode":"default"}' | ./planar`

## Architecture

Bun monorepo: the binary entrypoint lives in `src/`; reusable libraries are workspaces under `packages/*`.

### Build pipeline

1. `packages/ui` builds with Vite + `vite-plugin-singlefile` → single `index.html` (all JS/CSS inlined)
2. `src/index.ts` is compiled with `bun build --compile` → `./planar` binary that embeds the HTML (the UI is imported by `packages/server` via `import html from "../ui/dist/index.html" with { type: "text" }`)

### Layout

- **`src/`** — Binary entrypoint (not a workspace package; it's the root project's source). `index.ts` reads Claude Code's JSON from stdin, starts an in-process `Bun.serve` on an ephemeral port (or `PLANAR_PORT` if set), opens the browser, awaits the user's decision via an in-process Promise, writes JSON to stdout, exits. CLI plumbing is split into `signals.ts` (termination signals), `outputs.ts` (the stdout decision contract), and `graph-guide.ts` (the `planar-graph` convention text). Subcommands: `diff-review` (git diff review) and `session-context` (prints a `SessionStart` hook payload whose `additionalContext` teaches Claude the `planar-graph` convention — registered by the installer so the graph view works with zero per-project setup).
- **`packages/server/`** — HTTP server (`Bun.serve`), session management, all API routes, SSE broadcasting for the UI, plan version history (`history.ts`), browser launching (`browser.ts`), update checking (`update.ts`).
- **`packages/ui/`** — Svelte 5 frontend. `App.svelte` orchestrates session state and SSE subscriptions. Components in `lib/`, pure utilities in `utils/`.
- **`packages/shared/`** — The data contract that crosses the server ↔ UI boundary (`SessionSummary`, `FileSnippet`, `FileDiff`, `PlanVersion`, …), so the two sides can't drift. Re-exported by `packages/server` and `packages/ui/src/types.ts`.

### Single-process design

Each hook invocation owns its own ephemeral server. There is no shared helper, no lock file, no inter-process coordination. N concurrent hooks → N tabs. SIGINT/SIGTERM resolve the in-flight session as `deny` so stdout is always well-formed.

### Key data flow

stdin JSON → `readStdinWithTimeout()` → `resolveSnippets()` → `Bun.serve()` on ephemeral port → `addSession()` returns Promise → `openBrowser()` (detached, fire-and-forget) → user reviews in Svelte UI → approve/deny POST → `resolveSession()` resolves the Promise → `outputDecision()` writes to stdout → `server.stop()` in finally → exit.

## Tech stack

- **Runtime/bundler:** Bun
- **UI framework:** Svelte 5 (runes: `$state`, `$derived`, `$effect`, `$props`)
- **Build:** Vite with `vite-plugin-singlefile`
- **Tests:** Bun test (unit/integration), Playwright (e2e)
- **Formatting:** Prettier with `prettier-plugin-svelte`

## Conventions

- Markdown rendering uses `marked` (via `utils/markedRenderer.ts`) with a custom renderer that injects `data-unit-id` attributes for annotation mapping. The renderer produces `{ html, units, title }` where `units` are annotatable semantic elements (headings, paragraphs, list items, code lines, table rows, blockquotes).
- The diff engine in `utils/diff.ts` uses LCS — keep it dependency-free.
- **Graph view:** an optional ` ```planar-graph ` JSON block in the plan is parsed client-side (`utils/parseGraph.ts`) from `SessionSummary.plan` — no server/hook changes. The block is stripped before `renderPlan` so the document view never shows raw JSON. `utils/graphLayout.ts` lays out the graph in one of two modes (returned as `mode` on `LaidOutGraph`): **role mode** (when any node has a `role` of `problem`/`cause`/`fix`/`context`) arranges nodes into left-to-right swimlane columns by role (`bands`, rendered by `lib/RoleBandNode.svelte`), with `repo` shown as a tag on the node; **repo mode** (the fallback, no roles) uses dagre with one bounding-box container per `repo` (`containers`, rendered by `lib/RepoGroupNode.svelte`). Both render with `@xyflow/svelte` in `lib/GraphReviewApp.svelte`. The graph is non-technical (`label`/`summary`); technical detail (`files`/`functions`) appears only in the per-node side panel (`lib/GraphNodeDetailPanel.svelte`). Node/edge comments (`GraphAnnotation`) are formatted by `utils/graphFeedback.ts` and merged with document feedback in `App.svelte`'s `submitDecision`. `parseGraph`, `graphFeedback`, and `graphLayout` are dependency-light/pure and unit-tested.
- UI state is per-session via a `Map<sessionId, SessionUIState>` with save/restore on tab switching (the UI still supports multiple sessions per server even though hooks now only register one each).
- `PLANAR_PORT` is a _preferred_ port; if it's already in use the hook falls back to an OS-assigned ephemeral port.
- `PLANAR_BROWSER` overrides the browser-launch command. `PLANAR_BROWSER=true` is used in tests to no-op the launch.
- `PLANAR_STDIN_TIMEOUT_MS` overrides the stdin read deadline (default 30000) — used in tests.
