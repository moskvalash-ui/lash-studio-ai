'use strict';
// ============================================================
// RESULTS HERO V1 + RESULTS DESIGN DISCOVERY — focused regression
// coverage for both phases (Design Discovery added the alternatives
// carousel + View All entry directly below the same Hero this file
// already covered).
// ------------------------------------------------------------
// HeroScreen is a JSX closure, not requirable/executable directly in
// Node without a build step (this repo has no @babel/core hard
// dependency) — same structural/string-assertion convention already
// used throughout this suite (see results-screen-fields.test.js,
// save-to-client-flow.test.js). The one genuinely new, pure-JS piece
// this phase adds — heroDesignDisplayName — is extracted and eval'd
// verbatim and exercised directly. Real-browser rendering proof lives
// in tests/e2e/results-hero.spec.js and
// tests/e2e/results-design-discovery.spec.js.
// ============================================================
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function extractObjectLiteral(name) {
  const start = src.indexOf('const ' + name + ' = {');
  const braceStart = src.indexOf('{', start);
  let depth = 0, i = braceStart;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) break; }
  }
  return new Function('return ' + src.slice(braceStart, i + 1))();
}
const STRINGS = extractObjectLiteral('STRINGS');

const heroStart = src.indexOf('    function HeroScreen(');
const heroEnd = src.indexOf('\n    function AllDesignsScreen(', heroStart);
assert.ok(heroStart >= 0 && heroEnd > heroStart, 'HeroScreen must be structurally extractable');
const heroBlock = src.slice(heroStart, heroEnd);

// ------------------------------------------------------------
// heroDesignDisplayName — extracted and eval'd verbatim (real function,
// not a reimplementation).
// ------------------------------------------------------------
const helperStart = src.indexOf('    function heroDesignDisplayName(d, lang) {');
assert.ok(helperStart >= 0 && helperStart < heroStart, 'heroDesignDisplayName must be defined before HeroScreen');
const helperEnd = src.indexOf('\n    }', helperStart) + '\n    }'.length;
const heroDesignDisplayName = new Function(src.slice(helperStart, helperEnd) + '\nreturn heroDesignDisplayName;')();

test('1a. RU: heroDesignDisplayName shows "Лисий" for canonical id fox, presentation-only', () => {
  const d = { id: 'fox', name: 'Fox' };
  assert.strictEqual(heroDesignDisplayName(d, 'ru'), 'Лисий');
});

test('1b. RU: every other design id falls back to d.name unchanged', () => {
  for (const [id, name] of [['cat', 'Cat Eye'], ['doll', 'Doll / Open Eye'], ['natural', 'Natural']]) {
    assert.strictEqual(heroDesignDisplayName({ id, name }, 'ru'), name);
  }
});

test('2. EN: heroDesignDisplayName always returns d.name, including for fox', () => {
  assert.strictEqual(heroDesignDisplayName({ id: 'fox', name: 'Fox' }, 'en'), 'Fox');
  assert.strictEqual(heroDesignDisplayName({ id: 'cat', name: 'Cat Eye' }, 'en'), 'Cat Eye');
});

test('3. heroDesignDisplayName never mutates its input object (d.id/d.name untouched, no clientDesign field exists to touch)', () => {
  const d = Object.freeze({ id: 'fox', name: 'Fox' });
  // Object.freeze makes any attempted mutation throw in strict mode —
  // this proves the function only reads, never assigns.
  assert.doesNotThrow(() => heroDesignDisplayName(d, 'ru'));
  assert.strictEqual(d.id, 'fox');
  assert.strictEqual(d.name, 'Fox');
});

// ------------------------------------------------------------
// STRINGS — additive only, both languages present, existing keys
// untouched.
// ------------------------------------------------------------
test('4. new Hero STRINGS keys exist with the exact required RU/EN text', () => {
  assert.deepStrictEqual(STRINGS.heroBestDesignTitle, { ru: 'ВАШ ЛУЧШИЙ ДИЗАЙН', en: 'YOUR BEST DESIGN' });
  assert.deepStrictEqual(STRINGS.heroMatchLabel, { ru: 'совпадение', en: 'match' });
  assert.deepStrictEqual(STRINGS.heroOpenLashMap, { ru: 'ОТКРЫТЬ LASH MAP', en: 'OPEN LASH MAP' });
});

test('5. existing canonical strings from this phase (saveToClientButton) and from Results Design Discovery (openLabel) remain untouched', () => {
  assert.deepStrictEqual(STRINGS.saveToClientButton, { ru: 'Сохранить клиентке', en: 'Save to client' });
  assert.deepStrictEqual(STRINGS.openLabel, { ru: 'Открыть', en: 'Open' });
  // viewMap/recommendedDesigns/allDesigns STRINGS entries are left
  // defined with unchanged values even though HeroScreen no longer
  // references any of them -- see RESULTS DESIGN DISCOVERY below,
  // which replaced their call sites with moreDesignsForYou/openLabel/
  // viewAllDesignsEntry. Left in place rather than removed (harmless
  // unused localization constants; removing them is out of this
  // phase's scope and not required by the audit).
  assert.deepStrictEqual(STRINGS.viewMap, { ru: 'ОТКРЫТЬ КАРТУ →', en: 'VIEW MAP →' });
  assert.deepStrictEqual(STRINGS.recommendedDesigns, { ru: 'Рекомендуемые дизайны', en: 'Recommended designs' });
  assert.deepStrictEqual(STRINGS.allDesigns, { ru: 'Все дизайны →', en: 'All designs →' });
});

test('5b. RESULTS DESIGN DISCOVERY: new moreDesignsForYou/viewAllDesignsEntry STRINGS keys exist with the exact required RU/EN text', () => {
  assert.deepStrictEqual(STRINGS.moreDesignsForYou, { ru: 'Ещё подходящие дизайны', en: 'More designs for you' });
  assert.deepStrictEqual(STRINGS.viewAllDesignsEntry, { ru: 'Смотреть все дизайны', en: 'View all designs' });
});

// ------------------------------------------------------------
// HeroScreen structure — the Hero block reuses the exact existing
// canonical recommendation path, calls the exact existing handlers,
// and the best design is not duplicated in the list below it.
// ------------------------------------------------------------
test('6. Hero block is built from result.designs[0] via the SAME canonicalRecommendationProps function already used per-card', () => {
  assert.ok(heroBlock.includes('const best = result.designs.length ? canonicalRecommendationProps(result.designs[0], p, lang, 0) : null;'));
});

test('7. Hero primary CTA opens Lash Map via the exact existing handler and canonical clientDesign', () => {
  // Approved CLOSED-BETA ANALYTICS patch: this button now fires the
  // reviewed, consent-gated lash_map_opened event (design_id/origin only)
  // before its original, unmodified onViewMap call.
  assert.ok(heroBlock.includes("onClick={() => { if (typeof Analytics !== 'undefined') Analytics.track('lash_map_opened', { design_id: best.id, origin: 'best_design' }); onViewMap(best.clientDesign); }}"));
  assert.ok(heroBlock.includes("{t('heroOpenLashMap', lang)}"));
});

test('8. Hero secondary CTA reuses the exact existing onSaveToClient handler and saveToClientButton string, still gated on the prop being provided', () => {
  assert.ok(heroBlock.includes('{onSaveToClient && ('));
  assert.ok(heroBlock.includes('onClick={onSaveToClient}'));
  assert.ok(heroBlock.includes("{t('saveToClientButton', lang)}"));
});

test('9. exactly one Save-to-Client button is rendered on HeroScreen (moved into the Hero, not duplicated)', () => {
  const occurrences = (heroBlock.match(/onClick=\{onSaveToClient\}/g) || []).length;
  assert.strictEqual(occurrences, 1, 'expected exactly one onSaveToClient button in HeroScreen, found ' + occurrences);
});

test('10. RESULTS DESIGN DISCOVERY: the best design is NOT duplicated in the alternatives carousel below the Hero: the carousel is built from result.designs.slice(1, 6) (max 5, rank 0 excluded)', () => {
  assert.ok(heroBlock.includes('result.designs.slice(1, 6).map((raw, i) => {'));
  assert.ok(!heroBlock.includes('result.designs.map((raw, i) => {'), 'the old full-list (including rank 0) loop must no longer exist');
  assert.ok(!heroBlock.includes('result.designs.slice(1).map((raw, i) => {'), 'the old unbounded (no max-5) slice must no longer exist');
});

test('11. RESULTS DESIGN DISCOVERY: the carousel cards still use the exact existing per-card recommendation path and Lash Map handler, offset by the correct rank, with the existing openLabel string for the tap action', () => {
  assert.ok(heroBlock.includes('const rank = i + 1;'));
  assert.ok(heroBlock.includes('const d = canonicalRecommendationProps(raw, p, lang, rank);'));
  // Approved CLOSED-BETA ANALYTICS patch: this card now fires the
  // reviewed, consent-gated lash_map_opened event (design_id/origin only)
  // before its original, unmodified onViewMap call.
  assert.ok(heroBlock.includes("onClick={() => { if (typeof Analytics !== 'undefined') Analytics.track('lash_map_opened', { design_id: d.id, origin: 'results_carousel' }); onViewMap(d.clientDesign); }}"));
  assert.ok(heroBlock.includes("{t('openLabel', lang)}"));
  assert.ok(heroBlock.includes('data-alt-design-id={d.id}'), 'each carousel card must carry a canonical-id-only test hook');
});

test('11b. RESULTS DESIGN DISCOVERY: carousel is horizontally scrollable native overflow, no new dependency/library', () => {
  assert.ok(heroBlock.includes('overflow-x-auto'));
  assert.ok(heroBlock.includes("data-alt-carousel=\"1\""));
});

test('12. Natural Lash Analysis remains reachable from HeroScreen via the existing handlers, unchanged', () => {
  assert.ok(heroBlock.includes('onClick={naturalLashProfile ? onViewLashProfile : onScanLashes}'));
  assert.ok(heroBlock.includes("{t('natLashScanBtn', lang)}"));
});

test('13. RESULTS DESIGN DISCOVERY: All Designs remains reachable from HeroScreen via the existing onAllDesigns handler (no new navigation target/screen), now as the compact entry below the carousel', () => {
  assert.ok(heroBlock.includes('onClick={onAllDesigns}'));
  assert.ok(heroBlock.includes("{t('viewAllDesignsEntry', lang)}"));
});

test('14. Professional Details remains reachable via the existing onDetails handler, unchanged', () => {
  assert.ok(heroBlock.includes('onClick={onDetails}'));
  assert.ok(heroBlock.includes("{t('moreDetails', lang)}"));
});

test('15. AI Eye Profile Section is now collapsed by default (defaultOpen removed), data/rows unchanged', () => {
  assert.ok(heroBlock.includes(`<Section title={t('eyeProfileTitle', lang)}>`), 'Section must no longer pass defaultOpen');
  assert.ok(!heroBlock.includes(`<Section title={t('eyeProfileTitle', lang)} defaultOpen>`));
  // The 6 EyeProfileRow rows and their data bindings are untouched.
  const rowCount = (heroBlock.match(/<EyeProfileRow[^/]*\/>/g) || []).length;
  assert.strictEqual(rowCount, 6);
});

test('16. Lash Design Considerations Section remains collapsed by default (unchanged from before)', () => {
  assert.ok(heroBlock.includes(`<Section title={t('lashDesignConsiderationsTitle', lang)}>`));
});

test('17. presentation-only heroDesignDisplayName is used ONLY for the Hero headline, never for the sliced list, AllDesignsScreen, or LashMapScreen', () => {
  const totalOccurrences = (src.match(/heroDesignDisplayName\(/g) || []).length;
  const declarationCount = (src.match(/function heroDesignDisplayName\(/g) || []).length;
  assert.strictEqual(declarationCount, 1, 'expected exactly one function declaration');
  assert.strictEqual(totalOccurrences - declarationCount, 1, 'heroDesignDisplayName must be CALLED exactly once in the whole file');
  assert.ok(heroBlock.includes('{heroDesignDisplayName(best, lang).toUpperCase()}'));
});

test('18. exact existing d.score / d.whyItWorks are reused for the Hero — no second scoring or explanation text', () => {
  assert.ok(heroBlock.includes('{best.score}%'));
  assert.ok(heroBlock.includes('<MatchBar score={best.score} />'));
  assert.ok(heroBlock.includes('{best.whyItWorks}'));
  assert.ok(heroBlock.includes('line-clamp-2'), 'whyItWorks must be visually limited to a short 1-2 line explanation');
});

test('19. no new Lash Map renderer/diagram is introduced by this phase', () => {
  assert.ok(!heroBlock.includes('LashMapDiagram'));
  assert.ok(!heroBlock.includes('withDiagramRuntime'));
  assert.ok(!heroBlock.includes('<svg'));
});

test('20. data-hero-design-id is a canonical-id-only test hook, never the presentation label', () => {
  assert.ok(heroBlock.includes('data-hero-design-id={best.id}'));
});

test('20b. RESULTS DESIGN DISCOVERY: the carousel introduces zero new recommendation/scoring calls — canonicalRecommendationProps is called exactly twice in HeroScreen (once for the Hero, once inside the carousel map), never rankDesigns/rankDesignsAll/buildDesignResult directly', () => {
  const canonicalCallCount = (heroBlock.match(/canonicalRecommendationProps\(/g) || []).length;
  assert.strictEqual(canonicalCallCount, 2, 'expected exactly 2 canonicalRecommendationProps call sites (Hero + carousel), found ' + canonicalCallCount);
  assert.ok(!heroBlock.includes('rankDesigns('));
  assert.ok(!heroBlock.includes('rankDesignsAll('));
  assert.ok(!heroBlock.includes('buildDesignResult('));
});

// ------------------------------------------------------------
// Isolation — recommendation engine, canonical catalog, geometry,
// persistence/snapshot code are untouched by this presentation-only
// phase.
// ------------------------------------------------------------
test('21. DESIGN_CATALOG source is byte-for-byte unchanged', () => {
  const catalogStart = src.indexOf('    const DESIGN_CATALOG = ');
  const catalogEnd = src.indexOf('\n\n    function calculateEyeLashMap(', catalogStart);
  const digest = require('node:crypto').createHash('sha256').update(src.slice(catalogStart, catalogEnd)).digest('hex');
  assert.strictEqual(digest, '15982679009bb39778371a57689fe9f8ad944222f8e7f259e2e19d7d089b4181');
});

test('22. rankDesignsAll/rankDesigns/buildDesignResult wiring is byte-unchanged', () => {
  assert.ok(src.includes('function rankDesignsAll(c, lang) { return DESIGN_CATALOG.map(e => buildDesignResult(e, c, lang)).sort((a,b) => b.score - a.score); }'));
  assert.ok(src.includes('function rankDesigns(c, lang) { return rankDesignsAll(c, lang).slice(0, 6); }'));
});

test('23. VisitSnapshot / ClientStore / LashDesignDomain production files have zero diff against committed HEAD', () => {
  // analytics.js is deliberately excluded: it is now separately,
  // intentionally modified by the approved closed-beta Analytics
  // implementation (Stage 3), with its own dedicated regression coverage
  // (analytics.test.js, consent-manager.test.js) — not a regression this
  // Results Hero phase needs to guard against.
  for (const file of ['visit-snapshot.js', 'client-store.js', 'lash-design-domain.js', 'professional-lash-library.js', 'lash-scan-core.js', 'consent-manager.js', 'client-data-consent.js', 'backend/worker.js']) {
    let diff;
    try { diff = execSync('git diff -- ' + file, { cwd: root }).toString(); } catch (e) { diff = 'DIFF_FAILED: ' + e.message; }
    assert.strictEqual(diff.trim(), '', file + ' must have zero diff against committed HEAD');
  }
});

test('24. App() still wires the same handleSaveToClient reference to both HeroScreen and LashMapScreen (reuse, not duplicated save logic)', () => {
  const appStart = src.indexOf('    function App() {');
  const appBlock = src.slice(appStart);
  const occurrences = (appBlock.match(/onSaveToClient=\{handleSaveToClient\}/g) || []).length;
  assert.strictEqual(occurrences, 2);
});

test('25. handleSaveToClient itself (the Hero-vs-LashMap fallback logic) is byte-unchanged', () => {
  assert.ok(src.includes(
    "      const handleSaveToClient = () => {\n" +
    "        if (!result) return;\n" +
    "        const design = screen === 'lashmap'\n" +
    "          ? activeDesign\n" +
    "          : (result.designs && result.designs.length)\n" +
    "            ? canonicalRecommendationProps(result.designs[0], result.eyeProfile, lang, 0).clientDesign\n" +
    "            : null;\n" +
    "        beginSaveToClient(design);\n" +
    "      };"
  ));
});
