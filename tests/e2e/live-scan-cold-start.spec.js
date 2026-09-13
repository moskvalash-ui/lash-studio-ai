'use strict';
const { test, expect, chromium } = require('@playwright/test');

for (const mode of ['fast stream', 'delayed stream', 'delayed metadata']) {
  test(`cold first mount and second mount preserve camera layout: ${mode}`, async ({}, testInfo) => {
    test.setTimeout(120000);
    // A new PROCESS per scenario: neither the browser cache nor a prior scan can warm this first mount.
    const browser = await chromium.launch();
    try {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      await cdp.send('Network.enable');
      await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
      await page.addInitScript(mode => {
        window.__cold = { rows: [], constraints: [], open: 0 };
        const box = el => { const r = el.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; };
        const sample = event => {
          const v = document.querySelector('video'), c = v.parentElement, o = c.querySelector('canvas');
          const cs = getComputedStyle(c), vs = getComputedStyle(v), os = getComputedStyle(o);
          __cold.rows.push({ open: __cold.open, event, time: performance.now(), container: box(c), video: box(v), overlay: box(o),
            containerPosition: cs.position, overflow: cs.overflow, flex: cs.flex,
            videoPosition: vs.position, inset: vs.inset, fit: vs.objectFit, objectPosition: vs.objectPosition,
            mirror: vs.transform, overlayPosition: os.position, overlayMirror: os.transform,
            ready: v.readyState, intrinsic: [v.videoWidth, v.videoHeight], horizontalOverflow: document.documentElement.scrollWidth > innerWidth });
        };
        navigator.mediaDevices.getUserMedia = async constraints => {
          __cold.open++;
          __cold.constraints.push(constraints);
          // This synchronous read occurs in the mount effect, before Tailwind's mutation observer generates new utilities.
          sample('mount');
          const video = document.querySelector('video');
          for (const event of ['loadedmetadata', 'canplay', 'playing', 'resize']) video.addEventListener(event, () => sample(event));
          if (mode === 'delayed stream') await new Promise(resolve => { window.__releaseStream = resolve; });
          const canvas = document.createElement('canvas');
          canvas.width = 480; canvas.height = 640;
          const stream = canvas.captureStream(0);
          window.__releaseFrame = () => {
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'lime'; ctx.fillRect(0, 0, 240, 640);
            ctx.fillStyle = 'blue'; ctx.fillRect(240, 0, 240, 640);
            stream.getVideoTracks()[0].requestFrame();
          };
          if (mode !== 'delayed metadata') __releaseFrame();
          sample('stream returned');
          return stream;
        };
      }, mode);
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'Отказаться', exact: true }).click({ timeout: 30000 });
      for (let open = 1; open <= 2; open++) {
        await page.getByRole('button', { name: 'Начать Live Scan', exact: true }).click({ timeout: 60000 });
        await page.waitForFunction(n => __cold.open === n, open);
        if (mode === 'delayed stream') {
          expect(await page.locator('video').evaluate(v => v.srcObject)).toBe(null);
          await page.evaluate(() => __releaseStream());
        }
        if (mode === 'delayed metadata') {
          // Hold actual frame delivery until after assignment; no fabricated media events or sleep.
          await page.waitForFunction(() => !!document.querySelector('video').srcObject);
          expect(await page.locator('video').evaluate(v => [v.videoWidth, v.videoHeight, v.readyState])).toEqual([0, 0, 0]);
          await page.evaluate(() => __releaseFrame());
        }
        await page.waitForFunction(n => __cold.rows.some(r => r.open === n && r.event === 'playing'), open, { timeout: 30000 });
        await page.locator('button').filter({ has: page.locator('svg path[d="M15 19l-7-7 7-7"]') }).click();
        await expect(page.locator('video')).toHaveCount(0);
      }
      const trace = await page.evaluate(() => __cold);
      await testInfo.attach('cold-start-timeline', { body: JSON.stringify(trace, null, 2), contentType: 'application/json' });
      const contract = row => ({ containerPosition: row.containerPosition, overflow: row.overflow, flex: row.flex,
        videoPosition: row.videoPosition, inset: row.inset, fit: row.fit, objectPosition: row.objectPosition,
        mirror: row.mirror, overlayPosition: row.overlayPosition, overlayMirror: row.overlayMirror });
      for (const row of trace.rows) {
        expect(row.video, `${row.open}: ${row.event} video fills its current container`).toEqual(row.container);
        expect(row.overlay, `${row.open}: ${row.event} overlay follows the same container`).toEqual(row.container);
        expect(row.container[2]).toBe(390);
        expect(row.container[3]).toBeGreaterThan(600);
        expect(row.horizontalOverflow).toBe(false);
        // `mirror: 'none'` — the WEBKIT-SAFE VIDEO PRESENTATION fix
        // intentionally removed <video>'s CSS transform: mirroring now
        // happens via a canvas transform inside the overlay draw loop
        // (drawVideoCover), proven by real painted-pixel sampling in
        // tests/e2e/live-scan-video-presentation.spec.js. <video> is
        // also now permanently invisible (opacity:0), which is why it
        // no longer needs — or has — any CSS transform of its own.
        expect(contract(row)).toEqual({ containerPosition: 'relative', overflow: 'hidden', flex: '1 1 0%',
          videoPosition: 'absolute', inset: '0px', fit: 'cover', objectPosition: '50% 50%',
          mirror: 'none', overlayPosition: 'absolute', overlayMirror: 'none' });
      }
      const mounts = trace.rows.filter(r => r.event === 'mount');
      expect(mounts).toHaveLength(2);
      // Footer utility generation can change the available height; the camera fill/mirror contract must already match.
      expect(contract(mounts[0])).toEqual(contract(mounts[1]));
      expect(trace.constraints).toEqual(Array(2).fill({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }));
    } finally { await browser.close(); }
  });
}
