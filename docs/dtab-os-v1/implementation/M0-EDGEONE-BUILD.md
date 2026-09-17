# M0 先行完善：EdgeOne 静态构建与产物预检

日期：2026-09-17。基线：`main@5348cc44045eac03f714a8ebabc977e4e760bc28`。
范围：构建安全、产物一致性与 Codex 交接；不是 Next.js /os、完整 M0 或云部署验收。

## 实际完成的代码

- `withStagedOutput` 使用空 staging 目录和排他构建锁，常规编译/校验失败保留旧产物，发布重命名失败尝试恢复旧目录。清理只针对本次创建的目录，不扫整个工作区，不改用户数据。
- 构建继续使用原 esbuild/legacy 流程，不换技术栈、依赖或 lockfile。仅复制公开的 default-template，不复制整个 config；符号链接源/配置拒绝构建。
- 公共 Supabase 配置检查成对字段、公开 key 类型及 HTTPS 根地址，错误不打印字段值。不读取高权限密钥进入浏览器，不把 key 格式正确说成连接成功。
- 产物检查覆盖三份 HTML 入口、bootstrap 与生成模块的常规静态引用、核心缓存清单、缺失文件、链接/敏感文件名，以及构建后增删改。输出确定性的逐文件 SHA-256 清单。
- 新增 `test:deployment`、`check:edge`、`verify:edge`；EdgeOne 构建入口改用 verify:edge。生产依赖检查同时验证该产物，CI 增加测试/检查而不删除原步骤。

检查器面向当前 legacy 输出，不是通用 JavaScript/CSS 分析器或完整秘密扫描器。清单用于完整性核对，不是签名。普通进程异常可恢复，但强杀/断电不保证两个目录与文档报告的崩溃原子切换；恢复失败保留备份及锁供人工处理。

## 与其他工作关系

基于 main 独立开分支；PR #1 的 Service Worker 改动没有合并、覆盖或复制进本提交。两个 PR 都会触及 package.json/CI，后续合并应同时保留 `test:sw` 与新增部署检查，不能用整个旧文件覆盖另一份改动。

不改 legacy/gotab/web、用户桌面、数据库、收费规则、模型设置、现有 rewrite 或云端配置。不新增生产服务器/进程、VPS、Redis、New API 或 Infinite Canvas。Supabase 与 ImgBed 仍是已定托管上游；未来动态鉴权不是纯静态 HTML 可替代的。

## 已执行与未执行

| 检查 | 状态 | 实际范围 |
| --- | --- | --- |
| 5 个复制到当前环境的基线文件 Git blob SHA | passed | build-original、check-production、package、edgeone、CI 与读取内容一致 |
| `npm run test:deployment` | passed | Node 22.16.0 / Linux；64 项、0 失败、0 跳过；真实临时文件系统 + 小型人工产物 fixture |
| 预检 CLI 成功/失败退出码及 JSON | passed | 属于上述 suite，fixture 无 node_modules；云/浏览器字段为 not-run |
| 修改/新增 JS 的 `node --check` | passed | 语法，不等于运行完整构建 |
| `git diff --check` | passed | 当前源码子集的 patch 空白检查 |
| npm 注册表探针 | blocked | `npm view esbuild@0.28.2 version --fetch-timeout=8000 --fetch-retries=0` 返回 EAI_AGAIN；未改依赖规避 |
| 完整 npm ci / build / verify:edge / Vitest / DB / 原 E2E | not-run | 当前是连接器取得的源码子集，不是完整原版资源和锁定依赖环境 |
| 仓库锁定 Prettier / Windows / Node 22.11.0 全流程 | not-run | 不把本环境语法/fixture 结果替代它们 |
| GitHub CI、EdgeOne 预览/正式部署、真实账号/媒体 | not-run | 提交后 CI 状态另在 PR 记录；没有访问用户云控制台 |

64 项测试包括配置成对/密钥脱敏、URL 校验、入口丢失、依赖丢失、缓存重复/不安全路径、清单不执行 JS、敏感文件/符号链接、摘要稳定与漂移、陈旧产物清理、编译失败、发布失败恢复、构建锁/并发、输出路径保护、配置漂移及 staging→manifest→CLI 的小型闭环。它们不生成真实 GoTab UI，也不证明浏览器行为通过。

## 模型线程记录

按 09-MODEL-THREAD-EVIDENCE，不由任务名或 .toml 推断模型：

| 实际线程 | 任务 | 配置目标 | 观察到的模型 | 推理档位 | 证据/状态 |
| --- | --- | --- | --- | --- | --- |
| 当前会话；thread_id 未暴露 | 本轮构建代码和测试 | unknown | unknown | unknown | 无可引用线程级运行元数据；unknown |
| 独立 REVIEW | 未启动 | unknown | unknown | unknown | not-run |

没有声称 Sol/Terra/Astra 分模型执行，也没有自动切换配置。

## Codex 下一步

先保留本地未提交改动，读取 AGENTS 与 09，切到本 PR 工作分支；不要重复重构这些 helpers。完整仓库中运行：

```sh
npm ci
npm run test:deployment
npm run build
npm run check:edge
npm run build:extension
npm test
npm run test:production
npm run test:db
npm run test:e2e
npm run format:check
```

与 PR #1 集成后另跑 `npm run test:sw`，保留它的真实浏览器测试。两份测试都通过后再考虑合并/部署。当前有意保留 legacy SPA catch-all；新路由前需处理 EdgeOne rewrite 与 SW 两层，不把此预检当 `/os` 已上线。

只对已验收的提交在 EdgeOne 导入 GitHub，安装 `npm ci --omit=dev`，构建 `npm run verify:edge`，输出 `dist-original`。本轮未创建项目/改 DNS，未授权实际收费。回滚代码只影响后续构建；已部署 SW、数据库与用户数据不自动回滚。

官方依据（2026-09-17 查阅）：

- https://pages.edgeone.ai/document/edgeone-json — 仓库级 installCommand/buildCommand/outputDirectory/nodeVersion 与 headers。
- https://pages.edgeone.ai/resources/deploy-nextjs-project-to-pages — Git 仓库导入与托管全栈路线。支持框架不代表本库已迁移到该框架。
