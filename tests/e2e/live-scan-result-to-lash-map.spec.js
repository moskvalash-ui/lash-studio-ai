'use strict';
// ============================================================
// LIVE SCAN RESULT -> LASH MAP. A live-scan result has source:'live'.
// LashMapScreen defaults to the PHOTO view and mounts
// PhotoLashEditorWorkspace, which renders nothing for non-photo
// results but whose mount effect used to dereference an <img> ref that
// is never attached -> uncaught TypeError inside an effect -> with no
// error boundary React unmounts the whole app (black screen) the moment
// the user taps an effect on the result screen.
//
// Deterministic and fast: one REAL face-api detection of the exact frame
// the fake camera shows is replayed every tick, so the real scan
// pipeline, completion, onComplete, Review and Results all run for real
// (only getUserMedia and detection speed are controlled).
// ============================================================
const path = require('node:path');
const fs = require('node:fs');
const { test, expect } = require('@playwright/test');

test('tapping an effect after a real Live Scan opens Lash Map without crashing the app', async ({ page }) => {
  test.setTimeout(180000);
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
  // Real scan completes -> Review.
  const confirm = page.getByRole('button', { name: 'Подтвердить и построить схемы', exact: true });
  await expect(confirm).toBeVisible({ timeout: 90000 });
  await confirm.click();
  // Results screen is up; tap the effect (open its Lash Map).
  const open = page.getByRole('button', { name: 'ОТКРЫТЬ LASH MAP', exact: true });
  await expect(open).toBeVisible({ timeout: 30000 });
  await open.click();
  await page.waitForTimeout(2500);
  expect(pageErrors).toEqual([]);
  expect(await page.evaluate(() => document.getElementById('root').childElementCount)).toBeGreaterThan(0);
  await expect(page.getByText('ПРОФЕССИОНАЛЬНАЯ LASH MAP', { exact: false })).toBeVisible();
  // A live result opens on PHOTO with the two per-eye visual maps (captured frame + lash overlay),
  // never PhotoLashEditorWorkspace (which intentionally renders only for source:'photo').
  expect(await activeView(page)).toBe('photo');
  await expect(page.locator('[data-photo-lash-editor-workspace]')).toHaveCount(0);
  await expect(page.locator('[data-photo-lash-profile-line]')).toHaveCount(2); // LEFT + RIGHT cards
  const images = await page.locator('svg image').evaluateAll(n => n.map(i => (i.getAttribute('href') || '').startsWith('data:image/jpeg;base64,')));
  expect(images).toEqual([true, true]); // the immutable captured frame, not the camera
  for (const sel of ['[data-photo-lash-profile-fill]', '[data-photo-map-line]']) await expect(page.locator(sel)).toHaveCount(2);
  expect(await page.locator('[data-map-point]').count()).toBeGreaterThan(6);
  const lengths = () => page.locator('[data-photo-lash-profile-line]').evaluateAll(() => [...document.querySelectorAll('svg')].filter(s => s.querySelector('[data-photo-lash-profile-line]')).map(s => [...s.querySelectorAll('[data-map-point]')].map(g => g.getAttribute('data-length')).join(',')));
  const before = await lengths();
  expect(before.length).toBe(2);

  // ---- EDIT MODE @ 390px (config viewport) -------------------------------------------------------------
  expect(await page.evaluate(() => window.innerWidth)).toBe(390);
  await page.getByRole('button', { name: 'НАСТРОИТЬ СХЕМУ', exact: true }).first().click();
  const eyeBox = page.locator('[aria-label="Left eye map"]');
  await expect(page.locator('[data-manual-handle]').first()).toBeVisible();
  // The control bar is BELOW the interactive eye/map area and nothing inside it is a control.
  const geom = await page.evaluate(() => {
    const box = document.querySelector('[aria-label="Left eye map"]').getBoundingClientRect();
    const bar = document.querySelector('[data-photo-edit-action-bar]').getBoundingClientRect();
    return { boxBottom: box.bottom, barTop: bar.top, buttonsInsideBox: document.querySelector('[aria-label="Left eye map"]').querySelectorAll('button').length };
  });
  expect(geom.barTop).toBeGreaterThanOrEqual(geom.boxBottom - 0.5);
  expect(geom.buttonsInsideBox).toBe(0);
  // Every control rect is outside every interactive handle rect, and every handle's center hit-tests to the handle itself.
  const hit = sel => page.evaluate(sel => [...document.querySelectorAll(sel)].map(h => {
    const r = h.getBoundingClientRect(), cx = r.x + r.width / 2, cy = r.y + r.height / 2, el = document.elementFromPoint(cx, cy);
    const overlap = [...document.querySelectorAll('[data-photo-edit-action-bar] button')].some(b => { const q = b.getBoundingClientRect(); return !(q.right < r.left || q.left > r.right || q.bottom < r.top || q.top > r.bottom); });
    return { owns: !!(el && el.closest(sel)), overlap };
  }), sel);

  // FIT MODE: INNER / PEAK / OUTER each receive a REAL pointer drag (and the lash map follows).
  const profileD = () => page.locator('[data-photo-lash-profile-line]').first().getAttribute('d');
  for (const kind of ['inner', 'peak', 'outer']) {
    const sel = `[data-manual-handle="${kind}"]`;
    const h = page.locator(sel).first();
    await h.scrollIntoViewIfNeeded();
    expect(await hit(sel), `${kind} handle must own its own center point`).toEqual([{ owns: true, overlap: false }]);
    const before = await profileD(), box = await h.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 6, box.y + box.height / 2 - 5, { steps: 6 });
    await page.mouse.up();
    await expect.poll(profileD, { message: `${kind} drag must change the lash map` }).not.toBe(before);
  }

  // DESIGN MODE: all 5 zone handles are reachable.
  await page.getByRole('button', { name: 'Изменить схему', exact: true }).first().click();
  await expect(page.locator('[data-manual-zone-handle]')).toHaveCount(5);
  expect(await hit('[data-manual-zone-handle]')).toEqual(Array(5).fill({ owns: true, overlap: false }));
  // Switching back and forth does not crash.
  await page.getByRole('button', { name: 'Подогнать по глазу', exact: true }).first().click();
  await expect(page.locator('[data-manual-handle]')).toHaveCount(3);
  await page.getByRole('button', { name: 'Изменить схему', exact: true }).first().click();
  await expect(page.locator('[data-manual-zone-handle]')).toHaveCount(5);

  // ZONE EDIT: a real pointer drag of the PEAK zone on the LEFT card changes ONLY the left eye's lengths.
  const lengthsNow = await lengths();
  const handle = page.locator('[data-manual-zone-handle="3"]').first();
  await handle.scrollIntoViewIfNeeded();
  const zb = await handle.boundingBox();
  await page.mouse.move(zb.x + zb.width / 2, zb.y + zb.height / 2);
  await page.mouse.down();
  await page.mouse.move(zb.x + zb.width / 2, zb.y + zb.height / 2 - 45, { steps: 8 });
  await expect(page.locator('[data-zone-drag-readout]')).toBeVisible();
  await page.mouse.up();
  await expect.poll(async () => (await lengths())[0]).not.toBe(lengthsNow[0]);        // the zone length value really changed
  expect((await lengths())[1]).toBe(lengthsNow[1]);                                     // RIGHT card untouched (side bound correctly)
  expect(pageErrors).toEqual([]);
  expect(await page.evaluate(() => document.getElementById('root').childElementCount)).toBeGreaterThan(0);

  // EXIT EDIT MODE: bar disappears, both cards offer the edit entry point again.
  await page.getByRole('button', { name: 'ГОТОВО', exact: true }).first().click();
  await expect(page.locator('[data-photo-edit-action-bar]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'НАСТРОИТЬ СХЕМУ', exact: true })).toHaveCount(2);
  await expect(page.locator('[data-photo-lash-profile-line]')).toHaveCount(2);

  // DIAGRAM still opens and renders, and PHOTO comes back with the cards.
  await page.locator('[aria-label="Lash Map view"] button').nth(1).click();
  expect(await activeView(page)).toBe('diagram');
  await expect(page.locator('[data-photo-lash-profile-line]')).toHaveCount(0);
  await expect(page.locator('.aspect-\\[4\\/3\\] svg').first()).toBeVisible();
  await page.locator('[aria-label="Lash Map view"] button').first().click();
  expect(await activeView(page)).toBe('photo');
  await expect(page.locator('[data-photo-lash-profile-line]')).toHaveCount(2);
  expect(pageErrors).toEqual([]);
});

// Which Lash Map view tab is active, read from the tab group itself (labels are CSS-uppercased).
const activeView = page => page.evaluate(() => {
  const tabs = [...document.querySelectorAll('[aria-label="Lash Map view"] button')];
  const active = tabs.find(b => /(^|\s)bg-white/.test(b.className));
  return active ? active.textContent.trim().toLowerCase() : null;
});

test('Photo Analysis result still opens Lash Map on the PHOTO view', async ({ page }) => {
  test.setTimeout(120000);
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  await page.goto('/index.html');
  const reject = page.getByRole('button', { name: 'Отказаться', exact: true });
  await reject.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  if (await reject.isVisible()) await reject.click();
  const photo = page.getByRole('button', { name: 'Анализ по фото', exact: true });
  await expect(photo).toBeEnabled({ timeout: 30000 });
  await photo.click();
  await page.locator('input[type=file]').setInputFiles(path.join(__dirname, 'fixtures/happy-path-face.png'));
  await expect(page.getByText('Подтверждение анализа', { exact: true })).toBeVisible({ timeout: 90000 });
  await page.getByRole('button', { name: 'Подтвердить и построить схемы', exact: true }).click();
  await page.getByRole('button', { name: 'ОТКРЫТЬ LASH MAP', exact: true }).click();
  await expect(page.locator('[data-photo-lash-editor-workspace]')).toBeVisible({ timeout: 30000 });
  expect(await activeView(page)).toBe('photo');
  expect(pageErrors).toEqual([]);
});
