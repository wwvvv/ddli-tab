# DTab OS V1 审查记录与上线门槛

审查日期：2026-09-16（Asia/Singapore）

审查结论：产品方向和选定技术路线可以进入分阶段实施；此前讨论存在需要修正的安全、迁移与部署假设，已落实到 PRD/架构/迁移方案。不是“所有功能和生产环境已验证”。

本次范围：GitHub 仓库只读审查、公开官方文档核对、规格一致性审查和文档交付。没有执行仓库构建/浏览器/数据库测试，没有登录用户的 EdgeOne、Supabase、ImgBed 控制台，没有验证正式域名/支付或修改云配置。

## 1. 必须修正的既有结论

| ID | 原假设/风险 | 修正后的实施决定 | 严重性 |
| --- | --- | --- | --- |
| R01 | Next.js 固定某个补丁号就等于最新版 | 固定 16.x 受支持路线；M0 查询安全公告、注册表与平台适配，精确锁定实际版本 | 高 |
| R02 | 全部运行能力可由一个 Edge Function 完成 | Edge/Cloud Functions 区分；每条 API 记录实际 runtime、体积与时长限制 | 高 |
| R03 | 小文件/原图/大视频统一经云函数代理即可 | 先约束安全小文件，预留 multipart 余量；大文件需单独验证，不能用 stream 绕过配额假设 | 阻塞相关上传 |
| R04 | ImgBed 有目录就能代替用户媒体数据库 | DTab 保留 media_assets 归属、相簿、引用、额度、状态；ImgBed 管文件和渠道 | 高 |
| R05 | 图床 URL 隐藏或加 Referer 就是私人相册 | 必须封闭匿名上游/公开桶/缓存旁路并鉴权读取；无法做到则不开放私有相册 | 阻塞相册 |
| R06 | Token 的 owner/过期时间就等于目录隔离和上传限额 | 文档不支持此推论；禁止向浏览器发通用 ImgBed Token | 阻塞相关直传 |
| R07 | ImgBed 缩略图、Range、渠道能力部署后自动都可用 | 图片处理有开关/格式/部署差异；逐渠道实测；尺寸请求不和 Range 混用 | 高 |
| R08 | ImgBed 自动支持按类型路由、跨渠道迁移/冷热分层 | 只采用文档与当前实例已验证能力；“冷热分层”不是当前承诺 | 中 |
| R09 | 旧发布包可直接搬进 /legacy 或嵌在新壳下 | 根绝对路径、SW 和状态写入耦合；新 /os 并行、先兼容路由/缓存、后显式数据迁移 | 阻塞切换 |
| R10 | 新 /api/v1 无需管旧 API | 现有 SW 拦截全部 /api/*；必须先修复允许列表及导航回退 | 阻塞新 API |
| R11 | IndexedDB/Local First 就代表离线刷新可用 | 另建公共离线壳、版本缓存与升级流程，不缓存私人 SSR/API/媒体响应 | 高 |
| R12 | Middleware 拦一下 /admin 就足够 | 每个服务端写入口验证身份、角色、归属；RLS+grants；service_role 不外泄 | 阻塞后台 |
| R13 | 使用少量通用实体，未来只加 creator_id 就无需返工 | 只预留边界，不保证零返工；未来第三方运行、审核、结算另立项目阶段 | 中 |
| R14 | iOS 风格会自动降低重构量，可完整复用旧引擎 | 设计一致性不等于源码可复用；以当前交付物和可测试模块判断 | 中 |
| R15 | “无限相册”可隐瞒限额、或无需评估成本 | 用连续浏览体验命名；公开实际容量/文件政策，不承诺无限 GB/永久可用 | 高 |
| R16 | 可对任意网站自动抓标题/图标、任意 SVG 同源渲染 | 手动网址使用降级候选；扩展主动采集；用户 SVG V1 不开放，避免 SSRF/XSS | 高 |

## 2. 仓库事实来源

本次基于固定 commit，而非猜测本地有未推送代码：

`a3f2a2b8510fb8178ab9c0fdd2d65a19585c8a51`

| 来源 | 证明的事实 |
| --- | --- |
| [README](https://github.com/wwvvv/ddli-tab/blob/a3f2a2b8510fb8178ab9c0fdd2d65a19585c8a51/README.md) | 发布包 + 适配层；登录/同步/扩展仍有真实验收事项 |
| [构建脚本](https://github.com/wwvvv/ddli-tab/blob/a3f2a2b8510fb8178ab9c0fdd2d65a19585c8a51/scripts/build-original.mjs) | legacy 文件复制与入口替换，不是完整主界面组件构建 |
| [账号面板](https://github.com/wwvvv/ddli-tab/blob/a3f2a2b8510fb8178ab9c0fdd2d65a19585c8a51/src/local/cloud-panel.ts) | 通过旧文本/CSS 和 MutationObserver 挂载 |
| [旧 SW](https://github.com/wwvvv/ddli-tab/blob/a3f2a2b8510fb8178ab9c0fdd2d65a19585c8a51/src/local/service-worker.ts) | 全部 /api/* 拦截、导航回退、旧缓存清理 |
| [EdgeOne 配置](https://github.com/wwvvv/ddli-tab/blob/a3f2a2b8510fb8178ab9c0fdd2d65a19585c8a51/edgeone.json) | dist-original、SPA 通配重写、根 SW scope |
| [扩展桥](https://github.com/wwvvv/ddli-tab/blob/a3f2a2b8510fb8178ab9c0fdd2d65a19585c8a51/src/local/extension-bridge.ts) | 旧 bundle hash/压缩导出依赖 |
| [同步协议](https://github.com/wwvvv/ddli-tab/blob/a3f2a2b8510fb8178ab9c0fdd2d65a19585c8a51/docs/sync-protocol.md) | legacy 2 MiB 快照、revision/RPC 与待联调项 |
| [上线清单](https://github.com/wwvvv/ddli-tab/blob/a3f2a2b8510fb8178ab9c0fdd2d65a19585c8a51/docs/launch-checklist.md) | 旧本地测试记录与未完成环境验证；不是本次测试结果 |
| [package.json](https://github.com/wwvvv/ddli-tab/blob/a3f2a2b8510fb8178ab9c0fdd2d65a19585c8a51/package.json) | 当前仍走原版构建命令；新技术栈没有因此自动安装 |

用户已声明取得 GoTab 二开授权，本方案以此为前提。当前仓库不证明其另有完整源码交付，也不替代第三方资产许可证审查；保留原许可与归属。

## 3. 外部官方资料（2026-09-16 查阅）

规格采用以下公开资料约束实现；资料描述的是官方产品能力，不等于用户的实例配置。

| ID | 官方资料 | 本方案使用的结论 |
| --- | --- | --- |
| S01 | [Next.js Support Policy](https://nextjs.org/support-policy) | 查阅时 16.x Active LTS；生产不采用 canary |
| S02 | [Next.js Security](https://nextjs.org/blog/tag/security) | 精确依赖需核对安全补丁，不能锁定聊天里的“最新版” |
| S03 | [EdgeOne Cloud Functions](https://pages.edgeone.ai/document/cloud-functions) | 文档：128 MB 包、6 MB 请求/响应体、默认 30 s/最高 120 s、默认 Node 20；以实际适配和套餐验证为准 |
| S04 | [EdgeOne Edge Functions](https://pages.edgeone.ai/document/edge-functions) | 文档：5 MB 包、1 MB 请求体、200 ms CPU，不适合大文件处理 |
| S05 | [EdgeOne Next.js 部署指南](https://pages.edgeone.ai/resources/deploy-nextjs-project-to-pages) | 支持 Next.js 全栈功能，但旧 SPA 构建配置不能直接照搬 |
| S06 | [EdgeOne Node Functions](https://pages.edgeone.ai/document/node-functions) | Node 服务路径和普通边缘路径需要区分并实测 |
| S07 | [Supabase SSR Client](https://supabase.com/docs/guides/auth/server-side/creating-a-client?queryGroups=framework&framework=nextjs) | browser/server client 分离；服务端验证身份，不能只信 getSession |
| S08 | [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) | 行权限与 grants 都要设置；高权限密钥可绕过 RLS，必须限制使用 |
| S09 | [ImgBed API](https://cfbed.sanyue.de/api/) | 上传/读取/删除/列表与 Token 能力；普通文件通常无需认证 |
| S10 | [ImgBed Upload](https://cfbed.sanyue.de/api/upload.html) | 支持官方渠道参数、返回 src、普通/分块流程；分块大小有渠道要求 |
| S11 | [ImgBed Read](https://cfbed.sanyue.de/api/file.html) | 缩略图默认开关/格式差异；Range 与尺寸参数不能同用；实际渠道兼容性需测 |
| S12 | [ImgBed Token](https://cfbed.sanyue.de/api/token.html) | permissions/owner/expiry 文档不等于用户目录授权或一次性限额票据 |
| S13 | [ImgBed Features](https://cfbed.sanyue.de/guide/features.html) | 文件和多渠道能力可复用，不证明自动冷热分层或私有多租户系统 |
| S14 | [Next.js PWA](https://nextjs.org/docs/app/guides/progressive-web-apps) | 离线需要另外设计 SW/缓存，不能仅凭 IndexedDB 承诺 |
| S15 | [dnd-kit](https://dndkit.com/) | 用于拖拽能力；包世代与 API 在实施时锁定 |
| S16 | [Dexie React](https://dexie.org/docs/Tutorial/React) | IndexedDB 的 React 接入与本地持久化 |
| S17 | [shadcn/ui Next](https://ui.shadcn.com/docs/installation/next) | 新工程基础 UI 接入，不等于自动生成 iOS 主屏幕 |

Next.js 框架专项页面在本次直读时出现超时，因此部署能力同时核对了官方部署指南与 Cloud/Node Functions 文档；仍须实际项目验证。没有把官网 marketing 文案视为 SLA、生产性能或无限免费承诺。

## 4. Gate 清单

| Gate | 要验证什么 | 通过标准 | 当前状态 |
| --- | --- | --- | --- |
| G01 | 版本与运行环境 | lockfile、peer dependencies、构建 Node 与服务 Node、平台适配均有实测结果 | not-run |
| G02 | SW/路由 | 老用户现有 SW 升级后新路由/API 正常，未知 API 不返回旧 HTML，能回滚 | not-run |
| G03 | Auth/用户隔离 | 真账号登录/刷新/退出、A/B 两用户所有业务读写隔离 | not-run |
| G04 | 媒体上传 | 完整请求体/响应体边界、失败重试、配额预占/释放、实际渠道成功 | not-run |
| G05 | 私有媒体 | 原链接/别名/CDN/桶/随机图等旁路都不能匿名读；用户跨账号不能访问 | not-run |
| G06 | 图像处理 | 实际部署开关、允许尺寸、格式、失败行为与私有缩略图验证 | not-run |
| G07 | 数据迁移 | 代表性旧数据转换幂等，未知项保留，云/本地不互相覆盖，原备份有效 | not-run |
| G08 | 双设备同步 | 并发冲突、删除、离线重试、换账号、重复请求、旧队列阻断 | not-run |
| G09 | 离线与缓存 | 缓存壳可离线启动；私人会话/媒体不进入共享缓存，升级不白屏 | not-run |
| G10 | 支付（启用时） | 验签、金额/币种、幂等、退款与真实环境验证 | disabled |
| G11 | 发布与回滚 | 生产配置、数据库备份、恢复、监控、旧 SW 与前向数据兼容演练 | not-run |

文档审查不填充 gate 成绩。M0/M1 等阶段由实施者更新独立 implementation 报告，附命令、输出摘要、运行环境、日期与证据。凭据缺失标记 blocked，不编造成功截图。

## 5. 一域名与无 VPS 的最终结论

保留“GitHub + EdgeOne + Supabase + 现有官方 ImgBed”方向，无需为文档阶段新增 VPS。V1 仅官方应用也降低了不可信代码的范围。

但“暂不引入 VPS”不是“任何大小/任何场景都已被这套服务无条件承接”。尤其 G04/G05/G06 必须先通过。失败时先在当前架构内排查可验证的配置/受控数据通道，保持功能关闭；架构超出既定约束时提交决策记录，不擅自购买服务器或更换存储。

## 6. 本次交付状态

完成的是：产品边界收敛、技术方案审查、风险修正、任务与验收规范。未完成的是：OS 功能代码、真实部署和上述 gates。

只新增文档及仓库级 Codex 指引；不会把当前 legacy 版本标为 DTab OS V1 已实现。原 README 的运行说明继续有效，直到对应代码迁移提交正式改变它。
