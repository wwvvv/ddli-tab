# DTab OS V1 — 实施文档入口

版本：1.1 · 更新日期：2026-09-16（Asia/Singapore）

> 本目录是新的实施目标，不是已完成功能清单。文档审查允许进入分阶段开发；真实部署、私有媒体、双设备同步等门槛尚未通过，不代表现在可直接商用上线。

## 阅读顺序

| 文件 | 用途 |
| --- | --- |
| [01-PRD.md](01-PRD.md) | 产品范围、五个核心界面、用户流程、验收标准 |
| [02-ARCHITECTURE.md](02-ARCHITECTURE.md) | 技术栈、数据模型、API、权限、媒体、离线与部署边界 |
| [03-MIGRATION.md](03-MIGRATION.md) | GoTab 基线保护、Service Worker 迁移、数据转换、切换及回滚 |
| [04-AUDIT.md](04-AUDIT.md) | 对此前讨论的修正、官方资料、实测门槛与尚未验证事项 |
| [05-CODEX-TASKS.md](05-CODEX-TASKS.md) | 本地 Codex 任务顺序、交付物、检查表及可复制实施指令 |
| [06-DESIGN-SYSTEM.md](06-DESIGN-SYSTEM.md) | DTab 视觉 token、五界面合同、材质/动效、响应式、可访问性及参考来源 |
| [07-MODEL-ROUTING.md](07-MODEL-ROUTING.md) | 桌面截图证据、Astra/Sol/Terra 分工、档位待验证项、委派与交接 |
| [dtab-ios-design Skill](../../.agents/skills/dtab-ios-design/SKILL.md) | 仓库专用设计技能，按任务读取组件、动效和视觉验收规范 |

## 已确认的产品决策

- 产品是 iOS/iPadOS 交互取向的网页版 OS，不是 Windows/安卓桌面，也不是给旧导航页加皮肤。视觉资产与品牌由 DTab 自己设计。
- 只使用一个 DTab 主域名，通过路径提供桌面、商店、相册、设置与管理后台。供应商原始服务地址不等于新增产品域名。
- GitHub 管源码；EdgeOne 管 Web 与受支持的 API 运行环境；Supabase 管 Auth、PostgreSQL、RLS 与业务数据；现有官方 CloudFlare ImgBed 管媒体和底层存储渠道。
- 不更换成 Firebase，不建设新的图床，不允许用户自带 S3/WebDAV/OSS 等存储；不把 VPS、Redis、自建数据库或微服务设为 V1 前提。
- 商店只由官方维护。V1 不提供创作者注册、作品上传、任意远程代码运行、审核分账或提现。
- 保留网址快捷方式、添加组件与文件夹，以及用户上传图标。用户上传自己的照片/图标不等于向商店投稿。
- 默认 Dock 预装商店、相册、设置；管理员可维护预设桌面，发布只影响新用户。老用户不会被自动覆盖。
- 聊天、阅读器、AI 萌宠、复杂游戏与创作者平台是后续模块，不伪装成 V1 已交付能力。

## 技术选择摘要

Next.js 16.x App Router + React 19 + TypeScript；Tailwind CSS 4 + shadcn/ui；Motion；Zustand；TanStack Query；Dexie/IndexedDB；dnd-kit；Supabase Auth/PostgreSQL/RLS；CloudFlare ImgBed；EdgeOne；GitHub Actions；Vitest/Playwright；pnpm workspace（迁移阶段引入）。

锁定的是技术路线，不是未经验证的精确版本。M0 必须记录实际安装版本、lockfile、Node 运行时、EdgeOne 构建/运行结果；不要把讨论中的某个补丁号当作永久最新版。

## 现有工程基线

审查基于 `main@a3f2a2b8510fb8178ab9c0fdd2d65a19585c8a51`。现有工程仍是 GoTab 发布文件 + TypeScript 适配层，生产构建并非完整 React 组件源码重建。新工程要保留其数据、测试与行为参考，但不能声称压缩发布包已成为可复用的源码引擎。

本次文档提交不修改现有业务代码、依赖、数据库迁移、密钥或生产部署配置。仓库原有 README 与旧部署文档继续说明旧版本；OS V1 新增开发以本目录为准。

## 先执行什么

先执行 [M0：基线与兼容性验证](05-CODEX-TASKS.md)，再创建新源码壳层。M0 未解决的基础设施问题应准确记录；可继续不依赖它的本地界面与纯函数开发，但不得跳过门槛上线。

任何阶段必须满足：能构建、能验证、不丢旧数据、能回滚。先建立一个小闭环，不允许一次性重写全站。

## 设计技能与桌面模型补充（2026-09-16）

设计任务可在支持的本地 Codex 中用 `/skills` 查找，或显式写 `$dtab-ios-design`。仓库使用官方当前的 `.agents/skills` 发现位置，不重复维护 `.codex/skills` 副本；拉取文件不等于已经验证用户本机加载。

用户使用 ChatGPT 桌面版。最新分工是 **Astra 规划/审查、Sol 核心/集成、Terra 中实现契约明确后的页面**，替代旧版“Sol Medium 默认做 UI”的规则。详细角色、M0–M5/M5-P 分配、实际档位和降级规则统一见 07 文档。

用户截图已显示 **Sol 中、Astra 轻度、Terra 中**，底部当前选择是 Terra 中；这是选择器证据。高档位、每个模型的实际运行、分模型子 agent、Skill 触发和客户端版本仍待本机验证。没有把截图复制进仓库，也没有预填 M0 本机测试通过。

官方已支持子 agent 的分模型/推理配置，但本次只更新规则，不安装活动 config.toml 或自定义 agent。AGENTS/Skill 不直接改变当前主会话模型；实际委派必须由支持的运行工具完成并留下可观察证据。不能证明并行隔离时顺序交接，不假装已自动切换。

文档与设计补充未安装外部 iOS/Liquid Glass 依赖，未生成或批准 OS 设计稿，也未运行前端视觉测试。M0 检查技能/模型实际能力，M1 建 token 与最小浏览器样例，后续阶段按 UI 检查表验收。本地已有实施进度时先核对再继续，不因更新模型规则重做或覆盖已完成阶段。
