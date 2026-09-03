// SECURITY-1 — regression tests for the two approved pre-client fixes:
// (1) @babel/standalone pinned to an exact version (was unpinned/"latest"
//     -- audited HIGH supply-chain finding), (2) a concise, audit-accurate
// RU/EN on-device-processing privacy disclosure on HomeScreen. Extracts
// real markers/values straight out of index.html (same technique as every
// other test in this project) -- never a hand-duplicated copy.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
let pass = 0, fail = 0;
function test(name, fn) { try { fn(); pass++; console.log(`  ok  - ${name}`); } catch (e) { fail++; console.log(`FAIL  - ${name}\n        ${e.message}`); } }

// ------------------------------------------------------------
// A. Babel pin
// ------------------------------------------------------------
test('A. @babel/standalone is loaded from an exact-version URL, not an unversioned "latest" URL', () => {
  // SECURITY-2C (later, approved) added crossorigin/integrity attributes
  // to this same tag -- this assertion checks the pinned URL itself
  // (this test's actual concern), not the full tag string, so it stays
  // correct across that legitimate addition. See
  // tests/security-2c-cdn-pinning-sri.test.js for the SRI/crossorigin
  // assertions themselves.
  assert.ok(
    src.includes('<script src="https://unpkg.com/@babel/standalone@8.0.4/babel.min.js"'),
    'expected the exact pinned Babel URL to be present'
  );
  assert.ok(
    !/unpkg\.com\/@babel\/standalone\/babel\.min\.js/.test(src),
    'the old unversioned URL must no longer appear anywhere in index.html'
  );
});

// ------------------------------------------------------------
// B/C/D. Privacy disclosure -- extract the real STRINGS entry and the
// real render site, same extraction pattern as
// tests/lash-map-localization.test.js.
// ------------------------------------------------------------
function extractObjectLiteral(name) {
  const start = src.indexOf('const ' + name + ' = {');
  const braceStart = src.indexOf('{', start);
  let depth = 0, i = braceStart;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) break; }
  }
  return src.slice(braceStart, i + 1);
}
const stringsLiteral = extractObjectLiteral('STRINGS');
assert.ok(stringsLiteral.length > 0, 'setup: STRINGS must be structurally extractable');
const STRINGS = new Function(`return ${stringsLiteral};`)();

test('B. RU on-device-analysis privacy disclosure exists and is non-empty', () => {
  assert.ok(STRINGS.onDeviceAnalysisDisclosure, 'onDeviceAnalysisDisclosure key must exist in STRINGS');
  const ru = STRINGS.onDeviceAnalysisDisclosure.ru;
  assert.ok(typeof ru === 'string' && ru.trim().length > 0, 'RU text must be a non-empty string');
  // Audit-accuracy anchors: must name on-device processing AND the real
  // external-CDN dependency -- must not just say "your data is safe"
  // without naming the actual current behavior the audit proved.
  assert.ok(/устройств/.test(ru), 'RU must mention on-device processing');
  assert.ok(/CDN/.test(ru), 'RU must name the external CDN dependency (must not imply zero external network use)');
  assert.ok(/не отправ/.test(ru), 'RU must state photos/frames/results are not sent');
});

test('C. EN on-device-analysis privacy disclosure exists and is non-empty', () => {
  const en = STRINGS.onDeviceAnalysisDisclosure.en;
  assert.ok(typeof en === 'string' && en.trim().length > 0, 'EN text must be a non-empty string');
  assert.ok(/device/i.test(en), 'EN must mention on-device processing');
  assert.ok(/CDN/.test(en), 'EN must name the external CDN dependency (must not imply zero external network use)');
  assert.ok(/not sent/i.test(en), 'EN must state photos/frames/results are not sent');
});

test('D. RU and EN disclosure are a real distinct translated pair (not placeholder/duplicate text), both scoped to the same claims', () => {
  const { ru, en } = STRINGS.onDeviceAnalysisDisclosure;
  assert.notStrictEqual(ru, en, 'RU and EN must actually be different (real translations, not a copy-pasted placeholder)');
  // Same two-sentence shape in both languages -- a light structural
  // proxy for "semantically equivalent scope", not a full NLP check.
  assert.strictEqual((ru.match(/\./g) || []).length, (en.match(/\./g) || []).length, 'RU/EN should carry the same number of sentences/claims');
  // Neither language may overclaim beyond what the audit proved.
  for (const [lang, text] of [['ru', ru], ['en', en]]) {
    assert.ok(!/GDPR/i.test(text), `${lang}: must not add legal compliance claims`);
    assert.ok(!/biometric.*(certif|complian)/i.test(text) && !/биометр.*(сертифиц|соответств)/i.test(text), `${lang}: must not claim biometric certification/compliance`);
    assert.ok(!/permanent(ly)? delet/i.test(text) && !/навсегда удал/i.test(text), `${lang}: must not claim permanent deletion the UI doesn't guarantee`);
  }
});

test('disclosure is actually rendered on HomeScreen via t(), not just declared and orphaned', () => {
  const homeScreenStart = src.indexOf('function HomeScreen(');
  const homeScreenEnd = src.indexOf('\n    function ', homeScreenStart + 1);
  const homeScreenSource = src.slice(homeScreenStart, homeScreenEnd);
  assert.ok(homeScreenSource.includes("{t('onDeviceAnalysisDisclosure', lang)}"), 'HomeScreen must render the disclosure via the real t() localization helper');
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
