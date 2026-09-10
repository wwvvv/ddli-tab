import { installTemplateControls } from './template-controls.js';
import { installSyncControls } from './sync-controls.js';
import { createCloudClient, type CloudConfig } from './cloud-client.js';
declare const __DTAB_CLOUD__: CloudConfig;
export function installCloudPanel() {
  const trigger = document.createElement('button');
  trigger.textContent = '账号与同步';
  trigger.id = 'dtab-cloud-button';
  trigger.style.cssText =
    'position:fixed;right:56px;top:24px;z-index:1000;border:0;border-radius:16px;padding:7px 12px;background:#ffffffdd;color:#222;cursor:pointer;font-size:12px';
  const dialog = document.createElement('dialog');
  dialog.setAttribute('aria-label', 'DTab 账号与同步');
  dialog.style.cssText =
    'border:0;border-radius:16px;padding:24px;width:min(420px,90vw);color:#222;background:#fff;box-shadow:0 16px 80px #0005;';
  const heading = document.createElement('h2');
  heading.textContent = 'DTab 账号与同步';
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  const content = document.createElement('div');
  const close = document.createElement('button');
  close.textContent = '关闭';
  close.onclick = () => dialog.close();
  dialog.append(heading, status, content);
  installTemplateControls(dialog);
  dialog.append(close);
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
  password.minLength = 8;
  password.placeholder = '密码（至少 8 位）';
  password.setAttribute('aria-label', '密码');
  for (const input of [email, password])
    input.style.cssText =
      'box-sizing:border-box;display:block;width:100%;padding:10px;margin:10px 0;border:1px solid #ccc;border-radius:8px';
  const form = document.createElement('form');
  const login = document.createElement('button');
  login.type = 'submit';
  login.textContent = '登录';
  const register = document.createElement('button');
  register.type = 'button';
  register.textContent = '注册';
  const logout = document.createElement('button');
  logout.textContent = '退出登录';
  logout.type = 'button';
  const hint = document.createElement('p');
  hint.textContent = '首次启用同步前请确认数据来源。离线修改将在恢复连接后重试。';
  form.append(email, password, login, register);
  content.append(form, logout, hint);
  const syncHost = document.createElement('section');
  syncHost.hidden = true;
  content.append(syncHost);
  const sync = installSyncControls(supabase, syncHost);
  const update = (user: { id: string; email?: string } | null) => {
    sync.setOwner(user?.id ?? null);
    form.hidden = !!user;
    logout.hidden = !user;
    status.textContent = user
      ? `已登录：${user.email || '当前账号'}。`
      : '使用邮箱登录；密码只发送到你配置的 Supabase 项目。';
  };
  async function submit(signup: boolean) {
    if (!form.reportValidity()) return;
    login.disabled = register.disabled = true;
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
      status.textContent = (error as Error).message;
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
    sync.setOwner(null);
    logout.disabled = true;
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    logout.disabled = false;
    if (error) status.textContent = error.message;
    else update(null);
  };
  supabase.auth.onAuthStateChange((_event, session) => update(session?.user ?? null));
  void supabase.auth.getSession().then(({ data, error }) => {
    if (error) status.textContent = error.message;
    else update(data.session?.user ?? null);
  });
}
