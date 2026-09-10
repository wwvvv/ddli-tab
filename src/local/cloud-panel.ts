import { authErrorMessage } from './auth-errors.js';
import { installPasswordRecovery } from './password-recovery.js';
import { installTemplateControls } from './template-controls.js';
import { installSyncControls } from './sync-controls.js';
import { createCloudClient, type CloudConfig } from './cloud-client.js';

declare const __DTAB_CLOUD__: CloudConfig;

function findBackupPane() {
  const cue = [...document.querySelectorAll<HTMLElement>('p')].find(
    (element) => element.textContent?.trim() === '您的数据，专属于您的自由！',
  );
  if (!cue) return null;
  let element: HTMLElement | null = cue;
  while (element) {
    if (element.classList.contains('max-w-[480px]')) return element;
    element = element.parentElement;
  }
  return cue.parentElement;
}

function openBackupSettings() {
  // Avoid :has() here: the original bundle is also run in older extension
  // WebViews where selector support differs from Chromium's current build.
  document
    .querySelector<HTMLElement>('[aria-label="setting"]')
    ?.closest<HTMLElement>('button')
    ?.click();
  const chooseBackup = () =>
    [...document.querySelectorAll<HTMLElement>('.ant-menu-title-content')]
      .find((element) => element.textContent?.trim() === '迁移备份')
      ?.parentElement?.click();
  requestAnimationFrame(() => requestAnimationFrame(chooseBackup));
}

function installStyles() {
  if (document.getElementById('dtab-supabase-sync-styles')) return;
  const styles = document.createElement('style');
  styles.id = 'dtab-supabase-sync-styles';
  styles.textContent = `
    #dtab-supabase-sync {width:100%;margin:0 0 14px;padding:16px;border:1px solid #d9e9ff;border-radius:14px;background:linear-gradient(135deg,#f1f7ff,#fff 58%,#f3fbff);color:#193657;box-shadow:0 8px 18px #274a7210;font:13px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif}
    #dtab-supabase-sync * {box-sizing:border-box}
    #dtab-supabase-sync .dtab-sync-heading {display:flex;align-items:center;gap:10px;margin:0 0 4px;font-size:15px;color:#17385e}
    #dtab-supabase-sync .dtab-sync-mark {display:grid;place-items:center;width:28px;height:28px;border-radius:9px;background:#1677ff;color:white;font-weight:800}
    #dtab-supabase-sync .dtab-sync-subtitle {margin:0 0 13px;color:#6a7d94;font-size:12px}
    #dtab-supabase-sync [role=status] {margin:0 0 12px;padding:9px 11px;border:1px solid #d7e9ff;border-radius:9px;background:#eef7ff;color:#276095;font-size:12px}
    #dtab-supabase-sync [role=status][data-error=true] {border-color:#fecaca;background:#fff1f2;color:#b42318}
    #dtab-supabase-sync .dtab-auth-card,#dtab-supabase-sync .dtab-sync-card,#dtab-supabase-sync .dtab-account-hint,#dtab-supabase-sync .dtab-template-card {border:1px solid #e2eaf3;border-radius:11px;background:white}
    #dtab-supabase-sync .dtab-auth-card {padding:13px}
    #dtab-supabase-sync .dtab-auth-intro {margin:0 0 10px;color:#526b87;font-size:12px}
    #dtab-supabase-sync .dtab-field {display:block;margin:0 0 10px;color:#405776;font-size:12px;font-weight:650}
    #dtab-supabase-sync input {display:block;width:100%;margin-top:4px;border:1px solid #cad9e9;border-radius:8px;padding:8px 10px;background:white;color:#172b4d;font:13px/1.3 inherit;outline:0}
    #dtab-supabase-sync input:focus {border-color:#1677ff;box-shadow:0 0 0 3px #1677ff1a}
    #dtab-supabase-sync button {margin:3px 5px 3px 0;border:1px solid #c7d7e8;border-radius:8px;padding:7px 10px;background:#fff;color:#284461;font:650 12px/1.25 inherit;cursor:pointer}
    #dtab-supabase-sync button:hover:not(:disabled) {border-color:#8dbbf0;background:#f3f8ff}
    #dtab-supabase-sync button:disabled {opacity:.55;cursor:wait}
    #dtab-supabase-sync .dtab-primary {width:100%;margin:3px 0 0;border-color:#1677ff;background:linear-gradient(135deg,#1677ff,#428dff);color:white;box-shadow:0 5px 12px #1677ff33}
    #dtab-supabase-sync .dtab-password-row {display:flex;gap:6px;align-items:end}.dtab-password-row .dtab-field {flex:1}
    #dtab-supabase-sync .dtab-secondary-actions {display:flex;justify-content:space-between;margin-top:7px}.dtab-text-button {padding:4px 1px!important;border:0!important;background:transparent!important;color:#326fc2!important}
    #dtab-supabase-sync .dtab-account-hint {margin:10px 0 0;padding:9px 10px;color:#64748b;font-size:12px}
    #dtab-supabase-sync .dtab-sync-card {margin-top:10px;padding:11px}.dtab-sync-card p {margin:0 0 6px}.dtab-account-section-title {margin:0 0 4px;color:#17385e;font-size:13px}
    #dtab-supabase-sync .dtab-template-card {margin-top:12px;padding:12px}.dtab-template-card h3 {margin:0 0 3px;font-size:13px}.dtab-template-card p {margin:4px 0;color:#64748b;font-size:12px}
  `;
  document.head.append(styles);
}

export function installCloudPanel() {
  const state = window as Window & { __dtabSyncUnmount?: () => void };
  state.__dtabSyncUnmount?.();
  installStyles();
  let client: ReturnType<typeof createCloudClient>;
  try {
    client = createCloudClient(__DTAB_CLOUD__);
  } catch {
    client = null;
  }
  const mount = () => {
    if (document.getElementById('dtab-supabase-sync')) return;
    const pane = findBackupPane();
    if (!pane) return;
    const host = document.createElement('section');
    host.id = 'dtab-supabase-sync';
    const heading = document.createElement('h3');
    heading.className = 'dtab-sync-heading';
    heading.innerHTML = '<span class="dtab-sync-mark">D</span>账号与云端同步';
    const subtitle = document.createElement('p');
    subtitle.className = 'dtab-sync-subtitle';
    subtitle.textContent = '使用 Supabase 保存个人收藏、布局与主题设置。';
    const status = document.createElement('p');
    status.setAttribute('role', 'status');
    const content = document.createElement('div');
    host.append(heading, subtitle, status, content);
    const firstAlert = [...pane.children].find((child) =>
      child.textContent?.includes('您的数据，专属于您的自由！'),
    );
    pane.insertBefore(host, firstAlert || pane.firstChild);
    if (!client) {
      status.textContent = '尚未配置 Supabase，仍可使用下方原版本地导入、导出与迁移功能。';
      installTemplateControls(host);
      return;
    }
    const supabase = client;
    const email = document.createElement('input');
    email.type = 'email';
    email.autocomplete = 'email';
    email.required = true;
    email.placeholder = '邮箱';
    email.setAttribute('aria-label', '邮箱');
    const password = document.createElement('input');
    password.type = 'password';
    password.autocomplete = 'current-password';
    password.required = true;
    password.placeholder = '密码';
    password.setAttribute('aria-label', '密码');
    const form = document.createElement('form');
    form.className = 'dtab-auth-card';
    const intro = document.createElement('p');
    intro.className = 'dtab-auth-intro';
    intro.textContent = '登录后可使用下方同步操作，并在多台设备之间同步收藏。';
    const emailField = document.createElement('label');
    emailField.className = 'dtab-field';
    emailField.textContent = '邮箱';
    emailField.append(email);
    const passwordField = document.createElement('label');
    passwordField.className = 'dtab-field';
    passwordField.textContent = '密码';
    passwordField.append(password);
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.textContent = '显示';
    toggle.onclick = () => {
      password.type = password.type === 'password' ? 'text' : 'password';
      toggle.textContent = password.type === 'password' ? '显示' : '隐藏';
    };
    const passwordRow = document.createElement('div');
    passwordRow.className = 'dtab-password-row';
    passwordRow.append(passwordField, toggle);
    const login = document.createElement('button');
    login.type = 'submit';
    login.className = 'dtab-primary';
    login.textContent = '登录并继续';
    const register = document.createElement('button');
    register.type = 'button';
    register.className = 'dtab-text-button';
    register.textContent = '创建账号';
    const forgot = document.createElement('button');
    forgot.type = 'button';
    forgot.className = 'dtab-text-button';
    forgot.textContent = '忘记密码';
    const actions = document.createElement('div');
    actions.className = 'dtab-secondary-actions';
    actions.append(register, forgot);
    form.append(intro, emailField, passwordRow, login, actions);
    const hint = document.createElement('p');
    hint.className = 'dtab-account-hint';
    hint.textContent = '首次同步请确认数据来源；原版导入后的变更也会自动同步。';
    const logout = document.createElement('button');
    logout.type = 'button';
    logout.textContent = '退出登录';
    const syncHost = document.createElement('section');
    syncHost.className = 'dtab-sync-card';
    syncHost.hidden = true;
    const syncTitle = document.createElement('h4');
    syncTitle.className = 'dtab-account-section-title';
    syncTitle.textContent = '同步状态';
    syncHost.append(syncTitle);
    const changePassword = document.createElement('button');
    changePassword.type = 'button';
    changePassword.className = 'dtab-text-button';
    changePassword.textContent = '修改密码';
    content.append(form, hint, logout, syncHost, changePassword);
    installTemplateControls(host);
    const sync = installSyncControls(supabase, syncHost);
    let syncSuspended = false;
    const recovery = installPasswordRecovery(
      supabase,
      content,
      () => {
        syncSuspended = true;
        sync.setOwner(null);
        form.hidden = true;
        syncHost.hidden = true;
        changePassword.hidden = true;
      },
      () => {
        status.textContent = '密码已修改。同步保持暂停，请重新登录后启用。';
        changePassword.hidden = false;
      },
    );
    changePassword.onclick = () => recovery.enter();
    const update = (user: { id: string; email?: string } | null) => {
      if (recovery.active) return;
      changePassword.hidden = !user;
      syncHost.hidden = !user;
      sync.setOwner(syncSuspended ? null : (user?.id ?? null));
      form.hidden = !!user;
      logout.hidden = !user;
      status.dataset.error = 'false';
      status.textContent = user
        ? `已登录：${user.email || '当前账号'}。可使用下方同步操作。`
        : '登录后可同步；下方原版导入导出始终可用。';
    };
    const submit = async (signup: boolean) => {
      if (!form.reportValidity()) return;
      if (signup && password.value.length < 8) {
        status.dataset.error = 'true';
        status.textContent = '注册密码至少需要 8 位；登录请使用账号已有密码。';
        return;
      }
      login.disabled = register.disabled = true;
      status.dataset.error = 'false';
      status.textContent = '正在处理…';
      try {
        const result = signup
          ? await supabase.auth.signUp({ email: email.value.trim(), password: password.value })
          : await supabase.auth.signInWithPassword({
              email: email.value.trim(),
              password: password.value,
            });
        if (result.error) throw result.error;
        password.value = '';
        if (signup && !result.data.session)
          status.textContent =
            '注册请求已提交，请检查邮箱完成验证；若未收到邮件，请检查项目 SMTP 配置。';
        else update(result.data.user);
      } catch (error) {
        status.dataset.error = 'true';
        status.textContent = authErrorMessage(error);
      } finally {
        login.disabled = register.disabled = false;
      }
    };
    form.onsubmit = (event) => {
      event.preventDefault();
      void submit(false);
    };
    register.onclick = () => void submit(true);
    forgot.onclick = async () => {
      if (!email.reportValidity()) return;
      forgot.disabled = true;
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email.value.trim(), {
          redirectTo: location.origin + '/',
        });
        if (error) throw error;
        status.textContent = '重置邮件已发出，请在当前浏览器打开邮件中的链接。';
      } catch (error) {
        status.dataset.error = 'true';
        status.textContent = authErrorMessage(error);
      } finally {
        forgot.disabled = false;
      }
    };
    logout.onclick = async () => {
      recovery.exit();
      sync.setOwner(null);
      logout.disabled = true;
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      logout.disabled = false;
      if (error) {
        status.dataset.error = 'true';
        status.textContent = authErrorMessage(error);
      } else update(null);
    };
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        recovery.enter();
        return;
      }
      if (event === 'SIGNED_OUT') {
        recovery.exit();
        syncSuspended = false;
      }
      update(session?.user ?? null);
    });
    void supabase.auth
      .getSession()
      .then(({ data, error }) =>
        error ? (status.textContent = authErrorMessage(error)) : update(data.session?.user ?? null),
      );
  };
  const onOpen = () => {
    openBackupSettings();
    setTimeout(mount, 80);
  };
  window.addEventListener('dtab:open-sync-settings', onOpen);
  const observer = new MutationObserver(mount);
  observer.observe(document.body, { childList: true, subtree: true });
  state.__dtabSyncUnmount = () => {
    observer.disconnect();
    window.removeEventListener('dtab:open-sync-settings', onOpen);
  };
  mount();
}
