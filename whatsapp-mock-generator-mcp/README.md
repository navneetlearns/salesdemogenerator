# journey-builder-mcp

MCP server for building ZoTok WhatsApp mock demo journeys. Gives OpenCode (or any MCP client) 5 tools to scaffold, brand-swap, verify, and serve WhatsApp demo journeys mid-conversation.

## What you get

| Tool | What it does |
|---|---|
| `scaffold_project` | Create project directory + brand identity docs |
| `build_journey` | Clone base journey → brand-swap → HTML skeleton |
| `verify_journey` | Structure + charset + Playwright render + Meta compliance checks |
| `serve_journey` | Serve the journey on a local port for browser preview |
| `list_bases` | Show available base journey templates |

## Prerequisites

- **Node.js** ≥ 18 (`node --version`)
- **Python 3** (`python3 --version`) — needed for brand_swap.py and verify_journey.py
- **OpenCode Desktop** installed on Windows

## Setup — step by step

### 1. Clone the repo

Open a WSL terminal:

```bash
git clone git@github.com:navneetlearns/salesdemogenerator.git ~/salesdemogenerator
cd ~/salesdemogenerator/whatsapp-mock-generator-mcp
npm install
```

### 2. Start the MCP server

```bash
node src/index.js --http
```

You should see:

```
journey-builder-mcp HTTP server on http://localhost:7891/mcp
Health: http://localhost:7891/health
Tools: scaffold_project, build_journey, verify_journey, serve_journey, list_bases
```

**Keep this terminal open** — the server must be running for OpenCode to use it.

### 3. Configure OpenCode Desktop

Open (or create) the OpenCode config file on Windows:

```
C:\Users\<your-username>\.config\opencode\opencode.jsonc
```

Add the MCP server:

```jsonc
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

### 4. Restart OpenCode Desktop

Close and reopen OpenCode Desktop. Config changes are **not** hot-reloaded.

### 5. Verify the connection

In OpenCode, type:

```
List the available MCP tools
```

You should see the 5 journey-builder tools listed. If not, see [Troubleshooting](#troubleshooting).

---

## Usage

Once connected, just ask OpenCode to build a journey:

```
Build a WhatsApp demo journey for Kirti Gold cements.
Brand color: #C09A3E, accent: #8B5E1A, industry: construction.
```

OpenCode will call the MCP tools to scaffold the project, brand-swap the base journey, and serve it for preview.

### CLI flags

| Flag | Default | What |
|---|---|---|
| `--http` | off | Start HTTP server (required for OpenCode Desktop) |
| `--port=7891` | 7891 | HTTP server port |
| `--workspace=<path>` | cwd | Output directory for scaffolded projects |

### Environment variables

| Variable | What |
|---|---|
| `WORKSPACE_DIR` | Override output directory (same as `--workspace`) |

---

## How it works

```
OpenCode Desktop (Windows)
    ↓ HTTP / MCP protocol
journey-builder-mcp server (WSL, port 7891)
    ↓ spawns Python scripts
brand_swap.py  — mechanical CSS var + logo replacement
verify_journey.py  — structure + render + compliance gate
    ↓ reads base templates
whatsapp-mock-generator/skill/base-journey/  — index.html + journey_contract.html
```

The server reads base journey templates from `../whatsapp-mock-generator/skill/` (sibling directory in the same repo). No files are duplicated.

---

## Troubleshooting

**"Unknown tool" errors from OpenCode**
→ Restart OpenCode after editing `opencode.jsonc`. Config is not hot-reloaded.

**MCP server not connecting**
→ Verify the server is running: `curl http://localhost:7891/health` should return JSON with status "ok".
→ Make sure you're using `type: "remote"` (not `"local"`) in the config.

**"Cannot find package '@modelcontextprotocol/sdk'"**
→ Run `npm install` in the `whatsapp-mock-generator-mcp/` directory.

**brand_swap reports "SKIP" on all fields**
→ The base HTML may use different CSS variable names than expected.
  Check the base journey's `:root` block and `brand_swap.py` swap logic.

**verify_journey fails render checks**
→ Playwright needs a display. Set `DISPLAY=:0` in WSL with VcXsrv running,
  or run Chromium with `--no-sandbox` flags.

**Port 7891 already in use**
→ Kill the existing process: `kill $(lsof -ti:7891)`
→ Or use a different port: `node src/index.js --http --port=7892`
  (update the URL in `opencode.jsonc` to match)

**Windows can't reach localhost:7891**
→ WSL and Windows share localhost by default. If it doesn't work:
  - Check Windows Firewall isn't blocking the port
  - Try the WSL IP: `hostname -I` in WSL, use that IP instead of localhost
