# M1-IMPLEMENTATION — 实施报告

生成时间：2026-09-17（Asia/Singapore，本机 UTC+8）
执行环境：Windows（win32）本地工作树；非 CI。Node v22.22.2，pnpm 11.7.0，git 2.40.1.windows.1。
实施分支：`feat/os-v1-m1`（自 `feat/os-v1-m0` 切出）。任务依据：[05-CODEX-TASKS.md §4](../05-CODEX-TASKS.md)。

## 1. 提交清单

| Commit | 内容 | 状态 |
| --- | --- | --- |
| `1f5b177` | build(m1): pnpm workspace 迁移 + 脚本复验 + CI/部署/文档 | 已提交 |
| `ccc3fec` | feat(m1): apps/web Next.js 源码壳 + /os registry 导航 + health API + os e2e | 已提交 |
| （本提交） | feat(m1): 根 SW 允许列表（/api/v1/*、/os* passthrough）+ legacy 兼容测试 + 配置调整 | 已提交 |

## 2. Commit A — pnpm workspace 迁移（单一 lockfile，可回滚）

- `package.json`：`packageManager: pnpm@11.7.0`；`dev` 脚本内 `npm run` → `pnpm run`。
- `pnpm-workspace.yaml`（新增）：`packages: [apps/*, packages/*]`；`allowBuilds: { esbuild: true }`。
  - 注意：pnpm 11 **不再读取 package.json 的 `pnpm` 字段**（实测 WARN），构建脚本批准必须写在 `pnpm-workspace.yaml` 的 `allowBuilds`；首次 install 会生成占位模板需人工填 true。
- `pnpm-lock.yaml`（新增，唯一有效 lockfile）；`git rm package-lock.json`。
- 脚本复验（全部 EXIT=0）：

| 命令 | 结果 | 摘要 |
| --- | --- | --- |
| `pnpm install` | passed | esbuild postinstall 获准执行（`.../esbuild@0.28.2 postinstall: Done`） |
| `pnpm run build` | passed | tsc --noEmit + 279 个原版文件复制 |
| `pnpm test` | passed | 7 文件 / 50 用例 |
| `pnpm run build:extension` | passed | dist-extension 输出 |
| `pnpm run test:production` | passed | 临时目录 `pnpm install --prod --frozen-lockfile`（devDependencies 跳过）+ 构建 + 关键输出校验，`Clean production-only build passed under v22.22.2 on win32` |

- `scripts/check-production.mjs`：复制清单 package-lock.json → `pnpm-lock.yaml + pnpm-workspace.yaml`；安装命令 `npm ci --omit=dev` → `pnpm install --prod --frozen-lockfile`。typescript 泄漏检查逻辑不变（--prod 不装 devDeps，检查继续成立）。
- `.github/workflows/checks.yml`：`pnpm/action-setup@b906affcce14559ad1aafd4ab0e942779e9f58b1`（v4，按 SHA 固定，读取 packageManager 字段）+ `cache: pnpm` + `pnpm install --frozen-lockfile`，各步骤命令改 pnpm。
- `edgeone.json`：`installCommand: "npm i -g pnpm@11.7.0 && pnpm install --frozen-lockfile"`，`buildCommand: "pnpm run build:edge"`。**EdgeOne 线上构建验证 pending**（无云端项目凭据，不宣称通过）。
- README 与 `docs/DEPLOY_EDGEONE.md` 安装/构建命令同步为 pnpm，并注明 Windows 复验结果与 Linux 云环境仍未验证。

## 3. Commit B — apps/web Next.js 源码壳

- 技术栈（与 M0-COMPATIBILITY 探针矩阵一致）：next 16.3.5、react/react-dom 19.3.0、tailwindcss 4.3.3 + @tailwindcss/postcss 4.3.3、typescript 5.9.3、zod 4.6.5（registry 契约校验）。
- 结构：
  - `apps/web/src/os/routes.ts` — 统一路由助手（`OS_BASE_PATH='/os'`、`apiV1()`），避免源码散落硬编码 `/os`（02-ARCHITECTURE 要求）。
  - `apps/web/src/os/registry.ts` — 应用注册表：zod schema（id/name/icon/description/system/supportedSurfaces/requiredFeature）+ store/gallery/settings 三个系统应用静态映射（PRD 首套 Dock 预设）；模块加载即 parse，非法定义直接抛错；入口只生成 `/os/<id>` 内部路径，不产生外部 JS URL。
  - `apps/web/src/app/os/page.tsx` — 桌面页：注册表卡片网格 + Dock 导航。
  - `apps/web/src/app/os/[appId]/page.tsx` — 应用占位页：`generateStaticParams` + `dynamicParams=false`，未知 appId 一律 404（M1 退出标准：404 不返回旧 HTML）。
  - `apps/web/src/app/api/v1/health/route.ts` — `force-dynamic`，返回与 M0 探针一致的 envelope `{ data: { ok: true, runtime: 'node' }, requestId }`。
  - `apps/web/src/app/page.tsx` — `/` 重定向 `/os`；layout/globals.css 含明暗双模式最小 DTab token（`--dt-*` CSS 变量）。
- 测试：
  - `apps/web/src/os/registry.test.ts` — 契约单测 5 项（schema 校验、id 唯一 + Dock 预设、三端覆盖、静态映射路径、未知 id）。
  - `tests/os/routes.spec.ts` — e2e 7 项（health envelope、/ 重定向、桌面导航、3 个应用页、404 不含旧壳标识）。
  - 根 `vitest.config.ts` include 扩展 `apps/web/src/**/*.test.ts`；`playwright.config.ts` 加 `testIgnore: ['tests/os/**']`；新增 `playwright.os.config.ts`。
  - 根 package.json 新增脚本：`build:web`、`dev:web`、`typecheck:web`、`test:e2e:os`。
- 验证结果：

| 命令 | 结果 | 摘要 |
| --- | --- | --- |
| `pnpm install`（apps/web 依赖） | passed | +37 包；lockfile 更新 |
| `pnpm test` | passed | 8 文件 / 55 用例（含 registry 5 项） |
| `pnpm run build:web` | passed | 路由表：`/` 静态、`/os` 静态、`/os/[appId]` SSG（store/gallery/settings）、`/api/v1/health` 动态 |
| `pnpm run test:e2e:os` | passed | 10/10（routes 7 + compat 3），12.5s |

## 4. Commit C — 根 SW 允许列表与路径隔离

`src/local/service-worker.ts`（11 行新增，未改动其他 legacy 逻辑）：

1. `isPassthroughPath()`：`/os`、`/os/*`、`/api/v1/*` 在 fetch handler 最前直接 return（不进 handleLocalApi、不进缓存、不用旧 HTML 兜底）。
2. `isLegacyShellPath()`：导航兜底 `cache.match('/index.html')` 仅限 `/`、`/console`、`/s/*`；其余未缓存导航改走网络。
3. SW 脚本 URL 不变（`/ddli-local-sw.js`），CACHE_VERSION 由构建源 hash 自动变化（本次 `c628570b7ce0d59b`），已安装旧 SW 的用户走既有 update 路径。

`tests/os/legacy-sw-compat.spec.ts`（3 项，legacy 4180 服务器 + 真实 SW 注册）：

| 用例 | 结果 | 依据 |
| --- | --- | --- |
| `/api/v1/*` 由网络直连响应，不被本地 API 接管 | passed | 断言 503 + 无 `X-DDLI-Mode` 头（若被接管会是 handleLocalApi 的 501 + local 头） |
| `/os/*` 导航 passthrough，不被旧壳 HTML 吞掉 | passed | `/os/store` 返回 404（改造前会返回 200 旧壳） |
| 旧入口 `/console` 导航仍由旧壳接管 | passed | 200 + title「控制台」（`/console` 是原版 SPA 控制台页，非主页——初版断言误用主页搜索框，已按实际行为修正） |

## 5. 环境问题与处理（本机特有，如实记录）

1. **Playwright webServer 内嵌构建/托管在先、`next start` 就绪探测超时**：`build && start` 与 `start` 两种 webServer 均出现 120s/420s 超时，而手动后台运行同一命令 `Ready in 205ms`、health 200。处理：`playwright.os.config.ts` 支持 `OS_E2E_BASE_URL` 跳过 webServer 托管（本机调试用），CI 未设该变量、仍由 playwright 托管启动。**该超时仅在本机复现，CI Linux 行为待首次运行确认。**
2. **worker teardown 挂死复现**：playwright 托管服务器的运行中 worker 收尾不退出（`did not exit within 300000ms`，与 M0 legacy e2e 相同）。OS_E2E_BASE_URL 外部服务器模式下 10 用例 12.5s 正常退出——挂死与「playwright 托管 next start 子进程」相关。
3. **`.next` 目录删除被安全删除钩子拦截**（trash-failed），曾疑造成构建挂住；后经完整产物校验（BUILD_ID/server/static/prerender-manifest 齐全）与手动运行排除。

## 6. legacy e2e 回归（Commit C 要求）

见 §7 结果表。用例级 19/19 通过；命令级退出码受 §5-2 环境问题影响（详见该行备注）。

## 7. M1 退出标准对照（05 §4）

| 标准 | 结果 |
| --- | --- |
| 旧页面与新页面都能打开 | passed：legacy e2e 19/19（用例层）+ os e2e 10/10 |
| 新 API 响应为预期 JSON | passed：`/api/v1/health` envelope 断言（单测 + e2e + 手动探针三重） |
| 404 不返回旧 HTML | passed：`/os/not-an-app` 404 且不含旧壳标识；`/os/store` 在旧 SW 下 passthrough 404 |
| 没有修改 legacy 原资源 | passed：`legacy/gotab/web` 零改动（git 历史可查）；SW 改动仅在 `src/local/` |
| 测试与回滚记录完整 | 见 §8 |

## 8. 回滚

- Commit A：还原 `package.json`/`checks.yml`/`edgeone.json`/`check-production.mjs`/两份文档，恢复 `package-lock.json`，删除 `pnpm-lock.yaml`/`pnpm-workspace.yaml`；`npm ci` 可直接回到 npm 流程。
- Commit B：删除 `apps/web`、`tests/os/routes.spec.ts`、`playwright.os.config.ts`，还原 vitest/playwright 根配置与 package.json 脚本；`/os` 路由随之消失，legacy 根路径不受影响。
- Commit C：还原 `service-worker.ts` 三处（允许列表函数 + fetch 头部检查 + 导航兜底条件）即回到宽拦截行为；CACHE_VERSION 随源变化，用户浏览器自动更新回旧 SW。
- EdgeOne 尚未按新配置部署；如线上异常，回滚 `edgeone.json` 的 installCommand/buildCommand 即可。

## 9. 未验证项与风险

- **EdgeOne 线上部署**：新 installCommand（全局装 pnpm）未在真实 EdgeOne 构建环境执行过，pending；`edgeone.json` 的 `/* → /index.html` 通配 rewrite 与 Next.js SSR/Functions 的适配是 M1 后独立事项（M0 风险清单第 2 条仍未消除）。
- **GitHub Actions 云端 CI**：checks.yml 重写后未在远端跑过；首次 push 需观察 pnpm/action-setup、`--frozen-lockfile`、两个 e2e job。
- **legacy e2e 命令级退出码**：M0 的 worker teardown 挂死本轮未复现（19 passed, 2.5m 正常返回）；该环境问题是否彻底消除仍需后续多轮观察。
- **test:db**：仍 blocked（Docker Desktop 守护进程未运行），与本轮改动无关。
- **pnpm `--prod` 生产检查**仅在 Windows 复验；Linux 云环境未验证。
- 本报告不含任何凭据或 `.env` 值。
