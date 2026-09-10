import { describe, expect, it } from 'vitest';
import { handleLocalApi } from './api';
const req = (path: string) => new Request('http://localhost' + path);
describe('原版 API 的本地适配', () => {
  it('初始化保留原版默认数据，不替换成另一个数据模型', async () => {
    const response = await handleLocalApi(req('/api/getDefaultData'));
    expect(response.headers.get('X-DDLI-Mode')).toBe('local');
    const body = await response.json();
    expect(body.code).toBe(200);
    expect(body.data.data).toEqual({});
    expect(body.data.created_at).toBeTruthy();
  });
  it('离线、注册、上传及本地资源库配置明确', async () => {
    const body = await (await handleLocalApi(req('/api/getSiteConfig'))).json();
    expect(body.data.offlineToUse).toBe('open');
    expect(body.data.userRegister).toBe('close');
    expect(body.data.uploadWallpaper).toBe('close');
    expect(body.data.sourceStoreFrom).toBe('self');
    expect(Array.isArray(JSON.parse(body.data.bottomLinks))).toBe(true);
  });
  it('网站信息只返回域名 fallback，不谎称读取标题', async () => {
    const body = await (
      await handleLocalApi(req('/api/tools/getWebsiteInfo?url=https%3A%2F%2Fexample.com%2Ffoo'))
    ).json();
    expect(body.data.title).toBe('example.com');
    expect(body.data.icon).toBe('https://example.com/favicon.ico');
    expect(body.data.metadataSource).toBe('domain-fallback');
  });
  it.each(['javascript:alert(1)', 'file:///etc/passwd', 'https://user:pass@example.com'])(
    '拒绝无效信息请求 %s',
    async (url) => {
      expect(
        (
          await (
            await handleLocalApi(req('/api/tools/getWebsiteInfo?url=' + encodeURIComponent(url)))
          ).json()
        ).code,
      ).toBe(400);
    },
  );
  it.each(['/api/user/uploadIcon', '/api/login', '/api/user/push', '/api/getWeather'])(
    '未实现的操作明确不成功 %s',
    async (path) => {
      expect((await (await handleLocalApi(req(path))).json()).code).toBe(501);
    },
  );
  it('本地资源库是空集合而非假造远端数据', async () => {
    const body = await (await handleLocalApi(req('/api/sourceStore/getWebsiteInfoList'))).json();
    expect(body.data).toEqual({ list: [], total: 0, totalPage: 0 });
  });
});
