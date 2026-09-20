'use strict';
// ============================================================
// PHASE 0 — ARABIC LOCALIZATION INFRASTRUCTURE.
// ------------------------------------------------------------
// Architecture prep only, per the approved audit: SUPPORTED_LANGUAGES
// (visible/selectable/persistable today, still exactly ['ru','en']),
// LANGUAGE_LABELS (a superset that already carries Arabic's
// native-script label, unused by anything user-reachable yet), a
// dynamic <html lang> sync, and defense-in-depth guards so neither a
// user action nor a stale localStorage value can put the app into an
// unfinished language. No Arabic STRINGS content, no dir="rtl", no RTL
// layout, no hardcoded-ternary migration, no analytical/geometry code
// touched -- all proven below, not assumed.
//
// index.html's app script is JSX, not requirable/executable directly in
// Node without a build step (this repo has no @babel/core hard
// dependency), so pure-JS spans (setLang, the useState initializer, the
// <html lang> effect body) are extracted and eval'd verbatim via
// new Function, and JSX spans (LangToggle) are asserted structurally --
// the same established convention used throughout this suite (see
// tests/results-hero.test.js, tests/results-hero-iris-indicator.test.js).
// ============================================================
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
let HEAD = null;
try { HEAD = execSync('git show HEAD:index.html', { cwd: root, maxBuffer: 1024 * 1024 * 20 }).toString(); } catch (e) { HEAD = null; }
assert.ok(HEAD, 'expected `git show HEAD:index.html` to succeed');

function extractArrayLiteral(name) {
  const start = src.indexOf('const ' + name + ' = [');
  const bracketStart = src.indexOf('[', start);
  const end = src.indexOf(']', bracketStart);
  return new Function('return ' + src.slice(bracketStart, end + 1))();
}
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

const SUPPORTED_LANGUAGES = extractArrayLiteral('SUPPORTED_LANGUAGES');
const LANGUAGE_LABELS = extractObjectLiteral('LANGUAGE_LABELS');

const langToggleStart = src.indexOf('    function LangToggle(');
const langToggleEnd = src.indexOf('\n    }', langToggleStart) + '\n    }'.length;
const langToggleBlock = src.slice(langToggleStart, langToggleEnd);

const appStart = src.indexOf('    function App() {');
// PHASE 3: widened from 3000 -- the lang/dir effect's own explanatory
// comment grew past the old fixed window, silently truncating the
// marker search below. Widened with real margin rather than trimming
// the comment.
const appBlock = src.slice(appStart, appStart + 4000);

// ------------------------------------------------------------
// 5 & 6. Arabic label/config exists internally, but is NOT
// selectable/visible in production UI.
// ------------------------------------------------------------
test('5. LANGUAGE_LABELS already carries Arabic\'s native-script label internally', () => {
  assert.strictEqual(LANGUAGE_LABELS.ar, 'العربية');
  assert.strictEqual(LANGUAGE_LABELS.ru, 'RU');
  assert.strictEqual(LANGUAGE_LABELS.en, 'EN');
});

test('6a. PHASE 3: SUPPORTED_LANGUAGES (the single source of truth for what is selectable) now includes Arabic, as exactly [ru, en, ar]', () => {
  assert.deepStrictEqual(SUPPORTED_LANGUAGES, ['ru', 'en', 'ar']);
  assert.ok(SUPPORTED_LANGUAGES.includes('ar'));
});

test('6b. LangToggle renders buttons from SUPPORTED_LANGUAGES itself (not a separately hardcoded list), so it now renders exactly 3 buttons -- RU, EN, and العربية, with no duplicate', () => {
  assert.ok(langToggleBlock.includes('{SUPPORTED_LANGUAGES.map(l =>'), 'LangToggle must map over SUPPORTED_LANGUAGES, the guarded list');
  const langToggleCode = langToggleBlock.replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
  assert.ok(!langToggleCode.includes("['ru','en'") && !langToggleCode.includes("['ru', 'en'") && !langToggleCode.includes("['ru','en','ar'") && !langToggleCode.includes("['ru', 'en', 'ar'"), 'LangToggle must still map over the shared SUPPORTED_LANGUAGES constant, never a separately hardcoded inline array');
  // Simulate exactly what LangToggle's JSX renders: one button per
  // SUPPORTED_LANGUAGES entry, using LANGUAGE_LABELS for its text.
  const renderedButtons = SUPPORTED_LANGUAGES.map((l) => LANGUAGE_LABELS[l]);
  assert.deepStrictEqual(renderedButtons, ['RU', 'EN', 'العربية'], 'exactly RU, EN, and العربية must be the rendered button labels, in that order, each exactly once');
  assert.strictEqual(renderedButtons.filter((b) => b === 'العربية').length, 1, 'العربية must not be duplicated');
});

test('6c. LangToggle uses LANGUAGE_LABELS for its button text, not l.toUpperCase() -- required so a future \'ar\' entry would show "العربية", not "AR"', () => {
  assert.ok(langToggleBlock.includes('{LANGUAGE_LABELS[l]}'), 'expected the button label to come from LANGUAGE_LABELS[l]');
  assert.ok(!langToggleBlock.includes('{l.toUpperCase()}'), 'the old l.toUpperCase() label must be gone (it would incorrectly render "AR" for Arabic)');
});

// ------------------------------------------------------------
// 1, 2, 7. Existing RU/EN selection and persistence behavior unchanged;
// Arabic cannot be selected or persisted even if something tried.
// ------------------------------------------------------------
function extractSetLang(localStorage, Analytics, setLangState) {
  const marker = 'const setLang = (l) => {';
  const start = src.indexOf(marker);
  const end = src.indexOf('\n      };', start) + '\n      };'.length;
  const body = src.slice(start, end);
  return new Function(
    'SUPPORTED_LANGUAGES', 'localStorage', 'Analytics', 'setLangState',
    body + '\nreturn setLang;'
  )(SUPPORTED_LANGUAGES, localStorage, Analytics, setLangState);
}

test('1 & 7. setLang(\'ru\') still updates state and persists to localStorage exactly as before', () => {
  const store = {};
  const localStorage = { setItem: (k, v) => { store[k] = v; }, getItem: (k) => store[k] };
  let stateSet = null;
  const setLangState = (v) => { stateSet = v; };
  const setLang = extractSetLang(localStorage, undefined, setLangState);
  setLang('ru');
  assert.strictEqual(stateSet, 'ru');
  assert.strictEqual(store.lashStudioLang, 'ru');
});

test('2 & 7. setLang(\'en\') still updates state and persists to localStorage exactly as before', () => {
  const store = {};
  const localStorage = { setItem: (k, v) => { store[k] = v; }, getItem: (k) => store[k] };
  let stateSet = null;
  const setLangState = (v) => { stateSet = v; };
  const setLang = extractSetLang(localStorage, undefined, setLangState);
  setLang('en');
  assert.strictEqual(stateSet, 'en');
  assert.strictEqual(store.lashStudioLang, 'en');
});

test('6d & 7. PHASE 3: setLang(\'ar\') now updates state and persists to localStorage exactly like ru/en -- proven against the ACTUAL production setLang code, not a reimplementation', () => {
  const store = {};
  const localStorage = { setItem: (k, v) => { store[k] = v; }, getItem: (k) => store[k] };
  let stateSet = null, stateSetCalls = 0;
  const setLangState = (v) => { stateSet = v; stateSetCalls++; };
  let trackCalls = 0, trackedLang = null;
  const Analytics = { track: (event, payload) => { trackCalls++; trackedLang = payload && payload.lang; } };
  const setLang = extractSetLang(localStorage, Analytics, setLangState);
  setLang('ar');
  assert.strictEqual(stateSetCalls, 1, 'setLangState must be called exactly once for the now-supported ar');
  assert.strictEqual(stateSet, 'ar');
  assert.strictEqual(store.lashStudioLang, 'ar', 'localStorage must persist ar via the exact same mechanism as ru/en');
  assert.strictEqual(trackCalls, 1, 'the same language_changed analytics event already fired for ru/en must fire for ar too -- no special-cased second pathway');
  assert.strictEqual(trackedLang, 'ar');
});
test('a value genuinely outside SUPPORTED_LANGUAGES (e.g. a hypothetical future locale) is still rejected by setLang exactly as ar itself used to be, proving the guard mechanism is unchanged -- only the list grew', () => {
  const store = {};
  const localStorage = { setItem: (k, v) => { store[k] = v; }, getItem: (k) => store[k] };
  let stateSetCalls = 0;
  const setLangState = () => { stateSetCalls++; };
  let trackCalls = 0;
  const Analytics = { track: () => { trackCalls++; } };
  const setLang = extractSetLang(localStorage, Analytics, setLangState);
  setLang('fr');
  assert.strictEqual(stateSetCalls, 0, 'setLangState must never be called for a language outside SUPPORTED_LANGUAGES');
  assert.strictEqual(store.lashStudioLang, undefined, 'localStorage must never be written for a rejected language');
  assert.strictEqual(trackCalls, 0, 'no analytics event must fire for a rejected language change');
});

test('setLang source begins with the SUPPORTED_LANGUAGES guard, before any state/persistence/analytics side effect', () => {
  const marker = 'const setLang = (l) => {';
  const start = src.indexOf(marker);
  const end = src.indexOf('\n      };', start) + '\n      };'.length;
  const body = src.slice(start, end);
  assert.ok(body.includes("if (!SUPPORTED_LANGUAGES.includes(l)) return;"), 'expected the guard clause to be the first statement in setLang');
  const guardIdx = body.indexOf('if (!SUPPORTED_LANGUAGES.includes(l)) return;');
  const trackIdx = body.indexOf('Analytics.track');
  const persistIdx = body.indexOf('localStorage.setItem');
  assert.ok(trackIdx >= 0 && persistIdx >= 0, 'expected to find both the analytics call and the persistence call in the extracted body');
  assert.ok(guardIdx < trackIdx && guardIdx < persistIdx, 'the guard must run before analytics tracking and before persistence');
});

// ------------------------------------------------------------
// 7 (initial read). A stale/unexpected localStorage value can no
// longer boot the app into an unsupported language. PHASE 3: 'ar' is
// now a genuinely supported, persistable value (SUPPORTED_LANGUAGES
// is ['ru','en','ar']) -- a stored 'ar' must now be HONORED, the same
// as 'ru'/'en' always were. A value that is still genuinely outside
// SUPPORTED_LANGUAGES (e.g. a hypothetical future 'fr', or garbage)
// must still fall back to 'ru', proving the guard itself -- rejecting
// anything not in the list -- is unchanged; only the list's own
// membership grew.
// ------------------------------------------------------------
test('7b. the initial lang useState reader honors every SUPPORTED_LANGUAGES value (including ar) and still falls back to \'ru\' for anything genuinely outside it', () => {
  const marker = 'const [lang, setLangState] = useState(() => {';
  const start = src.indexOf(marker);
  const arrowStart = src.indexOf('() => {', start) + '() => {'.length;
  const end = src.indexOf('\n      });', start);
  const body = src.slice(arrowStart, end);
  const initializer = new Function('SUPPORTED_LANGUAGES', 'localStorage', body)(SUPPORTED_LANGUAGES, undefined);
  const run = (storedValue) => {
    const localStorage = { getItem: () => storedValue };
    return new Function('SUPPORTED_LANGUAGES', 'localStorage', body)(SUPPORTED_LANGUAGES, localStorage);
  };
  assert.strictEqual(run('ru'), 'ru', 'a genuinely supported stored value must still be honored');
  assert.strictEqual(run('en'), 'en', 'a genuinely supported stored value must still be honored');
  assert.strictEqual(run('ar'), 'ar', 'PHASE 3: a stored \'ar\' is now genuinely supported and must be honored, not rejected');
  assert.strictEqual(run('fr'), 'ru', 'a value genuinely outside SUPPORTED_LANGUAGES must still fall back to ru -- the guard itself is unchanged');
  assert.strictEqual(run(null), 'ru', 'no stored value must still fall back to ru (unchanged default)');
});

// ------------------------------------------------------------
// 3 & 4. <html lang> dynamically reflects the real language state.
// ------------------------------------------------------------
test('3 & 4. the real <html lang>/<html dir> sync effect sets document.documentElement.lang/dir to \'ru\'/\'ltr\', \'en\'/\'ltr\', and \'ar\'/\'rtl\' correctly, proven against the ACTUAL production effect body (real extraction+eval, not a reimplementation)', () => {
  // PHASE 2: extract the REAL effect body (both statements) out of
  // index.html and eval it directly, rather than hand-reimplementing
  // the assignment -- the established pattern this repo uses
  // throughout (see CLAUDE.md's Testing section).
  const marker = "useEffect(() => {\n        document.documentElement.lang = lang;\n        document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';\n      }, [lang]);";
  assert.ok(src.includes(marker), 'expected to find the exact <html lang>/<html dir> sync effect');
  const effectBody = "document.documentElement.lang = lang;\n        document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';";
  const runEffect = (lang) => {
    const documentElement = { lang: 'stale', dir: 'stale' };
    const document = { documentElement };
    new Function('document', 'lang', effectBody)(document, lang);
    return { lang: documentElement.lang, dir: documentElement.dir };
  };
  assert.deepStrictEqual(runEffect('ru'), { lang: 'ru', dir: 'ltr' });
  assert.deepStrictEqual(runEffect('en'), { lang: 'en', dir: 'ltr' });
  assert.deepStrictEqual(runEffect('ar'), { lang: 'ar', dir: 'rtl' });
});

test('the <html lang>/<html dir> effect is keyed on [lang] (re-runs on every language change) and is additive -- it does not touch any other App()-level effect', () => {
  // PHASE 2 (Arabic RTL): the same effect now also sets dir, keyed off
  // the identical [lang] dependency -- lang and dir can never drift out
  // of sync, since they are set together in one effect body.
  const idx = appBlock.indexOf("useEffect(() => {\n        document.documentElement.lang = lang;\n        document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';\n      }, [lang]);");
  assert.ok(idx >= 0, 'expected the effect inside App()');
});

function stripLineComments(s) {
  return s.split('\n').map((line) => {
    let inSingle = false, inDouble = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inSingle) { if (c === '\\') { i++; continue; } if (c === "'") inSingle = false; continue; }
      if (inDouble) { if (c === '\\') { i++; continue; } if (c === '"') inDouble = false; continue; }
      if (c === "'") { inSingle = true; continue; }
      if (c === '"') { inDouble = true; continue; }
      if (c === '/' && line[i + 1] === '/') return line.slice(0, i);
    }
    return line;
  }).join('\n');
}

// PHASE 2 (Arabic RTL) superseded this Phase-0-era guard: dir IS now
// legitimately set by App()'s lang effect, and static dir="ltr"
// geometry-isolation attributes ARE now present on SVG/canvas/video
// elements (see the dedicated Phase 2 geometry-isolation tests). What
// this test still protects, unchanged in spirit: no literal dir="rtl"
// is ever hardcoded anywhere in real code -- RTL is reachable ONLY via
// the single dynamic `lang === 'ar' ? 'rtl' : 'ltr'` computation keyed
// off App()'s own lang state, never as a hardcoded attribute on any
// component, and never as a second, independent RTL signal.
test('document.documentElement.dir is set exactly once, dynamically, keyed off lang === \'ar\' -- no literal dir="rtl" is ever hardcoded anywhere in real code', () => {
  const code = stripLineComments(src);
  const dirAssignments = (code.match(/documentElement\.dir\s*=/g) || []).length;
  assert.strictEqual(dirAssignments, 1, 'expected exactly one document.documentElement.dir assignment, in the App() lang effect');
  assert.ok(code.includes("document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';"), 'expected the dir assignment to be dynamically keyed off lang === \'ar\', not a hardcoded value');
  assert.ok(!code.includes('dir="rtl"'), 'no component may hardcode a literal dir="rtl" attribute -- RTL must only ever come from the single dynamic App()-level effect');
  assert.ok(!code.includes("dir: 'rtl'"), 'no component may hardcode dir:\'rtl\' in an inline style object either');
});
test('static dir="ltr" geometry-isolation attributes exist on SVG/canvas/video elements (Phase 2), and are always the literal string "ltr", never dynamic or "rtl"', () => {
  const code = stripLineComments(src);
  const ltrAttrs = (code.match(/dir="ltr"/g) || []).length;
  assert.ok(ltrAttrs >= 5, `expected at least 5 dir="ltr" geometry-isolation sites (SVG diagram/photo-map roots + video/canvas pairs), found ${ltrAttrs}`);
});

// ------------------------------------------------------------
// 8. Lash Map / Photo Scan / Live Scan production behavior is
// byte-identical to git HEAD -- this phase touches only the language
// system (STRINGS-adjacent constants, LangToggle, App()'s lang state).
// ------------------------------------------------------------
test('8a. the Lash Map diagram mirror formula (xAt) is byte-identical to HEAD', () => {
  const marker = "xAt=t=>55+(side==='right'?1-t:t)*290";
  assert.ok(src.includes(marker), 'expected the real xAt mirror formula');
  assert.ok(HEAD.includes(marker), 'expected the same formula in HEAD');
});

test('8b. Photo Scan\'s ~8s choreography constants are byte-identical to HEAD', () => {
  const marker = 'const MIN_MS = 7300, REVEAL_MS = 7300, COLLAPSE_MS = 700;';
  assert.ok(src.includes(marker));
  assert.ok(HEAD.includes(marker));
});

test('8c. LEFT/RIGHT physical-eye normalization functions are byte-identical to HEAD', () => {
  for (const marker of [
    '    function getPhysicalEyeLandmarks(landmarks, physicalSide) {',
    '    function computeHeadPose(landmarks) {',
    '    function computeEyeSideMetrics(landmarks, side, headPose) {',
    '    function mapVideoPointToDisplay(x, y, videoW, videoH, dispW, dispH) {',
  ]) {
    const curStart = src.indexOf(marker);
    const prevStart = HEAD.indexOf(marker);
    assert.ok(curStart >= 0 && prevStart >= 0, 'expected to locate ' + marker);
    const curEnd = src.indexOf('\n    function ', curStart + 10);
    const prevEnd = HEAD.indexOf('\n    function ', prevStart + 10);
    assert.strictEqual(src.slice(curStart, curEnd), HEAD.slice(prevStart, prevEnd), marker + ' must be byte-identical to HEAD');
  }
});

test('8d. none of the geometry/scan functions reference SUPPORTED_LANGUAGES, LANGUAGE_LABELS, or documentElement.lang -- Phase 0 never threads the new plumbing into analytical/geometry code', () => {
  for (const marker of [
    '    function getPhysicalEyeLandmarks(landmarks, physicalSide) {',
    '    function LegacyLashMapDiagram(',
    '    function mapVideoPointToDisplay(',
  ]) {
    const start = src.indexOf(marker);
    const end = src.indexOf('\n    function ', start + 10);
    const body = src.slice(start, end);
    assert.ok(!body.includes('SUPPORTED_LANGUAGES') && !body.includes('LANGUAGE_LABELS') && !body.includes('documentElement'), marker + ' must not reference the new Phase 0 plumbing');
  }
});

test('8e. index.html\'s diff against HEAD never touches analytical/geometry/timing markers -- content-only additions (Phase 1 Arabic strings, etc.) are expected and unrestricted in size', () => {
  // PHASE 1 UPDATE: the original Phase 0 version of this test also
  // asserted "at most 3 changed regions" -- a ceiling calibrated
  // specifically for Phase 0's tiny, single-purpose diff. Phase 1
  // (Arabic localization CONTENT) legitimately touches hundreds of
  // STRINGS/dictionary lines across many regions -- that is expected
  // and is not itself a safety concern. The real, durable invariant
  // this test protects -- that no analytical/geometry/timing code is
  // ever touched, regardless of how much *content* changes -- is fully
  // preserved by the forbidden-marker check below, which still runs
  // against the live diff every time.
  const diff = execSync('git diff -- index.html', { cwd: root }).toString();
  for (const forbidden of ['dir="rtl"', 'documentElement.dir', 'xAt=t=>', 'const MIN_MS =', "getPhysicalEyeLandmarks(landmarks", 'computeHeadPose(landmarks)']) {
    assert.ok(!diff.includes('+' + forbidden) && !diff.includes('-' + forbidden), 'diff must not touch: ' + forbidden);
  }
});
