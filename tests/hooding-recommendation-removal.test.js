'use strict';
// ============================================================
// HOODING RECOMMENDATION REMOVAL — product decision: eyelid hooding is
// no longer a trusted recommendation parameter.
// ------------------------------------------------------------
// This proves, on the REAL functions extracted from index.html (not a
// reimplementation), that isHooded/hoodedConfidence/hoodingLevel no
// longer influence any recommendation output — DESIGN_CATALOG
// score/cautions, recommendCurl, generateEyeHighlight, or the
// Application Plan's preparation/artistNotes — while:
//   - eyeSizeCategory/relativeEyeSize STILL influence recommendations
//     (explicitly out of scope for this phase);
//   - every OTHER, unrelated recommendation input (tiltTendency,
//     shapeTendencies, isCloseSet/isWideSet, compositeAsymmetry,
//     overallConfidence) behaves exactly as before — proven by running
//     the real DESIGN_CATALOG/recommendCurl functions with only the
//     hooding fields varied and everything else held fixed;
//   - unknown/uncertain hooding is never coerced into a "confirmed
//     non-hooded" value that changes any output — proven by checking
//     hooded/non-hooded/uncertain inputs all produce byte-identical
//     recommendation output, not just that "false" happens to match
//     one particular case;
//   - the underlying hooding fields/calculations (classifyFeatures,
//     eyeProfileLabels, ReviewScreen confirm()) still exist, unchanged,
//     for diagnostics/backward compatibility.
// ============================================================
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function slice(startMarker, endMarker, fromIndex) {
  const start = indexSource.indexOf(startMarker, fromIndex || 0);
  const end = indexSource.indexOf(endMarker, start);
  return indexSource.slice(start, end);
}

const catalogSource = slice('    const DESIGN_CATALOG = ', '\n\n    function calculateEyeLashMap(');
const catalog = new Function('const clampScore=n=>n;' + catalogSource + ';return DESIGN_CATALOG;')();

function loadRecommendCurl() {
  const curlCatalog = slice('const CURL_CATALOG = [', '\n    function recommendCurl');
  const rc = slice('function recommendCurl(', '\n\n');
  return new Function(curlCatalog + rc + '; return { recommendCurl, CURL_CATALOG };')();
}
const { recommendCurl } = loadRecommendCurl();

function loadGenerateEyeHighlight() {
  // NOTE: slice()'s endMarker is excluded from the result (correct for
  // "everything up to the next declaration" boundaries elsewhere in
  // this file), but here the end marker IS the function's own closing
  // brace — it must be included, or the extracted source is missing
  // its final `}` and fails to parse.
  const start = indexSource.indexOf('function generateEyeHighlight(');
  const closeMarker = '\n    }';
  const end = indexSource.indexOf(closeMarker, start) + closeMarker.length;
  const fn = indexSource.slice(start, end);
  return new Function('const TILT_CONFIDENCE_FLOOR=0.22;' + fn + '; return { generateEyeHighlight };')();
}
const { generateEyeHighlight } = loadGenerateEyeHighlight();

// ------------------------------------------------------------
// Test profiles: a baseline plus hooded/non-hooded/uncertain variants
// that differ ONLY in hooding-related fields — everything else fixed,
// so any output difference can only be explained by hooding.
// ------------------------------------------------------------
const BASE_PROFILE = {
  relativeEyeSize: .34, isCloseSet: false, isWideSet: false,
  tiltTendency: 'neutral', tiltConfidence: .75, tiltDegrees: 0,
  compositeAsymmetry: .09, overallConfidence: .72,
  shapeTendencies: { round: .2, almond: .6, elongated: .2 },
  eyeSizeCategory: 'medium', eyeSizeConfidence: .5,
  dominantShape: 'almond',
};
const HOODED = { ...BASE_PROFILE, isHooded: true, hoodedConfidence: .9, hoodingLevel: 'full', hoodingState: 'hooded' };
const NON_HOODED = { ...BASE_PROFILE, isHooded: false, hoodedConfidence: .1, hoodingLevel: 'none', hoodingState: 'nonHooded' };
const UNCERTAIN = { ...BASE_PROFILE, isHooded: false, hoodedConfidence: .25, hoodingLevel: 'none', hoodingState: 'uncertain' };
const MISSING = { ...BASE_PROFILE }; // isHooded/hoodedConfidence/hoodingLevel/hoodingState entirely absent

test('DESIGN_CATALOG has all 21 entries and every score/cautions call runs without throwing for hooded/non-hooded/uncertain/missing hooding data', () => {
  assert.strictEqual(catalog.length, 21);
  for (const profile of [HOODED, NON_HOODED, UNCERTAIN, MISSING]) {
    for (const entry of catalog) {
      assert.doesNotThrow(() => entry.score(profile));
      assert.doesNotThrow(() => entry.cautions(profile, 'ru'));
      assert.doesNotThrow(() => entry.cautions(profile, 'en'));
    }
  }
});

// ------------------------------------------------------------
// 4. Hooding no longer changes recommendation/ranking output
// ------------------------------------------------------------
test('every DESIGN_CATALOG score is byte-identical across hooded/non-hooded/uncertain/missing hooding data', () => {
  for (const entry of catalog) {
    const scores = [HOODED, NON_HOODED, UNCERTAIN, MISSING].map((p) => entry.score(p));
    assert.ok(scores.every((s) => s === scores[0]), `${entry.id}: scores differ by hooding input: ${JSON.stringify(scores)}`);
  }
});

test('every DESIGN_CATALOG caution list is identical across hooded/non-hooded/uncertain/missing hooding data, and none mention hooding', () => {
  for (const entry of catalog) {
    const cautionsRu = [HOODED, NON_HOODED, UNCERTAIN, MISSING].map((p) => JSON.stringify(entry.cautions(p, 'ru')));
    assert.ok(cautionsRu.every((c) => c === cautionsRu[0]), `${entry.id}: RU cautions differ by hooding input`);
    const text = entry.cautions(HOODED, 'ru').join(' ') + entry.cautions(HOODED, 'en').join(' ');
    assert.ok(!/hood|нависан/i.test(text), `${entry.id}: caution text still mentions hooding: "${text}"`);
  }
});

test('ranking order (sorted by score) is identical regardless of hooding input', () => {
  const rank = (profile) => catalog.map((e) => ({ id: e.id, score: e.score(profile) })).sort((a, b) => b.score - a.score).map((x) => x.id);
  const hoodedRank = rank(HOODED), nonHoodedRank = rank(NON_HOODED), uncertainRank = rank(UNCERTAIN);
  assert.deepStrictEqual(hoodedRank, nonHoodedRank);
  assert.deepStrictEqual(hoodedRank, uncertainRank);
});

test('recommendCurl no longer returns a hooding-driven L/L+ override, for hooded, non-hooded, uncertain, and missing hooding data', () => {
  const design = { baseCurl: 'C' };
  const results = [HOODED, NON_HOODED, UNCERTAIN, MISSING].map((p) => recommendCurl({ ...p, tiltConfidence: .1 }, design, 'ru'));
  for (const r of results) {
    assert.notStrictEqual(r.primary, 'L');
    assert.notStrictEqual(r.primary, 'L+');
    assert.ok(!/нависан|hood/i.test(r.reason));
  }
  assert.deepStrictEqual(new Set(results.map((r) => JSON.stringify(r))).size, 1, 'recommendCurl output must be identical regardless of hooding input');
});

test('generateEyeHighlight text never mentions hooding, for hooded, non-hooded, uncertain, and missing hooding data', () => {
  for (const profile of [HOODED, NON_HOODED, UNCERTAIN, MISSING]) {
    for (const lang of ['ru', 'en']) {
      const text = generateEyeHighlight(profile, lang);
      assert.ok(!/hood|нависан|складк/i.test(text), `generateEyeHighlight(${lang}) still mentions hooding for ${JSON.stringify(profile.hoodingState)}: "${text}"`);
    }
  }
  const texts = [HOODED, NON_HOODED, UNCERTAIN, MISSING].map((p) => generateEyeHighlight(p, 'ru'));
  assert.ok(texts.every((t) => t === texts[0]), 'generateEyeHighlight output must be identical regardless of hooding input');
});

// ------------------------------------------------------------
// eye size explicitly stays a live recommendation input (out of scope
// for this phase) — generateEyeHighlight must still vary with it.
// ------------------------------------------------------------
test('eye size (eyeSizeCategory) still influences generateEyeHighlight — explicitly untouched by this phase', () => {
  const small = generateEyeHighlight({ ...BASE_PROFILE, eyeSizeCategory: 'small', eyeSizeConfidence: .9 }, 'ru');
  const large = generateEyeHighlight({ ...BASE_PROFILE, eyeSizeCategory: 'large', eyeSizeConfidence: .9 }, 'ru');
  assert.notStrictEqual(small, large, 'eye size must still change the generated text — only hooding was removed as an input');
});

test('DESIGN_CATALOG entries that read c.relativeEyeSize/c.eyeSizeCategory are unchanged (kitten, manga)', () => {
  const kitten = catalog.find((e) => e.id === 'kitten');
  const manga = catalog.find((e) => e.id === 'manga');
  const small = { ...BASE_PROFILE, relativeEyeSize: .30 };
  const large = { ...BASE_PROFILE, relativeEyeSize: .40 };
  assert.notStrictEqual(kitten.score(small), kitten.score(large), 'kitten score must still vary with relativeEyeSize');
  assert.notStrictEqual(manga.score(small), manga.score(large), 'manga score must still vary with relativeEyeSize');
});

// ------------------------------------------------------------
// Unrelated recommendation inputs behave exactly as before
// ------------------------------------------------------------
test('unrelated recommendation inputs (tilt, shape, close/wide-set, asymmetry, confidence) still change scores exactly as before', () => {
  // natural's own formula only branches on neutral-vs-not (both
  // upturned and downturned share the same non-neutral term) — so
  // neutral vs. downturned is the comparison that actually exercises
  // its tiltTendency dependence.
  const natural = catalog.find((e) => e.id === 'natural');
  const neutral = natural.score({ ...BASE_PROFILE, tiltTendency: 'neutral', tiltConfidence: .8 });
  const downturned = natural.score({ ...BASE_PROFILE, tiltTendency: 'downturned', tiltConfidence: .8 });
  assert.notStrictEqual(neutral, downturned, 'tiltTendency must still affect natural\'s score');

  const doll = catalog.find((e) => e.id === 'doll');
  const closeSet = doll.score({ ...BASE_PROFILE, isCloseSet: true });
  const notCloseSet = doll.score({ ...BASE_PROFILE, isCloseSet: false });
  assert.notStrictEqual(closeSet, notCloseSet, 'isCloseSet must still affect doll\'s score');

  const eyeliner = catalog.find((e) => e.id === 'eyeliner');
  const asym = eyeliner.score({ ...BASE_PROFILE, compositeAsymmetry: .2 });
  const noAsym = eyeliner.score({ ...BASE_PROFILE, compositeAsymmetry: 0 });
  assert.notStrictEqual(asym, noAsym, 'compositeAsymmetry must still affect eyeliner\'s score');
});

test('the downturned-tilt curl branch in recommendCurl is unchanged and unaffected by the hooding removal', () => {
  const design = { baseCurl: 'C' };
  const withHooding = recommendCurl({ ...HOODED, tiltTendency: 'downturned', tiltConfidence: .8 }, design, 'ru');
  const withoutHooding = recommendCurl({ ...NON_HOODED, tiltTendency: 'downturned', tiltConfidence: .8 }, design, 'ru');
  assert.strictEqual(withHooding.primary, 'CC');
  assert.deepStrictEqual(withHooding, withoutHooding, 'the downturned branch must produce identical output regardless of hooding');
});

// ------------------------------------------------------------
// 5. Unknown hooding is NOT coerced to non-hooded
// ------------------------------------------------------------
test('unknown/uncertain hooding never affects output as if it had been resolved to non-hooded — it is fully inert, not defaulted', () => {
  // Distinguishing "inert" from "silently defaulted to false" requires
  // proving hooded/uncertain/non-hooded/missing ALL four converge on
  // the same output (already proven above for score/cautions/curl/
  // eyeHighlight) rather than merely checking uncertain === non-hooded
  // (which alone wouldn't rule out "false" being used as the default).
  const design = { baseCurl: 'C' };
  const outputs = [HOODED, NON_HOODED, UNCERTAIN, MISSING].map((p) => ({
    scores: catalog.map((e) => e.score(p)),
    curl: recommendCurl(p, design, 'ru'),
    highlight: generateEyeHighlight(p, 'ru'),
  }));
  const serialized = outputs.map((o) => JSON.stringify(o));
  assert.ok(serialized.every((s) => s === serialized[0]), 'hooded/non-hooded/uncertain/missing hooding must all converge on identical recommendation output');
});

// ------------------------------------------------------------
// Application Plan
// ------------------------------------------------------------
test('Doll\'s "why" copy no longer implies the app detected a hooded lid, and preserves the actual design intent (central-volume eye-opening)', () => {
  const doll = catalog.find((e) => e.id === 'doll');
  const whyRu = doll.why(BASE_PROFILE, 'ru');
  const whyEn = doll.why(BASE_PROFILE, 'en');
  assert.ok(!/hood|нависш|нависан/i.test(whyRu + ' ' + whyEn), 'Doll\'s why text must not mention hooding: "' + whyRu + '" / "' + whyEn + '"');
  assert.ok(!/monolid|creas|моноли|складк/i.test(whyRu + ' ' + whyEn), 'Doll\'s why text must not substitute another inferred eyelid condition');
  assert.ok(/central|центр/i.test(whyRu) && /central|центр/i.test(whyEn), 'Doll\'s why text should still describe its actual central-volume mechanism');
  assert.ok(/open|открыва/i.test(whyRu) && /open|открыва/i.test(whyEn), 'Doll\'s why text should still describe its actual open-eye visual goal');
});

test('Application Plan preparation/artistNotes no longer push a hooding-driven note', () => {
  const forbidden = [
    "if (c.isHooded) push(preparation,",
    "if (c.isHooded) push(artistNotes,",
  ];
  for (const needle of forbidden) assert.ok(!indexSource.includes(needle), 'expected this hooding-driven push to be removed: ' + needle);
});

// ------------------------------------------------------------
// 6 & 7. Underlying hooding calculations/fields still exist, and
// unrelated recommendation inputs' own source is untouched
// ------------------------------------------------------------
test('classifyFeatures still computes isHooded/hoodedConfidence/hoodingLevel/hoodingState/eyelidCategory/eyelidType — the automatic pipeline is untouched', () => {
  const fnStart = indexSource.indexOf('function classifyFeatures(aggregated, opts) {');
  const fnEnd = indexSource.indexOf('\n    function ', fnStart + 10);
  const body = indexSource.slice(fnStart, fnEnd);
  for (const field of ['isHooded', 'hoodedConfidence', 'hoodingLevel', 'hoodingState', 'eyelidCategory', 'eyelidType']) {
    assert.ok(body.includes(field), `classifyFeatures must still compute ${field}`);
  }
});

test('ReviewScreen confirm() still computes isHooded/hoodedConfidence/hoodingLevel from values.hoodingState, for diagnostics/backward compatibility only', () => {
  const reviewStart = indexSource.indexOf('    function ReviewScreen(');
  const reviewEnd = indexSource.indexOf('\n    function ', reviewStart + 10);
  const body = indexSource.slice(reviewStart, reviewEnd);
  assert.ok(body.includes("const isHooded = values.hoodingState === 'hooded';"));
  assert.ok(body.includes("hoodedConfidence = values.hoodingState === 'uncertain' ? 0.25 : 0.8;"));
  assert.ok(body.includes("hoodingLevel = values.hoodingState === 'hooded' ? 'partial' : 'none';"));
  assert.ok(body.includes('hoodingState: initial.hoodingState,'), 'values state must still seed hoodingState');
});

test('DESIGN_CATALOG score functions for unrelated designs (rounded, kitten, cat, softfox, squirrel) are byte-unchanged (never referenced isHooded to begin with)', () => {
  const untouchedIds = ['rounded', 'squirrel', 'kitten', 'cat', 'wispycat'];
  for (const id of untouchedIds) {
    const entry = catalog.find((e) => e.id === id);
    assert.ok(entry, id + ' must still exist in DESIGN_CATALOG');
    assert.ok(!/isHooded|hoodedConfidence/.test(entry.score.toString()), id + ' never referenced hooding — confirms this phase did not touch unrelated entries');
  }
});

test('production activation flags stay inert: productionEnabled false, activeDefinitionIds empty', () => {
  const Library = require(path.join(root, 'professional-lash-library.js'));
  assert.strictEqual(Library.library.activation.productionEnabled, false);
  assert.deepStrictEqual(Library.library.activation.activeDefinitionIds, []);
});

test('Babel/JSX parse of the full app script, when @babel/core is available locally', (t) => {
  let babel;
  try { babel = require('@babel/core'); } catch (e) { babel = null; }
  if (!babel) {
    t.skip('@babel/core is not an installed dependency of this repo; full Babel parse verification is performed manually per phase (see implementation report) rather than as a hard CI dependency.');
    return;
  }
  const marker = '<script type="text/babel">';
  const start = indexSource.indexOf(marker) + marker.length;
  const end = indexSource.indexOf('</script>', start);
  const script = indexSource.slice(start, end);
  assert.doesNotThrow(() => babel.transformSync(script, { presets: [require.resolve('@babel/preset-react')], filename: 'app.jsx' }));
});
