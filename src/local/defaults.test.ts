import { describe, it, expect } from 'vitest';
import { applyInitialTemplate, TEMPLATE_MARKER } from './defaults';
function storage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => {
      m.set(k, v);
    },
    removeItem: (k: string) => {
      m.delete(k);
    },
  } as Storage;
}
const template = {
  schemaVersion: 1,
  version: '1',
  data: { appData: { listData: [{ id: '1', children: [] }] } },
};
describe('独立默认模板', () => {
  it('首次复制并标记版本', () => {
    const s = storage();
    expect(applyInitialTemplate(s, template)).toBe(true);
    expect(s.getItem(TEMPLATE_MARKER)).toBe('1');
    expect(s.getItem('persist:appData')).toContain('listData');
  });
  it('发布新版本不覆盖已初始化用户', () => {
    const s = storage();
    applyInitialTemplate(s, template);
    const before = s.getItem('persist:appData');
    expect(applyInitialTemplate(s, { ...template, version: '2' })).toBe(false);
    expect(s.getItem('persist:appData')).toBe(before);
    expect(s.getItem(TEMPLATE_MARKER)).toBe('1');
  });
  it('保护未带模板标记的旧用户', () => {
    const s = storage();
    s.setItem('persist:appData', 'existing');
    expect(applyInitialTemplate(s, template)).toBe(false);
    expect(s.getItem('persist:appData')).toBe('existing');
  });
  it('拒绝账号等非模板模块', () => {
    const s = storage();
    expect(() =>
      applyInitialTemplate(s, { ...template, data: { ...template.data, user: { token: 'test' } } }),
    ).toThrow();
    expect(s.getItem('persist:appData')).toBeNull();
  });
});
