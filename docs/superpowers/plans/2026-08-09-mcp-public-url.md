# MCP Public URL Hosting — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Host journey-builder-mcp so anyone can use it via a single remote URL in OpenCode (type: remote), with bearer-token auth, zero install for recipients.

**Architecture:** Keep the existing Node MCP HTTP server; add an env-gated bearer-token check (local dev stays open, public deployment requires a token). Run it as a systemd user service on this machine (WSL, systemd already enabled), expose it publicly via a Tailscale Funnel which gives a stable `https://<machine>.<tailnet>.ts.net` URL with TLS. Recipients add a 4-line remote config with an Authorization header. Alternative track: Railway git-deploy (appendix).

**Tech Stack:** Node 22 (existing), systemd (user units), Tailscale Funnel, curl for verification.

**State (verified 2026-08-09):** repo `~/AgentWork/salesdemogenerator-github` on master, clean except `M package-lock.json`. Server binds `0.0.0.0:7891` already. `systemd=true` in /etc/wsl.conf, `systemctl is-system-running` → running. No tunnel tools installed yet. No docs/ dir at repo root, no SSG.

**Progress (2026-08-09, executed):**
- [x] Task 1 (auth) — committed af6e5d5, pushed. Matrix verified: 401/401/200/200/204.
- [x] Task 2 (systemd service) — active, restart-survives. NOTE: ExecStart uses nvm node path `/home/sumit/.nvm/versions/node/v20.20.2/bin/node` (not /usr/bin/node).
- [x] Task 4 (README sharing section) — committed with this plan.
- [~] Task 3 (Tailscale) — BLOCKED on interactive steps: `sudo` needs a password. Remaining: install, `sudo tailscale up` (browser login), `sudo tailscale funnel 7891`, record URL, public-URL verification.
- [ ] Task 5 (final public-URL verification + OpenCode Desktop check)

**Decision gate — pick ONE track before starting:**
- Track A (default, free, ~15 min): host on THIS machine via Tailscale Funnel. Downside: URL only reachable while this machine is on.
- Track C (appendix): deploy to Railway. Always-on, ~$5/mo. Tasks 1 and 4 are identical.

---

## Task 1: Bearer-token auth in the server (shared by both tracks)

**Files:**
- Modify: `whatsapp-mock-generator-mcp/src/index.js` (auth const near line 452; CORS header line 464; auth block between line 471 and 473; startup log line 525-529)

- [ ] **Step 1: Add the token constant next to PORT (after line 452)**

```js
const AUTH_TOKEN = process.env.JOURNEY_BUILDER_TOKEN || '';
```

- [ ] **Step 2: Allow the Authorization header through CORS (line 464)**

Old:
```js
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Mcp-Session-Id');
```
New:
```js
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Mcp-Session-Id, Authorization');
```

- [ ] **Step 3: Insert the auth check between the OPTIONS block and the health check (between lines 471 and 473)**

```js

    // Bearer-token auth — enforced ONLY when JOURNEY_BUILDER_TOKEN is set.
    // Local dev stays open; public deployments set the env var.
    // OPTIONS preflight stays unauthenticated (browsers send it headerless).
    if (AUTH_TOKEN && req.headers.authorization !== `Bearer ${AUTH_TOKEN}`) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized', hint: 'Authorization: Bearer <JOURNEY_BUILDER_TOKEN>' }));
      return;
    }
```

- [ ] **Step 4: Log auth status at startup (inside the listen callback, after line 528)**

```js
    console.error(`Auth: ${AUTH_TOKEN ? 'bearer-token ON' : 'OFF (local only)'}`);
```

- [ ] **Step 5: Syntax check + local regression (no token → still open)**

```bash
cd ~/AgentWork/salesdemogenerator-github/whatsapp-mock-generator-mcp
node --check src/index.js
# Expected: no output, exit 0
```

- [ ] **Step 6: Start WITHOUT token and verify local behavior is unchanged**

```bash
npm run start:http > /tmp/mcp_noauth.log 2>&1 &
sleep 2
curl -s -o /dev/null -w 'no-token init: %{http_code}\n' -X POST http://localhost:7891/mcp -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"probe","version":"1.0"}}}'
# Expected: 200
grep Auth /tmp/mcp_noauth.log   # Expected: Auth: OFF (local only)
kill %1
```

- [ ] **Step 7: Start WITH token and verify 401/200 matrix**

```bash
JOURNEY_BUILDER_TOKEN=test123 npm run start:http > /tmp/mcp_auth.log 2>&1 &
sleep 2
# no auth header → 401
curl -s -o /dev/null -w 'no header: %{http_code}\n' -X POST http://localhost:7891/mcp -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"probe","version":"1.0"}}}'
# wrong token → 401
curl -s -o /dev/null -w 'wrong token: %{http_code}\n' -X POST http://localhost:7891/mcp -H 'Authorization: Bearer wrong' -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"probe","version":"1.0"}}}'
# correct token → 200
curl -s -o /dev/null -w 'right token: %{http_code}\n' -X POST http://localhost:7891/mcp -H 'Authorization: Bearer test123' -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"probe","version":"1.0"}}}'
# health stays open → 200
curl -s -o /dev/null -w 'health: %{http_code}\n' http://localhost:7891/health
# preflight stays open → 204
curl -s -o /dev/null -w 'preflight: %{http_code}\n' -X OPTIONS http://localhost:7891/mcp
# Expected: 401 / 401 / 200 / 200 / 204
grep Auth /tmp/mcp_auth.log   # Expected: Auth: bearer-token ON
kill %1
```

- [ ] **Step 8: Commit**

```bash
cd ~/AgentWork/salesdemogenerator-github
git add whatsapp-mock-generator-mcp/src/index.js
git commit -m "feat(mcp): bearer-token auth for remote HTTP mode (env-gated)"
git push
```

## Task 2: systemd user service + token env file

**Files:**
- Create: `~/.config/systemd/user/journey-builder-mcp.service`
- Create: `~/.config/journey-builder-mcp.env` (chmod 600)
- Create: `/home/sumit/AgentWork/journey-output/` (workspace for generated journeys)

- [ ] **Step 1: Generate a real token and write the env file**

```bash
mkdir -p ~/AgentWork/journey-output
umask 077
printf 'JOURNEY_BUILDER_TOKEN=%s\n' "$(openssl rand -hex 16)" > ~/.config/journey-builder-mcp.env
chmod 600 ~/.config/journey-builder-mcp.env
cat ~/.config/journey-builder-mcp.env   # save this value somewhere safe (password manager) — it's the shared secret
```

- [ ] **Step 2: Write the unit file**

`~/.config/systemd/user/journey-builder-mcp.service`:
```ini
[Unit]
Description=journey-builder-mcp (WhatsApp mock journey generator)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=/home/sumit/AgentWork/salesdemogenerator-github/whatsapp-mock-generator-mcp
ExecStart=/usr/bin/node src/index.js --http --workspace=/home/sumit/AgentWork/journey-output
EnvironmentFile=/home/sumit/.config/journey-builder-mcp.env
Restart=on-failure
RestartSec=3

[Install]
WantedBy=default.target
```

- [ ] **Step 3: Enable + start**

```bash
systemctl --user daemon-reload
systemctl --user enable --now journey-builder-mcp
loginctl enable-linger "$USER"   # keeps the unit alive after logout
```

- [ ] **Step 4: Verify it runs and is healthy**

```bash
systemctl --user status journey-builder-mcp --no-pager | head -8
# Expected: active (running), no "port in use" error
curl -s http://localhost:7891/health
# Expected: {"status":"ok","tools":[...]}
```

- [ ] **Step 5: Restart-survival check**

```bash
systemctl --user restart journey-builder-mcp
sleep 2
curl -s -o /dev/null -w 'after restart: %{http_code}\n' http://localhost:7891/health
# Expected: 200
```

## Task 3: Tailscale + Funnel (Track A only)

- [ ] **Step 1: Install tailscale (needs sudo — one-time)**

```bash
curl -fsSL https://tailscale.com/install.sh | sh
```

- [ ] **Step 2: Bring it up (interactive — user completes browser login)**

```bash
sudo tailscale up
# Opens login.tailscale.com in browser; approve. If no account, create a free one first.
```

- [ ] **Step 3: Expose port 7891 via Funnel**

```bash
sudo tailscale funnel 7891
# Prints the public URL, e.g. https://<machine>.<tailnet>.ts.net — record it.
```

- [ ] **Step 4: Verify externally through the funnel URL (this proves DNS + TLS + auth)**

```bash
URL="https://<machine>.<tailnet>.ts.net"   # substitute actual URL from Step 3
# health open
curl -s -o /dev/null -w 'public health: %{http_code}\n' "$URL/health"
# Expected: 200
# no token → 401
curl -s -o /dev/null -w 'public no-token: %{http_code}\n' -X POST "$URL/mcp" -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"probe","version":"1.0"}}}'
# Expected: 401
# with token (read from env file) → 200
TOKEN=$(grep JOURNEY_BUILDER_TOKEN ~/.config/journey-builder-mcp.env | cut -d= -f2)
curl -s -o /dev/null -w 'public with-token: %{http_code}\n' -X POST "$URL/mcp" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"probe","version":"1.0"}}}'
# Expected: 200
```

- [ ] **Step 5: Confirm funnel + tailscaled persistence**

```bash
sudo tailscale funnel status   # shows the active funnel
systemctl status tailscaled --no-pager | head -3   # Expected: active (running), starts on boot
```

## Task 4: Recipient onboarding docs + README

**Files:**
- Modify: `whatsapp-mock-generator-mcp/README.md`

- [ ] **Step 1: Add a "Remote URL (shared) usage" section to README.md** with:

  1. The recipient config block:
  ```jsonc
  {
    "$schema": "https://opencode.ai/config.json",
    "mcp": {
      "journey-builder": {
        "type": "remote",
        "url": "https://<machine>.<tailnet>.ts.net/mcp",
        "headers": { "Authorization": "Bearer <SHARED_TOKEN>" },
        "enabled": true
      }
    }
  }
  ```
  2. One-line curl smoke test (same as Task 3 Step 4 with-token command).
  3. Note: token is a shared secret — distribute privately, rotate by editing `~/.config/journey-builder-mcp.env` + `systemctl --user restart journey-builder-mcp`.

- [ ] **Step 2: Commit**

```bash
cd ~/AgentWork/salesdemogenerator-github
git add whatsapp-mock-generator-mcp/README.md
git commit -m "docs(mcp): remote URL usage + auth for shared deployments"
git push
```

## Task 5: Final runtime security verification

- [ ] **Step 1: Re-run the 401/200 matrix against the PUBLIC URL** (same commands as Task 3 Step 4 — do it from a different network/phone hotspot if possible, else the funnel URL is sufficient).
- [ ] **Step 2: Confirm the token never appears in logs**

```bash
grep -i "test123\|JOURNEY_BUILDER_TOKEN" /tmp/mcp_auth.log ~/.config/systemd/user/journey-builder-mcp.service
# Expected: no matches (token lives only in the env file)
```

- [ ] **Step 3: Generate one journey end-to-end through the public URL** — `scaffold_project` with a throwaway brand (e.g. slug `smoke_test`), then confirm the project dir appears in `/home/sumit/AgentWork/journey-output/smoke_test/`.
- [ ] **Step 4: OpenCode Desktop check** — add the remote config to `%USERPROFILE%\.config\opencode\opencode.jsonc` (replacing or alongside the localhost entry), restart app, `/mcp` shows journey-builder connected, call `list_bases` through it.

## Verification Checklist

1. `curl http://localhost:7891/health` → 200 (local, always open)
2. POST `/mcp` with no/wrong token → 401; with correct token → 200 (both localhost AND public URL)
3. `OPTIONS /mcp` → 204 without auth
4. `systemctl --user status journey-builder-mcp` → active, and stays active after `restart`
5. `sudo tailscale funnel status` shows the funnel; `https://<machine>.<tailnet>.ts.net/health` → 200 from outside
6. Generated journey lands in `/home/sumit/AgentWork/journey-output/<slug>/`
7. OpenCode Desktop connects via remote URL + header and `list_bases` works
8. Startup log says `Auth: bearer-token ON`; no token value anywhere in logs or repo

## Appendix — Track C: Railway deploy (always-on alternative)

Prereq: free Railway account + CLI (`npm i -g @railway/cli`, `railway login`). Tasks 1 and 4 already done.

- [ ] `cd ~/AgentWork/salesdemogenerator-github && railway init` (attach to whatsapp-mock-generator-mcp; Nixpacks auto-detects Node)
- [ ] `railway variables set JOURNEY_BUILDER_TOKEN=$(openssl rand -hex 16) WORKSPACE_DIR=/data`
- [ ] `railway volume add --mountPath /data` (persists generated journeys; ~$0.25/GB/mo)
- [ ] `railway up --detach` → deploy; get URL `https://<service>.up.railway.app`
- [ ] Verify: same 401/200 matrix against `https://<service>.up.railway.app/mcp`
- [ ] Recipient config uses `"url": "https://<service>.up.railway.app/mcp"` + same headers block
