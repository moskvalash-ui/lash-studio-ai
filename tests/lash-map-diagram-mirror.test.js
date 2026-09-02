const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const Domain = require('../lash-design-domain.js');

// Extract the exact LegacyLashMapDiagram renderer source (JSX, not
// directly executable under plain Node) so string-level assertions
// check the real implementation rather than a duplicated formula.
const rendererStart = src.indexOf('    function LegacyLashMapDiagram(');
const rendererEnd = src.indexOf('\n    // Phase 2B consumer boundary', rendererStart);
assert.ok(rendererStart >= 0 && rendererEnd > rendererStart, 'LegacyLashMapDiagram must be structurally extractable');
const rendererSource = src.slice(rendererStart, rendererEnd);

const consumerStart = src.indexOf('    function LashMapDiagram(');
const consumerEnd = src.indexOf('\n\n    // Artist-facing map', consumerStart);
assert.ok(consumerStart >= 0 && consumerEnd > consumerStart, 'LashMapDiagram consumer must be structurally extractable');
const consumerSource = src.slice(consumerStart, consumerEnd);

test('LegacyLashMapDiagram accepts a side prop and LashMapDiagram forwards it via diagramProps', () => {
  assert.ok(rendererSource.includes('function LegacyLashMapDiagram({ zones, peakIdx, spikeGeom, curve, hoveredZone, setHoveredZone, curl, technique, side, lang }) {'));
  assert.ok(consumerSource.includes('const diagramProps=LashDesignDomain.diagramPropsFromClientDesign(clientDesign);'));
  assert.ok(consumerSource.includes('<LegacyLashMapDiagram {...diagramProps}'));
});

test('the real extracted xAt formula mirrors horizontally around the canvas center for side="right"', () => {
  const xAtMatch = rendererSource.match(/xAt=(t=>[^;]+);/);
  assert.ok(xAtMatch, 'xAt formula must be extractable from the renderer source');
  const xAt = new Function('side', `return (${xAtMatch[1]});`);
  const leftXAt = xAt('left');
  const rightXAt = xAt('right');

  // INNER (t=0) and OUTER (t=1) land on opposite screen edges when the
  // side flips, and every intermediate t is the reflection of the other
  // side around the canvas's horizontal center (viewBox width 400).
  for (const t of [0, .25, .44, .5, .66, 1]) {
    assert.strictEqual(leftXAt(t) + rightXAt(t), 400, `t=${t} must be symmetric about the canvas center`);
  }
  assert.notStrictEqual(leftXAt(0), rightXAt(0));
  assert.strictEqual(leftXAt(0), rightXAt(1));
  assert.strictEqual(leftXAt(1), rightXAt(0));
});

test('diagramPropsFromClientDesign propagates the active side captured by withDiagramRuntime', () => {
  const entry = { id: 'fox', baseZones: [5, 5, 8, 11, 10], peakZone: 3, zonePositions: null, postPeakShape: 'linear', plateauShape: 'linear' };
  const profile = { leftEye: {}, rightEye: {} };
  const expandSectors = (zones, peakIdx) => zones.map((len, i) => ({ len, t: i / (zones.length - 1), isPeak: i === peakIdx, isKey: true, label: null }));
  const design = {
    id: 'fox', category: 'fox', name: 'Fox', ruName: 'Fox', enName: 'Fox', aliases: [],
    score: 80, whyItWorks: '', correctionGoal: '', limitations: [],
    baseCurl: 'C', curlOptions: ['C'], defaultTechnique: '2D',
    peakZone: 3, leftPeakZone: 3, rightPeakZone: 3,
    leftCorrectionMm: 0, rightCorrectionMm: 0, texture: null,
    curve: { zonePositions: null, postPeakShape: 'linear', plateauShape: 'linear' },
    leftZones: [5, 5, 8, 11, 10], rightZones: [5, 5, 8, 11, 10],
    curlRec: { primary: 'C', alternatives: [] },
  };
  const clientDesign = Domain.legacyToClientLashDesign({ design, catalogEntry: entry, eyeProfile: profile, expandSectors });

  for (const activeSide of ['left', 'right']) {
    const withRuntime = Domain.withDiagramRuntime(clientDesign, {
      activeSide, zones: design.leftZones, peakIdx: design.leftPeakZone, curve: design.curve,
      curl: 'C', technique: '2D', spikeGeometry: null,
    });
    assert.strictEqual(withRuntime.mapping.diagram.activeSide, activeSide);
    const props = Domain.diagramPropsFromClientDesign(withRuntime);
    assert.strictEqual(props.side, activeSide, `diagramPropsFromClientDesign must forward activeSide="${activeSide}"`);
  }
});
