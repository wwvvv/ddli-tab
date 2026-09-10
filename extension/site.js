export function parseSite(value) {
  const url = new URL(value.trim());
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/' ||
    !(
      url.protocol === 'https:' ||
      (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))
    )
  )
    throw Error('请填写 DTab 的 HTTPS 根地址；本地测试可用 localhost 或 127.0.0.1');
  return { origin: url.origin, pattern: `${url.protocol}//${url.hostname}/*` };
}
