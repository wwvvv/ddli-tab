# 创建 Supabase 并连接 DTab

## 1. 创建项目
打开 https://supabase.com/dashboard 登录，创建或选择组织，点击 New project。
项目名填写 dtab；选择可用区域（按实际用户网络测试选择）；生成数据库强密码并保存在密码管理器中，不填入网页环境变量。确认控制台显示的套餐和费用后创建，等待数据库就绪。

## 2. 初始化数据库
在获得数据库变更授权后，打开 SQL Editor → New query，按文件名顺序执行尚未应用的迁移：先 `supabase/migrations/202609100001_personal_sync.sql`，再 `supabase/migrations/202609180001_sync_owner_guard.sql`。已有项目只执行尚未应用的第二份迁移，不重跑第一份。
不要执行 tests 中的 SQL：它们属于本地测试环境。迁移不是可重复执行脚本；若提示表已存在，先检查现有结构，不要删除表重试。
在 Table Editor 确认 public.dtab_snapshots 存在且启用 RLS。表初始为空正常，用户第一次推送后才有记录。不要关闭 RLS，也不要额外添加所有人读写策略。

### 同步写接口升级注意
第二份迁移仅增加带 `p_expected_owner` 的写入口并撤销旧三参数入口的客户端执行权限，不改写收藏数据。服务端要求预期账号等于 `auth.uid()`，实际写入归属仍只取 JWT。
先在隔离测试项目验证，再安排数据库迁移与新版前端发布。迁移后旧标签页的上传会失败并保留本地队列，须保存本地备份、关闭所有 DTab 标签页并重新打开以更新 Worker。只发布前端但漏迁移也会拒绝写入；禁止回退调用无归属校验的旧入口。
不要为恢复旧版上传而重新授予旧函数执行权限；应保持写入暂停并修复/前滚客户端。详情见 [修复报告](dtab-os-v1/implementation/REVIEW-FIXES-20260918.md)。

## 3. 配置邮箱登录
在 Authentication 的登录方式设置中启用 Email，保留邮箱确认。
在 URL Configuration 中先填写：
- Site URL：http://127.0.0.1:4173/
- Redirect URLs：http://127.0.0.1:4173/

部署后把 Site URL 改为正式 HTTPS 站点根地址，并把同一地址加入 Redirect URLs。域名根路径即可，不需要自创 /auth/callback 页面。开发回调只在仍需要本地测试时保留。

默认邮件服务仅面向项目组织团队成员邮箱测试，并有严格限额。面向普通用户注册、确认和找回密码前，在 Authentication 的 SMTP 设置中配置自己的邮件服务及已验证发信域名；不要通过关闭邮箱确认来处理发信失败。
重置密码链接请在发起请求的同一浏览器打开（本项目使用 PKCE）。

## 4. 获取两项公开配置
从项目 Connect/设置获取 Project URL，从 Settings → API Keys 获取 Publishable key：

```dotenv
VITE_SUPABASE_URL=https://你的项目编号.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_你的公开密钥
```

当前构建只接受 sb_publishable_ 开头的公开密钥，不使用旧版 anon JWT。数据库密码、sb_secret_ 密钥、service_role 和个人 access token 都不进入源码、聊天或 EdgeOne 前端变量。
本地测试时在仓库根目录创建 .env.local 写入上述两项，再执行 pnpm run build 并重启预览。该文件被 Git 忽略。

## 5. 手动部署 EdgeOne
导入 GitHub 仓库 wwvvv/ddli-tab 的 main 分支，根目录为仓库根目录：
- 安装：npm i -g pnpm@11.7.0 && pnpm install --frozen-lockfile
- 构建：pnpm run build:edge
- 输出：dist-original
- Node：22.22.2（pnpm 11.7.0 要求 Node ≥ 22.13）

在生产环境变量中填写第 4 步两项；更改变量必须重新构建。完整缓存、回滚和验收见 DEPLOY_EDGEONE.md。

## 6. 验收
先导出本地收藏备份。在正式站点注册、确认邮件并登录，启用同步；第二台设备登录同一账号并选择云端数据，验证添加和删除往返同步。另一个账号不应看到第一个账号的数据。
本地和正式域名不共享浏览器数据，迁移可通过原版 JSON 导出/导入完成。遇到初次同步方向选择时先备份，再决定保留本地还是云端。
默认模板属于仓库 config/default-template.json，不属于管理员账号；Supabase 控制台管理员和 DTab 用户账号不是同一种身份。

教程与代码提交不代表真实云服务验收完成。GitHub Actions 若因账户账单/额度阻止启动，应处理账户问题后重跑，不要将未启动当作通过。

## 官方参考
- API keys：https://supabase.com/docs/guides/getting-started/api-keys
- 回调地址：https://supabase.com/docs/guides/auth/redirect-urls
- 邮件限制和 SMTP：https://supabase.com/docs/guides/auth/auth-smtp
