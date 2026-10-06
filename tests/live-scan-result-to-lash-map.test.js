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

test('Lash Map opens on DIAGRAM for non-photo results and on PHOTO for photo results', () => {
  assert.ok(src.includes("const [viewMode,setViewMode]=useState(result?.source==='photo'?'photo':'diagram');"));
  assert.ok(!src.includes("const [viewMode,setViewMode]=useState('photo');"), 'no unconditional PHOTO default may remain');
});

test('the workspace effect returns before touching a missing <img>, before any addEventListener', () => {
  const i = ws.indexOf('const img=imageRef.current;');
  assert.ok(ws.slice(i, ws.indexOf('addEventListener', i)).includes('if(!img)return;'));
});
