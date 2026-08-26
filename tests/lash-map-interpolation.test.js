const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const start = src.indexOf('    const ZONE_NAMES = ');
const end = src.indexOf('\n    const CATEGORY_LABELS =', start);
assert.ok(start >= 0 && end > start, 'lash-map display helper must be extractable');
const { expandLashMapSectors } = new Function(
  src.slice(start, end) + '\nreturn { expandLashMapSectors };'
)();

const lengths = sectors => sectors.map(s => s.len);
const maxJump = values => Math.max(0, ...values.slice(1).map((v, i) => Math.abs(v - values[i])));

test('6,7,9,12,11 renders without a neighboring jump above 1 mm', () => {
  const rendered = lengths(expandLashMapSectors([6, 7, 9, 12, 11], 3));
  assert.deepStrictEqual(rendered, [6, 7, 8, 9, 10, 11, 12, 11]);
  assert.ok(maxJump(rendered) <= 1);
});

test('6,7,9,13,11 includes 10/11/12 before PEAK 13', () => {
  const sectors = expandLashMapSectors([6, 7, 9, 13, 11], 3);
  const peak = sectors.findIndex(s => s.isPeak);
  assert.deepStrictEqual(lengths(sectors).slice(0, peak + 1), [6, 7, 8, 9, 10, 11, 12, 13]);
  assert.ok(maxJump(lengths(sectors)) <= 1);
});

test('7,8,9,10,10 keeps the intentional PEAK/OUTER plateau without a duplicate display sector', () => {
  const controls = [7, 8, 9, 10, 10];
  const rendered = lengths(expandLashMapSectors(controls, 3));
  assert.deepStrictEqual(rendered, [7, 8, 9, 10]);
  assert.deepStrictEqual(controls, [7, 8, 9, 10, 10], 'business control values remain unchanged');
});

test('7,8,9,10,9 renders the real one-millimeter PEAK to OUTER decrease', () => {
  const rendered = lengths(expandLashMapSectors([7, 8, 9, 10, 9], 3));
  assert.deepStrictEqual(rendered, [7, 8, 9, 10, 9]);
  assert.ok(maxJump(rendered) <= 1);
});

test('7,8,9,10,9 never gains an extra trailing 9 display sector', () => {
  const rendered = lengths(expandLashMapSectors([7, 8, 9, 10, 9], 3));
  assert.notDeepStrictEqual(rendered.slice(-3), [10, 9, 9]);
  assert.strictEqual(rendered.filter((v, i) => i > 0 && v === 9 && rendered[i - 1] === 9).length, 0);
});

test('independent LEFT/RIGHT one-millimeter peak correction survives display expansion', () => {
  const left = expandLashMapSectors([6, 7, 9, 12, 11], 3);
  const right = expandLashMapSectors([6, 7, 9, 13, 11], 3);
  assert.strictEqual(left.find(s => s.isPeak).len, 12);
  assert.strictEqual(right.find(s => s.isPeak).len, 13);
  assert.strictEqual(right.find(s => s.isPeak).len - left.find(s => s.isPeak).len, 1);
});

test('Custom map remains five editable controls and expansion does not mutate it', () => {
  const custom = [5, 8, 11, 14, 9];
  const before = [...custom];
  const rendered = lengths(expandLashMapSectors(custom, 3));
  assert.deepStrictEqual(custom, before);
  assert.ok(rendered.length > custom.length);
  assert.ok(maxJump(rendered) <= 1);
  assert.ok(src.includes("const next = [...base]; next[idx] = Math.max(5, Math.min(16, val));"));
  assert.ok(src.includes("const [customLeft, setCustomLeft] = useState(design.leftZones);"));
  assert.ok(src.includes("const [customRight, setCustomRight] = useState(design.rightZones);"));
});

test('diagram and written plan share the same expanded sectors', () => {
  assert.ok(src.includes('const items = expandLashMapSectors(zones, peakIdx);'));
  assert.ok(src.includes('const displaySectors = expandLashMapSectors(zones, peakIdx);'));
  assert.ok(src.includes('plan.displaySectors.map((sector,i) =>'));
});
