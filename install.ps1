$ErrorActionPreference = "Stop"

$PlanarDir = "$env:USERPROFILE\.planar"
$ClaudeSettings = "$env:USERPROFILE\.claude\settings.json"
$Repo = "steinivan/planar"
$Binary = "planar-windows-x64.exe"

# Determine download URL
if ($env:PLANAR_VERSION) {
    $DownloadUrl = "https://github.com/$Repo/releases/download/$env:PLANAR_VERSION/$Binary"
} else {
    $DownloadUrl = "https://github.com/$Repo/releases/latest/download/$Binary"
}

# Download binary
Write-Host "==> Downloading Planar ($Binary)..." -ForegroundColor Green
New-Item -ItemType Directory -Force -Path $PlanarDir | Out-Null
Invoke-WebRequest -Uri $DownloadUrl -OutFile "$PlanarDir\planar.exe" -UseBasicParsing

# Register Claude Code hook
Write-Host "==> Configuring Claude Code hook..." -ForegroundColor Green
$ClaudeDir = Split-Path $ClaudeSettings
New-Item -ItemType Directory -Force -Path $ClaudeDir | Out-Null

$HookCmd = "$PlanarDir\planar.exe"

$settings = @{}
if (Test-Path $ClaudeSettings) {
    try {
        $settings = Get-Content $ClaudeSettings -Raw | ConvertFrom-Json -AsHashtable
    } catch {}
}

if (-not $settings.ContainsKey("hooks")) { $settings["hooks"] = @{} }
if (-not $settings["hooks"].ContainsKey("PermissionRequest")) { $settings["hooks"]["PermissionRequest"] = @() }

# Remove any existing Planar hook to avoid duplicates
$settings["hooks"]["PermissionRequest"] = @(
    $settings["hooks"]["PermissionRequest"] | Where-Object {
        -not ($_.matcher -eq "ExitPlanMode" -and ($_.hooks | Where-Object { $_.command -like "*.planar*" }))
    }
)

$settings["hooks"]["PermissionRequest"] += @{
    matcher = "ExitPlanMode"
    hooks = @(
        @{
            type = "command"
            command = $HookCmd
            timeout = 345600
        }
    )
}

# SessionStart hook: teaches Claude the planar-graph convention
if (-not $settings["hooks"].ContainsKey("SessionStart")) { $settings["hooks"]["SessionStart"] = @() }
$settings["hooks"]["SessionStart"] = @(
    $settings["hooks"]["SessionStart"] | Where-Object {
        -not ($_.hooks | Where-Object { $_.command -like "*.planar*" })
    }
)
$settings["hooks"]["SessionStart"] += @{
    hooks = @(
        @{
            type = "command"
            command = "$HookCmd session-context"
        }
    )
}

$settings | ConvertTo-Json -Depth 10 | Set-Content $ClaudeSettings -Encoding UTF8

Write-Host "==> Done! Planar is installed and configured." -ForegroundColor Green
Write-Host ""
Write-Host "  Hook:        ExitPlanMode  -> $HookCmd"
Write-Host "  Hook:        SessionStart  -> $HookCmd session-context (teaches Claude the planar-graph block)"
Write-Host "  Verify with: claude and run /hooks"
Write-Host "  Uninstall:   Remove-Item -Recurse -Force ~\.planar"
Write-Host "               (then remove the ExitPlanMode and SessionStart hooks from ~\.claude\settings.json)"
