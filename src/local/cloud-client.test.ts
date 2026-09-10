import { expect, it } from 'vitest';
import { validateCloudConfig, createSyncTransport } from './cloud-client';
it('未配置保持本地模式', () =>
  expect(validateCloudConfig({ url: '', publishableKey: '' })).toBeNull());
it('拒绝把私密密钥用于前端', () =>
  expect(() =>
    validateCloudConfig({
      url: 'https://example.supabase.co',
      publishableKey: 'sb_secret_example',
    }),
  ).toThrow('公开密钥'));
it('拒绝部分配置', () =>
  expect(() =>
    validateCloudConfig({ url: 'https://example.supabase.co', publishableKey: '' }),
  ).toThrow('同时'));
it('拒绝非 HTTPS 或带凭据地址', () => {
  for (const url of ['http://example.com', 'https://a:b@example.com', 'https://example.com/path'])
    expect(() => validateCloudConfig({ url, publishableKey: 'sb_publishable_example' })).toThrow();
});
it('传输在账号切换后停止', async () => {
  const client: any = {
    auth: { getSession: async () => ({ data: { session: { user: { id: 'other' } } } }) },
  };
  await expect(createSyncTransport(client, 'owner').pull()).rejects.toThrow('账号已变化');
});
it('RPC 只提交版本、请求编号和数据，不接受目标用户参数', async () => {
  let parameters: any;
  const client: any = {
    auth: { getSession: async () => ({ data: { session: { user: { id: 'owner' } } } }) },
    rpc: async (name: string, p: any) => {
      parameters = p;
      expect(name).toBe('dtab_push_snapshot');
      return { data: { status: 'ok', revision: 1, payload: {} } };
    },
  };
  await createSyncTransport(client, 'owner').push({ id: 'request', baseRevision: 0, payload: {} });
  expect(parameters).toEqual({ p_base_revision: 0, p_request_id: 'request', p_payload: {} });
});
