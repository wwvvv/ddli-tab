import { sendToPage } from './bridge.js';
import { parseSite } from './site.js';
const el = (id) => document.getElementById(id);
let targetTab;
let targetOrigin;
let connectionVersion = 0;
function resetConnection() {
  connectionVersion++;
  targetTab = undefined;
  targetOrigin = undefined;
  el('group').replaceChildren();
  el('add').disabled = true;
}
el('site').addEventListener('input', () => {
  resetConnection();
  el('status').textContent = '站点地址已更改，请重新连接 DTab。';
});
function bridge(request) {
  if (!Number.isInteger(targetTab)) throw Error('请先连接 DTab 并读取分组');
  return chrome.scripting
    .executeScript({
      target: { tabId: targetTab },
      world: 'MAIN',
      func: sendToPage,
      args: [{ message: { ...request, id: crypto.randomUUID() }, expectedOrigin: targetOrigin }],
    })
    .then((results) => {
      const result = results[0]?.result;
      if (!result?.ok) throw Error(result?.error || 'DTab 未返回有效结果');
      return result;
    });
}
async function run(action) {
  try {
    el('status').textContent = '处理中…';
    await action();
  } catch (error) {
    el('status').textContent = error.message;
  }
}
el('connect').onclick = () =>
  run(async () => {
    resetConnection();
    const version = connectionVersion;
    const url = parseSite(el('site').value);
    const { pattern } = url;
    if (!(await chrome.permissions.contains({ origins: [pattern] }))) {
      if (version !== connectionVersion) return;
      await chrome.tabs.create({
        url: chrome.runtime.getURL('connect.html') + '?site=' + encodeURIComponent(url.origin),
      });
      return;
    }
    if (version !== connectionVersion) return;
    await chrome.storage.local.set({ dtabSite: url.origin });
    const tabs = await chrome.tabs.query({ url: pattern });
    if (version !== connectionVersion) return;
    const existing = tabs.find((tab) => tab.url && new URL(tab.url).origin === url.origin);
    if (!existing) {
      await chrome.tabs.create({ url: url.origin, active: false });
      throw Error('已打开 DTab 页面，待加载完成后再点击读取分组');
    }
    targetTab = existing.id;
    targetOrigin = url.origin;
    const result = await bridge({ command: 'groups' });
    if (version !== connectionVersion) return;
    el('group').replaceChildren(
      ...result.groups.map((g) => {
        const option = document.createElement('option');
        option.value = g.id;
        option.textContent = g.label;
        return option;
      }),
    );
    el('add').disabled = !result.groups.length;
    el('status').textContent = '已连接 DTab，请选择分组后添加。';
  });
el('add').onclick = () =>
  run(async () => {
    el('add').disabled = true;
    try {
      const result = await bridge({
        command: 'add',
        groupId: el('group').value,
        page: { url: el('url').value, title: el('title').value, icon: el('icon').value },
      });
      el('status').textContent = result.duplicate
        ? '该分组中已存在此网址。'
        : '已添加到 DTab；已启用的网页同步会自动处理。';
    } finally {
      el('add').disabled = !Number.isInteger(targetTab);
    }
  });
void run(async () => {
  const config = await chrome.storage.local.get('dtabSite');
  el('site').value = config.dtabSite || 'http://127.0.0.1:4173';
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url || !/^https?:/.test(tab.url)) throw Error('当前页面不是可收藏的普通网页');
  el('url').value = tab.url;
  el('title').value = tab.title || new URL(tab.url).hostname;
  el('icon').value = tab.favIconUrl || new URL('/favicon.ico', tab.url).href;
  el('status').textContent = '已读取当前页面，请连接 DTab。';
});
