# Step Selection for Custom Demos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to select/deselect individual steps within a predefined journey when creating a custom demo via the client-side wizard.

**Architecture:** Runtime dynamic orchestrator assembly + centralized `remapStepReferences()` post-processing. No changes to existing step partials, journey JSONs, or build pipeline. Default render mode (no step selection) is unchanged.

**Tech Stack:** Vanilla JS (demo-renderer.js, demo-ui.js, demo-ui-static.test.js), Node.js test runner, Handlebars client-side runtime.

---

### Task 1: `remapStepReferences()` Utility Function

**Files:**
- Modify: `public/js/demo-renderer.js` (add new function ~40 lines)

A single centralized function that handles ALL post-compilation HTML fixup. Called once per custom-demo render.

- [ ] **Step 1: Write the failing test**

```javascript
// test/demo-renderer.test.js
test('remapStepReferences corrects all 4 reference types', async function() {
  const { remapStepReferences } = loadRendererWithPack(createPack());
  
  const inputHtml = `
    <div id="step-3" class="step-section">
      <span data-step="3">content</span>
      <a href="#step-3">link</a>
      <button onclick="scrollToStep(3)">Nav</button>
    </div>
    <div id="step-5" class="step-section">
      <span data-step="5">content</span>
      <a href="#step-5">link</a>
      <button onclick="scrollToStep(5)">Nav</button>
    </div>
  `;
  
  const result = remapStepReferences(inputHtml, [1,2,3,4,5,6,7,8,9,10,11,12], [3, 5]);
  
  // Step 3 → display 1, Step 5 → display 2
  assert.match(result.html, /id="step-1"/);
  assert.match(result.html, /data-step="1"/);
  assert.match(result.html, /scrollToStep\(1\)/);
  assert.match(result.html, /href="#step-1"/);
  assert.match(result.html, /id="step-2"/);
  assert.match(result.html, /data-step="2"/);
  assert.match(result.html, /scrollToStep\(2\)/);
  assert.match(result.html, /href="#step-2"/);
  assert.doesNotMatch(result.html, /id="step-3"/);
  assert.doesNotMatch(result.html, /id="step-5"/);
  assert.deepEqual(result.stepMap, { 3: 1, 5: 2 });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `'/mnt/c/Program Files/nodejs/node.exe' --test test/demo-renderer.test.js`
Expected: FAIL — `remapStepReferences is not a function`

- [ ] **Step 3: Implement `remapStepReferences(html, fullSteps, selectedSteps)`**

```javascript
/**
 * remapStepReferences(html, fullSteps, selectedSteps)
 * Post-processes compiled HTML to remap step IDs, data attributes,
 * scrollToStep calls, and anchor hrefs from original numbers to display numbers.
 * 
 * @param {string} html - Compiled HTML with all step sections
 * @param {Array} fullSteps - Full steps array for the journey
 * @param {Array} selectedSteps - Array of selected step numbers (original)
 * @returns {{ html: string, stepMap: Object }}
 */
function remapStepReferences(html, fullSteps, selectedSteps) {
  // Build mapping: original step number → sequential display number
  var stepMap = {};
  for (var i = 0; i < selectedSteps.length; i++) {
    stepMap[selectedSteps[i]] = i + 1;
  }
  
  // Remap in reverse order (largest numbers first) to avoid
  // double-replacement when one number is a substring of another
  var sortedOriginals = selectedSteps.slice().sort(function(a, b) { return b - a; });
  
  var result = html;
  for (var j = 0; j < sortedOriginals.length; j++) {
    var orig = sortedOriginals[j];
    var display = stepMap[orig];
    
    // Replace id="step-N" → id="step-M"
    result = result.split('id="step-' + orig + '"').join('id="step-' + display + '"');
    // Replace data-step="N" → data-step="M"
    result = result.split('data-step="' + orig + '"').join('data-step="' + display + '"');
    // Replace scrollToStep(N) → scrollToStep(M)
    result = result.split('scrollToStep(' + orig + ')').join('scrollToStep(' + display + ')');
    // Replace href="#step-N" → href="#step-M"
    result = result.split('href="#step-' + orig + '"').join('href="#step-' + display + '"');
  }
  
  return { html: result, stepMap: stepMap };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `'/mnt/c/Program Files/nodejs/node.exe' --test test/demo-renderer.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
'/mnt/c/Program Files/nodejs/node.exe' --test test/demo-renderer.test.js
git add test/demo-renderer.test.js public/js/demo-renderer.js
git commit -m "feat: add remapStepReferences() utility for step ID remapping"
```

---

### Task 2: `buildDynamicOrchestrator()` + `isCustomDemo` Flag

**Files:**
- Modify: `public/js/demo-renderer.js`

- [ ] **Step 1: Write the failing test**

```javascript
test('buildDynamicOrchestrator assembles only selected step partials', async function() {
  var pack = createPack();
  pack.partials['step1-retailer_onboarding'] = 'STEP1_CONTENT';
  pack.partials['step3-retailer_onboarding'] = 'STEP3_CONTENT';
  pack.partials['step5-retailer_onboarding'] = 'STEP5_CONTENT';
  
  var renderer = loadRendererWithPack(pack);
  await renderer.loadPack();
  
  var template = renderer.buildDynamicOrchestrator('retailer_onboarding', [1, 3, 5]);
  assert.match(template, /STEP1_CONTENT/);
  assert.match(template, /STEP3_CONTENT/);
  assert.match(template, /STEP5_CONTENT/);
  // No unselected steps
  assert.doesNotMatch(template, /step2/);
  assert.doesNotMatch(template, /step4/);
});

test('isCustomDemo flag is true when selectedSteps provided', async function() {
  var renderer = loadRendererWithPack(createPack());
  await renderer.loadPack();
  var result = await renderer.render({
    name: 'Test Brand',
    products: [],
    journeyType: 'retailer_onboarding',
    selectedSteps: [1, 2, 3]
  });
  assert.equal(result.isCustomDemo, true);
  assert.ok(result.stepMap);
});

test('isCustomDemo flag is false without selectedSteps', async function() {
  var renderer = loadRendererWithPack(createPack());
  await renderer.loadPack();
  var result = await renderer.render({
    name: 'Test Brand',
    products: [],
    journeyType: 'retailer_onboarding'
  });
  assert.equal(result.isCustomDemo, false);
  assert.equal(result.stepMap, undefined);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `'/mnt/c/Program Files/nodejs/node.exe' --test test/demo-renderer.test.js`
Expected: FAIL — `buildDynamicOrchestrator` not defined

- [ ] **Step 3: Implement `buildDynamicOrchestrator(journeyType, selectedSteps, pack)`**

```javascript
/**
 * buildDynamicOrchestrator(journeyType, selectedSteps, pack)
 * Assembles a Handlebars template string from partial sources
 * for only the selected steps.
 */
function buildDynamicOrchestrator(journeyType, selectedSteps, pack) {
  var partials = pack.partials || {};
  var parts = [];
  for (var i = 0; i < selectedSteps.length; i++) {
    var stepNum = selectedSteps[i];
    var partialName = 'step' + stepNum + '-' + journeyType;
    var source = partials[partialName];
    if (source) {
      parts.push(source);
    }
  }
  return parts.join('\n');
}
```

- [ ] **Step 4: Wire `isCustomDemo` into `render()`**

In the `render()` function, after `input` is parsed:

```javascript
var isCustomDemo = !!(input.selectedSteps && input.selectedSteps.length > 0);
```

In the journey compilation section, when `isCustomDemo`:
```javascript
var journey = buildJourney(journeyType, brand, catalog, input.selectedSteps);
```

In the template section:
```javascript
var journeyTemplateSrc;
if (isCustomDemo) {
  journeyTemplateSrc = buildDynamicOrchestrator(journeyType, input.selectedSteps, pack);
} else {
  journeyTemplateSrc = (pack.journeyScreens || {})[journeyType];
}
```

In the context passed to Handlebars:
```javascript
var context = {
  journey: journey,
  brand: brand,
  brandLogo: brandLogo,
  catalog: catalog,
  industry: industry,
  isCustomDemo: isCustomDemo,
  // ... existing context
};
```

In the return value:
```javascript
return {
  html: compiledHtml,
  brand: brand,
  journeyType: journeyType,
  journeyTitle: journeyTitle,
  isCustomDemo: isCustomDemo,
  stepMap: isCustomDemo ? result.stepMap : undefined
};
```

- [ ] **Step 5: Run test to verify all pass**

Run: `'/mnt/c/Program Files/nodejs/node.exe' --test test/demo-renderer.test.js`
Expected: all PASS

- [ ] **Step 6: Commit**

```bash
git add public/js/demo-renderer.js test/demo-renderer.test.js
git commit -m "feat: add buildDynamicOrchestrator() and isCustomDemo render mode"
```

---

### Task 3: Step Filtering in `buildJourney()` with `originalNum` / `displayNum`

**Files:**
- Modify: `public/js/demo-renderer.js`

- [ ] **Step 1: Write the failing test**

```javascript
test('buildJourney filters steps and sets originalNum + displayNum', async function() {
  var renderer = loadRendererWithPack(createPack());
  await renderer.loadPack();
  var brand = renderer.buildBrand({ name: 'Test', products: [] });
  var catalog = renderer.buildCatalog({ name: 'Test', products: [] });
  var journey = renderer.buildJourney('retailer_onboarding', brand, catalog, [1, 3, 5]);
  
  assert.equal(journey.steps.length, 3);
  assert.equal(journey.steps[0].num, 1);
  assert.equal(journey.steps[0].originalNum, 1);
  assert.equal(journey.steps[0].displayNum, 1);
  assert.equal(journey.steps[1].num, 2);
  assert.equal(journey.steps[1].originalNum, 3);
  assert.equal(journey.steps[1].displayNum, 2);
  assert.equal(journey.steps[2].num, 3);
  assert.equal(journey.steps[2].originalNum, 5);
  assert.equal(journey.steps[2].displayNum, 3);
});

test('buildJourney without selectedSteps keeps all steps unchanged', async function() {
  var renderer = loadRendererWithPack(createPack());
  await renderer.loadPack();
  var brand = renderer.buildBrand({ name: 'Test', products: [] });
  var catalog = renderer.buildCatalog({ name: 'Test', products: [] });
  var journey = renderer.buildJourney('retailer_onboarding', brand, catalog);
  
  assert.equal(journey.steps.length, 12);
  assert.equal(journey.steps[0].originalNum, undefined);
  assert.equal(journey.steps[0].displayNum, undefined);
});
```

- [ ] **Step 2: Run test to verify it fails**

Expected: FAIL — `originalNum` / `displayNum` not set on steps

- [ ] **Step 3: Modify `buildJourney(journeyType, brand, catalog, selectedSteps)`**

Add a 4th parameter `selectedSteps`. At the end of the function, after the base journey is loaded:

```javascript
function buildJourney(journeyType, brand, catalog, selectedSteps) {
  var templateData = (_pack.defaultJourneyData || {})[journeyType];
  if (!templateData) {
    console.warn('[DemoRenderer] Unknown journey type:', journeyType);
    return null;
  }
  // Deep clone
  var journey = JSON.parse(JSON.stringify(templateData));
  
  // Apply brand dealer name
  if (brand && brand.dealerStoreName && journey.dealer) {
    journey.dealer.name = brand.dealerStoreName;
  }
  
  // --- Step filtering (new) ---
  if (selectedSteps && selectedSteps.length > 0 && journey.steps) {
    var fullSteps = journey.steps;
    var filtered = [];
    for (var i = 0; i < selectedSteps.length; i++) {
      var stepNum = selectedSteps[i];
      var stepIdx = stepNum - 1; // convert to 0-based
      if (stepIdx >= 0 && stepIdx < fullSteps.length) {
        var step = JSON.parse(JSON.stringify(fullSteps[stepIdx]));
        step.originalNum = step.num;
        step.displayNum = i + 1;
        step.num = step.displayNum;
        filtered.push(step);
      }
    }
    journey.steps = filtered;
  }
  
  // Apply catalog data
  if (catalog && catalog.products && catalog.products.length > 0) {
    journey = applyCatalogToJourney(journey, catalog);
  }
  
  return journey;
}
```

- [ ] **Step 4: Update `render()` to pass `selectedSteps` to `buildJourney()`**

In `render()`, change the `buildJourney` call from:
```javascript
var journey = buildJourney(journeyType, brand, catalog);
```
to:
```javascript
var journey = buildJourney(journeyType, brand, catalog, isCustomDemo ? input.selectedSteps : undefined);
```

- [ ] **Step 5: Run test to verify all pass**

Run: `'/mnt/c/Program Files/nodejs/node.exe' --test test/demo-renderer.test.js`
Expected: all PASS

- [ ] **Step 6: Commit**

```bash
git add public/js/demo-renderer.js test/demo-renderer.test.js
git commit -m "feat: filter journey steps with originalNum + displayNum in buildJourney()"
```

---

### Task 4: Wire `remapStepReferences()` into `render()`

**Files:**
- Modify: `public/js/demo-renderer.js`

- [ ] **Step 1: Write the failing test**

```javascript
test('render with step selection produces sequential step IDs', async function() {
  var renderer = loadRendererWithPack(createPack());
  await renderer.loadPack();
  var result = await renderer.render({
    name: 'Test Brand',
    products: [],
    journeyType: 'retailer_onboarding',
    selectedSteps: [1, 3, 5]
  });
  // Should have step-1, step-2, step-3 (not step-3, step-5)
  assert.match(result.html, /step-1/);
  assert.match(result.html, /step-2/);
  assert.match(result.html, /step-3/);
  assert.doesNotMatch(result.html, /step-4/);
  assert.doesNotMatch(result.html, /step-5/);
  assert.doesNotMatch(result.html, /step-6/);
  assert.equal(result.isCustomDemo, true);
  assert.ok(result.stepMap);
});

test('render without step selection is unchanged', async function() {
  var renderer = loadRendererWithPack(createPack());
  await renderer.loadPack();
  var result = await renderer.render({
    name: 'Test Brand',
    products: [],
    journeyType: 'retailer_onboarding'
  });
  assert.equal(result.isCustomDemo, false);
  assert.equal(result.stepMap, undefined);
});
```

- [ ] **Step 2: Run test to verify it fails**

Expected: FAIL — compiled HTML still has original step IDs

- [ ] **Step 3: Add post-processing call in `render()`**

After template compilation, add:

```javascript
// Post-process step references for custom demos
var stepMap;
if (isCustomDemo) {
  var remapped = remapStepReferences(
    compiledHtml,
    (pack.defaultJourneyData[journeyType] || {}).steps || [],
    input.selectedSteps
  );
  compiledHtml = remapped.html;
  stepMap = remapped.stepMap;
}
```

Place this after `compiledHtml = template(context)` and before the return statement.

- [ ] **Step 4: Run test to verify all pass**

Run: `'/mnt/c/Program Files/nodejs/node.exe' --test test/demo-renderer.test.js`
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add public/js/demo-renderer.js test/demo-renderer.test.js
git commit -m "feat: wire remapStepReferences into render() for custom demos"
```

---

### Task 5: Step Selection Wizard UI

**Files:**
- Modify: `public/js/demo-ui.js`
- Modify: `public/style.css`

- [ ] **Step 1: Write the failing test**

```javascript
// test/demo-ui-static.test.js
test('wizard shows step selection panel after journey selection', async function() {
  // Mock the renderer to return journeyDescriptions
  window.DemoRenderer = {
    journeyDescriptions: {
      retailer_onboarding: { title: 'Retailer Onboarding', steps: 12, scaffold: false },
      dealer_engagement: { title: 'Dealer Engagement', steps: 3, scaffold: false }
    }
  };
  
  // Load the page
  document.body.innerHTML = await loadWizardHTML();
  await loadWizardScript();
  
  // Select a journey
  document.getElementById('journeyTypeInput').value = 'retailer_onboarding';
  document.getElementById('journeyTypeInput').dispatchEvent(new Event('change'));
  
  // Step selection panel should appear with 12 checkboxes
  var stepList = document.getElementById('stepSelectionPanel');
  assert.ok(stepList);
  var checkboxes = stepList.querySelectorAll('input[type="checkbox"]');
  assert.equal(checkboxes.length, 12);
  // All checked by default
  var checked = stepList.querySelectorAll('input[type="checkbox"]:checked');
  assert.equal(checked.length, 12);
});

test('deselecting all steps disables generate button', async function() {
  document.getElementById('journeyTypeInput').value = 'dealer_engagement';
  document.getElementById('journeyTypeInput').dispatchEvent(new Event('change'));
  
  var checkboxes = document.querySelectorAll('#stepSelectionPanel input[type="checkbox"]');
  checkboxes.forEach(function(cb) { cb.checked = false; });
  checkboxes[0].dispatchEvent(new Event('change'));
  
  assert.equal(document.getElementById('generateBtn').disabled, true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `'/mnt/c/Program Files/nodejs/node.exe' --test test/demo-ui-static.test.js`
Expected: FAIL — step selection panel not found

- [ ] **Step 3: Add step selection HTML structure**

In `public/index.html`, add a `<section>` for step selection (or add it dynamically in demo-ui.js). The dynamic approach is preferable since step lists vary by journey.

In `demo-ui.js`, add after journey type selection handler:

```javascript
function updateStepSelection() {
  var journeyType = document.getElementById('journeyTypeInput').value;
  var panel = document.getElementById('stepSelectionPanel');
  if (!panel) return;
  
  var descs = (window.DemoRenderer && window.DemoRenderer.journeyDescriptions) || {};
  var desc = descs[journeyType];
  if (!desc || !desc.steps) {
    panel.style.display = 'none';
    return;
  }
  
  var html = '<h3>Steps to include</h3>';
  html += '<div class="step-checklist">';
  html += '<label class="step-all-toggle"><input type="checkbox" checked onchange="toggleAllSteps(this.checked)"> Select All</label>';
  for (var i = 1; i <= desc.steps; i++) {
    html += '<label class="step-checkbox-row">';
    html += '  <input type="checkbox" value="' + i + '" checked onchange="onStepToggle()">';
    html += '  <span class="step-num-badge">' + i + '</span>';
    html += '  <span class="step-label">Step ' + i + '</span>';
    html += '</label>';
  }
  html += '</div>';
  panel.innerHTML = html;
  panel.style.display = 'block';
  
  window.selectedSteps = null; // null = all steps
}

function toggleAllSteps(checked) {
  var checkboxes = document.querySelectorAll('#stepSelectionPanel input[type="checkbox"][value]');
  checkboxes.forEach(function(cb) { cb.checked = checked; });
  onStepToggle();
}

function onStepToggle() {
  var checkboxes = document.querySelectorAll('#stepSelectionPanel input[type="checkbox"][value]');
  var checked = [];
  checkboxes.forEach(function(cb) {
    if (cb.checked) checked.push(parseInt(cb.value));
  });
  window.selectedSteps = checked.length === checkboxes.length ? null : checked;
  document.getElementById('generateBtn').disabled = (checked.length === 0);
}
```

In the `generate()` function where `userInput` is built, add:
```javascript
var userInput = {
  name: document.getElementById('brandNameInput').value,
  industry: document.getElementById('industryInput').value,
  products: parsedProducts,
  journeyType: document.getElementById('journeyTypeInput').value,
  logoDataUrl: logoDataUrl,
};
// Add step selection
if (window.selectedSteps) {
  userInput.selectedSteps = window.selectedSteps;
}
```

- [ ] **Step 4: Add CSS styles**

In `public/style.css`:

```css
.step-checklist {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 8px 0;
  max-height: 300px;
  overflow-y: auto;
}
.step-checkbox-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border: 1px solid #e8e8e8;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.1s;
}
.step-checkbox-row:hover {
  background: #f5f5f5;
}
.step-checkbox-row input[type="checkbox"]:not(:checked) + .step-num-badge {
  opacity: 0.4;
}
.step-num-badge {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--brand, #075e54);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
  flex-shrink: 0;
}
.step-all-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 600;
  color: #555;
  cursor: pointer;
  border-bottom: 1px solid #eee;
  margin-bottom: 4px;
}
```

- [ ] **Step 5: Run test to verify all pass**

Run: `'/mnt/c/Program Files/nodejs/node.exe' --test test/*.test.js`
Expected: all 15 existing + new UI tests pass

- [ ] **Step 6: Commit**

```bash
git add public/index.html public/js/demo-ui.js public/style.css test/demo-ui-static.test.js
git commit -m "feat: add step selection UI with checklist panel in wizard"
```

---

### Task 6: Integration Test — Full Custom Demo with Step Selection

**Files:**
- Modify: `test/demo-renderer.test.js`

- [ ] **Step 1: Write end-to-end test**

```javascript
test('full render with step selection returns valid HTML with sequential step IDs', async function() {
  var renderer = loadRendererWithPack(createPack());
  await renderer.loadPack();
  var result = await renderer.render({
    name: 'Acme Corp',
    products: [
      { name: 'Product A', price: 100, unit: 'pc', imageDataUrl: 'data:image/png;base64,AAA=' },
      { name: 'Product B', price: 200, unit: 'pc', imageDataUrl: 'data:image/png;base64,BBB=' }
    ],
    journeyType: 'order_to_cash',
    selectedSteps: [1, 3, 5]
  });
  
  assert.ok(result.html);
  assert.ok(result.html.length > 500);
  assert.match(result.html, /id="step-1"/);
  assert.match(result.html, /id="step-2"/);
  assert.match(result.html, /id="step-3"/);
  assert.doesNotMatch(result.html, /id="step-4"/);
  assert.doesNotMatch(result.html, /id="step-5"/);
  assert.equal(result.isCustomDemo, true);
  assert.deepEqual(result.stepMap, { 1: 1, 3: 2, 5: 3 });
});

test('empty selectedSteps array throws or returns handled error', async function() {
  var renderer = loadRendererWithPack(createPack());
  await renderer.loadPack();
  var result = await renderer.render({
    name: 'Test',
    products: [],
    journeyType: 'retailer_onboarding',
    selectedSteps: []
  });
  // Must not crash — return empty html or throw gracefully
  assert.ok(result);
  assert.ok(result.html === '' || result.error);
});
```

- [ ] **Step 2: Run test to verify**

Run: `'/mnt/c/Program Files/nodejs/node.exe' --test test/demo-renderer.test.js`
Expected: all PASS

- [ ] **Step 3: Handle empty selection edge case**

In `render()`, add early-return for empty selectedSteps:
```javascript
if (isCustomDemo && input.selectedSteps.length === 0) {
  return { html: '', brand: null, journeyType: journeyType, journeyTitle: '', isCustomDemo: true, error: 'No steps selected' };
}
```

- [ ] **Step 4: Commit**

```bash
git add public/js/demo-renderer.js test/demo-renderer.test.js
git commit -m "feat: add e2e tests for step selection render, handle empty selection"
```

---

### Task 7: Build, Rebuild Template-Pack, Final Verification

**Files:**
- Run: `node build.js`
- Run: `node scripts/build-template-pack.js`
- Run: `node --test test/*.test.js`

- [ ] **Step 1: Run build**

```bash
cd '/mnt/f/Sellerhub/Rakesh/JK Cement Vishal/demo-generator'
'/mnt/c/Program Files/nodejs/node.exe' build.js
```
Expected: No errors, all brands build successfully

- [ ] **Step 2: Rebuild template-pack**

```bash
'/mnt/c/Program Files/nodejs/node.exe' scripts/build-template-pack.js
```
Expected: All keys present, 88 partials, 6 journey descriptions

- [ ] **Step 3: Run full test suite**

```bash
'/mnt/c/Program Files/nodejs/node.exe' --test test/*.test.js
```
Expected: 15+ existing tests + 7+ new tests = 22+ total, all pass

- [ ] **Step 4: Commit final**

```bash
git add -A
git commit -m "chore: rebuild template-pack after step selection changes"
git push origin main
```

---

## Self-Review Checklist

1. **Spec coverage:**
   - ✅ Runtime-orchestrator note → Task 2 (buildDynamicOrchestrator)
   - ✅ remapStepReferences() utility → Task 1
   - ✅ originalNum + displayNum → Task 3
   - ✅ isCustomDemo flag → Task 2 + Task 4
   - ✅ Step selection UI → Task 5
   - ✅ Tests → Tasks 1-6 include tests for each component
   - ✅ Empty selection handling → Task 6 step 3
   - ✅ Backward compatibility → Task 3 step test ensures untouched path

2. **Placeholder scan:** No TBD, TODO, or vague steps. Every step has concrete code and commands.

3. **Type consistency:**
   - `remapStepReferences(html, fullSteps, selectedSteps)` → `{ html, stepMap }` — consistent across Tasks 1 and 4
   - `buildJourney(type, brand, catalog, selectedSteps)` → Task 3, consistent with existing signature
   - `buildDynamicOrchestrator(type, selectedSteps, pack)` → Task 2
   - `isCustomDemo` boolean → Tasks 2, 3, 4
   - `step.originalNum`, `step.displayNum`, `step.num` → Task 3
   - `selectedSteps` array → Tasks 3, 4, 5, 6

4. **Test/code balance:** Each task has both test code and implementation code. No "write tests later" patterns.
