'use strict';
// ============================================================
// WYSIWYG PHOTO EDITOR — unified Mask Fit / Design Edit workspace.
// ------------------------------------------------------------
// Covers the specific product requirements for this change: the final
// photo and rendered fibers live in ONE workspace with the editable
// overlay; Mask Fit and Design Edit edits both reach the SAME visible
// fibers through the real, unmodified buildPhotoPreviewEyes/
// applyManualPhotoAdjustment/buildFibers chain (already proven correct
// and non-mutating by photo-lash-preview.test.js -- this file does not
// re-derive that math, it proves PhotoLashEditorWorkspace is wired to
// the SAME real function, and that the two editing operations stay
// data-isolated from each other and from canonical/viewport state).
//
// The real pointer/pinch gesture needs a DOM and is not exercised here
// (see lash-map-photo-zoom.test.js for the pure math + structural
// proofs of that layer). This file is about the DATA WIRING: which
// callback each drag kind calls, and which it never calls.
// ============================================================
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const workspaceStart = src.indexOf('    function PhotoLashEditorWorkspace(');
assert.ok(workspaceStart !== -1);
const workspaceEnd = src.indexOf('\n    function HeroScreen(', workspaceStart);
assert.ok(workspaceEnd !== -1);
const workspaceSource = src.slice(workspaceStart, workspaceEnd);

// ------------------------------------------------------------
// A. One workspace: real photo + real rendered fibers + editable
//    overlay all live under the same root element, inside the same
//    zoom/pan-transformed wrapper (perfect registration).
// ------------------------------------------------------------
test('A1. the workspace renders the real photo (<img>), the real fiber canvas (<canvas>), and the editable handle overlay (<svg>) as siblings inside ONE transformed wrapper', () => {
  const wrapperStart = workspaceSource.indexOf("style={{position:'absolute',inset:0,transform:cssTransform");
  assert.ok(wrapperStart !== -1, 'expected a single wrapper div carrying the shared cssTransform');
  const wrapperBlock = workspaceSource.slice(wrapperStart, workspaceSource.indexOf('</svg>', wrapperStart));
  assert.ok(wrapperBlock.includes('<img ref={imageRef}'));
  assert.ok(wrapperBlock.includes('<canvas ref={canvasRef}'));
  assert.ok(wrapperBlock.includes('<svg dir="ltr" ref={svgRef}'));
});

test('A2. the canvas is drawn via the real, unmodified PhotoLashPreview.draw(ctx, fibers) -- same renderer the approved curl geometry work this session produced, never reimplemented here', () => {
  assert.ok(workspaceSource.includes('eyes.forEach(eye=>PhotoLashPreview.draw(ctx,eye.fibers));'));
});

test('A3. the editable overlay draws NO technical profile line, per-sample dots, or leader-line length labels over the final photo -- only drag handles, matching "the artist\'s attention should remain on the eye and rendered lashes"', () => {
  assert.ok(!workspaceSource.includes('data-photo-label'));
  assert.ok(!workspaceSource.includes('data-photo-zone'));
  assert.ok(!workspaceSource.includes('data-photo-lash-profile-line'));
  assert.ok(!workspaceSource.includes('data-photo-lash-profile-fill'));
  assert.ok(!workspaceSource.includes('leaderEnd'));
});

// ------------------------------------------------------------
// B. Live update chains: both Mask Fit and Design Edit reach the SAME
//    visible fibers through the real production function, never a
//    hand-duplicated copy.
// ------------------------------------------------------------
test('B1. the overlay geometry (handles) and the canvas fibers are built from the SAME buildPhotoPreviewEyes call result -- not two separate, potentially-divergent computations', () => {
  // MOBILE UX REFINEMENT added a 3rd call site, inside the auto-focus
  // effect (needs the target eye's current root points to compute the
  // focus box) -- all three call the identical real function with the
  // identical first two (result,clientDesign) arguments; none duplicates
  // or re-derives the math. PHOTOREALISTIC RENDERER v2-A BASE added an
  // optional 3rd argument (renderVariant) to the canvas-draw effect's own
  // call only -- the prefix match below tolerates that without weakening
  // the "same first two args, same real function" claim.
  assert.strictEqual((workspaceSource.match(/buildPhotoPreviewEyes\(result,clientDesign[,)]/g) || []).length, 3, 'canvas-draw effect, auto-focus effect, and the synchronous overlay-geometry computation -- all three call the identical real function with the identical (result,clientDesign) arguments');
});

test('B2. the canvas-draw effect depends on [result, clientDesign, renderVariant] -- any change to clientDesign (from either Mask Fit or Design Edit) or to the v2-A debug toggle triggers a redraw', () => {
  assert.ok(workspaceSource.includes('},[result,clientDesign,renderVariant]);'));
});

test('B3. Mask Fit drags (map/inner/outer/peak) call ONLY onAdjustmentChange, never onZoneLengthChange -- Mask Fit cannot mutate zone lengths', () => {
  const moveDragSrc = workspaceSource.slice(workspaceSource.indexOf('const moveDrag=event=>{'), workspaceSource.indexOf('const endDrag=event=>{'));
  const positionBranch = moveDragSrc.slice(moveDragSrc.indexOf("drag.kind==='map'"));
  assert.ok(positionBranch.includes('onAdjustmentChange(editingEye,next);'));
  assert.ok(!positionBranch.includes('onZoneLengthChange('), 'the map/inner/outer/peak branch must never call onZoneLengthChange');
});

test('B4. the zone-length drag calls ONLY onZoneLengthChange, never onAdjustmentChange -- Design Edit cannot mutate manualPhotoAdjustments', () => {
  const moveDragSrc = workspaceSource.slice(workspaceSource.indexOf('const moveDrag=event=>{'), workspaceSource.indexOf('const endDrag=event=>{'));
  const zoneBranch = moveDragSrc.slice(moveDragSrc.indexOf("drag.kind==='zone'"), moveDragSrc.indexOf('return;', moveDragSrc.indexOf("drag.kind==='zone'")));
  assert.ok(zoneBranch.includes('onZoneLengthChange(editingEye,drag.index,mm)'));
  assert.ok(!zoneBranch.includes('onAdjustmentChange('), 'the zone-length branch must never call onAdjustmentChange');
});

test('B5. the real buildPhotoPreviewEyes determinism/non-mutation guarantees (photo-lash-preview.test.js) are exactly what this workspace relies on -- cross-reference, not re-derived here', () => {
  // Sanity: the function this workspace calls twice (B1) is the SAME
  // one whose non-mutation is proven in tests/photo-lash-preview.test.js
  // ("real canonical bridge renders both physical eyes deterministically
  // without mutation", "manual PHOTO displacement moves roots without
  // changing mapping or other eye").
  assert.ok(src.includes('function buildPhotoPreviewEyes(result, clientDesign, options) {'));
});

// ------------------------------------------------------------
// C. Mutual exclusivity + LEFT/RIGHT correctness in the new workspace.
// ------------------------------------------------------------
test('C1. the Mask Fit overlay (RIGID MASK FIT: the debug-only root-line guide, no handles) renders only when editMode==="mask"; the Design Edit overlay (zone handles) only when editMode==="design" -- same mutually-exclusive gate proven for the old editor, now on the primary surface', () => {
  assert.ok(workspaceSource.includes("editing&&eyeData&&editMode==='mask'&&isDebugModeEnabled()&&<path"));
  assert.ok(workspaceSource.includes("editing&&eyeData&&editMode==='design'&&keyZonePoints.map("));
});

test('C2. the edited eye (eyeData) is looked up by editingEye, not hardcoded to either side -- both eyes are reachable through the same single component instance', () => {
  assert.ok(workspaceSource.includes('const eyeData=editing&&overlayEyes?overlayEyes.find(e=>e.side===editingEye):null;'));
});

test('C3. LashMapScreen passes activeEye/editingPhotoEye straight through -- the workspace never invents its own eye-selection state', () => {
  assert.ok(src.includes('activeEye={activeEye} editingEye={editingPhotoEye} editMode={photoEditMode}'));
});

// ------------------------------------------------------------
// D. Canonical immutability + zoom/pan data isolation.
// ------------------------------------------------------------
test('D1. buildPhotoPreviewEyes is called read-only here (its result is only ever assigned to local variables -- eyes/overlayEyes -- never written back into clientDesign or any canonical field)', () => {
  assert.ok(!/clientDesign\.[a-zA-Z.]+\s*=/.test(workspaceSource), 'the workspace must never assign into any clientDesign.* field directly');
});

test('D2. zoom/pan (beginPinch/updatePinch/the 1x reset button) only ever call setView -- never onAdjustmentChange or onZoneLengthChange -- proving zoom/pan cannot alter lash geometry/data', () => {
  const pinchBlock = workspaceSource.slice(workspaceSource.indexOf('const beginPinch=()=>{'), workspaceSource.indexOf('const beginDrag=(event,kind,frozenT)=>{'));
  assert.ok(!pinchBlock.includes('onAdjustmentChange(') && !pinchBlock.includes('onZoneLengthChange('), 'pinch/pan code must never call either data-mutating callback');
  assert.ok(src.includes("onClick={()=>setView({zoom:1,panX:0,panY:0})}"), 'the 1x reset button must only touch view state');
});

test('D3. global viewport meta and body touch-action remain unchanged (cross-reference -- fully proven in lash-map-photo-zoom.test.js D1/D2)', () => {
  assert.ok(src.includes('<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">'));
});

// ------------------------------------------------------------
// E. Scope freeze.
// ------------------------------------------------------------
// RETIRED (LJ/LB/LC curl expansion task): this originally asserted a
// zero git diff on photo-lash-preview.js to prove the new WYSIWYG
// workspace never touched curl geometry. Curl-geometry edits are now a
// separate, explicitly-approved task, so a permanent zero-diff check on
// this file is no longer meaningful -- replaced with a narrower check
// that the WYSIWYG workspace change itself never altered the file's
// public rendering contract.
test('E. photo-lash-preview.js retains its public rendering contract (sampleSectors/buildFibers/draw) unchanged by the WYSIWYG workspace change -- no longer a zero-diff check, since curl-geometry edits are a separate, explicitly-approved scope', () => {
  const PhotoLashPreview = require('../photo-lash-preview');
  assert.equal(typeof PhotoLashPreview.sampleSectors, 'function');
  assert.equal(typeof PhotoLashPreview.buildFibers, 'function');
  assert.equal(typeof PhotoLashPreview.draw, 'function');
});

test('F. LegacyProfessionalEyeMap/ProfessionalEyeMap remain defined and untouched structurally (no aggressive deletion this pass) -- only unused by LashMapScreen\'s default view', () => {
  assert.ok(src.includes('function LegacyProfessionalEyeMap('));
  assert.ok(src.includes('function ProfessionalEyeMap('));
  assert.ok(!src.includes('<ProfessionalEyeMap clientDesign={photoClientDesign}'), 'LashMapScreen must no longer render the old per-eye cards by default');
});
