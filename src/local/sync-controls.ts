import type { SupabaseClient } from '@supabase/supabase-js';
import { createSyncTransport } from './cloud-client.js';
import { SyncEngine, loadSyncState, saveSyncState, type Snapshot } from './sync-engine.js';
import { snapshotsEqual } from './sync-merge.js';
interface OriginalBridge {
  J: () => Snapshot;
  Y: (data: Snapshot, notify: boolean) => boolean;
  O: { subscribe: (fn: () => void) => () => void };
}
export function installSyncControls(client: SupabaseClient, host: HTMLElement) {
  const summary = document.createElement('p');
  summary.setAttribute('aria-live', 'polite');
  const buttons = document.createElement('div');
  host.append(summary, buttons);
  let owner: string | null = null,
    generation = 0,
    engine: SyncEngine | undefined,
    unsubscribe: (() => void) | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined,
    interval: ReturnType<typeof setInterval> | undefined,
    release: (() => void) | undefined,
    applying = false,
    busy = false;
  function button(label: string, action: () => void) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.style.cssText =
      'margin:4px;padding:7px 10px;border:1px solid #ccc;border-radius:6px;cursor:pointer';
    b.onclick = action;
    buttons.append(b);
    return b;
  }
  function backup(data: unknown) {
    localStorage.setItem(
      'dtab:sync-safety-backup:' + owner,
      JSON.stringify({ at: new Date().toISOString(), data }),
    );
  }
  function stop() {
    generation++;
    engine?.stop();
    engine = undefined;
    unsubscribe?.();
    unsubscribe = undefined;
    if (timer) clearTimeout(timer);
    if (interval) clearInterval(interval);
    release?.();
    release = undefined;
    busy = false;
  }
  async function tick() {
    const current = engine;
    if (!current || busy) return;
    busy = true;
    summary.textContent = '正在同步…';
    try {
      await current.sync();
      if (current !== engine) return;
      const state = current.snapshot;
      summary.textContent = state.conflict
        ? `同步已暂停：${state.conflict.details.length} 处冲突。请导出双方备份后选择保留版本。`
        : state.pending
          ? '修改已保存在本地，等待下一次重试。'
          : `已同步 · 云端版本 ${state.base.revision}`;
    } catch (error) {
      if (current === engine)
        summary.textContent = '同步未完成，修改保留在本地：' + (error as Error).message;
    } finally {
      if (current === engine) busy = false;
    }
  }
  function schedule() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void tick(), 1200);
  }
  async function activate(mode: 'local' | 'remote' | 'resume') {
    if (!owner || engine) return;
    const user = owner,
      epoch = generation;
    if (!navigator.locks) {
      summary.textContent = '此浏览器缺少标签页协调能力，暂未启用同步。';
      return;
    }
    await navigator.locks.request('dtab:sync-leader', { ifAvailable: true }, async (lock) => {
      if (!lock) {
        summary.textContent = '另一标签页正在同步，请在该标签页操作，或关闭后在这里重新启用。';
        return;
      }
      if (epoch !== generation) return;
      let unlock!: () => void;
      const held = new Promise<void>((r) => {
        unlock = r;
      });
      release = unlock;
      try {
        const path = new URL('/assets/myErrorPage-duSnGROQ.js', location.origin).href;
        const original: OriginalBridge = await import(/* @vite-ignore */ path);
        if (epoch !== generation) return;
        const transport = createSyncTransport(client, user);
        let state = loadSyncState(localStorage, user);
        const local = original.J();
        if (mode === 'resume') {
          if (!state || localStorage.getItem('dtab:data-owner') !== user)
            throw new Error('请明确选择初始同步数据');
          state = { ...state, local };
        } else {
          const remote = await transport.pull();
          if (epoch !== generation) return;
          if (mode === 'remote' && remote.revision === 0)
            throw new Error('云端尚无数据，请选择以本地数据启用');
          backup({ local, remote });
          state = { owner: user, base: remote, local: mode === 'remote' ? remote.payload : local };
        }
        if (epoch !== generation) return;
        const apply = (data: Snapshot) => {
          if (snapshotsEqual(original.J(), data)) return;
          applying = true;
          try {
            if (!original.Y(data, false)) throw new Error('原版数据校验未通过，已停止应用云端数据');
          } finally {
            applying = false;
          }
        };
        saveSyncState(localStorage, state);
        localStorage.setItem('dtab:data-owner', user);
        engine = new SyncEngine(
          user,
          state,
          transport,
          (s) => saveSyncState(localStorage, s),
          apply,
        );
        apply(state.local);
        unsubscribe = original.O.subscribe(() => {
          if (applying || !engine) return;
          const next = original.J();
          if (snapshotsEqual(next, engine.snapshot.local)) return;
          try {
            engine.edit(next);
            schedule();
          } catch (error) {
            summary.textContent = '本地队列保存失败，请先导出收藏：' + (error as Error).message;
            stop();
          }
        });
        interval = setInterval(() => void tick(), 15000);
        void tick();
        await held;
      } catch (error) {
        if (epoch === generation) {
          summary.textContent = (error as Error).message;
          stop();
        }
      } finally {
        unlock();
      }
    });
  }
  button('以本地数据启用同步', () => {
    if (confirm('以当前本地收藏和设置为准同步到此账号？会先保留本地与云端备份。'))
      void activate('local');
  });
  button('使用云端数据启用同步', () => {
    if (confirm('用此账号云端收藏和设置替换当前页面？会先保留当前本地备份。'))
      void activate('remote');
  });
  button('立即同步', () => void tick());
  button('导出同步备份', () => {
    const data = engine?.snapshot ?? (owner ? loadSyncState(localStorage, owner) : null);
    if (!data) {
      summary.textContent = '尚无同步队列可导出，请使用原版迁移备份。';
      return;
    }
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dtab-sync-backup-' + Date.now() + '.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  for (const choice of ['local', 'remote'] as const)
    button(choice === 'local' ? '冲突：保留本地' : '冲突：保留云端', () => {
      if (!engine?.snapshot.conflict) {
        summary.textContent = '当前没有待处理冲突。';
        return;
      }
      if (
        !confirm(
          '此操作会选择整份' +
            (choice === 'local' ? '本地' : '云端') +
            '数据，不是逐项合并。确定继续？',
        )
      )
        return;
      try {
        backup(engine.snapshot);
        engine.resolve(choice);
        void tick();
      } catch (error) {
        summary.textContent = (error as Error).message;
      }
    });
  const online = () => void tick();
  window.addEventListener('online', online);
  window.addEventListener('pagehide', stop);
  return {
    setOwner(next: string | null) {
      if (next === owner) return;
      stop();
      owner = next;
      host.hidden = !next;
      if (!next) return;
      summary.textContent = '首次启用请选择初始数据来源；登录本身不会上传收藏。';
      if (
        localStorage.getItem('dtab:data-owner') === next &&
        localStorage.getItem('dtab:sync:' + next)
      )
        setTimeout(() => {
          if (owner === next) void activate('resume');
        }, 0);
    },
  };
}
