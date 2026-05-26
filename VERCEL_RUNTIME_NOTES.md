Vercel runtime notes

- Use `/tmp` for ephemeral session data. The runtime uses `process.env.SESSION_DIR` or `/tmp/sessions` by default.
- Cold start: functions should be idempotent and avoid long-lived in-memory state.
- Build strategy: generation runs inside a session-local `workspace` under the session dir so we do not mutate project files.
- Avoid writing outside session dir. All generated outputs, uploads, and exports are under `/tmp/sessions/<id>`.
- Limits: Vercel serverless ephemeral storage is limited (~512MB); image processing should be size-limited and time-limited.
- Timeouts: avoid long synchronous operations; builds are capped by `execSync` timeout—prefer to offload or increase timeout if using serverful deployment.
- Cleanup: a cleanup daemon removes expired sessions; on cold-start run the startup cleanup to remove stale sessions.
- Recommended env: set `SESSION_DIR=/tmp/sessions` in Vercel env vars.
