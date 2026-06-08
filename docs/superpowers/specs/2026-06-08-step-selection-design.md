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

### Runtime-Orchestrator (key architectural note)

The dynamic orchestrator is **not baked at build time**. It is assembled entirely at **runtime** in the client-side browser by `demo-renderer.js`. The static build pipeline (`build.js --dist`) is unaffected — it always produces full journeys. Only the client-side wizard path (via `template-pack.json`) uses the runtime-orchestrator.

When `render()` is called without `selectedSteps` (default/journey-mode), the renderer uses the pre-built orchestrator from `pack.journeyScreens[journeyType]` — same as today. The runtime-orchestrator only activates when `selectedSteps` is explicitly provided.

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

#### `renderMode` / `isCustomDemo` flag

The renderer gains an `isCustomDemo` flag to distinguish render modes:

| Mode | `isCustomDemo` | Orchestrator Source | Step Selection |
|------|:---:|---------------------|----------------|
| Journey (default) | `false` | `pack.journeyScreens[journeyType]` (fixed) | All steps |
| Custom demo | `true` | Runtime-assembled from selected partials | Filtered |

The flag is set automatically:
- `render({...selectedSteps})` → `isCustomDemo: true`
- `render({...})` without `selectedSteps` → `isCustomDemo: false` (current behavior)

This flag is passed into the render context so templates can conditionally show/hide elements, and the sidebar rendering code can use it to adjust behavior (e.g., adding "original step N" labels on hover).

#### Input change

`render(userInput)` now accepts:
- `userInput.selectedSteps` — array of step numbers to include (e.g., `[1, 3, 5, 7]`)
- Absent → all steps selected (backward compatible)

#### New function: `buildDynamicOrchestrator(journeyType, selectedSteps, pack)`

1. Gets all partial sources from `pack.partials`
2. For each selected step `s`, gets `pack.partials["step{s}-{journeyType}"]`
3. Concatenates them into a single template string

#### Modified: `buildJourney(journeyType, brand, catalog, selectedSteps)`

1. Loads default journey data as before
2. If `selectedSteps` provided:
   - Filters `journey.steps` to only selected steps
   - For each step, assigns:
     - `step.originalNum` — original step number from the full journey (preserved, never changes)
     - `step.displayNum` — sequential display number after filtering (1, 2, 3...)
     - `step.num` — set to `displayNum` (for backward compatibility with sidebar rendering)
   - Stores `_selectedStepsOriginal` — original step numbers for reference
3. Returns filtered journey data

#### Centralized utility: `remapStepReferences(html, originalSteps, selectedSteps)`

A single function that handles ALL post-compilation HTML fixup:

```
remapStepReferences(html, originalSteps, selectedSteps)
  → { html, stepMap }
```

Input:
- `html` — compiled HTML string with all step sections
- `originalSteps` — full journey steps array
- `selectedSteps` — array of selected step numbers

Processing:
1. Build a mapping: originalStepNumber → newDisplayNumber (e.g., 3→1, 5→2, 7→3)
2. Replace `id="step-{old}"` → `id="step-{new}"` in step-section divs
3. Replace `data-step="{old}"` → `data-step="{new}"` (used by navigation JS)
4. Replace `scrollToStep({old})` → `scrollToStep({new})` in sidebar onclick handlers
5. Replace `#step-{old}` href anchors → `#step-{new}`
6. Optionally add `data-original-step="{old}"` to each step-section for debug/reference

Returns:
- `html` — cleaned HTML
- `stepMap` — `{ original: new }` mapping for potential use by caller

This function is called ONCE per render, after compilation. No scattered post-processing anywhere else.

#### Modified: `render(userInput)`

```
render(userInput):
  1. Determine isCustomDemo = !!userInput.selectedSteps
  2. buildJourney(...) — filter + renumber steps
  3. If isCustomDemo:
     - Build dynamic orchestrator via buildDynamicOrchestrator()
  4. Else:
     - Use pack.journeyScreens[journeyType] (pre-built orchestrator)
  5. Compile template with context (now includes isCustomDemo)
  6. If isCustomDemo:
     - Call remapStepReferences(compiledHtml, fullSteps, selectedSteps)
  7. Return { html, brand, journeyType, journeyTitle, isCustomDemo, stepMap }
```

### 3. Tests (`test/demo-renderer.test.js`)

- **Test: step selection renders only selected steps**
  - `render({...selectedSteps: [1, 3]})` → HTML has `step-1` and `step-2` (renumbered), no `step-3`
- **Test: all steps selected renders same as no selection**
  - `render({...})` with all 12 steps yields same output as `render({...selectedSteps: [1..12]})`
- **Test: sidebar step count matches selection count**
  - `scrollToStep` calls in sidebar match number of selected steps
- **Test: single step selection renders 1 step-section**
- **Test: empty selection throws or returns error**
- **Test: remapStepReferences corrects all 4 reference types**
  - Verifies id=, data-step=, scrollToStep(), and href=#step- are all remapped
- **Test: isCustomDemo flag is true when selectedSteps provided**
- **Test: isCustomDemo flag is false without selectedSteps**

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
                                → isCustomDemo = true
                                → buildJourney():
                                   filter steps[] to [1,3,5]
                                   assign originalNum, displayNum
                                → buildDynamicOrchestrator():
                                   get partial strings for steps 1,3,5
                                   concatenate: step1 + step3 + step5
                                → compile with filtered data
                                → remapStepReferences():
                                   step-1→step-1, step-3→step-2, step-5→step-3
                                   fix data-step, scrollToStep, href anchors
                                → return { html, isCustomDemo: true, stepMap }
```

## Backward Compatibility

- Existing `render({...})` without `selectedSteps` → all steps, same as today (fixed orchestrator, no stepMap)
- Existing `render({...selectedSteps: [1..N]})` with all steps → functionally identical output
- Static `dist/` builds → unchanged (always full journeys)
- Existing tests → all pass (no behavior change)
- `originalNum` is only set when `selectedSteps` is provided — absent in default mode

## Files Changed

| File | Lines Changed | Type |
|------|--------------|------|
| `public/js/demo-ui.js` | ~80 added | New step checklist UI |
| `public/js/demo-renderer.js` | ~60 added | buildDynamicOrchestrator, step filtering, remapStepReferences(), isCustomDemo flag |
| `test/demo-renderer.test.js` | ~50 added | 7 new test cases |
| `public/style.css` | ~20 added | Step checkbox card styling |

## Constraints

- Minimum 1 step required (show validation, don't render empty demo)
- Disallowed: steps not in the journey (silently ignored)
- Server-side generation (`build.js --dist`) not affected — always full journeys
- `originalNum` is read-only (set during buildJourney, consumed by sidebar/reference tooltips)
- `displayNum` drives all rendered IDs, sidebar order, and navigation
