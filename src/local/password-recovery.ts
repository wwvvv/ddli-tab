import type { SupabaseClient } from '@supabase/supabase-js';
export function installPasswordRecovery(
  client: SupabaseClient,
  host: HTMLElement,
  onEnter: () => void,
  onDone: () => void,
) {
  const form = document.createElement('form');
  form.hidden = true;
  const title = document.createElement('h3');
  title.textContent = '设置新密码';
  const password = document.createElement('input');
  password.type = 'password';
  password.autocomplete = 'new-password';
  password.required = true;
  password.minLength = 8;
  password.setAttribute('aria-label', '新密码');
  const confirmation = document.createElement('input');
  confirmation.type = 'password';
  confirmation.autocomplete = 'new-password';
  confirmation.required = true;
  confirmation.setAttribute('aria-label', '确认新密码');
  for (const input of [password, confirmation])
    input.style.cssText =
      'display:block;box-sizing:border-box;width:100%;padding:10px;margin:8px 0;border:1px solid #ccc;border-radius:8px';
  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.textContent = '保存新密码';
  const status = document.createElement('p');
  status.setAttribute('aria-live', 'polite');
  form.append(title, password, confirmation, submit, status);
  host.append(form);
  let active = false;
  form.onsubmit = async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    if (password.value !== confirmation.value) {
      status.textContent = '两次输入的密码不一致。';
      return;
    }
    submit.disabled = true;
    try {
      const { error } = await client.auth.updateUser({ password: password.value });
      if (error) throw error;
      password.value = confirmation.value = '';
      active = false;
      form.hidden = true;
      onDone();
    } catch (error) {
      status.textContent = '密码修改未完成：' + (error as Error).message;
    } finally {
      submit.disabled = false;
    }
  };
  return {
    get active() {
      return active;
    },
    enter() {
      active = true;
      form.hidden = false;
      status.textContent = '当前已暂停同步，请设置至少 8 位的新密码。';
      onEnter();
      password.focus();
    },
    exit() {
      active = false;
      form.hidden = true;
      password.value = confirmation.value = '';
    },
  };
}
