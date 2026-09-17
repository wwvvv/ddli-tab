# EdgeOne 手动部署 DTab

由用户手动导入 GitHub 项目，不自动创建云项目或购买套餐。

## 部署前
1. 确认 GitHub main 已包含当前代码，Actions 全部通过。
2. 创建 Supabase 项目，在 SQL Editor 执行 supabase/migrations/202609100001_personal_sync.sql（一次）。不要执行 tests/local-auth-harness.sql。
3. 配置登录方式与正式邮件 SMTP，并保存 Project URL 和 Publishable key。

## GitHub 导入
在 EdgeOne Pages/Makers 控制台新建项目，授权读取私有仓库 wwvvv/ddli-tab，选择 main。
- 框架：其他/静态站点。
- 根目录：仓库根目录。
- 安装命令：npm i -g pnpm@11.7.0 && pnpm install --frozen-lockfile
- 构建命令：pnpm run build:edge
- 输出目录：dist-original
- Node.js：22.22.2（不得低于 22.13：pnpm 11.7.0 硬性要求 Node ≥ 22.13，22.11.0 会使安装命令直接失败——2026-09-17 GitHub CI 首跑已复现该冲突）

仓库使用 pnpm 作为唯一包管理器（pnpm-lock.yaml 单一 lockfile）。完整类型检查、测试在 Node 24 的 GitHub CI 执行。生产安装通过 --frozen-lockfile 与提交的 lockfile 保持一致。

环境变量：
- VITE_SUPABASE_URL：项目 HTTPS 根地址。
- VITE_SUPABASE_PUBLISHABLE_KEY：sb_publishable_ 开头的公开密钥。

两个都留空会生成纯本地模式；只填一项或填私密密钥会报错。更改变量后必须重新构建。公开配置会进入浏览器代码，访问控制依赖 Supabase Auth 与 RLS。

## 正式域名与验证
配置 HTTPS 域名后，在 Supabase Authentication URL Configuration 中更新 Site URL 和实际回调地址。

逐项人工验收：
- 首次打开显示 DTab，原版设置、卡片编辑和备份正常。
- 登录、注册邮件确认和退出正常。
- 两个不同账号互相看不到数据。
- 两台设备同账号启用同步，增删改能往返同步。
- 断网编辑后恢复联网不丢数据；双端冲突有提示及备份。
- 更新部署后能加载新版本，不覆盖原有收藏。
- 域名根目录下的 ddli-local-sw.js、local/cache-manifest.js 和 assets 文件返回 JS，不是 HTML 回退页。

## 缓存和回滚
暂不对原版哈希文件名设置一年 immutable：本项目品牌转换可能改变同名文件内容。浏览器离线缓存由带版本的 Service Worker 管理，服务器响应要求重新验证。

回滚时选择上一个已验证部署（或恢复对应 Git 提交后重建）。不要清空用户浏览器数据。数据库迁移不随静态页面回滚自动撤销；若改变数据协议，需要另行验证兼容性。

注意：本地预览和正式域名是不同浏览器存储空间。首次迁移请从本地导出原版 JSON，在正式域名导入后再启用同步。

官方配置参考：https://pages.edgeone.ai/document/edgeone-json

当前文档是部署步骤，不是已成功部署的证明。仍需要正式域名、真实 Supabase 和双设备验收结果。

更新行为已增加本地浏览器验收：新 Service Worker 等待旧标签页全部关闭后激活，旧页面继续使用同一版本的 HTML 和资源。更新就绪时显示提示，关闭全部 DTab 标签页再打开完成切换。该测试覆盖模拟部署切换，不替代正式 EdgeOne 响应头和 CDN 验证。

生产依赖检查命令：pnpm run test:production。它创建独立临时目录，只复制构建所需源码与 package.json、pnpm-lock.yaml、pnpm-workspace.yaml，不复制 .env、node_modules 或旧构建产物；执行 pnpm install --prod --frozen-lockfile 后构建并验证关键输出，最后删除本次临时目录。pnpm 迁移后已在 Windows + Node v22.22.2 下复验通过（devDependencies 跳过，esbuild 构建脚本经 allowBuilds 批准）。Linux 容器验证尝试因 Docker Hub TLS 握手超时中断，尚不能宣称 Linux 云环境验证通过；GitHub CI 已配置相同检查。

账号面板已包含忘记密码、登录后修改密码，以及 PASSWORD_RECOVERY 返回事件的处理。使用 PKCE，重置邮件请在发起请求的同一浏览器打开；Site URL/回调白名单必须包含正式站点根地址。恢复和修改密码期间暂停当前页面的同步，修改完成后请重新登录再启用。已通过模拟 API 的重置请求、密码一致性校验和 updateUser 测试，真实邮件链接完整返回流程待配置后验证。
