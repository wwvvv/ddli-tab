# EdgeOne 手动部署 DTab

由用户手动导入 GitHub 项目，不自动创建云项目或购买套餐。

> 2026-09-17 构建补充：Core 不需要自建 VPS；本分支仍部署 legacy 静态版本，不是已经完成 Next.js OS。新增隔离构建和产物预检，构建命令改为 `npm run verify:edge`。下方历史测试记录不代表本次已重跑全量测试。当前执行报告见 [M0-EDGEONE-BUILD.md](dtab-os-v1/implementation/M0-EDGEONE-BUILD.md)。

## 部署前
1. 确认 GitHub main 已包含当前代码，Actions 全部通过。
2. 需要云同步时，创建 Supabase 项目，在 SQL Editor 执行 supabase/migrations/202609100001_personal_sync.sql（一次）。不要执行 tests/local-auth-harness.sql。仅本地桌面可跳过云配置。
3. 配置登录方式与正式邮件 SMTP，并保存 Project URL 和 Publishable key。

## GitHub 导入
在 EdgeOne Pages/Makers 控制台新建项目，授权读取私有仓库 wwvvv/ddli-tab，选择 main。
- 框架：其他/静态站点。
- 根目录：仓库根目录。
- 安装命令：npm ci --omit=dev
- 构建命令：npm run verify:edge
- 输出目录：dist-original
- Node.js：22.11.0

仓库根目录 edgeone.json 已写入上述配置及 SPA 路由回退。官网当前预装版本列表包含 22.11.0；构建已改用 esbuild 移除 TypeScript，不再依赖 Node 24 的实验性 stripTypeScriptTypes。完整类型检查、测试在 Node 24 的 GitHub CI 执行。生产安装只安装构建及运行必需依赖。

环境变量：
- VITE_SUPABASE_URL：项目 HTTPS 根地址。
- VITE_SUPABASE_PUBLISHABLE_KEY：sb_publishable_ 开头的公开密钥。

两个都留空会生成纯本地模式；只填一项或填私密密钥会报错。更改变量后必须重新构建。公开配置会进入浏览器代码，访问控制依赖 Supabase Auth 与 RLS。地址必须是 HTTPS 根地址，不包含账号密码、路径、查询串或 fragment。校验错误不回显密钥值。

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

生产依赖检查命令：npm run test:production。它创建独立临时目录，只复制构建所需源码，不复制 .env、node_modules 或旧构建产物；执行 npm ci --omit=dev 后构建并验证关键输出，最后删除本次临时目录。历史版本已在 Windows + Node 22.11.0 下通过，只有 15 个安装包。Linux 容器验证尝试因 Docker Hub TLS 握手超时中断；这些历史结果不代表本次补丁在 Windows 或 Linux 云环境验证通过。GitHub CI 已配置相同检查，本次增加了产物清单检查。

账号面板已包含忘记密码、登录后修改密码，以及 PASSWORD_RECOVERY 返回事件的处理。使用 PKCE，重置邮件请在发起请求的同一浏览器打开；Site URL/回调白名单必须包含正式站点根地址。恢复和修改密码期间暂停当前页面的同步，修改完成后请重新登录再启用。已通过模拟 API 的重置请求、密码一致性校验和 updateUser 测试，真实邮件链接完整返回流程待配置后验证。

## 新增：无需启动服务的构建与检查

```sh
# 使用完整仓库、受支持的 Node 和网络
npm ci
npm run test:deployment
npm run verify:edge
# CI JSON 摘要；只检查已经构建的文件，不访问线上服务
node scripts/check-deployment.mjs --json
```

`test:deployment` 仅使用 Node 内置模块，不要求 npm 依赖、数据库、浏览器或私密凭据。`verify:edge` 仍需安装构建依赖，它执行真实构建后检查配置、入口、缓存清单和逐文件 SHA-256；不能用小型 fixture 测试代替完整构建。

构建先写 `.dtab-build-*/output`。编译/产物检查通过后才替换 `dist-original`，避免上次构建残留或常规编译失败损坏旧产物。只复制公开的 `config/default-template.json`，不再把整个 config 目录发到浏览器。新增 `artifact-manifest.json` 仅含公开产物路径、大小和摘要，不含环境变量、私密配置或构建机器路径。该清单不是数字签名，也不证明业务功能正确。

并发构建由 `.dtab-build.lock` 拒绝；不会自动抢锁或清理任意旧临时目录。断电/强杀可能留下锁或 `previous-output`：先确认没有运行中的构建并检查恢复目录，再人工恢复/清理。目录替换不是跨进程崩溃原子事务，Windows 文件占用与实际 EdgeOne 构建仍需验收。

预检成功仅表示 **legacy 静态产物/配置检查通过**。`/*` SPA rewrite 仍未改，本分支不修复 SW/新 API 路由；新 `/os` 上线前仍需完成 PR #1 及服务器路由迁移。Cloud Runtime 与浏览器状态始终单独记录，不把预检结果写成云部署通过。

不用自建 VPS 不等于不用云配置。未来账号/私有媒体必须配置并验证 Supabase/官方 ImgBed；商业功能还需要服务端鉴权和经过验收的托管函数，不能把密钥或真实扣费放进浏览器。New API/大型外部应用仍不属于本轮 Core 构建。
