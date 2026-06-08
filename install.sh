#!/usr/bin/env bash
set -euo pipefail

PLANAR_DIR="$HOME/.planar"
CLAUDE_SETTINGS="$HOME/.claude/settings.json"
REPO="steinivan/planar"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}==>${NC} $1"; }
warn()  { echo -e "${YELLOW}==>${NC} $1"; }
error() { echo -e "${RED}==>${NC} $1"; exit 1; }

# Check prerequisites
command -v curl >/dev/null 2>&1 || error "curl is required but not installed."
command -v python3 >/dev/null 2>&1 || error "python3 is required but not installed."

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --version|-v)
      if [[ $# -lt 2 || -z "${2:-}" ]]; then
        error "--version requires a value"
      fi
      PLANAR_VERSION="$2"; shift 2 ;;
    *) error "Unknown argument: $1" ;;
  esac
done

# Self-redirect: re-fetch install.sh from the target version's branch/tag
if [ -n "${PLANAR_VERSION:-}" ] && [ -z "${_PLANAR_REDIRECTED:-}" ]; then
  info "Fetching installer for version: $PLANAR_VERSION..."
  export _PLANAR_REDIRECTED=1
  export PLANAR_VERSION
  curl -fsSL "https://raw.githubusercontent.com/$REPO/$PLANAR_VERSION/install.sh" | bash
  exit $?
fi

# Detect platform
OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS" in
  Darwin) OS_TAG="darwin" ;;
  Linux)  OS_TAG="linux" ;;
  *)      error "Unsupported OS: $OS" ;;
esac

case "$ARCH" in
  arm64|aarch64) ARCH_TAG="arm64" ;;
  x86_64)        ARCH_TAG="x64" ;;
  *)             error "Unsupported architecture: $ARCH" ;;
esac

TARGET="planar-${OS_TAG}-${ARCH_TAG}"

# Determine download URL
if [ -n "${PLANAR_VERSION:-}" ]; then
  DOWNLOAD_URL="https://github.com/$REPO/releases/download/$PLANAR_VERSION/$TARGET"
else
  DOWNLOAD_URL="https://github.com/$REPO/releases/latest/download/$TARGET"
fi

# Download binary
info "Downloading Planar ($TARGET)..."
mkdir -p "$PLANAR_DIR"
curl -fSL "$DOWNLOAD_URL" -o "$PLANAR_DIR/planar"
chmod +x "$PLANAR_DIR/planar"

# Ad-hoc sign on macOS to satisfy Gatekeeper/provenance checks
if [ "$OS" = "Darwin" ] && command -v codesign >/dev/null 2>&1; then
  codesign -f -s - "$PLANAR_DIR/planar" 2>/dev/null || warn "Ad-hoc signing failed — binary may be blocked by macOS"
fi

# Install /diff-review command
info "Installing /diff-review command..."
COMMANDS_DIR="$HOME/.claude/commands"
mkdir -p "$COMMANDS_DIR"

cat > "$COMMANDS_DIR/diff-review.md" << 'CMD_EOF'
---
description: Review code diffs interactively using Planar
argument-hint: [--staged] [--all]
---

Run Planar's interactive diff review. This opens a browser UI where you can review
changed files side-by-side with inline commenting, then submit feedback.

## Your task

Run the Planar diff-review command. Pass through any arguments the user provided.
The command will open a browser window — wait for it to complete (the user will
approve or deny in the browser). Then relay the feedback output to the user.

```bash
~/.planar/planar diff-review $ARGUMENTS
```

After the command completes, relay the feedback output to the user.
If the binary is not found, tell the user to install Planar:
curl -fsSL https://raw.githubusercontent.com/steinivan/planar/main/install.sh | bash
CMD_EOF

# Register Claude Code hook + clean up stale plugin entries
info "Configuring Claude Code..."

python3 -c "
import json, os

settings_path = os.path.expanduser('$CLAUDE_SETTINGS')
plugins_path = os.path.expanduser('$HOME/.claude/plugins/installed_plugins.json')
hook_cmd = os.path.expanduser('$PLANAR_DIR/planar')

# --- settings.json: hook ---
try:
    with open(settings_path) as f:
        settings = json.load(f)
except (FileNotFoundError, json.JSONDecodeError):
    settings = {}

hooks = settings.setdefault('hooks', {})
perm = hooks.setdefault('PermissionRequest', [])

# Remove any existing Planar hook to avoid duplicates
perm[:] = [
    h for h in perm
    if not (h.get('matcher') == 'ExitPlanMode' and
            any('.planar/' in x.get('command', '') for x in h.get('hooks', [])))
]

perm.append({
    'matcher': 'ExitPlanMode',
    'hooks': [{'type': 'command', 'command': hook_cmd, 'timeout': 345600}]
})

# --- settings.json: SessionStart hook (teaches Claude the planar-graph convention) ---
sess = hooks.setdefault('SessionStart', [])
sess[:] = [
    h for h in sess
    if not any('.planar/' in x.get('command', '') for x in h.get('hooks', []))
]
sess.append({
    'hooks': [{'type': 'command', 'command': hook_cmd + ' session-context'}]
})

# Clean up stale plugin entries from previous installs
if 'enabledPlugins' in settings:
    settings['enabledPlugins'].pop('planar@local', None)
    if not settings['enabledPlugins']:
        del settings['enabledPlugins']

with open(settings_path, 'w') as f:
    json.dump(settings, f, indent=2)
    f.write('\n')

# --- Clean up stale installed_plugins.json entries ---
try:
    with open(plugins_path) as f:
        plugins_data = json.load(f)
    if 'plugins' in plugins_data and 'planar@local' in plugins_data['plugins']:
        del plugins_data['plugins']['planar@local']
        with open(plugins_path, 'w') as f:
            json.dump(plugins_data, f, indent=2)
            f.write('\n')
except (FileNotFoundError, json.JSONDecodeError):
    pass
"

# Clean up stale plugin directory from previous installs
rm -rf "$PLANAR_DIR/plugin"

info "Done! Planar is installed and configured."
echo ""
echo "  Hook:     ExitPlanMode → ~/.planar/planar"
echo "  Hook:     SessionStart → ~/.planar/planar session-context (teaches Claude the planar-graph block)"
echo "  Command:  /diff-review → ~/.planar/planar diff-review"
echo ""
echo "  Verify:   claude and run /hooks or /diff-review"
echo "  Uninstall: rm -rf ~/.planar && rm -f ~/.claude/commands/diff-review.md"
echo "             (then remove Planar hook from ~/.claude/settings.json)"
