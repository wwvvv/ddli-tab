export function normalizeCapturedPage(value: unknown) {
  const page = value as { url: string; title: string; icon?: string };
  const url = new URL(page?.url);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
    throw new Error('只支持普通 HTTP/HTTPS 网页');
  const title = String(page.title || url.hostname)
    .trim()
    .slice(0, 300);
  let icon = '';
  if (page.icon) {
    try {
      const candidate = new URL(page.icon, url);
      if (
        ['http:', 'https:'].includes(candidate.protocol) &&
        !candidate.username &&
        !candidate.password
      )
        icon = candidate.href;
    } catch {}
  }
  return { url: url.href, title, icon: icon || new URL('/favicon.ico', url).href };
}
export function installExtensionBridge() {
  const responses = new Map<string, string>();
  window.addEventListener('dtab:extension-request', async (event) => {
    let message: any;
    try {
      message = JSON.parse((event as CustomEvent).detail);
    } catch {
      return;
    }
    if (
      !message ||
      typeof message.id !== 'string' ||
      message.id.length > 100 ||
      !['groups', 'add'].includes(message.command)
    )
      return;
    const reply = (result: unknown) => {
      const raw = JSON.stringify({ id: message.id, ...(result as object) });
      responses.set(message.id, raw);
      if (responses.size > 100) responses.delete(responses.keys().next().value!);
      window.dispatchEvent(new CustomEvent('dtab:extension-response', { detail: raw }));
    };
    if (responses.has(message.id)) {
      window.dispatchEvent(
        new CustomEvent('dtab:extension-response', { detail: responses.get(message.id) }),
      );
      return;
    }
    try {
      const path = new URL('/assets/myErrorPage-duSnGROQ.js', location.origin).href;
      const original = await import(/* @vite-ignore */ path);
      const snapshot = original.J();
      const groups = snapshot.appData.listData;
      if (message.command === 'groups') {
        reply({
          ok: true,
          groups: groups.map((g: any) => ({ id: String(g.id), label: String(g.label) })),
        });
        return;
      }
      const captured = normalizeCapturedPage(message.page);
      const group = groups.find((g: any) => String(g.id) === String(message.groupId));
      if (!group || !Array.isArray(group.children))
        throw new Error('所选分组不存在，请重新读取分组');
      const existing = group.children.find(
        (card: any) => card.type === 'link' && card.link === captured.url,
      );
      if (existing) {
        reply({ ok: true, duplicate: true, cardId: existing.id });
        return;
      }
      const id = crypto.randomUUID();
      group.children.push({
        id,
        type: 'link',
        link: captured.url,
        internalLink: '',
        label: captured.title,
        showType: 'icon-h',
        size: '12',
        iconPadding: 2,
        icon: captured.icon,
        backgroundColor: '#ffffff',
        fontColor: '#000000',
        openTarget: 'globalSet',
        description: '',
      });
      if (!original.Y(snapshot, false)) throw new Error('收藏数据校验未通过');
      reply({ ok: true, cardId: id });
    } catch (error) {
      reply({ ok: false, error: (error as Error).message });
    }
  });
}
