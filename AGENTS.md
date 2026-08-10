# Agent rules — journey-builder MCP

This repo contains the journey-builder MCP server. Its purpose: let the sales team
create new WhatsApp demo journeys for NEW companies from EXISTING projects,
seamlessly. The source project provides structure and steps; the new journey is
for a new company, so its logo, product images, website, and content always differ.

When using the journey-builder MCP tools (in OpenCode or any MCP client):

1. ALWAYS call `list_bases` first — it returns the full project library.
2. Ask the user which EXISTING project to use as reference (structure + steps),
   then which journey within it.
3. BEFORE building, collect the NEW company's brand pack:
   - call `list_industries` and ask the user which industry the new company is in
   - ask for: logo (image file or URL — or ask where the stored assets are: the
     user selects a folder path like `D:\Sales\Acme\assets` or attaches files in
     the prompt), product images (1-3), website link, and optionally a tagline
4. Call `build_journey` and ALWAYS pass:
   - `sourceProject` — the project id from list_bases (e.g. `v_n_fogg`, `banas_diary`)
   - `sourceJourney` — the journey name within that project (e.g. `vini_order_to_cash`)
   - `industry`, `website`, `logoUrl` (or `logoPath`/`logoBase64`), `productImages`
     (or `productImagePaths`) from the brand pack
   Use `sourceProject="base"` ONLY when the user explicitly wants a from-scratch
   journey and no existing project matches.
5. NEVER build without a source project. The server rejects it — but do not even
   try: without a source you get a generic placeholder, which is a failed demo.
6. After the build, run the content-adaptation workflow:
   - `stage_for_edit` (projectPath from the build response) — returns a
     Windows-accessible path + the content checklist. If your file tools cannot
     reach the WSL path, edit the files under `windowsPath`.
   - Rewrite EVERY content-bearing text for the NEW company (messages, captions,
     screen labels, sidebar, const steps, topbar name, numbers/timestamps). Keep
     the shell: section count, phone frames, layout. ZERO source-company
     references. Save UTF-8 WITHOUT BOM.
   - `finalize_journey` (same projectPath) — syncs back and AUTO-runs
     verify_journey with expectedSteps + the source-leak guard. It must PASS
     before you show the journey.
7. After each build, report the preview URL from the response (`preview.publicUrl`,
   or `preview.localUrl` if public is null). Open it to verify before telling the
   user the journey is done.
8. Do NOT invent step counts, titles, or details — report what the build response
   and the actual files contain.
9. If the user names a brand (e.g. "Vini Fogg", "Banas Diary"), find the matching
   project in list_bases and build from it.
