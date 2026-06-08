# Step Selection for Custom Demos — Design Spec

> **Date:** June 8, 2026
> **Status:** Approved for implementation

## Goal

When creating a custom demo via the client-side wizard, the user can select/deselect individual steps within a predefined journey. Only selected steps appear in the rendered demo, with clean sequential numbering.

## Architecture (Approach 2)

No changes to existing step partials, orchestrators, or journey JSON files. The system works through:

1. **Data filtering** — `journey.steps[]` array is filtered to only selected steps → sidebar auto-adjusts
2. **Dynamic template assembly** — partial sources are concatenated for only the selected steps
3. **ID remapping** — `id="step-N"` attributes are post-processed to sequential order

## Components

### 1. Wizard UI (`public/js/demo-ui.js`)

**New element:** Step checklist panel, shown after journey type selection.

- Displays all steps in the selected journey with their `num`, `title`, `meta` from journey data
- Each step has a checkbox, default: checked (all selected)
- Deselecting a step unchecks it (red border or similar visual cue)
- Selection state stored in `window.selectedSteps` array (e.g., `[1, 2, 4, 5, 7]`)
- "Select All" / "Deselect All" toggle for convenience
- Minimum 1 step must be selected (button disabled if 0)

**UI layout (inserted between journey selector and Generate button):**
```
┌─────────────────────────────────┐
│ Steps to include                │
│ ┌─ ☑ Step 1: Activation ... ─┐ │
│ │   Retailer · Registration    │ │
│ └─────────────────────────────┘ │
│ ┌─ ☑ Step 2: Welcome ...    ─┐ │
│ │   Retailer · Self-service    │ │
│ └─────────────────────────────┘ │
│ ┌─ ☐ Step 3: Campaigns ...  ─┐ │
│ │   Retailer · AI support     │ │
│ └─────────────────────────────┘ │
│                     [Select All] │
└─────────────────────────────────┘
```

### 2. Renderer (`public/js/demo-renderer.js`)

**Input change:** `render(userInput)` now accepts `userInput.selectedSteps` array.

If absent → all steps selected (backward compatible).

**New function: `buildDynamicOrchestrator(journeyType, selectedSteps, pack)`**

1. Gets all partial sources from `pack.partials`
2. For each selected step `s`, gets `pack.partials["step{s}-{journeyType}"]`
3. Concatenates them into a single template string

**Modified: `buildJourney(journeyType, brand, catalog, selectedSteps)`**

1. Loads default journey data as before
2. If `selectedSteps` provided:
   - Filters `journey.steps` to only selected steps
   - Renumbers each step sequentially (1, 2, 3...)
   - Stores `_originalStepMap` mapping new → original step numbers
3. Returns filtered journey data

**Modified: `render(userInput)` (post-compilation step)**

1. Compiles the dynamic orchestrator with filtered journey context
2. Post-processes the compiled HTML:
   - For each step section, replaces `id="step-{original}"` with `id="step-{new}"`
   - Also updates any `data-step="{original}"` attributes (used by sidebar JS)
   - Updates sidebar step items' `onclick="scrollToStep(N)"` references
3. Returns the processed HTML

**Key detail:** Message data references (`journey.messages.stepN.*`) use **original** step numbers. Since the dynamic orchestrator only includes partials for selected steps, each partial correctly references `journey.messages.stepN` using the original number baked into its template source. No data remapping needed.

### 3. Tests (`test/demo-renderer.test.js`)

- **Test: step selection renders only selected steps**
  - `render({...selectedSteps: [1, 3]})` → HTML has `step-1` and `step-2` (renumbered), no `step-3`
- **Test: all steps selected renders same as no selection**
  - `render({...})` with all 12 steps yields same output as `render({...selectedSteps: [1..12]})`
- **Test: sidebar step count matches selection count**
  - `scrollToStep` calls in sidebar match number of selected steps
- **Test: single step selection renders 1 step-section**
- **Test: empty selection throws or returns error**

### 4. Build pipeline (`build.js`)

No changes needed — static generation still produces full journeys. Step selection is client-side only.

## Data Flow

```
Wizard UI                    Renderer                     Template-Pack
─────────                    ────────                     ────────────
User selects journey         
  → load step list           
  → show checkboxes          
User toggles steps           
  → selectedSteps = [1,3,5]  
                              render({selectedSteps})
                                → buildJourney():
                                   filter steps[] to [1,3,5]
                                   renumber to 1,2,3
                                   store _originalStepMap
                                → buildDynamicOrchestrator():
                                   get partial strings for steps 1,3,5
                                   concatenate: step1 + step3 + step5
                                → compile with filtered data
                                → post-process IDs: 
                                   step-1→step-1, step-3→step-2, step-5→step-3
                                → return HTML
```

## Backward Compatibility

- Existing `render({...})` without `selectedSteps` → all steps, same as today
- Static `dist/` builds → unchanged (always full journeys)
- Existing tests → all pass (no behavior change)

## Files Changed

| File | Lines Changed | Type |
|------|--------------|------|
| `public/js/demo-ui.js` | ~80 added | New step checklist UI |
| `public/js/demo-renderer.js` | ~40 added | buildDynamicOrchestrator, step filtering, ID remapping |
| `test/demo-renderer.test.js` | ~30 added | 4 new test cases |
| `public/style.css` | ~20 added | Step checkbox card styling |

## Constraints

- Minimum 1 step required (show validation, don't render empty demo)
- Disallowed: steps not in the journey (silently ignored)
- Server-side generation (`build.js --dist`) not affected — always full journeys
