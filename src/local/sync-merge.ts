/** Three-way merge. Conflicts are explicit; callers must not push until resolved. */
export interface MergeConflict {
  path: string;
  base: unknown;
  local: unknown;
  remote: unknown;
}
export interface MergeResult {
  value: unknown;
  conflicts: MergeConflict[];
}
const isObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
function equal(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b))
    return a.length === b.length && a.every((v, i) => equal(v, b[i]));
  if (isObject(a) && isObject(b)) {
    const keys = Object.keys(a);
    return (
      keys.length === Object.keys(b).length &&
      keys.every((k) => Object.hasOwn(b, k) && equal(a[k], b[k]))
    );
  }
  return false;
}
function keyed(v: unknown[]): v is (Record<string, unknown> & { id: string | number })[] {
  return (
    v.every((x) => isObject(x) && ['string', 'number'].includes(typeof x.id)) &&
    new Set(v.map((x) => String((x as any).id))).size === v.length
  );
}
export function mergeSnapshots(base: unknown, local: unknown, remote: unknown): MergeResult {
  const conflicts: MergeConflict[] = [];
  const merge = (b: unknown, l: unknown, r: unknown, path: string): unknown => {
    if (equal(l, r)) return structuredClone(l);
    if (equal(l, b)) return structuredClone(r);
    if (equal(r, b)) return structuredClone(l);
    if (isObject(b) && isObject(l) && isObject(r)) {
      const result: Record<string, unknown> = Object.create(null);
      for (const k of new Set([...Object.keys(b), ...Object.keys(l), ...Object.keys(r)])) {
        const value = merge(
          b[k],
          l[k],
          r[k],
          path + '/' + k.replaceAll('~', '~0').replaceAll('/', '~1'),
        );
        if (value !== undefined) result[k] = value;
      }
      return result;
    }
    if (
      Array.isArray(b) &&
      Array.isArray(l) &&
      Array.isArray(r) &&
      keyed(b) &&
      keyed(l) &&
      keyed(r)
    ) {
      const bm = new Map(b.map((x) => [String(x.id), x])),
        lm = new Map(l.map((x) => [String(x.id), x])),
        rm = new Map(r.map((x) => [String(x.id), x]));
      const result = new Map<string, unknown>();
      for (const id of new Set([...bm.keys(), ...lm.keys(), ...rm.keys()])) {
        const value = merge(bm.get(id), lm.get(id), rm.get(id), path + '/id:' + id);
        if (value !== undefined) result.set(id, value);
      }
      const shared = (arr: typeof b) =>
        arr
          .map((x) => String(x.id))
          .filter((id) => bm.has(id) && lm.has(id) && rm.has(id) && result.has(id));
      const bo = shared(b),
        lo = shared(l),
        ro = shared(r);
      let order = l.map((x) => String(x.id));
      if (equal(lo, bo)) order = r.map((x) => String(x.id));
      else if (!equal(ro, bo) && !equal(lo, ro))
        conflicts.push({ path: path + '/$order', base: bo, local: lo, remote: ro });
      // Keep each selected ordering; append new IDs found only on the other device.
      return [...new Set([...order, ...lm.keys(), ...rm.keys()])]
        .filter((id) => result.has(id))
        .map((id) => result.get(id));
    }
    conflicts.push({
      path,
      base: structuredClone(b),
      local: structuredClone(l),
      remote: structuredClone(r),
    });
    return structuredClone(l);
  };
  return { value: merge(base, local, remote, ''), conflicts };
}

export { equal as snapshotsEqual };
