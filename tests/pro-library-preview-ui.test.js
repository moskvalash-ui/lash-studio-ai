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
const previewCodeBlock=indexSource.slice(indexSource.indexOf('const PRO_LIBRARY_KIND_LABELS'),appStart);
const detailBlock=indexSource.slice(indexSource.indexOf('function ProLibraryDetailScreen('),appStart);
const routerBlock=indexSource.slice(indexSource.indexOf("{screen === 'proLibraryPreview'"),indexSource.indexOf("{/* First-visit consent banner"));
const catalogStart=indexSource.indexOf('    const DESIGN_CATALOG = ');
const catalogEnd=indexSource.indexOf('\n\n    function calculateEyeLashMap(',catalogStart);
const catalogSource=indexSource.slice(catalogStart,catalogEnd);
const catalog=new Function('const clampScore=n=>n;'+catalogSource+';return DESIGN_CATALOG;')();

function extractObjectLiteral(name){
  const start=indexSource.indexOf('const '+name+' = {');
  const braceStart=indexSource.indexOf('{',start);
  let depth=0,i=braceStart;
  for(;i<indexSource.length;i++){
    if(indexSource[i]==='{')depth++;
    else if(indexSource[i]==='}'){depth--;if(depth===0)break;}
  }
  return new Function('return '+indexSource.slice(braceStart,i+1))();
}
function collectRenderedValuesAndKeys(){
  const seenValues=new Set(),seenKeys=new Set();
  function walk(obj){
    if(obj===null||obj===undefined)return;
    if(Array.isArray(obj)){obj.forEach(walk);return;}
    if(typeof obj==='object'){Object.entries(obj).forEach(([k,v])=>{seenKeys.add(k);walk(v);});return;}
    if(typeof obj==='string'&&/^[A-Z0-9]+(_[A-Z0-9]+)*$/.test(obj)&&obj.length>1)seenValues.add(obj);
  }
  for(const item of Library.library.targetInventory)walk(Library.getDefinition(item.canonicalId).professionalDefinition);
  walk(Library.library.schema.textureConstruction.primitiveDefinitions.RAY.professionalDefinition);
  return {seenValues,seenKeys};
}

// Loads the plain-JS methodical composer functions (buildMethodicalSections
// and its helpers) straight out of index.html and evaluates them in this
// Node process against the REAL library data — the same functions the
// browser runs, not a reimplementation. The two JSX components
// (ProLibraryPreviewScreen/ProLibraryDetailScreen) are deliberately
// excluded from this eval (JSX doesn't parse in plain Node); everything
// that actually composes the methodical text is plain JS and is included.
function loadComposer(){
  const sandbox={};
  sandbox.ProfessionalLashLibrary=Library;
  sandbox.PRO_LIB_NAME_RU=extractObjectLiteral('PRO_LIB_NAME_RU');
  sandbox.PRO_LIB_KIND_LABELS_RU=extractObjectLiteral('PRO_LIB_KIND_LABELS_RU');
  sandbox.PRO_LIBRARY_KIND_LABELS=extractObjectLiteral('PRO_LIBRARY_KIND_LABELS');
  sandbox.PRO_LIB_KEY_LABELS_RU=extractObjectLiteral('PRO_LIB_KEY_LABELS_RU');
  sandbox.PRO_LIB_VALUE_LABELS_RU=extractObjectLiteral('PRO_LIB_VALUE_LABELS_RU');
  const chunk1Start=indexSource.indexOf('function plIdentityName');
  const chunk1End=indexSource.indexOf('function ProLibraryPreviewScreen');
  const chunk2Start=indexSource.indexOf('function plIsMetaStatus');
  // Stops before KimKMasterGuideBody (JSX, deliberately excluded from this
  // plain-JS eval, same reasoning as ProLibraryPreviewScreen/DetailScreen)
  // but still includes the plain-JS buildKimKMasterGuide data function.
  const chunk2End=indexSource.indexOf('function KimKMasterGuideBody');
  const code=indexSource.slice(chunk1Start,chunk1End)+'\n'+indexSource.slice(chunk2Start,chunk2End)+
    '\nreturn {buildMethodicalSections, buildKimKMasterGuide, plLabel, plKindLabel, plIdentityName};';
  const fn=new Function('sandbox','with(sandbox){ '+code+' }');
  return fn(sandbox);
}
let composer;
try{ composer=loadComposer(); }catch(e){ composer=null; global.__composerLoadError=e; }

test('the professional-lash-library.js script tag exists using the same plain-script pattern as other local scripts',()=>{
  assert.ok(indexSource.includes('<script src="professional-lash-library.js"></script>'));
  assert.ok(indexSource.indexOf('<script src="professional-lash-library.js"></script>')<headEnd);
});

test('1. ?debug=library is recognized and drives the initial screen, while the default route remains home',()=>{
  const initStart=indexSource.indexOf('const [screen, setScreen] = useState(() => {');
  const initEnd=indexSource.indexOf('});',initStart)+3;
  const initSrc=indexSource.slice(initStart,initEnd).replace('const [screen, setScreen] = useState(','').replace(/\);$/,'');
  const fn=new Function('URLSearchParams','window',`return (${initSrc})();`);
  assert.strictEqual(fn(URLSearchParams,{location:{search:''}}),'home');
  assert.strictEqual(fn(URLSearchParams,{location:{search:'?debug=library'}}),'proLibraryPreview');
});

test('2. default route resolves to home and HomeScreen/normal navigation are untouched',()=>{
  const homeScreenStart=indexSource.indexOf('function HomeScreen(');
  const homeScreenEnd=indexSource.indexOf('\n    function ',homeScreenStart+10);
  const homeScreenSource=indexSource.slice(homeScreenStart,homeScreenEnd);
  assert.ok(!homeScreenSource.includes('ProfessionalLashLibrary'));
  assert.ok(!homeScreenSource.includes('proLibraryPreview'));
  assert.ok(indexSource.includes("{screen === 'home' && <HomeScreen"));
});

test('3. all 15 canonical identities are available to the preview via targetInventory',()=>{
  const expectedNames=['Natural','Classic','Doll','Cat','Fox','Squirrel','Eyeliner','Wispy','Kim K','Angel','Wet','Rays','Anime','Jellyfish','American'];
  assert.deepStrictEqual(Library.library.targetInventory.map(item=>item.name),expectedNames);
  for(const item of Library.library.targetInventory){
    const def=Library.getDefinition(item.canonicalId);
    assert.ok(def,item.canonicalId);
  }
});

test('4. every canonical identity card is tappable and opens the detail state for its own canonicalId',()=>{
  assert.ok(previewBlock.includes('onClick={() => onSelect(item.canonicalId)}'));
  assert.ok(routerBlock.includes("onSelect={(canonicalId) => { setDebugPreviewCanonicalId(canonicalId); setScreen('proLibraryDetail'); }}"));
});

test('5. Back works: detail returns to the preview list, preview returns to home',()=>{
  assert.ok(routerBlock.includes("<ProLibraryDetailScreen canonicalId={debugPreviewCanonicalId} onBack={() => setScreen('proLibraryPreview')} />"));
  assert.ok(routerBlock.includes("<ProLibraryPreviewScreen onBack={() => setScreen('home')}"));
});

test('6. RU/EN: both screens consume useLang(), and the methodical composer produces different text per language',()=>{
  assert.ok(previewBlock.includes('const lang = useLang();'));
  assert.ok(composer,'composer failed to load: '+(global.__composerLoadError&&global.__composerLoadError.message));
  const cat=Library.getDefinition('geometry.cat');
  const ru=composer.buildMethodicalSections(cat,'ru');
  const en=composer.buildMethodicalSections(cat,'en');
  assert.ok(ru.length>0&&en.length>0);
  assert.notStrictEqual(ru[0].title,en[0].title);
  assert.notStrictEqual(ru[0].paragraphs[0],en[0].paragraphs[0]);
  assert.ok(/[а-яё]/i.test(ru[0].paragraphs[0]),'RU output should contain Cyrillic text');
  assert.ok(!/[а-яё]/i.test(en[0].paragraphs[0]),'EN output should not contain Cyrillic text');
});

test('7. the Detail screen is no longer a generic recursive raw-object renderer',()=>{
  assert.ok(!indexSource.includes('ProLibKVRows'));
  assert.ok(!indexSource.includes('function ProLibSection'));
  assert.ok(!indexSource.includes('PRO_LIB_SECTION_PLAN'));
  assert.ok(!indexSource.includes('proLibPickKeys'));
  assert.ok(detailBlock.includes('buildMethodicalSections'));
});

test('8-9. no raw property names, raw enum plumbing, or null/undefined ever surface as rendered methodical content',()=>{
  assert.ok(composer);
  const forbiddenTokens=/^[A-Z0-9]+(_[A-Z0-9]+)*$/; // a bare untouched SCREAMING_SNAKE token
  for(const item of Library.library.targetInventory){
    const def=Library.getDefinition(item.canonicalId);
    for(const lang of ['ru','en']){
      const sections=composer.buildMethodicalSections(def,lang);
      for(const s of sections){
        for(const p of s.paragraphs){
          assert.strictEqual(typeof p,'string',`${item.canonicalId}/${lang}: paragraph must be a string`);
          assert.ok(!forbiddenTokens.test(p.trim()),`${item.canonicalId}/${lang}: raw enum token rendered as prose: ${p}`);
          assert.ok(!/\bnull\b/i.test(p),`${item.canonicalId}/${lang}: literal "null" rendered: ${p}`);
          assert.ok(!/\bundefined\b/i.test(p),`${item.canonicalId}/${lang}: literal "undefined" rendered: ${p}`);
          assert.ok(!/^[a-z]+([A-Z][a-z]*)+$/.test(p.trim()),`${item.canonicalId}/${lang}: bare camelCase field name rendered: ${p}`);
        }
      }
    }
  }
});

test('10. methodical sections are genuinely derived from canonical data (spot checks against real values)',()=>{
  assert.ok(composer);
  const cat=composer.buildMethodicalSections(Library.getDefinition('geometry.cat'),'ru');
  const essence=cat.find(s=>s.title==='Суть эффекта');
  assert.ok(essence&&/вытяжение/i.test(essence.paragraphs[0]),'Cat essence should reflect its canonical STRONGER_FELINE_OUTER_ELONGATION intent');
  const classic=composer.buildMethodicalSections(Library.getDefinition('technique.classic-one-to-one'),'ru');
  const essenceTech=classic.find(s=>s.title==='Суть техники');
  assert.ok(essenceTech&&/ресничк/i.test(essenceTech.paragraphs[0]),'Classic essence should reflect its canonical one-extension-per-lash invariant');
});

test('11. domain semantics are respected: Classic reads as a technique, Rays reads as a reusable primitive, Eyeliner reads as a composite preset',()=>{
  assert.ok(composer);
  const classic=composer.buildMethodicalSections(Library.getDefinition('technique.classic-one-to-one'),'ru');
  assert.ok(classic.some(s=>s.title==='Суть техники'),'Classic must use the technique-specific essence title, not a geometry one');
  assert.ok(!classic.some(s=>s.title==='Пик / зона максимального акцента'),'Classic (a technique) must not get a geometry peak section');

  const rays=composer.buildMethodicalSections(Library.getDefinition('construction.rays'),'ru');
  const raysEssence=rays.find(s=>s.title==='Суть эффекта');
  assert.ok(raysEssence&&raysEssence.paragraphs.some(p=>/переиспользуемый строительный элемент/.test(p)),'Rays must be explained as a reusable primitive, not a standalone effect');

  const eyeliner=composer.buildMethodicalSections(Library.getDefinition('preset.eyeliner'),'ru');
  assert.ok(eyeliner.some(s=>s.title==='Слои композиции'),'Eyeliner (a composite preset) must show its layer composition');
});

test('12. the preview/detail code never calls production ranking/scoring functions',()=>{
  assert.ok(!previewCodeBlock.includes('rankDesigns('));
  assert.ok(!previewCodeBlock.includes('rankDesignsAll('));
  assert.ok(!previewCodeBlock.includes('calculateEyeLashMap('));
  assert.ok(!previewCodeBlock.includes('DESIGN_CATALOG'));
});

test('13. DESIGN_CATALOG stays byte-identical and exactly 21 entries',()=>{
  assert.strictEqual(catalog.length,21);
  assert.strictEqual(digest(catalogSource),'b0f44de8e19dfaa6ff0f32b067fbabb7fad9cd450ade07cb686f760bad6095f4');
});

test('14. all 21 legacy IDs remain unchanged',()=>{
  assert.deepStrictEqual(catalog.map(entry=>entry.id),['natural','naturalRounded','naturalElongated','angel','doll','rounded','squirrel','kitten','cat','softcat','fox','softfox','eyeliner','wispy','wispycat','wispydoll','kim','manga','wet','reverse','correction']);
});

test('15-16. productionEnabled stays false and activeDefinitionIds stays empty',()=>{
  assert.strictEqual(Library.library.activation.productionEnabled,false);
  assert.deepStrictEqual(Library.library.activation.activeDefinitionIds,[]);
});

test('17. Babel/JSX parse of the shared app script, when @babel/core is available locally',(t)=>{
  let babel;
  try{ babel=require('@babel/core'); }catch(e){ babel=null; }
  if(!babel){
    t.skip('@babel/core is not an installed dependency of this repo; full Babel parse verification is performed manually per phase (see implementation report) rather than as a hard CI dependency.');
    return;
  }
  const marker='<script type="text/babel">';
  const start=indexSource.indexOf(marker)+marker.length;
  const end=indexSource.indexOf('</script>',start);
  const script=indexSource.slice(start,end);
  assert.doesNotThrow(()=>babel.transformSync(script,{presets:[require.resolve('@babel/preset-react')],filename:'app.jsx'}));
});

test('no activation/editing UI exists in the preview or detail screen: every button is plain back/select navigation only',()=>{
  // Note: the methodical composer legitimately builds sentence arrays with
  // plain Array.push() (essenceParts.push, sections.push, notes.push) —
  // that is presentation-layer string assembly, not production activation.
  // What must never appear is a write to the library's own activation state.
  for(const forbidden of ['activeDefinitionIds.push','activeDefinitionIds =','library.activation.','setActive','onActivate','activateDefinition','localStorage.setItem'])assert.ok(!previewBlock.includes(forbidden),forbidden);
  assert.ok(!previewBlock.includes('<input'));
  assert.ok(!previewBlock.includes('<select'));
  assert.ok(!/activate/i.test(previewBlock));
  const onClicks=previewBlock.match(/onClick=\{[^}]*\}/g)||[];
  assert.ok(onClicks.length>0);
  for(const handler of onClicks)assert.ok(handler==='onClick={onBack}'||handler==='onClick={() => onSelect(item.canonicalId)}',handler);
});

test('RU value/key dictionaries still cover every enum-style value and key actually present in canonical data',()=>{
  const valueLabels=extractObjectLiteral('PRO_LIB_VALUE_LABELS_RU');
  const keyLabels=extractObjectLiteral('PRO_LIB_KEY_LABELS_RU');
  const {seenValues,seenKeys}=collectRenderedValuesAndKeys();
  assert.deepStrictEqual([...seenValues].filter(v=>!valueLabels[v]),[]);
  assert.deepStrictEqual([...seenKeys].filter(k=>!keyLabels[k]),[]);
});

test('canonicalId itself is never translated and stays visible as technical metadata',()=>{
  const nameRu=extractObjectLiteral('PRO_LIB_NAME_RU');
  for(const id of Object.keys(nameRu))assert.ok(!/[а-яё]/i.test(id),`canonicalId key must stay a plain technical string: ${id}`);
  assert.ok(previewBlock.includes('{item.canonicalId}'));
  assert.ok(previewBlock.includes('{def.id}'));
});

test('the Rays presentation gap is resolved via the existing reviewed RAY primitive, and RAY itself is untouched',()=>{
  assert.ok(previewBlock.includes("def.id === 'construction.rays'"));
  assert.ok(previewBlock.includes('primitiveDefinitions.RAY'));
  const ray=Library.library.schema.textureConstruction.primitiveDefinitions.RAY;
  assert.strictEqual(digest(JSON.stringify(ray)),'3e23c055de03aa7c238df7182c808983475d5d46e89062743d06066caa48aefb');
});

test('production is untouched: activation stays inactive and all legacy production consumers remain byte-identical',()=>{
  assert.strictEqual(digest(domainSource),'992a524132b75c7e8f38e15829461f874cc2af84c567e41f33500f028a03e959');
  assert.ok(!domainSource.includes('ProfessionalLashLibrary'));
  assert.strictEqual(Library.library.activation.productionEnabled,false);
  assert.deepStrictEqual(Library.library.activation.activeDefinitionIds,[]);
});

// ------------------------------------------------------------
// Group C content fix (Doll / Wispy / Kim K / Angel / Anime / Jellyfish):
// explicit regression guards for the raw machine phrases the content
// audit found, plus targeted checks per identity named in the fix.
// ------------------------------------------------------------
const PROBLEM_PHRASES=['Подтверждается','Частый вариант','предполагаемое качественное понятие','профессионально значимый предполагаемый признак','только класс физического исполнения'];

test('none of the previously-identified raw machine phrases appear anywhere in the RU methodical output for any of the 15 identities',()=>{
  assert.ok(composer,'composer failed to load: '+(global.__composerLoadError&&global.__composerLoadError.message));
  for(const item of Library.library.targetInventory){
    const def=Library.getDefinition(item.canonicalId);
    const sections=composer.buildMethodicalSections(def,'ru');
    for(const s of sections)for(const p of s.paragraphs){
      for(const phrase of PROBLEM_PHRASES){
        assert.ok(!p.toLowerCase().includes(phrase.toLowerCase()),`${item.canonicalId}: found "${phrase}" in "${p}"`);
      }
    }
  }
});

test('Doll: "Не путать с" now shows real distinguishing content instead of repeating Doll\'s own attributes',()=>{
  const doll=composer.buildMethodicalSections(Library.getDefinition('geometry.doll'),'ru');
  const notConfuse=doll.find(s=>s.title==='Не путать с');
  assert.ok(notConfuse,'Doll must have a Не путать с section');
  const lines=notConfuse.paragraphs;
  assert.strictEqual(lines.length,4);
  // the old bug: all four lines were the byte-identical "Центральная зона, открытый взгляд"
  const uniqueBodies=new Set(lines.map(l=>l.split(' — ')[1]||l));
  assert.ok(uniqueBodies.size>1,'comparisons must not all repeat the same self-attribute text: '+JSON.stringify(lines));
});

test('Angel: a Визуальный финиш section exists, uses canonical densityFinish data, and includes the light-is-not-weight clarification',()=>{
  const angel=composer.buildMethodicalSections(Library.getDefinition('construction.angel'),'ru');
  const finish=angel.find(s=>s.title==='Визуальный финиш');
  assert.ok(finish,'Angel must have a Визуальный финиш section');
  assert.ok(/воздушный|лёгкий|мягкий|перистый/i.test(finish.paragraphs[0]));
  assert.ok(finish.paragraphs.some(p=>/вес|нагрузку/.test(p)),'must clarify that "light/airy" is visual, not a weight/safety claim');
  const notConfuse=angel.find(s=>s.title==='Не путать с');
  const wetLine=notConfuse.paragraphs.find(p=>p.startsWith('Мокрый эффект'));
  assert.ok(wetLine&&/Ангел —/.test(wetLine),'Angel vs Wet must contrast both sides, not just describe Wet');
});

test('Anime: "Ритм и воздушные промежутки" is a plain-language methodical sentence, and "Не путать с" uses one shared closing note instead of three repeated ones',()=>{
  const anime=composer.buildMethodicalSections(Library.getDefinition('construction.anime'),'ru');
  const rhythm=anime.find(s=>s.title==='Ритм и воздушные промежутки');
  assert.ok(rhythm,'Anime must have a rhythm/negative-space section');
  assert.ok(/читаться отдельно|промежутк/i.test(rhythm.paragraphs.join(' ')));
  const notConfuse=anime.find(s=>s.title==='Не путать с');
  const repeated=notConfuse.paragraphs.filter(p=>p.includes('Точная граница может зависеть от школы'));
  assert.strictEqual(repeated.length,0,'the per-entry boundary note must be replaced by one shared note');
  assert.ok(notConfuse.paragraphs.some(p=>/различаться в разных школах/.test(p)),'must end with one shared cross-school note');
  const jellyfishLine=notConfuse.paragraphs.find(p=>p.startsWith('Медуза'));
  assert.ok(jellyfishLine&&!/отличается от/.test(jellyfishLine),'must not assert a hard Anime vs Jellyfish distinction');
});

test('Jellyfish: uncertainty is communicated as a plain-language artist note, not as epistemic/confidence language',()=>{
  const jellyfish=composer.buildMethodicalSections(Library.getDefinition('construction.jellyfish'),'ru');
  const considerations=jellyfish.find(s=>s.title==='Что важно учитывать мастеру');
  assert.ok(considerations);
  const honestyLine=considerations.paragraphs.find(p=>/используется мастерами не полностью одинаково/.test(p));
  assert.ok(honestyLine,'must include the plain-language terminology-consistency caveat');
  assert.ok(/Медуза/.test(honestyLine));
  const supportField=jellyfish.find(s=>s.title==='Поддерживающая структура');
  assert.ok(supportField&&/мягк|разрежен/i.test(supportField.paragraphs.join(' ')));
});

// ------------------------------------------------------------
// KIM K PRACTICAL MASTER GUIDE — a presentation/education adapter gated to
// construction.kim-k only, built from the dedicated execution-evidence
// review (multiple independent lash-education sources), never written back
// to professional-lash-library.js. Every research-derived range must be
// labeled as a working range, never a rule; no numeric D-volume or
// leg-length may be invented; both build-order variants must be presented
// as equally valid; and no evidence-review/schema jargon may leak into the
// RU/EN artist-facing copy.
// ------------------------------------------------------------
function collectGuideStrings(guide){
  const out=[];
  (function walk(v){
    if(typeof v==='string')out.push(v);
    else if(Array.isArray(v))v.forEach(walk);
    else if(v&&typeof v==='object')Object.values(v).forEach(walk);
  })(guide);
  return out;
}

test('Kim K detail screen is gated to the practical master-guide adapter; every other identity keeps the generic methodical composer unchanged',()=>{
  assert.ok(indexSource.includes("const isKimK = def.id === 'construction.kim-k';"));
  assert.ok(indexSource.includes('<KimKMasterGuideBody guide={kimKGuide} />'));
  assert.ok(indexSource.includes('function buildKimKMasterGuide(lang)'));
  for(const item of Library.library.targetInventory){
    if(item.canonicalId==='construction.kim-k')continue;
    const def=Library.getDefinition(item.canonicalId);
    const sections=composer.buildMethodicalSections(def,'ru');
    assert.ok(sections.length>0,`${item.canonicalId} must still render via the generic composer, unaffected by the Kim K adapter`);
  }
});

test('Kim K master guide: RU is fully populated and EN is an independent, natural rewrite (not a mechanical translation)',()=>{
  assert.ok(composer.buildKimKMasterGuide,'buildKimKMasterGuide must be exported by the composer');
  const ru=composer.buildKimKMasterGuide('ru');
  const en=composer.buildKimKMasterGuide('en');
  assert.notStrictEqual(ru.intro.lead,en.intro.lead);
  assert.ok(/[а-яё]/i.test(ru.intro.lead),'RU intro must contain Cyrillic text');
  assert.ok(!/[а-яё]/i.test(en.intro.lead),'EN intro must not contain Cyrillic text');
  assert.strictEqual(ru.buildMethods.length,2);
  assert.strictEqual(en.buildMethods.length,2);
});

test('Kim K master guide: default app language remains ru, unaffected by this phase',()=>{
  assert.ok(indexSource.includes("localStorage.getItem('lashStudioLang') || 'ru'"));
});

test('Kim K master guide: 2–4mm is labeled a common working range, never a mandatory standard',()=>{
  const ru=composer.buildKimKMasterGuide('ru');
  const en=composer.buildKimKMasterGuide('en');
  const ruDelta=ru.keyParams.find(p=>p.label==='Перепад длины');
  assert.ok(ruDelta&&ruDelta.value==='2–4 мм');
  assert.ok(/частый рабочий диапазон/i.test(ruDelta.note),'must be labeled a common working range');
  assert.ok(/не обязательный стандарт/i.test(ruDelta.note),'must explicitly deny being a mandatory standard');
  const enDelta=en.keyParams.find(p=>p.label==='Length difference');
  assert.ok(enDelta&&enDelta.value==='2–4mm');
  assert.ok(/(common(ly)? .*working range|typical working range)/i.test(enDelta.note));
  assert.ok(/not a fixed rule/i.test(enDelta.note));
});

test('Kim K master guide: ≈7–15 accents is labeled an approximate working reference, not a required count',()=>{
  const ru=composer.buildKimKMasterGuide('ru');
  const en=composer.buildKimKMasterGuide('en');
  const ruCount=ru.keyParams.find(p=>p.label==='Количество акцентов');
  assert.ok(ruCount&&ruCount.value==='≈ 7–15 на глаз');
  assert.ok(/рабочий ориентир, а не обязательное число/.test(ruCount.note));
  const enCount=en.keyParams.find(p=>p.label==='Accent count');
  assert.ok(enCount&&enCount.value==='≈7–15 per eye');
  assert.ok(/working reference, not a required number/i.test(enCount.note));
});

test('Kim K master guide: no fixed D-volume is ever presented as a Kim K rule',()=>{
  for(const guide of [composer.buildKimKMasterGuide('ru'),composer.buildKimKMasterGuide('en')]){
    for(const s of collectGuideStrings(guide)){
      assert.ok(!/\b[2-9]D\b/.test(s),`a fixed D-volume number leaked into the Kim K guide: "${s}"`);
    }
  }
});

test('Kim K master guide: no leg-length ("ножка"/leg/base-length) row or number is invented',()=>{
  const ru=composer.buildKimKMasterGuide('ru');
  const en=composer.buildKimKMasterGuide('en');
  assert.ok(!ru.accentHowTo.rows.some(r=>/ножк/i.test(r.label)),'RU accent table must omit the leg-length row entirely');
  assert.ok(!en.accentHowTo.rows.some(r=>/\bleg\b|base length/i.test(r.label)),'EN accent table must omit the leg-length row entirely');
});

test('Kim K master guide: two build-order methods exist and neither is presented as correct/preferred over the other',()=>{
  for(const guide of [composer.buildKimKMasterGuide('ru'),composer.buildKimKMasterGuide('en')]){
    assert.strictEqual(guide.buildMethods.length,2,'exactly two evidence-backed build-order variants');
    for(const m of guide.buildMethods){
      assert.ok(!/правильн|предпочтительн|\bcorrect\b|\bpreferred\b|recommended over/i.test(m.title+' '+m.note),`build method must not be ranked as correct/preferred: ${m.title}`);
    }
  }
});

test('Kim K master guide: no evidence-review/schema jargon leaks into RU or EN artist-facing copy',()=>{
  const banned=[/требует профессиональной валидации/i,/профессионально подтверждено/i,/уровень доказательности/i,/качественный инвариант/i,/иерархия/i,/носитель геометрии/i,/класс исполнения/i,/каноническая идентичность/i,/неразрешённый параметр/i,/низкая уверенность/i,/\bevidence\b/i,/consensus-like/i,/school-dependent unresolved/i,/UNRESOLVED/,/SCHOOL_DEPENDENT/,/COMMON_VARIANT/,/EXPERT_REVIEWED/];
  for(const guide of [composer.buildKimKMasterGuide('ru'),composer.buildKimKMasterGuide('en')]){
    for(const s of collectGuideStrings(guide)){
      for(const re of banned)assert.ok(!re.test(s),`banned phrase ${re} found in Kim K guide string: "${s}"`);
    }
  }
});

test('Kim K master guide code never touches production ranking/scoring/camera/scan/DESIGN_CATALOG logic',()=>{
  const guideBlock=indexSource.slice(indexSource.indexOf('function buildKimKMasterGuide'),indexSource.indexOf('function ProLibraryDetailScreen'));
  for(const forbidden of ['rankDesigns(','rankDesignsAll(','calculateEyeLashMap(','DESIGN_CATALOG','ClientLashDesign','getUserMedia','Application Plan']){
    assert.ok(!guideBlock.includes(forbidden),`forbidden production reference "${forbidden}" found in the Kim K guide code`);
  }
});
