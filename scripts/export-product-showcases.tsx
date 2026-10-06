/** Export the native showcases, and check their responsive layout before saving PNGs.
 * Use installed Playwright Chromium, or SHOWCASE_CHROMIUM_PATH for another executable.
 * SHOWCASE_FONT_DIR points to node_modules containing @fontsource/inter and plus-jakarta-sans.
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import fs from 'node:fs';
import path from 'node:path';
import { compile } from '@tailwindcss/node';
import { chromium } from 'playwright';
import Showcase from '../src/components/marketing/system/ProductShowcase';

async function run() {
  const fontDir = process.env.SHOWCASE_FONT_DIR;
  if (!fontDir) throw new Error('Set SHOWCASE_FONT_DIR to the Fontsource node_modules directory.');
  const fonts = [['Inter',400,'inter'],['Inter',600,'inter'],['Inter',700,'inter'],['Plus Jakarta Sans',700,'plus-jakarta-sans']].map(([family,weight,pkg]) => {
    const data = fs.readFileSync(path.join(fontDir,`@fontsource/${pkg}/files/${pkg}-latin-${weight}-normal.woff2`));
    return `@font-face{font-family:'${family}';font-weight:${weight};src:url(data:font/woff2;base64,${data.toString('base64')}) format('woff2');}`;
  }).join('\n');
  const compiler = await compile(fs.readFileSync('src/app/globals.css','utf8'),{base:path.resolve('src/app'),onDependency:()=>{}});
  const theme = ['alphaclone-theme.css','marketing-system.css','marketing-redesign.css'].map(f=>fs.readFileSync(`src/styles/${f}`,'utf8')).join('\n');
  const browser = await chromium.launch({executablePath:process.env.SHOWCASE_CHROMIUM_PATH || undefined,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  try {
    const context = await browser.newContext({deviceScaleFactor:2});
    const page = await context.newPage();
    fs.mkdirSync('public/showcases',{recursive:true});
    for (const slug of ['crm','project-management'] as const) {
      const html = renderToStaticMarkup(<Showcase slug={slug}/>);
      const css = compiler.build(html.split(/[\s"'`{}]+/));
      const style = `<style>${fonts}\n${css}\n${theme}</style>`;
      for (const width of [320,360,375,390,412,430,768,1024,1440]) {
        await page.setViewportSize({width,height:1000});
        await page.setContent(`${style}<div class="marketing-theme mkt-light-canvas" style="padding:16px;max-width:1100px;margin:auto">${html}</div>`);
        await page.evaluate(()=>document.fonts.ready);
        const issue = await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth || [...document.querySelectorAll('.ac-showcase p,.ac-showcase h3,.ac-showcase h4,.ac-showcase h5,.ac-showcase h6,.ac-showcase li')].some(e=>e.scrollWidth>e.clientWidth+1));
        if (issue) throw new Error(`${slug}: overflow or clipped text at ${width}px.`);
        console.log(`${slug} ${width}px: pass`);
        if (width===390) await page.locator('.ac-showcase').screenshot({path:`/tmp/alphaclone-${slug}-mobile.png`});
      }
      await page.setViewportSize({width:1600,height:1200});
      await page.setContent(`${style}<div class="marketing-theme mkt-light-canvas" style="padding:32px;width:1600px">${html}</div>`);
      await page.evaluate(()=>document.fonts.ready);
      await page.locator('.ac-showcase').screenshot({path:`public/showcases/alphaclone-${slug==='crm'?'crm':'projects'}-showcase.png`});
      await page.keyboard.press('Tab');
      if (await page.evaluate(()=>document.activeElement?.getAttribute('download'))===null) throw new Error('Download link is not keyboard reachable.');
    }
  } finally { await browser.close(); }
}
run().catch(error=>{console.error(error);process.exitCode=1;});
