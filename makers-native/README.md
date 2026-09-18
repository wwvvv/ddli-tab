# DTab — Makers Native

状态：架构基线已建立；尚无重建版可运行应用，尚未部署或完成云端验收。

## 本次决策

2026-09-18，用户明确要求：不考虑之前的代码，先阅读官方 Skill，完全基于 EdgeOne Makers 的架构与功能开发 DTab。

因此本目录采用从零开发，而非旧版迁移：不复用 legacy 构建产物、不注入旧页面、不把 Supabase/PostgreSQL/New API/外部图床作为前置依赖。产品目标保留，旧实现不作为约束。仓库其他目录暂时原样保留，仅为保护现有工作；它们不是新应用的运行依赖。

## 阅读顺序

1. [开发约束](AGENTS.md)
2. [Makers 原生架构](docs/ARCHITECTURE.md)
3. [实施计划与验收门槛](docs/IMPLEMENTATION.md)
4. [官方 Skill 阅读记录](skill-source.json)

## 目标技术路线

- 前端：React + TypeScript + Vite，Tailwind CSS + shadcn/ui 作为界面基础。版本在实际搭建时核验并锁定。
- 业务 API：Makers Node.js Cloud Functions，同域 `/api/*`。
- 持久化：Makers Blob，JSON 对象保存业务记录，二进制对象保存文件；业务读写明确使用 strong consistency。
- 边缘能力：Middleware / Edge Functions 按需启用；KV 仅保存允许陈旧的缓存或非关键状态，不作为全局锁、积分余额或实时撤权真源。
- AI：Makers Models；需要会话、工具和沙箱的执行使用 Makers Agents。
- 部署：GitHub + Makers；不新建 VPS、Redis、数据库或 New API 实例。

这里的“全 Makers”指 DTab 自建运行时与持久化基础设施。上游模型供应商和支付渠道仍是其各自服务，并不因为经 Makers 调用就变成平台免费内置能力。

## 当前交付范围

本提交只有架构、工程约束、实施任务与环境变量声明草案。没有声明以下工作已经完成：前端、账号系统、Blob CRUD、应用运行时、AI 调用、会员订单、积分结算、Skill 在用户电脑上的安装或 Makers 部署。

当前不要把 Makers 的生产根目录切换到本目录，也不要将本分支作为可用网站发布。下一实现提交才建立独立 package.json、锁文件、Vite 工程和 edgeone.json，并提供实际构建结果。

## 安全边界

Makers 官方 Skill 明确使用 Blob 作为无数据库后端，但也明确提醒：强一致的读—改—写仍存在并发竞争，不能直接据此构造资金账本。原生订单与积分结算列为必须验证的工程任务；未通过可靠并发、幂等、故障恢复及对账验收前不开放收款或面向公众的付费 AI。不得为追求“全 Makers”伪造事务保证，也不得未经说明悄悄接回外部数据库。
