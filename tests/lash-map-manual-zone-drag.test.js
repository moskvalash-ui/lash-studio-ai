'use strict';
// ============================================================
// PHASE 1 — MANUAL PHOTO ZONE-LENGTH DRAG (direct-manipulation input
// method for the existing customLeft/customRight zone-length system).
// ------------------------------------------------------------
// Real extraction+eval of the actual, unmodified clampZoneMm/
// setCustomZoneForSide/setCustomZone/applyZoneDrag closures from
// LashMapScreen (index.html), same technique lash-map-back-navigation.
// test.js already uses for viewMap -- this repo has no @babel/core hard
// dependency, so the surrounding JSX/React component itself can't be
// rendered in Node (see that file's own precedent); the drag math is
// pure/DOM-independent and lives in its own const declarations, so it
// can be sliced out and exercised directly, with design/mode/lengthDelta/
// customLeft/customRight/the state setters injected as plain parameters
// standing in for the real closure variables.
//
// What this file does NOT cover (explicitly out of scope this round):
// the SVG pointer-capture/getScreenCTM drag gesture itself inside
// LegacyProfessionalEyeMap (beginDrag/moveDrag's 'zone' branch) requires
// a real DOM/SVG environment to execute; exercising that needs a real or
// headless browser, which this Phase 1 pass was explicitly instructed
// not to start. That branch's PURE pixel->mm formula is still verified
// here in isolation (section B), and the surrounding gesture wiring is
// verified structurally (section C) and by the byte-identity proof that
// the pre-existing map/inner/outer/peak position-drag code is completely
// unmodified (section D). Full interactive-gesture coverage is a natural
// follow-up once real browser testing is back in scope.
//
// MASK FIT / DESIGN EDIT MODE SEPARATION (same Phase 1, added after real-
// device testing found the zone-length handles and the pre-existing
// position handles were both interactive simultaneously, which is
// confusing and was the root cause of a real touch-target collision bug
// fixed earlier the same pass). The two existing handle sets are now
// gated by a single `photoEditMode` ('mask'|'design') so only one is ever
// interactive at a time -- see section F below. The small positional
// offset workaround from the collision fix was removed once mode
// separation made the collision structurally impossible; section F also
// proves the exclusivity that replaces it.
// ============================================================
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

// ------------------------------------------------------------
// A. Behavioral proof: the real, unmodified zone-length-array logic.
// ------------------------------------------------------------
const dragLogicStart = src.indexOf('      const clampZoneMm = v => Math.max(5, Math.min(16, v));');
assert.ok(dragLogicStart !== -1, 'expected to locate clampZoneMm');
const dragLogicEnd = src.indexOf('\n      };\n', src.indexOf('const applyZoneDrag = (side, idx, mm) => {', dragLogicStart)) + '\n      };'.length;
assert.ok(dragLogicEnd > dragLogicStart, 'expected to locate the end of applyZoneDrag');
const dragLogicSource = src.slice(dragLogicStart, dragLogicEnd);
assert.ok(dragLogicSource.includes('const applyZoneDrag ='), 'slice must include applyZoneDrag');

function runDragLogic({ design, mode, lengthDelta, customLeft, customRight, activeEye }) {
  const calls = { setCustomLeft: [], setCustomRight: [], setMode: [] };
  const fn = new Function(
    'design', 'mode', 'lengthDelta', 'customLeft', 'customRight', 'activeEye',
    'setCustomLeft', 'setCustomRight', 'setMode',
    dragLogicSource + '\nreturn {clampZoneMm, setCustomZoneForSide, setCustomZone, applyZoneDrag};'
  );
  const api = fn(
    design, mode, lengthDelta, customLeft, customRight, activeEye,
    (v) => calls.setCustomLeft.push(v), (v) => calls.setCustomRight.push(v), (v) => calls.setMode.push(v)
  );
  return { api, calls };
}

const BASE_DESIGN = { leftZones: [7, 8, 9, 9, 8], rightZones: [6, 8, 9, 9, 7] };

test('A1. clampZoneMm clamps to the existing professional 5-16mm range, passes values inside it through unchanged', () => {
  const { api } = runDragLogic({ design: BASE_DESIGN, mode: 'custom', lengthDelta: 0, customLeft: [...BASE_DESIGN.leftZones], customRight: [...BASE_DESIGN.rightZones], activeEye: 'left' });
  assert.strictEqual(api.clampZoneMm(3), 5);
  assert.strictEqual(api.clampZoneMm(5), 5);
  assert.strictEqual(api.clampZoneMm(11), 11);
  assert.strictEqual(api.clampZoneMm(16), 16);
  assert.strictEqual(api.clampZoneMm(20), 16);
});

test('A2. setCustomZoneForSide (existing mode==="custom" steady state) updates only the targeted zone on the targeted side', () => {
  const run = runDragLogic({ design: BASE_DESIGN, mode: 'custom', lengthDelta: 0, customLeft: [7, 8, 9, 9, 8], customRight: [6, 8, 9, 9, 7], activeEye: 'left' });
  run.api.applyZoneDrag('left', 3, 12);
  assert.deepStrictEqual(run.calls.setCustomLeft, [[7, 8, 9, 12, 8]]);
  assert.deepStrictEqual(run.calls.setCustomRight, [], 'dragging LEFT must never call the RIGHT-eye setter in steady custom mode');
  assert.deepStrictEqual(run.calls.setMode, [], 'already in custom mode -- must not re-trigger a mode switch');
});

test('A3. LEFT/RIGHT independence in steady custom mode holds for the RIGHT eye too', () => {
  const { calls } = runDragLogic({ design: BASE_DESIGN, mode: 'custom', lengthDelta: 0, customLeft: [7, 8, 9, 9, 8], customRight: [6, 8, 9, 9, 7], activeEye: 'right' });
  const run = runDragLogic({ design: BASE_DESIGN, mode: 'custom', lengthDelta: 0, customLeft: [7, 8, 9, 9, 8], customRight: [6, 8, 9, 9, 7], activeEye: 'right' });
  run.api.applyZoneDrag('right', 0, 14);
  assert.deepStrictEqual(run.calls.setCustomRight, [[14, 8, 9, 9, 7]]);
  assert.deepStrictEqual(run.calls.setCustomLeft, [], 'dragging RIGHT must never call the LEFT-eye setter in steady custom mode');
});

test('A4. first drag from AI mode seeds BOTH eyes from their CURRENT AI values (design zones + lengthDelta) and changes only the dragged zone', () => {
  const run = runDragLogic({ design: BASE_DESIGN, mode: 'ai', lengthDelta: 2, customLeft: [999, 999, 999, 999, 999], customRight: [999, 999, 999, 999, 999], activeEye: 'left' });
  run.api.applyZoneDrag('left', 2, 15);
  // Current AI values WITH lengthDelta applied: left [9,10,11,11,10], right [8,10,11,11,9].
  assert.deepStrictEqual(run.calls.setCustomLeft, [[9, 10, 15, 11, 10]], 'only index 2 (the dragged zone) should differ from the current AI+lengthDelta values; the stale pre-existing customLeft (999s) must be fully discarded, not merged with');
  assert.deepStrictEqual(run.calls.setCustomRight, [[8, 10, 11, 11, 9]], 'the OTHER eye must be seeded from its own current AI+lengthDelta values untouched, not left at its stale pre-existing (999s) custom array');
  assert.deepStrictEqual(run.calls.setMode, ['custom'], 'must switch to custom mode exactly once');
});

test('A5. first drag from AI mode on the RIGHT eye leaves the LEFT eye at its own current AI values, unmodified', () => {
  const run = runDragLogic({ design: BASE_DESIGN, mode: 'ai', lengthDelta: -1, customLeft: [1, 1, 1, 1, 1], customRight: [1, 1, 1, 1, 1], activeEye: 'right' });
  run.api.applyZoneDrag('right', 4, 5);
  // Current AI values WITH lengthDelta=-1: left [6,7,8,8,7], right [5,7,8,8,6].
  assert.deepStrictEqual(run.calls.setCustomLeft, [[6, 7, 8, 8, 7]]);
  assert.deepStrictEqual(run.calls.setCustomRight, [[5, 7, 8, 8, 5]]);
  assert.deepStrictEqual(run.calls.setMode, ['custom']);
});

test('A6. a drag value is clamped at the 5mm floor', () => {
  const run = runDragLogic({ design: BASE_DESIGN, mode: 'custom', lengthDelta: 0, customLeft: [7, 8, 9, 9, 8], customRight: [6, 8, 9, 9, 7], activeEye: 'left' });
  run.api.applyZoneDrag('left', 0, 2);
  assert.deepStrictEqual(run.calls.setCustomLeft, [[5, 8, 9, 9, 8]]);
});

test('A7. a drag value is clamped at the 16mm ceiling', () => {
  const run = runDragLogic({ design: BASE_DESIGN, mode: 'custom', lengthDelta: 0, customLeft: [7, 8, 9, 9, 8], customRight: [6, 8, 9, 9, 7], activeEye: 'left' });
  run.api.applyZoneDrag('left', 4, 99);
  assert.deepStrictEqual(run.calls.setCustomLeft, [[7, 8, 9, 9, 16]]);
});

test('A8. a drag value is also clamped during the AI-mode seeding transition (both floor and ceiling)', () => {
  const low = runDragLogic({ design: BASE_DESIGN, mode: 'ai', lengthDelta: 0, customLeft: [], customRight: [], activeEye: 'left' });
  low.api.applyZoneDrag('left', 0, 1);
  assert.deepStrictEqual(low.calls.setCustomLeft, [[5, 8, 9, 9, 8]]);
  const high = runDragLogic({ design: BASE_DESIGN, mode: 'ai', lengthDelta: 0, customLeft: [], customRight: [], activeEye: 'right' });
  high.api.applyZoneDrag('right', 1, 50);
  assert.deepStrictEqual(high.calls.setCustomRight, [[6, 16, 9, 9, 7]]);
});

test('A9. applyZoneDrag never mutates the immutable design.leftZones/rightZones arrays (AI values remain recoverable via the existing ai/custom mode toggle)', () => {
  const design = { leftZones: [7, 8, 9, 9, 8], rightZones: [6, 8, 9, 9, 7] };
  const leftBefore = JSON.stringify(design.leftZones), rightBefore = JSON.stringify(design.rightZones);
  const run = runDragLogic({ design, mode: 'ai', lengthDelta: 1, customLeft: [], customRight: [], activeEye: 'left' });
  run.api.applyZoneDrag('left', 1, 12);
  assert.strictEqual(JSON.stringify(design.leftZones), leftBefore, 'design.leftZones must stay byte-identical -- this is the ONLY thing that makes switching back to the AI tab a correct, complete reset');
  assert.strictEqual(JSON.stringify(design.rightZones), rightBefore);
});

test('A10. setCustomZone (the existing +/- stepper function) is untouched in behavior -- delegates to setCustomZoneForSide for the activeEye', () => {
  const run = runDragLogic({ design: BASE_DESIGN, mode: 'custom', lengthDelta: 0, customLeft: [7, 8, 9, 9, 8], customRight: [6, 8, 9, 9, 7], activeEye: 'right' });
  run.api.setCustomZone(2, 13);
  assert.deepStrictEqual(run.calls.setCustomRight, [[6, 8, 13, 9, 7]]);
  assert.deepStrictEqual(run.calls.setCustomLeft, []);
});

// ------------------------------------------------------------
// B. The pure pixel-delta -> mm formula used by the real SVG drag
//    handler (LegacyProfessionalEyeMap's moveDrag, 'zone' branch),
//    extracted and exercised in isolation (no DOM/SVG required for the
//    arithmetic itself).
// ------------------------------------------------------------
const zoneMoveFormulaMatch = src.match(/const dy=current\.y-drag\.start\.y,mm=Math\.round\(Math\.max\(5,Math\.min\(16,drag\.startLen-dy\/drag\.pxPerMm\)\)\);/);
assert.ok(zoneMoveFormulaMatch, 'expected to locate the real zone-drag pixel->mm formula inside moveDrag');

// The matched statement reads `current.y`/`drag.*` via moveDrag's own
// enclosing variable names, not params of the statement itself, so this
// wrapper reproduces exactly those two variables.
function zoneDragMmReal(startLen, pxPerMm, startY, currentY) {
  const drag = { startLen, pxPerMm, start: { y: startY } };
  const current = { y: currentY };
  const fn = new Function('drag', 'current', zoneMoveFormulaMatch[0] + '\nreturn mm;');
  return fn(drag, current);
}

test('B1. dragging UP (pointer Y decreases, SVG y grows downward) increases the mm value', () => {
  const mm = zoneDragMmReal(9, 10 /*pxPerMm*/, 100 /*startY*/, 80 /*currentY, moved up 20px*/);
  assert.strictEqual(mm, 11, '20px up at 10px/mm should add +2mm (9 -> 11)');
});

test('B2. dragging DOWN (pointer Y increases) decreases the mm value', () => {
  const mm = zoneDragMmReal(9, 10, 100, 130 /*moved down 30px*/);
  assert.strictEqual(mm, 6, '30px down at 10px/mm should subtract 3mm (9 -> 6)');
});

test('B3. no movement leaves the mm value unchanged', () => {
  assert.strictEqual(zoneDragMmReal(11, 10, 100, 100), 11);
});

test('B4. the formula clamps at the 5mm floor even for a very large downward drag', () => {
  assert.strictEqual(zoneDragMmReal(7, 10, 100, 500), 5);
});

test('B5. the formula clamps at the 16mm ceiling even for a very large upward drag', () => {
  assert.strictEqual(zoneDragMmReal(7, 10, 100, -500), 16);
});

test('B6. the real pxPerMm sensitivity is derived from this eye\'s own width and the 5-16mm professional range (not a hardcoded magic constant)', () => {
  const pxPerMmMatch = src.match(/const pxPerMm=\(eyeW\*\.22\)\/\(16-5\);/);
  assert.ok(pxPerMmMatch, 'expected the real px-per-mm derivation to reuse the 5-16mm clamp range and an eye-width-relative amplitude, not an unexplained constant');
});

test('B7. MOBILE TOUCH FIX: a non-finite mm value (e.g. a momentary getScreenCTM/pxPerMm edge case on a real device) is never propagated to onZoneLengthChange -- defensive guard against poisoning both eyes\' zone arrays mid-gesture', () => {
  assert.ok(src.includes('if(Number.isFinite(mm))onZoneLengthChange(drag.index,mm);'), 'expected a finite-value guard directly around the onZoneLengthChange call');
});

// ------------------------------------------------------------
// C. Structural wiring: the new callback reaches every layer between
//    LashMapScreen and the real SVG drag handles, and Photo Lash Preview
//    is driven by the SAME customLeft/customRight the existing +/-
//    stepper UI already writes to (no new canonical override field).
// ------------------------------------------------------------
test('C1. LegacyProfessionalEyeMap accepts onZoneLengthChange/editMode/onEditModeChange and renders one drag handle per key zone, separate from the existing position handles', () => {
  assert.ok(src.includes('function LegacyProfessionalEyeMap({ result, side, zones, peakIdx, items, curve, design, curl, technique, texture, active, onActivate, lang, editing, adjustment, onAdjustmentChange, onEdit, onReset, onDone, onZoneLengthChange, editMode, onEditModeChange }) {'));
  assert.ok(src.includes('data-manual-zone-handle={point.keyZoneIndex}'));
  assert.ok(src.includes("onPointerDown={event=>beginDrag(event,`zone:${point.keyZoneIndex}`)}"));
});

test('C2. ProfessionalEyeMap passes onZoneLengthChange/editMode/onEditModeChange straight through to LegacyProfessionalEyeMap', () => {
  assert.ok(src.includes('function ProfessionalEyeMap({ clientDesign, result, side, active, onActivate, lang, editing, onAdjustmentChange, onEdit, onReset, onDone, onZoneLengthChange, editMode, onEditModeChange }) {'));
  assert.ok(src.includes('onZoneLengthChange={onZoneLengthChange} editMode={editMode} onEditModeChange={onEditModeChange}'));
});

test('C3. LashMapScreen wires the single shared PhotoLashEditorWorkspace\'s onZoneLengthChange directly to applyZoneDrag -- side-binding now happens INSIDE the workspace (via editingEye) rather than via two separate per-eye closures, since there is only one shared instance for both eyes', () => {
  assert.ok(src.includes('<PhotoLashEditorWorkspace result={result} clientDesign={photoClientDesign} lang={lang} activeEye={activeEye} editingEye={editingPhotoEye} editMode={photoEditMode}'));
  assert.ok(src.includes('onZoneLengthChange={applyZoneDrag}'));
  assert.ok(src.includes('onAdjustmentChange={setPhotoAdjustment}'));
  assert.ok(src.includes('onResetFit={resetPhotoAdjustment}'));
  assert.ok(src.includes('onResetDesign={resetDesignForSide}'));
});

test('C3b. PhotoLashEditorWorkspace itself supplies the side argument (editingEye) when calling onZoneLengthChange/onAdjustmentChange -- the same applyZoneDrag/setPhotoAdjustment functions LashMapScreen already proved per-side-independent (section A/F above) are invoked correctly for whichever eye is actually being edited', () => {
  assert.ok(src.includes('if(Number.isFinite(mm))onZoneLengthChange(editingEye,drag.index,mm);'));
  assert.ok(src.includes('onAdjustmentChange(editingEye,next);'));
});

test('C4. applyZoneDrag writes through the EXISTING customLeft/customRight setters only -- no new canonical override field/state was introduced', () => {
  assert.ok(!src.includes('manualOverrides'), 'Phase 1 must not invent a new canonical override architecture');
  assert.ok(dragLogicSource.includes('setCustomLeft') && dragLogicSource.includes('setCustomRight'), 'must reuse the existing custom-zone state setters');
});

test('C5. the zone-length drag handle is visually distinct from the existing position handles (different fill/stroke), so the two operations stay distinguishable even if ever shown together', () => {
  const zoneHandleMatch = src.match(/editing&&editMode==='design'&&keyZonePoints\.map\(point=>[^]*?<\/g>\)\}/);
  assert.ok(zoneHandleMatch, 'expected to locate the zone-handle rendering block');
  assert.ok(zoneHandleMatch[0].includes('rgba(244,247,250,.95)'), 'zone handle must use a distinct fill from the blue position handles');
});

test('C8. the handle-collision risk this mode separation eliminates was real, not theoretical: in real production DESIGN_CATALOG profiles, INNER is frequently this eye\'s own shortest zone (profileHeight 0), which is exactly what used to make the INNER zone-length point coincide with the pre-existing \'inner\' position handle before mode separation made the two handle sets mutually exclusive', () => {
  const catalogMatches = [...src.matchAll(/baseZones:\[(\d+),(\d+),(\d+),(\d+),(\d+)\]/g)];
  assert.ok(catalogMatches.length >= 15, 'expected to find a representative number of real DESIGN_CATALOG baseZones entries');
  const innerIsMinCount = catalogMatches.filter(m => {
    const zones = m.slice(1, 6).map(Number);
    return zones[0] === Math.min(...zones);
  }).length;
  assert.ok(innerIsMinCount / catalogMatches.length > 0.5, `expected INNER to be the shortest (profileHeight 0, overlap risk) zone in a clear majority of real profiles -- found ${innerIsMinCount}/${catalogMatches.length}`);
});

test('C6. during a zone drag, a live "ZONE NAME · XX mm" readout is rendered from the SAME live profilePoints data Photo Lash Preview itself is built from (never a separately-tracked, driftable number)', () => {
  assert.ok(src.includes('data-zone-drag-readout="true"'));
  assert.ok(src.includes('${zoneLabel(draggedZonePoint.label,lang)} · ${draggedZonePoint.len} mm'));
  assert.ok(src.includes('const draggedZonePoint=dragZoneIndex==null?null:profilePoints.find(point=>point.keyZoneIndex===dragZoneIndex);'), 'the readout must read the dragged zone\'s len directly from profilePoints, the same array the visible profile line/dots/Photo Lash Preview pipeline already renders from');
});

// ------------------------------------------------------------
// F. MASK FIT / DESIGN EDIT mode separation (added after real-device
//    testing found both handle sets interactive simultaneously). All
//    three render sites that used to key off `editing` alone (the map-
//    line drag-catcher, the inner/outer/peak handle map, and the zone-
//    length handle map) must now ALSO require the matching editMode, and
//    'mask' !== 'design' as plain strings guarantees mutual exclusivity
//    by construction -- no runtime state can make both true at once.
// ------------------------------------------------------------
test('F1. the mask-position drag-catcher (whole-map line) requires editMode==="mask", not just editing', () => {
  assert.ok(src.includes("{editing&&editMode==='mask'&&<use data-manual-map-drag=\"true\""), 'the whole-map position drag-catcher must be gated to Mask Fit mode');
});

test('F2. the inner/outer/peak position handles require editMode==="mask", not just editing', () => {
  assert.ok(src.includes("{editing&&editMode==='mask'&&Object.entries(handlePoints).map("), 'the inner/outer/peak position handles must be gated to Mask Fit mode');
});

test('F3. the zone-length handles require editMode==="design", not just editing', () => {
  assert.ok(src.includes("{editing&&editMode==='design'&&keyZonePoints.map("), 'the zone-length handles must be gated to Design Edit mode');
});

test('F4. the two handle sets can never be simultaneously interactive: their gating conditions are mutually exclusive string literals ("mask" !== "design"), not independently-toggleable booleans', () => {
  assert.ok(src.includes("editMode==='mask'") && src.includes("editMode==='design'"), 'expected both literal mode checks to exist');
  // There is no code path (no OR, no missing gate) under which a single
  // editMode value satisfies both checks -- proven structurally: every
  // handle-rendering site includes an editMode==='mask' or ==='design'
  // check as a *required* (&&-chained, not optional) condition, verified
  // individually by F1/F2/F3 above.
});

test('F5. entering Edit always resets editMode to "mask" (fit-the-base-line-first workflow); which eye is edited is whichever activeEye the existing left/right tabs already point to -- now the ONLY mechanism, there are no more separate per-eye Edit buttons', () => {
  assert.ok(src.includes("onEdit={()=>{setEditingPhotoEye(activeEye);setPhotoEditMode('mask');}}"));
});

test('F6. Reset is context-sensitive: PhotoLashEditorWorkspace itself calls the Mask Fit reset in mask mode and the Design Edit reset in design mode, for whichever eye is currently being edited (editingEye)', () => {
  assert.ok(src.includes("const handleReset=()=>editMode==='mask'?onResetFit(editingEye):onResetDesign(editingEye);"));
  assert.ok(src.includes('onResetFit={resetPhotoAdjustment}'));
  assert.ok(src.includes('onResetDesign={resetDesignForSide}'));
});

const resetDesignStart = src.indexOf('      const resetDesignForSide = side => {');
assert.ok(resetDesignStart !== -1, 'expected to locate resetDesignForSide');
const resetDesignEnd = src.indexOf('\n      };\n', resetDesignStart) + '\n      };'.length;
const resetDesignSource = src.slice(resetDesignStart, resetDesignEnd);

function runResetDesign({ design, lengthDelta, side }) {
  const calls = { setCustomLeft: [], setCustomRight: [] };
  const fn = new Function(
    'design', 'lengthDelta', 'clampZoneMm', 'setCustomLeft', 'setCustomRight',
    resetDesignSource + '\nreturn resetDesignForSide;'
  );
  const resetDesignForSide = fn(
    design, lengthDelta, v => Math.max(5, Math.min(16, v)),
    v => calls.setCustomLeft.push(v), v => calls.setCustomRight.push(v)
  );
  resetDesignForSide(side);
  return calls;
}

test('F7. resetDesignForSide(side) restores ONLY that side\'s zone lengths to their current AI-derived values (design.*Zones + lengthDelta), never touching the other eye\'s setter', () => {
  const design = { leftZones: [7, 8, 9, 9, 8], rightZones: [6, 8, 9, 9, 7] };
  const left = runResetDesign({ design, lengthDelta: 1, side: 'left' });
  assert.deepStrictEqual(left.setCustomLeft, [[8, 9, 10, 10, 9]]);
  assert.deepStrictEqual(left.setCustomRight, [], 'resetting LEFT design must never call the RIGHT-eye setter');
  const right = runResetDesign({ design, lengthDelta: -2, side: 'right' });
  assert.deepStrictEqual(right.setCustomRight, [[5, 6, 7, 7, 5]]);
  assert.deepStrictEqual(right.setCustomLeft, [], 'resetting RIGHT design must never call the LEFT-eye setter');
});

test('F8. resetDesignForSide never mutates design.leftZones/rightZones and never touches mode/manualPhotoAdjustments (Mask Fit must survive a Design reset)', () => {
  assert.ok(!resetDesignSource.includes('setMode'), 'resetDesignForSide must not touch the ai/custom mode toggle');
  assert.ok(!resetDesignSource.includes('setManualPhotoAdjustments'), 'resetDesignForSide must not touch Mask Fit state at all');
  const design = { leftZones: [7, 8, 9, 9, 8], rightZones: [6, 8, 9, 9, 7] };
  const before = JSON.stringify(design);
  runResetDesign({ design, lengthDelta: 0, side: 'left' });
  assert.strictEqual(JSON.stringify(design), before);
});

test('F9. resetPhotoAdjustment (Mask Fit\'s own reset, called in mask mode) is unchanged and still never touches customLeft/customRight (Design Edit must survive a Mask reset)', () => {
  assert.ok(src.includes("const resetPhotoAdjustment=side=>setManualPhotoAdjustments(current=>({...current,[side]:createManualPhotoAdjustment()}));"));
});

test('F10. the Mask Fit / Design Edit toggle and both context-sensitive Reset labels have real RU/EN/AR localized strings, never exposing internal terms (manualPhotoAdjustment/translationX/zone-array) to the artist', () => {
  assert.ok(src.includes("photoEditModeFit: {ru:'Подогнать по глазу', en:'Fit to Eye', ar:"));
  assert.ok(src.includes("photoEditModeDesign: {ru:'Изменить схему', en:'Edit Design', ar:"));
  assert.ok(src.includes("lashMapResetFit: {ru:'СБРОСИТЬ ПОСАДКУ', en:'RESET FIT', ar:"));
  assert.ok(src.includes("lashMapResetDesign: {ru:'СБРОСИТЬ СХЕМУ', en:'RESET DESIGN', ar:"));
  for (const key of ['photoEditModeFit', 'photoEditModeDesign', 'lashMapResetFit', 'lashMapResetDesign']) {
    const m = src.match(new RegExp(key + ": \\{ru:'[^']+', en:'[^']+', ar:'([^']+)'\\}"));
    assert.ok(m && m[1].length > 0, `expected a non-empty Arabic translation for ${key}`);
  }
});

test('F11. switching editMode does not touch either data set (toggle buttons only call onEditModeChange/setPhotoEditMode, never a zone or adjustment setter)', () => {
  const toggleMatch = src.match(/onClick=\{event=>\{event\.stopPropagation\(\);onEditModeChange\('mask'\);\}\}[^]*?onClick=\{event=>\{event\.stopPropagation\(\);onEditModeChange\('design'\);\}\}/);
  assert.ok(toggleMatch, 'expected to locate both mode-toggle buttons');
  assert.ok(!toggleMatch[0].includes('setCustomLeft') && !toggleMatch[0].includes('setCustomRight') && !toggleMatch[0].includes('setManualPhotoAdjustments'), 'the toggle buttons themselves must be pure mode switches, never data mutations');
});

// ------------------------------------------------------------
// D. Byte-identity proof: the pre-existing map/inner/outer/peak
//    POSITION-drag logic (a completely separate operation from the new
//    zone-length drag, per the Phase 1 brief) is untouched.
// ------------------------------------------------------------
test('D. the existing map/inner/outer/peak position-drag branch is byte-identical to its pre-Phase-1 form', () => {
  const expected = "        if(drag.kind==='map'){\n"
    + "          const xs=automaticLine.points.map(point=>point.mapX),ys=automaticLine.points.map(point=>point.mapY),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);\n"
    + "          next.translationX=Math.max(photoCrop.x+pad-minX,Math.min(photoCrop.x+photoCrop.width-pad-maxX,start.translationX+dx));\n"
    + "          next.translationY=Math.max(photoCrop.y+pad-minY,Math.min(photoCrop.y+photoCrop.height-pad-maxY,start.translationY+dy));\n"
    + "        }else if(drag.kind==='inner'||drag.kind==='outer'){\n"
    + "          const key=drag.kind==='inner'?'innerDelta':'outerDelta',automatic=drag.kind==='inner'?automaticLine.points[0]:automaticLine.points.at(-1),candidate={x:start[key].x+dx,y:start[key].y+dy};\n"
    + "          next[key]={x:Math.max(photoCrop.x+pad,Math.min(photoCrop.x+photoCrop.width-pad,automatic.mapX+start.translationX+candidate.x))-automatic.mapX-start.translationX,y:Math.max(photoCrop.y+pad,Math.min(photoCrop.y+photoCrop.height-pad,automatic.mapY+start.translationY+candidate.y))-automatic.mapY-start.translationY};\n"
    + "          const inner=automaticLine.points[0],outer=automaticLine.points.at(-1),vx=outer.mapX-inner.mapX,vy=outer.mapY-inner.mapY,length=Math.max(1,Math.hypot(vx,vy)),ux=vx/length,uy=vy/length,innerPosition=start.innerDelta.x*ux+start.innerDelta.y*uy,outerPosition=length+start.outerDelta.x*ux+start.outerDelta.y*uy,position=(drag.kind==='inner'?next.innerDelta.x*ux+next.innerDelta.y*uy:length+next.outerDelta.x*ux+next.outerDelta.y*uy),limit=drag.kind==='inner'?Math.min(position,outerPosition-length*.08):Math.max(position,innerPosition+length*.08),correction=limit-position;\n"
    + "          next[key]={x:next[key].x+ux*correction,y:next[key].y+uy*correction};\n"
    + "        }else if(drag.kind==='peak'){\n"
    + "          const inner=automaticLine.points[0],outer=automaticLine.points.at(-1),vx=outer.mapX-inner.mapX,vy=outer.mapY-inner.mapY,length=Math.max(1,Math.hypot(vx,vy)),ux=vx/length,uy=vy/length,along=dx*ux+dy*uy,automatic=automaticLine.points.find(point=>point.isPeak),candidate={x:start.peakDelta.x+ux*along,y:start.peakDelta.y+uy*along};\n"
    + "          const innerAdjusted={x:inner.mapX+start.translationX+start.innerDelta.x,y:inner.mapY+start.translationY+start.innerDelta.y},outerAdjusted={x:outer.mapX+start.translationX+start.outerDelta.x,y:outer.mapY+start.translationY+start.outerDelta.y},spanX=outerAdjusted.x-innerAdjusted.x,spanY=outerAdjusted.y-innerAdjusted.y,span=Math.max(1,Math.hypot(spanX,spanY)),sx=spanX/span,sy=spanY/span,desired={x:automatic.mapX+start.translationX+candidate.x,y:automatic.mapY+start.translationY+candidate.y},position=(desired.x-innerAdjusted.x)*sx+(desired.y-innerAdjusted.y)*sy,clamped=Math.max(span*.08,Math.min(span*.92,position)),correction=clamped-position;\n"
    + "          next.peakDelta={x:candidate.x+sx*correction,y:candidate.y+sy*correction};\n"
    + "        }\n"
    + "        onAdjustmentChange(next);";
  assert.ok(src.includes(expected), 'the existing map/inner/outer/peak position-drag code must be byte-identical to before Phase 1 -- it is a completely separate operation from the new zone-length drag and must not be touched');
});

test('D2. createManualPhotoAdjustment/applyManualPhotoAdjustment (the position-adjustment engine) still create/reset the same 3 legacy fields untouched by the 5-anchor extension, which only adds innerMidDelta/outerMidDelta alongside them -- Reset-to-AI for POSITION still zeroes everything', () => {
  assert.ok(src.includes("const createManualPhotoAdjustment=()=>({translationX:0,translationY:0,innerDelta:{x:0,y:0},innerMidDelta:{x:0,y:0},peakDelta:{x:0,y:0},outerMidDelta:{x:0,y:0},outerDelta:{x:0,y:0}});"));
  assert.ok(src.includes('function applyManualPhotoAdjustment(eye,points,adjustment,peakT) {'));
});

// ------------------------------------------------------------
// E. Scope freeze: curl geometry, face/eye analysis, recommendation and
//    LIVE SCAN are untouched by this Phase 1 change.
// ------------------------------------------------------------
// RETIRED (LJ/LB/LC curl expansion task): this test originally asserted
// `git diff -- photo-lash-preview.js` was empty, proving the Phase 1
// zone-length-drag change never touched curl geometry. Curl-geometry
// edits are now a separate, explicitly-approved task (adding LJ/LB/LC
// to CURL_GEOMETRY_PROFILES) -- a zero-diff assertion on this file is no
// longer a meaningful scope boundary for ANY future PHOTO-editor change,
// so the old hard check is replaced with a narrower one: the Phase 1
// zone-drag change itself must still never alter the file's public
// rendering contract (its exported function names), regardless of what
// a later, separately-approved curl task does inside it.
test('E. photo-lash-preview.js retains its public rendering contract (sampleSectors/buildFibers/draw) unchanged by this Phase 1 zone-drag change -- no longer a zero-diff check, since curl-geometry edits are a separate, explicitly-approved scope', () => {
  const PhotoLashPreview = require('../photo-lash-preview');
  assert.equal(typeof PhotoLashPreview.sampleSectors, 'function');
  assert.equal(typeof PhotoLashPreview.buildFibers, 'function');
  assert.equal(typeof PhotoLashPreview.draw, 'function');
});
