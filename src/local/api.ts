import { SITE_CONFIG } from './site-settings.js';
/** Browser-local compatibility adapter for the original GoTab API envelopes.
 * This is not a cloud API and never claims an upload/authentication succeeded.
 * Core navigation persistence remains in the original Redux/IndexedDB layer.
 */
export const LOCAL_CONFIG = SITE_CONFIG;
const createdAt = '2026-09-09T00:00:00.000Z';
const envelope = (data: unknown, msg = '', code = 200) =>
  Response.json(
    { code, msg, data },
    { headers: { 'Cache-Control': 'no-store', 'X-DDLI-Mode': 'local' } },
  );
export async function handleLocalApi(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const p = url.pathname;
  if (p === '/api/getSiteConfig') return envelope(LOCAL_CONFIG);
  // Empty data means "keep original bundled defaults" in the original client.
  if (p === '/api/getDefaultData') return envelope({ data: {}, created_at: createdAt });
  if (p === '/api/getDefaultDataTime') return envelope(createdAt);
  if (p === '/api/getNotice') return envelope(null);
  if (p === '/api/getTn') return envelope('');
  if (p === '/api/yiyan')
    return envelope({
      content: '本地模式：数据保存在此浏览器，请定期导出备份。',
      source: 'DTab 本地提示',
    });
  if (p === '/api/tools/getWebsiteInfo' || p === '/api/tools/getWebsiteInfo2') {
    try {
      const body = request.method === 'GET' ? {} : await request.json().catch(() => ({}));
      const target = new URL(String(url.searchParams.get('url') || body.url || ''));
      if (!['https:', 'http:'].includes(target.protocol) || target.username || target.password)
        throw new Error('unsupported URL');
      return envelope(
        {
          title: target.hostname,
          icon: new URL('/favicon.ico', target).href,
          description: '',
          metadataSource: 'domain-fallback',
        },
        '本地模式仅生成域名与 favicon 地址，网站标题可手动修改。',
      );
    } catch {
      return envelope(null, '请输入有效的 HTTP / HTTPS 网站地址。', 400);
    }
  }
  if (p === '/api/sourceStore/getCategoryListWithAll' || p === '/api/sourceStore/getCategoryList')
    return envelope([]);
  if (
    p === '/api/sourceStore/getWebsiteInfoList' ||
    p === '/api/sourceStore/getWallpaperList' ||
    p === '/api/recommendApp'
  )
    return envelope({ list: [], total: 0, totalPage: 0 });
  if (p.includes('upload') || p.includes('Upload'))
    return envelope(null, '本地版未启用文件上传，请使用图标或壁纸链接。', 501);
  if (
    p === '/api/login' ||
    p === '/api/register' ||
    p.startsWith('/api/user/') ||
    p.startsWith('/api/console/')
  )
    return envelope(
      null,
      '此入口属于已停用的原版服务。登录与云同步请在侧边栏「迁移备份」中配置；原版管理后台未迁移。',
      501,
    );
  return envelope(null, '此联网功能尚未迁移，本地收藏和设置不受影响。', 501);
}
