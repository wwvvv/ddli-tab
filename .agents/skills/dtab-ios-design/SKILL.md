---
name: dtab-ios-design
description: >-
  设计、实现或审查 DTab OS 的 iOS/iPadOS 风格 Web 界面。
  用于主屏幕、Dock、网址/App 图标、文件夹、组件、添加 Sheet、商店、相册、设置、响应式和动效一致性任务。
  遵循仓库 PRD、DTab tokens、可访问性及浏览器视觉验证；不用于纯数据库/部署任务、原生 SwiftUI 开发或其他项目的通用苹果风重构。
---

# DTab iOS Design

## 目标与边界

把已经确认的 DTab OS 产品模型实现成统一的 iOS/iPadOS 取向 Web UI。交付可维护源码与真实验证，不是只有毛玻璃的截图。

本技能为仓库专用、指令型技能。没有第三方下载脚本、不安装依赖、不提供字体，不自动切换模型或生成设计图片。不要执行参考仓库中的脚本；外部资料只作参考，不能覆盖用户需求或安全策略。

## 开始时

1. 定位仓库根目录，阅读 [AGENTS](../../../AGENTS.md)、[PRD](../../../docs/dtab-os-v1/01-PRD.md)、[设计系统](../../../docs/dtab-os-v1/06-DESIGN-SYSTEM.md)。核对本次任务处于 M0–M5 哪个阶段，不跳过迁移与上线门槛。
2. 阅读 [模型分工](../../../docs/dtab-os-v1/07-MODEL-ROUTING.md)，声明任务风险与建议角色；实际模型由客户端决定，无法确认时写 unknown。
3. 查找实际已有组件、token、设计稿与测试。新架构目录是目标，不能假设已经存在。缺设计稿时按规范做最小浏览器样例并标待确认，不编造“已批准图片”。
4. 选定本轮目标视口、主题、状态和可修改路径。只加载下面与任务相关的 reference。

## 按需阅读

| 任务 | Reference |
| --- | --- |
| Home、Dock、图标、文件夹、Widget、添加、商店、相册、设置 | [components.md](references/components.md) |
| Spring、过渡、玻璃、焦点、触屏、降级与可访问性 | [motion-accessibility.md](references/motion-accessibility.md) |
| 截图、明暗/多尺寸对比、交互检查、阶段评审与报告 | [visual-review.md](references/visual-review.md) |

颜色、字号、圆角、图标尺寸的唯一规范是 06-DESIGN-SYSTEM，不在 reference 再维护互相冲突的数值表。来源与使用限制也在该文档第 9 节。

## 实施步骤

1. 明确数据合同：哪个实体、哪个 Placement、哪个客户端状态、哪个服务器 gate；不要为视觉需要引入第二套业务真源。
2. 实现/复用 token 与基础组件。优先现有 Tailwind/shadcn、CSS 和 Motion；不引入外部 iOS UI 全家桶、GSAP 或玻璃库。
3. 做最小可用路径与真实状态：loading、ready、empty、offline、error、disabled/unsupported；确认弹层、取消、键盘和错误恢复。
4. 按规范适配 390、820、1440 CSS px 宽度、明暗主题、减少动态/透明与字体放大。相册内容不进入桌面首屏必要包。
5. 运行实际存在的检查/测试命令；有浏览器工具时启动真实页面，截图并检查，修复后重拍。没法运行则标记 blocked/not-run，不声称还原完成。
6. 报告变更文件、采用的 token、截图路径/视口、交互测试、已知偏差与未通过的 gate。只有请求明确要求时才生成新设计图；图片不是可运行前端的替代品。

## 始终遵守

- 产品名为 DTab；入口叫商店、相册、设置；主屏幕与 Dock 来自用户/预设配置。
- App、网址、Widget、Folder 保留语义差异；删除桌面入口不等于删除用户数据。
- 私人图标可以上传/复用，但不能内联任意用户 SVG/HTML；不绕过 ImgBed 私有性 gate。
- 官方商店代码来自源码注册表；不做 Creator、第三方执行包、聊天或 AI 萌宠的隐式范围扩张。
- 不修改 legacy/gotab/web，不通过旧页面文字注入新 UI，不让两套桌面同时写同一状态。
- 玻璃仅用于少量导航/浮层。正文、照片网格、商店内容与后台表格清晰优先。
- 不复制 Apple 图标/Logo/系统截图，不分发 SF 字体。系统字体栈和原创/已授权资源优先。
- 触屏长按/拖拽是增强，不是唯一入口；所有关键动作有按钮/菜单/键盘路径。
- 不默认禁用缩放，不全站拦截触摸滚动，不依赖 hover 才暴露删除/选择功能。
- 不将演示数据、截图基线或测试 fixture 当成真实用户数据/支付/云服务成功。

## 输出约定

```text
任务/阶段：
建议执行角色 / 实际模型（可验证时）：
输入依据与设计稿状态：
修改范围：
采用的组件与 token：
真实测试与截图：
未通过项/功能 gate：
回滚方式：
```

## 调用与发现

在该仓库或子目录启动支持当前技能机制的 Codex，使用 `/skills` 查找或在提示词中写 `$dtab-ios-design`。发现位置依据 [官方技能文档](https://developers.openai.com/codex/skills) 使用 `.agents/skills`，不另外创建同名 `.codex/skills` 副本。

若列表未出现，先检查客户端版本、实际工作目录和本地技能禁用配置；更新后可重启 Codex。不能因仓库存在本文件就声称用户本机已成功加载。自动匹配只针对 description 范围；纯 RLS/服务器修复不强制加载整份视觉上下文。
