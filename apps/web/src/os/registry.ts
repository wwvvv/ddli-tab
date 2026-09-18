import { z } from 'zod';
import { osAppHref } from './routes';

/**
 * DTab OS 应用注册表（M1 最小静态映射）。
 *
 * 架构约束（docs/dtab-os-v1/02-ARCHITECTURE.md §App registry）：
 * - 注册表位于源码中，入口必须显式静态映射；
 * - 后台商品数据不能指向任意 JS URL，不允许从数据库字符串动态 import。
 */
export const osAppSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/, 'appId 必须为小写字母开头的 kebab-case'),
  name: z.string().min(1),
  icon: z.string().min(1),
  description: z.string().min(1),
  system: z.boolean(),
  supportedSurfaces: z.array(z.enum(['desktop', 'tablet', 'mobile'])).min(1),
  requiredFeature: z.enum(['account', 'gallery-cloud', 'store']).nullable(),
});

export type OsApp = z.infer<typeof osAppSchema>;
export type OsSurface = OsApp['supportedSurfaces'][number];

const allSurfaces: OsSurface[] = ['desktop', 'tablet', 'mobile'];

const appDefinitions: OsApp[] = [
  {
    id: 'store',
    name: '商店',
    icon: 'storefront',
    description: '官方推荐、应用、组件、主题、游戏与网址的统一入口。',
    system: true,
    supportedSurfaces: allSurfaces,
    requiredFeature: null,
  },
  {
    id: 'gallery',
    name: '相册',
    icon: 'photos',
    description: '照片、相簿、收藏、上传与查看；云相册功能验收通过前不开放。',
    system: true,
    supportedSurfaces: allSurfaces,
    requiredFeature: 'gallery-cloud',
  },
  {
    id: 'settings',
    name: '设置',
    icon: 'gearshape',
    description: '账号、桌面与 Dock、外观、同步与备份、我的内容、安全与关于。',
    system: true,
    supportedSurfaces: allSurfaces,
    requiredFeature: null,
  },
];

// 模块加载即校验：非法定义直接抛错，避免坏数据进入构建产物。
for (const app of appDefinitions) {
  osAppSchema.parse(app);
}

export const osApps: readonly OsApp[] = appDefinitions;

export function findOsApp(id: string): OsApp | undefined {
  return osApps.find((app) => app.id === id);
}

// 导出统一入口路径生成，保证注册表与路由助手一致。
export const osAppEntryHref = osAppHref;
