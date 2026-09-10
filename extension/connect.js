import { parseSite } from './site.js';
const site = document.getElementById('site');
const status = document.getElementById('status');
const button = document.getElementById('grant');
site.value = new URL(location.href).searchParams.get('site') || '';
button.onclick = async () => {
  button.disabled = true;
  try {
    const { origin, pattern } = parseSite(site.value);
    // Request directly in the click handler before any await to retain the user gesture.
    const granted = await chrome.permissions.request({ origins: [pattern] });
    if (!granted) throw Error('未授予权限，尚未连接。你可以再次点击授权。');
    await chrome.storage.local.set({ dtabSite: origin });
    status.textContent = '授权已保存。请回到要收藏的网页，重新打开 DTab 插件并读取分组。';
  } catch (error) {
    status.textContent = error.message;
  } finally {
    button.disabled = false;
  }
};
