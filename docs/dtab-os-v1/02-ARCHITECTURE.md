# DTab OS V1 技术架构

版本：1.0 · 2026-09-16

本文件描述目标实现，不声称依赖已安装或云环境已验收。约束与证据见 [04-AUDIT.md](04-AUDIT.md)，迁移顺序见 [03-MIGRATION.md](03-MIGRATION.md)。

## 1. 技术栈决策

| 层 | 选择 | 使用边界 |
| --- | --- | --- |
| Web 框架 | Next.js 16.x App Router、React 19、TypeScript strict | 主屏幕是客户端应用；公开商店可 SSR；不要把拖拽提交为 Server Action |
| UI | Tailwind CSS 4、shadcn/ui、Lucide React、自有图标/设计 token | 表单/后台复用基础组件；OS 主屏幕自定义设计，不搬 Apple 资产 |
| 动效 | Motion + CSS | 优先 transform/opacity，支持减少动效；不引入多套动画库 |
| 本地数据 | Dexie + IndexedDB | 持久化业务真源，版本化 schema；不订阅 Dexie Cloud |
| 瞬时 UI | Zustand | 编辑模式、当前页、弹层、拖拽态；不重复维护独立业务数据库 |
| 服务端缓存 | TanStack Query | 商品、资料、订单、媒体列表等；与本地桌面库各司其职 |
| 拖拽 | dnd-kit + 自有网格/碰撞规则 | M0 固定一个包/API 世代，不混用不同代文档；不是现成 iOS 布局引擎 |
| 校验 | Zod + 服务端 schema 校验 | JSON、配置、导入与 API 输入共用契约；额外校验 MIME/二进制 |
| 身份/数据库 | Supabase Auth、PostgreSQL、RLS | 保留现有项目方向；schema/RPC 由 SQL migrations 管理 |
| 文件 | 官方 CloudFlare ImgBed | 唯一文件服务，渠道由官方 ImgBed 管理；不做用户 Provider 插件 |
| 部署 | EdgeOne Web + Next.js 适配 + Cloud/Edge Functions | 普通业务用可验证的 Node 路径；边缘仅放轻量逻辑 |
| 开发与测试 | GitHub、pnpm workspace、Vitest、Playwright | 原 npm 工程经原子迁移再换 pnpm；本次文档不改 lockfile |
| 扩展 | Manifest V3 + TypeScript | 保留主动收藏能力，复用受限桥；不运行商店远程代码 |

Next.js 16 是本次查阅时的 Active LTS，但具体补丁、React/TypeScript/Node/pnpm 组合必须在 M0 查询注册表和安全公告后精确锁定。不要盲目沿用聊天中的“16.3.3 就是最新版”，也不要直接安装 canary。官方资料见审查记录 S01–S12。

不引入 Prisma/Drizzle 第二套迁移系统、Redux Saga、Redis、微服务、Electron、生产 Docker/VPS。已有 Docker 只用于本地数据库测试，不等于生产自建数据库。

## 2. 系统边界与一个域名

```text
GitHub 源码与 CI
       |
       v
一个 DTab 主域名 / EdgeOne
  ├─ Next.js 主屏幕、商店、相册、设置、Admin
  ├─ /api/v1/* 业务 API / 身份与权限校验
  └─ /media/* 受控读取或经验证的同域媒体数据通道
          |                         |
          v                         v
   Supabase Auth/PostgreSQL     官方 CloudFlare ImgBed
   桌面/资产归属/商品/权益      文件、目录、处理、存储渠道
```

一个域名指 DTab 页面、管理与业务入口不用拆成多个站点。Supabase/既有 ImgBed 的技术上游地址不是新产品站点；它们仍需可达，不能宣称 DNS 名称不存在。用户不得被要求配置这些地址或存储渠道。

正式路径为 `/`、`/store`、`/gallery`、`/settings`、`/admin`、`/app/[appId]`、`/api/v1/*`、`/media/*`。迁移阶段新 UI 用 `/os/*`；不要在源代码到处写死 `/os`，使用统一 basePath/路由函数。

商业/用户响应不使用公共 ISR。公开商店文案和官方资源可缓存；登录响应、Set-Cookie、相册、订单、管理和私有媒体必须禁止共享缓存。一个 Next.js 应用和一个生产 EdgeOne 项目为目标；预览部署只是部署环境，不建立第二套对外产品。

## 3. 源码组织

```text
apps/
  web/                     Next.js 工程
    app/                   路由与 server/client 边界
    src/desktop/           主屏幕、网格、Dock、文件夹、编辑
    src/system-apps/       store、gallery、settings
    src/features/          catalog、presets、account、admin、media
    src/server/            services、repositories、权限、ImgBed 客户端
    src/sw/                离线壳与升级策略（构建为公共 SW 文件）
  extension/               迁移现有扩展，独立构建
packages/
  contracts/               Zod/TypeScript 纯契约
  desktop-core/            布局、命令、数据转换，不能依赖 DOM
  sync/                    新版同步队列与冲突接口
  ui/                      共享 token 与基础组件
legacy/gotab/              原发布文件与许可证，禁止直接修改
src/local/                原适配层，按迁移阶段维护，不立即删除
supabase/migrations/       增量迁移
supabase/tests/            数据库权限与一致性测试
```

这是目标目录，不要求第一天创建所有空包。模块尚无第二个调用方时可以先留在 apps/web；不要为“架构完整”生成大量没有实现的服务。所有 server-only 密钥模块禁止被客户端包导入。

## 4. 本地模型与数据所有权

### 4.1 分离定义、放置、安装与权益

- Entity：网址、官方应用快捷方式、组件实例或文件夹的定义。
- Placement：一个定义在桌面/Dock/文件夹中的放置位置。
- Installation：用户启用了某个官方商品/应用。
- Entitlement：平台授予的付费权益，不由桌面导入和本地安装记录决定。

同一网址可在桌面与 Dock 各有一条 Placement，编辑同一个 Entity 的名称/图标后同步显示；删除其中一条 Placement 不删除 Entity 或另一条放置。组件各有独立实例 ID。禁止文件夹循环引用。

建议核心契约（示意，实际实现补齐 Zod 校验）：

```ts
type IconRef =
  | { kind: 'builtin'; name: string }
  | { kind: 'favicon'; url: string }
  | { kind: 'asset'; assetId: string }
  | { kind: 'local'; localAssetId: string }
  | { kind: 'emoji'; value: string };

type ShortcutTarget =
  | { kind: 'url'; url: string }
  | { kind: 'app'; appId: string };

type OwnerKey = `guest:${string}` | `user:${string}`;

type DesktopDocumentV2 = {
  schemaVersion: 2;
  desktopId: string;
  entities: Record<string, unknown>; // 实现时替换为明确的 discriminated union
  placements: Record<string, unknown>;
  pages: Array<{ id: string; title: string }>;
  layouts: Record<string, unknown>; // 断点分别记录，不能任意 JSON 不校验
  settings: Record<string, unknown>;
  initializedFrom?: { presetId: string; version: number };
};
```

Zustand 不另存一份持久化全集。命令 → schema/约束校验 → Dexie 事务（业务数据 + outbox）→ 订阅更新 UI；需要乐观渲染时提供写入失败回滚。页面关闭前不能只靠防抖把尚未持久化的内容“赌”到最后。

建议 Dexie stores：desktop_documents、entities、placements、local_assets、outbox、sync_baselines、migration_receipts。按 OwnerKey 分区或独立数据库隔离；避免一份全局 current_user 对象导致旧队列写给新账号。

照片二进制不进入桌面 document/outbox。大图只按明确的本地缓存策略保存，不能把已缓存误报为永久备份。数据库写失败、空间不足/隐私模式、跨 tab 升级阻塞必须有错误界面。

### 4.2 服务端业务表

以下是需要实现的模型，不是直接在生产执行的 SQL。迁移必须增加索引、CHECK、外键、RLS、GRANT/REVOKE 和测试。

| 表/对象 | 最小字段与约束 |
| --- | --- |
| profiles | user_id PK → auth.users、display_name、avatar_asset_id；个人可写字段白名单 |
| user_roles | user_id、role；unique(user_id,role)；仅受信管理路径变更 |
| account_status | user_id、status、disabled_at；服务端/RPC 检查禁用状态 |
| desktop_documents | user_id、desktop_id、schema_version、revision、payload；unique(user_id,desktop_id) |
| sync_receipts | user_id、desktop_id、request_id、payload_hash、result_revision；唯一请求收据 |
| desktop_presets | id、name、active_version_id；发布指针，不覆盖旧版本 |
| desktop_preset_versions | id、preset_id、version、payload、state、published_at；发布版本不可变 |
| products | id、slug unique、kind、app_id/widget_id/theme_id、status、access_policy；仅官方 |
| product_versions | id、product_id、version、min_client_version、release_id、asset_refs；不可把入口设为任意 URL |
| web_resources | id、title、url、icon、category、published；网址库不产生购买权益 |
| user_installations | user_id、product_id、enabled、version_policy；unique(user_id,product_id) |
| entitlements | user_id、feature/product_id、source、valid_from/until、revoked_at；仅服务端授予 |
| media_assets | id、owner_id、visibility、purpose、storage_key、mime、bytes、width/height、status、hash、created_at |
| albums | id、owner_id、title、cover_asset_id；与媒体归属一致 |
| album_items | album_id、asset_id、owner_id、position；unique(album_id,asset_id)，校验双方同 owner |
| media_favorites | user_id、asset_id；unique(user_id,asset_id)，只能收藏可访问资产 |
| upload_sessions | id、owner_id、purpose、expected_size/type、status、expires_at、reserved_bytes、upstream_ref |
| cleanup_jobs | id、asset_id、operation、state、attempts、next_retry_at；失败可追踪 |
| admin_audit_events | actor、action、target、时间、脱敏变化；客户端不可改删 |

使用稳定 DTab assetId，与 ImgBed 返回的实际 storage_key 分离；不要凭 uploadFolder 自行拼接猜测最终文件路径。storage_key 采用返回值正规化后保存，验证主机白名单、路径与预期目录。渠道迁移是否保持 key 取决于上游实际能力，不能无条件承诺零迁移。

media_assets 是 DTab 用户归属、访问控制、计量与引用的业务真源，不能因为 ImgBed 有文件列表就省掉。ImgBed 负责文件本身，不代替用户相簿/收藏/隐私数据库。必要的 mime、size、hash 是业务索引，不是重复建设整个图床。

支付启用时再增加 orders、order_items、payment_events、refunds，金额用最小货币单位整数并保存 currency。价格由服务端商品快照生成，权益来源可追溯。不要先生成无人使用的提现/分账表。

## 5. 云同步协议

现有 `dtab_snapshots` 保留为 legacy 格式，不混入 OS V2。新表与新 RPC 单独版本化；新数据不得写回旧 Redux 全量状态。

V1 使用一份有界桌面 document + 服务端 revision 的乐观并发控制，不立即引入 CRDT。业务 API 采用 `/api/v1/sync/*`，与旧 `/api/*` 拦截逻辑分离。建议新 document 上限 512 KiB UTF-8，超过时拒绝并解释，不能截断；后续按规模再拆文档。

客户端提交 desktopId、baseRevision、requestId、payload。服务端 user_id 来自验证身份；RPC 从 auth.uid() 推导归属。SQL 事务锁定目标文档：检查重复请求的 payload_hash，检查 revision，通过后增加 revision 并写收据；相同 requestId 不同 payload 必须报错。

过期 revision 返回当前云版本与冲突状态，不自动覆盖。基于 last common baseline 按稳定实体 ID 合并不相交变更；同字段修改、删除与修改、相同布局重排进入人工确认。合并函数需要纯函数测试。V1 无法自动合并时优先保留双方，不伪造“无冲突”。

多标签页以数据库租约/版本锁配合 BroadcastChannel 协调单写入者；不能只依赖某浏览器独有 API。账号切换/退出增加 generation fence，在途旧结果不得更新新账号状态。

拉取使用可见页面的有界周期 + 手动刷新 + 网络恢复，后台退避；不要把原来的全量 15 秒轮询不经测量复制到所有客户端。Realtime 不作为 V1 必需组件。

断网可编辑本地桌面，但服务器会员权益、订单及相册不能伪造离线成功。历史备份是额外存储能力；revision 数字本身不等于保存了历史内容。

## 6. Auth、RLS 与后台权限

使用 Supabase Auth 和 @supabase/ssr 的独立 browser/server client 边界；业务请求优先经过 DTab API。单域名是产品入口约束，不意味着浏览器使用标准 Auth SDK 时绝不访问 Supabase 技术域名。M0 记录实际网络路径，不声称已经完成全请求反向代理。

服务端依据当前官方指南验证 JWT claims/用户；不要仅信任 getSession 返回的客户端会话。受保护路由同时检查账号状态；管理员操作读取受信角色，不依赖 user_metadata。Proxy/Middleware 只做入口检查与会话刷新，最终授权必须在 Route Handler/服务函数和数据库执行。

所有暴露表启用 RLS，并显式设置操作 grants；service_role/secret 能绕过 RLS，只在 server-only 模块中使用。普通个人业务优先带用户身份访问，避免全站都用高权限客户端。管理客户端每次调用都必须经过权限与对象归属检查。

最小角色：user、admin。pro/买断/额度属于 entitlement，不是角色。公开商品只允许读取 published 内容；草稿、角色、上传路径与运维信息禁止公开。

关键表要测试跨用户 SELECT/INSERT/UPDATE/DELETE，尤其是修改 owner_id、关联别人的相簿/资产和直接写权益。SQL SECURITY DEFINER 函数必须固定安全 search_path、校验 auth.uid() 与账号状态、限制 EXECUTE，并避免公开任意 SQL/表名参数。

Cookie 写操作校验 Origin/CSRF 策略，使用 HTTPS/SameSite 安全设置。权限变化、账号禁用与登出不能只等待前端刷新；受保护操作要实时拒绝。禁止将带 Set-Cookie 的响应缓存给其他用户。

## 7. 官方应用和商店模型

注册表位于源码中：appId、名称、icon、system、supportedSurfaces、load 函数、requiredFeature。entry 由显式静态映射决定，例如 `gallery: () => import('./gallery/app')`，不从数据库字符串动态 import。

App Registry 定义“能运行什么”；Product 定义“展示什么、如何授权”；Installation 定义“该用户启用了什么”；Placement 定义“图标在哪里”。系统应用已内置不意味着默认占用所有人的 Dock。

官方主题是经过 schema 校验的 token、图标映射与资源引用，禁止任意 script、HTML、远程 CSS @import。用户自定义图标优先于主题自动图标，除非用户主动重置。

V1 只有 native 运行时。未来 sandbox 是新架构阶段，不预实现、不把任意上传脚本作为可信官方应用。单个路径不是浏览器 origin 隔离；开放第三方时必须重新做安全设计，不能仅增加 creator_id 就宣布平台完成。

## 8. 官方 ImgBed 集成

### 8.1 职责

DTab FilesService 负责用户身份、资产归属、文件类型、计量/配额、会话、访问和引用；ImgBedClient 仅封装既有官方 API。底层 R2/S3/Telegram/Discord 等凭据、渠道配置与容量策略由现有 ImgBed 处理，DTab 用户不可设置。

服务端可配置一组官方 uploadChannel/channelName；输入由服务器决定或经过允许列表，不接受客户端指定任意渠道、路径或 token。不要依赖上游默认渠道；不同用途切换策略只有实测后启用。V1 不建设 R2Provider/S3Provider 等多实现抽象。

### 8.2 上传不能无条件穿过函数

审查时 Edge Functions 请求体上限为 1 MB、CPU 200 ms；Cloud Functions 请求/响应体 6 MB、默认时长 30 s、最高 120 s。Next.js 路由的最终适配限制也必须实测，不能把流式传输当成自动绕过体积限制。来源见 S03/S04。

基础链路：

1. `POST /api/v1/media/uploads` 创建会话，校验 owner、purpose、文件声明、额度，原子预占用量并设置到期时间。
2. 浏览器上传到受控 DTab 端点。服务端验证真实文件格式/大小，限制解码像素，生成唯一存储目录，调用 ImgBed。
3. 返回路径经正规化/验证后写入 media_assets；事务提交后才显示云端成功。
4. 文件上传成功而数据库失败：记录可重试会话/孤立文件，不直接丢弃任务；重试不能重复计费/占额。
5. 到期会话释放配额，孤立文件进入幂等清理任务。

首版保守限制：单次二进制目标不超过 4 MiB（图标另有更小限制），还需为 multipart/网关编码留余量，M0/M4 必须测实际经过的完整请求。不能用“普通云函数代理”承诺任意原图、视频或大 ZIP。

大文件提升是后续 gate：ImgBed 分块接口与渠道最小块大小需同时满足每跳上限，尤其 R2/S3 常见最小块约束不能被随意改成 1 MB。临时 Token 的 owner/expiry 不等于一次性、目录范围或字节配额；不得向浏览器下发通用 ImgBed Token。只有证明受限上传能力被真正校验，才能启用直传。否则继续明确限额，不自行增加 VPS 或替换存储。

### 8.3 私有媒体是独立上线门槛

ImgBed 普通 `/file/{path}` 通常无需认证。Supabase RLS 只保护业务行，不能阻止泄露/猜到公开上游地址后的读取。随机文件名、隐藏 URL、Referer/CORS 白名单都不等于私有授权。

发布私有相册前，必须证明：官方 ImgBed 的实际部署能对私人文件禁止匿名读取，只允许受保护的服务端读取；不存在 publicUrl、公开桶、随机图、WebDAV、备用域名或 CDN 旧缓存等旁路。可以评估上游访问模式/受保护管理预览，但不能未经测试把它视为满足条件，更不能把管理 token 暴露给客户端。

读取流程：浏览器请求 `/media/[assetId]` → 认证 + media_assets 归属/状态校验 → 受保护上游读取 → 以正确 MIME/nosniff/private,no-store 响应。禁止把真实上游公开 URL 作为“签名链接”返回；如使用短时令牌，所有可达读取入口必须实际校验它。公开官方壁纸与私人照片分开策略。

私有读取若超过 Node 响应体限制，必须先验证同主域名的受控流式数据通道或 Range 分段链路；不能假设 fetch.pipe 天然支持。未验证之前受相同安全大小上限约束。既有 ImgBed 无法封闭源站时，保持相册云功能关闭，记录阻塞；可继续本地界面开发，不改成公开相册凑进度。

缩略图能力默认可能未开启，且格式/渠道/部署兼容性不同。M0 记录当前处理器与允许尺寸，V1 只使用固定少量尺寸；不自动加 fallback=original 导致长列表意外下载全部原图。缩略图同样需要权限与私有缓存控制。

### 8.4 文件安全与删除

自定义 SVG/HTML/JS 不作为同域可执行资源提供；用户图标只允许经验证的栅格格式。PNG/JPEG/WebP 做文件签名、解码与像素限制；扩展名和 Content-Type 不可信。官方 app 代码不从 ImgBed 加载。SVG/HTML 以后开放前单独审查，不依赖“用户登录了”就信任内容。

DELETE 先校验 owner 和引用，将资产标为不可访问；删除底层文件、变体与缓存的每一步均可重试。清理任务写 PostgreSQL durable 表，由受控调用或管理员操作触发；任务调度器未部署就不能宣称自动定时清理。删除账号时冻结写入、导出/确认、清理文件，不能先 cascade 丢掉唯一 storage_key 使文件永久孤立。

## 9. API 最小契约

默认 JSON 成功为 `{ data, requestId }`；错误为 `{ error: { code, message }, requestId }`。校验失败 400/422，未认证 401，无权限 403，不存在 404，版本冲突 409，超限 413，限流 429，上游故障 502/503。日志脱敏，不记录原图内容、口令、token 或完整私人 URL。

| 端点 | 用途/授权 |
| --- | --- |
| GET /api/v1/catalog | 公开已发布商品/网址，限量分页 |
| GET /api/v1/presets/current | 当前公开预设，不包含草稿或私人资产 |
| POST /api/v1/installations | 用户启用官方商品，服务端核对权益 |
| DELETE /api/v1/installations/[id] | 只操作自己；是否清理数据另行确认 |
| GET /api/v1/sync/desktop | 当前用户文档，private,no-store |
| POST /api/v1/sync/desktop | revision/requestId 受控写入，限制体积 |
| GET/POST /api/v1/albums | 当前用户相簿，分页和输入校验 |
| GET /api/v1/media | 当前用户资产，cursor 分页，不转发图床全库列表 |
| POST /api/v1/media/uploads | 创建受限上传会话 |
| POST /api/v1/media/uploads/[id]/content | 小文件传输，绑定会话 owner 与过期时间 |
| GET/HEAD /media/[assetId] | 权限校验后的文件/缩略图读取 |
| DELETE /api/v1/media/[id] | 所有权 + 状态迁移 + 清理任务 |
| POST /api/v1/admin/presets/[id]/publish | 管理员发布预设的不可变版本 |
| POST /api/v1/admin/products/[id]/publish | 管理员发布可用内容，校验注册表与客户端版本 |

后台字段名称不等于公开 API。普通用户不能通过任意 filters、owner_id、storage_key 操作其他对象。金额、角色、发布状态和额度不可由客户端直接决定。

## 10. 离线与 Service Worker

只缓存公共应用壳、带版本/hash 的静态代码和明确标记可离线的公开资源；不缓存认证、管理、支付、私有媒体响应或 RSC 用户载荷。正式首页离线由无私人服务端数据的离线壳加载 Dexie，不能缓存某个用户 SSR HTML 后给下一个用户。

现有 root SW 会拦截所有 `/api/*`，导航未命中时回退旧 index.html。这是迁移 P0；必须先部署兼容升级、验证更新与多 tab 行为，再接入新路由。新缓存名前缀用 `dtab-os-*`，避免旧 SW 清理规则删除它。精确步骤见迁移方案。

不以 IndexedDB 作为永久备份承诺；支持 storage quota 错误与明确导出。新应用未缓存时离线显示不可用，不能白屏。更新提示应保护尚未保存事务；禁止默认强制刷新所有窗口。

## 11. 部署、配置与环境

M0 必须验证 Next.js 16 + React + Tailwind + Node + EdgeOne 适配。Cloud Function 文档运行时与本地构建 Node 不一定相同；记录实际版本，禁止只在 Node 24 成功就宣称 Node 20 云端可运行。实际 packages/lockfile 是版本真源。

旧 edgeone.json 的静态 dist-original 输出与 `/* → /index.html` 不适合直接用于 Next.js 全栈。新配置要在独立实施提交中按官方适配生成和实测，保留旧配置快照用于回滚。不能把 `npm ci --omit=dev` 原样复制到需要构建依赖的新工程。

环境变量至少分类为：PUBLIC_APP_URL、Supabase 项目 URL/公共 key；server-only 的 Supabase 管理凭据（只在必要管理流程使用）、IMGBED_BASE_URL、上传/删除/读取等最小权限凭据、上传限额、预设/商店开关。实际变量命名在 scaffold 时统一并更新 .env.example，不放真实值。

正式域名、Supabase project ref/region、ImgBed 实际版本/渠道/访问模式、EdgeOne 项目 ID/区域、支付渠道未在本次验证。不要填造假的配置。预览环境默认关闭支付、关闭生产数据写入，使用脱敏数据；新建付费资源或修改生产 DNS/密钥需要单独授权。

数据库变更只新增/扩展，不直接删除旧表。开发/CI 的本地 Supabase/Postgres 测试不得连接生产。部署失败的回滚不仅回代码，还要处理旧 SW 与前向数据兼容。

## 12. 商业化开关与未来扩展

先完成 Product、Installation、Entitlement 边界；paymentEnabled 默认 false。启用真实支付时验签原始回调、校验商户/金额/币种、幂等写 payment_events、事务授予权益、支持退款撤销，前端返回页不作为支付成功依据。

本地纯前端功能无法仅靠前端开关做强授权；持续云能力在服务端检查。用户可导出自己的数据，不能以会员到期锁住本地书签。不得根据未知 AI 成本承诺无限额度。

后续聊天/阅读器/AI 萌宠沿 App Registry 接入；不为了未来功能提前部署消息服务器/模型服务。第三方生态另立规范、隔离和审查阶段，尤其不得在当前单域名下直接运行任意用户 HTML/JS。
