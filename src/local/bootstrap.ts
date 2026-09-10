import { installCloudPanel } from './cloud-panel.js';
import { initializeDefaults } from './defaults.js';
import { migrateBranding } from './branding.js';
import { installLocalPolicies } from './policies.js';
async function start() {
  migrateBranding();
  const entry = document.querySelector<HTMLScriptElement>('script[data-original-entry]')?.dataset
    .originalEntry;
  if (!entry) throw new Error('未找到原版入口');
  if (!('serviceWorker' in navigator))
    throw new Error('此浏览器未启用 Service Worker，请在 localhost 或 HTTPS 下打开。');
  let registration = await navigator.serviceWorker.getRegistration('/');
  if (!registration?.active?.scriptURL.endsWith('/ddli-local-sw.js')) {
    registration = await navigator.serviceWorker.register('/ddli-local-sw.js', {
      type: 'module',
      scope: '/',
    });
  } else {
    // Updates are best-effort; an offline restart must still use the installed worker.
    void registration.update().catch(() => {});
  }
  const showUpdate = () => {
    if (
      !registration?.waiting ||
      !navigator.serviceWorker.controller ||
      document.getElementById('dtab-update-notice')
    )
      return;
    const notice = document.createElement('div');
    notice.id = 'dtab-update-notice';
    notice.setAttribute('role', 'status');
    notice.textContent =
      'DTab 新版本已准备好。请完成当前编辑，关闭所有 DTab 标签页后重新打开，收藏不会被清空。';
    notice.style.cssText =
      'position:fixed;bottom:60px;left:50%;transform:translateX(-50%);max-width:90vw;padding:12px 16px;border-radius:10px;background:#183654;color:white;z-index:10000;font-size:13px';
    document.body.append(notice);
  };
  registration.addEventListener('updatefound', () => {
    registration?.installing?.addEventListener('statechange', showUpdate);
  });
  showUpdate();
  const correct = () => navigator.serviceWorker.controller?.scriptURL.endsWith('/ddli-local-sw.js');
  if (!correct()) {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        navigator.serviceWorker.removeEventListener('controllerchange', change);
        reject(new Error('本地接口初始化超时，请刷新页面重试。'));
      }, 15000);
      const change = () => {
        if (correct()) {
          clearTimeout(timer);
          navigator.serviceWorker.removeEventListener('controllerchange', change);
          resolve();
        }
      };
      navigator.serviceWorker.addEventListener('controllerchange', change);
      change();
    });
  }
  const ping = await fetch('/api/getSiteConfig');
  if (ping.headers.get('X-DDLI-Mode') !== 'local')
    throw new Error('本地接口尚未准备好，已停止启动以避免访问原服务器。');
  await initializeDefaults();
  await import(/* @vite-ignore */ entry);
  installLocalPolicies();
  installCloudPanel();
  const note = document.createElement('div');
  note.id = 'ddli-local-mode';
  note.textContent = 'DTab · 本地版';
  note.title = 'DTab 本地存储；账号与同步可在右上角面板配置，图片上传未启用。';
  Object.assign(note.style, {
    position: 'fixed',
    bottom: '32px',
    left: '50%',
    transform: 'translateX(-50%)',
    fontSize: '11px',
    color: 'white',
    background: 'rgba(0,0,0,.35)',
    padding: '4px 10px',
    borderRadius: '20px',
    zIndex: '2',
    pointerEvents: 'none',
  });
  document.body.append(note);
}
start().catch((error) => {
  const root = document.getElementById('root')!;
  const title = document.createElement('h2'),
    text = document.createElement('p'),
    button = document.createElement('button');
  title.textContent = '本地模式启动失败';
  text.textContent = String(error.message || error);
  button.textContent = '重新加载';
  button.onclick = () => location.reload();
  root.replaceChildren(title, text, button);
  root.style.cssText =
    'padding:40px;font:16px sans-serif;color:#333;background:#fafafa;min-height:100vh';
  console.error(error);
});
