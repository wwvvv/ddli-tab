# M0-BASELINE — 基线复验报告

生成时间：2026-09-17（Asia/Singapore，本机 UTC+8）
执行环境：Windows（win32）本地工作树；非 CI。

## 1. 开始状态

| 项 | 值 |
| --- | --- |
| 仓库 | `wwvvv/ddli-tab`（本地克隆 `D:\work\DTab`） |
| 开始 commit | `5348cc44045eac03f714a8ebabc977e4e760bc28`（远端 main HEAD） |
| 实施分支 | `feat/os-v1-m0`（自 main 干净工作树创建） |
| 开始时工作树 | 0 个未提交条目（干净） |
| git | 2.40.1.windows.1 |
| Node | v22.22.2 |
| npm | 10.9.7 |
| Docker | 29.7.2（本机已安装，供 test:db） |
| 浏览器 | Playwright channel `msedge`（本机 Microsoft Edge，非 CI 配置） |
| 旧远端基线 | `a3f2a2b8510fb8178ab9c0fdd2d65a19585c8a51`（04-AUDIT 审查基线） |

`a3f2a2b..5348cc4` 的 diff 仅含 `AGENTS.md`、`docs/dtab-os-v1/*` 与 `.agents/skills/dtab-ios-design/*`（16 个文件，+2155 行），**无任何运行时代码变更**。因此 04-AUDIT 基于代码的结论对本 HEAD 原样适用。

## 2. 既有成果保护

- 未执行 reset / clean / stash；未修改 `legacy/gotab/web`。
- 本机存在**另一个旧克隆 `D:\work\ddli-tab`**：其 main 分支领先其过期的 origin/main 5 个提交（含 `public-library.ts`、`legacy-cloud-api.ts`、`widget-api.ts`、收款码图片等，约 +3299 行），与当前远端 main 分叉于 `a3f2a2b`。该克隆未做任何改动，保留原样。**需要用户决定这 5 个未推送提交如何与远端 main 合并**；在此之前不在其上继续开发。
- `.env.local` 在本克隆中不存在（fresh clone，该文件不入库）；`.env.example` 仅含 `VITE_SUPABASE_URL`、`VITE_SUPABASE_PUBLISHABLE_KEY` 两个变量名，未发现任何密钥进入工作树。

## 3. 基线命令结果

| 命令 | 结果 | 摘要 |
| --- | --- | --- |
| `npm ci` | **passed** | 64 packages，0 vulnerabilities |
| `npm run build`（tsc --noEmit && build-original） | **passed** | 279 个原版文件复制；local API/bootstrap 编译成功 |
| `npm test`（vitest run） | **passed** | 7 个测试文件 / 50 个测试全部通过，约 2s |
| `npm run build:extension` | **passed** | MV3 扩展输出至 `dist-extension` |
| `npm run test:e2e`（Playwright，msedge，19 项） | **passed（用例层）/ 命令退出码 not-run** | 19/19 用例 ok；随后 worker 收尾挂死（2 次 `worker-0 process did not exit within 300000ms after stop, force-killed it`），等待逾 20 分钟无返回后按环境问题终止，未能取得命令级退出码（见 §5） |
| `npm run test:db` | **blocked** | Docker CLI 已装（29.7.2）但 Docker Desktop 守护进程未运行（`dockerDesktopLinuxEngine` 管道不存在）；启动守护进程后可重跑 |

## 4. 实际代码风险清单（M0-01 要求，逐项对照代码而非转抄文档）

1. **根 Service Worker 宽拦截**：`src/local/service-worker.ts` 对同源全部 `/api/*` 返回本地模拟，并将未命中导航回退到旧 `index.html`。M1 前必须改造为允许列表 + 对 `/api/v1/*`、`/os/*` 放行（对应 G02/A09）。
2. **EdgeOne 通配 rewrite**：`edgeone.json` 将 `/*` → `/index.html`（dist-original 静态输出）。若直接叠加 Next.js 新路由，新 API 的 404 会被吞成 200 HTML。新配置需在独立提交中按官方 Next.js 适配生成并保留旧配置快照回滚。
3. **扩展桥依赖压缩产物**：`src/local/extension-bridge.ts` 依赖旧 hashed bundle 与压缩导出名（04-AUDIT R09/R10 背景事实），新桥需稳定版本化协议（M5 范围）。
4. **旧云端依赖**：组件/在线资源库原属旧服务器，当前接口返回未启用或空列表（README 如实声明）；不得伪造云端成功。

## 5. 待完成与观察项

- `test:e2e`：用例全部通过（19/19，总时长约 80s）；worker/服务器收尾挂死（`worker-0 did not exit within 300000ms`，命令逾 20 分钟不返回）导致退出码未取得。属环境层面问题，后续复跑验证复现条件；不影响「用例通过」这一事实，但命令级结果按 not-run 记录，不得写成全绿。
- `test:db`：blocked（Docker Desktop 守护进程未运行）。启动 Docker Desktop 后重跑 `npm run test:db` 即可补齐，预期覆盖 Supabase 迁移的本地权限测试。
- Supabase / ImgBed / EdgeOne 云端探针 blocked/pending，见 M0-COMPATIBILITY.md §3–§4。
- 本报告不含任何凭据或 `.env` 值。

## 6. 回滚

本阶段未修改任何运行时代码（报告文件为新增文档）。回滚 = 删除 `docs/dtab-os-v1/implementation/` 下 M0 新增报告并回到 main@5348cc4；无数据、SW 或部署影响。
