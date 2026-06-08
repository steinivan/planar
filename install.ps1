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

# Forward slashes: Claude Code may run the hook command through a POSIX-style
# shell where backslashes are escape characters; "/" works on Windows for an
# executable path and avoids that.
$HookCmd = ("$PlanarDir\planar.exe") -replace '\\', '/'

# Merge into the existing settings.json, preserving every other setting and any
# non-Planar hooks. Uses ConvertFrom-Json (PSCustomObject) instead of
# `-AsHashtable`, which does NOT exist on Windows PowerShell 5.1 — there it threw
# and the catch silently reset settings to empty, wiping the user's config.
$settings = $null
if (Test-Path $ClaudeSettings) {
    try { $settings = Get-Content $ClaudeSettings -Raw | ConvertFrom-Json } catch { $settings = $null }
}
if ($null -eq $settings) { $settings = [PSCustomObject]@{} }

function Set-Prop($obj, $name, $value) {
    if ($obj.PSObject.Properties.Name -contains $name) { $obj.$name = $value }
    else { $obj | Add-Member -NotePropertyName $name -NotePropertyValue $value -Force }
}

# Drop existing Planar entries (command path contains ".planar") from a hook array.
function Remove-PlanarEntries($arr) {
    if ($null -eq $arr) { return @() }
    return @($arr | Where-Object {
        $cmds = @($_.hooks | ForEach-Object { $_.command })
        -not ($cmds -like '*.planar*')
    })
}

if (-not ($settings.PSObject.Properties.Name -contains 'hooks') -or $null -eq $settings.hooks) {
    Set-Prop $settings 'hooks' ([PSCustomObject]@{})
}
$hooks = $settings.hooks

# PermissionRequest -> ExitPlanMode. Wrap in @(...) so a single surviving entry
# stays an array (PowerShell unwraps 1-element arrays returned from a function,
# which would break the += below).
$pr = @(Remove-PlanarEntries $hooks.PermissionRequest)
$pr += [PSCustomObject]@{
    matcher = 'ExitPlanMode'
    hooks   = @([PSCustomObject]@{ type = 'command'; command = $HookCmd; timeout = 345600 })
}
Set-Prop $hooks 'PermissionRequest' @($pr)

# SessionStart -> teaches Claude the planar-graph convention
$ss = @(Remove-PlanarEntries $hooks.SessionStart)
$ss += [PSCustomObject]@{
    hooks = @([PSCustomObject]@{ type = 'command'; command = "$HookCmd session-context" })
}
Set-Prop $hooks 'SessionStart' @($ss)

$settings | ConvertTo-Json -Depth 12 | Set-Content $ClaudeSettings -Encoding UTF8

Write-Host "==> Done! Planar is installed and configured." -ForegroundColor Green
Write-Host ""
Write-Host "  Hook:        ExitPlanMode  -> $HookCmd"
Write-Host "  Hook:        SessionStart  -> $HookCmd session-context (teaches Claude the planar-graph block)"
Write-Host "  Verify with: claude and run /hooks"
Write-Host "  Uninstall:   Remove-Item -Recurse -Force ~\.planar"
Write-Host "               (then remove the ExitPlanMode and SessionStart hooks from ~\.claude\settings.json)"
