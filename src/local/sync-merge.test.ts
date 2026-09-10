import { expect, it } from 'vitest';
import { mergeSnapshots as merge } from './sync-merge';
it('合并不同设置字段', () => {
  expect(merge({ a: 1, b: 1 }, { a: 2, b: 1 }, { a: 1, b: 3 })).toEqual({
    value: { a: 2, b: 3 },
    conflicts: [],
  });
});
it('保留两台设备分别添加的卡片', () => {
  const b = [{ id: '1', label: 'a' }];
  const r = merge(b, [...b, { id: '2', label: 'b' }], [...b, { id: '3', label: 'c' }]);
  expect((r.value as any[]).map((x) => x.id).sort()).toEqual(['1', '2', '3']);
  expect(r.conflicts).toEqual([]);
});
it('删除与另一张卡片编辑可合并，不复活删除项', () => {
  const b = [
    { id: '1', label: 'a' },
    { id: '2', label: 'b' },
  ];
  expect(merge(b, [b[1]], [b[0], { id: '2', label: 'new' }])).toEqual({
    value: [{ id: '2', label: 'new' }],
    conflicts: [],
  });
});
it('同一字段修改需要人工选择', () => {
  expect(merge({ a: 1 }, { a: 2 }, { a: 3 }).conflicts[0].path).toBe('/a');
});
it('删除与编辑冲突，不静默丢数据', () => {
  expect(merge([{ id: '1', label: 'a' }], [], [{ id: '1', label: 'b' }]).conflicts).toHaveLength(1);
});
it('双方相同修改不冲突', () => {
  expect(merge({ a: 1 }, { a: 2 }, { a: 2 }).conflicts).toEqual([]);
});
it('单方重排保留', () => {
  const b = [{ id: '1' }, { id: '2' }, { id: '3' }];
  expect(merge(b, [b[2], b[0], b[1]], b).value).toEqual([b[2], b[0], b[1]]);
});
it('双方不兼容重排产生冲突', () => {
  const b = [{ id: '1' }, { id: '2' }, { id: '3' }];
  expect(merge(b, [b[2], b[0], b[1]], [b[1], b[0], b[2]]).conflicts[0].path).toBe('/$order');
});
it('不会修改输入对象', () => {
  const b = { a: { x: 1 } },
    l = { a: { x: 2 } },
    r = { a: { x: 1 } };
  const out = merge(b, l, r);
  (out.value as any).a.x = 5;
  expect(l.a.x).toBe(2);
});
