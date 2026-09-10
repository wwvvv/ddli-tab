import { validateTemplate, TEMPLATE_MARKER } from './defaults.js';
export function installTemplateControls(host: HTMLElement) {
  const section = document.createElement('section');
  section.className = 'dtab-template-card';
  const title = document.createElement('h3');
  title.textContent = '站点默认模板';
  const info = document.createElement('p');
  info.textContent = '默认模板与个人账号分开。发布新模板不会自动覆盖你的收藏。';
  const restore = document.createElement('button');
  restore.textContent = '恢复站点默认模板';
  restore.type = 'button';
  const download = document.createElement('button');
  download.textContent = '下载恢复前备份';
  download.type = 'button';
  const message = document.createElement('p');
  message.setAttribute('aria-live', 'polite');
  section.append(title, info, restore, download, message);
  host.append(section);
  const backupKey = 'dtab:template-restore-backup';
  const refresh = () => {
    download.disabled = !localStorage.getItem(backupKey);
  };
  refresh();
  restore.onclick = async () => {
    if (
      !confirm(
        '恢复当前部署版本的默认卡片、布局和设置？将先保留恢复前备份。若已启用云同步，此次重置也会同步到其他设备。',
      )
    )
      return;
    restore.disabled = true;
    try {
      const response = await fetch('/config/default-template.json');
      if (!response.ok) throw new Error('默认模板读取失败');
      const template = validateTemplate(await response.json());
      const path = new URL('/assets/myErrorPage-duSnGROQ.js', location.origin).href;
      const original = await import(/* @vite-ignore */ path);
      const before = original.J();
      localStorage.setItem(backupKey, JSON.stringify(before));
      if (!original.Y(template.data, false)) throw new Error('模板未通过原版数据校验，未执行恢复');
      localStorage.setItem(TEMPLATE_MARKER, template.version);
      message.textContent = '已恢复默认模板 ' + template.version + '，恢复前备份已保留。';
    } catch (error) {
      message.textContent = '恢复未完成：' + (error as Error).message;
    } finally {
      restore.disabled = false;
      refresh();
    }
  };
  download.onclick = () => {
    const raw = localStorage.getItem(backupKey);
    if (!raw) return;
    const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dtab-before-template-restore-' + Date.now() + '.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
}
