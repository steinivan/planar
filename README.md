# Planar

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![GitHub release](https://img.shields.io/github/v/release/steinivan/planar)](https://github.com/steinivan/planar/releases)

**Read Claude Code's plans the way you'd read a pull request — and _see_ them as a story.**

Planar is a Claude Code hook. When Claude finishes thinking and calls `ExitPlanMode`, Planar opens a browser review surface where you can comment inline on any block, compare against earlier drafts, and either approve or send changes back — all before a single line of code is written. Its signature view turns a plan into a **visual narrative**: problem → cause → fix → outcome → context, laid out left to right so you grasp the shape of the work — and can confirm Claude understood the result you actually wanted — at a glance.

<!-- TODO: graba tu propio demo (gif/mp4) y enlázalo aquí. No reutilizar assets de otros repos. -->

## Why Planar

A plan is the cheapest place to catch a wrong assumption. Planar makes that review fast and concrete:

- **Graph view — the headline.** A plan can carry a small `planar-graph` block. Planar renders it as a narrative graph (press `g`): each step of the reasoning is its own node, colored by the kind of change, connected by labelled edges. Non-technical at a glance; file/function detail is one click away. See [Graph view](#graph-view).
- **PR-style inline comments.** Select any text or hover a block and drop a comment, exactly like reviewing a diff on GitHub.
- **Draft-to-draft diff.** Claude revises the plan? Compare the new version against any previous one, side-by-side or inline.
- **File peeks.** Click a backtick-wrapped path like `` `src/index.ts` `` (or `src/foo.ts:10-20`) to open a syntax-highlighted drawer with that source — no context-switching to your editor.
- **Code diff review too.** `/diff-review` brings the same inline-comment surface to your unstaged/staged changes before you commit.
- **Parallel by design.** Every plan opens in its own tab; review several Claude Code sessions at once.

## Install

One command. It downloads a prebuilt binary, registers the Claude Code hooks, and adds the `/diff-review` command. Run it again any time to update.

**macOS / Linux**

```sh
curl -fsSL https://raw.githubusercontent.com/steinivan/planar/main/install.sh | bash
```

**Windows (PowerShell)**

```powershell
irm https://raw.githubusercontent.com/steinivan/planar/main/install.ps1 | iex
```

Pin a specific version:

```sh
# macOS / Linux
curl -fsSL https://raw.githubusercontent.com/steinivan/planar/main/install.sh | bash -s -- --version v0.1.0

# Windows (PowerShell)
$env:PLANAR_VERSION="v0.1.0"; irm https://raw.githubusercontent.com/steinivan/planar/main/install.ps1 | iex
```

**Supported:** macOS (arm64, x64), Linux (x64), Windows (x64).

### Manual setup

Grab the binary for your platform from [Releases](https://github.com/steinivan/planar/releases):

| Platform    | Binary                   |
| ----------- | ------------------------ |
| macOS arm64 | `planar-darwin-arm64`    |
| macOS x64   | `planar-darwin-x64`      |
| Linux x64   | `planar-linux-x64`       |
| Windows x64 | `planar-windows-x64.exe` |

**macOS / Linux:**

```sh
mkdir -p ~/.planar
curl -fSL https://github.com/steinivan/planar/releases/latest/download/planar-darwin-arm64 -o ~/.planar/planar
chmod +x ~/.planar/planar
```

**Windows (PowerShell):**

```powershell
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.planar" | Out-Null
Invoke-WebRequest -Uri "https://github.com/steinivan/planar/releases/latest/download/planar-windows-x64.exe" -OutFile "$env:USERPROFILE\.planar\planar.exe"
```

Then wire up the hooks in your Claude Code settings (`~/.claude/settings.json` for global, `.claude/settings.json` per-project, or `.claude/settings.local.json` for local-only):

```json
{
  "hooks": {
    "PermissionRequest": [
      {
        "matcher": "ExitPlanMode",
        "hooks": [
          {
            "type": "command",
            "command": "~/.planar/planar",
            "timeout": 345600
          }
        ]
      }
    ],
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "~/.planar/planar session-context"
          }
        ]
      }
    ]
  }
}
```

The `SessionStart` hook is optional but recommended — it teaches Claude the `planar-graph` convention so the graph view works with zero per-project setup. On Windows, use the full path with **forward slashes** — Claude Code may run the hook through a shell where backslashes are escape characters: `"command": "C:/Users/<you>/.planar/planar.exe"` (and `"...planar.exe session-context"`).

For the `/diff-review` slash command, create `~/.claude/commands/diff-review.md` — see `install.sh` for the template.

**Good to know:**

- `"matcher": "ExitPlanMode"` — the hook fires only when Claude exits plan mode, never on other permission requests.
- `"timeout": 345600` — 4 days, in seconds. The process blocks until you decide, so give yourself room. Take your time on a plan.
- Run `/hooks` inside Claude Code to confirm the hook is registered.

## Using it

1. Work with Claude Code as usual. When it produces a plan and calls `ExitPlanMode`, Planar steps in.
2. A browser tab opens with the plan.
3. **Comment:** select text → "Add Comment", or hover a block and hit the **+** in the gutter.
4. **General notes:** use the text area at the bottom for anything not tied to a block.
5. **Accept** (green) lets Claude proceed. **Request Changes** (amber) sends your inline comments and notes back to Claude.
6. The tab closes itself once you submit.

## Diff Review

Review code before you commit:

1. Run `/diff-review` (or `~/.planar/planar diff-review` directly).
2. A tab opens with your changed files and a unified diff.
3. Navigate files from the left sidebar; comment on any line with the **+** gutter button.
4. **Approve** or **Request Changes** — feedback goes back to Claude.

Flags: `--staged` (staged only), `--all` (everything vs HEAD).

## Graph view

When a plan carries a fenced ` ```planar-graph ` block, Planar shows a **Document / Graph** toggle (or press `g`). The graph is the non-technical, at-a-glance view of the work, in one of two layouts:

- **Narrative mode (recommended).** When nodes declare a `role`, the graph reads left-to-right as a story: **Problem → Cause → Fix → Outcome → Context**, one colored swimlane per role. The **Outcome** column states the expected result, so you can check at a glance whether the plan targets what you actually wanted. Each reasoning step is its own node, so a reviewer takes in the same thing as the prose, just spatially. The repository shows up as a tag on each node.
- **Repo mode (fallback).** With no roles, nodes group into a box per repository — handy for seeing the scope of a change that spans repos (e.g. `web` ↔ `backend`) and how the pieces connect.

Node borders are colored by change type (added / modified / removed). Click **More details** on a node for the technical detail (files, functions). Comments on nodes and edges fold into the same approve / request-changes feedback as the document view.

**Claude emits the block for you.** The installer's `SessionStart` hook (`planar session-context`) injects the authoring guide into every session, so Claude knows to produce a `planar-graph` block when a plan spans multiple components or repos — no per-project setup. If a plan has no block, Planar just shows the normal document view.

The block is plain JSON:

````md
```planar-graph
{
  "nodes": [
    { "id": "goal", "role": "problem", "label": "No one-click checkout",
      "summary": "Returning buyers must re-enter card details every time" },
    { "id": "cart", "role": "fix", "repo": "web", "label": "Cart pay button", "change": "modified",
      "summary": "Adds a one-click pay button that reuses the saved card",
      "files": ["src/routes/cart.svelte"], "functions": ["renderOneClick()"] },
    { "id": "charge", "role": "fix", "repo": "backend", "label": "Charge endpoint", "change": "added",
      "summary": "Charges the saved payment method",
      "files": ["api/payments/charge.ts"], "functions": ["POST /payments/charge"] },
    { "id": "result", "role": "outcome", "label": "Checkout in one tap",
      "summary": "Returning buyers complete a purchase without re-entering card details" },
    { "id": "vault", "role": "context", "repo": "backend", "label": "Saved-card vault", "change": "unchanged",
      "summary": "Existing store of tokenized cards the charge relies on" }
  ],
  "edges": [
    { "from": "goal", "to": "cart", "label": "solved by" },
    { "from": "cart", "to": "charge", "label": "POST charge" },
    { "from": "charge", "to": "result", "label": "enables" },
    { "from": "charge", "to": "vault", "label": "reads token" }
  ]
}
```
````

Fields:

| Field                         | Where          | Meaning                                                                                                                                |
| ----------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `nodes[].id`                  | required       | Unique node id.                                                                                                                        |
| `nodes[].role`                | columns        | `problem` \| `cause` \| `fix` \| `outcome` \| `context`. Drives narrative mode. `outcome` = the expected result. Set it on every node. |
| `nodes[].label`               | shown in graph | Short, concrete name (defaults to `id`).                                                                                               |
| `nodes[].summary`             | shown in graph | One-line plain-language description.                                                                                                   |
| `nodes[].repo`                | grouping / tag | Repository the node belongs to → a labelled container (repo mode) or a tag (narrative mode).                                           |
| `nodes[].change`              | node color     | `added` \| `modified` \| `removed` \| `unchanged` (default).                                                                           |
| `nodes[].files` / `functions` | side panel     | Technical detail shown on **Más detalles**.                                                                                            |
| `edges[].from` / `to`         | connection     | Must reference existing node ids.                                                                                                      |
| `edges[].label`               | on the edge    | Describes the connection (e.g. "POST charge").                                                                                         |

If the block is missing or malformed, Planar silently falls back to the document view.

## Configuration

| Variable         | Description                                                                                                                                                 | Default          |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| `PLANAR_BROWSER` | Browser executable plus optional flags, space-separated (e.g. `firefox`, `firefox --new-window`). No shell expansion — paths with spaces are not supported. | Platform default |
| `PLANAR_PORT`    | Preferred port; falls back to an OS-assigned ephemeral port if busy.                                                                                        | OS-assigned      |

Platform defaults: `open` (macOS), `xdg-open` (Linux), `cmd /c start` (Windows).

Beyond `PLANAR_STDIN_TIMEOUT_MS` (the stdin read deadline, default 30000), you can set the same options in an optional config file at `~/.planar/config.json` instead of exporting environment variables. Environment variables win over the file when both are set:

```json
{
  "port": 7777,
  "browser": "firefox --new-window",
  "stdinTimeoutMs": 60000
}
```

The UI ships light and dark themes — toggle with the sun/moon button; your choice persists. Plan-bearing graphs reopen in your last-used view (document or graph), and the file-preview drawer remembers its width.

## Development

Needs [Bun](https://bun.sh).

**Dev preview** — UI with HMR and a mock API, no hook server needed:

```sh
cd packages/ui && bun run dev
```

Opens at `http://localhost:5173` with a sample plan; Accept/Deny log to the terminal.

**Build** — compile the standalone binary (embeds the Bun runtime and the built UI):

```sh
bun run build   # produces ./planar
```

**Manual test** — pipe a fake plan into the binary:

```sh
printf '{"tool_input":{"plan":"# Test Plan\n\n## Step 1\nDo something"},"permission_mode":"default"}' | ./planar
```

**Tests:**

```sh
bun run test       # unit + integration
bun run test:e2e   # Playwright
bun run test:all   # everything
```

**Formatting:**

```sh
bun run format        # auto-fix
bun run format:check  # check only
```

## Uninstall

**macOS / Linux:**

```sh
rm -rf ~/.planar
rm -f ~/.claude/commands/diff-review.md
```

**Windows (PowerShell):**

```powershell
Remove-Item -Recurse -Force "$env:USERPROFILE\.planar"
Remove-Item -Force "$env:USERPROFILE\.claude\commands\diff-review.md" -ErrorAction SilentlyContinue
```

Then remove the `ExitPlanMode` and `SessionStart` Planar hooks from `~/.claude/settings.json`.
</content>
</invoke>
