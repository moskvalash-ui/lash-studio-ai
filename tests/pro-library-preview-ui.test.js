'use strict';
const test=require('node:test');
const assert=require('node:assert');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const Library=require('../professional-lash-library.js');

const root=path.join(__dirname,'..');
const indexSource=fs.readFileSync(path.join(root,'index.html'),'utf8');
const domainSource=fs.readFileSync(path.join(root,'lash-design-domain.js'),'utf8');
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');

const headEnd=indexSource.indexOf('</head>');
const previewStart=indexSource.indexOf('// DEBUG-ONLY: Professional Lash Library preview');
const appStart=indexSource.indexOf('function App() {');
const previewBlock=indexSource.slice(previewStart,appStart);
// Code-only region (skips the leading doc comment, which legitimately
// names DESIGN_CATALOG/rankDesigns/rankDesignsAll/calculateEyeLashMap
// in prose to document what the preview does NOT do) — used for the
// "never calls X" checks so a documentation word doesn't read as a call.
const previewCodeBlock=indexSource.slice(indexSource.indexOf('const PRO_LIBRARY_KIND_LABELS'),appStart);
const catalogStart=indexSource.indexOf('    const DESIGN_CATALOG = ');
const catalogEnd=indexSource.indexOf('\n\n    function calculateEyeLashMap(',catalogStart);
const catalogSource=indexSource.slice(catalogStart,catalogEnd);
const catalog=new Function('const clampScore=n=>n;'+catalogSource+';return DESIGN_CATALOG;')();

test('the professional-lash-library.js script tag exists using the same plain-script pattern as other local scripts',()=>{
  assert.ok(indexSource.includes('<script src="professional-lash-library.js"></script>'));
  assert.ok(indexSource.indexOf('<script src="professional-lash-library.js"></script>')<headEnd);
});

test('?debug=library is recognized and drives the initial screen, while the normal default screen remains home',()=>{
  const screenStateBlock=indexSource.slice(indexSource.indexOf('const [screen, setScreen] = useState'),indexSource.indexOf('const [result, setResult] = useState'));
  assert.ok(screenStateBlock.includes("URLSearchParams(window.location.search).get('debug') === 'library'"));
  assert.ok(screenStateBlock.includes("'proLibraryPreview'"));
  assert.ok(screenStateBlock.includes("'home'"));
  // the fallback/otherwise branch must resolve to 'home', not some other screen
  const lastReturnsHome=/:\s*'home'/.test(screenStateBlock);
  assert.ok(lastReturnsHome);
});

test('the debug library screen exists and is wired into the screen router as a plain sibling branch',()=>{
  assert.ok(indexSource.includes("function ProLibraryPreviewScreen("));
  assert.ok(indexSource.includes("{screen === 'proLibraryPreview' && <ProLibraryPreviewScreen"));
});

test('the preview uses targetInventory and getDefinition, and no other production data source',()=>{
  assert.ok(previewBlock.includes('ProfessionalLashLibrary.library.targetInventory'));
  assert.ok(previewBlock.includes('ProfessionalLashLibrary.getDefinition('));
  assert.ok(!previewCodeBlock.includes('DESIGN_CATALOG'));
  assert.ok(!previewCodeBlock.includes('TECHNIQUE_CATALOG'));
});

test('all 15 canonical identities are available to the preview via targetInventory',()=>{
  const expectedNames=['Natural','Classic','Doll','Cat','Fox','Squirrel','Eyeliner','Wispy','Kim K','Angel','Wet','Rays','Anime','Jellyfish','American'];
  assert.deepStrictEqual(Library.library.targetInventory.map(item=>item.name),expectedNames);
  for(const item of Library.library.targetInventory){
    const def=Library.getDefinition(item.canonicalId);
    assert.ok(def,item.canonicalId);
    assert.ok(def.kind);
    assert.ok(def.validation.status);
  }
});

test('the preview never calls rankDesigns, rankDesignsAll, or calculateEyeLashMap',()=>{
  assert.ok(!previewCodeBlock.includes('rankDesigns('));
  assert.ok(!previewCodeBlock.includes('rankDesignsAll('));
  assert.ok(!previewCodeBlock.includes('calculateEyeLashMap('));
});

test('the preview never mutates DESIGN_CATALOG and DESIGN_CATALOG stays exactly 21 entries',()=>{
  assert.ok(!previewCodeBlock.includes('DESIGN_CATALOG.push'));
  assert.ok(!previewCodeBlock.includes('DESIGN_CATALOG['));
  assert.ok(!previewCodeBlock.includes('DESIGN_CATALOG.splice'));
  assert.strictEqual(catalog.length,21);
  assert.deepStrictEqual(catalog.map(entry=>entry.id),['natural','naturalRounded','naturalElongated','angel','doll','rounded','squirrel','kitten','cat','softcat','fox','softfox','eyeliner','wispy','wispycat','wispydoll','kim','manga','wet','reverse','correction']);
});

test('productionEnabled stays false and activeDefinitionIds stays empty',()=>{
  assert.strictEqual(Library.library.activation.productionEnabled,false);
  assert.deepStrictEqual(Library.library.activation.activeDefinitionIds,[]);
});

test('all 21 legacy IDs remain unchanged and ClientLashDesign production source is untouched',()=>{
  assert.deepStrictEqual(catalog.map(entry=>entry.id),['natural','naturalRounded','naturalElongated','angel','doll','rounded','squirrel','kitten','cat','softcat','fox','softfox','eyeliner','wispy','wispycat','wispydoll','kim','manga','wet','reverse','correction']);
  assert.strictEqual(digest(catalogSource),'b0f44de8e19dfaa6ff0f32b067fbabb7fad9cd450ade07cb686f760bad6095f4');
  assert.strictEqual(digest(domainSource),'992a524132b75c7e8f38e15829461f874cc2af84c567e41f33500f028a03e959');
  assert.ok(!domainSource.includes('ProfessionalLashLibrary'));
});

test('no activation/editing UI exists in the preview: no buttons to activate, set active, or write to the library',()=>{
  for(const forbidden of ['activeDefinitionIds =','setActive','onActivate','activateDefinition','.push(','localStorage.setItem'])assert.ok(!previewBlock.includes(forbidden),forbidden);
  assert.ok(!previewBlock.includes('<input'));
  assert.ok(!previewBlock.includes('<select'));
  assert.ok(!previewBlock.includes('<button') || previewBlock.match(/<button/g).length===1);
});

test('no recommendation behavior changes: HomeScreen and the normal navigation flow are untouched',()=>{
  const homeScreenStart=indexSource.indexOf('function HomeScreen(');
  const homeScreenEnd=indexSource.indexOf('\n    function ',homeScreenStart+10);
  const homeScreenSource=indexSource.slice(homeScreenStart,homeScreenEnd);
  assert.ok(!homeScreenSource.includes('ProfessionalLashLibrary'));
  assert.ok(!homeScreenSource.includes('proLibraryPreview'));
  assert.ok(indexSource.includes("const [screen, setScreen] = useState(() => {"));
  assert.ok(indexSource.includes("{screen === 'home' && <HomeScreen"));
});

test('opening the site with no query param still resolves the initial screen to home, matching production behavior before this change',()=>{
  const initializer=indexSource.slice(indexSource.indexOf('const [screen, setScreen] = useState(() => {'),indexSource.indexOf('});',indexSource.indexOf('const [screen, setScreen] = useState(() => {'))+3);
  // eslint-disable-next-line no-new-func
  const fn=new Function('URLSearchParams','window',`return (${initializer.replace('const [screen, setScreen] = useState(','').replace(/\);$/,'')})();`);
  const fakeWindow={location:{search:''}};
  assert.strictEqual(fn(URLSearchParams,fakeWindow),'home');
  const fakeWindowDebug={location:{search:'?debug=library'}};
  assert.strictEqual(fn(URLSearchParams,fakeWindowDebug),'proLibraryPreview');
});
