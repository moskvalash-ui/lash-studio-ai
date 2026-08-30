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
const { ZONE_NAMES, expandLashMapSectors } = new Function(
  src.slice(sectorStart, sectorEnd) + '\nreturn {ZONE_NAMES,expandLashMapSectors};'
)();

const planStart = src.indexOf('    function pseudoJitter(');
const planEnd = src.indexOf('\n    // ------------------------------------------------------------\n    // Coordinate transform', planStart);
const { computeSpikeGeometry, generateLegacyApplicationPlan, generateApplicationPlan } = new Function(
  't', 'ZONE_NAMES', 'expandLashMapSectors',
  src.slice(planStart, planEnd) + '\nreturn {computeSpikeGeometry,generateLegacyApplicationPlan,generateApplicationPlan};'
)((key, lang) => `${lang}:${key}`, ZONE_NAMES, expandLashMapSectors);

const profile = {
  leftEye: { width: 42, ear: .24, innerTaperDeg: 62, outerTaperDeg: 68, tiltCorrected: -2 },
  rightEye: { width: 39, ear: .21, innerTaperDeg: 66, outerTaperDeg: 73, tiltCorrected: -178 },
  perEyeTiltDegrees: { left: -2, right: -2 }, relativeEyeSize: .34,
  isCloseSet: true, isWideSet: false, isHooded: true, hoodedConfidence: .7, hoodingLevel: 'partial',
  tiltTendency: 'downturned', tiltConfidence: .75, tiltDegrees: 5,
  compositeAsymmetry: .09, overallConfidence: .72, spacingConfidence: .7,
  shapeTendencies: { round: .2, almond: .6, elongated: .2 },
};

function curveFor(entry) {
  return {
    zonePositions: entry.zonePositions || null,
    postPeakShape: entry.postPeakShape || 'linear',
    plateauShape: entry.plateauShape || 'linear',
  };
}

function legacyDesign(entry, lang) {
  const maps = buildEyeZones(entry, profile);
  return {
    id: entry.id, category: entry.category,
    name: lang === 'en' ? entry.enName : entry.ruName,
    ruName: entry.ruName, enName: entry.enName, aliases: entry.aliases,
    score: entry.score(profile), whyItWorks: entry.why(profile, lang), correctionGoal: entry.goal(profile, lang),
    limitations: entry.cautions(profile, lang), baseCurl: entry.baseCurl, curlOptions: entry.curlOptions,
    defaultTechnique: entry.defaultTechnique,
    peakZone: maps.leftPeakZone === maps.rightPeakZone ? maps.leftPeakZone : entry.peakZone,
    leftPeakZone: maps.leftPeakZone, rightPeakZone: maps.rightPeakZone,
    leftCorrectionMm: maps.leftCorrectionMm, rightCorrectionMm: maps.rightCorrectionMm,
    texture: entry.texture || null, curve: curveFor(entry), leftZones: maps.left, rightZones: maps.right,
    curlRec: { primary: entry.baseCurl, alternatives: entry.curlOptions.filter(value => value !== entry.baseCurl).slice(0, 2), reason: 'legacy reason' },
  };
}

function canonicalPlan(design, entry, side, zones, otherZones, technique, curl, texture, spikeGeom, lang) {
  const base = Domain.legacyToClientLashDesign({ design, catalogEntry: entry, eyeProfile: profile, expandSectors: expandLashMapSectors });
  const client = Domain.withApplicationPlanRuntime(base, {
    activeSide: side, zones, otherZones, technique, curl,
    textureDescriptor: texture, spikeGeometry: spikeGeom, curve: design.curve,
  });
  return generateApplicationPlan(client, lang);
}

test('Application Plan canonical consumer is byte-for-byte equivalent for all 21 IDs in RU and EN', () => {
  assert.strictEqual(DESIGN_CATALOG.length, 21);
  for (const lang of ['ru', 'en']) {
    for (const entry of DESIGN_CATALOG) {
      const design = legacyDesign(entry, lang);
      for (const side of ['left', 'right']) {
        const zones = side === 'left' ? design.leftZones : design.rightZones;
        const otherZones = side === 'left' ? design.rightZones : design.leftZones;
        const technique = design.defaultTechnique;
        const curl = design.curlRec.primary;
        const texture = design.texture;
        const spikeGeom = computeSpikeGeometry(zones, texture);
        const legacy = generateLegacyApplicationPlan(profile, design, technique, curl, zones, otherZones, spikeGeom, design.curve, lang);
        const canonical = canonicalPlan(design, entry, side, zones, otherZones, technique, curl, texture, spikeGeom, lang);
        assert.deepStrictEqual(canonical, legacy, `${entry.id}/${lang}/${side}`);
      }
    }
  }
});

test('Application Plan canonical consumer preserves Custom runtime selections byte-for-byte', () => {
  const entry = DESIGN_CATALOG.find(item => item.id === 'natural');
  const design = legacyDesign(entry, 'en');
  const zones = [5.25, 6.5, 8.75, 11.125, 9.5];
  const otherZones = [5.5, 6.75, 9, 10.875, 9.25];
  const technique = 'Wet Technique / Wet Set';
  const curl = 'L+';
  const texture = { pattern: 'kim', frequency: 3, baseToSpikeDiff: 2.5 };
  const spikeGeom = computeSpikeGeometry(zones, texture);
  const legacy = generateLegacyApplicationPlan(profile, design, technique, curl, zones, otherZones, spikeGeom, design.curve, 'en');
  const canonical = canonicalPlan(design, entry, 'left', zones, otherZones, technique, curl, texture, spikeGeom, 'en');
  assert.deepStrictEqual(canonical, legacy);
});

test('runtime canonical view copies selections exactly and does not mutate base canonical or runtime input', () => {
  const entry = DESIGN_CATALOG.find(item => item.id === 'fox');
  const design = legacyDesign(entry, 'en');
  const base = Domain.legacyToClientLashDesign({ design, catalogEntry: entry, eyeProfile: profile, expandSectors: expandLashMapSectors });
  const runtime = {
    activeSide: 'right', zones: design.rightZones, otherZones: design.leftZones,
    technique: design.defaultTechnique, curl: 'CC', textureDescriptor: design.texture,
    spikeGeometry: null, curve: design.curve,
  };
  const beforeBase = structuredClone(base), beforeRuntime = structuredClone(runtime);
  const result = Domain.withApplicationPlanRuntime(base, runtime);
  assert.deepStrictEqual(base, beforeBase);
  assert.deepStrictEqual(runtime, beforeRuntime);
  assert.deepStrictEqual(result.mapping.applicationPlan.active.finalMm, runtime.zones);
  assert.strictEqual(result.application.selectedTechnique, runtime.technique);
  assert.strictEqual(result.curl.selected, runtime.curl);
  assert.notStrictEqual(result.mapping.applicationPlan.active.finalMm, runtime.zones);
});

test('Application Plan remains canonical while Recommendation, PHOTO, Custom, language, and Natural Lash remain legacy consumers', () => {
  assert.ok(src.includes('const planClientDesign=LashDesignDomain.withApplicationPlanRuntime('));
  assert.ok(src.includes('const plan = generateApplicationPlan(planClientDesign, lang);'));
  assert.strictEqual((src.match(/generateApplicationPlan\(/g) || []).length, 2, 'one definition and one canonical call');
  assert.ok(src.includes('function rankDesigns(c, lang) { return rankDesignsAll(c, lang).slice(0, 6); }'));
  assert.ok(src.includes('side="left" zones={leftZones} peakIdx={leftPeakIdx}'));
  assert.ok(src.includes('side="right" zones={rightZones} peakIdx={rightPeakIdx}'));
  assert.ok(src.includes('<LashMapDiagram clientDesign={diagramClientDesign}'));
  assert.ok(src.includes("const [customLeft, setCustomLeft] = useState(design.leftZones);"));
  assert.ok(src.includes("const [customRight, setCustomRight] = useState(design.rightZones);"));
  assert.ok(src.includes('const design = localizeDesign(designProp, result.eyeProfile, lang);'));
  assert.ok(!naturalSource.includes('LashDesignDomain'));
});
