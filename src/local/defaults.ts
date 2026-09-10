/** Seed a standalone published template once. Never use an administrator's personal state. */
export const TEMPLATE_MARKER = 'dtab:template-version';
const modules = [
  'home',
  'openType',
  'wallpaperTheme',
  'swiper',
  'clockAndDate',
  'searchBar',
  'searchEngineData',
  'card',
  'appData',
  'bottomArea',
  'simpleMode',
  'dock',
];
export function applyInitialTemplate(storage: Storage, template: unknown): boolean {
  if (
    storage.getItem(TEMPLATE_MARKER) ||
    storage.getItem('initOver') ||
    modules.some((name) => storage.getItem('persist:' + name) !== null)
  )
    return false;
  const t = validateTemplate(template);
  const writes: [string, string][] = [];
  for (const [name, value] of Object.entries(t.data)) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new Error('默认模板模块格式无效');
    writes.push([
      'persist:' + name,
      JSON.stringify(
        Object.fromEntries(
          Object.entries(value)
            .filter(([key]) => key !== '_persist')
            .map(([key, v]) => [key, JSON.stringify(v)]),
        ),
      ),
    ]);
  }
  try {
    for (const [key, value] of writes) storage.setItem(key, value);
    storage.setItem(TEMPLATE_MARKER, t.version);
  } catch (error) {
    for (const [key] of writes) storage.removeItem(key);
    storage.removeItem(TEMPLATE_MARKER);
    throw error;
  }
  return true;
}
export async function initializeDefaults() {
  if (
    localStorage.getItem('initOver') ||
    localStorage.getItem(TEMPLATE_MARKER) ||
    modules.some((name) => localStorage.getItem('persist:' + name) !== null)
  )
    return;
  // Older installs may still store their personal data in IndexedDB. Do not seed over it.
  if (
    typeof indexedDB.databases === 'function' &&
    (await indexedDB.databases()).some((db) => db.name === 'gotab')
  )
    return;
  const response = await fetch('/config/default-template.json');
  if (!response.ok) throw new Error('读取默认模板失败');
  applyInitialTemplate(localStorage, await response.json());
}

export function validateTemplate(template: unknown) {
  const t = template as {
    schemaVersion: number;
    version: string;
    data: Record<string, Record<string, unknown>>;
  };
  if (
    t?.schemaVersion !== 1 ||
    typeof t.version !== 'string' ||
    !t.version ||
    !t.data ||
    Object.keys(t.data).some((k) => !modules.includes(k))
  )
    throw new Error('默认模板格式无效');
  if (!Array.isArray(t.data.appData?.listData)) throw new Error('默认模板缺少分组数据');
  for (const value of Object.values(t.data)) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new Error('默认模板模块格式无效');
  }
  return t;
}
