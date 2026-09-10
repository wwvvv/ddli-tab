import { it, expect } from 'vitest';
import { normalizeCapturedPage } from './extension-bridge';
it('保留页面标题并识别相对图标', () =>
  expect(
    normalizeCapturedPage({ url: 'https://example.com/a', title: 'Example', icon: '/logo.png' }),
  ).toEqual({
    url: 'https://example.com/a',
    title: 'Example',
    icon: 'https://example.com/logo.png',
  }));
it('缺失图标使用站点 favicon 候选', () =>
  expect(normalizeCapturedPage({ url: 'https://example.com', title: '' }).icon).toBe(
    'https://example.com/favicon.ico',
  ));
it('拒绝执行脚本和含凭据的网址', () => {
  for (const url of ['javascript:alert(1)', 'file:///tmp/a', 'https://user:pass@example.com'])
    expect(() => normalizeCapturedPage({ url, title: 'x' })).toThrow();
});
it('非法图标不作为脚本或 data URL 保存', () =>
  expect(
    normalizeCapturedPage({ url: 'https://example.com', title: 'a', icon: 'javascript:alert(1)' })
      .icon,
  ).toBe('https://example.com/favicon.ico'));
