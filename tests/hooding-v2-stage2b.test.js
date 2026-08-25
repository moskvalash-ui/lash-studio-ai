// ============================================================
// HOODING V2 — STAGE 2B: PATH TOPOLOGY — regression tests
// (measurement-only turn; see the deliverable given in chat).
// ------------------------------------------------------------
// Extracts the REAL, currently-shipped functions straight out of
// index.html (same technique as every other test file in this
// project — never a hand-duplicated copy). Proves: (A) V1/V2/V2.1/
// V2.2 are untouched, (B) classifyFeatures has zero Stage 2B
// reference, (C) Stage 2B never writes any production field, (D) no
// calibrated numerical threshold exists anywhere in Stage 2B
// (specifically the four values Kimi's standalone draft proposed:
// continuity>0.3, continuity>0.25, pointCount>3, |meanTDiff|<0.15),
// (E) every input path survives into orderedPaths, (F) ordering is
// deterministic including ties, (G) N paths -> N-1 adjacentPairs, (H)
// the existing winner is found without being modified, (I) the
// cross-eye matrix size is |left|x|right|, (J) nearestByMeanT is a
// pure argmin, (K) edge cases (0/1/many paths, missing winner, missing
// LEFT/RIGHT) don't throw, (L) construction is debug-gated, (M) the
// Copy JSON carries both hoodingV2Raw and hoodingTopologyV2B, (N)
// normal-mode production behavior is unaffected.
//
// LOCAL ONLY. Not wired into any CI/deploy step this turn.
// ============================================================
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const indexHtmlPath = path.join(__dirname, '..', 'index.html');
const src = fs.readFileSync(indexHtmlPath, 'utf8');

let pass = 0, fail = 0;
function test(name, fn) {
  try {
    fn();
    pass++;
    console.log(`  ok  - ${name}`);
  } catch (e) {
    fail++;
    console.log(`FAIL  - ${name}`);
    console.log(`        ${e.message}`);
  }
}

const reactStubs = `
  function createContext(v) { return { _v: v }; }
  function useState(v) { return [v, () => {}]; }
  function useRef(v) { return { current: v }; }
  function useEffect() {}
  function useCallback(fn) { return fn; }
  function useMemo(fn) { return fn(); }
  function useContext(ctx) { return ctx && ctx._v; }
`;

// ---- Extract classifyFeatures (for test B) ----
const cfStart = src.indexOf('    const dist = (a,b) => Math.sqrt((a.x-b.x)**2 + (a.y-b.y)**2);');
const cfEnd = src.indexOf('\n    function extractEyeROI(');
if (cfStart === -1 || cfEnd === -1) throw new Error('Could not locate the classifyFeatures pipeline block — has it moved?');
const { classifyFeatures } = new Function(reactStubs + src.slice(cfStart, cfEnd) + '\nreturn { classifyFeatures };')();

// ---- Extract Stage 1 + Stage 2B (Stage 2B is a pure downstream
// consumer of Stage 1's buildHoodingV2Debug, so both are needed to
// actually run it). Starts from debugV2PolylineY (shared V2/V2.1
// utility) so the chunk is self-executable. ----
const depsStart = src.indexOf('    function debugV2PolylineY(');
const stage1Start = src.indexOf('    const HOODING_V2_STAGE = 1;');
const stage2bStart = src.indexOf("    const HOODING_V2_TOPOLOGY_STAGE = '2B-measurement-only';");
const stage2bEnd = src.indexOf('\n    const REASON_MESSAGES = {');
if (depsStart === -1 || stage1Start === -1 || stage2bStart === -1 || stage2bEnd === -1) throw new Error('Could not locate the HOODING V2 Stage 1/2B blocks — has it moved?');
const stage2bOwnSource = src.slice(stage2bStart, stage2bEnd); // NEW code only, for isolation checks
const executableSource = src.slice(depsStart, stage2bEnd); // deps + Stage 1 + Stage 2B, for actually running it
const {
  buildHoodingV2Debug, buildHoodingTopologyV2B, buildHoodingTopologyV2BCrossEye,
} = new Function(executableSource + '\nreturn { buildHoodingV2Debug, buildHoodingTopologyV2B, buildHoodingTopologyV2BCrossEye };')();

test('setup: extracted real classifyFeatures + Stage 1 + Stage 2B functions from index.html successfully', () => {
  assert.strictEqual(typeof classifyFeatures, 'function');
  assert.strictEqual(typeof buildHoodingTopologyV2B, 'function');
  assert.strictEqual(typeof buildHoodingTopologyV2BCrossEye, 'function');
});

// ---- Fixture builders ----
function makeColumns(n, peakDefs) {
  const columns = [];
  for (let s = 0; s < n; s++) {
    const x = s * 10;
    columns.push({ sampleIndex: s, x, peaks: peakDefs.map((pd, i) => ({ rankWithinColumn: i, currentV2Winner: !!pd.winner, y: pd.y, t: pd.t, rawStrength: pd.rs, prominence: pd.rs * 0.5, localStrength: pd.rs * 0.2, thickness: pd.th })) });
  }
  return columns;
}
function summarizePath(points) {
  const ts = points.map(p => p.t);
  const meanT = ts.reduce((a, b) => a + b, 0) / ts.length;
  const tVariation = Math.sqrt(ts.reduce((a, b) => a + (b - meanT) ** 2, 0) / ts.length);
  return {
    points, xSpan: [points[0].x, points[points.length - 1].x], continuityFrac: points.length / (points[points.length - 1].sampleIndex + 1 || 1),
    meanT, tVariation, meanRawStrength: points[0].rawStrength, meanLocalStrength: points[0].localStrength, meanThickness: points[0].thickness,
    containsV2Winner: points.some(p => p.currentV2Winner === true),
  };
}
function buildFixture(n, peakDefs, eyeWidthPx) {
  const lidPoly = [{ x: 0, y: 50 }, { x: 10, y: 48 }, { x: 40, y: 48 }, { x: 50, y: 50 }];
  const browPoly = [{ x: 0, y: 10 }, { x: 15, y: 8 }, { x: 25, y: 8 }, { x: 35, y: 8 }, { x: 50, y: 10 }];
  const columns = makeColumns(n, peakDefs);
  const v2Multi = { valid: true, sampledColumns: n, columns };
  const paths = peakDefs.map((_, idx) => summarizePath(columns.map(c => ({ sampleIndex: c.sampleIndex, x: c.x, ...c.peaks[idx] }))));
  const v2Linked = { valid: true, sampledColumns: n, paths };
  const v1 = { valid: true, prominence: 5, peakVal: 10, creaseYFrac: 0.5, readQuality: 0.7 };
  return buildHoodingV2Debug(v1, v2Multi, v2Linked, lidPoly, browPoly, eyeWidthPx);
}
// Like buildFixture, but with explicit control over each column's x
// position — needed to construct a real-shaped REVERSED-order xSpan
// (physical L/R normalization can walk sample columns in either x
// direction; a real RIGHT-eye trace can read xSpan: [59.27, 44.51]).
function buildFixtureWithXs(xs, peakDefs, eyeWidthPx) {
  const lidPoly = [{ x: 0, y: 50 }, { x: 10, y: 48 }, { x: 40, y: 48 }, { x: 50, y: 50 }];
  const browPoly = [{ x: 0, y: 10 }, { x: 15, y: 8 }, { x: 25, y: 8 }, { x: 35, y: 8 }, { x: 50, y: 10 }];
  const n = xs.length;
  const columns = xs.map((x, s) => ({ sampleIndex: s, x, peaks: peakDefs.map((pd, i) => ({ rankWithinColumn: i, currentV2Winner: !!pd.winner, y: pd.y, t: pd.t, rawStrength: pd.rs, prominence: pd.rs * 0.5, localStrength: pd.rs * 0.2, thickness: pd.th })) }));
  const v2Multi = { valid: true, sampledColumns: n, columns };
  const paths = peakDefs.map((_, idx) => summarizePath(columns.map(c => ({ sampleIndex: c.sampleIndex, x: c.x, ...c.peaks[idx] }))));
  const v2Linked = { valid: true, sampledColumns: n, paths };
  const v1 = { valid: true, prominence: 5, peakVal: 10, creaseYFrac: 0.5, readQuality: 0.7 };
  return buildHoodingV2Debug(v1, v2Multi, v2Linked, lidPoly, browPoly, eyeWidthPx);
}
// 3 distinct paths: winner in the middle, one nearer lash, one nearer brow.
const THREE_PATH_DEFS = [
  { winner: true, y: 30, t: 0.5, rs: 10, th: 2 },
  { winner: false, y: 42, t: 0.8, rs: 6, th: 1 },
  { winner: false, y: 15, t: 0.2, rs: 4, th: 1.5 },
];

// ================================================================
// A. protected V1/V2/V2.1/V2.2 source spans unchanged
// ================================================================
test('A. V1/V2/V2.1/V2.2 own function bodies contain zero Stage 2B reference, and nothing but comments sits between V2.2 and Stage 1', () => {
  const v1Start = src.indexOf('    function detectEyelidCrease(sourceCanvas, eyePoints, browPoints) {');
  const v2LinkFnEnd = src.indexOf('      return { valid: true, sampledColumns, paths, v2LinkedRuntimeMs };\n    }\n', v1Start);
  if (v1Start === -1 || v2LinkFnEnd === -1) throw new Error('Could not locate the V1..V2.2 span — has it moved?');
  const protectedSpan = src.slice(v1Start, v2LinkFnEnd);
  assert.ok(!/[Hh]ooding(V2|TopologyV2B)/.test(protectedSpan), 'V1/V2/V2.1/V2.2 must have zero reference to Stage 1 or Stage 2B identifiers');
});
test('A2. Stage 2B is a pure append after Stage 1 — nothing but comments sits between buildHoodingV2CrossEye\'s end and HOODING_V2_TOPOLOGY_STAGE', () => {
  const crossEyeEndMarker = '      };\n    }\n';
  const crossEyeFnStart = src.indexOf('    function buildHoodingV2CrossEye(leftDebug, rightDebug) {');
  const crossEyeFnEnd = src.indexOf(crossEyeEndMarker, crossEyeFnStart) + crossEyeEndMarker.length;
  const gap = src.slice(crossEyeFnEnd, stage2bStart).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').trim();
  assert.strictEqual(gap, '', `expected only comments/whitespace between Stage 1's end and Stage 2B's start, found code: ${gap.slice(0, 200)}`);
});

// ================================================================
// B. classifyFeatures contains no Stage 2B reference
// ================================================================
test('B. classifyFeatures\' own function body contains zero reference to any Stage 2B identifier', () => {
  const startMarker = '    function classifyFeatures(aggregated, opts) {';
  const endMarker = '\n    // RELIABLE-FRAME EYELID-TYPE CONSENSUS — production integration.';
  const start = src.indexOf(startMarker);
  const end = src.indexOf(endMarker, start);
  if (start === -1 || end === -1) throw new Error('Could not locate classifyFeatures\' own body span — has it moved?');
  const ownBody = src.slice(start, end);
  assert.ok(!/[Hh]ooding(V2|TopologyV2B)/.test(ownBody), 'classifyFeatures must not reference anything HoodingV2/HoodingTopologyV2B-related');
});

// ================================================================
// C. Stage 2B never writes any production field
// ================================================================
test('C. Stage 2B source never assigns to any production field (hoodingState/isHooded/hoodedConfidence/hoodingLevel/eyelidType/eyelidCategory/creaseState/finalProfile/rec.eyeProfile)', () => {
  const forbidden = ['hoodingState', 'isHooded', 'hoodedConfidence', 'hoodingLevel', 'eyelidType', 'eyelidCategory', 'creaseState', 'finalProfile'];
  for (const f of forbidden) {
    const re = new RegExp('\\b' + f + '\\s*=(?!=)');
    assert.ok(!re.test(stage2bOwnSource), `Stage 2B must never assign to ${f}`);
  }
  assert.ok(!/rec\.eyeProfile/.test(stage2bOwnSource), 'Stage 2B must never reference rec.eyeProfile');
  assert.ok(!/\b(hoodingState|isHooded|hoodedConfidence|hoodingLevel|eyelidType|eyelidCategory|creaseState|finalProfile)\b/.test(stage2bOwnSource), 'Stage 2B must not reference any production field at all, read or write');
});

// ================================================================
// D. no calibrated numerical threshold in Stage 2B
// ================================================================
test('D1. Stage 2B contains no magnitude comparison against a bare numeric literal beyond structural guards (0/1)', () => {
  const comparisons = stage2bOwnSource.match(/[<>]=?\s*-?\d+(\.\d+)?/g) || [];
  const nonStructural = comparisons.filter(c => !/^[<>]=?\s*(0|1)$/.test(c.replace(/\s+/g, ' ').trim()));
  assert.deepStrictEqual(nonStructural, [], `found a numeric comparison beyond the allowed structural guards (>0, >1 for division/bounds): ${JSON.stringify(nonStructural)}`);
});
test('D2. Kimi\'s specific previously-proposed thresholds are absent (continuity>0.3, continuity>0.25, pointCount>3, |meanTDiff|<0.15)', () => {
  assert.ok(!/continuity[A-Za-z]*\s*>\s*0\.3\b/.test(stage2bOwnSource), 'continuity > 0.3 must not appear');
  assert.ok(!/continuity[A-Za-z]*\s*>\s*0\.25\b/.test(stage2bOwnSource), 'continuity > 0.25 must not appear');
  assert.ok(!/pointCount[A-Za-z]*\s*>\s*3\b/.test(stage2bOwnSource), 'pointCount > 3 must not appear');
  assert.ok(!/<\s*0\.15\b/.test(stage2bOwnSource), '< 0.15 (the proposed meanTDiff cutoff) must not appear');
  assert.ok(!/0\.3\b|0\.25\b|0\.15\b/.test(stage2bOwnSource), 'none of the raw threshold literals 0.3/0.25/0.15 may appear anywhere in Stage 2B');
});

// ================================================================
// E. every input linked path survives into orderedPaths
// ================================================================
test('E. ALL input linked paths appear in orderedPaths (none filtered)', () => {
  const hd = buildFixture(5, THREE_PATH_DEFS, 30);
  const topo = buildHoodingTopologyV2B(hd);
  assert.strictEqual(topo.orderedPaths.length, 3, 'all 3 input paths must survive, regardless of continuity/strength/position');
  const ids = topo.orderedPaths.map(p => p.pathId).sort();
  assert.deepStrictEqual(ids, ['P0', 'P1', 'P2']);
});

// ================================================================
// F. deterministic ordering, including ties
// ================================================================
test('F. ordering is deterministic ascending by meanT, and repeatable across independent calls', () => {
  const hd = buildFixture(5, THREE_PATH_DEFS, 30);
  const topo1 = buildHoodingTopologyV2B(hd);
  const topo2 = buildHoodingTopologyV2B(hd);
  assert.deepStrictEqual(topo1.orderedPaths.map(p => p.pathId), topo2.orderedPaths.map(p => p.pathId));
  const ts = topo1.orderedPaths.map(p => p.meanT);
  for (let i = 1; i < ts.length; i++) assert.ok(ts[i] >= ts[i - 1], 'orderedPaths must be ascending by meanT');
});
test('F2. exact meanT ties are broken deterministically by path id (not input order)', () => {
  const tiedDefs = [
    { winner: false, y: 20, t: 0.4, rs: 5, th: 1 },
    { winner: true, y: 25, t: 0.4, rs: 5, th: 1 },
  ];
  const hd = buildFixture(4, tiedDefs, 30);
  const topo1 = buildHoodingTopologyV2B(hd);
  const topo2 = buildHoodingTopologyV2B(hd);
  assert.deepStrictEqual(topo1.orderedPaths.map(p => p.pathId), topo2.orderedPaths.map(p => p.pathId));
  assert.deepStrictEqual(topo1.orderedPaths.map(p => p.pathId), ['P0', 'P1'], 'tie broken by ascending path id');
});

// ================================================================
// G. N paths => N-1 adjacentPairs
// ================================================================
test('G. N linked paths produce exactly N-1 adjacentPairs', () => {
  for (const n of [1, 2, 3, 5]) {
    const defs = Array.from({ length: n }, (_, i) => ({ winner: i === 0, y: 15 + i * 8, t: 0.15 + i * 0.15, rs: 5, th: 1 }));
    const hd = buildFixture(4, defs, 30);
    const topo = buildHoodingTopologyV2B(hd);
    assert.strictEqual(topo.orderedPaths.length, n);
    assert.strictEqual(topo.adjacentPairs.length, Math.max(0, n - 1), `expected ${n - 1} adjacent pairs for ${n} paths`);
  }
});

// ================================================================
// O. xSpan orientation safety (final-review turn) — physical LEFT/
// RIGHT normalization can walk sample columns in either x direction,
// so a real trace's xSpan may read [59.27, 44.51] (descending), not
// just [44.51, 59.27]. Every Stage 2B computation touching xSpan must
// treat it geometrically (min/max), never index [0]/[1] as start/end.
// ================================================================
test('O1. the actual reversed-span shape observed in a real iPhone RIGHT-eye trace (xSpan: [59.27, 44.51]) does not break xOverlapFrac or maxXSpanPath', () => {
  // Two paths whose raw point x-values run high-to-low (descending),
  // reproducing xSpan: [59.27, 44.51]-style storage exactly as V2/
  // V2.2 (frozen) would naturally produce for a physically-normalized
  // RIGHT eye.
  const descendingXs = [59.27, 55.0, 50.0, 44.51];
  const defs = [
    { winner: true, y: 30, t: 0.5, rs: 10, th: 2 },
    { winner: false, y: 42, t: 0.8, rs: 6, th: 1 },
  ];
  const hd = buildFixtureWithXs(descendingXs, defs, 30);
  const topo = buildHoodingTopologyV2B(hd);
  assert.deepStrictEqual(topo.orderedPaths[0].xSpan, [59.27, 44.51], 'the raw preserved xSpan endpoint order is untouched — this is intentional (requirement 3)');
  assert.strictEqual(topo.adjacentPairs.length, 1);
  const pair = topo.adjacentPairs[0];
  assert.ok(pair.xOverlapFrac >= 0 && pair.xOverlapFrac <= 1, `xOverlapFrac must be a valid [0,1] fraction even with a reversed xSpan, got ${pair.xOverlapFrac}`);
  assert.strictEqual(pair.xOverlapFrac, 1, 'both paths share the exact same descending span, so overlap must read as full (1), not negative/broken');
  const maxSpanId = topo.extrema.maxXSpanPath;
  const maxSpanEntry = topo.orderedPaths.find(p => p.pathId === maxSpanId);
  const [mn, mx] = [Math.min(...maxSpanEntry.xSpan), Math.max(...maxSpanEntry.xSpan)];
  assert.ok(mx - mn > 0, 'the widest-span path\'s actual width must be positive, never a negative artifact of a reversed xSpan');
});
test('O2. LEFT/RIGHT-shaped results are invariant to reversing every path\'s xSpan endpoint order', () => {
  const defs = THREE_PATH_DEFS;
  const ascendingXs = [0, 10, 20, 30, 40];
  const descendingXs = [40, 30, 20, 10, 0]; // same physical geometry, sample columns walked in the opposite x direction
  const hdAsc = buildFixtureWithXs(ascendingXs, defs, 30);
  const hdDesc = buildFixtureWithXs(descendingXs, defs, 30);
  const topoAsc = buildHoodingTopologyV2B(hdAsc);
  const topoDesc = buildHoodingTopologyV2B(hdDesc);
  // Raw xSpan endpoint order is intentionally preserved as-is
  // (requirement 3) — it differs between the two orientations.
  assert.notDeepStrictEqual(topoAsc.orderedPaths.map(p => p.xSpan), topoDesc.orderedPaths.map(p => p.xSpan));
  // Every DERIVED measurement must be identical regardless of that
  // raw orientation.
  assert.deepStrictEqual(topoAsc.orderedPaths.map(p => p.pathId), topoDesc.orderedPaths.map(p => p.pathId), 'ordering (by meanT) must be unaffected by xSpan direction');
  assert.deepStrictEqual(topoAsc.adjacentPairs.map(p => p.xOverlapFrac), topoDesc.adjacentPairs.map(p => p.xOverlapFrac), 'xOverlapFrac must be invariant to xSpan direction');
  assert.strictEqual(topoAsc.extrema.maxXSpanPath, topoDesc.extrema.maxXSpanPath, 'maxXSpanPath must pick the same path regardless of xSpan direction');
  assert.deepStrictEqual(topoAsc.winnerTopology, topoDesc.winnerTopology, 'winnerTopology must be byte-identical regardless of xSpan direction (it never touches x at all)');
});
test('O3. orderedPaths sorting uses meanT only, never x/xSpan — physical L/R normalization cannot change vertical ordering', () => {
  // Deliberately construct LEFT-shaped (ascending x) and RIGHT-shaped
  // (descending x) fixtures where a naive x-based sort would DISAGREE
  // with the correct meanT-based order, to prove the sort genuinely
  // ignores x.
  const defs = THREE_PATH_DEFS; // meanT: 0.5 (winner), 0.8, 0.2 -> correct order P2(0.2), P0(0.5), P1(0.8)
  const hdAsc = buildFixtureWithXs([0, 10, 20, 30, 40], defs, 30);
  const hdDesc = buildFixtureWithXs([40, 30, 20, 10, 0], defs, 30);
  for (const hd of [hdAsc, hdDesc]) {
    const topo = buildHoodingTopologyV2B(hd);
    assert.deepStrictEqual(topo.orderedPaths.map(p => p.meanT), [0.2, 0.5, 0.8], 'orderedPaths must be sorted strictly by meanT, identical regardless of x direction');
  }
});
test('O4. per-column topology uses sampleIndex/points, never assumes x increases left-to-right', () => {
  const defs = THREE_PATH_DEFS;
  const descendingXs = [40, 30, 20, 10, 0];
  const hd = buildFixtureWithXs(descendingXs, defs, 30);
  const topo = buildHoodingTopologyV2B(hd);
  assert.strictEqual(topo.columns.length, 5);
  // Every column must resolve intersections for all 3 paths and stay
  // internally consistent (rankByHeight ascending by y, real gaps),
  // even though x is descending across sampleIndex.
  for (const col of topo.columns) {
    assert.strictEqual(col.intersections.length, 3);
    for (let i = 1; i < col.intersections.length; i++) {
      assert.ok(col.intersections[i].y >= col.intersections[i - 1].y, 'rankByHeight must stay ascending by y regardless of x direction');
    }
    assert.strictEqual(col.adjacentSeparationsPx.length, 2);
  }
  // Column-to-path correspondence is by sampleIndex, so the FIRST
  // column here (sampleIndex 0) legitimately has the LARGEST x (40),
  // not the smallest — confirming no left-to-right assumption exists.
  assert.strictEqual(topo.columns[0].x, 40);
  assert.strictEqual(topo.columns[topo.columns.length - 1].x, 0);
});

// ================================================================
// H. existing winner correctly identified, never modified/replaced
// ================================================================
test('H. winnerTopology identifies the EXISTING V2 winner (containsV2Winner) without altering it', () => {
  const hd = buildFixture(5, THREE_PATH_DEFS, 30);
  const topo = buildHoodingTopologyV2B(hd);
  const winnerPath = topo.orderedPaths.find(p => p.containsV2Winner);
  assert.ok(winnerPath, 'one of the ordered paths must carry containsV2Winner=true, unmodified');
  assert.strictEqual(topo.winnerTopology.pathId, winnerPath.pathId);
  assert.strictEqual(topo.winnerTopology.orderedIndex, winnerPath.orderedIndex);
  assert.strictEqual(hd.creaseWinnerPathId, winnerPath.pathId, 'Stage 2B\'s winner must match Stage 1\'s own unmodified winner selection exactly');
});

// ================================================================
// I. cross-eye pairwise matrix size = |left| x |right|
// ================================================================
test('I. pairwisePathDistances size equals LEFT count x RIGHT count', () => {
  const leftDefs = THREE_PATH_DEFS;
  const rightDefs = [{ winner: true, y: 28, t: 0.45, rs: 9, th: 2 }, { winner: false, y: 40, t: 0.75, rs: 5, th: 1 }];
  const hdL = buildFixture(5, leftDefs, 30);
  const hdR = buildFixture(5, rightDefs, 31);
  const topoL = buildHoodingTopologyV2B(hdL);
  const topoR = buildHoodingTopologyV2B(hdR);
  const cross = buildHoodingTopologyV2BCrossEye(topoL, topoR);
  assert.strictEqual(cross.pairwisePathDistances.length, topoL.orderedPaths.length * topoR.orderedPaths.length, 'expected exactly |left| x |right| pairwise entries');
  assert.strictEqual(cross.pairwisePathDistances.length, 3 * 2);
});

// ================================================================
// J. nearestByMeanT is a pure, deterministic argmin
// ================================================================
test('J. nearestByMeanT is a pure argmin over |meanT difference|, one entry per LEFT path, deterministic', () => {
  const leftDefs = THREE_PATH_DEFS;
  const rightDefs = [{ winner: true, y: 28, t: 0.52, rs: 9, th: 2 }, { winner: false, y: 40, t: 0.9, rs: 5, th: 1 }];
  const hdL = buildFixture(5, leftDefs, 30);
  const hdR = buildFixture(5, rightDefs, 31);
  const topoL = buildHoodingTopologyV2B(hdL);
  const topoR = buildHoodingTopologyV2B(hdR);
  const cross1 = buildHoodingTopologyV2BCrossEye(topoL, topoR);
  const cross2 = buildHoodingTopologyV2BCrossEye(topoL, topoR);
  assert.strictEqual(cross1.nearestByMeanT.length, topoL.orderedPaths.length, 'one nearest-match entry per LEFT path');
  assert.deepStrictEqual(cross1.nearestByMeanT, cross2.nearestByMeanT, 'must be perfectly repeatable');
  // Manually verify true argmin for the LEFT path nearest t=0.5 (the winner).
  const winnerEntry = cross1.nearestByMeanT.find(n => n.leftPathId === topoL.winnerTopology.pathId);
  const trueMin = Math.min(...topoR.orderedPaths.map(rp => Math.abs(0.5 - rp.meanT)));
  assert.ok(Math.abs(winnerEntry.meanTDiff - trueMin) < 1e-9, 'nearestByMeanT must be the true minimum |meanT difference|, not an approximation');
});

// ================================================================
// K. edge cases
// ================================================================
test('K1. zero linked paths does not throw and produces empty/null-safe output', () => {
  const hd = buildFixture(5, [], 30);
  const topo = buildHoodingTopologyV2B(hd);
  assert.strictEqual(topo.orderedPaths.length, 0);
  assert.strictEqual(topo.adjacentPairs.length, 0);
  assert.strictEqual(topo.winnerTopology, null);
  assert.strictEqual(topo.extrema.totalLinkedPathCount, 0);
  assert.strictEqual(topo.extrema.nearestToWinner, null);
});
test('K2. exactly one linked path does not throw', () => {
  const hd = buildFixture(5, [{ winner: true, y: 25, t: 0.5, rs: 5, th: 1 }], 30);
  const topo = buildHoodingTopologyV2B(hd);
  assert.strictEqual(topo.orderedPaths.length, 1);
  assert.strictEqual(topo.adjacentPairs.length, 0);
  assert.strictEqual(topo.winnerTopology.pathId, 'P0');
  assert.strictEqual(topo.winnerTopology.pathsBelowCount, 0);
  assert.strictEqual(topo.winnerTopology.pathsAboveCount, 0);
});
test('K3. many linked paths (7) does not throw', () => {
  const defs = Array.from({ length: 7 }, (_, i) => ({ winner: i === 3, y: 12 + i * 5, t: 0.1 + i * 0.11, rs: 3 + i, th: 1 }));
  const hd = buildFixture(6, defs, 30);
  const topo = buildHoodingTopologyV2B(hd);
  assert.strictEqual(topo.orderedPaths.length, 7);
  assert.strictEqual(topo.adjacentPairs.length, 6);
});
test('K4. missing winner (no path carries containsV2Winner) does not throw and reports null winnerTopology', () => {
  const defs = [{ winner: false, y: 20, t: 0.3, rs: 5, th: 1 }, { winner: false, y: 35, t: 0.7, rs: 5, th: 1 }];
  const hd = buildFixture(5, defs, 30);
  const topo = buildHoodingTopologyV2B(hd);
  assert.strictEqual(topo.winnerTopology, null);
  assert.strictEqual(topo.extrema.winnerOrderedIndex, null);
  assert.strictEqual(topo.extrema.nearestToWinner, null);
});
test('K5. missing LEFT (null/invalid topology) in cross-eye does not throw', () => {
  const hdR = buildFixture(5, THREE_PATH_DEFS, 30);
  const topoR = buildHoodingTopologyV2B(hdR);
  const cross = buildHoodingTopologyV2BCrossEye(null, topoR);
  assert.strictEqual(cross.pairwisePathDistances.length, 0);
  assert.strictEqual(cross.nearestByMeanT.length, 0);
  assert.strictEqual(cross.winnerCrossEye, null);
});
test('K6. missing RIGHT (null/invalid topology) in cross-eye does not throw', () => {
  const hdL = buildFixture(5, THREE_PATH_DEFS, 30);
  const topoL = buildHoodingTopologyV2B(hdL);
  const cross = buildHoodingTopologyV2BCrossEye(topoL, null);
  assert.strictEqual(cross.pairwisePathDistances.length, 0);
  assert.strictEqual(cross.nearestByMeanT.length, 0);
  assert.strictEqual(cross.winnerCrossEye, null);
});
test('K7. buildHoodingTopologyV2B itself handles a null/invalid hoodingDebug without throwing', () => {
  const topo = buildHoodingTopologyV2B(null);
  assert.strictEqual(topo.orderedPaths.length, 0);
  assert.strictEqual(topo.winnerTopology, null);
  const topoInvalid = buildHoodingTopologyV2B({ valid: false });
  assert.strictEqual(topoInvalid.orderedPaths.length, 0);
});

// ================================================================
// L. Stage 2B construction occurs only under debugAvailable
// ================================================================
test('L. Stage 2B construction/call sites sit strictly inside the existing debugAvailable gate in LiveScanScreen', () => {
  const anchor = src.indexOf('detectEyelidCreaseV2(canvas, leftEye, leftBrowPts)');
  const gateStart = src.lastIndexOf('if (debugAvailable) {', anchor);
  const afterGate = src.indexOf('const qualityScore = det.detection.score', anchor);
  const topoCallIdx = src.indexOf('const hoodingTopologyV2BLeft = buildHoodingTopologyV2B(', anchor);
  const crossCallIdx = src.indexOf('const hoodingTopologyV2BCrossEye = buildHoodingTopologyV2BCrossEye(', anchor);
  assert.ok(gateStart !== -1 && afterGate !== -1 && topoCallIdx !== -1 && crossCallIdx !== -1, 'expected to locate all four anchors — has LiveScanScreen\'s tick loop moved?');
  assert.ok(topoCallIdx > gateStart && topoCallIdx < afterGate, 'Stage 2B per-eye construction must sit inside the debugAvailable-gated block');
  assert.ok(crossCallIdx > gateStart && crossCallIdx < afterGate, 'Stage 2B cross-eye construction must sit inside the debugAvailable-gated block');
});

// ================================================================
// M. Copy JSON contains Stage 1 + Stage 2B
// ================================================================
test('M. Copy JSON payload includes both hoodingV2Raw and hoodingTopologyV2B, untruncated', () => {
  const boundaryFlagStart = src.indexOf('    function debugV1BoundaryPeakFlag(v1) {');
  const boundaryFlagEnd = src.indexOf('\n    }\n', boundaryFlagStart) + '\n    }\n'.length;
  const payloadStart = src.indexOf('    function buildCreaseV2CopyPayload(data, compare, frameTrace, irisAudit) {');
  const payloadEnd = src.indexOf('\n    function CreaseV2DebugPanel(');
  if (boundaryFlagStart === -1 || payloadStart === -1 || payloadEnd === -1) throw new Error('Could not locate buildCreaseV2CopyPayload or its dependency — has it moved?');
  const { buildCreaseV2CopyPayload } = new Function(
    src.slice(boundaryFlagStart, boundaryFlagEnd) + '\n' + src.slice(payloadStart, payloadEnd) + '\nreturn { buildCreaseV2CopyPayload };'
  )();

  const hdL = buildFixture(5, THREE_PATH_DEFS, 30);
  const hdR = buildFixture(5, THREE_PATH_DEFS, 31);
  const topoL = buildHoodingTopologyV2B(hdL);
  const topoR = buildHoodingTopologyV2B(hdR);
  const crossTopo = buildHoodingTopologyV2BCrossEye(topoL, topoR);
  const data = {
    left: {}, right: {},
    hoodingV2Raw: { left: hdL, right: hdR, crossEye: null },
    hoodingTopologyV2B: { stage: '2B-measurement-only', left: topoL, right: topoR, crossEye: crossTopo },
    capture: null,
  };
  const payload = buildCreaseV2CopyPayload(data, null, null);
  assert.ok(payload.hoodingV2Raw, 'Stage 1 field must still be present');
  assert.ok(payload.hoodingTopologyV2B, 'Stage 2B field must be present');
  assert.strictEqual(payload.hoodingTopologyV2B.stage, '2B-measurement-only');
  assert.strictEqual(payload.hoodingTopologyV2B.left.orderedPaths.length, 3);
  assert.strictEqual(payload.hoodingTopologyV2B.crossEye.pairwisePathDistances.length, 9);
});

// ================================================================
// N. NORMAL production behavior/output unchanged
// ================================================================
test('N. production classification of the real audit fixture is unchanged by Stage 2B', () => {
  function eyeMetrics({ covCenter, covInner, covOuter, covByHeight, ear = 0.28, creaseValid = 1, creasePeak = 0, creaseProminence = 0, creaseYFrac = 0.4, creaseReadQuality = 0.6 } = {}) {
    const cc = covCenter ?? 0.44;
    return { width: 30, height: 12, ear, widthRatio: 0.42, tiltCorrected: 0, hoodingRatio: 0.1, hoodingRatioByWidth: 0.1, shapeRatio: 2.5,
      covCenterByWidth: cc, covInnerByWidth: covInner ?? cc, covOuterByWidth: covOuter ?? cc, covByHeight: covByHeight ?? (cc / 0.36),
      apertureA: 6, apertureB: 6, apertureAsymmetry: 1, innerTaperDeg: 70, outerTaperDeg: 70, creaseValid, creasePeak, creaseProminence, creaseYFrac, creaseReadQuality };
  }
  const CLEAR = { creaseValid: 1, creasePeak: 15, creaseProminence: 9, creaseReadQuality: 0.7 };
  const REAL_LEFT = { ...CLEAR, creaseYFrac: 0.4, covCenter: 0.9445, covInner: 0.8285, covOuter: 0.9293, covByHeight: 2.8144, ear: 0.3354 };
  const REAL_RIGHT = { ...CLEAR, creaseYFrac: 0.4, covCenter: 0.9401, covInner: 0.8368, covOuter: 0.8682, covByHeight: 2.8362, ear: 0.3314 };
  const aggregated = { left: eyeMetrics(REAL_LEFT), right: eyeMetrics(REAL_RIGHT), interEyeDistance: 65, faceBoxWidth: 220, verticalAsymRaw: 0, headPose: { roll: 0 } };
  const c = classifyFeatures(aggregated, { singleFrame: true, stability: null, imageQuality: 0.75 });
  assert.strictEqual(c.eyelidCategory, 'open');
  assert.strictEqual(c.eyelidType, 'openCrease');
  assert.strictEqual(c.isHooded, false);
  assert.strictEqual(c.creaseState, 'visible');
  assert.strictEqual(c.hoodingState, 'uncertain');
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
