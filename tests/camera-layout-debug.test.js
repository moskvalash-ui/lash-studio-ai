'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const html = fs.readFileSync(require('node:path').join(__dirname, '../index.html'), 'utf8');
const source = html.slice(html.indexOf('    function isCameraLayoutDebugEnabled()'), html.indexOf('    function CameraLayoutDebugPanel('));
const make = window => new Function('window', source + '\nreturn { isCameraLayoutDebugEnabled, readCameraLayoutSnapshot };')(window);
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
