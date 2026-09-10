export function authErrorMessage(error: unknown): string {
  const value = error as { code?: string; message?: string };
  if (value?.code === 'invalid_credentials' || value?.message === 'Invalid login credentials')
    return '登录失败：邮箱或密码不正确。请确认账号已创建，并核对邮箱和密码。';
  if (value?.code === 'email_not_confirmed') return '邮箱尚未确认，请先完成确认邮件中的验证。';
  if (value?.code === 'over_request_rate_limit' || value?.code === 'over_email_send_rate_limit')
    return '请求过于频繁，请稍后重试。';
  if (/fetch|network/i.test(value?.message || '')) return '连接失败，请检查网络后重试。';
  return '操作未完成：' + (value?.message || '请稍后重试。');
}
