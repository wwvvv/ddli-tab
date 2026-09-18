# M1 同源路由与旧 Worker 升级验收补充

日期：2026-09-18（Asia/Singapore）。基线：`feat/os-v1-m1@285d4a2dfaf8e62f80235a7c42cea2046353a356`。

## 已完成的分支整合

重新复核 PR #4 全部补丁及 run 35337234383 的逐步骤 success 后，使用 GitHub 原生 PR merge，并校验 expected head SHA，将其合入 `feat/os-v1-m1`。未合入 main，未部署，未执行生产 SQL。数据库归属守卫与旧客户端拒绝写入的发布要求仍见 REVIEW-FIXES-20260918.md。

## 本补丁范围

- 新增 `/api/v1/[[...path]]` Route Handler。尚未实现的 API 路径返回 404 JSON `{ error: { code, message }, requestId }`，不回退 HTML；GET/POST/PUT/PATCH/DELETE/OPTIONS/HEAD 均有明确处理，错误禁止缓存。已存在的具体端点仍优先匹配。不引入登录、支付或私人媒体功能。
- `scripts/migration-origin.mjs` 是仅用于测试的 HTTP 组合器：固定两个 127.0.0.1 上游，在一个浏览器 origin 下提供 legacy 与真实 Next 构建。旧公共文件来自实际 CORE_FILES；新路由、内部资源和未知路径去 Next。它不是生产代理、EdgeOne adapter 或新服务要求。
- 新增 20 项 Node 回归：路由边界、保留响应状态/JSON/查询与请求体、拒绝非回环上游，以及实际 API 错误处理器。
- 新增六项 Playwright 集成测试：无 Worker 的同源路由/API 矩阵；受 Worker 控制后的新应用访问与刷新；未知路由/API 404；真实旧 Worker 的双标签页等待升级；新 precache 失败保留旧版本；访问新壳后的旧首页离线刷新。检查 Next/API 未进入旧缓存。
- 旧 Worker 使用 `git show 5348cc44045eac03f714a8ebabc977e4e760bc28:src/local/service-worker.ts`，先校验 blob `7dc2b6c1c52be9a559de1e16b7bc97bfbc25fa79`，再用仓库锁定 esbuild 转译。CI checkout 保留历史；不拿当前 Worker 改版本号冒充历史升级。
- localStorage 与 IndexedDB 使用明确的非敏感 canary，只证明这些标记经过升级仍保存，不代表所有真实用户数据格式的完整迁移验收。
- 现有根/OS 测试保留；集成测试使用独立配置、独立端口与全新浏览器上下文。未修改 legacy 资源、lockfile、数据库迁移或实际 EdgeOne 配置。

## 提交前实际结果

| 项目 | 结果 |
| --- | --- |
| Linux 沙箱 `node --test scripts/test-migration-origin.mjs` | 20 passed / 0 failed，Node 22.16.0；包含真实回环 HTTP 转发，两个业务上游为显式 test doubles |
| 原修复 `DTAB_REVIEW_TRANSFORM=native node --test scripts/test-review-fixes.mjs` | 27 passed / 0 failed；仍为隔离源码级测试 |
| 新脚本及 TypeScript 测试转译后的语法检查 | passed；不是仓库锁定 TypeScript 全工程检查 |
| 完整构建、新 Route Handler、六项浏览器集成 | 提交前沙箱 not-run；须核对本 PR 自己的 GitHub Actions，不能沿用 PR #4 的历史绿色结果 |
| 本机完整克隆 | blocked：GitHub DNS 解析失败；源码通过连接器和已核验补丁副本处理，无用户本地工作树写入 |
| EdgeOne / 真实 Supabase 双账号双设备 | not-run；没有生产环境操作 |

CI 已接入 `test:origin` 与 `test:e2e:integration`，保留既有构建、生产依赖、单元、数据库、legacy/OS E2E。后续 CI 结果记录在 PR 讨论中，绑定准确 commit/run，不回填没有运行的结果。

```sh
pnpm install --frozen-lockfile
pnpm run build
pnpm run build:extension
pnpm run build:web
pnpm test
pnpm run test:review
pnpm run test:origin
pnpm run test:db
pnpm run test:e2e
pnpm run test:e2e:os
pnpm run test:e2e:integration
```

## 生产门槛仍保留

通过本地/CI 的同源组合不能证明 EdgeOne 的真实路由优先级、CDN、函数 Node、cookie、请求体限制与旧用户升级已经验收。`build:edge` 仍只产生旧静态站，不应把本测试服务器部署为新的生产组件。

本次查阅官方 edgeone.json 文档：平台将精确 `/* -> /index.html` 视为 SPA fallback，已匹配静态资源/函数优先；因此不要泛化为它必定覆盖所有已存在的新函数。但未知路径与未实际输出的 Next 应用仍需验证真实 404。文档仍推荐预装 Node 22.11.0 等版本，其他版本可能失败；仓库目标 22.22.2 与 CI 通过不能证明平台一定提供该环境。

下一项云端验收需要明确的 EdgeOne 测试项目/预览环境和授权的 Supabase 测试项目。凭据仅通过已授权连接器或环境密钥管理配置，不贴到聊天、源码或公开报告。禁止将本地/生产凭据混用；不新建付费服务，不动生产 DNS，不启用支付。

官方参考（2026-09-18 查阅）：
- https://docs.github.com/en/rest/pulls/pulls#merge-a-pull-request
- https://pages.edgeone.ai/document/edgeone-json

## 回滚与模型记录

本补丁不变更数据库/用户数据。可整体撤销本提交来移除集成测试、测试组合器与 API 404 补充；PR #4 的安全修复保留，不恢复旧 RPC 权限。未部署新 Worker，无需清空任何浏览器存储。

同一助手会话顺序执行，未启用独立模型角色线程，observed_model=unknown；CI 日志而非模型名称作为执行证据。
