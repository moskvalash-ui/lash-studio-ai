const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

// Source-guard companion to tests/e2e/live-scan-result-to-lash-map.spec.js.
const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const start = src.indexOf('    function PhotoLashEditorWorkspace(');
const end = src.indexOf('\n    function ', start + 10);
assert.ok(start > 0 && end > start, 'PhotoLashEditorWorkspace must be extractable');
const ws = src.slice(start, end);

test('workspace still renders nothing for non-photo (live) results', () => {
  assert.ok(ws.includes("if(result.source!=='photo')return null;"));
});

test('every effect that dereferences imageRef.current guards a missing <img> (it is never attached for non-photo results)', () => {
  const re = /const img=imageRef\.current;/g;
  let m, checked = 0;
  while ((m = re.exec(ws))) {
    const after = ws.slice(m.index, m.index + 700);
    const guard = /if\s*\(\s*!img\s*\)\s*return|if\s*\(\s*result\.source\s*!==\s*'photo'\s*\)\s*return/.test(after.slice(0, after.indexOf('img.addEventListener') > 0 ? after.indexOf('img.addEventListener') : after.length));
    assert.ok(guard, 'imageRef.current is dereferenced without a null/source guard at offset ' + m.index);
    checked++;
  }
  assert.ok(checked >= 1, 'expected at least one imageRef.current effect to check');
});

test('Lash Map routes live results to ProfessionalEyeMap; photo results go to the workspace only while Photo Preview is enabled, otherwise to DIAGRAM', () => {
  assert.ok(src.includes("const [viewMode,setViewMode]=useState('photo');"));
  const branch = src.slice(src.indexOf("{viewMode==='photo'&&result.source!=='photo'?"), src.indexOf("<LashMapDiagram clientDesign={diagramClientDesign}"));
  assert.ok(branch.length > 0, 'live/photo routing branch must exist');
  assert.ok(branch.includes("<ProfessionalEyeMap key={side}") && branch.includes("['left','right'].map(side=>"), 'both live eye cards');
  assert.ok(branch.includes(":viewMode==='photo'&&PHOTO_LASH_PREVIEW_ENABLED?"), 'the photo-workspace branch must still exist in source, gated -- not deleted');
  assert.ok(branch.indexOf('<ProfessionalEyeMap') < branch.indexOf(":viewMode==='photo'&&PHOTO_LASH_PREVIEW_ENABLED?") && branch.indexOf(":viewMode==='photo'&&PHOTO_LASH_PREVIEW_ENABLED?") < branch.indexOf('<PhotoLashEditorWorkspace'), 'ordering: live branch, then the gated photo-workspace branch, then the workspace itself');
  assert.ok(src.includes('const PHOTO_LASH_PREVIEW_ENABLED = false;'), 'Photo Preview is currently OFF -- live AND photo results both land on DIAGRAM; flip this one constant to restore the workspace');
});

test('live ProfessionalEyeMap calls pass the COMPLETE current prop set with the side bound into the zone callback', () => {
  const call = src.slice(src.indexOf('<ProfessionalEyeMap key={side}'), src.indexOf('/>)}', src.indexOf('<ProfessionalEyeMap key={side}')));
  for (const prop of ['clientDesign=', 'result={result}', 'side={side}', 'active=', 'onActivate=', 'lang={lang}', 'editing=', 'onAdjustmentChange=', 'onEdit=', 'onReset=', 'onDone=', 'onZoneLengthChange=', 'editMode={photoEditMode}', 'onEditModeChange={setPhotoEditMode}']) assert.ok(call.includes(prop), 'missing prop ' + prop);
  // The per-eye renderer calls onZoneLengthChange(index, mm); applyZoneDrag is (side, index, mm).
  assert.ok(call.includes('onZoneLengthChange={(idx,mm)=>applyZoneDrag(side,idx,mm)}'), 'side must be bound, never passing applyZoneDrag directly');
  assert.ok(call.includes("onReset={()=>photoEditMode==='mask'?resetPhotoAdjustment(side):resetDesignForSide(side)}"));
});

test('legacy per-eye renderer sources the captured frame, never the camera/video element', () => {
  const i = src.indexOf('function LegacyProfessionalEyeMap(');
  const body = src.slice(i, src.indexOf('function ProfessionalEyeMap(', i));
  assert.ok(body.includes('<image href={result.nativeImage || result.originalImage}'));
  assert.ok(!/videoRef|getUserMedia|srcObject/.test(body));
});

test('the workspace effect returns before touching a missing <img>, before any addEventListener', () => {
  const i = ws.indexOf('const img=imageRef.current;');
  assert.ok(ws.slice(i, ws.indexOf('addEventListener', i)).includes('if(!img)return;'));
});

test('per-eye edit controls live BELOW the interactive eye/map area, never overlaying the SVG', () => {
  const i = src.indexOf('function LegacyProfessionalEyeMap(');
  const body = src.slice(i, src.indexOf('function ProfessionalEyeMap(', i));
  const boxStart = body.indexOf('aspect-[16/9]'), boxEndMarker = body.indexOf('data-photo-edit-action-bar');
  assert.ok(boxStart > 0 && boxEndMarker > boxStart, 'action bar must come after the interactive box starts');
  const insideBox = body.slice(boxStart, boxEndMarker);
  assert.ok(!insideBox.includes('onEditModeChange('), 'no Fit/Design toggle inside the interactive box');
  assert.ok(!insideBox.includes('onReset()') && !insideBox.includes('onDone()'), 'no Reset/Done inside the interactive box');
  const bar = body.slice(boxEndMarker);
  assert.ok(bar.includes("onEditModeChange('mask')") && bar.includes("onEditModeChange('design')") && bar.includes('onReset()') && bar.includes('onDone()'), 'all four controls still exist in the action bar');
  assert.ok(/\{editing&&<div data-photo-edit-action-bar="true"/.test(body), 'bar only exists while editing');
  assert.ok(insideBox.includes('{!editing&&('), 'the overlay inside the box now only holds the non-editing label + edit entry point');
});
