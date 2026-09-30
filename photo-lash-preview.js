/* PHOTO-only presentation. No recommendation, mapping or construction rules. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.PhotoLashPreview=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  // Display composition only, NEVER written to ClientLashDesign.
  const STRAND_COUNT=294; // MAIN root count per eye -- continuous, never skipped.
  // buildFibers OVERLAYS additional support/accent strands on top of every
  // MAIN root (never instead of one), so the visible set has no gaps.
  const VISUAL_MM_TO_EYE_WIDTH=.085; // px = eyeWidth * canonical mm * .085 (1.55x the prior .055 scale).
  // Previous renderer used 1/30 (.03333), then .024, then .0408, then .055.
  // Neither scale is mm calibration. This step specifically addresses the
  // canvas-buffer -> CSS display compression measured against the real
  // preview panel (~5.7x on a real device photo/panel pairing): earlier
  // geometry-only passes were correct in shape but too small in absolute
  // on-screen footprint to read as a finished set rather than a faint guide.
  const noise=(i,salt)=>{
    const n=Math.sin((i+1)*127.1+salt*311.7)*43758.5453;
    return (n-Math.floor(n))*2-1;
  };
  const smooth=(a,b,t)=>{const u=Math.max(0,Math.min(1,(t-a)/(b-a)));return u*u*(3-2*u);};

  // ------------------------------------------------------------
  // CURL GEOMETRY PROFILES — one explicit, immutable trajectory profile
  // per professional curl identity (the 8 CURL_CATALOG ids owned by
  // index.html: J/B/C/CC/D/L/L+/M). Replaces the old binary
  // isLCurl=/L/.test(curlFamily) switch: every curl now resolves to its
  // own profile instead of collapsing 6 of 8 names into one shared
  // shape. Curl identity ONLY ever selects one of these 8 fixed
  // objects — it never mutates points/eyeWidth/length/width/opacity/
  // taper/layer/noise, all of which stay exactly as before.
  //
  // Each field maps 1:1 onto a control makeFiber() already had (see the
  // pre-existing angle/curvePhase/liftNear/midBend/tipEase formulas
  // below) — this is a data table, not a second drawing algorithm:
  //   angleBase/angleSweep/angleProm — the 3 additive terms of the
  //     existing `angle` formula (constant, smooth(0,1,t)-weighted
  //     sweep, and prominence-weighted peak-zone emphasis).
  //   curvePhaseBase/curvePhaseJitter — where along the shaft (0..1)
  //     the c2 control point's own bend is centered, and how much
  //     per-fiber noise perturbs that position.
  //   liftNearBase/liftNearSweep — how much bend the root (c1) already
  //     carries, before curlScale/layer scaling.
  //   midBendRatio/tipEaseRatio — multipliers on the SAME shared
  //     curlPeak magnitude formula, controlling how much of it reaches
  //     c2 (midBend) and the tip (tipEase) respectively.
  //
  // ROUNDED FAMILY (J/B/C/CC/D) — a single delta ladder (delta = -2 for
  // J .. +2 for D, C=0) drives every field, so "J < B < C < CC < D" is
  // a real, derivable geometric progression (verified in tests against
  // actual rendered tip deviation), not five independent guesses. C's
  // own delta=0 values are BYTE-IDENTICAL to this renderer's previous
  // sole default branch — C is deliberately the unchanged reference
  // profile the product brief asks for, and doubles as the safe
  // fallback for any unrecognized curl string (see buildFibers below).
  // Stronger curls (CC/D): curvePhase moves EARLIER (bend develops
  // sooner), liftNear/midBend/tipEase all increase (root already
  // carries more bend, and the tip retains more of it rather than
  // easing back) — together these read as progressively more lift
  // without ever disabling the smooth, continuous rounded arc (there
  // is no L-style flat-then-hinge transition anywhere in this family).
  // Softer curls (J/B): the mirror image — later curvePhase, smaller
  // liftNear/midBend/tipEase.
  //
  // L FAMILY (L/L+) — L's 6 shape fields are BYTE-IDENTICAL to this
  // renderer's previous isLCurl-true branch (no regression to the
  // existing, already-tuned straight-base/late-lift character). L+
  // shares L's root/curvePhase/liftNear exactly (same straight basal
  // leg, same delayed-curvature architecture) and differs ONLY in
  // midBendRatio/tipEaseRatio (both raised) — a targeted stronger tip
  // resolution, not a uniform scale-up of the whole fiber.
  //
  // M — distinct from all of the above: a shorter version of L's
  // straight-base/late-lift architecture (curvePhase later than the
  // rounded family but earlier than L; liftNear low but not as low as
  // L) combined with a rounded-family-scale tip resolution (midBend/
  // tipEase well below L's, above the rounded family's), giving the
  // "controlled base + softer, less hinge-like lift-style transition"
  // the product brief asks for -- never equal to C, D, L, or L+ in any
  // field.
  // ------------------------------------------------------------
  function roundedProfile(delta) {
    return {
      angleBase: .09 + .014 * delta,
      angleSweep: .62 + .028 * delta,
      angleProm: .35 + .035 * delta,
      curvePhaseBase: .52 - .055 * delta,
      curvePhaseJitter: .05,
      liftNearBase: .06 + .021 * delta,
      liftNearSweep: .03 + .010 * delta,
      midBendRatio: 1 + .17 * delta,
      tipEaseRatio: .48 + .095 * delta,
    };
  }
  // L -- TUNING PASS (visual review after 0c77cec): the initial
  // midBendRatio=.22/tipEaseRatio=1.25 pairing put nearly ALL of the
  // bend into the final stretch (c2->tip), and since a cubic's shape
  // near s=1 is dominated by the tip control point, that read as a
  // sudden sharp hook/kink rather than a controlled lift -- confirmed
  // by direct visual inspection (tests/fixtures/curl-comparison.html
  // screenshot review). curvePhaseBase moved earlier (.72->.67, still
  // safely later than every rounded curl's own curvePhaseBase, so the
  // flat base stays visibly longer than J/B/C/CC/D) to give the lift
  // more shaft-length to develop in; midBendRatio raised (.22->.42) and
  // tipEaseRatio lowered (1.25->1.00) together shrink the c2->tip bend
  // RATIO from ~5.7x to ~2.4x, spreading the same overall lift into a
  // smoother, more continuous "flat base + C-like upper curl" arc
  // instead of a late, sharp snap. angleBase/angleSweep/angleProm and
  // liftNearBase/liftNearSweep (the flat-basal-leg character itself)
  // are UNCHANGED -- this pass only softens the transition, it does
  // not touch what makes L's base read as flat in the first place.
  const L_PROFILE = {
    angleBase: 1.25, angleSweep: .20, angleProm: 0,
    curvePhaseBase: .67, curvePhaseJitter: .04,
    liftNearBase: .015, liftNearSweep: .008,
    midBendRatio: .42, tipEaseRatio: 1.00,
  };
  const CURL_GEOMETRY_PROFILES = Object.freeze({
    J: Object.freeze(roundedProfile(-2)),
    B: Object.freeze(roundedProfile(-1)),
    C: Object.freeze(roundedProfile(0)),
    CC: Object.freeze(roundedProfile(1)),
    D: Object.freeze(roundedProfile(2)),
    L: Object.freeze(L_PROFILE),
    // L+ -- TUNING PASS 2 (full-eye visual review found the first pass
    // too close to L: raising midBend/tipEase while keeping roughly the
    // SAME ratio between them (2.38 vs 2.33) mostly scaled the same
    // curve shape up a little, which read as "a bit bigger", not
    // "clearly a different curl"). Shares L's angleBase/angleSweep/
    // angleProm/liftNear EXACTLY (same straight basal leg -- c1 stays
    // effectively unchanged, see tests/photo-lash-preview.test.js test
    // D) -- curvePhaseBase moves further earlier than L's own (.60 vs
    // L's .67) and midBendRatio/tipEaseRatio are raised substantially
    // (not just proportionally) above L's own (post-tuning) values, so
    // the upper arc both starts developing sooner AND resolves
    // markedly stronger -- a visibly fuller, more elevated curl, not a
    // uniform scale-up, never D's own rounded-family shape (angleProm
    // stays exactly 0, unlike every rounded curl).
    'L+': Object.freeze({
      ...L_PROFILE,
      curvePhaseBase: .60,
      midBendRatio: .70,
      tipEaseRatio: 1.60,
    }),
    // M -- TUNING PASS 3, MICRO-TUNING ONLY (isolated single-fiber
    // diagnostic review found pass 2's shape read as too close to a
    // straight diagonal line in isolation, despite already being well
    // separated from C/L in the full-eye view). `angle` sets the
    // fiber's ENTIRE base direction -- root, c1, c2, and tip are all
    // built from the SAME direction/lateral frame via at(along,across),
    // just at different `along` fractions -- so a LOW angleBase makes
    // the WHOLE fiber lean upright from the root outward, regardless of
    // how small liftNear is. Both M's original angleBase=.62 AND a
    // first retry at .95 still shot up far too steeply in isolation
    // (verified numerically: direction is (sin(angle),-cos(angle)), and
    // .95rad/~59deg still carries much more relative "up" than L's
    // proven 1.25rad/~71.6deg). A flat-reading base fundamentally
    // REQUIRES an angle close to L's own -- there is no shortcut via a
    // "medium" angleBase. M therefore shares L's angleBase/angleSweep/
    // angleProm EXACTLY (same proven flat-base direction, same reason
    // angleProm=0: the peak fiber must not become the most vertical
    // one), the same architectural pattern already used for L+ above.
    // curvePhaseBase (.40, earlier than both L's .67 and L+'s .60 --
    // the shortest apparent flat run of the three) and liftNearBase
    // (.034, above L's .015 -- the root itself already carries a bit
    // more curvature, reinforcing the shorter-flat-base read) are
    // UNCHANGED by this micro-tuning pass -- they already gave M its
    // correct short-basal-section/earlier-lift identity. The ONLY
    // change is midBendRatio (.55 -> .68): raising it, alone, moves c2
    // (the middle control point, sampled at curvePhaseBase=.40 along
    // the shaft) further out laterally WITHOUT touching tipEaseRatio
    // (.78, unchanged -- so the tip's own final position/footprint is
    // untouched) or curvePhaseBase (so WHERE the bend is centered is
    // untouched). midBendRatio staying below tipEaseRatio (.68 < .78)
    // keeps the bend building smoothly all the way to the tip -- no
    // overshoot-then-reverse, so this cannot introduce a hinge or hook.
    // The net effect is a visibly more curved middle/upper section
    // (c2 bulges further from the straight root-tangent line) while
    // the basal section, lift timing, overall angle, and tip footprint
    // all stay exactly as before.
    M: Object.freeze({
      ...L_PROFILE,
      curvePhaseBase: .40, curvePhaseJitter: .045,
      liftNearBase: .034, liftNearSweep: .017,
      midBendRatio: .68, tipEaseRatio: .78,
    }),
  });
  // Deterministic, never-throwing fallback for an unrecognized/missing
  // curl string: the exact same geometry this renderer already used
  // for every curl before this change (now formalized as 'C').
  function curlProfileFor(curlFamily) {
    return (typeof curlFamily === 'string' && CURL_GEOMETRY_PROFILES[curlFamily]) || CURL_GEOMETRY_PROFILES.C;
  }
  function sampleSectors(items){
    if(!Array.isArray(items)||items.length<2||items.some((s,i)=>!Number.isFinite(s.t)||s.t<0||s.t>1||!Number.isFinite(s.len)||s.len<=0||(i&&s.t<=items[i-1].t)))throw new Error('mapping');
    let sector=0;
    return Array.from({length:STRAND_COUNT},(_,i)=>{
      // 'cadence' is only a within-cell position-jitter cadence (kept from
      // the earlier interleave scheme), NOT a render layer -- every root
      // here becomes a MAIN fiber; support/accent are additive overlays
      // decided in buildFibers.
      const cadenceB=[0,2,4].includes(i%7);
      const u=(i+.5+(cadenceB?.32:.16)*noise(i,1))/STRAND_COUNT;
      const position=u+.065*Math.sin(2*Math.PI*u);
      const t=items[0].t+(items.at(-1).t-items[0].t)*position;
      while(sector<items.length-1&&t>(items[sector].t+items[sector+1].t)/2)sector++;
      // Copy the exact existing derived length; no second map interpolation.
      return {...items[sector],t};
    });
  }
  function buildFibers(points,eyeWidth,curlFamily){
    if(!Array.isArray(points)||!points.length||!Number.isFinite(eyeWidth)||eyeWidth<2)throw new Error('geometry');
    for(const p of points)if(![p.x,p.y,p.t,p.len,p.normal?.x,p.normal?.y,p.tangent?.x,p.tangent?.y].every(Number.isFinite)||p.len<=0)throw new Error('geometry');
    // Curl family from the existing professional design data (clientDesign.
    // curl.global -> photoCurl -> props.curl, e.g. 'C'/'CC'/'D'/'L'/'L+'/'M')
    // -- an optional 3rd argument, so any caller that omits it (tests, a
    // stale build) keeps the safe C-equivalent default. See
    // CURL_GEOMETRY_PROFILES above for the full explicit table and
    // curlProfileFor's fallback rule.
    const curlProfile=curlProfileFor(curlFamily);
    // A continuous eye-local field replaces independent radial spikes. The
    // INNER->OUTER axis follows physical geometry and mirrors anatomically.
    // This chord frame is kept only as a stabilizing anchor (see below) --
    // the real per-point sweep now comes from the lid's own local curvature.
    const dx=points.at(-1).x-points[0].x,dy=points.at(-1).y-points[0].y,m=Math.hypot(dx,dy);
    if(m<1e-6)throw new Error('geometry');
    const outward={x:dx/m,y:dy/m};
    let up={x:-outward.y,y:outward.x};
    if(up.y>0)up={x:-up.x,y:-up.y};
    // Design-agnostic peak signal: how long THIS point's real Lash Map
    // sector is relative to this eye's own shortest/longest sector. Purely
    // derived from the already-computed profile -- a flat/natural map has
    // little spread and produces almost no peak emphasis; a cat/doll/fox
    // map's own peak drives it, whatever design was recommended.
    const lens=points.map(q=>q.len),lenMin=Math.min(...lens),lenMax=Math.max(...lens),lenSpan=lenMax-lenMin;
    const prominence=q=>lenSpan>1e-6?(q.len-lenMin)/lenSpan:.5;
    // Ceiling/floor on ribbon half-width. Raised from the geometry-only
    // pass so paired MAIN+SUPPORT roots (nudged apart by ~.35-.60 of one
    // spacing, see rootOffset below) visually knit into a continuous,
    // finished-looking base -- the reference's "natural base line" is a
    // real photographed effect of dense overlapping roots, never a drawn
    // stroke here. Still tapers hard toward the tip (see draw()'s .68/.08
    // coefficients), so this only thickens the base, not the whole shaft.
    const widthCap=eyeWidth*.0060,widthFloor=eyeWidth*.0013;
    const spacing=eyeWidth/STRAND_COUNT;
    // Builds one fiber for point p (index i) as a given depth layer. MAIN is
    // called for every point -- a continuous structural population that is
    // never skipped or replaced, so the visible set has no gaps. SUPPORT and
    // ACCENT are called ADDITIONALLY on top of (never instead of) that same
    // point's MAIN fiber, with a small deterministic root offset along the
    // point's own local tangent so they overlap/cluster with their neighbor
    // instead of stacking exactly on it -- perceived root density comes
    // from this overlap, never from a drawn baseline/stroke.
    function makeFiber(p,i,layer,salt){
      const inner=smooth(0,.18,p.t),outer=1-smooth(.86,1,p.t),prom=prominence(p);
      const finish=(.58+.42*inner)*(.78+.22*outer);
      const tm=Math.hypot(p.tangent.x,p.tangent.y)||1;
      const tangentUnit={x:p.tangent.x/tm,y:p.tangent.y/tm};
      const rootOffset=layer==='main'?0:(.35+.25*noise(i,salt+40))*spacing*(noise(i,salt+41)<0?-1:1);
      const root={x:p.x+tangentUnit.x*rootOffset,y:p.y+tangentUnit.y*rootOffset};
      const curlScale=layer==='support'?.58:layer==='accent'?1.12:1;
      const lengthScale=layer==='support'?.72:layer==='accent'?1.10+.06*noise(i,salt+1):1;
      const length=eyeWidth*p.len*VISUAL_MM_TO_EYE_WIDTH*finish*lengthScale*
        (layer==='support'?.85+.05*noise(i,salt+2):1+.02*noise(i,salt+3));
      // Root frame follows the REAL local lid curve (p.tangent/p.normal),
      // not just one fixed chord for the whole eye -- this is what lets
      // direction progressively sweep with the eyelid instead of every
      // fiber pointing the same near-vertical way (the "comb" defect).
      // The global chord frame is blended in only as a small stabilizer
      // against a single noisy landmark point flipping a local tangent.
      let localOutward=tangentUnit;
      if(localOutward.x*outward.x+localOutward.y*outward.y<0)localOutward={x:-localOutward.x,y:-localOutward.y};
      let localUp={x:-localOutward.y,y:localOutward.x};
      if(localUp.x*up.x+localUp.y*up.y<0)localUp={x:-localUp.x,y:-localUp.y};
      const LOCAL_WEIGHT=.65;
      const blendedOutward={x:outward.x*(1-LOCAL_WEIGHT)+localOutward.x*LOCAL_WEIGHT,y:outward.y*(1-LOCAL_WEIGHT)+localOutward.y*LOCAL_WEIGHT};
      const blendedUp={x:up.x*(1-LOCAL_WEIGHT)+localUp.x*LOCAL_WEIGHT,y:up.y*(1-LOCAL_WEIGHT)+localUp.y*LOCAL_WEIGHT};
      const bom=Math.hypot(blendedOutward.x,blendedOutward.y)||1,bum=Math.hypot(blendedUp.x,blendedUp.y)||1;
      const localFrameOutward={x:blendedOutward.x/bom,y:blendedOutward.y/bom};
      const localFrameUp={x:blendedUp.x/bum,y:blendedUp.y/bum};
      // Base growth axis. Rounded family (J/B/C/CC/D): a single continuous,
      // monotonic lift profile (inner -> outer), with this eye's own map
      // peak (prom) adding extra lift only where the Lash Map itself is
      // longest -- no dead zone, no direction reversal. Range raised so the
      // outer/peak zone can exceed 45 deg from vertical (previously capped
      // ~40 deg, meaning direction was ALWAYS weighted more "up" than
      // "outward" everywhere -- that up-bias is what made longer peak
      // fibers reach toward the brow instead of sweeping along the lid).
      //
      // Per-curl axis, generalized from what used to be two hardcoded
      // branches (L/LLD's own much flatter axis vs. every other curl's
      // shared C-shaped one) into curlProfile's angleBase/angleSweep/
      // angleProm fields -- see CURL_GEOMETRY_PROFILES above for why L's
      // angleProm is exactly 0 (the longest/peak fiber must not become
      // the most vertical one for that family) while the rounded family
      // (J/B/C/CC/D) keeps a real, strength-scaled prominence term.
      const angle=curlProfile.angleBase+curlProfile.angleSweep*smooth(0,1,p.t)+curlProfile.angleProm*prom*smooth(.2,1,p.t)+
        (layer==='support'?.05:.03)*noise(i,salt+4);
      const direction={x:localFrameUp.x*Math.cos(angle)+localFrameOutward.x*Math.sin(angle),y:localFrameUp.y*Math.cos(angle)+localFrameOutward.y*Math.sin(angle)};
      const lateral={x:localFrameOutward.x*Math.cos(angle)-localFrameUp.x*Math.sin(angle),y:localFrameOutward.y*Math.cos(angle)-localFrameUp.y*Math.sin(angle)};
      const at=(along,across)=>({x:root.x+direction.x*length*along+lateral.x*length*across,y:root.y+direction.y*length*along+lateral.y*length*across});
      // Progressive curvature, one consistent bend direction throughout (a
      // sign flip would read as a kink/hook). curvePhase gives each fiber a
      // slightly different along-position for its curl peak -- part of the
      // deterministic per-fiber depth variation, not a magnitude change.
      // curlPeak's own magnitude formula is shared by every curl family --
      // only WHERE along the shaft it's centered (curvePhase), how much the
      // root already carries (liftNear) and how the tip resolves it
      // (tipEase's ratio) differ below.
      const curlPeak=(.24+.13*smooth(.30,1,p.t))*curlScale;
      // curvePhase/liftNear/midBend/tipEase, generalized from the old
      // two-branch isLCurl split into curlProfile's own fields -- same
      // shared curlPeak magnitude formula for every curl (untouched
      // above); only WHERE along the shaft the bend concentrates
      // (curvePhaseBase/Jitter), how much the root already carries
      // (liftNearBase/Sweep) and how much of curlPeak reaches c2/the tip
      // (midBendRatio/tipEaseRatio) differ, per curl, via the profile
      // table. L's own values here are byte-identical to this
      // renderer's previous isLCurl-true branch (see the file-header
      // comment above CURL_GEOMETRY_PROFILES for the full empirical
      // rationale -- unchanged, not re-derived).
      const curvePhase=curlProfile.curvePhaseBase+curlProfile.curvePhaseJitter*noise(i,salt+5);
      const liftNear=(curlProfile.liftNearBase+curlProfile.liftNearSweep*smooth(0,.4,p.t))*curlScale;
      const midBend=curlPeak*curlProfile.midBendRatio;
      const tipEase=curlPeak*curlProfile.tipEaseRatio;
      const lightness=(.45+.55*inner)*(.67+.33*outer);
      // Mid/outer strands read thicker within their own layer; the inner
      // corner stays thinnest (finish/lightness above are unchanged).
      const bold=.80+.42*smooth(.12,.55,p.t);
      const widthBase=layer==='support'?.0028:layer==='accent'?.0042:.0038;
      const opacityBase=layer==='support'?.60+.06*noise(i,salt+6):layer==='accent'?.95+.03*noise(i,salt+6):.90+.05*noise(i,salt+6);
      const opacityCap=layer==='support'?.75:layer==='accent'?.99:.98;
      // Bounded apparent-depth dither: some fibers read very slightly
      // closer/bolder, others further/softer -- never a density/opacity
      // policy change, just per-fiber variation within the existing caps.
      const depth=noise(i,salt+7);
      return {root,
        c1:at(.24,-(liftNear+.010*noise(i,salt+8))),c2:at(curvePhase,-midBend),tip:at(.97,-(tipEase-.035*noise(i,salt+9))),
        width:Math.max(widthFloor,Math.min(widthCap,eyeWidth*widthBase*bold*(1+.14*depth)*Math.sqrt(lightness))),
        opacity:Math.min(opacityCap,opacityBase*lightness*(1+.08*depth)),
        depth,layer,len:p.len,t:p.t};
    }
    const fibers=[];
    points.forEach((p,i)=>{
      // MAIN: unconditional, one per sampled root -- the continuous
      // structural population that defines the visible set's silhouette.
      fibers.push(makeFiber(p,i,'main',10));
      // SUPPORT: interleaved on nearly all roots -- additional shorter/
      // softer fibers, never a replacement for this point's MAIN. The
      // preview panel's fixed on-screen size (not changed this pass, see
      // report) leaves individual-fiber resolution physically unreachable
      // on a real phone; maximizing base density/contrast within that
      // constraint is what actually reads as a finished set there.
      if(noise(i,20)>-.7)fibers.push(makeFiber(p,i,'support',20));
      // ACCENT: sparse, only where THIS eye's own Lash Map profile peaks.
      if(prominence(p)>.68&&noise(i,22)>.05)fibers.push(makeFiber(p,i,'accent',30));
    });
    return fibers;
  }
  function draw(ctx,fibers){
    // Support underlayer first (recedes), main map fibers next, rare accent
    // strands last -- only where the map's own length peaks -- so volume
    // reads from layering and zone density, not from any single root's
    // thickness. Deepened from an earlier, lighter espresso-brown: at the
    // preview panel's real on-screen size individual fibers are sub-pixel,
    // so contrast against skin (not per-fiber color nuance) is what
    // actually reads there. Still not flat pure black, still per-layer.
    const palette={support:'34,24,21',main:'16,11,10',accent:'10,7,6'};
    for(const layer of ['support','main','accent']){
      // Depth-sorted within each layer (back to front) so overlapping
      // fibers occlude each other in a varied, layered order instead of
      // strictly by sample index -- this is where visible depth comes from,
      // never from an extra drawn stroke.
      const group=fibers.filter(f=>f.layer===layer).sort((a,b)=>a.depth-b.depth);
      for(const f of group){
        const color=alpha=>`rgba(${palette[layer]},${f.opacity*alpha})`;
        const gradient=ctx.createLinearGradient(f.root.x,f.root.y,f.tip.x,f.tip.y);
        gradient.addColorStop(0,color(1));gradient.addColorStop(.30,color(.96));
        gradient.addColorStop(.66,color(.82));gradient.addColorStop(.88,color(.28));gradient.addColorStop(1,color(0));
        ctx.fillStyle=gradient;
        // The ribbon's cross-section direction is taken near the root
        // (root->c1) AND separately near the tip (c2->tip) rather than one
        // fixed perpendicular reused for the whole shaft -- a curved fiber's
        // width follows its own local direction instead of shearing into a
        // thin, nearly-straight-looking sliver as the bend grows.
        const dx1=f.c1.x-f.root.x,dy1=f.c1.y-f.root.y,m1=Math.hypot(dx1,dy1)||1;
        const w1x=-dy1/m1*f.width/2,w1y=dx1/m1*f.width/2;
        const dx2=f.tip.x-f.c2.x,dy2=f.tip.y-f.c2.y,m2=Math.hypot(dx2,dy2)||1;
        const w2x=-dy2/m2*f.width/2,w2y=dx2/m2*f.width/2;
        ctx.beginPath();ctx.moveTo(f.root.x+w1x,f.root.y+w1y);
        ctx.bezierCurveTo(f.c1.x+w1x*.68,f.c1.y+w1y*.68,f.c2.x+w2x*.08,f.c2.y+w2y*.08,f.tip.x,f.tip.y);
        ctx.bezierCurveTo(f.c2.x-w2x*.08,f.c2.y-w2y*.08,f.c1.x-w1x*.68,f.c1.y-w1y*.68,f.root.x-w1x,f.root.y-w1y);
        ctx.closePath();ctx.fill();
      }
    }
  }
  return {sampleSectors,buildFibers,draw};
});
