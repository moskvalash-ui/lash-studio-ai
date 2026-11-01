// TASK 10 item 8 — repeat the TASK 09 performance comparison, this
// time against the actual publish/ build artifact instead of the
// index.precompiled.html PoC file. Same methodology as poc-build/measure.js.
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', 'tests/e2e/node_modules/@playwright/test'));

const PAGES = {
  original: 'http://localhost:8935/index.html',
  publish: 'http://localhost:8937/index.html',
};
const RUNS = 5;

function median(arr) { const s = [...arr].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
function range(arr) { return `${Math.min(...arr)}-${Math.max(...arr)}`; }

async function measureOne(context, url, mode) {
  const page = await context.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 120)); });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message.slice(0, 120)));

  const navStart = Date.now();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  let rootMountedAt;
  if (mode === 'reload') {
    const reloadStart = Date.now();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.getElementById('root') && document.getElementById('root').childElementCount > 0, { timeout: 60000 });
    rootMountedAt = Date.now() - reloadStart;
  } else {
    await page.waitForFunction(() => document.getElementById('root') && document.getElementById('root').childElementCount > 0, { timeout: 60000 });
    rootMountedAt = Date.now() - navStart;
  }
  await page.close();
  return { rootMountedAt, errors };
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const results = {};
  for (const [label, url] of Object.entries(PAGES)) {
    for (const mode of ['cold', 'reload']) {
      const key = `${label}_${mode}`;
      results[key] = [];
      for (let i = 0; i < RUNS; i++) {
        const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
        const r = await measureOne(context, url, mode);
        results[key].push(r);
        console.log(`${key} run${i + 1}: rootMounted=${r.rootMountedAt}ms errors=${r.errors.length}`);
        await context.close();
      }
    }
  }
  await browser.close();
  console.log('\n=== SUMMARY (median / range, ms) ===');
  for (const [key, runs] of Object.entries(results)) {
    const vals = runs.map(r => r.rootMountedAt);
    const totalErrors = runs.reduce((a, r) => a + r.errors.length, 0);
    console.log(`${key.padEnd(18)} median=${median(vals).toFixed(0).padStart(6)}ms  range=${range(vals).padEnd(11)}  totalErrors=${totalErrors}`);
  }
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });
