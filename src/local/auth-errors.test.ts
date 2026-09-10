import { expect, it } from 'vitest';
import { authErrorMessage } from './auth-errors';
it('登录失败反馈使用中文且不把错误认定为账号不存在', () => {
  expect(authErrorMessage({ code: 'invalid_credentials' })).toContain('邮箱或密码不正确');
  expect(authErrorMessage({ message: 'Invalid login credentials' })).toContain('请确认账号已创建');
  expect(authErrorMessage({ code: 'email_not_confirmed' })).toContain('邮箱尚未确认');
  expect(authErrorMessage(new Error('Failed to fetch'))).toContain('连接失败');
});
