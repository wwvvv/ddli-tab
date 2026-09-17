# DTab OS V1 — 模型线程证据规则

版本：1.0 · 2026-09-17

本文件规定 DTab 项目后续如何记录 Codex / ChatGPT 桌面端各角色实际使用的模型。它只定义**证据与记录方式**，不改变 07-MODEL-ROUTING.md 中的角色职责建议。

## 1. 唯一原则

**按实际角色线程记录模型，不根据任务名称、角色名称、AGENTS/Skill 文案、`.toml`/agent 配置或计划表推断模型已经切换成功。**

例如任务名叫 `CORE / Sol`、配置文件写了 `model = "gpt-5.6-sol"`，只能说明“期望/配置目标”；除非对应实际角色线程能观察到该模型，否则记录为 `unknown`，不能写成“Sol 已执行”。

## 2. 什么叫实际角色线程

实际角色线程是一次可区分的主会话、子 agent 线程或独立审查线程。记录时至少能把它和其他线程区分，并能关联到本轮任务/提交。

每个线程单独记录：

```text
thread / role
observed model
observed reasoning effort（如果界面/运行记录可见）
evidence source
task / commit / PR
timestamp
```

推荐状态：

- `observed`：模型名称在该实际线程的 UI、线程头、运行详情或其他可观察运行信息中明确出现。
- `unknown`：当前产品没有暴露足够信息，或只有计划/配置，没有线程级证据。
- `not-run`：该角色线程实际没有启动。

不再用任务名称代替证据，也不把“配置成功保存”记成“模型运行已验证”。

## 3. 可接受与不可接受的证据

### 可接受

- 对应角色线程本身明确显示当前模型名称。
- 子 agent / 独立线程运行详情明确显示实际模型；如同时显示推理档位，可一并记录。
- 产品提供的线程级运行元数据，能够明确关联本次执行。

### 不能证明切换成功

- 任务标题包含 `Sol`、`Terra`、`Astra`。
- AGENTS.md、Skill、07 文档写了推荐模型。
- `.toml`、`.codex/agents/*` 或其他配置中指定了模型。
- 主线程说“我已经切到 Sol / 已让 Terra 执行”。
- 仅看到模型选择器存在某模型，但没有对应实际角色线程。
- 只看到某个模型被选中过，却无法确认本次角色线程实际以该模型执行。
- Git commit author、分支名、PR 名称、文件路径或代码风格。

配置文件仍然可以作为 `configured_target` 记录，但必须和 `observed_model` 分开。

## 4. 推荐记录格式

实施报告使用如下表格：

| Role thread | Task | Configured target | Observed model | Effort | Evidence | Status |
| --- | --- | --- | --- | --- | --- | --- |
| CORE-01 | SW 边界 | Sol | unknown | unknown | 无线程级运行信息 | unknown |
| UI-02 | Store 页面 | Terra | GPT-5.6 Terra | 中 | 该 UI 线程模型标识 | observed |
| REVIEW-01 | M2 review | Astra | GPT-6 Astra | 轻度 | 独立 review 线程模型标识 | observed |

没有证据时宁可写 `unknown`，不要根据 `.toml` 或任务角色补全。

## 5. 切换模型时怎么记

同一个角色如果重新开了实际线程，作为新的 thread 记录。例如：

```text
CORE-01 → observed GPT-5.6 Sol / 中
CORE-02 → observed GPT-5.6 Sol / 高
```

如果只修改了配置或模型选择器，但没有形成可确认的实际角色线程，则只更新 `configured_target`，不更新 `observed_model`。

如果一个线程执行过程中产品明确显示模型发生变化，可以按时间段记录；无法验证实际执行边界时不要自行拆分。

## 6. 与 07-MODEL-ROUTING.md 的关系

07 文档继续回答“这个任务建议由什么角色/模型负责”；本文件回答“实际是谁执行了”。

发生冲突时：

- **角色职责、风险升级、文件所有权**：以 07 为准。
- **模型是否真实切换/实际运行记录**：以本文件为准。

此前 `picker-visible`、`selected-ui` 可以作为环境能力或 UI 观察记录，但**不能再单独作为某个角色线程实际执行模型的证明**。后续实施报告只根据实际角色线程填写 `observed_model`。

## 7. 对自动委派的约束

未来即使启用 subagent、agent 配置或自动路由，也必须按实际生成的角色线程记录模型。自动化可以决定“尝试启动哪个模型”，但不能自己把配置目标写成执行事实。

如果委派工具不暴露实际线程模型，结果仍可用于代码开发，但模型字段写 `unknown`；不要为了满足模型路由表而伪造证据。

模型记录用于审计开发流程，不替代构建、单测、E2E、安全 gate 和代码审查。即使模型证据完整，测试未通过仍然不能发布。
