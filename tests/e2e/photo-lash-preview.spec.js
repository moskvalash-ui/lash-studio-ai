'use strict';
const path=require('node:path');
const {test,expect}=require('@playwright/test');
async function reachResult(page){
 await page.goto('/index.html');
 const reject=page.getByRole('button',{name:'Отказаться',exact:true});
 await reject.waitFor({state:'visible',timeout:5000}).catch(()=>{});
 if(await reject.isVisible())await reject.click();
 const photo=page.getByRole('button',{name:'Анализ по фото',exact:true});
 await expect(photo).toBeEnabled({timeout:20000});await photo.click();
 await page.locator('input[type=file]').setInputFiles(path.join(__dirname,'fixtures/happy-path-face.png'));
 await expect(page.getByText('Подтверждение анализа',{exact:true})).toBeVisible({timeout:45000});
 await page.getByRole('button',{name:'Подтвердить и построить схемы',exact:true}).click();
 await expect(page.getByRole('button',{name:'ПОКАЗАТЬ LASH PREVIEW',exact:true})).toBeVisible();
}
test('real PHOTO -> calculated result -> preview has visible fibers on both eyes, stable reopen and map adjustments',async({page})=>{
 test.setTimeout(90000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await reachResult(page);
 await page.evaluate(()=>{
   const build=PhotoLashPreview.buildFibers;
   PhotoLashPreview.buildFibers=(points,width)=>{
     const fibers=build(points,width);
     (window.__compositionAudit??=[]).push({width,count:fibers.length,root:fibers[84].root,tip:fibers[84].tip,thickness:fibers[84].width});
     return fibers;
   };
 });
 await page.getByRole('button',{name:'ПОКАЗАТЬ LASH PREVIEW',exact:true}).click();
 const canvas=page.locator('[data-photo-lash-preview] canvas');
 await expect(canvas).toHaveAttribute('data-preview-status','ready');
 await expect(canvas).toHaveAttribute('data-left-fibers','582');
 await expect(canvas).toHaveAttribute('data-right-fibers','582');
 await expect(page.getByAltText('Исходное фото с Lash Preview')).toBeVisible();
 const pixels=await canvas.evaluate(c=>{
   const data=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
   const boxes=[{n:0,minY:c.height,maxY:0},{n:0,minY:c.height,maxY:0}];
   for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(data[(y*c.width+x)*4+3]>20){const b=boxes[x<c.width/2?0:1];b.n++;b.minY=Math.min(y,b.minY);b.maxY=Math.max(y,b.maxY);}
   return boxes;
 });
 console.log('Composition audit',await page.evaluate(()=>window.__compositionAudit),pixels);
 const first=await canvas.evaluate(c=>c.toDataURL());
 await page.locator('[data-photo-lash-preview]').screenshot({path:'/tmp/lash-preview-refined-mobile.png'});
 await canvas.scrollIntoViewIfNeeded();
 // Fixed photo-relative crop: identical BEFORE/AFTER, independent of lash bounds.
 const eyeClip=await canvas.evaluate(c=>{
   const r=c.getBoundingClientRect();
   return {x:r.x+r.width*.36,y:r.y+r.height*.29,width:r.width*.26,height:r.height*.15};
 });
 await page.screenshot({path:process.env.LASH_PREVIEW_SHOT||'/tmp/lash-composition-after-eyes.png',clip:eyeClip});
 await page.locator('[data-photo-lash-preview]').screenshot({path:(process.env.LASH_PREVIEW_SHOT||'/tmp/lash-composition-after-eyes.png').replace('-eyes','-full')});
 for(const b of pixels){expect(b.n).toBeGreaterThan(100);expect(b.maxY-b.minY).toBeGreaterThan(8);}
 await page.getByRole('button',{name:'СКРЫТЬ LASH PREVIEW',exact:true}).click();
 await page.getByRole('button',{name:'ПОКАЗАТЬ LASH PREVIEW',exact:true}).click();
 await expect(canvas).toHaveAttribute('data-preview-status','ready');
 expect(await canvas.evaluate(c=>c.toDataURL())).toBe(first);
 await page.getByRole('button',{name:'ОТКРЫТЬ LASH MAP',exact:true}).click();
 await page.getByRole('button',{name:'ПОКАЗАТЬ LASH PREVIEW',exact:true}).click();
 await expect(canvas).toHaveAttribute('data-preview-status','ready');
 expect(await canvas.evaluate(c=>c.toDataURL())).toBe(first);
 const leftMap=page.locator('[aria-label="Left eye map"]');
 const lengths=await leftMap.locator('[data-length]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('data-length')));
 console.log('Visual strand budget:',JSON.stringify({beforePerEye:168,afterPerEye:294,derivedLengths:lengths}));
 await leftMap.getByRole('button',{name:'НАСТРОИТЬ СХЕМУ',exact:true}).click();
 const handle=leftMap.locator('[data-manual-handle="peak"]');
 await handle.scrollIntoViewIfNeeded();
 const box=await handle.boundingBox();
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
 await page.mouse.move(box.x+box.width/2+8,box.y+box.height/2-6,{steps:4});await page.mouse.up();
 await expect(canvas).toHaveAttribute('data-preview-status','ready');
 expect(await canvas.evaluate(c=>c.toDataURL())).not.toBe(first);
 expect(await leftMap.locator('[data-length]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('data-length')))).toEqual(lengths);
 await leftMap.getByRole('button',{name:'СБРОСИТЬ',exact:true}).click();
 await expect.poll(()=>canvas.evaluate(c=>c.toDataURL())).toBe(first);
 expect(errors).toEqual([]);
});
test('renderer failure leaves explicit diagnostic and a usable result',async({page})=>{
 test.setTimeout(90000);
 await reachResult(page);
 // Failure injection only after REAL analysis and design completion.
 await page.evaluate(()=>{window.PhotoLashPreview.buildFibers=()=>{throw new Error('geometry');};});
 await page.getByRole('button',{name:'ПОКАЗАТЬ LASH PREVIEW',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('обоих глазах');
 await expect(page.getByRole('button',{name:'ОТКРЫТЬ LASH MAP',exact:true})).toBeVisible();
});

test('English PHOTO preview and missing original photo diagnostic',async({page})=>{
 test.setTimeout(90000);
 await page.goto('/index.html');
 const reject=page.getByRole('button',{name:'Отказаться',exact:true});
 await reject.waitFor({state:'visible',timeout:5000}).catch(()=>{});
 if(await reject.isVisible())await reject.click();
 await page.getByRole('button',{name:'EN',exact:true}).click();
 const photo=page.getByRole('button',{name:'Photo Analysis',exact:true});
 await expect(photo).toBeEnabled({timeout:20000});await photo.click();
 await page.locator('input[type=file]').setInputFiles(path.join(__dirname,'fixtures/happy-path-face.png'));
 await page.getByRole('button',{name:'Confirm and build designs',exact:true}).click({timeout:45000});
 await page.getByRole('button',{name:'SHOW LASH PREVIEW',exact:true}).click();
 const canvas=page.locator('[data-photo-lash-preview] canvas');
 await expect(canvas).toHaveAttribute('data-preview-status','ready');
 await expect(page.getByAltText('Original photo with Lash Preview')).toBeVisible();
 await page.getByRole('button',{name:'HIDE LASH PREVIEW',exact:true}).click();
 // Emulate the photo blob becoming unavailable without changing analysis.
 await page.getByRole('button',{name:'SHOW LASH PREVIEW',exact:true}).click();
 await expect(canvas).toHaveAttribute('data-preview-status','ready');
 await page.getByAltText('Original photo with Lash Preview').evaluate(img=>{img.src='data:image/png;base64,broken';});
 await expect(page.getByRole('alert')).toContainText('original photo is unavailable');
});
