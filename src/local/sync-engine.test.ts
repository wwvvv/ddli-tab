import { expect, it } from 'vitest';
import {
  SyncEngine,
  type SyncState,
  type PendingWrite,
  type SyncTransport,
  loadSyncState,
  saveSyncState,
} from './sync-engine';
function harness() {
  let remote = { revision: 1, payload: { a: 1, b: 1 } },
    saved: SyncState | undefined,
    applied: any;
  const calls: PendingWrite[] = [];
  let serial = 0;
  const transport: SyncTransport = {
    pull: async () => structuredClone(remote),
    push: async (w) => {
      calls.push(structuredClone(w));
      if (w.baseRevision !== remote.revision) return { ...remote, status: 'conflict' };
      remote = { revision: remote.revision + 1, payload: w.payload as any };
      return { ...remote, status: 'ok' };
    },
  };
  const engine = new SyncEngine(
    'u',
    { owner: 'u', base: structuredClone(remote), local: { a: 1, b: 1 } },
    transport,
    (s) => {
      saved = s;
    },
    (s) => {
      applied = s;
    },
    () => String(++serial),
  );
  return {
    engine,
    transport,
    calls,
    get saved() {
      return saved!;
    },
    get applied() {
      return applied;
    },
    get remote() {
      return remote;
    },
    set remote(v) {
      remote = v;
    },
  };
}
it('保存到本地后上传，成功推进基线', async () => {
  const h = harness();
  h.engine.edit({ a: 2, b: 1 });
  expect(h.saved.local.a).toBe(2);
  await h.engine.sync();
  expect(h.remote.payload.a).toBe(2);
  expect(h.saved.base.revision).toBe(2);
  expect(h.saved.pending).toBeUndefined();
});
it('断网后重试同一请求编号', async () => {
  const h = harness();
  const push = h.transport.push;
  let first = true;
  h.transport.push = async (w) => {
    if (first) {
      first = false;
      throw Error('offline');
    }
    return push(w);
  };
  h.engine.edit({ a: 2, b: 1 });
  await expect(h.engine.sync()).rejects.toThrow('offline');
  const id = h.saved.pending!.id;
  await h.engine.sync();
  expect(h.calls[0].id).toBe(id);
});
it('上传前合并另一设备不同字段', async () => {
  const h = harness();
  h.engine.edit({ a: 2, b: 1 });
  h.remote = { revision: 2, payload: { a: 1, b: 3 } };
  await h.engine.sync();
  expect(h.remote.payload).toEqual({ a: 2, b: 3 });
});
it('同字段冲突暂停，不上传', async () => {
  const h = harness();
  h.engine.edit({ a: 2, b: 1 });
  h.remote = { revision: 2, payload: { a: 3, b: 1 } };
  await h.engine.sync();
  expect(h.calls).toHaveLength(0);
  expect(h.saved.conflict!.details).toHaveLength(1);
  await h.engine.sync();
  expect(h.calls).toHaveLength(0);
});
it('明确保留本地后可提交', async () => {
  const h = harness();
  h.engine.edit({ a: 2, b: 1 });
  h.remote = { revision: 2, payload: { a: 3, b: 1 } };
  await h.engine.sync();
  h.engine.resolve('local');
  await h.engine.sync();
  expect(h.remote.payload.a).toBe(2);
});
it('选择云端不产生多余写入', async () => {
  const h = harness();
  h.engine.edit({ a: 2, b: 1 });
  h.remote = { revision: 2, payload: { a: 3, b: 1 } };
  await h.engine.sync();
  h.engine.resolve('remote');
  await h.engine.sync();
  expect(h.applied.a).toBe(3);
  expect(h.calls).toHaveLength(0);
});
it('上传中编辑仍保存并继续同步', async () => {
  const h = harness();
  const push = h.transport.push;
  let once = true;
  h.transport.push = async (w) => {
    if (once) {
      once = false;
      h.engine.edit({ a: 2, b: 4 });
    }
    return push(w);
  };
  h.engine.edit({ a: 2, b: 1 });
  await h.engine.sync();
  expect(h.remote.payload).toEqual({ a: 2, b: 4 });
  expect(h.calls).toHaveLength(2);
});
it('持久化失败时不发送请求', async () => {
  let writes = 0;
  const e = new SyncEngine(
    'u',
    { owner: 'u', base: { revision: 0, payload: {} }, local: { a: 1 } },
    {
      pull: async () => ({ revision: 0, payload: {} }),
      push: async () => {
        writes++;
        throw Error();
      },
    },
    () => {
      throw Error('quota');
    },
    () => {},
  );
  await expect(e.sync()).rejects.toThrow('quota');
  expect(writes).toBe(0);
});
it('换账号不能使用旧队列', () => {
  expect(
    () =>
      new SyncEngine(
        'b',
        { owner: 'a', base: { revision: 0, payload: {} }, local: {} },
        {} as any,
        () => {},
        () => {},
      ),
  ).toThrow('账号');
});
it('退出后在途响应不写入或应用', async () => {
  const h = harness();
  const push = h.transport.push;
  h.transport.push = async (w) => {
    h.engine.stop();
    return push(w);
  };
  h.engine.edit({ a: 2, b: 1 });
  await h.engine.sync();
  expect(h.saved.pending).toBeDefined();
  expect(h.saved.base.revision).toBe(1);
});
it('队列持久化按用户隔离并可恢复', () => {
  const data = new Map();
  const storage = {
    setItem: (k: string, v: string) => data.set(k, v),
    getItem: (k: string) => data.get(k) ?? null,
  };
  const s: SyncState = {
    owner: 'a',
    base: { revision: 0, payload: {} },
    local: {},
    pending: { id: 'one', baseRevision: 0, payload: {} },
  };
  saveSyncState(storage, s);
  expect(loadSyncState(storage, 'a')).toEqual(s);
  expect(loadSyncState(storage, 'b')).toBeNull();
});
it('网络响应丢失后恢复队列，不丢失已提交内容', async () => {
  const h = harness();
  const push = h.transport.push;
  let once = true;
  h.transport.push = async (w) => {
    const result = await push(w);
    if (once) {
      once = false;
      throw Error('response lost');
    }
    return result;
  };
  h.engine.edit({ a: 2, b: 1 });
  await expect(h.engine.sync()).rejects.toThrow('response lost');
  const pending = h.saved.pending!;
  let recovered: any;
  const resumed = new SyncEngine(
    'u',
    h.saved,
    h.transport,
    (s) => {
      recovered = s;
    },
    () => {},
  );
  await resumed.sync();
  expect(h.calls[1].id).toBe(pending.id);
  expect(recovered.pending).toBeUndefined();
  expect(recovered.base.payload.a).toBe(2);
});
it('相同内容不同字段顺序不会重复上传', async () => {
  const h = harness();
  h.engine.edit({ b: 1, a: 1 });
  await h.engine.sync();
  expect(h.calls).toHaveLength(0);
});
it('并行触发共享同一同步任务', async () => {
  const h = harness();
  h.engine.edit({ a: 2, b: 1 });
  await Promise.all([h.engine.sync(), h.engine.sync(), h.engine.sync()]);
  expect(h.calls).toHaveLength(1);
});
