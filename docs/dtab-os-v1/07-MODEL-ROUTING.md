# DTab OS V1 — 模型选择、任务分工与审查规则

版本：1.0 · 2026-09-16

关联：[任务顺序](05-CODEX-TASKS.md) · [设计系统](06-DESIGN-SYSTEM.md) · [审查门槛](04-AUDIT.md)

## 1. 这份文件能做什么

本文件约定任务风险、推荐模型、推理力度、文件所有权与审查交接。它不是自动模型路由程序，不会因为被放进 AGENTS.md 就改变正在运行的 Codex 模型，也不会安装或启动其他 agent。

本次不修改用户全局配置、项目活动 config.toml、审批策略或生产环境。M0 先记录本机客户端版本、登录方式下实际可选模型及推理档位；没有观测到运行模型时写 unknown，不通过模型自称判断当前 ID。

## 2. 核实的名称与项目选择

截至本次查阅，官方模型文档列出 `gpt-6-astra`、`gpt-5.6-sol`、`gpt-5.6-terra` 等 ID，并说明可用性取决于客户端、登录方式和开放范围。[M01] 它不证明当前用户的本地账号拥有每个选项。

| 任务角色 | DTab 推荐 | 推理建议 | 使用范围 |
| --- | --- | --- | --- |
| CORE 集成/核心 | gpt-5.6-sol | High，须为本地支持的档位 | M0/M1、共享契约、迁移、布局引擎、Auth/RLS、同步、私有媒体 |
| UI 页面执行 | gpt-5.6-sol | Medium | 已有设计 token/接口后的商店、相册展示、设置、普通组件 |
| REVIEW 阶段审查 | gpt-6-astra | High；棘手问题且本地支持时 Extra High | 跨模块审查、视觉一致性、数据/安全与上线决策材料 |
| ECONOMY 可选执行 | gpt-5.6-terra | Medium（实际支持时） | 范围明确、不改契约的重复 UI/文案/测试 fixtures；由 CORE 复核 |

这是针对 DTab 的分工建议，不是经项目实测的模型性能排名。不要把 High 当作绝对质量保证，也不默认全程 Max/Ultra。

前面对话里的“GPT-5.6 Pro”在这里不作为确定可调用的 Codex ID。ChatGPT 的 Pro 使用方式/套餐名称不能直接推导为 Codex 模型名。采用已核实名称，并以本地可用选项为准。

Astra 不可用时，REVIEW 可由独立会话的 Sol High 承担；只有一个模型时也分开发与审查两轮，明确不是独立模型评审。遇到真实越权、数据丢失或未满足发布 gate，不能通过“换更强模型”绕过阻塞。

## 3. 怎么选择，而不是假装自动切换

Codex CLI 可先启动指定模型，例如：

```sh
codex --version
codex -m gpt-5.6-sol
```

然后在支持的交互客户端使用 `/model` 检查实际选项并选择推理力度。`-m` 只指定模型，不等于同时设置 High。桌面/IDE 按其真实模型选择器操作。[M01]

需要持久化配置时，实施者先核对当前本机文档和 schema。官方配置参考列有 `model_reasoning_effort`，但支持值与模型相关，UI 中的 Max/Ultra 不能直接猜成该字段的枚举。[M02] 本文不覆盖用户现有 config.toml，不写入未知的 model 字段到 Skill frontmatter。

任务开始声明的是“建议使用 CORE/High”而非“我已经自动切换”。实际未切换则记录当前值或 unknown。真实多 agent 功能可用时，按其支持的机制配置和验证；不可用时顺序执行，不伪造并行进程。

## 4. 风险路由

默认普通 UI 使用 UI 档。下列任一条件成立提升到 CORE，并限制为单一集成人负责：

- 修改 desktop schema、实体 ID、迁移器、Dexie 版本、旧数据转换或恢复行为。
- 修改 Service Worker、缓存、路由切换、Auth/RLS、管理员权限、用户隔离或会话。
- 修改上传/读取授权、删除一致性、计量、支付、数据库 migration、部署/回滚。
- 修改共享设计 token、网格/碰撞规则、应用注册表、全局焦点/模态/动效机制或 lockfile。

商店页面不是天然低风险：只改卡片展示可用 UI；涉及价格/权益、远程入口、身份/订单时按 CORE。相册展示可并行，读取权限与文件生命周期必须 CORE。失败修复扩散到共享契约时先升级责任人，不让页面 agent 自行重构平台。

建议在同一失败上连续两轮无法定位、修改范围扩大、或出现跨账号/数据不一致时安排 REVIEW。审查报告应提供文件/行号、复现方法、严重程度和修复建议，不仅给出“看起来合理”。

## 5. M0–M5 分工

| 阶段 | 主负责人 | 可以独立处理的任务 | 必须审查的节点 |
| --- | --- | --- | --- |
| M0 | CORE | 文档/配置盘点可顺序委派只读子任务 | 基线、兼容性、未验证项是否真实 |
| M1 | CORE | 已定 token 下的静态控件样例 | Next 壳、旧 SW/API 路由、包管理迁移、Design System 样例 |
| M2 | CORE | 契约稳定后的 Home/Dock/添加 UI | 桌面数据、导入/回退、键盘路径、布局适配 |
| M3 | CORE | 设置的显示层 | Auth/RLS、双设备、账号切换、预设发布 |
| M4 | CORE + UI | 商店页面、相册查看器、设置分组 | 媒体隐私/删除、安装与权益、三页面视觉一致性 |
| M5 | CORE + REVIEW | 明确缺陷的局部修复 | /os 切根路径前、离线/扩展/回滚和全部上线 gates |

模型检查是 M0 的附加步骤，不替代原构建/数据库/浏览器基线。设计任务依照 `.agents/skills/dtab-ios-design/SKILL.md`，不是每个页面独立搜一套 iOS 模板。

## 6. 并行与文件所有权

M0/M1 默认一个可写负责人。M2 契约冻结后再开 2–3 个有明确范围的任务；增加 agent 数不是默认优化。

CORE 独占 lockfile、package scripts、desktop schema、SQL migrations、Auth、SW、部署、共享 token、全局 App Registry。页面任务只改自己的目录/测试，不能为了修一个样式覆盖这些共享文件。

每个子任务记录 base commit、允许改的路径、禁止改的路径、使用的契约版本、验收命令。使用独立 worktree/分支前确认用户工作区没有被覆盖；只读 reviewer 默认不给合并/发布/生产配置写权限。

共享 token 需调整时提交给 CORE 汇总；不能三个页面各加 --accent、--brand 和 --primary 的平行体系。收到冲突先核对基线，不自动选择“全部用我的版本”。

## 7. 审查与交接

提交 REVIEW 的最小包：需求/阶段、base/head commit、变更文件、真实测试结果、未执行事项、截图路径/视口、待审问题、数据影响和回滚方法。不得携带 API 密钥、真实私人照片或生产数据库快照。

REVIEW 先查正确性、权限、数据保护与范围，再查设计一致性和性能。通过视觉评审不等于通过私有媒体/迁移 gate；代码审查也不等于执行了浏览器测试。

格式：

```text
阶段/任务：
建议角色与模型：
实际客户端/模型/effort（未知则 unknown）：
base/head commit：
允许修改路径：
完成内容：
验证：passed / failed / blocked / not-run
截图和交互证据：
风险与阻塞：
下一步/回滚：
```

新会话的 reviewer 是降低自我确认偏差的步骤，不是正确性保证。涉及真实收费、生产切换、数据删除和资源购买仍遵循原授权边界，不能因为开了高级模型或多 agent 就自动执行。

## 8. M0 可用性记录

由本地实施者在实际检查后生成 `implementation/M0-MODELS.md`，记录 CLI/桌面/IDE 版本、模型选择器可见 ID、支持 effort、Skill 是否发现、是否存在可用多 agent 功能、降级方式与检查日期。不要复制认证 token 或费用账单到仓库。

当前状态：规范已编写；用户本机模型可用性、自动分派、Skill 实际触发均未测试。没有新增活动模型配置。

## 9. 官方依据

- M01：[OpenAI Codex Models](https://developers.openai.com/codex/models)，本次重定向至 [Models](https://learn.chatgpt.com/docs/models)。用于核实模型 ID、选择方式与可用性限制，不把示例界面视为该账号权限。
- M02：[OpenAI Configuration Reference](https://developers.openai.com/codex/config-reference)，本次重定向至 [Configuration Reference](https://learn.chatgpt.com/docs/config-file/config-reference)。用于核对配置字段，具体运行结果仍需本地验证。
- M03：[OpenAI Build Skills](https://developers.openai.com/codex/skills)，本次重定向至 [Build Skills](https://learn.chatgpt.com/docs/build-skills)。仓库技能路径为 `.agents/skills`；可通过 `/skills` 或 `$` 显式调用。Skill 不是模型配置文件。

资料查阅于 2026-09-16；模型和客户端可能继续更新，实施时以实际工具返回和官方说明为准。
