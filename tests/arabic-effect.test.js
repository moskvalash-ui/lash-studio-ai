const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const Domain = require('../lash-design-domain.js');
const Analytics = require('../analytics.js');

// ARABIC production effect: focused regression coverage. Real production functions are sliced straight out of
// index.html (same technique as diagram-canonical / recommendation-canonical).
const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const catalogStart = src.indexOf('    const DESIGN_CATALOG = '), catalogEnd = src.indexOf('\n\n    function calculateEyeLashMap(', catalogStart);
const clampScore = n => Math.max(0, Math.min(100, Math.round(n)));
const DESIGN_CATALOG = new Function('const clampScore=n=>Math.max(0,Math.min(100,Math.round(n)));\n' + src.slice(catalogStart, catalogEnd) + '\nreturn DESIGN_CATALOG;')();
const clamp01 = n => Math.max(0, Math.min(1, n));
const mirrorReflectDeg = deg => { let d = 180 - deg; while (d > 180) d -= 360; while (d <= -180) d += 360; return d; };
const sectorStart = src.indexOf('    const ZONE_NAMES = '), sectorEnd = src.indexOf('\n    const CATEGORY_LABELS =', sectorStart);
const { expandLashMapSectors } = new Function(src.slice(sectorStart, sectorEnd) + '\nreturn {expandLashMapSectors};')();
const curlStart = src.indexOf('    const CURL_CATALOG = '), curlEnd = src.indexOf('\n\n    // ------------------------------------------------------------\n    // TECHNIQUE CATALOG', curlStart);
const { recommendCurl } = new Function(src.slice(curlStart, curlEnd) + '\nreturn {recommendCurl};')();
const engineStart = src.indexOf('    function calculateEyeLashMap('), engineEnd = src.indexOf('function rankDesigns(c, lang) { return rankDesignsAll(c, lang).slice(0, 6); }');
const engineSource = src.slice(engineStart, engineEnd + 'function rankDesigns(c, lang) { return rankDesignsAll(c, lang).slice(0, 6); }'.length);
const makeEngine = catalog => new Function('LashDesignDomain', 'DESIGN_CATALOG', 'clampScore', 'clamp01', 'mirrorReflectDeg', 'expandLashMapSectors', 'recommendCurl',
  engineSource + '\nreturn {rankDesignsAll,rankDesigns,localizeDesign,buildDesignResult};')(Domain, catalog, clampScore, clamp01, mirrorReflectDeg, expandLashMapSectors, recommendCurl);
const engine = makeEngine(DESIGN_CATALOG);
const spikeStart = src.indexOf('    function pseudoJitter('), spikeEnd = src.indexOf('\n    // ------------------------------------------------------------\n    // LASH APPLICATION PLAN', spikeStart);
const { computeSpikeGeometry } = new Function('ZONE_NAMES', src.slice(spikeStart, spikeEnd) + '\nreturn {computeSpikeGeometry};')(['INNER', 'TRANSITION', 'BODY', 'PEAK', 'OUTER']);

// Frozen copy of the stable-baseline (dfbcd80) spike geometry -- uniform/kim/manga must stay bit-for-bit identical to it.
const BASELINE_SPIKE_SOURCE = `    function pseudoJitter(i) { const x = Math.sin(i * 12.9898) * 43758.5453; return x - Math.floor(x); }

    function computeSpikeGeometry(zones, texture) {
      if (!texture) return null;
      const n = zones.length;
      const spikes = [];
      for (let i = 0; i < n - 1; i++) {
        for (let s = 1; s <= texture.frequency; s++) {
          const segFrac = s / (texture.frequency + 1);
          const jitter = texture.pattern === 'uniform' ? (pseudoJitter(i*7+s) - 0.5) * 0.06 : 0;
          const t = i/(n-1) + (segFrac + jitter) * (1/(n-1));
          const baseLen = zones[i] + (zones[i+1]-zones[i]) * segFrac;
          const tall = texture.pattern === 'kim' ? (s % 2 === 1) : texture.pattern === 'manga' ? true : (s % 2 === 0);
          const diff = tall ? texture.baseToSpikeDiff : texture.baseToSpikeDiff * 0.35;
          const spikeLen = Math.round((baseLen + diff) * 10) / 10;
          spikes.push({ t, zoneIdx: i, tall, baseLen: Math.round(baseLen*10)/10, spikeLen, diff: Math.round(diff*10)/10 });
        }
      }
      const tallSpikes = spikes.filter(sp => sp.tall);
      const spikeLens = spikes.map(sp => sp.spikeLen);
      const mainSpike = tallSpikes.reduce((best, sp) => !best || sp.spikeLen > best.spikeLen ? sp : best, null);
      return {
        spikes, count: tallSpikes.length,
        baseMin: Math.min(...zones), baseMax: Math.max(...zones),
        spikeMin: Math.min(...spikeLens), spikeMax: Math.max(...spikeLens),
        diff: texture.baseToSpikeDiff, pattern: texture.pattern,
        mainSpikeZone: mainSpike ? ZONE_NAMES[Math.min(mainSpike.zoneIdx+1, ZONE_NAMES.length-1)] : ZONE_NAMES[3],
      };
    }
`;
const { computeSpikeGeometry: baselineSpikeGeometry } = new Function('ZONE_NAMES', BASELINE_SPIKE_SOURCE + '\nreturn {computeSpikeGeometry};')(['INNER', 'TRANSITION', 'BODY', 'PEAK', 'OUTER']);

const profile = {
  leftEye: { width: 42, height: 15, ear: .24, innerTaperDeg: 62, outerTaperDeg: 68, tiltCorrected: -2 },
  rightEye: { width: 39, height: 14, ear: .21, innerTaperDeg: 66, outerTaperDeg: 73, tiltCorrected: -178 },
  perEyeTiltDegrees: { left: -2, right: -2 }, relativeEyeSize: .34, isCloseSet: false, isWideSet: false, isHooded: false,
  tiltTendency: 'neutral', tiltConfidence: .5, tiltDegrees: -2, compositeAsymmetry: .02, overallConfidence: .72,
  shapeTendencies: { round: .2, almond: .6, elongated: .2 },
};
const arabic = DESIGN_CATALOG.find(e => e.id === 'arabic');
const OLD_21_IDS = ['natural', 'naturalRounded', 'naturalElongated', 'angel', 'doll', 'rounded', 'squirrel', 'kitten', 'cat', 'softcat', 'fox', 'softfox', 'eyeliner', 'wispy', 'wispycat', 'wispydoll', 'kim', 'manga', 'wet', 'reverse', 'correction'];
const r1 = v => Math.round(v * 10) / 10;

test('1. arabic exists in the production catalog with the approved spec; the 21 existing ids keep their exact order', () => {
  assert.deepStrictEqual(DESIGN_CATALOG.map(e => e.id), [...OLD_21_IDS, 'arabic']);
  assert.deepStrictEqual(arabic.baseZones, [6, 7, 9, 12, 10]);
  assert.strictEqual(arabic.peakZone, 3);
  assert.deepStrictEqual(arabic.zonePositions, [0, .20, .46, .74, 1]);
  assert.strictEqual(arabic.baseCurl, 'LC');
  assert.deepStrictEqual(arabic.curlOptions, ['C', 'LC', 'L', 'L+']);
  assert.strictEqual(arabic.defaultTechnique, 'Volume 3D');
  assert.strictEqual(arabic.category, 'textured');
  assert.deepStrictEqual({ ...arabic.texture }, { pattern: 'arabic', frequency: 3, baseToSpikeDiff: 3, groups: 6, mediumDiff: 1.5, longDiff: 3.0, taperEnd: .6, spread: .062 });
});

test('1b. the 21 existing catalog entries are byte-identical to the stable baseline (only the Arabic entry was added)', () => {
  const block = src.slice(catalogStart, catalogEnd);
  const withoutArabic = block.replace(/\n      \/\/ ARABIC: three-length[\s\S]*?\n        cautions: \(\) => \[\] \},(?=\n    \];)/, '');
  assert.notStrictEqual(withoutArabic, block, 'the Arabic entry must be removable');
  assert.strictEqual(require('node:crypto').createHash('sha256').update(withoutArabic).digest('hex'), '15982679009bb39778371a57689fe9f8ad944222f8e7f259e2e19d7d089b4181');
  const domain = fs.readFileSync(path.join(__dirname, '..', 'lash-design-domain.js'), 'utf8');
  assert.strictEqual(require('node:crypto').createHash('sha256').update(domain.replace("    ['arabic', 'arabicRhythm', 'volume3D', 'arabic', 'KEEP'],\n", '')).digest('hex'), '11ee9f0d581307fdb24651560e0f2e822c18acb1a6a289aaeaa535aa4866a54d');
});

test('2. taxonomy conversion accepts arabic and maps it to its own geometry/texture identity', () => {
  const design = engine.buildDesignResult(arabic, profile, 'en');
  const client = Domain.legacyToClientLashDesign({ design, catalogEntry: arabic, eyeProfile: profile, expandSectors: expandLashMapSectors });
  assert.strictEqual(client.legacyDesignId, 'arabic');
  assert.strictEqual(client.mapping.geometryId, 'arabicRhythm');
  assert.strictEqual(client.application.techniqueId, 'volume3D');
  assert.strictEqual(client.texture.recipeId, 'arabic');
  assert.deepStrictEqual(client.texture.legacyDescriptor, { ...arabic.texture });
});

test('3. analytics accepts arabic as a design_id and still rejects unknown ids', () => {
  Analytics._resetForTests();
  const log = [];
  Analytics._setProviderForTests({ name: 'fake', loaded: false, load() { this.loaded = true; }, send(name, props) { log.push({ name, props }); } });
  Analytics.setConsent(true);
  assert.strictEqual(Analytics.track('lash_map_opened', { design_id: 'arabic', origin: 'all_designs' }), true);
  assert.deepStrictEqual(log.map(e => e.props.design_id), ['arabic']);
  assert.strictEqual(Analytics.track('lash_map_opened', { design_id: 'not-a-design', origin: 'all_designs' }), false);
  Analytics._resetForTests();
});

test('4. arabic can never displace an existing recommendation winner (and the 21-design ranking is unchanged)', () => {
  const without = makeEngine(DESIGN_CATALOG.filter(e => e.id !== 'arabic'));
  const tilts = [['upturned', 8], ['neutral', 0], ['downturned', -7]];
  let checked = 0;
  for (const [tiltTendency, tiltDegrees] of tilts) for (const relativeEyeSize of [.28, .34, .42]) for (const shape of [{ round: .7, almond: .2, elongated: .1 }, { round: .1, almond: .3, elongated: .6 }])
    for (const flags of [{ isCloseSet: true }, { isWideSet: true }, {}]) for (const lang of ['ru', 'en', 'ar']) {
      const c = { ...profile, tiltTendency, tiltDegrees, tiltConfidence: .8, relativeEyeSize, shapeTendencies: shape, isCloseSet: false, isWideSet: false, ...flags };
      const all = engine.rankDesignsAll(c, lang), ref = without.rankDesignsAll(c, lang);
      const a = all.find(d => d.id === 'arabic');
      assert.strictEqual(a.score, 0);
      assert.strictEqual(all[all.length - 1].id, 'arabic', 'arabic ranks last even at a score tie (stable sort, last in catalog)');
      assert.deepStrictEqual(all.filter(d => d.id !== 'arabic').map(d => [d.id, d.score]), ref.map(d => [d.id, d.score]));
      assert.deepStrictEqual(engine.rankDesigns(c, lang).map(d => d.id), without.rankDesigns(c, lang).map(d => d.id));
      checked++;
    }
  assert.ok(checked >= 100);
});

// ---- geometry: independent expectation built from the approved spec, not from the implementation ----
const ZONES = [6, 7, 9, 12, 10], POS = [0, .20, .46, .74, 1], PEAK_T = .74;
const baseAtCentre = t => { for (let i = 0; i < 4; i++) if (t <= POS[i + 1]) return ZONES[i] + (ZONES[i + 1] - ZONES[i]) * (t - POS[i]) / (POS[i + 1] - POS[i]); return ZONES[4]; };
const taper = t => t <= PEAK_T ? 1 : 1 - .4 * Math.min(1, (t - PEAK_T) / (1 - PEAK_T));
const geom = computeSpikeGeometry(ZONES, { ...arabic.texture }, 3, POS);
const groupsOf = g => Array.from({ length: 6 }, (_, k) => g.spikes.filter(s => s.group === k));

test('5. arabic produces exactly 6 groups / 18 lashes (6 LONG)', () => {
  assert.strictEqual(geom.pattern, 'arabic'); assert.strictEqual(geom.groups, 6);
  assert.strictEqual(geom.spikes.length, 18); assert.strictEqual(geom.count, 6);
  assert.deepStrictEqual(groupsOf(geom).map(g => g.length), [3, 3, 3, 3, 3, 3]);
});

test('6. every group contains exactly 3 levels: SHORT -> MEDIUM -> LONG', () => {
  for (const g of groupsOf(geom)) {
    assert.deepStrictEqual(g.map(s => s.level), ['short', 'medium', 'long']);
    assert.deepStrictEqual(g.map(s => s.tall), [false, false, true]);
    assert.ok(g[0].spikeLen < g[1].spikeLen && g[1].spikeLen < g[2].spikeLen);
  }
});

test('7. SHORT / MEDIUM / LONG of one group use the SAME base, sampled at the GROUP CENTRE', () => {
  groupsOf(geom).forEach((g, k) => {
    const centre = (k + .5) / 6;
    assert.ok(g.every(s => s.baseLen === g[0].baseLen), 'one shared base per group');
    assert.ok(Math.abs(g[0].baseLen - r1(baseAtCentre(centre))) < 1e-9, `group ${k} base = map at centre ${centre}`);
    assert.ok(Math.abs(g[1].t - centre) < 1e-12, 'the MEDIUM lash sits exactly on the group centre');
    assert.strictEqual(g[0].spikeLen, g[0].baseLen, 'SHORT = group-centre base');
  });
});

test('8. pre-peak level steps are exactly +1.5 mm (SHORT->MEDIUM) and +1.5 mm (MEDIUM->LONG)', () => {
  let prePeak = 0;
  groupsOf(geom).forEach((g, k) => {
    if ((k + .5) / 6 > PEAK_T) return;
    prePeak++;
    assert.ok(Math.abs(g[1].spikeLen - g[0].spikeLen - 1.5) < 1e-9, `group ${k} S->M`);
    assert.ok(Math.abs(g[2].spikeLen - g[1].spikeLen - 1.5) < 1e-9, `group ${k} M->L`);
  });
  assert.strictEqual(prePeak, 4);
});

test('9. the approved 60% post-peak taper is applied to the additions (with a 1 mm minimum step)', () => {
  const post = groupsOf(geom).filter((g, k) => (k + .5) / 6 > PEAK_T);
  assert.strictEqual(post.length, 2);
  post.forEach(g => {
    const centre = g[1].t, tp = taper(centre), base = r1(baseAtCentre(centre));
    const medium = r1(Math.max(baseAtCentre(centre) + 1.5 * tp, base + 1)), long = r1(Math.max(baseAtCentre(centre) + 3.0 * tp, medium + 1));
    assert.ok(Math.abs(g[1].spikeLen - medium) < 1e-9, 'MEDIUM follows the tapered addition');
    assert.ok(Math.abs(g[2].spikeLen - long) < 1e-9, 'LONG follows the tapered addition');
  });
  const last = post[1];
  assert.ok(last[2].spikeLen - last[0].spikeLen < 3.0, 'the outer-most trio is visibly shorter than the full +3.0');
  assert.ok(last[2].spikeLen - last[1].spikeLen >= 1 && last[1].spikeLen - last[0].spikeLen >= 1, 'levels stay at least 1 mm apart');
});

test('10. tight grouping uses the approved spread (~3.0 renderer units between lashes, ~1.0% of eye width)', () => {
  assert.strictEqual(arabic.texture.spread, .062);
  groupsOf(geom).forEach((g, k) => {
    assert.ok(Math.abs(g[1].t - (k + .5) / 6) < 1e-12, 'group centres keep the (k+1/2)/6 rhythm');
    for (const [a, b] of [[g[0], g[1]], [g[1], g[2]]]) {
      const units = (b.t - a.t) * 290;                      // diagram: x = 55 + t * 290
      assert.ok(Math.abs(units - 3.0) < 0.06, `spacing ${units.toFixed(3)} u`);
      assert.ok(Math.abs((b.t - a.t) * 100 - 1.0) < 0.05);
    }
  });
});

test('11. existing uniform / kim / manga geometry is bit-for-bit identical to the stable baseline', () => {
  let cases = 0;
  const maps = [[7, 8, 9, 9, 8], [6, 7, 9, 12, 11], [7, 8, 10, 12, 10], [6, 10, 7, 11, 8], [5, 5, 8, 11, 10], [10, 10, 10, 10, 10]];
  const textures = [{ pattern: 'uniform', frequency: 2, baseToSpikeDiff: 1.5 }, { pattern: 'uniform', frequency: 4, baseToSpikeDiff: 2 }, { pattern: 'kim', frequency: 3, baseToSpikeDiff: 3 }, { pattern: 'manga', frequency: 2, baseToSpikeDiff: 4 }, { pattern: 'manga', frequency: 5, baseToSpikeDiff: 1 }];
  for (const z of maps) for (const tex of textures) {
    const expected = JSON.stringify(baselineSpikeGeometry(z, tex));
    assert.strictEqual(JSON.stringify(computeSpikeGeometry(z, tex)), expected);
    assert.strictEqual(JSON.stringify(computeSpikeGeometry(z, tex, 3, POS)), expected, 'the new optional peak/positions arguments never change a non-Arabic pattern');
    cases++;
  }
  assert.strictEqual(computeSpikeGeometry([7, 8, 9, 9, 8], null), null);
  assert.ok(cases >= 30);
});

test('12. the Arabic Lash Map / DIAGRAM data path does not throw and carries the six trios for LEFT and RIGHT', () => {
  const design = engine.buildDesignResult(arabic, profile, 'ru');
  const client = Domain.legacyToClientLashDesign({ design, catalogEntry: arabic, eyeProfile: profile, expandSectors: expandLashMapSectors });
  for (const side of ['left', 'right']) {
    const zones = side === 'left' ? design.leftZones : design.rightZones, peakIdx = side === 'left' ? design.leftPeakZone : design.rightPeakZone;
    const spikeGeom = computeSpikeGeometry(zones, design.texture, peakIdx, design.curve.zonePositions);
    const runtime = Domain.withDiagramRuntime(client, { activeSide: side, zones, peakIdx, spikeGeometry: spikeGeom, curve: design.curve, curl: design.curlRec.primary, technique: design.defaultTechnique });
    const props = Domain.diagramPropsFromClientDesign(runtime);
    assert.strictEqual(props.spikeGeom.pattern, 'arabic'); assert.strictEqual(props.spikeGeom.spikes.length, 18);
    assert.strictEqual(props.curl, 'LC'); assert.ok(expandLashMapSectors(props.zones, props.peakIdx, props.curve).length > 5);
    assert.ok(props.spikeGeom.spikes.every(s => Number.isFinite(s.t) && Number.isFinite(s.spikeLen) && s.spikeLen > 0));
  }
  // custom-mode style texture (only pattern/frequency/baseToSpikeDiff) still resolves to an approved-shaped Arabic geometry
  const custom = computeSpikeGeometry(ZONES, { pattern: 'arabic', frequency: 3, baseToSpikeDiff: 3 }, 3, POS);
  assert.deepStrictEqual(custom.spikes.map(s => s.spikeLen), geom.spikes.map(s => s.spikeLen));
});

test('13. RU / EN / AR naming resolves to Арабский / Arabic / عربي (and no other design changed its name)', () => {
  const expected = { ru: 'Арабский', en: 'Arabic', ar: 'عربي' };
  for (const lang of ['ru', 'en', 'ar']) {
    assert.strictEqual(engine.buildDesignResult(arabic, profile, lang).name, expected[lang], `buildDesignResult/${lang}`);
    assert.strictEqual(engine.localizeDesign({ id: 'arabic', name: 'x' }, profile, lang).name, expected[lang], `localizeDesign/${lang}`);
  }
  for (const entry of DESIGN_CATALOG.filter(e => e.id !== 'arabic')) {
    assert.strictEqual(engine.buildDesignResult(entry, profile, 'ar').name, entry.ruName, `${entry.id}/ar keeps its RU-name behaviour`);
    assert.strictEqual(engine.buildDesignResult(entry, profile, 'en').name, entry.enName);
  }
});
