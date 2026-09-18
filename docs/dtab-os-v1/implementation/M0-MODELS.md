# M0-MODELS — 模型线程证据记录

生成时间：2026-09-17（Asia/Singapore）。遵循 [09-MODEL-THREAD-EVIDENCE.md](../09-MODEL-THREAD-EVIDENCE.md)：只按实际角色线程的可观察信息填写 `observed_model`；任务名、角色名、配置或文档不作为切换成功的证据。

## 1. 本轮实际线程

| Role thread | Task | Configured target | Observed model | Effort | Evidence | Status |
| --- | --- | --- | --- | --- | --- | --- |
| M0-IMPL-01（唯一实施线程） | M0-01 基线复验、M0-02 兼容探针、M0 报告 | 07-MODEL-ROUTING M0 默认为 Sol（该路由表面向 ChatGPT 桌面端；本线程实际环境为 WorkBuddy 会话，未配置该目标） | GLM-5.3-Flash（本会话运行信息可见的模型） | 未暴露 | 本会话线程运行信息 | observed |
| Sol 独立线程 | — | — | — | — | 未启动 | not-run |
| Astra 规划/审查线程 | — | — | — | — | 未启动 | not-run |
| Terra UI 线程 | — | — | — | — | 未启动（M0 无 UI 页面任务） | not-run |

说明：

1. 本轮由单一集成线程顺序完成，未启动子 agent 委派，不存在并行工作区；符合 05 §9「不能隔离写入时顺序执行」。
2. 07 文档的 Sol/Astra/Terra 为 ChatGPT 桌面端的路由建议。当前执行环境不是该客户端，无法也不应伪造 `observed_model = Sol`；`configured_target` 仅按文档记录，不升级为执行事实。
3. 07 §9 的其余检查项（三模型分别运行任务、档位保留、分模型子 agent、dtab-ios-design 实际调用）：**not-run**。dtab-ios-design 属 UI 任务前置，M0 为基线/探针任务，未涉及视觉实现，本轮不调用。

## 2. 对后续阶段的约束

- M1 起，如使用 07 路由，各角色线程须能被区分并记录 observed_model；无法观察时一律写 `unknown`。
- 模型记录不替代构建/测试/安全 gate；本轮所有 passed 结论均以实际命令输出为依据。
