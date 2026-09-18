# DTab — Makers Native

状态：产品与架构草案 v0.2；尚无重建版可运行应用，尚未部署或完成云端验收。

## 当前方向

2026-09-18，用户要求放弃旧代码、基于 Makers 官方 Skill 从零开发，并进一步允许网站功能模块围绕 Makers 调整。本目录不再原样复刻旧版商店、相册与迁移流程。

建议定位：**以个人桌面为入口，将常用网站、轻量工具、AI 助手和个人文件放在一起的在线工作空间。**

用户侧收敛为桌面、应用库、AI 助手、文件、设置；任务记录是共享面板，管理后台是运营入口。原相册并入文件图片视图，旧商店调整为官方应用库。具体边界和首版验收场景以 [PRODUCT.md](docs/PRODUCT.md) 为准。

## 阅读顺序

1. [开发约束](AGENTS.md)
2. [产品与功能模块](docs/PRODUCT.md)
3. [Makers 原生架构](docs/ARCHITECTURE.md)
4. [实施计划与验收门槛](docs/IMPLEMENTATION.md)
5. [官方 Skill 阅读记录](skill-source.json)

## 实现路线

React + TypeScript + Vite；Tailwind CSS + shadcn/ui 为界面基础。版本在实际搭建时核验并锁定。业务 API 使用 Makers Node.js Cloud Functions；Blob 保存 JSON 业务记录与文件；Models 提供模型接入，需要工具/记忆/沙箱时再采用一个 Agent 路线。

普通浏览器工具无需强行调用 AI；Middleware、Edge Functions、KV 按需使用，不是必须经过的层。KV 不作为全局锁、积分余额或实时撤权真源。无需额外部署 Supabase、SQL、Redis、New API、外部图床或 VPS。

「全 Makers」指 DTab 自建运行时与持久化基础设施。上游模型和支付渠道仍有各自凭据、授权及费用。已有服务不会因为本目录的设计变更而被删除。

## 本轮交付与后续

当前只有产品、架构、开发约束、实施计划和环境变量声明草案。没有新前端/后端代码，没有 Skill 在用户电脑上的安装，没有构建、测试、模型调用或 Makers 部署。

首条完整链路是「桌面 → AI 助手处理本人文本文件 → 真实任务状态 → 结果另存文件」。本地桌面和本地工具可独立交付；云端链路按账号、私有文件、AI 和商业门槛逐步开放。

不要把生产根目录切换到本目录。现有 main、旧实现与部署设置保持不变；它们只为保护已有工作而保留，不是新应用运行依赖。
