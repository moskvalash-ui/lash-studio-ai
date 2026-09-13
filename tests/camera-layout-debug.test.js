'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const html = fs.readFileSync(require('node:path').join(__dirname, '../index.html'), 'utf8');
const source = html.slice(html.indexOf('    function isCameraLayoutDebugEnabled()'), html.indexOf('    function CameraLayoutDebugPanel('));
const make = (window, document) => new Function('window', 'document',
  source + '\nreturn { isCameraLayoutDebugEnabled, readCameraLayoutSnapshot, sampleVideoFrameContent, computePreviewCoverGeometry };')(window, document);
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
test('B3. the detector diagnostic buffer is bounded (latest 300), never an unbounded growing log', () => {
  assert.ok(html.includes('detectorSamplesRef.current = [...detectorSamplesRef.current, sample].slice(-300);'));
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

// ------------------------------------------------------------
// C — "STRONG ZOOM + Поиск лица" investigation: preview-crop geometry
// + processing-frame independence + widened detector box fields.
// ------------------------------------------------------------
test('C1. computePreviewCoverGeometry matches the real-device iPhone 14 Pro example: 720x1280 video in a ~393x455 container crops ~35% vertical FOV, 0% horizontal', () => {
  const api = make({}, {});
  const g = api.computePreviewCoverGeometry(720, 1280, 393, 455);
  assert.ok(g, 'expected a geometry object for real, non-zero dimensions');
  // width is the constraining axis (393/720 > 455/1280), so scale is
  // set by width and there must be ZERO horizontal crop.
  assert.equal(g.cropHorizontalPct, 0);
  assert.equal(g.cropLeftPx, 0);
  assert.equal(g.cropRightPx, 0);
  // vertical crop must be substantial (this is the mathematical
  // explanation for "strong zoom") — real value is ~34.9%.
  assert.ok(g.cropVerticalPct > 30 && g.cropVerticalPct < 40, `expected ~35% vertical crop, got ${g.cropVerticalPct}%`);
  assert.ok(Math.abs(g.scale - 393/720) < 0.001, 'scale must be set by the width-constraining axis');
  // crop must be split symmetrically top/bottom (centered object-position).
  assert.equal(g.cropTopPx, g.cropBottomPx);
  assert.ok(g.effectiveVisibleHeightFraction > 0.6 && g.effectiveVisibleHeightFraction < 0.7);
  assert.equal(g.effectiveVisibleWidthFraction, 1);
});
test('C2. computePreviewCoverGeometry reports zero crop when the video and container aspect ratios already match', () => {
  const api = make({}, {});
  const g = api.computePreviewCoverGeometry(400, 300, 800, 600); // identical 4:3 aspect
  assert.equal(g.cropHorizontalPct, 0);
  assert.equal(g.cropVerticalPct, 0);
  assert.equal(g.effectiveVisibleWidthFraction, 1);
  assert.equal(g.effectiveVisibleHeightFraction, 1);
});
test('C3. computePreviewCoverGeometry returns null (never throws/divides-by-zero) when any dimension is missing', () => {
  const api = make({}, {});
  assert.equal(api.computePreviewCoverGeometry(0, 1280, 393, 455), null);
  assert.equal(api.computePreviewCoverGeometry(720, 0, 393, 455), null);
  assert.equal(api.computePreviewCoverGeometry(720, 1280, 0, 455), null);
  assert.equal(api.computePreviewCoverGeometry(720, 1280, 393, 0), null);
});
test('C4. computePreviewCoverGeometry is a pure, standalone function — it does not read/write video/canvas/DOM state and is never called by drawVideoCover', () => {
  const start = html.indexOf('function computePreviewCoverGeometry(vw, vh, dispW, dispH) {');
  assert.ok(start > 0);
  const body = html.slice(start, html.indexOf('\n    }', start));
  assert.ok(!/document\.|getContext|drawImage|getBoundingClientRect/.test(body), 'must be a pure arithmetic function, no DOM/canvas access');
  const drawVideoCoverStart = html.indexOf('function drawVideoCover(ctx, video, dispW, dispH, mirrored) {');
  const drawVideoCoverBody = html.slice(drawVideoCoverStart, html.indexOf('\n    }', drawVideoCoverStart));
  assert.ok(!drawVideoCoverBody.includes('computePreviewCoverGeometry'), 'production drawVideoCover must remain completely independent of this diagnostic-only function');
});
test('C5. readCameraLayoutSnapshot exposes previewCoverGeometry, derived from the SAME rounded container rect drawVideoCover itself uses', () => {
  const style = Object.freeze({ getPropertyValue: () => 'auto' });
  const video = Object.freeze({ getBoundingClientRect: () => ({ x:0, y:0, width:393, height:455 }), clientWidth:393, clientHeight:455,
    offsetWidth:393, offsetHeight:455, videoWidth: 720, videoHeight: 1280, readyState: 4, paused: false, currentTime: 1 });
  const container = Object.freeze({ getBoundingClientRect: () => ({ x:0, y:0, width:392.6, height:455.4 }), clientWidth:393, clientHeight:455 });
  const api = make({ innerWidth: 393, innerHeight: 852, screen: { width: 393, height: 852 }, devicePixelRatio: 3, getComputedStyle: () => style });
  const snapshot = api.readCameraLayoutSnapshot(video, container, null);
  assert.ok(snapshot.previewCoverGeometry, 'expected previewCoverGeometry to be computed when both video and container are present');
  assert.ok(snapshot.previewCoverGeometry.cropVerticalPct > 30, 'unrounded 392.6/455.4 container rect must still round to the same real-device crop finding');
  assert.equal(api.readCameraLayoutSnapshot(null, container, null).previewCoverGeometry, null);
  assert.equal(api.readCameraLayoutSnapshot(video, null, null).previewCoverGeometry, null);
});
test('C6. processingCanvas is read from a SEPARATE ref (procCanvasRef) than the preview geometry (container/video refs) — preview and detector geometry are measured independently, never the same source', () => {
  const start = html.indexOf("if (procCanvasRef?.current) {");
  assert.ok(start > 0, 'expected the processingCanvas capture block');
  const body = html.slice(start, html.indexOf('}', html.indexOf('sourceCropped: false', start)) + 1);
  assert.ok(body.includes('procCanvasRef.current.width'));
  assert.ok(body.includes('procCanvasRef.current.height'));
  assert.ok(!body.includes('containerRef') && !body.includes('videoRef'), 'processingCanvas must come from procCanvasRef only, never the container/video refs previewCoverGeometry uses');
  assert.ok(html.includes('sourceCropped: false'), 'processing frame must be structurally asserted as never cropped');
});
test('C7. the processing draw call has no source rectangle at all — it structurally cannot crop, matching the sourceCropped:false diagnostic field', () => {
  const calls = [...html.matchAll(/ctx\.drawImage\(video, 0, 0, canvas\.width, canvas\.height\)/g)];
  assert.ok(calls.length >= 2, 'expected the pre-existing full-frame, uncropped processing drawImage calls (LiveScanScreen + PhotoAnalysisScreen)');
});
test('C8. every recordDetectorSample call site now also records boxX/boxY/boxHeight/canvasHeight/boxClipped — still only plain bounding-box geometry, never landmarks/pixels/identity data', () => {
  const calls = [...html.matchAll(/recordDetectorSample\(\{([\s\S]*?)\}\);/g)].map(m => m[1]);
  assert.equal(calls.length, 4);
  const forbidden = ['landmarks', 'jaw', 'nose', 'mouth', 'leftEye', 'rightEye', 'leftBrow', 'rightBrow',
    'physicalLeft', 'physicalRight', 'dataURL', 'getImageData', 'toDataURL', 'leftIris', 'rightIris'];
  for (const body of calls) {
    for (const token of forbidden) assert.ok(!body.includes(token), `unexpectedly includes "${token}"`);
    for (const key of ['boxX', 'boxY', 'boxWidth', 'boxHeight', 'boxClipped', 'canvasWidth', 'canvasHeight']) {
      assert.ok(body.includes(key), `missing new/existing field "${key}"`);
    }
  }
});
test('C9. the no-detection sample explicitly nulls every box field (there is no box when nothing was detected)', () => {
  const start = html.indexOf("rejectionReasons: ['no_detection']");
  const callStart = html.lastIndexOf('recordDetectorSample({', start);
  const call = html.slice(callStart, html.indexOf('});', start) + 3);
  assert.ok(call.includes('boxX: null'));
  assert.ok(call.includes('boxY: null'));
  assert.ok(call.includes('boxHeight: null'));
  assert.ok(call.includes('boxClipped: null'));
});
test('C10. this diagnostic extension does not touch faceRatio/too_close/too_far thresholds, TinyFaceDetector config, or getUserMedia constraints (re-verified after the box-field widening)', () => {
  assert.equal((html.match(/faceRatio < 0\.16/g) || []).length, 1);
  assert.equal((html.match(/faceRatio > 0\.78/g) || []).length, 1);
  assert.equal((html.match(/new faceapi\.TinyFaceDetectorOptions\(\{ inputSize: 320, scoreThreshold: 0\.5 \}\)/g) || []).length, 2);
  assert.ok(html.includes("navigator.mediaDevices.getUserMedia({ video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })"));
});

function issueBRecorder(enabled = true) {
  let now = 0;
  const refs = { pendingDetectorSampleRef: { current: null }, detectorDebugStartRef: { current: null }, detectorSamplesRef: { current: [] }, cameraLayoutDebugRef: { current: () => {} } };
  const start = html.indexOf('      const recordDetectorSample = (partial) => {');
  const end = html.indexOf('      tickImplRef.current', start);
  const api = new Function('cameraLayoutDebugEnabled', 'performance', ...Object.keys(refs), 'setDetectorDebugLatest',
    html.slice(start, end) + ';return {recordDetectorSample, flushDetectorSample};')(
      enabled, {now: () => now}, ...Object.values(refs), () => {});
  return { ...api, refs, advance: ms => { now += ms; } };
}
test('Issue B retains more than 30 seconds at maximum tick rate and caps history at 300', () => {
  const r = issueBRecorder();
  for (let i = 0; i < 400; i++) {
    r.recordDetectorSample({hasFace: i % 2 === 0, stageKey: 'old', hintKey: 'old', rejectionReasons: [], boxClipped: false});
    r.flushDetectorSample({videoWidth: 720}, {stageKey: 'current', hintKey: null});
    r.advance(200);
  }
  const samples = r.refs.detectorSamplesRef.current;
  assert.equal(samples.length, 300);
  assert.equal(samples.at(-1).elapsedMs - samples[0].elapsedMs, 59800);
  assert.equal(samples.at(-1).stageKey, 'current');
  assert.equal(samples.at(-1).hintKey, null);
  assert.equal(samples.at(-1).boxNearEdge, false);
});
test('Issue B plain URL never queues or publishes a detector sample', () => {
  const r = issueBRecorder(false);
  r.recordDetectorSample({hasFace: true}); r.flushDetectorSample({}, {});
  assert.equal(r.refs.pendingDetectorSampleRef.current, null);
  assert.deepEqual(r.refs.detectorSamplesRef.current, []);
});
test('Issue B uses actual stage/hint setter decisions, flushing after all return branches', () => {
  const begin = html.indexOf('        const diagnosticDecision = {};');
  const end = html.indexOf('        try {', begin);
  for (const enabled of [false, true]) {
    const stages = [], hints = [];
    const run = new Function('cameraLayoutDebugEnabled','setStageKey','setHintKey', html.slice(begin,end) +
      "decideStage('stageRealigning'); decideHint('hintCenterFace'); return diagnosticDecision;");
    const result = run(enabled, key => stages.push(key), key => hints.push(key));
    assert.deepEqual(stages, ['stageRealigning']); assert.deepEqual(hints, ['hintCenterFace']);
    assert.deepEqual(result, enabled ? {stageKey:'stageRealigning',hintKey:'hintCenterFace'} : {});
  }
  assert.ok(html.includes('} finally {\n          flushDetectorSample(diagnosticGeometry, diagnosticDecision);'));
  assert.ok(html.includes('hintKey: withinGrace ? hintKey : null'));
});
test('Issue B completion holds only diagnostic sessions; plain completion falls through unchanged', () => {
  const start = html.indexOf('          if (cameraLayoutDebugEnabled) { decideStage(\'stageComplete\');');
  const end = html.indexOf('          doneRef.current = true;',start);
  assert.ok(start > 0 && end > start);
  const run = new Function('cameraLayoutDebugEnabled','decideStage','decideHint',html.slice(start,end)+'return "production completion";');
  const stages = [];
  assert.equal(run(true, key => stages.push(key), () => {}), undefined);
  assert.deepEqual(stages, ['stageComplete']);
  assert.equal(run(false, () => assert.fail(), () => assert.fail()), 'production completion');
  assert.ok(html.includes('setTimeout(() => onCompleteRef.current(rec), 1000);'));
});
test('Issue B includes exposed zoom only, never requests it, and pixel sampling requires a second explicit flag', () => {
  const style = {getPropertyValue: () => ''};
  const api = make({ screen: {}, getComputedStyle: () => style });
  for (const exposed of [false, true]) {
    const el = {getBoundingClientRect: () => ({width:393,height:709}),videoWidth:720,videoHeight:1280,
      srcObject:{getVideoTracks: () => [{getSettings: () => ({width:720,...(exposed ? {zoom:1.5}:{}),deviceId:'SECRET'}),applyConstraints:()=>assert.fail()}]}};
    const settings = api.readCameraLayoutSnapshot(el,el,null).mediaTrackSettings;
    assert.equal('zoom' in settings, exposed);
    if(exposed) assert.equal(settings.zoom,1.5);
    assert.equal('deviceId' in settings,false);
  }
  assert.ok(html.includes("if (new URLSearchParams(window.location.search).get('cameraContentDebug') === '1' && CAMERA_CONTENT_SAMPLE_EVENTS.has(event))"));
  const recorder = html.slice(html.indexOf('const flushDetectorSample ='),html.indexOf('      tickImplRef.current'));
  assert.ok(!/getImageData|drawImage|toDataURL|landmarks/.test(recorder));
});
