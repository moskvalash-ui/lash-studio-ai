'use strict';
const { test, expect } = require('@playwright/test');

test('URL-only diagnostic observes first camera opening without changing preview or constraints', async ({ browser, storageState }) => {
  test.setTimeout(120000);
  const results = [];
  for (const flagged of [false, true]) {
    const context = await browser.newContext({ storageState, viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    await page.addInitScript(() => {
      window.__constraints = [];
      Object.defineProperty(navigator.clipboard, 'writeText', { value: async text => { window.__copied = text; } });
      navigator.mediaDevices.getUserMedia = async constraints => {
        window.__constraints.push(constraints);
        const canvas = document.createElement('canvas');
        canvas.width = 480; canvas.height = 640;
        const ctx = canvas.getContext('2d');
        const draw = () => { ctx.fillStyle = '#00ff00'; ctx.fillRect(0, 0, 240, 640); ctx.fillStyle = '#0000ff'; ctx.fillRect(240, 0, 240, 640); };
        draw(); setInterval(draw, 100);
        return canvas.captureStream(10);
      };
    });
    await page.goto('/' + (flagged ? '?cameraLayoutDebug=1' : ''));
    await page.getByRole('button', { name: 'Отказаться', exact: true }).click({ timeout: 30000 });
    await expect(page.locator('[data-camera-layout-debug]')).toHaveCount(0);
    await page.getByRole('button', { name: 'Начать Live Scan', exact: true }).click({ timeout: 60000 });
    await page.waitForFunction(() => document.querySelector('video')?.readyState >= 2);
    if (flagged) {
      await expect(page.locator('[data-camera-layout-debug]')).toBeVisible();
      // Real face-api inference can block the main thread on this older test machine.
      await expect(page.locator('[data-camera-layout-timeline]')).toContainText('playing +1500 ms', { timeout: 20000 });
      await page.evaluate(() => { window.dispatchEvent(new Event('resize')); window.dispatchEvent(new Event('orientationchange')); });
      await expect(page.locator('[data-camera-layout-latest]')).toContainText('orientationchange');
      await page.getByRole('button', { name: 'COPY JSON', exact: true }).click();
      const data = await page.evaluate(() => JSON.parse(window.__copied));
      for (const event of ['LiveScan mount', 'srcObject assigned', 'loadedmetadata', 'canplay', 'playing', 'playing +100 ms', 'playing +500 ms', 'playing +1500 ms', 'resize', 'orientationchange']) {
        expect(data.snapshots.some(s => s.event === event), event).toBe(true);
      }
      const assigned = data.snapshots.find(s => s.event === 'srcObject assigned');
      expect(assigned.mediaTrackSettings.width).toBe(480);
      expect(assigned.video.paused).toBe(true);
      const last = data.snapshots.at(-1);
      expect(last.video.rect.width).toBe(390);
      expect(last.container.rect).toEqual(last.overlay.rect);
      expect(last.video.videoWidth).toBe(480);
      expect(last.video.computed['object-fit']).toBe('cover');
      expect(Object.keys(last.mediaTrackSettings).every(k => ['width', 'height', 'aspectRatio', 'facingMode', 'frameRate', 'zoom'].includes(k))).toBe(true);

      expect(data.snapshots.every(s => !('frameContent' in s))).toBe(true);
      expect(data.finalSnapshot.video.videoWidth).toBe(480);
      // C — "strong zoom + Поиск лица" investigation diagnostics: the
      // preview-crop geometry (independent of, and structurally
      // different from, the processing-canvas geometry TinyFaceDetector
      // actually receives).
      const withGeometry = data.snapshots.filter(s => s.previewCoverGeometry);
      expect(withGeometry.length).toBeGreaterThan(0);
      for (const s of withGeometry) {
        const g = s.previewCoverGeometry;
        // "cover" always crops exactly one axis (or neither, if aspect
        // ratios already match) — never both simultaneously with a
        // real, non-square mismatch.
        expect(g.cropHorizontalPct === 0 || g.cropVerticalPct === 0).toBe(true);
        expect(g.effectiveVisibleWidthFraction).toBeGreaterThan(0);
        expect(g.effectiveVisibleWidthFraction).toBeLessThanOrEqual(1);
        expect(g.effectiveVisibleHeightFraction).toBeGreaterThan(0);
        expect(g.effectiveVisibleHeightFraction).toBeLessThanOrEqual(1);
      }
      const withProcessing = data.snapshots.filter(s => s.processingCanvas);
      expect(withProcessing.length).toBeGreaterThan(0);
      for (const s of withProcessing) {
        expect(s.processingCanvas.sourceCropped).toBe(false);
        expect(s.processingCanvas.width).toBeGreaterThan(0);
        expect(s.processingCanvas.height).toBeGreaterThan(0);
      }

      // B — detector diagnostic: the synthetic stream has no real face, so
      // every recorded sample must show a clean, honest "no detection"
      // outcome — never a stale/fabricated success.
      await expect(page.locator('[data-camera-layout-detector]')).toBeVisible();
      await expect(page.locator('[data-camera-layout-detector]')).toContainText('hasFace: false');
      expect(Array.isArray(data.detectorSamples)).toBe(true);
      expect(data.detectorSamples.length).toBeGreaterThan(0);
      expect(data.detectorSamples.length).toBeLessThanOrEqual(300);
      for (const s of data.detectorSamples) {
        expect(s.hasFace).toBe(false);
        expect(s.stageKey).toBe('stageSearching');
        expect(s.videoWidth).toBe(480);
        expect(s.processingCanvasHeight).toBe(640);
        expect(s.visibleSourceFraction).toBeGreaterThan(0);
        expect(s.detectorScore).toBe(null);
        expect(s.faceRatio).toBe(null);
        // Widened for the "strong zoom + Поиск лица" investigation:
        // box geometry fields must all be explicitly null when nothing
        // was detected — there is no box to report.
        expect(s.boxX).toBe(null);
        expect(s.boxY).toBe(null);
        expect(s.boxWidth).toBe(null);
        expect(s.boxHeight).toBe(null);
        expect(s.boxClipped).toBe(null);
        expect(s.rejectionReasons).toEqual(['no_detection']);
        expect(Object.keys(s).sort()).toEqual(['boxClipped', 'boxHeight', 'boxWidth', 'boxX', 'boxY', 'canvasHeight',
          'canvasWidth', 'detectorScore', 'elapsedMs', 'faceRatio', 'hasFace', 'hintKey', 'rejectionReasons', 'stageKey', 'boxNearEdge', 'videoWidth', 'videoHeight', 'processingCanvasWidth', 'processingCanvasHeight', 'previewContainerWidth', 'previewContainerHeight', 'previewCanvasWidth', 'previewCanvasHeight', 'coverScale', 'visibleSourceFraction', 'mediaTrackSettings'].sort());
      }
      // No image/pixel data anywhere in the exported diagnostic payload.
      const rawJson = JSON.stringify(data);
      expect(rawJson.includes('data:image')).toBe(false);
      expect(rawJson.includes('landmarks')).toBe(false);
    } else {
      await page.waitForTimeout(1800);
      await expect(page.locator('[data-camera-layout-debug]')).toHaveCount(0);
    }
    results.push(await page.evaluate(() => {
      const v = document.querySelector('video'), c = v.parentElement, o = c.querySelector('canvas');
      const style = getComputedStyle(v);
      return { constraints: window.__constraints, style: v.getAttribute('style'), classes: v.className,
        computed: ['width', 'height', 'position', 'object-fit', 'object-position', 'transform'].map(k => style.getPropertyValue(k)),
        rect: v.getBoundingClientRect().toJSON(), container: c.getBoundingClientRect().toJSON(), overlay: o.getBoundingClientRect().toJSON(),
        overflow: document.documentElement.scrollWidth > innerWidth,
        persistedFlag: [...Object.keys(localStorage), ...Object.keys(sessionStorage)].some(k => /cameraLayoutDebug/i.test(k)) };
    }));
    await page.locator('button').filter({ has: page.locator('svg path[d="M15 19l-7-7 7-7"]') }).click();
    await expect(page.locator('[data-camera-layout-debug]')).toHaveCount(0);
    await context.close();
  }
  expect(results[1]).toEqual(results[0]);
  expect(results[0].overflow).toBe(false);
  expect(results[0].persistedFlag).toBe(false);
});

test('successful diagnostic session stays live and copyable through subsequent no-face recovery testing', async ({ page }) => {
  test.setTimeout(90000);
  // Exercise the actual completion guard with a controlled successful result.
  // Test-only source injection avoids presenting synthetic data as real detector evidence.
  await page.route('**/?cameraLayoutDebug=1', async route => {
    const response = await route.fetch();
    let source = await response.text();
    const start = source.indexOf("          if (cameraLayoutDebugEnabled) { decideStage('stageComplete');");
    const end = source.indexOf('          doneRef.current = true;', start);
    expect(start).toBeGreaterThan(0);
    const guard = source.slice(start, end);
    source = source.replace('      tickImplRef.current = async () => {', `
      window.__exerciseDiagnosticSuccess = () => {
        const decideStage = setStageKey, decideHint = setHintKey;
        recordDetectorSample({hasFace:true, detectorScore:0.9, faceRatio:0.5,
          boxX:100, boxY:100, boxWidth:240, boxHeight:300, boxClipped:false,
          rejectionReasons:[], stageKey:'stageComplete', hintKey:null});
        flushDetectorSample({}, {stageKey:'stageComplete',hintKey:null});
        ${guard}
        throw new Error('diagnostic completion must return before production navigation');
      };
      tickImplRef.current = async () => {`);
    await route.fulfill({response, body:source});
  });
  await page.addInitScript(() => {
    Object.defineProperty(navigator.clipboard, 'writeText', {value: async text => {window.__copied=text;}});
    navigator.mediaDevices.getUserMedia = async () => {
      const c=document.createElement('canvas');c.width=480;c.height=640;
      const ctx=c.getContext('2d');ctx.fillStyle='green';ctx.fillRect(0,0,480,640);
      return c.captureStream(5);
    };
  });
  await page.goto('/?cameraLayoutDebug=1');
  await page.getByRole('button',{name:'Отказаться',exact:true}).click({timeout:30000});
  await page.getByRole('button',{name:'Начать Live Scan',exact:true}).click({timeout:60000});
  await expect(page.locator('[data-camera-layout-detector]')).toBeVisible({timeout:20000});
  await page.evaluate(() => window.__exerciseDiagnosticSuccess());
  // Longer than the production navigation delay; panel and track must survive.
  await page.waitForTimeout(1500);
  await page.getByRole('button',{name:'COPY JSON',exact:true}).click();
  const data=await page.evaluate(()=>JSON.parse(window.__copied));
  expect(data.detectorSamples.some(s=>s.hasFace && s.stageKey==='stageComplete')).toBe(true);
  expect(data.detectorSamples.at(-1).hasFace).toBe(false);
  expect(data.finalSnapshot.video.paused).toBe(false);
  expect(data.snapshots.some(s=>s.event==='detector state transition')).toBe(true);
  expect(JSON.stringify(data)).not.toMatch(/data:image|landmarks|frameContent/);
  expect(await page.locator('[data-camera-layout-debug]').count()).toBe(1);
});
