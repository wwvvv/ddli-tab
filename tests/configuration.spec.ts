import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
test('站点脚本与本地接口配置一致，独立模板首次生效',async({page})=>{
 await page.goto('/');await expect(page.getByRole('link',{name:'欢迎使用 DTab',exact:true})).toBeVisible();
 const template=JSON.parse(await fs.readFile('config/default-template.json','utf8'));
 const state=await page.evaluate(async()=>{
  const response=await fetch('/api/getSiteConfig');
  const original=await import('/assets/myErrorPage-duSnGROQ.js');
  return {config:(globalThis as any).siteConfig,api:(await response.json()).data,version:localStorage.getItem('dtab:template-version'),cards:original.O.getState().appData.listData};
 });
 expect(state.config).toEqual(state.api);
 expect(state.version).toBe(template.version);
 expect(state.cards).toEqual(template.data.appData.listData);
});
