'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const html = fs.readFileSync(require('node:path').join(__dirname, '../index.html'), 'utf8');
const source = html.slice(html.indexOf('    function isCameraLayoutDebugEnabled()'), html.indexOf('    function CameraLayoutDebugPanel('));
const make = (window, document) => new Function('window', 'document',
  source + '\nreturn { isCameraLayoutDebugEnabled, readCameraLayoutSnapshot, sampleVideoFrameContent };')(window, document);
test('only explicit cameraLayoutDebug=1 enables diagnostics, independent of persisted debug', () => {
  for (const [search, expected] of [['', false], ['?debug=1', false], ['?cameraLayoutDebug=0', false], ['?cameraLayoutDebug=true', false], ['?cameraLayoutDebug=1', true]]) {
    assert.equal(make({ location: { search } }).isCameraLayoutDebugEnabled(), expected);
  }
});
test('collector reads whitelisted geometry/settings and never touches pixels, camera methods or styles', () => {
  const deny = () => { throw new Error('mutation or pixel access'); };
  const style = Object.freeze({ getPropertyValue: key => key === 'object-fit' ? 'cover' : 'auto' });
  const el = Object.freeze({ getBoundingClientRect: () => ({ x: 0, y: 0, width: 390, height: 709 }),
    clientWidth: 390, clientHeight: 709, offsetWidth: 390, offsetHeight: 709,
    videoWidth: 480, videoHeight: 640, readyState: 4, paused: false, currentTime: 2,
    style, play: deny, getContext: deny, setAttribute: deny, tagName: 'CANVAS', getAttribute: () => '640',
    srcObject: Object.freeze({ getVideoTracks: () => [{ getSettings: () => ({ width: 480, height: 640, facingMode: 'user', deviceId: 'SECRET', groupId: 'SECRET' }), applyConstraints: deny }] }) });
  const api = make({ innerWidth: 390, innerHeight: 844, screen: { width: 390, height: 844 }, devicePixelRatio: 3, getComputedStyle: () => style });
  const snapshot = api.readCameraLayoutSnapshot(el, el, el);
  assert.equal(snapshot.video.rect.width, 390);
  assert.equal(snapshot.video.computed['object-fit'], 'cover');
  assert.deepEqual(snapshot.mediaTrackSettings, { width: 480, height: 640, facingMode: 'user' });
  assert.equal(JSON.stringify(snapshot).includes('SECRET'), false);
  assert.equal(api.readCameraLayoutSnapshot(null, null, null).video, null);
});

// ------------------------------------------------------------
// A — CAMERA CONTENT DIAGNOSTIC (sampleVideoFrameContent)
// ------------------------------------------------------------
// A fake canvas/document harness: getImageData returns synthetic,
// deterministic RGBA pixels from a caller-supplied function of the
// canvas's own (post-scale) width/height, so the real production
// math (luma/nonBlackPixelRatio/activeContent bounds) is exercised
// against known inputs without needing a real <canvas>/<video>.
function makeFakeDocument(pixelsFor, { deny } = {}) {
  return {
    createElement: tag => {
      assert.equal(tag, 'canvas');
      if (deny) throw new Error('canvas must never be created when there is no decodable frame yet');
      const canvas = { width: 0, height: 0 };
      canvas.getContext = (type) => {
        assert.equal(type, '2d');
        return {
          drawImage: () => {},
          getImageData: (x, y, w, h) => ({ data: pixelsFor(w, h) }),
        };
      };
      return canvas;
    },
  };
}
function solidPixels(rgb) {
  return (w, h) => {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) { data[i*4]=rgb[0]; data[i*4+1]=rgb[1]; data[i*4+2]=rgb[2]; data[i*4+3]=255; }
    return data;
  };
}
function leftStripePixels(contentColumnCount, rgb) {
  return (w, h) => {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const inContent = x < contentColumnCount;
        data[i] = inContent ? rgb[0] : 0; data[i+1] = inContent ? rgb[1] : 0; data[i+2] = inContent ? rgb[2] : 0; data[i+3] = 255;
      }
    }
    return data;
  };
}
test('A1. full-width decoded content reports a full activeContentWidthRatio and high nonBlackPixelRatio', () => {
  const document = makeFakeDocument(solidPixels([200, 200, 200]));
  const api = make({}, document);
  const video = { videoWidth: 64, videoHeight: 64, readyState: 4 };
  const s = api.sampleVideoFrameContent(video);
  assert.equal(s.sampleWidth, 64);
  assert.equal(s.sampleHeight, 64);
  assert.equal(s.activeContentLeft, 0);
  assert.equal(s.activeContentRight, 63);
  assert.equal(s.activeContentWidthRatio, 1);
  assert.equal(s.nonBlackPixelRatio, 1);
  assert.ok(s.meanLuma > 100);
});
test('A2. content confined to a narrow left region is reported as a narrow activeContentWidthRatio, not full-width', () => {
  const document = makeFakeDocument(leftStripePixels(13, [200, 200, 200]));
  const api = make({}, document);
  const video = { videoWidth: 64, videoHeight: 64, readyState: 4 };
  const s = api.sampleVideoFrameContent(video);
  assert.equal(s.activeContentLeft, 0);
  assert.equal(s.activeContentRight, 12);
  assert.equal(s.activeContentWidthRatio, +(13/64).toFixed(3));
  assert.ok(s.activeContentWidthRatio < 0.25, 'a real narrow-strip frame must not be reported as full-width');
});
test('A3. an all-black decoded frame reports zero content, not a false-positive strip', () => {
  const document = makeFakeDocument(solidPixels([0, 0, 0]));
  const api = make({}, document);
  const video = { videoWidth: 32, videoHeight: 32, readyState: 4 };
  const s = api.sampleVideoFrameContent(video);
  assert.equal(s.activeContentLeft, null);
  assert.equal(s.activeContentRight, null);
  assert.equal(s.activeContentWidthRatio, 0);
  assert.equal(s.nonBlackPixelRatio, 0);
  assert.equal(s.meanLuma, 0);
});
test('A4. no decodable frame yet (readyState<2 or missing intrinsic size) returns null and never touches the canvas at all', () => {
  const document = makeFakeDocument(() => { throw new Error('must not be called'); }, { deny: true });
  const api = make({}, document);
  assert.equal(api.sampleVideoFrameContent({ videoWidth: 100, videoHeight: 100, readyState: 1 }), null);
  assert.equal(api.sampleVideoFrameContent({ videoWidth: 0, videoHeight: 0, readyState: 4 }), null);
  assert.equal(api.sampleVideoFrameContent(null), null);
});
test('A5. the sample is a small offscreen canvas (bounded dimensions), scaled down from a large intrinsic frame', () => {
  const document = makeFakeDocument(solidPixels([128, 128, 128]));
  const api = make({}, document);
  const s = api.sampleVideoFrameContent({ videoWidth: 1280, videoHeight: 720, readyState: 4 });
  assert.ok(s.sampleWidth <= 64 && s.sampleHeight <= 64, 'diagnostic canvas must stay small, never full sensor resolution');
});
test('A6. the returned object exposes ONLY derived scalar metrics — no pixel arrays, canvas/context refs, or data URLs', () => {
  const document = makeFakeDocument(solidPixels([90, 90, 90]));
  const api = make({}, document);
  const s = api.sampleVideoFrameContent({ videoWidth: 48, videoHeight: 48, readyState: 4 });
  assert.deepEqual(Object.keys(s).sort(), ['activeContentLeft', 'activeContentRight', 'activeContentWidthRatio',
    'meanLuma', 'nonBlackPixelRatio', 'sampleHeight', 'sampleWidth'].sort());
  assert.equal(JSON.stringify(s).includes('data:'), false);
});

// ------------------------------------------------------------
// B — FACE DETECTOR / DISTANCE DIAGNOSTIC (structural source guards)
// ------------------------------------------------------------
test('B1. recordDetectorSample is gated behind cameraLayoutDebugEnabled and is a no-op on a plain URL', () => {
  const start = html.indexOf('const recordDetectorSample = (partial) => {');
  assert.ok(start > 0, 'expected to find recordDetectorSample');
  const body = html.slice(start, html.indexOf('};', start));
  assert.ok(body.includes('if (!cameraLayoutDebugEnabled) return;'));
});
test('B2. every recordDetectorSample call site records only the documented scalar fields — never landmarks, coordinates, or pixels', () => {
  const calls = [...html.matchAll(/recordDetectorSample\(\{([\s\S]*?)\}\);/g)].map(m => m[1]);
  assert.ok(calls.length === 4, 'expected exactly 4 call sites: no-detection, metrics_nan, quality-reject, accepted');
  const forbidden = ['landmarks', 'jaw', 'nose', 'mouth', 'leftEye', 'rightEye', 'leftBrow', 'rightBrow',
    'physicalLeft', 'physicalRight', 'dataURL', 'getImageData', 'toDataURL'];
  for (const body of calls) {
    for (const token of forbidden) assert.ok(!body.includes(token), `recordDetectorSample call unexpectedly includes "${token}"`);
    for (const key of ['hasFace', 'detectorScore', 'faceRatio', 'boxWidth', 'canvasWidth', 'rejectionReasons', 'stageKey', 'hintKey']) {
      assert.ok(body.includes(key), `recordDetectorSample call is missing documented field "${key}"`);
    }
  }
});
test('B3. the detector diagnostic buffer is bounded (latest 50), never an unbounded growing log', () => {
  assert.ok(html.includes('detectorSamplesRef.current = [...detectorSamplesRef.current, sample].slice(-50);'));
});
test('B4. TinyFaceDetector production configuration (inputSize/scoreThreshold) is unchanged by this diagnostic', () => {
  const occurrences = (html.match(/new faceapi\.TinyFaceDetectorOptions\(\{ inputSize: 320, scoreThreshold: 0\.5 \}\)/g) || []).length;
  assert.equal(occurrences, 2, 'expected exactly the two pre-existing call sites (LiveScanScreen + PhotoAnalysisScreen sharing the same config), byte-for-byte unchanged');
});
test('B5. the too_far/too_close faceRatio thresholds in assessFrameQuality are unchanged by this diagnostic', () => {
  assert.equal((html.match(/faceRatio < 0\.16/g) || []).length, 1);
  assert.equal((html.match(/faceRatio > 0\.78/g) || []).length, 1);
});
test('B6. LiveScanScreen getUserMedia constraints are unchanged by this diagnostic', () => {
  assert.ok(html.includes("navigator.mediaDevices.getUserMedia({ video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })"));
});
test('B7. COPY JSON never includes bestFrameRef/dataURL/image data — only bounded snapshots + detectorSamples', () => {
  const start = html.indexOf('const copy = async () => {');
  const body = html.slice(start, html.indexOf('const reasonsText', start));
  assert.ok(body.includes('detectorSamples: detectorSamplesRef ? detectorSamplesRef.current : []'));
  assert.ok(!body.includes('dataURL'));
  assert.ok(!body.includes('bestFrameRef'));
});
test('B8. the [data-live-scan-camera] CSS fallback block itself is unchanged by this diagnostic', () => {
  // Mirror mechanism is NOT asserted here any more: the separately
  // reviewed WEBKIT-SAFE VIDEO PRESENTATION fix intentionally moved
  // LiveScanScreen's mirroring from a CSS transform on <video> to a
  // canvas-transform inside drawVideoCover — see camera-preview.test.js
  // for the dedicated regression coverage of that change. This test
  // stays scoped to what THIS diagnostic-extension task actually
  // touches: the static CSS fallback rule block, untouched either way.
  assert.ok(html.includes("[data-live-scan-camera] { position: relative; overflow: hidden; flex: 1 1 0%; }"));
});
