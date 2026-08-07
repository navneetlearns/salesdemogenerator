# Pitfalls — failure signatures and fixes

## 1. Charset / document-header order → mojibake "random characters" (REAL BUG)

**Signature**: File starts with `<style>` (often a huge base64 CSS block) and only
later emits `</head><body><!DOCTYPE html><html><head><meta charset="UTF-8">`. Browsers
prescan only the FIRST 1024 bytes for a charset declaration; if none is found they
fall back to the system default (windows-1252 on many setups) and every UTF-8 char
decodes wrong — `₹`→`â‚¹`, `—`→`â€"`, `·`→`Â·`, emoji→latin garbage, at multiple places.

**Why it's nasty**: Chromium (Playwright) sniffs UTF-8 and renders FINE, so screenshots
look perfect while the user's browser shows garbage. Never trust a clean Playwright
render as proof of encoding correctness — check the file structure.

**Fix**: Rebuild the header so doctype/charset come first:
```
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>...</title>
</head>
<body>
<style>...existing CSS...</style>
...
```
**Verify**: `file.find('<!DOCTYPE') == 0` and `file.find('<meta charset') < 200` and
`document.characterSet == 'UTF-8'` — all three, every time.

## 2. Logo / icon embeds

- Embed the brand logo base64 ONCE in CSS (`.ava-logo` / `.tb-av` rule) and reference
  it everywhere via that class. Re-embedding per phone frame bloats the file and
  breaks the mock-generator convention.
- Inserting the logo rule INSIDE another CSS declaration block (anchor was only the
  first half of a rule) silently breaks the override — append the rule before
  `</style>` instead.
- Base64 data-URI icons belong in CSS variables/classes, never pasted inline into
  body markup.

## 3. `const steps` is JS, not JSON

Journey files carry `const steps = [...]` with UNQUOTED keys and single-quoted strings
(HTML inside desc). `json.loads` AND `ast.literal_eval` both fail. Parse per-field with
regex: `\{\s*title:'(.*?)',\s*desc:'(.*?)'\s*\}` (re.S), strip tags from desc.

## 4. Counting classes with regex

`class="step-section"` exact-string counts MISS tokens like `class="step-section active"`.
Use `class="step-section[^"]*"`.

## 5. Repo discipline

- Build in a scratch workspace; the final mirror into the repo's `projects/` must be
  byte-identical (`diff -q` silent) — verify, don't assume cp succeeded.
- Never edit the base project — clone it.

## 6. Deploy honesty

`deploy.sh` (AWS Amplify) requires AWS credentials configured on the machine. If creds
are missing, shipping = repo mirror + share zip + docs. Never claim a deploy happened;
report it as blocked by missing credentials if asked.

## 7. Verification honesty

Screenshots + pixel probes (DM steps dark-teal #075E54 top bar; group step = no teal,
iOS-blue back arrow, white top bar; webview = no teal; ERP = navy topnav; brand color
present everywhere) are the visual gate. Text probes (₹ strings, order refs) are the
content gate. Both, every time — never "it loads, so it's done".
