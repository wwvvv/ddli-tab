import { authErrorMessage } from './auth-errors.js';
import { installPasswordRecovery } from './password-recovery.js';
import { installTemplateControls } from './template-controls.js';
import { installSyncControls } from './sync-controls.js';
import { createCloudClient, type CloudConfig } from './cloud-client.js';
declare const __DTAB_CLOUD__: CloudConfig;
export function installCloudPanel() {
  const trigger = document.createElement('button');
  trigger.textContent = '账号与同步';
  trigger.id = 'dtab-cloud-button';
  const dialog = document.createElement('dialog');
  dialog.setAttribute('aria-label', 'DTab 账号与同步');
  dialog.id = 'dtab-account-dialog';
  const styles = document.createElement('style');
  styles.textContent = `
    #dtab-cloud-button {position:fixed;right:56px;top:24px;z-index:1000;border:1px solid #ffffff80;border-radius:999px;padding:8px 13px;background:#fffffff0;color:#172b4d;box-shadow:0 8px 22px #0f274d1a;font:600 12px/1 system-ui,sans-serif;cursor:pointer;transition:transform .16s,box-shadow .16s}
    #dtab-cloud-button:hover {transform:translateY(-1px);box-shadow:0 11px 28px #0f274d2b}
    #dtab-account-dialog {box-sizing:border-box;width:min(448px,calc(100vw - 32px));max-height:min(760px,calc(100vh - 32px));overflow:auto;border:1px solid #dfe8f5;border-radius:24px;padding:0;color:#172b4d;background:linear-gradient(150deg,#f8fbff 0%,#fff 42%,#f5f9ff 100%);box-shadow:0 28px 90px #081a334d;color-scheme:light;font:14px/1.55 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    #dtab-account-dialog::backdrop {background:#11274366;backdrop-filter:blur(3px)}
    #dtab-account-dialog * {box-sizing:border-box}
    #dtab-account-dialog .dtab-account-header {display:flex;align-items:flex-start;gap:12px;padding:24px 24px 16px;background:linear-gradient(135deg,#e8f2ff,#f9fcff 65%,#e8fbf7)}
    #dtab-account-dialog .dtab-account-mark {display:grid;place-items:center;width:42px;height:42px;flex:none;border-radius:14px;background:linear-gradient(145deg,#1677ff,#4aa0ff);color:#fff;font-size:20px;font-weight:800;box-shadow:0 8px 20px #1677ff42}
    #dtab-account-dialog h2 {margin:0;color:#0d2548;font-size:19px;line-height:1.25;letter-spacing:-.02em}
    #dtab-account-dialog .dtab-account-subtitle {margin:3px 0 0;color:#64748b;font-size:12px}
    #dtab-account-dialog .dtab-dialog-close {margin-left:auto;width:30px;height:30px;padding:0;border:0;border-radius:10px;background:#ffffffa8;color:#52647b;font-size:20px;line-height:1;cursor:pointer}
    #dtab-account-dialog .dtab-account-body {padding:0 24px 24px}
    #dtab-account-dialog [role=status] {margin:16px 0 12px;padding:10px 12px;border:1px solid #dbeafe;border-radius:12px;background:#eff6ff;color:#24558b;font-size:12px;line-height:1.55}
    #dtab-account-dialog [role=status][data-error=true] {border-color:#fecaca;background:#fff1f2;color:#b42318}
    #dtab-account-dialog .dtab-auth-card,#dtab-account-dialog .dtab-sync-card,#dtab-account-dialog .dtab-account-hint,#dtab-account-dialog .dtab-template-card {border:1px solid #e3ebf5;border-radius:16px;background:#fff;box-shadow:0 8px 22px #314a6b0a}
    #dtab-account-dialog .dtab-auth-card {padding:16px}
    #dtab-account-dialog .dtab-auth-intro {margin:0 0 14px;color:#405776;font-size:13px}
    #dtab-account-dialog .dtab-field {display:block;margin:0 0 12px;color:#405776;font-size:12px;font-weight:650}
    #dtab-account-dialog input {display:block;width:100%;margin-top:5px;border:1px solid #cbd9ea;border-radius:10px;padding:10px 11px;background:#fff;color:#172b4d;font:14px/1.3 inherit;outline:0}
    #dtab-account-dialog input:focus {border-color:#1677ff;box-shadow:0 0 0 3px #1677ff1f}
    #dtab-account-dialog input::placeholder {color:#8b9bb0;opacity:1}
    #dtab-account-dialog .dtab-password-row {display:flex;gap:7px;align-items:end}
    #dtab-account-dialog .dtab-password-row .dtab-field {flex:1;margin-bottom:0}
    #dtab-account-dialog button {border:1px solid #c9d8e8;border-radius:10px;padding:9px 12px;background:#fff;color:#284461;font:650 13px/1.25 inherit;cursor:pointer;transition:background .15s,border-color .15s,transform .15s}
    #dtab-account-dialog button:hover:not(:disabled) {border-color:#9ec3ee;background:#f3f8ff}
    #dtab-account-dialog button:active:not(:disabled) {transform:translateY(1px)}
    #dtab-account-dialog button:disabled {opacity:.52;cursor:wait}
    #dtab-account-dialog .dtab-primary {width:100%;margin-top:14px;border-color:#1677ff;background:linear-gradient(135deg,#1677ff,#428dff);color:#fff;box-shadow:0 7px 15px #1677ff33}
    #dtab-account-dialog .dtab-primary:hover:not(:disabled) {border-color:#1268dd;background:linear-gradient(135deg,#126fea,#3783f6)}
    #dtab-account-dialog .dtab-secondary-actions {display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:10px}
    #dtab-account-dialog .dtab-text-button {padding:5px 2px;border:0;background:transparent;color:#326fc2;font-size:12px}
    #dtab-account-dialog .dtab-account-hint {margin:12px 0 0;padding:11px 12px;color:#64748b;font-size:12px}
    #dtab-account-dialog .dtab-sync-card {margin-top:12px;padding:14px}
    #dtab-account-dialog .dtab-sync-card p {margin:0 0 8px;color:#405776}
    #dtab-account-dialog .dtab-account-section-title {margin:0 0 5px;color:#18375d;font-size:13px}
    #dtab-account-dialog .dtab-account-footer {display:flex;justify-content:flex-end;margin-top:16px}
    #dtab-account-dialog .dtab-template-card {margin-top:16px;padding:15px}
    #dtab-account-dialog .dtab-template-card h3 {margin:0 0 4px;color:#18375d;font-size:13px}
    #dtab-account-dialog .dtab-template-card p {margin:4px 0;color:#64748b;font-size:12px}
    @media (max-width:600px) {#dtab-cloud-button {right:48px;top:19px;padding:7px 10px}#dtab-account-dialog {width:calc(100vw - 20px);max-height:calc(100vh - 20px);border-radius:20px}#dtab-account-dialog .dtab-account-header {padding:19px 18px 13px}#dtab-account-dialog .dtab-account-body {padding:0 18px 18px}}
  `;
  document.head.append(styles);
  const header = document.createElement('header');
  header.className = 'dtab-account-header';
  const mark = document.createElement('span');
  mark.className = 'dtab-account-mark';
  mark.textContent = 'D';
  const titleArea = document.createElement('div');
  const heading = document.createElement('h2');
  heading.textContent = '账号与同步';
  const subtitle = document.createElement('p');
  subtitle.className = 'dtab-account-subtitle';
  subtitle.textContent = '安全保存你的 DTab 收藏与个性设置';
  titleArea.append(heading, subtitle);
  const close = document.createElement('button');
  close.className = 'dtab-dialog-close';
  close.textContent = '×';
  close.title = '关闭';
  close.setAttribute('aria-label', '关闭');
  close.onclick = () => dialog.close();
  header.append(mark, titleArea, close);
  const body = document.createElement('div');
  body.className = 'dtab-account-body';
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  const content = document.createElement('div');
  const footer = document.createElement('footer');
  footer.className = 'dtab-account-footer';
  const footerClose = document.createElement('button');
  footerClose.textContent = '完成';
  footerClose.type = 'button';
  footerClose.onclick = () => dialog.close();
  footer.append(footerClose);
  body.append(status, content);
  dialog.append(header, body);
  installTemplateControls(body);
  body.append(footer);
  document.body.append(trigger, dialog);
  trigger.onclick = () => dialog.showModal();
  let client: ReturnType<typeof createCloudClient>;
  try {
    client = createCloudClient(__DTAB_CLOUD__);
  } catch (error) {
    status.textContent = String((error as Error).message);
    return;
  }
  if (!client) {
    status.textContent =
      '尚未配置 Supabase。请在构建环境填写项目 URL 与 Publishable key，当前仍可离线使用收藏和设置。';
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

  password.placeholder = '密码（注册至少 8 位）';
  password.setAttribute('aria-label', '密码');
  for (const input of [email, password])
    input.style.cssText =
      'box-sizing:border-box;display:block;width:100%;padding:10px;margin:10px 0;border:1px solid #ccc;border-radius:8px';
  const form = document.createElement('form');
  form.className = 'dtab-auth-card';
  const intro = document.createElement('p');
  intro.className = 'dtab-auth-intro';
  intro.textContent = '登录后可在多台设备之间同步收藏。';
  const emailField = document.createElement('label');
  emailField.className = 'dtab-field';
  emailField.textContent = '邮箱';
  emailField.append(email);
  const passwordField = document.createElement('label');
  passwordField.className = 'dtab-field';
  passwordField.textContent = '密码';
  passwordField.append(password);
  const login = document.createElement('button');
  login.type = 'submit';
  login.textContent = '登录并继续';
  login.className = 'dtab-primary';
  const register = document.createElement('button');
  register.type = 'button';
  register.textContent = '创建账号';
  register.className = 'dtab-text-button';
  const logout = document.createElement('button');
  logout.textContent = '退出登录';
  logout.type = 'button';
  const hint = document.createElement('p');
  hint.textContent = '首次启用同步前请确认数据来源。离线修改将在恢复连接后重试。';
  const forgot = document.createElement('button');
  forgot.type = 'button';
  forgot.textContent = '忘记密码';
  forgot.className = 'dtab-text-button';
  forgot.onclick = async () => {
    if (!email.reportValidity()) return;
    forgot.disabled = true;
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.value.trim(), {
        redirectTo: location.origin + '/',
      });
      if (error) throw error;
      status.textContent =
        '如果该邮箱可以接收重置邮件，你将收到密码重置链接，请在发起请求的浏览器中打开。';
    } catch (error) {
      status.textContent = '重置请求未完成：' + (error as Error).message;
    } finally {
      forgot.disabled = false;
    }
  };
  const passwordRow = document.createElement('div');
  passwordRow.className = 'dtab-password-row';
  const togglePassword = document.createElement('button');
  togglePassword.type = 'button';
  togglePassword.textContent = '显示';
  togglePassword.onclick = () => {
    password.type = password.type === 'password' ? 'text' : 'password';
    togglePassword.textContent = password.type === 'password' ? '显示' : '隐藏';
  };
  passwordRow.append(passwordField, togglePassword);
  const actions = document.createElement('div');
  actions.className = 'dtab-secondary-actions';
  actions.append(register, forgot);
  form.append(intro, emailField, passwordRow, login, actions);
  hint.className = 'dtab-account-hint';
  hint.textContent = '首次同步请确认数据来源。离线修改会在恢复网络后自动重试。';
  content.append(form, hint, logout);
  const syncHost = document.createElement('section');
  syncHost.className = 'dtab-sync-card';
  const syncTitle = document.createElement('h3');
  syncTitle.className = 'dtab-account-section-title';
  syncTitle.textContent = '同步状态';
  syncHost.append(syncTitle);
  syncHost.hidden = true;
  content.append(syncHost);
  const sync = installSyncControls(supabase, syncHost);
  const changePassword = document.createElement('button');
  changePassword.textContent = '修改密码';
  changePassword.className = 'dtab-text-button';
  changePassword.type = 'button';
  content.append(changePassword);
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
      if (!dialog.open) dialog.showModal();
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
    sync.setOwner(syncSuspended ? null : (user?.id ?? null));
    form.hidden = !!user;
    logout.hidden = !user;
    status.textContent = user
      ? `已登录：${user.email || '当前账号'}。`
      : '使用邮箱登录；密码只发送到你配置的 Supabase 项目。';
  };
  async function submit(signup: boolean) {
    if (!form.reportValidity()) return;
    if (signup && password.value.length < 8) {
      status.textContent = '注册密码至少需要 8 位；登录请使用账号已有密码。';
      return;
    }
    login.disabled = register.disabled = true;
    status.dataset.error = 'false';
    status.textContent = '正在处理…';
    try {
      const credentials = { email: email.value.trim(), password: password.value };
      const result = signup
        ? await supabase.auth.signUp(credentials)
        : await supabase.auth.signInWithPassword(credentials);
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
  }
  form.onsubmit = (e) => {
    e.preventDefault();
    void submit(false);
  };
  register.onclick = () => void submit(true);
  logout.onclick = async () => {
    recovery.exit();
    sync.setOwner(null);
    logout.disabled = true;
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    logout.disabled = false;
    if (error) status.textContent = error.message;
    else update(null);
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
  void supabase.auth.getSession().then(({ data, error }) => {
    if (error) status.textContent = error.message;
    else update(data.session?.user ?? null);
  });
}
