import fs from 'node:fs/promises';
import path from 'node:path';
export async function applyBranding(root, out, files) {
  const changed = [];
  const repo = 'https://github.com/wwvvv/ddli-tab';
  for (const file of files) {
    if (!/\.(js|html|svg|json|css)$/.test(file)) continue;
    const target = path.join(out, file),
      before = await fs.readFile(target, 'utf8');
    let text = before
      .replace(/\b(?:GoTab|GOTAB|Gotab)\b/g, 'DTab')
      .replaceAll('gotab-data-', 'dtab-data-')
      .replaceAll('gotab-bookmarks-', 'dtab-bookmarks-');
    // Explicit product links only. Keep legacy storage keys and API host guards compatible.
    const links = [
      ['https://www.gotab.cn/changelog/gotab.html', repo + '/commits/main/'],
      ['https://www.gotab.cn/privacy.html', repo + '#数据与功能边界'],
      ['https://github.com/dengxiwang/gotab-personal', repo],
      ['https://www.gotab.cn/icons/logo.svg', '/icons/logo.svg'],
      ['https://www.gotab.cn/images/wx.webp', '/icons/logo.svg'],
      [
        'https://web.gotab.cn/sourceStore/website/01K2Q9SRK8MBSSQ80J24ESXZMT.svg',
        '/icons/history.svg',
      ],
      [
        'https://web.gotab.cn/sourceStore/website/01J8J19PV7B4755AETNTX200KD.svg',
        '/icons/bookmark.svg',
      ],
      [
        'https://web.gotab.cn/sourceStore/website/01K2Q95P53SEFB7XG2ZVD90KYK.svg',
        '/icons/website.svg',
      ],
      ['https://www.rainyun.com/gotab_', repo + '#本地运行'],
    ];
    for (const [from, to] of links) text = text.replaceAll(from, to);
    text = text.replace(/https:\/\/www\.gotab\.cn(?=[`"'\s])/g, repo);
    if (file.startsWith('assets/openTypeSlice-')) {
      text = text
        .replace(/https:\/\/qm\.qq\.com\/[^`]+/g, repo + '/issues')
        .replace('label:`欢迎使用`', 'label:`欢迎使用 DTab`')
        .replace('label:`雨云服务器`', 'label:`使用说明`')
        .replace('description:`稳定、高性价比`', 'description:`本地运行与数据备份`')
        .replace('label:`加入QQ群`', 'label:`问题反馈`')
        .replace('description:`用户交流群`', 'description:`反馈问题与功能建议`');
    }
    // Product-specific panels must not reuse the former author's payment codes or contacts.
    if (/^assets\/(aboutUs|donate|update)-/.test(file)) {
      const kind = file.split('/')[1].split('-')[0];
      const title =
        kind === 'aboutUs' ? '关于 DTab' : kind === 'donate' ? '支持 DTab' : 'DTab 版本说明';
      const content =
        kind === 'donate'
          ? '当前未开通捐赠收款。欢迎通过项目仓库反馈问题。'
          : 'DTab 本地版：收藏与设置保存在当前浏览器，支持导入导出备份。云同步和插件尚未接入。';
      text = `import {t as runtime} from './jsx-runtime-Ciaf_P-h.js';const {jsx,jsxs}=runtime();export default function Panel(){return jsxs('section',{style:{padding:24,lineHeight:1.8},children:[jsx('img',{src:'/icons/logo.svg',alt:'DTab',width:64}),jsx('h2',{children:${JSON.stringify(title)}}),jsx('p',{children:${JSON.stringify(content)}}),jsx('a',{href:${JSON.stringify(repo)},target:'_blank',rel:'noopener noreferrer',children:'DTab 项目仓库'})]});}`;
    }
    if (file.endsWith('.js'))
      text = text.replaceAll('https://web.gotab.cn', '${globalThis.location.origin}');
    if (text !== before) {
      await fs.writeFile(target, text);
      changed.push(file);
    }
  }
  const svg = await fs.readFile(path.join(root, 'src/branding/logo.svg'));
  for (const name of ['logo.svg', 'logoBlack.svg', 'logoWhite.svg']) {
    await fs.writeFile(path.join(out, 'icons', name), svg);
    changed.push('icons/' + name);
  }
  for (const name of ['logo.png', 'action_logo.png']) {
    await fs.copyFile(path.join(root, 'src/branding/logo.png'), path.join(out, 'icons', name));
    changed.push('icons/' + name);
  }
  return changed;
}
