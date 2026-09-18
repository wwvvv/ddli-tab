# 2026-09-18 审查修复（PR #3 的独立后续补丁）

基线：`feat/os-v1-m1@09dfa307c0925cf0a43251f96edef001c7cd8871`。
本次为修复分支，不替换 main，不合并原 PR，不执行生产数据库迁移或部署。

## 改动

1. `edgeone.json` 目标 Node 改为 22.22.2，`engines.node` 下限为 22.13.0；CI 从 edgeone.json 读取生产检查版本，避免配置与测试各自写死不同版本。没有升级依赖或改 lockfile。EdgeOne 控制台是否实际采用这个版本仍需实测。
2. transport 将创建时的账号以 `p_expected_owner` 传入 RPC；新增增量 SQL 迁移，先核对该值与 JWT 的 `auth.uid()`，再调用既有写入实现。旧三参数函数撤销客户端执行权限；没有不安全的兼容回退。既有 revision、行锁、payload 校验、RLS 与数据不改写。
3. Service Worker 真正使用 legacy 导航允许列表；保留 index/newtab/popup/console/分享入口，未知导航不再返回旧首页。补齐 `/api/v1` 精确路径；同源放行不影响对 gotab.cn 旧上游的拦截。未改旧文件、缓存版本算法或 Worker 更新生命周期。
4. `OS_E2E_BASE_URL` 真正设置 Playwright 测试目标，只关闭 Next 服务器托管；新增独立 `LEGACY_E2E_BASE_URL`。两者未设置时沿用 3100/4180；校验 HTTP(S) 根地址及端口，拒绝带凭据、路径和查询的地址。
5. 新增 source-level 回归命令 `pnpm run test:review` 并接入 CI；更新既有 transport 契约单测，增加未知导航浏览器回归。test:db 先验证旧迁移基线，再应用新迁移并验证新 RPC 的权限、错配拒绝、幂等、版本冲突和用户隔离。

## 本会话实际验证

源码经 GitHub 连接器取得，修改涉及的既有文件在沙箱逐个核对 Git blob SHA。不是完整克隆，也没有读取用户电脑的工作树或凭据。克隆尝试因 `Could not resolve host: github.com` 失败；未绕过网络限制。

| 检查 | 结果与范围 |
| --- | --- |
| 新增 27 项 source-level suite 对原始基线 | 14 passed / 13 failed，能捕捉原问题；不是原有测试失败数 |
| 同一 suite 对修复后源码 | 27 passed / 0 failed；Linux、Node 22.16.0、显式 native TypeScript stripping |
| 网络、会话和 CacheStorage | 均为 test doubles，不冒充真实 Supabase 或浏览器 |
| 仓库锁定 esbuild/Vitest/全量构建 | 沙箱 not-run；需读取本修复 commit 的 CI，不沿用 PR #3 的历史绿色结果 |
| 新增 SQL 与 Playwright 回归 | 沙箱 not-run；无 Docker 和完整浏览器运行环境，已接入原 CI |
| EdgeOne、真实 JWT/双设备、同域名上线 | not-run；未部署、未改生产数据 |

默认命令使用仓库锁定 esbuild；不允许依赖失败后静默切换编译器。仅在受限源码沙箱验证时显式使用：

```sh
DTAB_REVIEW_TRANSFORM=native node --test scripts/test-review-fixes.mjs
```

完整仓库验收（不要在 CI 设置 native 变量）：

```sh
pnpm install --frozen-lockfile
pnpm run build
pnpm run build:extension
pnpm run build:web
pnpm test
pnpm run test:review
pnpm run test:db
pnpm run test:e2e
pnpm run test:e2e:os
```

本轮单会话顺序实施；无独立模型角色线程；`observed_model=unknown`，不以角色名或自述推断模型切换。

## 数据库与前端发布顺序

本 PR 只提交迁移文件，不代表获准直接对生产执行。授权发布时先备份并在隔离项目验证，再按顺序应用尚未执行的迁移：`202609100001_personal_sync.sql` → `202609180001_sync_owner_guard.sql`，然后发布配套前端。已有项目不得重复初始化或删除快照表。

新迁移执行后旧前端上传会被拒绝，这是有意的 fail-closed 行为；用户应先保留本地备份，再关闭所有 DTab 标签页并重新打开以完成 Worker 更新。新前端遇到漏迁移也会拒绝写入。不得添加旧 RPC fallback 或重新授予旧入口权限以消除报错。真实会话切换、两个相同基础版本账号之间的错配，以及旧客户端拒绝场景仍需测试项目验收。

## 剩余上线门槛与回滚

`build:edge` 仍构建 dist-original，EdgeOne 通配 rewrite 未改造；本 PR 不能证明 Next `/os` 与旧首页已经可在一个域名下上线。真实同域名路由、404、API JSON、旧 Worker 升级、CDN、用户数据保留需单独验收。当前修改也不是对所有静态缓存路径的完整私有媒体审计。

数据库迁移未执行前可整体 revert 本补丁。迁移后前端回滚会停止上传；保留本地队列并前滚修正客户端，不要恢复无归属校验的旧写权限。不要清空用户 localStorage/IndexedDB、删除快照或强制激活 Worker。

## 官方操作依据

- GitHub Git trees API：https://docs.github.com/en/rest/git/trees#create-a-tree
- GitHub Git references API：https://docs.github.com/en/rest/git/refs
- GitHub Pull requests API：https://docs.github.com/en/rest/pulls/pulls#create-a-pull-request

使用基线 tree 创建只包含补丁的新 tree，再创建 commit 和独立分支/PR。保留全部未修改文件，不强推、不写 main。
