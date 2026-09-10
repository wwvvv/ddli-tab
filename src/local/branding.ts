/** Change only known built-in branding; leave user-created cards and storage keys alone. */
export function migrateBranding() {
  const repo = 'https://github.com/wwvvv/ddli-tab';
  const cards: Record<string, { label: string; link: string; icon: string; description: string }> =
    {
      欢迎使用: {
        label: '欢迎使用 DTab',
        link: repo,
        icon: '/icons/logo.svg',
        description: '项目仓库',
      },
      版本日志: {
        label: '版本日志',
        link: repo + '/commits/main/',
        icon: '/icons/history.svg',
        description: '功能迭代记录',
      },
      雨云服务器: {
        label: '使用说明',
        link: repo + '#本地运行',
        icon: '/icons/bookmark.svg',
        description: '本地运行与数据备份',
      },
      加入QQ群: {
        label: '问题反馈',
        link: repo + '/issues',
        icon: '/icons/website.svg',
        description: '反馈问题与功能建议',
      },
    };
  const visit = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(visit);
    if (!value || typeof value !== 'object') return value;
    const object = value as Record<string, unknown>;
    const replacement = cards[String(object.label)];
    if (
      replacement &&
      ['11', '12', '13', '14'].includes(String(object.id)) &&
      typeof object.link === 'string' &&
      /^(https:\/\/www\.gotab\.cn(?:\/|$)|https:\/\/www\.rainyun\.com\/gotab_|https:\/\/qm\.qq\.com\/)/.test(
        object.link,
      )
    )
      Object.assign(object, replacement);
    for (const [key, entry] of Object.entries(object)) {
      if (
        ['webTitle', 'clockAndDateText'].includes(key) &&
        typeof entry === 'string' &&
        /^(?:GoTab|GOTAB|Gotab)(?: 新标签页| · 本地版)?$/.test(entry)
      )
        object[key] = entry.replace(/GoTab|GOTAB|Gotab/g, 'DTab');
      else if (typeof entry === 'object') object[key] = visit(entry);
    }
    return object;
  };
  for (const key of Object.keys(localStorage).filter((key) => key.startsWith('persist:'))) {
    const original = localStorage.getItem(key);
    if (!original) continue;
    try {
      const container = JSON.parse(original);
      for (const field of Object.keys(container)) {
        if (typeof container[field] === 'string') {
          try {
            const parsed = JSON.parse(container[field]);
            container[field] = JSON.stringify(
              (visit({ [field]: parsed }) as Record<string, unknown>)[field],
            );
          } catch {
            /* Preserve non-JSON values. */
          }
        }
      }
      const next = JSON.stringify(container);
      if (next !== original) {
        // Keep a rollback copy before the first migration of each persisted module.
        const backup = 'dtab:branding-backup:' + key;
        if (!localStorage.getItem(backup)) localStorage.setItem(backup, original);
        localStorage.setItem(key, next);
      }
    } catch {
      /* Corrupt or full storage must not be overwritten. */
    }
  }
}
