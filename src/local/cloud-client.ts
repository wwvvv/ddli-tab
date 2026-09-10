import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { CloudState, SyncTransport } from './sync-engine.js';
export interface CloudConfig {
  url: string;
  publishableKey: string;
}
export function validateCloudConfig(config: CloudConfig): CloudConfig | null {
  if (!config.url && !config.publishableKey) return null;
  if (!config.url || !config.publishableKey)
    throw new Error('Supabase URL 和 Publishable key 必须同时配置');
  const url = new URL(config.url);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  )
    throw new Error('Supabase URL 必须是 HTTPS 项目根地址');
  if (!config.publishableKey.startsWith('sb_publishable_'))
    throw new Error('前端仅接受 sb_publishable_ 开头的公开密钥，请勿填写 Secret 或 service_role');
  return { url: url.origin, publishableKey: config.publishableKey };
}
export function createCloudClient(config: CloudConfig) {
  const valid = validateCloudConfig(config);
  if (!valid) return null;
  return createClient(valid.url, valid.publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  });
}
function cloudState(data: unknown): CloudState {
  const value = data as CloudState;
  if (
    !value ||
    !Number.isSafeInteger(value.revision) ||
    value.revision < 0 ||
    !value.payload ||
    typeof value.payload !== 'object' ||
    Array.isArray(value.payload)
  )
    throw new Error('云端同步响应格式无效');
  return { revision: value.revision, payload: value.payload };
}
export function createSyncTransport(client: SupabaseClient, owner: string): SyncTransport {
  async function checkOwner() {
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    if (data.session?.user.id !== owner) throw new Error('账号已变化，同步已停止');
  }
  return {
    async pull() {
      await checkOwner();
      const { data, error } = await client
        .from('dtab_snapshots')
        .select('revision,payload')
        .eq('user_id', owner)
        .maybeSingle();
      if (error) throw error;
      await checkOwner();
      return data ? cloudState(data) : { revision: 0, payload: {} };
    },
    async push(write) {
      await checkOwner();
      const { data, error } = await client.rpc('dtab_push_snapshot', {
        p_base_revision: write.baseRevision,
        p_request_id: write.id,
        p_payload: write.payload,
      });
      if (error) throw error;
      await checkOwner();
      if (!data || !['ok', 'conflict'].includes(data.status))
        throw new Error('云端写入响应格式无效');
      return { ...cloudState(data), status: data.status };
    },
  };
}
