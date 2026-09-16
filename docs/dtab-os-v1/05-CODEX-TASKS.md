# DTab OS V1 — 本地 Codex 实施任务

版本：1.0 · 2026-09-16

先阅读本目录 [README](README.md)、[PRD](01-PRD.md)、[技术架构](02-ARCHITECTURE.md)、[迁移方案](03-MIGRATION.md)、[审查记录](04-AUDIT.md)。根 [AGENTS.md](../../AGENTS.md) 是仓库级执行入口。

## 1. 开始前

本次提交是规格，不是已搭好 Next.js 工程。不要运行尚不存在的 pnpm OS 脚本，也不要把目标目录误认为已有文件。

先检查本地未提交修改和当前分支；不得自动覆盖、stash 或 reset 用户工作。干净工作树才更新 main 并建立实施分支；如有未提交修改，在不破坏它们的前提下隔离实施工作。

已存在的基线命令来自当前 package.json：

```sh
git status --short --branch
node --version
npm --version
npm ci
npm run build
npm test
npm run build:extension
npm run test:e2e
npm run test:db
```

最后两项分别需要相应浏览器/Playwright 环境和 Docker/Postgres 测试镜像。按当前配置执行，环境缺失记录 blocked；不得把未运行写成通过。`.env.local` 和平台密钥只读取变量是否存在，不输出其值，不写入报告。

M0 之后才按已验证的迁移方案切到 pnpm workspace；切换提交必须同步处理 scripts、lockfile、CI、部署与教程。

## 2. 阶段总览

| 阶段 | 实施内容 | 主要产出 | 依赖 | 对应验收 |
| --- | --- | --- | --- | --- |
| M0 | 基线复验、依赖/EdgeOne/Auth/ImgBed 探针 | 基线/兼容性报告、脱敏测试证据 | 无 | G01/G03/G04/G05/G06 现状 |
| M1 | Next 源码壳、根 SW 与路径隔离、包管理迁移 | `/os`、注册表、兼容 SW、构建配置 | M0 | G01/G02、A09 |
| M2 | 本地桌面、添加、图标、网格、旧数据转换 | Dexie 模型、纯函数引擎、迁移器 | M1 | A01/A03/A04/A05/A08、G07 |
| M3 | 设置账号、新同步、官方预设与编辑器 | RLS/RPC、同步/恢复、预设版本管理 | M2 | A02/A07/A12、G03/G08 |
| M4 | 官方商店、ImgBed 资产、相册 | 商品/网址、上传/读取/删除、相簿 | M2/M3，媒体 gates | A06/A10/A11、G04/G05/G06 |
| M5 | 管理完善、离线、扩展、发布回滚 | 真实回归报告、切换/回滚产物 | M3/M4 | A09/A13/A14/A15、G09/G11 |
| M5-P | 可选：真实商业收款 | 支付/订单/退款验收 | 明确渠道/价格与授权 | A16/G10 |

M5-P 未通过前 paymentEnabled=false。聊天/阅读器/AI 萌宠/第三方 Creator 不在这些任务里。

## 3. M0 具体任务

### M0-01 保护现有成果

记录开始 commit、分支、工作树状态、原始 baseline 清单。检查 legacy 许可证，记录当前构建产物与 src/local 依赖。将 root SW、根路由 rewrite 和 extension hashed import 列入实际代码风险，不只复制文档结论。

运行基线命令，生成 `implementation/M0-BASELINE.md`。格式包括：命令、环境、日期、passed/failed/blocked/not-run、失败输出摘要、是否为既有问题。报告不能包含生产凭据。

### M0-02 依赖与兼容性

查询 Next.js 16 最新安全稳定补丁及 React/TypeScript/Node/pnpm peer 要求；将候选版本记录为精确值。用最小可丢弃探针验证 Tailwind 4/shadcn、Motion、Dexie、dnd-kit 的实际导入和生产构建。dnd-kit 明确选定一个 API 世代，不混用旧/新包示例。

EdgeOne 使用当前官方 Next.js 全栈适配，不套旧 SPA 输出。验证 SSR/CSR 路由、Route Handler、cookie、body/response 上限和函数运行时。未获可用部署环境时保留 pending，不宣称线上支持已完成。

### M0-03 ImgBed 与身份

从现有官方实例确认版本、上游渠道、认证模式、目录、普通文件公开行为、缩略图开关。只在独立测试目录使用非敏感样本；测试后按明确记录清理。

检查一次上传完整路径，而不仅浏览器到 ImgBed 的直连。测试限额上下边界，不能只测 5 KB 小图后宣布支持原图。

私有相册要验证原图/缩略图、publicUrl、随机图、底层公开桶、别名和缓存的旁路。没有能力封闭就 G05=blocked，相关 UI 不对公众开放；不得偷偷改为公开相册。

### M0 输出要求

`implementation/M0-COMPATIBILITY.md` 必须有版本矩阵、实际平台环境、各 Gate 状态与阻塞原因。M0 可以得出“某些本地工作可继续，某云功能禁止发布”，不要求为了全绿修改产品约束。

## 4. M1 具体任务

- 建立 Next.js App Router 工程、DTab token、公共 UI 和 app registry，先给五个界面提供最小真实导航。
- 修改 legacy SW 的精确允许列表与新路由 passthrough；保留旧脚本 URL 的升级路径，测试旧 SW 已安装的用户。
- 同域 `/os` 与旧 `/` 共存，不把旧 root 直接移到 `/legacy`，不让两套状态同时写旧快照。
- 将旧构建功能保留为显式 legacy scripts，再引入 pnpm workspace；创建单一有效 lockfile并复验 CI/部署。
- App registry 的入口必须静态映射。后台商品数据不能指向任意 JS URL。

建议测试：`tests/os/legacy-sw-compat.spec.ts`、`tests/os/routes.spec.ts`、注册表契约单测。测试路径是待创建交付物，不是已存在。

退出：旧页面与新页面都能打开；新 API 响应为预期 JSON；404 不返回旧 HTML；没有修改 legacy 原资源；测试与回滚记录完整。

## 5. M2 具体任务

- 实现明确的 DesktopEntity、Placement、IconRef、OwnerKey、布局 schema，不把 unknown 当最终生产模型。
- Dexie 事务保存数据与 outbox；Zustand 仅管理瞬时 UI；建立非法引用/重复放置/文件夹循环检测。
- 实现网址/文件夹/组件添加、编辑模式、标准网格、Dock、主题明暗和本地图标选择。
- 为键盘/触摸和窄屏提供移动菜单，避免必须完成复杂拖拽才能使用。
- 制作旧导出 fixtures，覆盖多分组、文件夹、Dock、自定义图标、freeDrag、未知组件、note、非法 URL 和异常字段。
- 实现预览、备份、确定性 ID 映射、幂等 receipt、原子提交、失败保留旧数据。

测试应覆盖：连续刷新、浏览器重开、IndexedDB 配额/事务失败、重复导入、导入中断、未来 schema 拒绝、未知项保留、窗口缩放不污染别的布局。

退出：A01/A03/A04/A05（本地部分）/A08 通过；不能“先把所有旧数据删除再导入”。

## 6. M3 具体任务

- 设置顶部整合账号入口；旧同步入口迁出前给出过渡引导，不双写。
- 增加新的 document/RPC/receipt、权限/账号状态表与 RLS，保持旧 dtab_snapshots 不变。
- 实现 revision 冲突检测、幂等收据、三方合并/冲突暂停、后台退避与账号 generation fence。
- 真实 A/B 账号与双设备验证，不能使用 service_role 掩盖 RLS 错误。
- 实现官方预设草稿/不可变版本/发布指针，复用桌面编辑器但隔离管理员个人数据。
- 新用户初始化必须检查云端已有桌面；空列表不等于未初始化。恢复前备份，不删除相册/权益。

测试应覆盖：同 requestId 同/不同 payload、过期 revision、删除与编辑、两端重排、两个 tab、退出时在途响应、A 切 B 后旧队列、禁用用户、角色篡改和跨用户关联。

退出：G03/G08、A02/A07/A12 通过，真实环境报告与数据库测试一致。

## 7. M4 具体任务

### 商店

提供推荐/应用/组件/主题/游戏/网址。无内容类别可隐藏；先用真实少量官方内容，不填虚假评论/销量。

Product 与 WebResource 分开，安装与摆放分开。原组件盘点表列出可用状态/外部依赖/替代实现；未验收组件不在商店显示可用。主题应用不覆盖用户的个人数据和图标覆盖。

### 媒体与相册

实现 server-only ImgBedClient、资产业务行、上传会话、配额预占、文件签名/像素检查、上传登记幂等、私有读取、列表分页、引用管理、软删除与 cleanup job。

只使用官方渠道，服务端控制 uploadFolder/uploadChannel；记录上游返回的正规化 storage_key，不能信任客户端路径。

失败注入覆盖：上游超时、上传成功但 DB 失败、重复点击、令牌过期、用户越权、删除失败、已删除资产仍缓存、缩略图失败、上游公开旁路。G05 未通过时相册云功能保持关闭。

退出：G04/G05/G06、A06/A10/A11 通过；UI 明确真实上传限制，原图不被静默压缩冒充。

## 8. M5 具体任务

后台完成用户状态、官方内容/预设、系统开关、审计。不得把“管理员检查”只写在前端路由。

扩展新增稳定版本化协议；保持主动采集、最小权限、origin/目标 tab 校验。测试原生扩展安装、授权允许/拒绝、重开弹窗、读取分组、添加与刷新持久化。不要把 CDP 采集成功当全链路成功。

离线只缓存公共壳；测试首次在线后断网刷新、未缓存应用、账户切换、SW 升级/回滚、多 tab、旧版本升级到新版本。

回归视口至少 390/820/1440 CSS px；可见焦点、减少动效、200% 缩放、触屏与键盘。真实 Safari/iPad/iPhone 验证不足应记录，Playwright WebKit 不等于所有真实设备验收。

切换 `/os` 到 `/` 单独提交与部署，不和 schema 大迁移混在一起。上线记录包括环境、commit、回滚产物、数据库备份、SW 策略、错误监控。没有 G11 通过不要开启全量发布。

## 9. 并行边界

M0/M1/契约、Auth/RLS、SW 与迁移主线由一个集成负责人顺序推进。契约稳定后，桌面展示、商店页面、相册页面可并行；它们消费相同契约，不各建一套 user/assets/products。

不允许多个 agent 同时改 package lock、核心 migration、认证中间件、SW 或 desktop schema。每个模块用独立分支/明确文件所有权，合并前复验集成测试。

## 10. 每次提交的完成定义

1. 说明对应任务、实现与未实现范围。
2. typecheck、相关单测、构建和受影响 E2E 有实际结果。
3. DB 改动带 migration、RLS/grants 与越权测试，不能直接手改生产数据库。
4. 没有凭据、真实私人素材、无授权第三方资源进入 Git。
5. 更新 `implementation/` 状态与回滚说明；测试未运行就写 not-run。
6. 删除/重置、收费和生产配置变化不藏在普通 UI 提交中。

不要为了完成任务而把功能开关打开、把失败测试删掉、改成 mock 全成功或跳过权限校验。

## 11. 可直接交给本地 Codex 的指令

```text
请在当前 wwvvv/ddli-tab 仓库实施 DTab OS V1。

先阅读根 AGENTS.md 和 docs/dtab-os-v1/README.md，再完整阅读该目录的 PRD、技术架构、迁移方案、审查记录及任务文档。

本轮先执行 M0：确认工作树状态、保护未提交改动、复验旧版构建/单测/扩展/浏览器/数据库基线，记录准确结果；验证 Next.js 16 路线和 EdgeOne/Supabase/官方 ImgBed 的实际约束。生成 implementation/M0-BASELINE.md 和 M0-COMPATIBILITY.md。

不要一次重写全站，不修改 legacy/gotab/web，不把旧 root 直接搬到 /legacy，不让旧 Service Worker 吞掉 /api/v1，不把公开图床链接当作私人相册。

没有凭据/平台权限的测试准确标为 blocked；可以继续无依赖的本地契约和界面工作，不得声称云端通过。M0 完成后仅继续已经满足前置条件的 M1：建立 /os 源码壳、应用注册表和 SW/路由兼容，保持现有 / 可回滚。

iOS/iPadOS 风格、单一 DTab 主域名、GitHub + EdgeOne + Supabase + 现有官方 CloudFlare ImgBed 是约束。商店只有官方内容；保留网址、用户添加与上传图标；预设由管理员编辑且不覆盖老用户。V1 不开发 Creator/第三方上传/分账/聊天/AI 萌宠，不新增 VPS 或用户自带存储。

分阶段提交代码，报告变更文件、实际测试结果、风险、未验证项与回滚方法。禁止打印或提交任何密钥，禁止未经授权改生产 DNS、付费资源、公开可见性或删除数据。
```

## 12. 设计系统、Skill 与模型补充（2026-09-16）

实施 UI 前读取 [06-DESIGN-SYSTEM.md](06-DESIGN-SYSTEM.md)，并使用 [dtab-ios-design](../../.agents/skills/dtab-ios-design/SKILL.md)；任务分配依照 [07-MODEL-ROUTING.md](07-MODEL-ROUTING.md)。这些补充不改变前面的阶段顺序和安全/迁移 gates。

| 阶段 | 新增检查/交付 |
| --- | --- |
| M0 | 检查本地模型 ID/effort 和 `/skills` 发现结果，实际执行后记录 implementation/M0-MODELS.md。未检查标 not-run，不声称自动路由已生效 |
| M1 | CORE 建立共享 token、基础控件和 Home/Dock/添加的最小浏览器样例；多尺寸/明暗验证后再扩展页面 |
| M2 | 按 Skill 实现/审查 Home、Folder、Widget、图标与添加；布局核心仍由 CORE 单一负责 |
| M3 | 设置与预设编辑保持统一 UI，不能为视觉简洁删除同步冲突、备份或权限说明 |
| M4 | UI 可并行实现商店/相册展示；CORE 保留媒体授权、权益和共享 token 所有权；阶段结束做跨页面一致性审查 |
| M5 | 按 Skill visual-review 清单提交真实截图和交互证据；REVIEW 在正式切换前核对视觉结果与原 A/G gates |

推荐 CORE=Sol High，UI=Sol Medium，REVIEW=Astra 的可用高推理档位；实际名称/可用性与降级规则以 07 文档为准。AGENTS.md 只提供规则，不自行切换模型、不启动不存在的子 agent。

在第 11 节启动指令后可补充：

```text
UI 任务使用 $dtab-ios-design，并读取 06-DESIGN-SYSTEM 和 07-MODEL-ROUTING。
先按当前阶段执行；没有已确认设计稿时按规范制作最小浏览器样例并标待确认。
不要安装外部 iOS/Liquid Glass UI 库，不复制 Apple 字体/图标，不每个页面重新发明 token。
模型与 Skill 在本机实际检查后再记录成功，不能仅因文档存在就认定已启用。
```
