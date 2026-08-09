# journey-builder-mcp

MCP server for building ZoTok WhatsApp mock demo journeys. Gives OpenCode (or any MCP client) 5 tools to scaffold, brand-swap, verify, and serve WhatsApp demo journeys mid-conversation.

## Project goal

This MCP exists so the **sales team can create a new WhatsApp demo journey from an EXISTING project, seamlessly** — no coding, no file juggling, no server knowledge.

The flow is always:

1. Pick an **existing project** (`list_bases`) — e.g. Banas_Diary, V[N] Fogg, Orient, Adani Wilmar
2. Pick a **journey inside it** — e.g. `order_to_cash`, `vini_retailer_activation`
3. Build the new journey **from that existing journey** (`build_journey` with `sourceProject` + `sourceJourney`) — the reference provides the steps and brand identity, the output is a ready-to-preview, brand-swapped copy.

**The one rule: never build "fresh" from the canonical base when an existing project matches.** Building without `sourceProject` produces generic placeholder journeys (identical copies with only brand colors swapped), not the client's journey — a failed demo. The existing project is the source of truth; the base is a last-resort fallback only.

Sales reps don't need to know any internals — they just ask OpenCode for a journey like an existing one, and the agent drives the tools.

## What you get

| Tool | What it does |
|---|---|
| `scaffold_project` | Create project directory + brand identity docs |
| `build_journey` | Clone a journey from the template library (or canonical base) → brand-swap → HTML skeleton |
| `verify_journey` | Structure + charset + Playwright render + Meta compliance checks |
| `serve_journey` | Return local + public preview URLs for a project (no auth needed to view) |
| `list_bases` | List ALL projects in the template library (workspace + template roots + base), each with its journeys |

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

## Shared remote URL (for teammates)

Instead of running the server yourself, you can point OpenCode at a hosted instance. Only the host needs the repo + server running; everyone else just adds a remote config with an auth token.

### 1. Add the remote server to your OpenCode config

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "journey-builder": {
      "type": "remote",
      "url": "https://<host>/mcp",
      "headers": { "Authorization": "Bearer <SHARED_TOKEN>" },
      "enabled": true
    }
  }
}
```

Replace `<host>` with the hosted URL (e.g. `https://<machine>.<tailnet>.ts.net` for a Tailscale Funnel) and `<SHARED_TOKEN>` with the token the host gives you.

### 2. Smoke-test with curl (no OpenCode needed)

```bash
curl -s -X POST https://<host>/mcp \
  -H "Authorization: Bearer <SHARED_TOKEN>" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"probe","version":"1.0"}}}'
# Expected: a JSON result with "serverInfo" — not an "Unauthorized" error
```

### 3. Restart OpenCode Desktop and use the tools as usual

Config is not hot-reloaded — close and reopen the app after editing `opencode.jsonc`.

> **Security notes (for hosts):** auth is a shared bearer token — distribute it privately (password manager), rotate it by changing `JOURNEY_BUILDER_TOKEN` on the host and restarting the server. The `/health` endpoint stays public; `/mcp` requires the token.

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
| `JOURNEY_BUILDER_TOKEN` | If set, HTTP mode requires `Authorization: Bearer <token>` (except OPTIONS, /health, /preview). Leave unset for open local dev. |
| `JOURNEY_BUILDER_PUBLIC_URL` | Public base URL (e.g. a Tailscale funnel). serve_journey returns a public preview URL when set. |
| `JOURNEY_TEMPLATE_ROOTS` | Comma-separated dirs to scan into the template library (projects with journey_*.html). |

### Template library & the ask-flow

`list_bases` returns every project the server knows: the canonical base, all
scaffolded projects in the workspace, and every project under `JOURNEY_TEMPLATE_ROOTS`
(currently the whatsapp-mock-generator projects dir only). Each entry:
`{id, name, path, journeys[], source}`. Journey names support both the
`journey_<flow>` convention and brand-prefixed files (`awl_*`, `vini_*`,
`jk_cement_*`).

Current inventory (2026-08): 23 projects / 78 journeys — 21 template projects from
the whatsapp-mock-generator dir (Banas_Diary 10, Orient 10, Haldirams 9, BlueOcean 6,
sundar_masala 5, Recykal 3, Adani Wilmar 7, V[N] Fogg 7, jkcement 6, …), the
canonical base (contract), and workspace projects.

Build flow (MANDATORY — this is the product):
1. `list_bases` → ask the user **which existing project** they want as the reference
2. Ask **which journey** within it
3. Ask for the **steps** (or let them type them out)
4. `build_journey` with `sourceProject` + `sourceJourney` + `steps`

> ⚠️ Never build without `sourceProject`. Omitting it falls back to the canonical
> base and produces generic placeholders — every "journey" built that way is an
> identical copy with only the brand colors swapped. If an existing project matches
> the client, it MUST be the source. The base is a last-resort fallback only.

### Preview

`build_journey` and `serve_journey` return preview URLs that need **no auth** —
safe for browser/webview preview (browsers can't send Authorization headers).
`localUrl` (`http://localhost:7891/preview/<project-id>/`) works on the host;
`publicUrl` works anywhere while the Tailscale funnel is up. The built project is
registered automatically, so the preview URL works immediately after a build —
no separate `serve_journey` call needed. Preview serves only registered projects
(`/preview/<project-id>/`), path traversal is rejected.

---

## Current deployment (this machine)

The server runs as a systemd USER service (auto-start, restart-safe):

| Thing | Value |
|---|---|
| Service | `systemctl --user status journey-builder-mcp` (enabled, linger on) |
| Env file | `~/.config/journey-builder-mcp.env` (chmod 600) |
| Workspace | `~/AgentWork/journey-output` (output of scaffold/build) |
| Local endpoint | `http://localhost:7891/mcp` — token-gated |
| Public endpoint | `https://laptop-ksfr7jf4.tail45ff54.ts.net/mcp` — Tailscale funnel, reachable only while this machine is on |
| Template roots | `~/AgentWork/Sellerhub/whatsapp-mock-generator-main/whatsapp-mock-generator-main/projects` (Linux copy — never the F: NTFS copy) |
| Restart after env change | `systemctl --user restart journey-builder-mcp` |

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
