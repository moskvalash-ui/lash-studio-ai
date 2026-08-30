const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const domainSource = fs.readFileSync(path.join(root, 'lash-design-domain.js'), 'utf8');
const naturalLashSource = fs.readFileSync(path.join(root, 'lash-scan-core.js'), 'utf8');
const Domain = require('../lash-design-domain.js');

const catalogStart = src.indexOf('    const DESIGN_CATALOG = ');
const catalogEnd = src.indexOf('\n\n    function calculateEyeLashMap(', catalogStart);
assert.ok(catalogStart >= 0 && catalogEnd > catalogStart);
const DESIGN_CATALOG = new Function(
  'const clampScore = n => Math.max(0, Math.min(100, Math.round(n)));\n' +
  src.slice(catalogStart, catalogEnd) + '\nreturn DESIGN_CATALOG;'
)();

const mapStart = src.indexOf('    function calculateEyeLashMap(');
const mapEnd = src.indexOf('    const CLIENT_LASH_DESIGN_REGISTRY', mapStart);
const mapHelpers = `
const clamp01 = n => Math.max(0, Math.min(1, n));
const mirrorReflectDeg = deg => { let d=180-deg; while(d>180)d-=360; while(d<=-180)d+=360; return d; };
`;
const { calculateEyeLashMap, buildEyeZones } = new Function(
  mapHelpers + src.slice(mapStart, mapEnd) + '\nreturn { calculateEyeLashMap, buildEyeZones };'
)();

const sectorStart = src.indexOf('    const ZONE_NAMES = ');
const sectorEnd = src.indexOf('\n    const CATEGORY_LABELS =', sectorStart);
const { expandLashMapSectors } = new Function(
  src.slice(sectorStart, sectorEnd) + '\nreturn { expandLashMapSectors };'
)();

const curlStart = src.indexOf('    const CURL_CATALOG = ');
const curlEnd = src.indexOf('\n\n    // ------------------------------------------------------------\n    // TECHNIQUE CATALOG', curlStart);
const { recommendCurl } = new Function(
  src.slice(curlStart, curlEnd) + '\nreturn { recommendCurl };'
)();

const EXPECTED_IDS = [
  'natural', 'naturalRounded', 'naturalElongated', 'angel', 'doll', 'rounded', 'squirrel',
  'kitten', 'cat', 'softcat', 'fox', 'softfox', 'eyeliner', 'wispy', 'wispycat',
  'wispydoll', 'kim', 'manga', 'wet', 'reverse', 'correction',
];

const profile = {
  leftEye: { width: 42, height: 15, ear: .24, innerTaperDeg: 62, outerTaperDeg: 68, tiltCorrected: -2 },
  rightEye: { width: 39, height: 14, ear: .21, innerTaperDeg: 66, outerTaperDeg: 73, tiltCorrected: -178 },
  perEyeTiltDegrees: { left: -2, right: -2 },
  relativeEyeSize: .34,
  isCloseSet: false,
  isWideSet: false,
  isHooded: false,
  hoodedConfidence: .7,
  hoodingLevel: 'none',
  tiltTendency: 'neutral',
  tiltConfidence: .75,
  tiltDegrees: 0,
  compositeAsymmetry: .09,
  overallConfidence: .72,
  spacingConfidence: .7,
  shapeTendencies: { round: .2, almond: .6, elongated: .2 },
  asymmetryBreakdown: { width: .07, height: .06, openness: .12, tilt: 0, hooding: .03, vertical: .01 },
};

function legacyDesign(entry, lang = 'en') {
  const maps = buildEyeZones(entry, profile);
  const curlRec = recommendCurl(profile, entry, lang);
  return {
    id: entry.id,
    category: entry.category,
    name: lang === 'en' ? entry.enName : entry.ruName,
    ruName: entry.ruName,
    enName: entry.enName,
    aliases: entry.aliases,
    score: entry.score(profile),
    whyItWorks: entry.why(profile, lang),
    correctionGoal: entry.goal(profile, lang),
    limitations: entry.cautions(profile, lang),
    baseCurl: entry.baseCurl,
    curlOptions: entry.curlOptions,
    defaultTechnique: entry.defaultTechnique,
    peakZone: maps.leftPeakZone === maps.rightPeakZone ? maps.leftPeakZone : entry.peakZone,
    leftPeakZone: maps.leftPeakZone,
    rightPeakZone: maps.rightPeakZone,
    leftCorrectionMm: maps.leftCorrectionMm,
    rightCorrectionMm: maps.rightCorrectionMm,
    texture: entry.texture || null,
    curve: {
      zonePositions: entry.zonePositions || null,
      postPeakShape: entry.postPeakShape || 'linear',
      plateauShape: entry.plateauShape || 'linear',
    },
    leftZones: maps.left,
    rightZones: maps.right,
    curlRec,
  };
}

const adapt = (design, entry, extra = {}) => Domain.legacyToClientLashDesign({
  design, catalogEntry: entry, eyeProfile: profile, expandSectors: expandLashMapSectors, ...extra,
});

test('canonical taxonomy preserves all 21 legacy IDs in exact catalog order', () => {
  assert.deepStrictEqual(DESIGN_CATALOG.map(entry => entry.id), EXPECTED_IDS);
  assert.deepStrictEqual(Domain.LEGACY_TAXONOMY.map(entry => entry.legacyId), EXPECTED_IDS);
  assert.strictEqual(new Set(EXPECTED_IDS).size, 21);
});

test('all 21 adapters preserve legacy mapping, peak, score, curl, texture, aliases, and derived sectors', () => {
  for (const entry of DESIGN_CATALOG) {
    const design = legacyDesign(entry);
    const canonical = adapt(design, entry);
    assert.strictEqual(canonical.version, 2, entry.id);
    assert.strictEqual(canonical.presetId, design.id, entry.id);
    assert.deepStrictEqual(canonical.mapping.template.baseZones, entry.baseZones, entry.id);
    assert.deepStrictEqual(canonical.mapping.physicalEyes.left.finalMm, design.leftZones, entry.id);
    assert.deepStrictEqual(canonical.mapping.physicalEyes.right.finalMm, design.rightZones, entry.id);
    assert.strictEqual(canonical.mapping.physicalEyes.left.peakZone, design.leftPeakZone, entry.id);
    assert.strictEqual(canonical.mapping.physicalEyes.right.peakZone, design.rightPeakZone, entry.id);
    assert.deepStrictEqual(canonical.mapping.physicalEyes.left.derivedSectors, expandLashMapSectors(design.leftZones, design.leftPeakZone, design.curve), entry.id);
    assert.deepStrictEqual(canonical.mapping.physicalEyes.right.derivedSectors, expandLashMapSectors(design.rightZones, design.rightPeakZone, design.curve), entry.id);
    assert.strictEqual(canonical.recommendation.score, design.score, entry.id);
    assert.strictEqual(canonical.curl.global, design.curlRec.primary, entry.id);
    assert.deepStrictEqual(canonical.curl.alternatives, design.curlRec.alternatives, entry.id);
    assert.deepStrictEqual(canonical.texture.legacyDescriptor, design.texture, entry.id);
    assert.deepStrictEqual(canonical.display.aliases, design.aliases, entry.id);
  }
});

test('adapter is deterministic, JSON-safe, and never mutates or aliases legacy input', () => {
  for (const entry of DESIGN_CATALOG) {
    const design = legacyDesign(entry);
    const before = structuredClone(design);
    const first = adapt(design, entry, { rank: 3 });
    const second = adapt(design, entry, { rank: 3 });
    assert.deepStrictEqual(first, second, entry.id);
    assert.deepStrictEqual(design, before, entry.id);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(first)), first, entry.id);
    assert.notStrictEqual(first.mapping.physicalEyes.left.finalMm, design.leftZones, entry.id);
    assert.notStrictEqual(first.mapping.template.baseZones, entry.baseZones, entry.id);
    assert.notStrictEqual(first.display.aliases, design.aliases, entry.id);
    if (design.texture) assert.notStrictEqual(first.texture.legacyDescriptor, design.texture, entry.id);
  }
});

test('adapter does not rescore, recalculate mm, select peaks, normalize, or round legacy values', () => {
  const entry = DESIGN_CATALOG.find(item => item.id === 'fox');
  const design = legacyDesign(entry);
  design.score = 37.125;
  design.leftZones = [5.25, 6.5, 8.75, 11.125, 10.375];
  design.rightZones = [5.5, 6.25, 8.5, 10.875, 9.625];
  design.leftPeakZone = 2;
  design.rightPeakZone = 1;
  const canonical = adapt(design, entry);
  assert.strictEqual(canonical.recommendation.score, 37.125);
  assert.deepStrictEqual(canonical.mapping.physicalEyes.left.finalMm, design.leftZones);
  assert.deepStrictEqual(canonical.mapping.physicalEyes.right.finalMm, design.rightZones);
  assert.strictEqual(canonical.mapping.physicalEyes.left.peakZone, 2);
  assert.strictEqual(canonical.mapping.physicalEyes.right.peakZone, 1);
});

test('natural-lash evidence is confidence-gated, relative, and never exposes counts or fabricates unavailable measurements', () => {
  const observation = {
    hasData: true, framesUsed: 8, visualDensity: 'medium', overallLenBucket: 'mixed', dominantDirection: 'straight', confidence: .74,
    confidenceFactors: { consistency: .8 }, gapZones: [2], condition: { occupancyUniformity: { level: 'EVEN', confidence: .7 } },
    zones: {
      inner: { occupancy: .4, occupancyLevel: 'medium', visibleLengthLevel: 'short', direction: 'straight', sparseArea: false, confidence: .72, estimatedCount: 9 },
    },
    diagnostics: { candidateClusterCount: 19, candidateClusterCountLow: 15, candidateClusterCountHigh: 23 },
  };
  const evidence = Domain.buildNaturalLashEvidence({ left: observation, right: observation, comparison: { hasComparison: true, occupancyDiff: .02, conditionComparison: {} } });
  const serialized = JSON.stringify(evidence);
  assert.strictEqual(evidence.eyes.left.relativeVisibleLength.unit, 'RELATIVE_TO_EYE_GEOMETRY');
  assert.strictEqual(evidence.eyes.left.relativeVisibleLength.provenance, 'INFERRED_FROM_IMAGE');
  assert.deepStrictEqual(evidence.unavailable, Domain.UNAVAILABLE_NATURAL_LASH_EVIDENCE);
  for (const key of Domain.UNAVAILABLE_NATURAL_LASH_EVIDENCE) assert.ok(serialized.includes(key));
  assert.ok(!/estimatedCount|candidateCluster|countLow|countHigh/i.test(serialized));
  assert.ok(!/SAFE(?!_FAN_WEIGHT)/.test(serialized));
});

test('missing natural-lash input remains unavailable and cannot authorize fan, volume, diameter, weight, or safety', () => {
  const entry = DESIGN_CATALOG[0];
  const canonical = adapt(legacyDesign(entry), entry);
  assert.strictEqual(canonical.evidence.naturalLashes.availability, 'UNAVAILABLE');
  assert.strictEqual(canonical.volume.fanConstruction, null);
  assert.strictEqual(canonical.volume.intent, null);
  assert.strictEqual(canonical.volume.verificationStatus, 'ARTIST_VERIFICATION_REQUIRED');
  assert.strictEqual(canonical.verification.automatedSafetyClaim, false);
  assert.notStrictEqual(canonical.verification.status, 'SAFE');
});

test('building every canonical wrapper leaves legacy ranking and top six byte-for-byte unchanged', () => {
  const ranked = DESIGN_CATALOG.map(legacyDesign).sort((a, b) => b.score - a.score);
  const before = structuredClone(ranked);
  ranked.forEach((design, rank) => adapt(design, DESIGN_CATALOG.find(entry => entry.id === design.id), { rank }));
  assert.deepStrictEqual(ranked, before);
  assert.deepStrictEqual(ranked.slice(0, 6), before.slice(0, 6));
});

test('index integration keeps only explicitly migrated consumer boundaries canonical', () => {
  assert.ok(src.includes('<script src="lash-design-domain.js"></script>'));
  assert.ok(src.includes('const CLIENT_LASH_DESIGN_REGISTRY = new WeakMap();'));
  assert.ok(src.includes('CLIENT_LASH_DESIGN_REGISTRY.set(legacyDesign, LashDesignDomain.legacyToClientLashDesign({'));
  assert.ok(src.includes('return legacyDesign;'));
  assert.strictEqual((src.match(/getCanonicalClientLashDesign\(/g) || []).length, 1, 'canonical getter must have no production consumer');
  assert.ok(src.includes('function rankDesigns(c, lang) { return rankDesignsAll(c, lang).slice(0, 6); }'));
  assert.ok(src.includes('<ProfessionalEyeMap clientDesign={photoClientDesign}'));
  assert.ok(src.includes('<LashMapDiagram clientDesign={diagramClientDesign}'));
  assert.ok(src.includes('const plan = generateApplicationPlan(planClientDesign, lang);'));
  assert.ok(src.includes("const [customLeft, setCustomLeft] = useState(design.leftZones);"));
  assert.ok(src.includes("const [customRight, setCustomRight] = useState(design.rightZones);"));
  assert.ok(src.includes('const design = localizeDesign(designProp, result.eyeProfile, lang);'));
  assert.ok(!naturalLashSource.includes('LashDesignDomain'));
});

test('professional legacy constants and rules remain untouched by the foundation', () => {
  const byId = Object.fromEntries(DESIGN_CATALOG.map(entry => [entry.id, entry]));
  assert.deepStrictEqual(byId.fox.zonePositions, [0, .20, .44, .66, 1]);
  assert.deepStrictEqual(byId.cat.zonePositions, [0, .22, .48, .78, 1]);
  assert.deepStrictEqual(byId.squirrel.zonePositions, [0, .20, .46, .62, 1]);
  assert.deepStrictEqual(byId.angel.baseZones, [6, 7, 8, 8, 7]);
  assert.deepStrictEqual(byId.wet.baseZones, [7, 8, 9, 9, 8]);
  assert.deepStrictEqual(byId.kim.texture, { pattern: 'kim', frequency: 3, baseToSpikeDiff: 3 });
  assert.deepStrictEqual(byId.manga.texture, { pattern: 'manga', frequency: 2, baseToSpikeDiff: 4 });
  assert.ok(!domainSource.includes('calculateEyeLashMap'));
  assert.ok(!domainSource.includes('rankDesigns'));
});
