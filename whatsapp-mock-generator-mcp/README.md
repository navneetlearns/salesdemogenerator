# journey-builder-mcp

MCP server for building ZoTok WhatsApp mock demo journeys. Gives OpenCode (or any MCP client) 5 tools to scaffold, brand-swap, verify, and serve WhatsApp demo journeys mid-conversation.

## Project goal

This MCP exists so the **sales team can create a new WhatsApp demo journey from an EXISTING project, seamlessly** — no coding, no file juggling, no server knowledge.

The flow is always:

1. Pick an **existing project** (`list_bases`) — e.g. Banas_Diary, V[N] Fogg, Orient, Adani Wilmar
2. Pick a **journey inside it** — e.g. `order_to_cash`, `vini_retailer_activation`
3. Collect the **new company's brand pack** — industry (`list_industries`), logo (file/URL), product images, website link
4. Build the new journey **from that existing journey** (`build_journey` with `sourceProject` + `sourceJourney` + `industry`/`website`/`logoUrl`/`productImages`) — the reference provides structure and steps; the brand pack gives the new company its own logo, products, and content, and the output is a ready-to-preview, brand-swapped copy.

**The one rule: never build "fresh" from the canonical base when an existing project matches.** Building without `sourceProject` produces generic placeholder journeys (identical copies with only brand colors swapped), not the client's journey — a failed demo. The existing project is the source of truth; the base is a last-resort fallback only.

Sales reps don't need to know any internals — they just ask OpenCode for a journey like an existing one, and the agent drives the tools.

## What you get

| Tool | What it does |
|---|---|
| `scaffold_project` | Create project directory + brand identity docs |
| `build_journey` | Clone a journey from an EXISTING project (sourceProject + sourceJourney) + the new company's brand pack (industry, website, logo via URL/path/base64, product images via URL/path) → brand-swap → HTML skeleton + `.journey-meta.json` |
| `stage_for_edit` | Content adaptation step 1: copy the build to a Windows-accessible staging dir (when `EDIT_STAGING_DIR` is set) and return the editable path + the content checklist |
| `finalize_journey` | Content adaptation step 2: sync edits back and AUTO-verify (expectedSteps + source-leak guard) — the mandatory gate before showing a journey |
| `verify_journey` | Structure + charset + Playwright render + Meta compliance + brand-asset checks + F6 source-leak guard (probes hardened, expectedSteps auto-filled) |
| `serve_journey` | Return local + public preview URLs for a project (no auth needed to view) |
| `list_bases` | List ALL projects in the template library (workspace + template roots + base), each with its journeys |
| `list_industries` | List industry content profiles (recipient label, units, currency, product categories) — pick one for the new company before building |

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

> **Availability caveat:** the hosted instance in this repo's current deployment runs
> on the host's laptop via a Tailscale Funnel. It works while that machine is on;
> it goes down when the laptop sleeps/reboots (the host re-establishes the funnel
> with `sudo tailscale funnel --bg 7891`). For a always-on team rollout, host the
> server on a cloud VM (see the journey-builder-mcp skill's `cloud-hosting-recipe.md`).

### 1. Install the agent rules (one-time, REQUIRED)

The agent needs the ask-flow + content-adaptation rules to use the tools correctly.
Save the content of the repo-root `AGENTS.md` to your OpenCode global rules file:

- Windows: `C:\Users\<you>\.config\opencode\AGENTS.md`
- Linux/macOS: `~/.config/opencode/AGENTS.md`

### 2. Add the remote server to your OpenCode config

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

### 3. Smoke-test with curl (no OpenCode needed)

```bash
curl -s -X POST https://<host>/mcp \
  -H "Authorization: Bearer <SHARED_TOKEN>" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"probe","version":"1.0"}}}'
# Expected: a JSON result with "serverInfo" — not an "Unauthorized" error
```

### 4. Restart OpenCode Desktop and use the tools as usual

Config is not hot-reloaded — close and reopen the app after editing `opencode.jsonc`.
Type `/mcp` — `journey-builder` should show connected with its 8 tools.

### Teammate notes (v1.5.0)

- The full template library (23 projects / 75 journeys) is served from the host —
  you do NOT need to clone the source projects. Run `list_bases` and pick any project.
- Content adaptation: after `build_journey`, the agent runs `stage_for_edit` →
  rewrites content → `finalize_journey` (auto-verify + source-leak guard).
  - On Windows + WSL: if the agent's file tools can't reach WSL paths, `stage_for_edit`
    returns a Windows path when the host has `EDIT_STAGING_DIR` set (it does on this
    deployment) — the staging copy is on the host, so editing works through the path
    returned. If anything is unreachable, edit in-place is the fallback; the leak
    guard still protects the build.
- Your brand assets: pass them as URLs, local paths (`D:\Sales\Acme\logo.png`), or
  attach them in the prompt — the build tool accepts all three.

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
| `EDIT_STAGING_DIR` | Windows-visible staging root for `stage_for_edit` (e.g. `/mnt/f/Sellerhub/edit-staging`). Unset = in-place editing (correct for native Linux/Mac or remote clients). Windows drive letters in asset paths are auto-translated via `/proc/mounts` — no hardcoded mounts. |

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
3. Ask for the **new company's brand pack**: industry (`list_industries`), logo
   (file or URL), product images (1-3), website link, optional tagline
4. Ask for the **steps** (or let them type them out)
5. `build_journey` with `sourceProject` + `sourceJourney` + `steps`
   + `industry` + `website` + `logoUrl`/`logoBase64` + `productImages`

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

## Changelog

**2026-08-10 — v1.5.0 (content-adaptation workflow + asset intake by location)**
- `build_journey` accepts LOCAL asset paths — `logoPath` + `productImagePaths`
  (Windows `D:\Sales\Acme\logo.png` or WSL paths) — the "user selects the stored
  assets location" intake. Windows drive letters are auto-translated via
  `/proc/mounts` discovery (adapts to ANY WSL machine; no hardcoded mounts).
- NEW `stage_for_edit` — copies a built project to a Windows-accessible staging
  dir (`EDIT_STAGING_DIR`, env-gated: unset = edit in place) and returns the
  editable Windows path + the full content-adaptation checklist. Kills the
  WSL/Windows file-tool path gap the OpenCode agent had to improvise around.
- NEW `finalize_journey` — syncs staged edits back (byte-verified), then
  AUTO-runs verify with expectedSteps + source-leak guard from
  `.journey-meta.json` (written at build: source display brand extracted from the
  source HTML, e.g. "Banas Dairy", + source logo filenames). Returns verify
  summary + preview URLs. The Banas-class leak can never ship.
- `verify_journey` — probes hardened (accepts objects, valid JSON, and lenient
  single-quoted literals with a clear error) + new `forbid` arg merged with the
  auto leak guard; expectedSteps auto-filled from `.journey-meta.json`.
- BUGFIX (root cause of the 2026-08-09 session's verify failures): `runPy` now
  uses `spawnSync` (no shell) — `execSync`+join shell-split any arg containing
  spaces (`--probes {"1": ["Meditech Surgical Supplies"]}`), breaking
  `json.loads` with a JSONDecodeError.
- `verify_journey.py` (shared script) gains `--forbid '["str", ...]'` — F6 leak
  guard checks, flag-gated (manual pipeline unaffected when omitted).

**2026-08-09 — v1.3.1 (build reliability fixes)**
- `build_journey` copies the source project's `assets/` + root-level logo files and
  repairs `<img>` logo references — new logo provided → refs point at
  `assets/brand/<new-logo>`; no logo → refs point at the copied source logo. Kills
  the `ERR_FILE_NOT_FOUND` broken-image class (was ~20 refs per build).
- `verify_journey` D1 whitelists `hr.wa-list-btn-hr` (legit UI element in source templates)
- Server logs every tool call (`[mcp] <tool> ok|ERR <ms> <args>` → service journal)
- `scripts/session_dump.py` — dump OpenCode session transcripts to see exactly what
  an agent did with the MCP (tool calls, args, outputs)

**2026-08-09 — v1.3.0 (brand-pack intake for NEW companies)**
- `list_industries` tool: industry content profiles (recipient label, units, currency,
  product categories) from `../data/industries/` — same source of truth as the demo-generator
- `build_journey` accepts the new company's brand pack: `industry`, `website`,
  `logoUrl` (or `logoBase64`), `productImages`, `tagline` — logo downloaded and
  embedded via brand_swap `--logo` (`.ava-logo` rule), product images saved to
  `assets/products/`, manifest extended with the industry profile
- Response leads with `INDUSTRY` + `ASSETS` lines and a `brandPack` echo
- `verify_journey` adds F1-F5 brand-asset checks (manifest, website, industry, logo, products)
- Ask-flow now collects the brand pack before building (AGENTS.md, skill, this README)

**2026-08-09 — v1.2.0 (hard enforcement of the build-from-existing-project flow)**
- `build_journey` REQUIRES `sourceProject` (+ `sourceJourney` when building from an
  existing project) — omitting it returns a clear error instead of silently building
  a generic placeholder; `sourceProject="base"` is the explicit from-scratch escape hatch
- `list_bases` excludes Haldirams/SakkuGroup/HindustanRMC per user directive
- Response leads with `PREVIEW` + `SOURCE` lines so agents report the preview URL and source
- Agent rules file (`AGENTS.md` — repo root + `~/.config/opencode/AGENTS.md` on the sales
  machine) mandates the ask-flow, brand pack, and post-build `verify_journey`

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
