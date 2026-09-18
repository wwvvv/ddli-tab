# M0-COMPATIBILITY — 依赖与平台兼容性报告

生成时间：2026-09-17（Asia/Singapore）。版本一律为 2026-09-17 实际查询 npm registry 的精确返回值（`npm view <pkg> version`），非聊天记忆值。

## 1. 候选版本矩阵（npm registry 实查）

| 包 | registry 最新 | 备注 |
| --- | --- | --- |
| next | **16.3.5** | 16.x 受支持路线最新稳定；Turbopack 默认 |
| react / react-dom | **19.3.0** | Next 16 要求 React 19.2+ |
| tailwindcss / @tailwindcss/postcss | **4.3.3** | v4（CSS-first，`@import "tailwindcss"`） |
| motion | **13.4.0** | `motion/react` 入口 |
| dexie | **4.4.6** | dexie-react-hooks ^1.1.7 |
| @dnd-kit/core | **6.3.1** | 搭配 @dnd-kit/utilities 3.2.2；**固定 core 6.x 世代，不混用新 @dnd-kit/react 包** |
| zod | **4.6.5** | 契约校验 |
| zustand | 5.0.15 | 瞬时 UI 状态 |
| @tanstack/react-query | 5.103.1 | 服务端缓存 |
| @supabase/supabase-js | 2.116.0 | 与仓库现有锁定版本一致 |
| @supabase/ssr | 0.12.7 | browser/server client 分离（M1+ 接入） |
| lucide-react | 1.47.0 | 图标 |
| class-variance-authority / clsx / tailwind-merge | 0.7.1 / 2.1.1 / 3.7.0 | shadcn/ui 组件依赖 |
| typescript | registry 最新 7.0.2；探针实际使用 **5.9.3**（create-next-app ^5 解析值） | 仓库现有 devDeps 已用 7.0.2 且 `tsc --noEmit` 通过；Next 16 官方最低要求 5.1。TS 7 与 Next 16.3.5 的组合留待 M1 脚手架时以实际构建验证，M0 探针按主流组合先行 |

运行时：Node v22.22.2（≥ Next 16 最低要求 20.9.0）；pnpm 未在 M0 安装/迁移（按计划属 M1，切换提交须同步 scripts/lockfile/CI/部署）。

## 2. 最小可丢弃探针（M0-02）

探针位置：`D:\work\tmp\dtab-m0-probe`（**仓库外**，不入 Git、用后即弃）。

内容：Next.js 16.3.5 App Router + React 19.3.0 + TS 5.9.3 strict + Tailwind 4.3.3（`@import "tailwindcss"` + `@tailwindcss/postcss`）+ shadcn 风格 Button（CVA + @radix-ui/react-slot + tailwind-merge/clsx）+ motion/react 动效 + @dnd-kit/core DndContext/useDraggable + Dexie 类定义（含 `typeof indexedDB` SSR 守卫）+ Zod 4.6.5 校验的 Route Handler。

结果（本机实际执行）：

| 验证 | 结果 |
| --- | --- |
| `npm install`（63 packages） | passed |
| `next build`（Turbopack，含 TS 检查与静态页生成） | **passed**（Compiled successfully；`/` 静态预渲染、`/api/health` 动态 Route Handler、`/_not-found`） |
| `next start` 运行时冒烟 `GET /api/health` | **passed**（HTTP 200，`{"data":{"ok":true,"runtime":"node"},"requestId":"m0-probe"}`，符合 02-ARCHITECTURE §9 的 `{ data, requestId }` 响应包装） |
| `GET /` | **passed**（HTTP 200，含探针标题） |

结论：**目标技术组合（Next 16 + React 19 + Tailwind 4 + Motion + Dexie + dnd-kit + Zod + shadcn 依赖）在本机实际导入并完成生产构建与运行时响应**。dnd-kit 已按 05 文档要求固定单一 API 世代（core 6.x），未混用新旧示例。

## 3. 平台环境验证状态

| 平台能力 | 状态 | 说明 |
| --- | --- | --- |
| 本地 Next.js 构建/运行 | **passed** | 见 §2 |
| EdgeOne Next.js 全栈适配（SSR/Route Handler/cookie/body 上限/函数运行时） | **pending** | 本会话无 EdgeOne 部署环境与授权；未做任何云端验证。官方文档约束（S03–S06：Cloud Functions 128MB 包/6MB body/30–120s、Edge Functions 5MB 包/1MB body/200ms CPU）仅作为设计输入，不作为实测结论 |
| 旧 edgeone.json 适配 Next.js | **not attempted** | 现有 `dist-original` + `/* → /index.html` SPA 配置按迁移方案不直接复用；新配置留待 M1 独立提交实测 |
| Supabase Auth/RLS 探针 | **blocked** | 本机无 Supabase 项目凭据；G03 保持 not-run |
| 官方 ImgBed 探针（版本/渠道/Token/缩略图/匿名读取/删除） | **blocked** | 未提供 ImgBed 实例地址与最小权限测试凭据；G04/G05/G06 保持 not-run。私有相册在封闭验证前不对公众开放（R05/R06） |
| 真实部署/DNS/支付 | **blocked** | 无授权，不触碰 |

## 4. Gate 现状（对照 04-AUDIT §4）

| Gate | 本轮状态 |
| --- | --- |
| G01 版本与运行环境 | 部分：本地版本矩阵 + 探针 passed；EdgeOne 云端运行时 pending |
| G02 SW/路由 | not-run（M1） |
| G03 Auth/用户隔离 | not-run（blocked：无凭据） |
| G04 媒体上传 | not-run（blocked：无 ImgBed 环境） |
| G05 私有媒体 | not-run（blocked：无 ImgBed 环境） |
| G06 图像处理 | not-run（blocked：无 ImgBed 环境） |
| G07 数据迁移 / G08 双设备同步 / G09 离线缓存 / G11 发布回滚 | not-run（后续阶段） |
| G10 支付 | disabled（按 08-BILLING，M5-P 且明确授权前保持关闭） |

## 5. 结论与下一步

- 本地可继续的工作：M1 前期无云依赖项——新源码壳契约、桌面数据模型纯函数、UI token 层均可开发；任何涉及 Supabase/ImgBed/EdgeOne 的功能保持关闭且不得宣称通过。
- M0-02/M0-03 未决项：EdgeOne 全栈适配实测（pending）、Supabase 与 ImgBed 探针（blocked，待用户提供环境或授权）。
- 探针目录 `D:\work\tmp\dtab-m0-probe` 为一次性产物，不进入仓库；如需保留证据以本报告与命令输出为准。
