# Agent rules — journey-builder MCP

This repo contains the journey-builder MCP server. Its purpose: let the sales team
create new WhatsApp demo journeys from EXISTING projects, seamlessly.

When using the journey-builder MCP tools (in OpenCode or any MCP client):

1. ALWAYS call `list_bases` first — it returns the full project library.
2. Ask the user which EXISTING project to use as reference, then which journey
   within it.
3. Call `build_journey` and ALWAYS pass:
   - `sourceProject` — the project id from list_bases (e.g. `v_n_fogg`, `banas_diary`)
   - `sourceJourney` — the journey name within that project (e.g. `vini_order_to_cash`)
   Use `sourceProject="base"` ONLY when the user explicitly wants a from-scratch
   journey and no existing project matches.
4. NEVER build without a source project. The server now rejects it — but do not
   even try: without a source you get a generic placeholder, which is a failed demo.
5. After each build, report the preview URL from the response (`preview.publicUrl`,
   or `preview.localUrl` if public is null). Open it to verify before telling the
   user the journey is done.
6. Do NOT invent step counts, titles, or details — report what the build response
   and the actual files contain.
7. If the user names a brand (e.g. "Vini Fogg", "Banas Diary"), find the matching
   project in list_bases and build from it.
