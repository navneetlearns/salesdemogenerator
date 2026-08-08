# journey-builder-mcp

MCP server (Model Context Protocol) for building ZoTok WhatsApp mock demo journeys.
Wire it into OpenCode so the mock-journey-builder skill becomes a callable tool mid-conversation.

## Architecture

```
Local dev:  StdioServerTransport  (stdio — works from WSL CLI)
Prod/Desktop: HttpServerTransport  (HTTP — required for OpenCode Desktop app)
```

The server ships with **both transports** selectable at startup.
Stdio is used for direct CLI testing. Remote HTTP is used when integrated with
OpenCode Desktop via the `type: "remote"` MCP config.

---

## What it does

| Tool | What |
|---|---|
| `scaffold_project` | Create project dir + `BRAND_IDENTITY.md` + `JOURNEY_ANALYSIS.md` |
| `build_journey` | Clone base journey → brand-swap via `brand_swap.py` → write HTML skeleton |
| `verify_journey` | Run structure + charset + Playwright render + Meta compliance checks |
| `serve_journey` | Spin up `python3 -m http.server` on a local port for browser preview |
| `list_bases` | Show available base journey templates |

The actual per-step content authoring is still done by the human or an AI using the
`mock-journey-builder` skill — this MCP server handles the mechanical scaffolding,
brand-swap, verification, and serving legs.

---

## Setup

### 1. Install dependencies

```bash
cd ~/AgentWork/demo-generator/journey-builder-mcp
npm install
```

### 2. Choose your integration mode

#### Mode A — Local/subprocess (WSL CLI, not desktop app)

Add to global opencode config (`~/.config/opencode/opencode.jsonc` on Windows,
or the equivalent on Linux/macOS):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "journey-builder": {
      "type": "local",
      "command": ["node", "/home/sumit/AgentWork/demo-generator/journey-builder-mcp/src/index.js"],
      "env": {},
      "enabled": true
    }
  }
}
```

#### Mode B — Remote HTTP (OpenCode Desktop App — RECOMMENDED)

Start the server as a long-running HTTP process, then register it as a remote MCP:

```bash
# Start the HTTP server (persistent, e.g. via systemd or background)
cd ~/AgentWork/demo-generator/journey-builder-mcp
node src/index.js --http &
# Server listens on http://localhost:7891 by default
```

Then add to `opencode.jsonc`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "journey-builder": {
      "type": "remote",
      "url": "http://localhost:7891/mcp",
      "enabled": true
    }
  }
}
```

**Why remote?** OpenCode Desktop runs as a Tauri/Windows binary. Local subprocess
MCPs need WSL-to-Windows path translation which is fragile. Remote MCP works
identically from CLI and desktop.

### 3. Verify the MCP is connected

```bash
opencode mcp list
```

You should see `journey-builder` listed. Restart OpenCode after saving config.

---

## Usage from inside OpenCode

Once registered, OpenCode can call the tools directly. Example conversation:

```
You: Build me a WhatsApp demo journey for Kirti Gold cements

OpenCode: I'll scaffold the project, clone the base journey, and brand-swap it.
          Let me invoke the journey-builder MCP tools.

OpenCode calls:
  scaffold_project(brandName="Kirti Gold", slug="kirti_gold",
                   industry="construction", brandColor="#C09A3E",
                   accentColor="#8B5E1A", avatarInitials="KG",
                   whatsappBizName="Kirti Gold Cements")

  build_journey(brandName="Kirti Gold", slug="kirti_gold",
                journeyName="rate_contract", journeyLabel="Rate Contract",
                brandColor="#C09A3E", accentColor="#8B5E1A",
                avatarInitials="KG")

  serve_journey(projectPath="/home/sumit/AgentWork/demo-generator/kirti_gold/projects/kirti_gold",
                port=7890)
```

---

## Serving the web preview

`serve_journey` starts a detached HTTP server and returns the URL:

```
http://localhost:7890
```

Open the URL in any browser to see the journey. Stop the server with:

```bash
kill $(lsof -ti:7890)
```

---

## Tool input schemas

### scaffold_project

```json
{
  "brandName": "Kirti Gold",
  "slug": "kirti_gold",
  "industry": "construction",
  "brandColor": "#C09A3E",
  "accentColor": "#8B5E1A",
  "logoPath": "/abs/path/to/logo.png",
  "avatarInitials": "KG",
  "tagline": "Building Strength, One Foundation at a Time",
  "whatsappBizName": "Kirti Gold Cements"
}
```

### build_journey

```json
{
  "brandName": "Kirti Gold",
  "slug": "kirti_gold",
  "journeyName": "rate_contract",
  "brandColor": "#C09A3E",
  "accentColor": "#8B5E1A",
  "avatarInitials": "KG",
  "journeyLabel": "Rate Contract",
  "steps": []
}
```

`steps` is reserved for future per-step content injection. Currently the tool
produces a brand-swapped skeleton; full content authoring is done by the
`mock-journey-builder` skill working on the output HTML files.

### verify_journey

```json
{
  "journeyPath": "/home/sumit/AgentWork/demo-generator/kirti_gold/projects/kirti_gold/journey_rate_contract.html",
  "probes": { "1": ["brand name", "CON-2026-0527"] },
  "expectedSteps": 10,
  "screenshotsDir": "/home/sumit/AgentWork/demo-generator/kirti_gold/projects/kirti_gold/screenshots"
}
```

### serve_journey

```json
{
  "projectPath": "/home/sumit/AgentWork/demo-generator/kirti_gold/projects/kirti_gold",
  "port": 7890
}
```

### list_bases

```json
{}
```

---

## Paths this server expects

| Path | Expected location |
|---|---|
| `mock-journey-builder-share/base-journey/` | `~/AgentWork/demo-generator/mock-journey-builder-share/base-journey/` |
| `mock-journey-builder-share/scripts/brand_swap.py` | `~/AgentWork/demo-generator/mock-journey-builder-share/scripts/brand_swap.py` |
| `mock-journey-builder-share/scripts/verify_journey.py` | `~/AgentWork/demo-generator/mock-journey-builder-share/scripts/verify_journey.py` |
| Output dir | `~/AgentWork/demo-generator/<slug>/projects/<slug>/` |

If your `~/AgentWork/demo-generator/` lives elsewhere, edit `INSTALL_ROOT` in `src/index.js`.

---

## Troubleshooting

**"Unknown tool" errors from OpenCode**
→ Restart OpenCode after editing `opencode.jsonc`. Config is not hot-reloaded.

**MCP server not listed in `opencode mcp list`**
→ Check the server is running: `curl http://localhost:7891/mcp` should return JSON-RPC
→ If using local subprocess mode, check the path is correct for the Windows-side config

**brand_swap reports "SKIP" on all fields**
→ The base HTML may use different CSS variable names or class names than expected.
  Inspect the base journey's `:root` block and the `brand_swap.py` swap logic.

**verify_journey fails B-checks (render)**
→ Playwright needs a display. Set `DISPLAY=:0` in WSL with VcXsrv running,
  or run Chromium with `--no-sandbox` flags.

**MCP server won't start in HTTP mode**
→ Run directly to see errors: `node ~/AgentWork/demo-generator/journey-builder-mcp/src/index.js --http`
