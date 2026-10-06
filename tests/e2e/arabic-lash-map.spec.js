'use strict';
// ============================================================
// ARABIC effect, real app. A real Live Scan result (one REAL face-api detection of the fixture frame is replayed every
// tick so the real pipeline completes quickly) -> Results -> All Designs -> Арабский -> Lash Map -> DIAGRAM.
// Proves: it is selectable, never the top recommendation, opening its Lash Map does not crash, the DIAGRAM draws the six
// tight SHORT/MEDIUM/LONG trios (18 lashes, 6 LONG), and the name localizes to RU / EN / AR.
// ============================================================
const path = require('node:path');
const fs = require('node:fs');
const { test, expect } = require('@playwright/test');

test('Arabic: selectable from All Designs, not the top recommendation, six tight trios in the DIAGRAM, RU/EN/AR names', async ({ page }) => {
  test.setTimeout(240000);
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  const b64 = fs.readFileSync(path.join(__dirname, 'fixtures/happy-path-face.png')).toString('base64');
  await page.addInitScript((b64) => {
    localStorage.setItem('lashStudioOnboardingSeenV1', '1');
    window.__img = new Image();
    window.__imgReady = new Promise(r => { window.__img.onload = r; window.__img.src = 'data:image/png;base64,' + b64; });
    navigator.mediaDevices.getUserMedia = async () => {
      await window.__imgReady;
      const img = window.__img, c = document.createElement('canvas'); c.width = 640; c.height = 480;
      const x = c.getContext('2d'), s = Math.max(640 / img.width, 480 / img.height);
      const draw = () => x.drawImage(img, (640 - img.width * s) / 2, (480 - img.height * s) / 2, img.width * s, img.height * s);
      draw(); setInterval(draw, 50);
      return c.captureStream(20);
    };
  }, b64);
  await page.goto('/index.html');
  const reject = page.getByRole('button', { name: 'Отказаться', exact: true });
  await reject.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  if (await reject.isVisible()) await reject.click();
  await page.waitForFunction(() => typeof faceapi !== 'undefined' && faceapi.nets.tinyFaceDetector.isLoaded && faceapi.nets.faceLandmark68Net.isLoaded, null, { timeout: 60000 });
  await page.waitForTimeout(2000);
  await page.evaluate(async () => {
    await window.__imgReady;
    const img = window.__img, c = document.createElement('canvas'); c.width = 640; c.height = 480;
    const x = c.getContext('2d'), s = Math.max(640 / img.width, 480 / img.height);
    x.drawImage(img, (640 - img.width * s) / 2, (480 - img.height * s) / 2, img.width * s, img.height * s);
    const real = await faceapi.detectSingleFace(c, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 })).withFaceLandmarks();
    faceapi.detectSingleFace = () => ({ withFaceLandmarks: async () => real });
  });
  await page.getByRole('button', { name: 'Начать Live Scan', exact: true }).click();
  const confirm = page.getByRole('button', { name: 'Подтвердить и построить схемы', exact: true });
  await expect(confirm).toBeVisible({ timeout: 90000 });
  await confirm.click();

  // Results: the hero (top recommendation) is NOT Arabic.
  const openMap = page.getByRole('button', { name: 'ОТКРЫТЬ LASH MAP', exact: true });
  await expect(openMap).toBeVisible({ timeout: 30000 });
  expect(await page.evaluate(() => document.body.innerText.includes('ВАШ ЛУЧШИЙ ДИЗАЙН'))).toBe(true);
  expect(await page.evaluate(() => /ВАШ ЛУЧШИЙ ДИЗАЙН\s*\n?\s*АРАБСКИЙ/i.test(document.body.innerText))).toBe(false);

  // All Designs lists Арабский (manual selection) -> open its Lash Map.
  await page.locator('button', { hasText: /СМОТРЕТЬ ВСЕ ДИЗАЙНЫ/i }).first().click();
  const card = page.locator('text=Арабский').first();
  await card.scrollIntoViewIfNeeded();
  await card.click();
  await page.locator('button', { hasText: /ОТКРЫТЬ LASH MAP/i }).first().click({ timeout: 8000 }).catch(() => {});
  await expect(page.getByText('ПРОФЕССИОНАЛЬНАЯ LASH MAP', { exact: false })).toBeVisible({ timeout: 30000 });
  const title = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 120));
  expect(await title()).toContain('Арабский');

  // DIAGRAM: six tight trios = 18 lashes (6 LONG), three levels per trio, ~3.0 renderer units between lashes.
  await page.locator('[aria-label="Lash Map view"] button').nth(1).click();
  const diagram = page.locator('div.aspect-\\[4\\/3\\] svg').first();
  await expect(diagram).toBeVisible();
  const spikes = await diagram.evaluate(svg => [...svg.querySelectorAll('polygon')].map(g => {
    const pts = g.getAttribute('points').trim().split(/\s+/).map(q => q.split(',').map(Number));
    return { cx: (pts[0][0] + pts[1][0]) / 2, h: pts[0][1] - pts[2][1], long: (g.getAttribute('fill') || '').includes('83,199,255') };
  }));
  expect(spikes).toHaveLength(18);
  expect(spikes.filter(s => s.long)).toHaveLength(6);
  for (let g = 0; g < 6; g++) {
    const [s, m, l] = spikes.slice(g * 3, g * 3 + 3);
    expect([s.long, m.long, l.long]).toEqual([false, false, true]);
    expect(s.h).toBeLessThan(m.h); expect(m.h).toBeLessThan(l.h);                     // three distinct levels
    expect(Math.abs((m.cx - s.cx) - 3.0)).toBeLessThan(0.1); expect(Math.abs((l.cx - m.cx) - 3.0)).toBeLessThan(0.1);
    if (g < 5) expect(spikes[(g + 1) * 3].cx - l.cx).toBeGreaterThan(40);               // clear space before the next trio
  }

  // Names: EN / AR header toggles re-localize the title.
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await expect.poll(title).toContain('Arabic');
  await page.getByRole('button', { name: 'العربية', exact: true }).click();
  await expect.poll(title).toContain('عربي');
  await page.getByRole('button', { name: 'RU', exact: true }).click();
  await expect.poll(title).toContain('Арабский');
  expect(pageErrors).toEqual([]);
  expect(await page.evaluate(() => document.getElementById('root').childElementCount)).toBeGreaterThan(0);
});
