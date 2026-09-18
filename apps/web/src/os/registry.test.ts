import { describe, expect, it } from 'vitest';
import { findOsApp, osAppEntryHref, osAppSchema, osApps } from './registry';
import { OS_BASE_PATH } from './routes';

describe('DTab OS app registry 契约', () => {
  it('所有应用定义通过 schema 校验', () => {
    for (const app of osApps) {
      expect(() => osAppSchema.parse(app)).not.toThrow();
    }
  });

  it('appId 唯一，且包含 PRD 首套 Dock 预设的商店、相册、设置', () => {
    const ids = osApps.map((app) => app.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining(['store', 'gallery', 'settings']));
  });

  it('系统应用均覆盖桌面、平板、手机三种表面', () => {
    for (const app of osApps) {
      expect(app.system).toBe(true);
      expect(app.supportedSurfaces).toEqual(
        expect.arrayContaining(['desktop', 'tablet', 'mobile']),
      );
    }
  });

  it('入口是 /os 命名空间下的静态映射路径，不产生外部 JS URL', () => {
    for (const app of osApps) {
      expect(osAppEntryHref(app.id)).toBe(`${OS_BASE_PATH}/${app.id}`);
      expect(findOsApp(app.id)).toBeDefined();
    }
  });

  it('未知 appId 不返回任何应用（由页面侧渲染 404）', () => {
    expect(findOsApp('not-an-app')).toBeUndefined();
  });
});
