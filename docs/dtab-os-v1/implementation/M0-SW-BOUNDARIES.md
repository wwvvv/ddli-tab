# M0 先行修复：Legacy Service Worker 的 OS 路由与缓存边界

日期：2026-09-16。起点：`8821f43d2a24e3f3698896fafa11e1c3d56cfd62`。
状态：代码与针对性测试已编写；源代码级验证通过；完整项目/浏览器/生产验收未通过，不合并上线。

## 本轮范围

这是 M0 盘点后可独立验证的一项修复，不是 M0 全部完成或 M1 新壳完成。没有部署 `/os`、账号服务、支付或 AI，没有改 GoTab 原始资源、数据格式、用户预设、数据库、云配置和模型选择规则。

读取了当前 AGENTS、worker/API/bootstrap、构建/预览脚本、package、现有 API 测试、Vitest/Playwright 配置和 CI。此环境是通过连接器取得的源码子集，不是完整本地仓库；没有读取或修改用户电脑的未提交文件。基础文件复制到测试环境后，核对 Git blob SHA：

- `src/local/service-worker.ts` 原始：`7dc2b6c1c52be9a559de1e16b7bc97bfbc25fa79`。
- 未改动 `api.ts`：`8478f4ccdb8362292c574408c6fad039c8a12eff`。
- 未改动 `site-settings.ts`：`c56381e4ef20b1840091968897eb07507153ad28`。
- 未改动 `cache-manifest.ts` 类型占位：`aeb4358880dc351535a7f260513f2ec9610a7416`。

## 改动

1. 同源 `/api/v1`、`/os`、`/_next`、`/auth`、`/admin`、`/media`、`/store`、`/gallery`、`/settings`、`/app`、`/apps`、`/launch` 及其子路径不进入旧接口模拟或旧缓存；按路径段匹配，识别编码等价路径。
2. 只有明确的 legacy 页面映射到旧入口：`/`、`/index.html`、`/newtab.html`、`/popup.html`、`/console[/]`、`/s/*`。其余导航留给服务器，不能一律回退旧 index。
3. 静态缓存由“目录前缀”收紧到“构建清单内的公共文件 + 原静态路径范围”，不缓存查询参数变体；带 Authorization/Range/RSC 等请求绕过共享缓存。
4. 运行时不写入 private/no-store/no-cache、Vary:*、重定向、非 200 或 HTML 响应；导航网络响应从不写入旧缓存。此策略不是通用私有资源鉴权，也不能替代服务器授权/缓存配置。
5. CacheStorage 打开/读取/写入失败不再丢弃成功的网络响应。普通 no-cache/reload 刷新仍对已知 legacy 文件使用安装版本，保留离线刷新；显式 no-store 不读写旧缓存。
6. 保留原 SW 脚本地址、安装失败拒绝激活、等待旧标签页关闭的更新机制和原缓存清理范围，不引入 skipWaiting/强刷，不删除新 OS 或其他应用的缓存。

同源非 v1 的旧 `/api/*` 仍保留原本地兼容行为，gotab.cn 旧 API 仍不发往已停用上游。本轮**尚未完成逐条 legacy API 允许列表**；不要因此在 `/api/v1` 以外新增云 API。独立 namespace 防护不是整个渐进迁移完成。

## 可运行测试

新增 `npm run test:sw`，执行 `scripts/test-service-worker.mjs` 的 63 项 Node 单元测试。测试将真实 worker 源码转译后注册 fetch/install/activate handler，网络、CacheStorage 和 local API 为明确的 test doubles。CI 默认用仓库锁定的 esbuild，不新增依赖、不改变 lockfile；显式 native 模式仅用于受限环境的源码级验证。

新增 `tests/service-worker-boundaries.spec.ts`，在真实 legacy 构建上测试 v1 请求、未知导航、缓存 canary 和离线刷新。文件会被既有 Playwright 配置发现；这些浏览器用例本轮没有执行成功。

正常完整仓库的验证顺序：

```sh
npm ci
npm run build
npm run build:extension
npm test
npm run test:sw
npm run test:db
npm run test:e2e
```

既有 CI 只增加一条 `npm run test:sw`，不删除/跳过原有构建、数据库或 E2E 步骤，不修改权限。

## 实际结果，不等同于全站通过

| 检查 | 结果 | 证据/限制 |
| --- | --- | --- |
| 新建 63 项 suite 对原始 worker | 已复现回归 | 21 通过 / 42 失败。这是新测试验证旧问题，不是声称原有 Vitest 有 42 个失败 |
| 新建 63 项 suite 对修改后 worker | passed | Node 22.16.0，显式 native TS stripping：63 通过 / 0 失败 |
| Worker 及原始 API/配置依赖的隔离严格类型检查 | passed | 本环境 TypeScript 5.8.3、ES2022/WebWorker；不等同仓库锁定的 TypeScript 7.0.2 全工程检查 |
| Node 测试脚本语法检查 | passed | `node --check scripts/test-service-worker.mjs` |
| npm 注册表可达性探针 | blocked | `npm view vitest@5.0.0 version --fetch-timeout=10000 --fetch-retries=0` 返回 EAI_AGAIN；未据此更改依赖版本 |
| 完整 npm ci / build / Vitest / DB / 格式检查 | not-run | 源码子集环境，无完整安装，不能把上述局部测试当作全量基线 |
| Chromium 最小真实 SW 烟测 | blocked | 使用本机 Chromium/Playwright 时，首次 localhost 导航报 ERR_BLOCKED_BY_ADMINISTRATOR；未开始执行 SW 场景，没有规避该环境策略 |
| 本轮新增 Playwright 4 项 | not-run | 需要完整构建及可用浏览器，保留为合并前要求 |
| 起点 main 的既有 GitHub CI | 已观察 failure | [run 35067292729](https://github.com/wwvvv/ddli-tab/actions/runs/35067292729)，job 104700371803 无可用步骤/日志（日志读取 404）；不猜测计费/配额/代码等原因 |
| EdgeOne/真实账号/双设备/私有媒体/支付 | not-run | 本轮不涉及这些部署或凭据，不改变任何原 A/G/B gate |

源码级测试命令（仅显式离线模式）：

```sh
DTAB_SW_TEST_TRANSFORM=native npm run test:sw
```

原样 native 与 esbuild 模式运行同一套断言；本轮没有运行锁定 esbuild 模式。不得将 native 模式写入 CI 来掩盖依赖安装问题。

## 合并前与下一阶段

在完整分支上重新执行原有全量基线、esbuild 版本的 test:sw、新增浏览器回归和格式检查，读取 PR CI 实际状态。浏览器需额外验证已安装旧 SW 的升级、多标签页等待、离线重开以及取消更新；单元测试的 activate callback 不能证明真实浏览器生命周期全部正确。

EdgeOne 的全路径 SPA rewrite 仍未修改。worker 放行不代表服务器已经能提供新路由；发布 `/os` 前必须按 M1 改造并验证服务器路由顺序、API 404/JSON、静态资源和 SW 升级。不能将本次修复当作新 OS 可上线。

建议保持草稿 PR，不修改 main。无数据库或用户数据迁移，代码回滚可撤销本提交；已部署过的 SW 仍需正常更新/关闭旧标签页，不能仅回滚 Git 就声称用户浏览器立刻恢复。不要清空用户 IndexedDB/localStorage，也不要删除全 origin 的缓存。

参考：[Service Workers](https://www.w3.org/TR/service-workers/) 的 FetchEvent/Cache 生命周期、[Fetch Standard](https://fetch.spec.whatwg.org/) 的请求缓存语义。浏览器 HTTP cache 与 CacheStorage 是不同层，本项目对明确公共 legacy 资源保留版本锁定，而不是假设 HTTP Cache-Control 会自动约束 CacheStorage。
