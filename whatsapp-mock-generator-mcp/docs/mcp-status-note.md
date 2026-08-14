# journey-builder-mcp — DEPLOYMENT RECORD & OPS RUNBOOK (AWS Lightsail)

Status: DEPLOYED & LIVE — 2026-08-13. Supersedes the pre-deployment handoff
note (same file, 13 Aug 2026): the move to AWS is done.

## What runs where

| | Laptop (WSL, fallback) | AWS Lightsail (primary, always-on) |
|---|---|---|
| Service | systemd USER unit `journey-builder-mcp` | systemd unit `journey-builder-mcp` (system) |
| Endpoint | http://localhost:7891/mcp · funnel: https://laptop-ksfr7jf4.tail45ff54.ts.net/mcp | **https://100.31.120.181.sslip.io/mcp** |
| Instance | — | `journey-builder-mcp` — us-east-1a, ubuntu_24_04, **micro_3_0** (1GB RAM, 40GB SSD), public IPv4 100.31.120.181 |
| Auth | `JOURNEY_BUILDER_TOKEN` (same token BOTH hosts) | same |
| Template library | ~/AgentWork/Sellerhub/.../projects (198MB) | /home/ubuntu/sellerhub-projects (198MB, scp'd once) |

Version: v1.5.0 on both. The token is shared, so `opencode.jsonc` entries for
local / funnel / cloud all carry the same bearer token.

## Cloud instance layout

- Repo: `/home/ubuntu/salesdemogenerator` (whole-repo clone — sibling layout,
  `whatsapp-mock-generator-mcp/` + `whatsapp-mock-generator/` side by side so
  base-journey resolves). `npm ci --omit=dev` done.
- Env: `/home/ubuntu/.env` (chmod 600) — `JOURNEY_BUILDER_TOKEN`,
  `JOURNEY_BUILDER_PUBLIC_URL=https://100.31.120.181.sslip.io`,
  `JOURNEY_TEMPLATE_ROOTS=/home/ubuntu/sellerhub-projects`. No
  `EDIT_STAGING_DIR` (native Linux → stage_for_edit falls back to in-place
  editing, which is the portable default).
- Service: `/etc/systemd/system/journey-builder-mcp.service` (User=ubuntu,
  `Restart=always` — see gotchas, `--workspace=/home/ubuntu/journey-output`).
- HTTPS: Caddy v2.11.4 (cloudsmith apt repo), `/etc/caddy/Caddyfile` →
  `100.31.120.181.sslip.io { reverse_proxy 127.0.0.1:7891 }`. Auto-TLS via
  Let's Encrypt (sslip.io wildcard DNS — no domain needed, cert auto-renews).
- Watchdog: `/usr/local/bin/jb-mcp-watchdog.sh` + root crontab `*/5 * * * *`
  (restarts the service when free RAM < 100MB).
- Firewall: Lightsail + ufw both allow only 22, 80, 443. **7891 is CLOSED
  publicly** — all traffic enters via Caddy/HTTPS.

## Cost (credit-based free plan, account 144916746035)

- Lightsail micro_3_0 = $7/mo flat (public IPv4 included; bundle lineup changed
  in 2026 — the old "$5 = 1GB" plan is gone; the $5 nano is only 0.5GB RAM,
  which OOMs on the Chromium verify spike).
- 3-month free trial on $5+ bundles → months 1-3 ≈ $0; months 4-6 ≈ $21.
  Inside the $200 credit envelope (~10x headroom). Year one ≈ $63.
- MUST-DOs (manual, root/console):
  1. CloudWatch/Budgets billing alarm at ~$10 (HermesCLI has no billing perms).
  2. Calendar ~month 5: upgrade free plan → paid BEFORE 6-month expiry so
     unused credits survive to month 12 (otherwise the instance dies at expiry).

## Operations (run from WSL on the laptop)

```bash
# status + handshake (any host)
~/.hermes/skills/sales-demos/journey-builder-mcp/scripts/check_mcp.sh   # local laptop
curl https://100.31.120.181.sslip.io/health                            # cloud

# SSH into the instance (key on the laptop)
ssh -i ~/.ssh/lightsail-default.pem ubuntu@100.31.120.181

# on the instance
systemctl status journey-builder-mcp        # service state
journalctl -u journey-builder-mcp -f        # per-call [mcp] logs
systemctl restart journey-builder-mcp       # after env/config changes
journalctl -u caddy -f                      # TLS / proxy logs
cat /var/log/jb-mcp-watchdog.log            # watchdog restarts
sudo caddy validate --config /etc/caddy/Caddyfile
```

## Verified (2026-08-13, all green)

- /health 200 no-token (local + external HTTPS) · /mcp 401 no-token ·
  /mcp 200 with-token → serverInfo journey-builder-mcp v1.5.0.
- list_bases on the cloud: 19 template projects / 65 journeys + canonical base
  (sellerhub root; laptop adds workspace builds: 23/78 incl. base).
- TLS: Let's Encrypt cert, `openssl x509 -checkend` passes; opencode.jsonc
  parse + cloud entry verified; ad-hoc suite 15/15 then 7/7.
- Verify: `curl https://100.31.120.181.sslip.io/health` → `{"status":"ok",...}`.
- opencode.jsonc (Windows) has three entries: `journey-builder` (local),
  `journey-builder-public` (funnel fallback), `journey-builder-cloud` (AWS HTTPS).
- Teammate onboarding (2026-08-13): `scripts/setup-opencode.ps1` — one command
  (token as arg) writes opencode.jsonc + fetches AGENTS.md. Server now also
  advertises the ask-flow rules via the MCP `instructions` field in the initialize
  result (spec-compliant clients get them without any rules file).

## Gotchas (learned the hard way)

- This Lightsail image's systemd (255.4-1ubuntu8.16) REJECTS
  `Restart=unless-stopped` ("Failed to parse service restart specifier,
  ignoring") — the unit runs but NEVER auto-restarts. Use `Restart=always`.
- MCP initialize handshake REQUIRES `clientInfo` in params, else 400
  "Server not initialized" even with a valid token.
- sslip.io enddate reads "Nov 11 23:25:46 2026" — grep patterns like
  "Nov 11 2026" never match; use `openssl x509 -checkend` instead.
- Stopped Lightsail instances still bill — to pause, snapshot then delete.

## Teardown (if ever needed)

1. `aws lightsail delete-instance --instance-name journey-builder-mcp`
   (or snapshot first for a clean re-provision).
2. Remove `journey-builder-cloud` from opencode.jsonc.
3. Laptop: nothing to change (local + funnel entries still valid).
4. Restore the funnel as primary if the laptop becomes the host again.
