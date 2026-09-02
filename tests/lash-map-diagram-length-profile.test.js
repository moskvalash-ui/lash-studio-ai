'use strict';
// ============================================================
// DIAGRAM LASH-LENGTH PROFILE — regression tests for the DIAGRAM Lash
// Map's visible profile.
//
// Phase 1: made the profile length-driven instead of following the
// fixed decorative sin(t*PI) eye arch.
// Phase 2 (this revision): replaced the fixed 5-16mm absolute mm->px
// scale with a bounded ADAPTIVE amplitude derived from each render's
// own local min/max length span -- a fixed absolute scale made small-
// span designs (Doll/Natural, ~2mm) read almost flat while even Fox's
// own 6mm span only used ~55% of the range. The new formula is a
// monotonic, saturating curve of the local span alone: 0mm -> flat,
// small spans get proportionally more of the range so they stay
// readable, larger spans keep growing but level off. One shared
// formula, no effect id, no per-effect tuning. Also: numeric mm labels
// are now shown only on canonical (isKey) zones, not every
// interpolation sample.
//
// The renderer (LegacyLashMapDiagram, index.html) derives everything
// from the same generic engine sample data (t, len) already used
// elsewhere -- never from an effect id, never from equal spacing /
// i/(n-1), never from a second zone-position system.
// ============================================================
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const zoneStart = src.indexOf('    const ZONE_NAMES = ');
const zoneEnd = src.indexOf('\n    const CATEGORY_LABELS =', zoneStart);
const { expandLashMapSectors } = new Function(src.slice(zoneStart, zoneEnd) + '\nreturn { expandLashMapSectors };')();

const ampStart = src.indexOf('    const LASH_LENGTH_PROFILE_BASELINE_Y');
const ampEnd = src.indexOf('\n    function LegacyLashMapDiagram(', ampStart);
assert.ok(ampStart >= 0 && ampEnd > ampStart, 'lash length profile amplitude formula must be structurally extractable');
const ampSource = src.slice(ampStart, ampEnd);
const { lashLengthProfileAmplitude, LASH_LENGTH_PROFILE_BASELINE_Y, LASH_LENGTH_PROFILE_MAX_AMPLITUDE_PX, LASH_LENGTH_PROFILE_SATURATION_MM } = new Function(
  ampSource + '\nreturn { lashLengthProfileAmplitude, LASH_LENGTH_PROFILE_BASELINE_Y, LASH_LENGTH_PROFILE_MAX_AMPLITUDE_PX, LASH_LENGTH_PROFILE_SATURATION_MM };'
)();

const rendererStart = src.indexOf('    function LegacyLashMapDiagram(');
const rendererEnd = src.indexOf('\n    // Phase 2B consumer boundary', rendererStart);
assert.ok(rendererStart >= 0 && rendererEnd > rendererStart, 'LegacyLashMapDiagram must be structurally extractable');
const rendererSource = src.slice(rendererStart, rendererEnd);

const catalogStart = src.indexOf('    const DESIGN_CATALOG = ');
const catalogEnd = src.indexOf('\n\n    function calculateEyeLashMap(', catalogStart);
const DESIGN_CATALOG = new Function('const clampScore=n=>n;' + src.slice(catalogStart, catalogEnd) + ';return DESIGN_CATALOG;')();

const curveFor = entry => ({ zonePositions: entry.zonePositions || null, postPeakShape: entry.postPeakShape || 'linear', plateauShape: entry.plateauShape || 'linear' });
const xAt = (t, side) => 55 + (side === 'right' ? 1 - t : t) * 290;

// Reproduces the renderer's own per-render local-normalization exactly
// (the same three lines LegacyLashMapDiagram runs), for a given zones
// array -- not a second/approximate formula.
function profileFor(zones, peakZone, entry) {
  const items = expandLashMapSectors(zones, peakZone, curveFor(entry));
  const lens = items.map(z => z.len);
  const localMin = Math.min(...lens), localMax = Math.max(...lens), localSpan = localMax - localMin;
  const amplitude = lashLengthProfileAmplitude(localSpan);
  const profileY = z => localSpan > 0 ? LASH_LENGTH_PROFILE_BASELINE_Y - amplitude * (z.len - localMin) / localSpan : LASH_LENGTH_PROFILE_BASELINE_Y;
  return { items, localMin, localMax, localSpan, amplitude, profileY };
}

test('amplitude formula: monotonic, bounded, span=0 is exactly flat, matches the reported mapping table', () => {
  assert.strictEqual(lashLengthProfileAmplitude(0), 0);
  const table = { 1: 18.75, 2: 30, 3: 37.5, 4: 42.857142857142854, 5: 46.875, 6: 50, 8: 54.54545454545455, 11: 58.92857142857143 };
  for (const [span, expected] of Object.entries(table)) {
    assert.ok(Math.abs(lashLengthProfileAmplitude(Number(span)) - expected) < 1e-9, `span=${span}`);
  }
  // Monotonic strictly increasing over 0..20mm.
  let prev = lashLengthProfileAmplitude(0);
  for (let s = 0.5; s <= 20; s += 0.5) {
    const cur = lashLengthProfileAmplitude(s);
    assert.ok(cur > prev, `amplitude must strictly increase at span=${s}`);
    prev = cur;
  }
  // Bounded: never reaches or exceeds the cap, even for a very large span.
  assert.ok(lashLengthProfileAmplitude(1000) < LASH_LENGTH_PROFILE_MAX_AMPLITUDE_PX);
  assert.ok(lashLengthProfileAmplitude(1000) > LASH_LENGTH_PROFILE_MAX_AMPLITUDE_PX * 0.95, 'must approach the cap for very large spans');
});

test('LegacyLashMapDiagram has no effect-specific rendering rule for the length profile', () => {
  const codeOnly = rendererSource.split('\n').map(line => line.replace(/\/\/.*$/, '')).join('\n');
  assert.ok(!/\b(?:fox|cat|squirrel|doll|natural|softfox)\b/i.test(codeOnly));
  assert.ok(!/i\s*\/\s*\(\s*(?:n|items\.length|zones\.length)\s*-\s*1\s*\)/.test(codeOnly), 'profile must not fall back to equal spacing (i/(n-1))');
});

test('profile amplitude is derived from THIS render\'s own local min/max, not a fixed global scale', () => {
  assert.ok(rendererSource.includes('const localLens=items.map(z=>z.len);'));
  assert.ok(rendererSource.includes('const localMin=Math.min(...localLens),localMax=Math.max(...localLens),localSpan=localMax-localMin;'));
  assert.ok(rendererSource.includes('const localAmplitude=lashLengthProfileAmplitude(localSpan);'));
});

test('FOX real-device runtime target: [5,6,8,11,10], peak t=0.85, visually dominant over BODY and OUTER', () => {
  const fox = DESIGN_CATALOG.find(e => e.id === 'fox');
  const r = profileFor([5, 6, 8, 11, 10], 3, fox);
  const keys = Object.fromEntries(r.items.filter(z => z.isKey).map(z => [z.label, z]));

  assert.strictEqual(keys.INNER.len, 5);
  assert.strictEqual(keys.TRANSITION.len, 6);
  assert.strictEqual(keys.BODY.len, 8);
  assert.strictEqual(keys.PEAK.len, 11);
  assert.strictEqual(keys.PEAK.t, 0.85);
  assert.strictEqual(keys.OUTER.len, 10);
  assert.strictEqual(keys.OUTER.t, 1);

  assert.ok(r.profileY(keys.PEAK) < r.profileY(keys.BODY), 'PEAK must read visually higher than BODY');
  assert.ok(r.profileY(keys.PEAK) < r.profileY(keys.OUTER), 'PEAK must read visually higher than OUTER');
  assert.ok(r.profileY(keys.OUTER) > r.profileY(keys.PEAK), 'OUTER must visibly drop from PEAK');
  const rise = [keys.INNER, keys.TRANSITION, keys.BODY, keys.PEAK].map(z => r.profileY(z));
  for (let i = 1; i < rise.length; i++) assert.ok(rise[i] < rise[i - 1], `profile must keep rising up to PEAK (step ${i})`);
});

test('DOLL/NATURAL (2mm span) are readable but strictly less dramatic than FOX/CAT (5-6mm span)', () => {
  const doll = DESIGN_CATALOG.find(e => e.id === 'doll'), natural = DESIGN_CATALOG.find(e => e.id === 'natural');
  const fox = DESIGN_CATALOG.find(e => e.id === 'fox'), cat = DESIGN_CATALOG.find(e => e.id === 'cat');
  const dollR = profileFor(doll.baseZones, doll.peakZone, doll);
  const naturalR = profileFor(natural.baseZones, natural.peakZone, natural);
  const foxR = profileFor(fox.baseZones, fox.peakZone, fox);
  const catR = profileFor(cat.baseZones, cat.peakZone, cat);

  assert.strictEqual(dollR.localSpan, 2);
  assert.strictEqual(naturalR.localSpan, 2);
  assert.strictEqual(foxR.localSpan, 6);
  assert.strictEqual(catR.localSpan, 5);

  // Readable: a real, non-trivial amplitude (not near-flat like the old fixed scale gave, ~11px).
  assert.ok(dollR.amplitude >= 25, 'Doll amplitude must be clearly readable');
  assert.ok(naturalR.amplitude >= 25, 'Natural amplitude must be clearly readable');

  // Less dramatic than Fox/Cat: strictly smaller amplitude.
  assert.ok(dollR.amplitude < foxR.amplitude);
  assert.ok(dollR.amplitude < catR.amplitude);
  assert.ok(naturalR.amplitude < foxR.amplitude);
  assert.ok(naturalR.amplitude < catR.amplitude);
});

for (const id of ['cat', 'squirrel', 'doll', 'natural']) {
  test(`${id.toUpperCase()}: visible profile follows this effect's own real lengths and zonePositions, not Fox's`, () => {
    const entry = DESIGN_CATALOG.find(e => e.id === id);
    assert.ok(entry, id);
    const r = profileFor(entry.baseZones, entry.peakZone, entry);
    const keys = r.items.filter(z => z.isKey);
    assert.strictEqual(keys.length, 5, id);
    const expectedPositions = entry.zonePositions || [0, .25, .5, .75, 1];
    keys.forEach((z, i) => assert.strictEqual(z.t, expectedPositions[i], `${id} zone ${i} t`));
    keys.forEach((z, i) => assert.strictEqual(z.len, entry.baseZones[i], `${id} zone ${i} len`));
    // The zone(s) holding the maximum length read at least as tall as every other zone (plateaus, e.g. Doll/Natural BODY=PEAK, are legitimate exact ties).
    const maxLen = Math.max(...keys.map(z => z.len));
    const peakY = r.profileY({ len: maxLen });
    for (const z of keys) assert.ok(peakY <= r.profileY(z), `${id}: zone with max len must be visually tallest or tied (${z.label})`);
    assert.notDeepStrictEqual(entry.baseZones, DESIGN_CATALOG.find(e => e.id === 'fox').baseZones, id);
  });
}

test('plateaus (equal-length zones, e.g. Doll/Natural BODY=PEAK) stay exactly equal height', () => {
  for (const id of ['doll', 'natural']) {
    const entry = DESIGN_CATALOG.find(e => e.id === id);
    const r = profileFor(entry.baseZones, entry.peakZone, entry);
    const body = r.items.find(z => z.label === 'BODY'), peak = r.items.find(z => z.isPeak);
    assert.strictEqual(body.len, peak.len, id);
    assert.strictEqual(r.profileY(body), r.profileY(peak), id);
  }
});

test('flat map (localMax === localMin) renders at the stable baseline Y with no division by zero', () => {
  const fox = DESIGN_CATALOG.find(e => e.id === 'fox');
  const r = profileFor([9, 9, 9, 9, 9], 3, fox);
  assert.strictEqual(r.localSpan, 0);
  assert.strictEqual(r.amplitude, 0);
  for (const z of r.items) {
    const y = r.profileY(z);
    assert.strictEqual(y, LASH_LENGTH_PROFILE_BASELINE_Y);
    assert.ok(Number.isFinite(y));
  }
});

test('MIRROR: LEFT and RIGHT produce identical length/height profiles, mirrored only horizontally', () => {
  const fox = DESIGN_CATALOG.find(e => e.id === 'fox');
  const r = profileFor([5, 6, 8, 11, 10], 3, fox);
  for (const z of r.items) {
    const leftX = xAt(z.t, 'left'), rightX = xAt(z.t, 'right');
    assert.strictEqual(leftX + rightX, 400, `t=${z.t} must be symmetric about the canvas center`);
  }
  const leftXs = r.items.map(z => xAt(z.t, 'left'));
  const rightXs = r.items.map(z => xAt(z.t, 'right'));
  assert.notDeepStrictEqual(leftXs, rightXs, 'LEFT and RIGHT must actually differ in X (real mirroring, not a no-op)');
});

test('PEAK dot/label sit directly on the length-driven profile line, not the decorative arch', () => {
  assert.ok(rendererSource.includes('{items.map((z,i)=>{const x=xAt(z.t),y=profileY(z);return <g key={i} onClick={()=>setHoveredZone(hoveredZone===i?null:i)}'));
  assert.ok(rendererSource.includes('data-diagram-lash-profile-line'));
  assert.ok(rendererSource.includes('data-diagram-lash-profile-fill'));
});

test('the decorative anatomical eye outline is demoted to a faint background/reference guide', () => {
  assert.ok(rendererSource.includes('data-diagram-eye-guide'));
  assert.ok(/data-diagram-eye-guide="true"[^>]*fill="rgba\(83,199,255,\.015\)"[^>]*stroke="rgba\(83,199,255,\.14\)"/.test(rendererSource), 'eye outline must be visually faint (low opacity) relative to the profile');
});

test('LABEL DECLUTTER: numeric mm text renders only for canonical (isKey) zones, never for interpolation-only samples', () => {
  assert.ok(rendererSource.includes('{z.isKey&&<text x={x} y={y-16}'), 'numeric label must be gated on z.isKey');
  assert.ok(!rendererSource.includes('fontSize={z.isKey?15:11}'), 'the old always-shown numeric label must be gone');
});

test('LABEL DECLUTTER: interpolation samples still contribute to the profile line/dots geometry, just without a primary numeric label', () => {
  const fox = DESIGN_CATALOG.find(e => e.id === 'fox');
  const items = expandLashMapSectors([5, 6, 8, 11, 10], 3, curveFor(fox));
  const nonKey = items.filter(z => !z.isKey);
  assert.ok(nonKey.length > 0, 'fixture must actually exercise interpolation-only samples');
  for (const z of nonKey) assert.ok(!z.label, 'non-key samples must not carry a canonical zone label');
});

test('OUTER remains fixed at t=1 for every effect, independent of the profile-amplitude change', () => {
  for (const entry of DESIGN_CATALOG) {
    const items = expandLashMapSectors(entry.baseZones, entry.peakZone, curveFor(entry));
    const outer = items.find(z => z.label === 'OUTER');
    assert.strictEqual(outer.t, 1, entry.id);
  }
});
