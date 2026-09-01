const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const Domain = require('../lash-design-domain.js');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const naturalSource = fs.readFileSync(path.join(root, 'lash-scan-core.js'), 'utf8');

const catalogStart = src.indexOf('    const DESIGN_CATALOG = ');
const catalogEnd = src.indexOf('\n\n    function calculateEyeLashMap(', catalogStart);
const DESIGN_CATALOG = new Function(
  'const clampScore=n=>Math.max(0,Math.min(100,Math.round(n)));\n' +
  src.slice(catalogStart, catalogEnd) + '\nreturn DESIGN_CATALOG;'
)();

const mapStart = src.indexOf('    function calculateEyeLashMap(');
const mapEnd = src.indexOf('    const CLIENT_LASH_DESIGN_REGISTRY', mapStart);
const { buildEyeZones } = new Function(`
const clamp01=n=>Math.max(0,Math.min(1,n));
const mirrorReflectDeg=deg=>{let d=180-deg;while(d>180)d-=360;while(d<=-180)d+=360;return d;};
${src.slice(mapStart, mapEnd)}
return {buildEyeZones};
`)();

const sectorStart = src.indexOf('    const ZONE_NAMES = ');
const sectorEnd = src.indexOf('\n    const CATEGORY_LABELS =', sectorStart);
const { expandLashMapSectors } = new Function(
  src.slice(sectorStart, sectorEnd) + '\nreturn {expandLashMapSectors};'
)();

const spikeStart = src.indexOf('    function pseudoJitter(');
const spikeEnd = src.indexOf('\n    // ------------------------------------------------------------\n    // LASH APPLICATION PLAN', spikeStart);
const { computeSpikeGeometry } = new Function(
  'ZONE_NAMES', src.slice(spikeStart, spikeEnd) + '\nreturn {computeSpikeGeometry};'
)(['INNER', 'TRANSITION', 'BODY', 'PEAK', 'OUTER']);

const profile = {
  leftEye: { width: 42, ear: .24, innerTaperDeg: 62, outerTaperDeg: 68, tiltCorrected: -2 },
  rightEye: { width: 39, ear: .21, innerTaperDeg: 66, outerTaperDeg: 73, tiltCorrected: -178 },
  perEyeTiltDegrees: { left: -2, right: -2 }, relativeEyeSize: .34,
  isCloseSet: false, isWideSet: false, isHooded: false, tiltTendency: 'neutral',
  compositeAsymmetry: .09, overallConfidence: .72,
  shapeTendencies: { round: .2, almond: .6, elongated: .2 },
};

const curveFor = entry => ({
  zonePositions: entry.zonePositions || null,
  postPeakShape: entry.postPeakShape || 'linear',
  plateauShape: entry.plateauShape || 'linear',
});

function legacyDesign(entry) {
  const maps = buildEyeZones(entry, profile);
  return {
    id: entry.id, category: entry.category, name: entry.enName, ruName: entry.ruName, enName: entry.enName,
    aliases: entry.aliases, score: entry.score(profile), whyItWorks: entry.why(profile, 'en'),
    correctionGoal: entry.goal(profile, 'en'), limitations: entry.cautions(profile, 'en'),
    baseCurl: entry.baseCurl, curlOptions: entry.curlOptions, defaultTechnique: entry.defaultTechnique,
    peakZone: maps.leftPeakZone === maps.rightPeakZone ? maps.leftPeakZone : entry.peakZone,
    leftPeakZone: maps.leftPeakZone, rightPeakZone: maps.rightPeakZone,
    leftCorrectionMm: maps.leftCorrectionMm, rightCorrectionMm: maps.rightCorrectionMm,
    texture: entry.texture || null, curve: curveFor(entry), leftZones: maps.left, rightZones: maps.right,
    curlRec: { primary: entry.baseCurl, alternatives: entry.curlOptions.filter(value => value !== entry.baseCurl), reason: 'legacy' },
  };
}

function canonicalDiagramProps(design, entry, side, zones, peakIdx, spikeGeom, curve, curl, technique) {
  const base = Domain.legacyToClientLashDesign({ design, catalogEntry: entry, eyeProfile: profile, expandSectors: expandLashMapSectors });
  const runtime = Domain.withDiagramRuntime(base, {
    activeSide: side, zones, peakIdx, spikeGeometry: spikeGeom, curve, curl, technique,
  });
  return Domain.diagramPropsFromClientDesign(runtime);
}

test('canonical DIAGRAM props equal legacy props for all 21 IDs, LEFT and RIGHT', () => {
  assert.strictEqual(DESIGN_CATALOG.length, 21);
  for (const entry of DESIGN_CATALOG) {
    const design = legacyDesign(entry);
    for (const side of ['left', 'right']) {
      const zones = side === 'left' ? design.leftZones : design.rightZones;
      const peakIdx = side === 'left' ? design.leftPeakZone : design.rightPeakZone;
      const spikeGeom = computeSpikeGeometry(zones, design.texture);
      const legacy = { zones, peakIdx, spikeGeom, curve: design.curve, curl: design.curlRec.primary, technique: design.defaultTechnique, side };
      const canonical = canonicalDiagramProps(design, entry, side, zones, peakIdx, spikeGeom, design.curve, design.curlRec.primary, design.defaultTechnique);
      assert.deepStrictEqual(canonical, legacy, `${entry.id}/${side}`);
      assert.deepStrictEqual(
        expandLashMapSectors(canonical.zones, canonical.peakIdx, canonical.curve),
        expandLashMapSectors(legacy.zones, legacy.peakIdx, legacy.curve),
        `${entry.id}/${side}/derived sectors`
      );
    }
  }
});

test('textured DIAGRAM designs preserve exact spike geometry, including explicit Wet coverage', () => {
  for (const id of ['wispy', 'wispycat', 'wispydoll', 'kim', 'manga', 'wet']) {
    const entry = DESIGN_CATALOG.find(item => item.id === id);
    const design = legacyDesign(entry), zones = design.leftZones;
    const spikeGeom = computeSpikeGeometry(zones, design.texture);
    const props = canonicalDiagramProps(design, entry, 'left', zones, design.leftPeakZone, spikeGeom, design.curve, design.baseCurl, design.defaultTechnique);
    assert.deepStrictEqual(props.spikeGeom, spikeGeom, id);
    if (id === 'wet') assert.strictEqual(props.spikeGeom, null, 'current Wet DIAGRAM has no catalog spike descriptor');
    else assert.ok(props.spikeGeom?.spikes.length > 0, id);
  }
});

test('Custom DIAGRAM runtime selections remain byte-for-byte equivalent', () => {
  const entry = DESIGN_CATALOG.find(item => item.id === 'natural');
  const design = legacyDesign(entry);
  const zones = [5.25, 7, 9.5, 12.25, 10.75], peakIdx = 3;
  const curve = { zonePositions: [0, .18, .43, .71, 1], postPeakShape: 'frontLoaded', plateauShape: 'shoulder' };
  const texture = { pattern: 'manga', frequency: 3, baseToSpikeDiff: 3.5 };
  const spikeGeom = computeSpikeGeometry(zones, texture), curl = 'L+', technique = 'Wet Technique / Wet Set';
  const legacy = { zones, peakIdx, spikeGeom, curve, curl, technique, side: 'right' };
  const canonical = canonicalDiagramProps(design, entry, 'right', zones, peakIdx, spikeGeom, curve, curl, technique);
  assert.deepStrictEqual(canonical, legacy);
});

test('DIAGRAM runtime adapter is deterministic, defensive, and does not mutate inputs', () => {
  const entry = DESIGN_CATALOG.find(item => item.id === 'fox'), design = legacyDesign(entry);
  const base = Domain.legacyToClientLashDesign({ design, catalogEntry: entry, eyeProfile: profile, expandSectors: expandLashMapSectors });
  const runtime = { activeSide: 'left', zones: design.leftZones, peakIdx: design.leftPeakZone, spikeGeometry: null, curve: design.curve, curl: 'CC', technique: design.defaultTechnique };
  const beforeBase = structuredClone(base), beforeRuntime = structuredClone(runtime);
  const first = Domain.withDiagramRuntime(base, runtime), second = Domain.withDiagramRuntime(base, runtime);
  assert.deepStrictEqual(first, second);
  assert.deepStrictEqual(base, beforeBase);
  assert.deepStrictEqual(runtime, beforeRuntime);
  assert.notStrictEqual(first.mapping.diagram.finalMm, runtime.zones);
  assert.notStrictEqual(Domain.diagramPropsFromClientDesign(first).zones, first.mapping.diagram.finalMm);
});

test('canonical wrapper feeds the unchanged legacy SVG renderer and no other consumer migrates', () => {
  const legacyStart = src.indexOf('    function LegacyLashMapDiagram(');
  const wrapperStart = src.indexOf('    function LashMapDiagram(', legacyStart);
  const photoStart = src.indexOf('    function LegacyProfessionalEyeMap(', wrapperStart);
  const legacyRenderer = src.slice(legacyStart, wrapperStart), wrapper = src.slice(wrapperStart, photoStart);
  assert.ok(legacyRenderer.includes('const items = expandLashMapSectors(zones, peakIdx, curve);'));
  assert.ok(legacyRenderer.includes('(spikeGeom?.spikes||[]).map'));
  assert.ok(legacyRenderer.includes('{z.len} mm · {curl}'));
  assert.ok(legacyRenderer.includes('{technique}</text>'));
  assert.ok(wrapper.includes('diagramPropsFromClientDesign(clientDesign)'));
  assert.ok(wrapper.includes('<LegacyLashMapDiagram {...diagramProps}'));
  assert.ok(!wrapper.includes('<svg'));
  assert.ok(src.includes('<LashMapDiagram clientDesign={diagramClientDesign}'));
  assert.ok(src.includes('const plan = generateApplicationPlan(planClientDesign, lang);'));
  assert.ok(src.includes('<ProfessionalEyeMap clientDesign={photoClientDesign}'));
  assert.ok(src.includes("const [customLeft, setCustomLeft] = useState(design.leftZones);"));
  assert.ok(src.includes('function rankDesigns(c, lang) { return rankDesignsAll(c, lang).slice(0, 6); }'));
  assert.ok(!naturalSource.includes('LashDesignDomain'));
});
