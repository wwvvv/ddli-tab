import { mergeSnapshots, snapshotsEqual, type MergeConflict } from './sync-merge.js';
export type Snapshot = Record<string, unknown>;
export interface CloudState {
  revision: number;
  payload: Snapshot;
}
export interface PendingWrite {
  id: string;
  baseRevision: number;
  payload: Snapshot;
}
export interface SyncState {
  owner: string;
  base: CloudState;
  local: Snapshot;
  pending?: PendingWrite;
  conflict?: { remote: CloudState; details: MergeConflict[] };
}
export interface SyncTransport {
  pull(): Promise<CloudState>;
  push(write: PendingWrite): Promise<CloudState & { status: 'ok' | 'conflict' }>;
}
/** Persist is synchronous so the outbox is durable before any network request. */
export class SyncEngine {
  private state: SyncState;
  private running: Promise<void> | undefined;
  private stopped = false;
  constructor(
    owner: string,
    initial: SyncState,
    private transport: SyncTransport,
    private persist: (state: SyncState) => void,
    private apply: (snapshot: Snapshot) => void,
    private id: () => string = () => crypto.randomUUID(),
  ) {
    if (owner !== initial.owner) throw new Error('同步队列账号不匹配');
    this.state = structuredClone(initial);
  }
  get snapshot(): SyncState {
    return structuredClone(this.state);
  }
  private save(next: SyncState) {
    this.persist(structuredClone(next));
    this.state = next;
  }
  edit(payload: Snapshot) {
    if (this.stopped) throw new Error('同步已停止');
    this.save({ ...this.state, local: structuredClone(payload) });
  }
  stop() {
    this.stopped = true;
  }
  sync(): Promise<void> {
    if (this.stopped) return Promise.resolve();
    if (this.running) return this.running;
    this.running = this.run().finally(() => {
      this.running = undefined;
    });
    return this.running;
  }
  private merge(remote: CloudState) {
    const result = mergeSnapshots(this.state.base.payload, this.state.local, remote.payload);
    if (result.conflicts.length) {
      this.save({
        ...this.state,
        pending: undefined,
        conflict: { remote, details: result.conflicts },
      });
      return false;
    }
    const local = result.value as Snapshot;
    this.save({ ...this.state, base: remote, local, pending: undefined, conflict: undefined });
    this.apply(structuredClone(local));
    return true;
  }
  /** Explicit whole-snapshot choice. UI must export both versions before destructive choices. */
  resolve(choice: 'local' | 'remote') {
    if (this.stopped) throw new Error('同步已停止');
    if (!this.state.conflict) throw new Error('没有待处理的同步冲突');
    const remote = this.state.conflict.remote;
    const local = choice === 'local' ? this.state.local : remote.payload;
    this.save({
      ...this.state,
      base: remote,
      local: structuredClone(local),
      pending: undefined,
      conflict: undefined,
    });
    this.apply(structuredClone(local));
  }
  private async run() {
    if (this.state.conflict) return;
    // Retry the persisted outbox BEFORE pulling, including after an uncertain response.
    if (!this.state.pending) {
      const remote = await this.transport.pull();
      if (this.stopped) return;
      if (!this.merge(remote)) return;
    }
    for (let attempt = 0; attempt < 4; attempt++) {
      if (this.stopped || this.state.conflict) return;
      if (!this.state.pending) {
        if (snapshotsEqual(this.state.local, this.state.base.payload)) return;
        this.save({
          ...this.state,
          pending: {
            id: this.id(),
            baseRevision: this.state.base.revision,
            payload: structuredClone(this.state.local),
          },
        });
      }
      const sent = structuredClone(this.state.pending!);
      const result = await this.transport.push(sent);
      if (this.stopped) return;
      if (result.status === 'conflict') {
        if (!this.merge(result)) return;
        continue;
      }
      // Local edits may occur while the request is in flight. Keep them for the next write.
      const newer = mergeSnapshots(sent.payload, this.state.local, result.payload);
      if (newer.conflicts.length) {
        this.save({
          ...this.state,
          pending: undefined,
          conflict: { remote: result, details: newer.conflicts },
        });
        return;
      }
      const local = newer.value as Snapshot;
      this.save({
        ...this.state,
        base: { revision: result.revision, payload: result.payload },
        local,
        pending: undefined,
      });
      this.apply(structuredClone(local));
    }
    // Bound contention; the scheduler will retry rather than spin indefinitely.
  }
}
export function loadSyncState(storage: Pick<Storage, 'getItem'>, owner: string): SyncState | null {
  const raw = storage.getItem('dtab:sync:' + owner);
  if (!raw) return null;
  const value = JSON.parse(raw) as SyncState;
  if (
    value.owner !== owner ||
    !value.base ||
    !Number.isSafeInteger(value.base.revision) ||
    value.base.revision < 0 ||
    !value.local
  )
    throw new Error('本地同步队列损坏，请先导出备份');
  return value;
}
export function saveSyncState(storage: Pick<Storage, 'setItem'>, state: SyncState) {
  storage.setItem('dtab:sync:' + state.owner, JSON.stringify(state));
}
