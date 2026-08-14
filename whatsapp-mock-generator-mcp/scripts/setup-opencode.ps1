# setup-opencode.ps1 — one-command onboarding for the journey-builder MCP (remote/AWS).
#
# Usage (PowerShell on the teammate's Windows machine):
#   powershell -ExecutionPolicy Bypass -File setup-opencode.ps1 -Token <SHARED_TOKEN>
#
# What it does:
#   1. Creates ~\.config\opencode\ (OpenCode Desktop config dir)
#   2. Fetches the repo's AGENTS.md (agent rules / ask-flow) into it automatically
#   3. Adds the journey-builder remote MCP entry to opencode.jsonc (merges if the
#      file already exists; backs up comment-laden configs to opencode.jsonc.bak)
#   4. Prints the final step (restart OpenCode)
#
# The token comes from the MCP host (Sumit) — distribute it privately, never in
# chat groups or repos. Endpoint: https://100.31.120.181.sslip.io/mcp

param(
  [Parameter(Mandatory = $true)]
  [string]$Token
)

$ErrorActionPreference = "Stop"

$dir      = Join-Path $env:USERPROFILE ".config\opencode"
$cfgPath  = Join-Path $dir "opencode.jsonc"
$rulesPath = Join-Path $dir "AGENTS.md"
$mcpUrl   = "https://100.31.120.181.sslip.io/mcp"
$rulesUrl = "https://raw.githubusercontent.com/navneetlearns/salesdemogenerator/master/AGENTS.md"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

New-Item -ItemType Directory -Force -Path $dir | Out-Null
Write-Host "[i] config dir: $dir"

# 1. Agent rules — fetched automatically (no manual copy)
try {
  Invoke-WebRequest -Uri $rulesUrl -OutFile $rulesPath -UseBasicParsing
  Write-Host "[ok] agent rules -> $rulesPath"
} catch {
  Write-Host "[warn] could not fetch AGENTS.md from $rulesUrl : $($_.Exception.Message)" -ForegroundColor Yellow
  Write-Host "       proceeding anyway — clients that surface server instructions do not need it."
}

# 2. MCP config entry
$entry = [ordered]@{
  type    = "remote"
  url     = $mcpUrl
  headers = [ordered]@{ Authorization = "Bearer $Token" }
  enabled = $true
}

if (Test-Path $cfgPath) {
  $raw = Get-Content -Raw -Path $cfgPath
  try {
    $cfg = $raw | ConvertFrom-Json
  } catch {
    # JSONC with // comments — ConvertFrom-Json can't parse; back up and rebuild.
    Copy-Item $cfgPath "$cfgPath.bak" -Force
    $cfg = [ordered]@{ "`$schema" = "https://opencode.ai/config.json"; mcp = [ordered]@{} }
    Write-Host "[warn] existing config contains comments; backed up to opencode.jsonc.bak" -ForegroundColor Yellow
  }
  if (-not $cfg.mcp) { $cfg | Add-Member -NotePropertyName "mcp" -NotePropertyValue ([ordered]@{}) -Force }
  if (-not $cfg.mcp."journey-builder") {
    $cfg.mcp | Add-Member -NotePropertyName "journey-builder" -NotePropertyValue $entry -Force
    [System.IO.File]::WriteAllText($cfgPath, ($cfg | ConvertTo-Json -Depth 10), $utf8NoBom)
    Write-Host "[ok] added journey-builder entry to $cfgPath"
  } else {
    Write-Host "[i] $cfgPath already has a journey-builder entry — left untouched"
  }
} else {
  $cfg = [ordered]@{
    "`$schema" = "https://opencode.ai/config.json"
    mcp        = [ordered]@{ "journey-builder" = $entry }
  }
  [System.IO.File]::WriteAllText($cfgPath, ($cfg | ConvertTo-Json -Depth 10), $utf8NoBom)
  Write-Host "[ok] wrote $cfgPath"
}

Write-Host ""
Write-Host "Done. Final step: close and reopen OpenCode Desktop (config is not hot-reloaded)."
Write-Host "Then type /mcp in any session — journey-builder should show connected with 8 tools."
Write-Host "Try: 'list the available journey-building tools' or 'build a journey for <company> like Adani Wilmar'."
