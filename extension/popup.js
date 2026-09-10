const el = (id) => document.getElementById(id);
let targetTab;
function siteURL() {
  const url = new URL(el('site').value.trim());
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/' ||
    !(
      url.protocol === 'https:' ||
      (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))
    )
  )
    throw Error('请填写 DTab 的 HTTPS 根地址；本地测试可用 localhost 或 127.0.0.1');
  return url;
}
function bridge(request) {
  return chrome.scripting
    .executeScript({
      target: { tabId: targetTab },
      world: 'MAIN',
      func: async (message) =>
        new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            window.removeEventListener('dtab:extension-response', listener);
            reject(Error('DTab 页面尚未就绪，请刷新该页面后重试'));
          }, 5000);
          function listener(event) {
            let response;
            try {
              response = JSON.parse(event.detail);
            } catch {
              return;
            }
            if (response.id !== message.id) return;
            clearTimeout(timeout);
            window.removeEventListener('dtab:extension-response', listener);
            resolve(response);
          }
          window.addEventListener('dtab:extension-response', listener);
          window.dispatchEvent(
            new CustomEvent('dtab:extension-request', { detail: JSON.stringify(message) }),
          );
        }),
      args: [{ ...request, id: crypto.randomUUID() }],
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
    const url = siteURL();
    const pattern = `${url.protocol}//${url.hostname}/*`;
    if (!(await chrome.permissions.request({ origins: [pattern] })))
      throw Error('尚未授予 DTab 站点访问权限');
    await chrome.storage.local.set({ dtabSite: url.origin });
    const tabs = await chrome.tabs.query({ url: pattern });
    const existing = tabs.find((tab) => tab.url && new URL(tab.url).origin === url.origin);
    if (!existing) {
      await chrome.tabs.create({ url: url.origin, active: false });
      throw Error('已打开 DTab 页面，待加载完成后再点击读取分组');
    }
    targetTab = existing.id;
    const result = await bridge({ command: 'groups' });
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
      el('add').disabled = false;
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
