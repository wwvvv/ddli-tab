# DTab OS V1 — 实施文档入口

版本：1.3 · 更新日期：2026-09-17（Asia/Singapore）

> 本目录是新的实施目标，不是已完成功能清单。文档审查允许进入分阶段开发；真实部署、私有媒体、双设备同步等门槛尚未通过，不代表现在可直接商用上线。

## 阅读顺序

| 文件 | 用途 |
| --- | --- |
| [01-PRD.md](01-PRD.md) | 产品范围、五个核心界面、用户流程、验收标准 |
| [02-ARCHITECTURE.md](02-ARCHITECTURE.md) | 技术栈、数据模型、API、权限、媒体、离线与部署边界 |
| [03-MIGRATION.md](03-MIGRATION.md) | GoTab 基线保护、Service Worker 迁移、数据转换、切换及回滚 |
| [04-AUDIT.md](04-AUDIT.md) | 原始架构审查、官方资料、实测门槛与尚未验证事项；本轮计费补充见 08 |
| [05-CODEX-TASKS.md](05-CODEX-TASKS.md) | 本地 Codex 任务顺序、交付物、检查表及可复制实施指令 |
| [06-DESIGN-SYSTEM.md](06-DESIGN-SYSTEM.md) | DTab 视觉 token、五界面合同、材质/动效、响应式、可访问性及参考来源 |
| [07-MODEL-ROUTING.md](07-MODEL-ROUTING.md) | Astra/Sol/Terra 的角色分工、风险升级、委派与交接 |
| [08-BILLING.md](08-BILLING.md) | 一个会员、每日重置积分、积分包、操作收费边界、New API 适配与计费验收 |
| [09-MODEL-THREAD-EVIDENCE.md](09-MODEL-THREAD-EVIDENCE.md) | 按实际角色线程记录模型；禁止用任务名、角色名或 `.toml` 配置推断切换成功 |
| [dtab-ios-design Skill](../../.agents/skills/dtab-ios-design/SKILL.md) | 仓库专用设计技能，按任务读取组件、动效和视觉验收规范 |

## 已确认的产品决策

- 产品是 iOS/iPadOS 交互取向的网页版 OS，不是 Windows/安卓桌面，也不是给旧导航页加皮肤。视觉资产与品牌由 DTab 自己设计。
- DTab Core 使用一个主域名，通过路径提供桌面、商店、相册、设置与管理后台。未来大型官方独立应用允许自定义域名、新窗口/标签页及独立部署；不强制嵌入桌面，也不将它们塞入 V1。
- GitHub 管源码；EdgeOne 管 Core 的 Web 与受支持的 API 运行环境；Supabase 管 Auth、PostgreSQL、RLS 与业务数据；现有官方 CloudFlare ImgBed 管媒体和底层存储渠道。
- 不更换成 Firebase，不建设新的图床，不允许用户自带 S3/WebDAV/OSS 等存储；不把 VPS、Redis、自建数据库或微服务设为 Core V1 前提。未来 New API/大型应用的独立运行环境单独验证。
- 商店只由官方维护。V1 不提供创作者注册、作品上传、任意远程代码运行、审核分账或提现。
- 保留网址快捷方式、添加组件与文件夹，以及用户上传图标。用户上传自己的照片/图标不等于向商店投稿。
- 默认 Dock 预装商店、相册、设置；管理员可维护预设桌面，发布只影响新用户。老用户不会被自动覆盖。
- 聊天、阅读器、AI 萌宠、复杂游戏与创作者平台是后续模块，不伪装成 V1 已交付能力。
- 初期收费统一为“免费使用 + 一个 DTab 会员 + 积分包”。不做 Max、每应用会员或主题/工具单品买断。普通会员工具不扣积分；有明确按次成本的 AI/API 操作使用积分。
- 普通已登录用户和会员都有每日额度，会员更多；每日重置、不累计、不要求签到。购买积分不参与每日清零、不因会员到期消失；普通用户也能购买积分使用可用 AI。
- 后续 AI 计量/扣费优先复用 New API 原版，DTab 管商品、订单、权益、适配和对账，不维护第二套 AI 余额。大型应用基础工作区不默认加一道会员门槛。

## 收费方案的优先级与实施范围

[08-BILLING.md](08-BILLING.md) 是本次用户确认后的唯一初期收费口径，取代历史讨论里的 Free/Pro/Max、月度额度池、恢复累积、活动奖励和单品买断提案。普通账号并不是一个收费套餐；月付/年付也不是两个会员等级。

商店负责发现和启用内容，收费发生在已列明的会员功能或积分操作上。按功能成本划分，不把整个“去水印”或“AI Studio”应用一刀切为会员无限用/先买会员才可充值。

本次只更新合同和任务：售价、每日积分数、积分包规格、quota 换算、支付渠道尚未定；没有部署 New API、启用充值或发放真实积分。原 M0–M5 顺序和 A/G 门槛保留；AI 商业化另需 08 文档中的 B01–B14 验收。

## 技术选择摘要

Next.js 16.x App Router + React 19 + TypeScript；Tailwind CSS 4 + shadcn/ui；Motion；Zustand；TanStack Query；Dexie/IndexedDB；dnd-kit；Supabase Auth/PostgreSQL/RLS；CloudFlare ImgBed；EdgeOne；GitHub Actions；Vitest/Playwright；pnpm workspace（迁移阶段引入）。

锁定的是技术路线，不是未经验证的精确版本。M0 必须记录实际安装版本、lockfile、Node 运行时、EdgeOne 构建/运行结果；不要把讨论中的某个补丁号当作永久最新版。

## 现有工程基线

原始架构审查基于 `main@a3f2a2b8510fb8178ab9c0fdd2d65a19585c8a51`；后续文档与代码改动按实际 commit/PR 继续记录。现有工程仍是 GoTab 发布文件 + TypeScript 适配层，生产构建并非完整 React 组件源码重建。新工程要保留其数据、测试与行为参考，但不能声称压缩发布包已成为可复用的源码引擎。

规格文档更新不等于业务实现。仓库原有 README 与旧部署文档继续说明当前可运行版本；OS V1 新增开发以本目录和实际 implementation 报告为准。

## 先执行什么

先检查本地已有实施进度。尚未开始时执行 [M0：基线与兼容性验证](05-CODEX-TASKS.md)，再创建新源码壳层；已有进度则继续满足前置条件的未完成阶段，不能因收费或模型文档更新重做或覆盖成果。

M0 未解决的基础设施问题应准确记录；可继续不依赖它的本地界面与纯函数开发，但不得跳过门槛上线。任何阶段必须满足：能构建、能验证、不丢旧数据、能回滚。先建立一个小闭环，不允许一次性重写全站。

## 设计技能与模型记录补充

设计任务可在支持的本地 Codex 中用 `/skills` 查找，或显式写 `$dtab-ios-design`。仓库使用 `.agents/skills` 发现位置，不重复维护 `.codex/skills` 副本；拉取文件不等于已经验证用户本机加载。

角色分工仍按 07：Astra 规划/审查、Sol 核心/集成、Terra 实现契约明确后的页面。但从 2026-09-17 起，**实际模型记录只按对应角色线程本身可观察到的信息填写**。

不得根据任务标题、角色名称、AGENTS/Skill 文案、`.toml`/agent 配置、分支名或“计划使用某模型”推断切换成功。配置只能记录为 `configured_target`；实际角色线程未暴露模型时，`observed_model` 必须写 `unknown`。详细证据规则见 [09-MODEL-THREAD-EVIDENCE.md](09-MODEL-THREAD-EVIDENCE.md)。

此前模型选择器截图仍可证明环境中曾显示某些模型，但不自动证明后续 CORE/UI/REVIEW 线程实际由这些模型执行。09 文档在“是否真实切换/实际执行模型”这一点上优先于 07 中可能引起推断的旧表述。

模型记录只用于流程审计，不能替代构建、数据库、浏览器、安全与发布 gates。不能证明并行隔离时顺序交接，不假装已自动切换。
