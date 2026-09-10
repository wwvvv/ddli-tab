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
- 安装命令：npm ci --omit=dev
- 构建命令：npm run build:edge
- 输出目录：dist-original
- Node.js：22.11.0

仓库根目录 edgeone.json 已写入上述配置及 SPA 路由回退。官网当前预装版本列表包含 22.11.0；构建已改用 esbuild 移除 TypeScript，不再依赖 Node 24 的实验性 stripTypeScriptTypes。完整类型检查、测试在 Node 24 的 GitHub CI 执行。生产安装只安装构建及运行必需依赖。

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
