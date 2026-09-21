'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const src = fs.readFileSync(require('node:path').join(__dirname, '../index.html'), 'utf8');
const storageCode = src.slice(src.indexOf('    const ONBOARDING_SEEN_KEY'), src.indexOf('    function OnboardingDialog'));
test('onboarding storage: first visit, persisted dismissal and session fallback', () => {
  for (const blocked of [false, true]) {
    const data = new Map();
    const context = vm.createContext({ localStorage: {
      getItem(k) { if (blocked) throw Error('blocked'); return data.get(k); },
      setItem(k,v) { if (blocked) throw Error('blocked'); data.set(k,v); }
    }});
    vm.runInContext(storageCode, context);
    assert.equal(vm.runInContext('hasSeenOnboarding()', context), false);
    vm.runInContext('markOnboardingSeen()', context);
    assert.equal(vm.runInContext('hasSeenOnboarding()', context), true);
    if (!blocked) {
      assert.equal(data.get('lashStudioOnboardingSeenV1'), '1');
      vm.runInContext('onboardingSeenThisSession = false', context);
      assert.equal(vm.runInContext('hasSeenOnboarding()', context), true);
    }
  }
});
test('onboarding supplies all five complete RU/EN/AR cards', () => {
  for (let i=1; i<=5; i++) for (const part of ['Title','Text']) {
    const value = JSON.parse(src.match(new RegExp('onboarding'+i+part+': (.+),'))[1]);
    for (const lang of ['ru','en','ar']) assert.ok(value[lang].length > 10);
  }
});
test('onboarding is confined to Home UI and reuses the existing live handler', () => {
  const block = src.slice(src.indexOf('    function OnboardingDialog'), src.indexOf('    // Live-camera-only cinematic'));
  assert.match(block, /onStart=\{onLive\}/);
  assert.match(block, /onClose\(\); onStart\(\);/);
  for (const forbidden of ['setScreen(', 'getUserMedia', 'rankDesigns', 'calculateEyeLashMap', 'analyzeIris', 'setResult(']) assert.ok(!block.includes(forbidden), forbidden);
  assert.match(block, /step === 5 && \(!modelsLoaded \|\| !!loadError\)/);
});
