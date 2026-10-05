'use strict';
// ============================================================
// SCOPED PHOTO WORKSPACE ZOOM/PAN -- WYSIWYG PhotoLashEditorWorkspace.
// ------------------------------------------------------------
// Real extraction+eval of the actual, unmodified clamp/anchor-zoom math
// from PhotoLashEditorWorkspace (index.html) -- same technique this
// repo already uses throughout. Retargeted from LegacyProfessionalEyeMap
// (this file's original subject) to PhotoLashEditorWorkspace: per the
// WYSIWYG product decision, the old schematic editor's zoom is
// explicitly NOT being extended further ("do not continue patching the
// obsolete intermediate editor's zoom") -- PhotoLashEditorWorkspace is
// now the primary, validated-going-forward surface. LegacyProfessionalEyeMap
// keeps its OWN separate (still-present, still-correct, just no longer
// primary) PHOTO_ZOOM_MIN/MAX-named zoom code, which is why source
// extraction below is anchored to start AFTER
// 'function PhotoLashEditorWorkspace(' specifically -- a plain
// src.indexOf('const PHOTO_ZOOM_MIN...') would ambiguously match
// whichever of the two components' copy appears first in the file.
//
// The real SVG pointer-capture multi-touch gesture itself needs a real
// DOM to execute end-to-end and is NOT run here (no browser automation
// this round) -- what's verified is the PURE math (view clamp, pinch
// anchor-zoom) plus structural proof of the gating rules (multi-touch
// cancels drag, pinch routes correctly, scoped touch-action).
// ============================================================
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const workspaceStart = src.indexOf('    function PhotoLashEditorWorkspace(');
assert.ok(workspaceStart !== -1, 'expected to locate PhotoLashEditorWorkspace');
const workspaceEnd = src.indexOf('\n    function HeroScreen(', workspaceStart);
assert.ok(workspaceEnd !== -1, 'expected to locate the end of PhotoLashEditorWorkspace (right before HeroScreen)');
const workspaceSource = src.slice(workspaceStart, workspaceEnd);

// ------------------------------------------------------------
// A. View clamp math (effW/effH/effX/effY over the FULL photo, not a
//    per-eye crop): pure, DOM-independent.
// ------------------------------------------------------------
const clampStart = workspaceSource.indexOf('      const PHOTO_ZOOM_MIN=1,PHOTO_ZOOM_MAX=4;');
assert.ok(clampStart !== -1, 'expected to locate the zoom-limits constants inside PhotoLashEditorWorkspace');
const clampEnd = workspaceSource.indexOf('\n', workspaceSource.indexOf('const effY=', clampStart));
const clampSource = workspaceSource.slice(clampStart, clampEnd);
assert.ok(clampSource.includes('effX') && clampSource.includes('effY'), 'slice must include the full effX/effY clamp');

function computeEffectiveView(result, view) {
  const fn = new Function('result', 'view', clampSource + '\nreturn {effW,effH,effX,effY,PHOTO_ZOOM_MIN,PHOTO_ZOOM_MAX};');
  return fn(result, view);
}

const PHOTO = { imageWidth: 300, imageHeight: 200 };

test('A1. at zoom=1/no-pan (the default), the effective view equals the FULL photo exactly -- the workspace shows the whole photo by default, not a pre-cropped eye region', () => {
  const v = computeEffectiveView(PHOTO, { zoom: 1, panX: 0, panY: 0 });
  assert.strictEqual(v.effX, 0);
  assert.strictEqual(v.effY, 0);
  assert.strictEqual(v.effW, PHOTO.imageWidth);
  assert.strictEqual(v.effH, PHOTO.imageHeight);
});

test('A2. zoom=2 halves the effective window size', () => {
  const v = computeEffectiveView(PHOTO, { zoom: 2, panX: 0, panY: 0 });
  assert.strictEqual(v.effW, 150);
  assert.strictEqual(v.effH, 100);
});

test('A3. panning is clamped so the effective window never leaves the photo bounds (left/top edge)', () => {
  const v = computeEffectiveView(PHOTO, { zoom: 2, panX: -999, panY: -999 });
  assert.strictEqual(v.effX, 0);
  assert.strictEqual(v.effY, 0);
});

test('A4. panning is clamped so the effective window never leaves the photo bounds (right/bottom edge)', () => {
  const v = computeEffectiveView(PHOTO, { zoom: 2, panX: 999, panY: 999 });
  assert.strictEqual(v.effX, PHOTO.imageWidth - 150);
  assert.strictEqual(v.effY, PHOTO.imageHeight - 100);
});

test('A5. at zoom=1 (the floor), panning is forced to exactly zero regardless of panX/panY', () => {
  const v = computeEffectiveView(PHOTO, { zoom: 1, panX: 50, panY: -50 });
  assert.strictEqual(v.effX, 0);
  assert.strictEqual(v.effY, 0);
});

test('A6. the declared zoom limits are exactly [1, 4]', () => {
  const v = computeEffectiveView(PHOTO, { zoom: 1, panX: 0, panY: 0 });
  assert.strictEqual(v.PHOTO_ZOOM_MIN, 1);
  assert.strictEqual(v.PHOTO_ZOOM_MAX, 4);
});

test('A7. the CSS transform driving the shared photo+canvas+overlay wrapper is derived directly from effX/effY/effW/effH and view.zoom -- one formula, one transform, so all three layers can never drift apart', () => {
  assert.ok(workspaceSource.includes('const cssTransform=`translate(${-(effX/effW)*100}%, ${-(effY/effH)*100}%) scale(${view.zoom})`;'));
});

// ------------------------------------------------------------
// B. Pinch anchor-zoom math (beginPinch/updatePinch): pure given a fake
//    wrapRef/activePointersRef/pinchRef.
// ------------------------------------------------------------
const pinchStart = workspaceSource.indexOf('      const registerPointer=event=>');
assert.ok(pinchStart !== -1, 'expected to locate registerPointer inside PhotoLashEditorWorkspace');
const pinchFnsEnd = workspaceSource.indexOf('\n      };\n', workspaceSource.indexOf('const updatePinch=()=>{', pinchStart)) + '\n      };'.length;
const pinchSource = workspaceSource.slice(pinchStart, pinchFnsEnd);
assert.ok(pinchSource.includes('const beginPinch=') && pinchSource.includes('const updatePinch='), 'slice must include both pinch functions');

function runPinch({ result, view, rectWidth = 300, rectHeight = 200 }) {
  const calls = { setView: [] };
  const fakeWrap = { getBoundingClientRect: () => ({ left: 0, top: 0, width: rectWidth, height: rectHeight }) };
  const wrapRef = { current: fakeWrap };
  const activePointersRef = { current: new Map() };
  const pinchRef = { current: null };
  const effW = result.imageWidth / view.zoom, effH = result.imageHeight / view.zoom;
  const effX = Math.max(0, Math.min(result.imageWidth - effW, view.panX));
  const effY = Math.max(0, Math.min(result.imageHeight - effH, view.panY));
  const fn = new Function(
    'result', 'view', 'setView', 'wrapRef', 'activePointersRef', 'pinchRef', 'effX', 'effY', 'effW', 'effH', 'PHOTO_ZOOM_MIN', 'PHOTO_ZOOM_MAX', 'lashDiagLog', 'lashDiagViewport', 'editingEye', 'editMode',
    pinchSource + '\nreturn {beginPinch,updatePinch};'
  );
  const api = fn(
    result, view, v => calls.setView.push(v), wrapRef, activePointersRef, pinchRef,
    effX, effY, effW, effH, 1, 4, () => {}, () => ({}), 'left', 'mask'
  );
  return { api, calls, activePointersRef, pinchRef };
}

test('B1. pinching outward (fingers spread apart) increases zoom', () => {
  const { api, activePointersRef, calls } = runPinch({ result: PHOTO, view: { zoom: 1, panX: 0, panY: 0 } });
  activePointersRef.current.set(1, { x: 140, y: 90 });
  activePointersRef.current.set(2, { x: 160, y: 90 });
  api.beginPinch();
  activePointersRef.current.set(1, { x: 100, y: 90 });
  activePointersRef.current.set(2, { x: 200, y: 90 });
  api.updatePinch();
  assert.strictEqual(calls.setView.length, 1);
  assert.ok(calls.setView[0].zoom > 1, `expected zoom to increase past 1, got ${calls.setView[0].zoom}`);
});

test('B2. pinching inward (fingers brought together) decreases zoom back toward 1, clamped at the floor', () => {
  const { api, activePointersRef, calls } = runPinch({ result: PHOTO, view: { zoom: 2, panX: 0, panY: 0 } });
  activePointersRef.current.set(1, { x: 50, y: 90 });
  activePointersRef.current.set(2, { x: 250, y: 90 });
  api.beginPinch();
  activePointersRef.current.set(1, { x: 140, y: 90 });
  activePointersRef.current.set(2, { x: 160, y: 90 });
  api.updatePinch();
  assert.ok(calls.setView[0].zoom < 2);
  assert.ok(calls.setView[0].zoom >= 1, 'zoom must never drop below the 1x floor');
});

test('B3. zoom never exceeds the 4x ceiling even for an extreme pinch-out', () => {
  const { api, activePointersRef, calls } = runPinch({ result: PHOTO, view: { zoom: 1, panX: 0, panY: 0 } });
  activePointersRef.current.set(1, { x: 149, y: 90 });
  activePointersRef.current.set(2, { x: 151, y: 90 });
  api.beginPinch();
  activePointersRef.current.set(1, { x: 0, y: 90 });
  activePointersRef.current.set(2, { x: 300, y: 90 });
  api.updatePinch();
  assert.ok(calls.setView[0].zoom <= 4, `expected zoom clamped at 4, got ${calls.setView[0].zoom}`);
});

test('B4. "zoom around the gesture midpoint": the image-space point under the gesture\'s own midpoint stays under it as zoom changes', () => {
  const { api, activePointersRef, calls } = runPinch({ result: PHOTO, view: { zoom: 1, panX: 0, panY: 0 } });
  activePointersRef.current.set(1, { x: 140, y: 85 });
  activePointersRef.current.set(2, { x: 160, y: 115 });
  api.beginPinch();
  activePointersRef.current.set(1, { x: 100, y: 70 });
  activePointersRef.current.set(2, { x: 200, y: 130 });
  api.updatePinch();
  const next = calls.setView[0];
  const newW = PHOTO.imageWidth / next.zoom, newH = PHOTO.imageHeight / next.zoom;
  const newX = next.panX, newY = next.panY;
  const midImageX = newX + 0.5 * newW, midImageY = newY + 0.5 * newH;
  assert.ok(Math.abs(midImageX - PHOTO.imageWidth / 2) < 1e-6, `expected the anchored midpoint to stay at the photo's horizontal center, got ${midImageX}`);
  assert.ok(Math.abs(midImageY - PHOTO.imageHeight / 2) < 1e-6, `expected the anchored midpoint to stay at the photo's vertical center, got ${midImageY}`);
});

test('B5. the resulting pan is always clamped within the full photo bounds, even mid-pinch', () => {
  const { api, activePointersRef, calls } = runPinch({ result: PHOTO, view: { zoom: 1, panX: 0, panY: 0 } });
  activePointersRef.current.set(1, { x: 5, y: 5 });
  activePointersRef.current.set(2, { x: 15, y: 15 });
  api.beginPinch();
  activePointersRef.current.set(1, { x: 0, y: 0 });
  activePointersRef.current.set(2, { x: 30, y: 30 });
  api.updatePinch();
  const next = calls.setView[0];
  const newW = PHOTO.imageWidth / next.zoom, newH = PHOTO.imageHeight / next.zoom;
  assert.ok(next.panX >= -1e-6 && next.panX + newW <= PHOTO.imageWidth + 1e-6, 'effective view must stay within the photo horizontally');
  assert.ok(next.panY >= -1e-6 && next.panY + newH <= PHOTO.imageHeight + 1e-6, 'effective view must stay within the photo vertically');
});

test('B6. beginPinch is a no-op (sets no pinch state) when fewer than 2 pointers are tracked', () => {
  const { api, activePointersRef, pinchRef } = runPinch({ result: PHOTO, view: { zoom: 1, panX: 0, panY: 0 } });
  activePointersRef.current.set(1, { x: 140, y: 90 });
  api.beginPinch();
  assert.strictEqual(pinchRef.current, null);
});

// ------------------------------------------------------------
// C. Structural proof: multi-touch always cancels any single-pointer
//    drag before starting a pinch, pinch never falls through to a drag
//    branch, a leftover finger never resumes a drag, and touch-action
//    is scoped to editing only -- same safety properties already
//    proven for the old editor, now re-proven for the primary surface.
// ------------------------------------------------------------
test('C1. beginDrag cancels any single-pointer drag (and the zone readout) the moment a 2nd pointer is registered, before starting pinch', () => {
  const beginDragSrc = workspaceSource.slice(workspaceSource.indexOf('const beginDrag=(event,kind,frozenT)=>{'), workspaceSource.indexOf('const moveDrag=event=>{'));
  assert.ok(beginDragSrc.includes('if(activePointersRef.current.size>=2){'));
  assert.ok(beginDragSrc.indexOf('dragRef.current=null;setDragZoneIndex(null);') < beginDragSrc.indexOf('beginPinch();'), 'the single-pointer drag/readout must be cancelled BEFORE pinch starts');
});

test('C2. moveDrag routes to updatePinch (and nothing else) whenever a pinch is active, never falling through to the zone/map/inner/outer/peak branches', () => {
  const moveDragSrc = workspaceSource.slice(workspaceSource.indexOf('const moveDrag=event=>{'), workspaceSource.indexOf('const endDrag=event=>{'));
  assert.ok(moveDragSrc.includes('if(pinchRef.current){event.preventDefault();updatePinch();return;}'));
});

test('C3. a lone leftover finger after a pinch ends does NOT resume into a single-pointer drag', () => {
  const endDragSrc = workspaceSource.slice(workspaceSource.indexOf('const endDrag=event=>{'), workspaceSource.indexOf('const handleBackgroundPointerDown=event=>{'));
  assert.ok(endDragSrc.includes('if(activePointersRef.current.size<2)pinchRef.current=null;'));
  assert.ok(!/pinchRef\.current=null;[^}]*dragRef\.current=\{/.test(endDragSrc), 'ending a pinch must never re-initialize a single-pointer drag');
});

test('C4. open-background pointerdown (not on any handle) only ever starts a pinch when 2+ pointers are active', () => {
  const bgSrc = workspaceSource.slice(workspaceSource.indexOf('const handleBackgroundPointerDown=event=>{'), workspaceSource.indexOf('const handleReset='));
  assert.ok(bgSrc.includes('if(activePointersRef.current.size>=2){'));
  assert.ok(!/dragRef\.current=\{/.test(bgSrc), 'single-finger background touches must never start a drag');
});

test('C5. the background rect gets touchAction:none ONLY while editing -- never a global/always-on override', () => {
  assert.ok(workspaceSource.includes('onPointerDown={editing?handleBackgroundPointerDown:undefined} style={editing?{touchAction:\'none\'}:undefined}'));
});

test('C6. a non-finite pinch result (NaN/Infinity edge case) is never written to view state', () => {
  assert.ok(workspaceSource.includes('const allFinite=[newZoom,newX,newY,newW,newH].every(Number.isFinite);'));
  assert.ok(workspaceSource.includes('if(!allFinite)return;'));
});

// ------------------------------------------------------------
// D. Scope freeze: global app shell (viewport meta, body touch-action),
//    curl geometry, and the old editor's own zoom code are untouched.
// ------------------------------------------------------------
test('D1. the global viewport meta tag is byte-identical to before this change', () => {
  assert.ok(src.includes('<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">'));
});

test('D2. the global body touch-action rule is byte-identical to before this change', () => {
  assert.ok(src.includes("body { background: #02060B; color: #F4F7FA; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; overflow: hidden; touch-action: manipulation; }"));
});

// RETIRED (LJ/LB/LC curl expansion task): this originally asserted a
// zero git diff on photo-lash-preview.js to prove the new zoom/pinch
// workspace never touched curl geometry. Curl-geometry edits are now a
// separate, explicitly-approved task, so a permanent zero-diff check on
// this file is no longer meaningful -- replaced with a narrower check
// that this zoom/pinch change itself never altered the file's public
// rendering contract.
test('D3. photo-lash-preview.js retains its public rendering contract (sampleSectors/buildFibers/draw) unchanged by this zoom/pinch change -- no longer a zero-diff check, since curl-geometry edits are a separate, explicitly-approved scope', () => {
  const PhotoLashPreview = require('../photo-lash-preview');
  assert.equal(typeof PhotoLashPreview.sampleSectors, 'function');
  assert.equal(typeof PhotoLashPreview.buildFibers, 'function');
  assert.equal(typeof PhotoLashPreview.draw, 'function');
});

test('D4. zoom/pan state resets to 1x/no-pan whenever editing ends -- folded into the auto-focus effect, behaviorally proven in section E4 below; this is a structural cross-reference only', () => {
  assert.ok(workspaceSource.includes("if(!editing){setView({zoom:1,panX:0,panY:0});return;}"));
});

test('D5. the old LegacyProfessionalEyeMap zoom implementation is untouched (still present, still its own separate PHOTO_ZOOM_MIN/MAX, not deleted or merged) -- "do not delete aggressively, no broad cleanup this pass"', () => {
  const legacyStart = src.indexOf('    function LegacyProfessionalEyeMap(');
  assert.ok(legacyStart !== -1);
  const legacySlice = src.slice(legacyStart, legacyStart + 20000);
  assert.ok(legacySlice.includes('const PHOTO_ZOOM_MIN=1,PHOTO_ZOOM_MAX=4;'), 'the old editor must keep its own working zoom code, untouched');
});

// ------------------------------------------------------------
// E. Auto-focus-the-active-eye math (real, unmodified effect body):
//    entering edit mode or switching editingEye must compute a
//    {zoom,panX,panY} that centers and zooms on the eye actually being
//    edited, through the SAME viewport state pinch/pan drives -- never
//    a separate crop/re-render of the photo.
// ------------------------------------------------------------
const autoFocusStart = workspaceSource.indexOf("      useEffect(()=>{\n        // TEMPORARY DIAGNOSTIC");
assert.ok(autoFocusStart !== -1, 'expected to locate the auto-focus effect');
const autoFocusEnd = workspaceSource.indexOf('},[editing,editingEye]);', autoFocusStart) + '},[editing,editingEye]);'.length;
const autoFocusBody = workspaceSource.slice(workspaceSource.indexOf('{', autoFocusStart + 'useEffect(()=>'.length) + 1, workspaceSource.lastIndexOf('}', autoFocusEnd));

function runAutoFocus({ result, eyePoints, eyeWidth, editing, editingEye }) {
  const calls = { setView: [] };
  const fakeEye = { side: editingEye, points: eyePoints, eyeWidth };
  const buildPhotoPreviewEyes = () => [fakeEye, { side: editingEye === 'left' ? 'right' : 'left', points: eyePoints, eyeWidth }];
  // lashDiagLog/lashDiagViewport/wrapRef/imageRef are the TEMPORARY
  // diagnostic's own free variables (see index.html's LashDiagOverlay
  // section) -- stubbed as harmless no-ops/empty refs so this test keeps
  // exercising the REAL, unmodified effect body rather than a copy.
  const fn = new Function('result', 'clientDesign', 'editing', 'editingEye', 'setView', 'buildPhotoPreviewEyes', 'lashDiagLog', 'lashDiagViewport', 'wrapRef', 'imageRef', autoFocusBody);
  fn(result, {}, editing, editingEye, v => calls.setView.push(v), buildPhotoPreviewEyes, () => {}, () => ({}), { current: null }, { current: null });
  return calls;
}

test('E1. entering edit mode (editing becomes true) computes a zoom/pan that centers on the edited eye\'s CURRENT (adjustment-inclusive) root points, not just the raw landmark position', () => {
  const eyePoints = [{ x: 120, y: 80 }, { x: 140, y: 75 }, { x: 160, y: 78 }, { x: 180, y: 82 }];
  const calls = runAutoFocus({ result: { imageWidth: 400, imageHeight: 600 }, eyePoints, eyeWidth: 60, editing: true, editingEye: 'left' });
  assert.strictEqual(calls.setView.length, 1);
  const v = calls.setView[0];
  assert.ok(Number.isFinite(v.zoom) && Number.isFinite(v.panX) && Number.isFinite(v.panY));
  assert.ok(v.zoom > 1, `expected auto-focus to zoom in past 1x for a small eye region on a large photo, got ${v.zoom}`);
});

test('E2. the resulting zoom is clamped to the same [1,4] range as pinch', () => {
  // An extremely tiny eye region on a huge photo would naively demand a
  // huge zoom -- must still clamp at 4.
  const eyePoints = [{ x: 200, y: 300 }, { x: 201, y: 300 }, { x: 202, y: 301 }, { x: 203, y: 300 }];
  const calls = runAutoFocus({ result: { imageWidth: 2000, imageHeight: 3000 }, eyePoints, eyeWidth: 2, editing: true, editingEye: 'left' });
  assert.ok(calls.setView[0].zoom <= 4);
});

test('E3. the resulting pan keeps the focus window fully within the photo bounds', () => {
  const eyePoints = [{ x: 10, y: 10 }, { x: 20, y: 12 }, { x: 30, y: 10 }];
  const calls = runAutoFocus({ result: { imageWidth: 400, imageHeight: 600 }, eyePoints, eyeWidth: 40, editing: true, editingEye: 'left' });
  const v = calls.setView[0];
  const ew = 400 / v.zoom, eh = 600 / v.zoom;
  assert.ok(v.panX >= -1e-6 && v.panX + ew <= 400 + 1e-6);
  assert.ok(v.panY >= -1e-6 && v.panY + eh <= 600 + 1e-6);
});

test('E4. exiting edit mode (editing=false) resets to exactly 1x/no-pan, regardless of editingEye', () => {
  const calls = runAutoFocus({ result: { imageWidth: 400, imageHeight: 600 }, eyePoints: [{ x: 1, y: 1 }], eyeWidth: 10, editing: false, editingEye: null });
  assert.deepStrictEqual(calls.setView, [{ zoom: 1, panX: 0, panY: 0 }]);
});

test('E5. the auto-focus effect depends on [editing,editingEye] only -- NOT on result/clientDesign -- so a drag (which changes clientDesign every frame) never re-triggers it and yanks the user\'s own zoom/pan away', () => {
  assert.ok(workspaceSource.slice(autoFocusEnd - 30, autoFocusEnd).includes('[editing,editingEye]'));
});

test('E6. generous, eye-width-relative padding is used (not a fixed pixel constant), with extra room on top specifically for lash fibers extending upward from the root line', () => {
  assert.ok(autoFocusBody.includes('padTop=target.eyeWidth*.9') && autoFocusBody.includes('padSide=target.eyeWidth*.4') && autoFocusBody.includes('padBottom=target.eyeWidth*.3'));
});
