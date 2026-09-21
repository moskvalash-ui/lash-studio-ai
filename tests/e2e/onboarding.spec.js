const { test, expect } = require('@playwright/test');
test.use({ storageState: { cookies: [], origins: [] } });
const copy = {
  ru: {help:'Как пользоваться', next:'Далее', back:'Назад', close:'Закрыть', start:'Начать анализ', titles:['Выберите способ анализа','Подготовьте клиента','Запустите AI-анализ','Получите персональную рекомендацию','Откройте Professional Lash Map']},
  en: {help:'How it works', next:'Next', back:'Back', close:'Close', start:'Start Analysis', titles:['Choose your analysis mode','Prepare your client','Start the AI analysis','Get a personalized recommendation','Open the Professional Lash Map']},
  ar: {help:'طريقة الاستخدام', next:'التالي', back:'السابق', close:'إغلاق', start:'ابدئي التحليل', titles:['اختاري طريقة التحليل','جهزي العميلة','ابدئي تحليل الذكاء الاصطناعي','احصلي على توصية مخصصة','افتحي خريطة الرموش الاحترافية']}
};
async function boot(page, lang='en') {
  await page.addInitScript(lang => localStorage.setItem('lashStudioLang', lang), lang);
  await page.goto('/index.html');
  await expect(page.getByRole('dialog')).toBeVisible();
}
async function rejectConsent(page) {
  const button = page.getByRole('button', { name: /^(Reject|Отказаться|رفض)$/ });
  if (await button.isVisible()) await button.click();
}
for (const width of [320,390]) for (const lang of ['ru','en','ar']) {
  test(`${lang} five steps, back, close and mobile layout at ${width}px`, async ({page}) => {
    await page.setViewportSize({width,height:width===320?568:844});
    await boot(page,lang);
    const c=copy[lang], d=page.getByRole('dialog');
    await expect(d).toHaveCSS('direction', lang==='ar'?'rtl':'ltr');
    await expect(d).toHaveCSS('text-align', 'start');
    await expect(page.locator('html')).toHaveAttribute('dir',lang==='ar'?'rtl':'ltr');
    for (let i=0;i<5;i++) {
      await expect(d.getByRole('heading',{name:c.titles[i],exact:true})).toBeVisible();
      expect(await d.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
      const box=await d.boundingBox(); expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x+box.width).toBeLessThanOrEqual(width);
      if(i<4) await d.getByRole('button',{name:c.next,exact:true}).click();
    }
    const backBox=await d.getByRole('button',{name:c.back,exact:true}).boundingBox();
    const startBox=await d.getByRole('button',{name:c.start,exact:true}).boundingBox();
    expect(lang==='ar' ? backBox.x > startBox.x : backBox.x < startBox.x).toBe(true);
    await d.getByRole('button',{name:c.back,exact:true}).click();
    await expect(d.getByRole('heading',{name:c.titles[3],exact:true})).toBeVisible();
    await d.getByRole('button',{name:c.close,exact:true}).click();
    await expect(d).toHaveCount(0);
    await rejectConsent(page);
    await page.getByRole('button',{name:c.help,exact:true}).click();
    await expect(d.getByRole('heading',{name:c.titles[0],exact:true})).toBeVisible();
    await page.screenshot({path:`test-results/onboarding-${lang}-${width}.png`});
  });
}
test('dismissal persists on reload; manual reopening follows changed language',async({page})=>{
  await boot(page);
  await page.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click();
  expect(await page.evaluate(()=>localStorage.getItem('lashStudioOnboardingSeenV1'))).toBe('1');
  await page.reload();
  await expect(page.getByRole('button',{name:'How it works',exact:true})).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await rejectConsent(page);
  await page.getByRole('button',{name:'RU',exact:true}).click();
  await page.getByRole('button',{name:copy.ru.help,exact:true}).click();
  await expect(page.getByRole('heading',{name:copy.ru.titles[0],exact:true})).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('final CTA enters the existing live scan and remembers completion',async({page})=>{
  test.setTimeout(60000);
  await boot(page);
  const d=page.getByRole('dialog');
  for(let i=0;i<4;i++) await d.getByRole('button',{name:'Next',exact:true}).click();
  await expect(d.getByRole('button',{name:'Start Analysis',exact:true})).toBeEnabled({timeout:30000});
  await d.getByRole('button',{name:'Start Analysis',exact:true}).click();
  await expect(d).toHaveCount(0);
  await expect(page.locator('video')).toHaveCount(1);
  expect(await page.evaluate(()=>localStorage.getItem('lashStudioOnboardingSeenV1'))).toBe('1');
  await page.reload();
  await expect(page.getByRole('button',{name:'How it works',exact:true})).toBeVisible();
  await expect(d).toHaveCount(0);
});
test('blocked localStorage does not crash opening, dismissing or reopening',async({page})=>{
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{Storage.prototype.getItem=()=>{throw Error('blocked')}; Storage.prototype.setItem=()=>{throw Error('blocked')};});
  await page.goto('/index.html');
  const d=page.getByRole('dialog');
  await d.getByRole('button',{name:copy.ru.close,exact:true}).click();
  await rejectConsent(page);
  await page.getByRole('button',{name:copy.ru.help,exact:true}).click();
  await expect(d).toBeVisible();
  expect(errors).toEqual([]);
});

test('unavailable models keep final CTA disabled while help remains usable',async({page})=>{
  await page.route('**/weights/**', route=>route.abort());
  await boot(page);
  const d=page.getByRole('dialog');
  for(let i=0;i<4;i++) await d.getByRole('button',{name:'Next',exact:true}).click();
  await expect(d.getByRole('button',{name:'Start Analysis',exact:true})).toBeDisabled();
  await expect(page.locator('video')).toHaveCount(0);
  await d.getByRole('button',{name:'Close',exact:true}).click();
  await expect(d).toHaveCount(0);
});
