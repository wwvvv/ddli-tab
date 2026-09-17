/**
 * 统一路由助手（02-ARCHITECTURE：迁移阶段新 UI 用 /os 命名空间，
 * 源代码不散落硬编码 /os，最终切换到正式路径时只改这里）。
 */
export const OS_BASE_PATH = '/os';
export const API_V1_BASE_PATH = '/api/v1';

export function osAppHref(appId: string): string {
  return `${OS_BASE_PATH}/${appId}`;
}

export function apiV1(path: string): string {
  return `${API_V1_BASE_PATH}${path}`;
}
