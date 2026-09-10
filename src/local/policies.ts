/** Only removes image-upload entry points, as requested. Does not change the
 * original layout, editor fields, local import controls, or Redux data model. */
export function installLocalPolicies() {
  // Capture before React's legacy login handler. Keep the original avatar UI.
  document.addEventListener(
    'click',
    (event) => {
      const target = event.target as Element | null;
      const button = target?.closest('button');
      if (!button?.querySelector('[aria-label="user"]')) return;
      const panel = document.querySelector<HTMLDialogElement>(
        'dialog[aria-label="DTab 账号与同步"]',
      );
      if (!panel) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      panel.showModal();
    },
    true,
  );

  const apply = () => {
    for (const button of document.querySelectorAll<HTMLButtonElement>('button')) {
      const label = (button.textContent || '').replace(/\s+/g, '');
      if (/^(上传|上传壁纸|上传图片|上传图标|上传头像)$/.test(label)) {
        const container = button.closest<HTMLElement>('.ant-upload') || button;
        if (!container.hidden) container.hidden = true;
        button.disabled = true;
      }
      if (label === '获取信息')
        button.title =
          '本地网页版仅生成域名与 favicon 地址，页面标题请手动修改；插件端以后可读取当前页面。';
    }
  };
  let queued = false;
  const observer = new MutationObserver(() => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      apply();
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
  apply();
}
