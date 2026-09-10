# Supabase 同步协议

## 数据模型
`public.dtab_snapshots` 每个账号一条个人快照。包含原版可导出的 12 个配置模块，不存管理员默认模板、登录令牌或站点配置。最大 JSON 文本 2 MiB。实际用户数据仍须由前端按原版格式验证。

## 权限
已启用 RLS，仅允许登录用户读取自己的行。匿名用户没有读写权限；登录用户不能直接插入、更新、删除表数据。唯一客户端写入口 `dtab_push_snapshot` 从 `auth.uid()` 获取身份，不接收目标用户 ID。删除卡片通过新快照表达；删除 Supabase 账号会级联清理其快照。

## 写入协议
RPC 参数为 `p_base_revision`、`p_request_id`（UUID）、`p_payload`。
- 未有云数据时基准版本为 0。
- 写入成功返回 `status=ok`、新 revision 和 payload。
- 版本过期返回 `status=conflict` 和当前云端数据，不覆盖。
- 相同的最近请求 ID 与相同内容重试不会重复增加版本；同一请求 ID 换内容会报错。
- 客户端需要保存上次同步基线，冲突后做三方合并。不同卡片新增/删除/修改可合并；同字段冲突、删除与编辑冲突、双端不同重排必须明确处理后再提交。
- 登录 UI、自动同步调度、离线队列和冲突选择已接入原版侧边栏“迁移备份”页；真实项目的邮件链路、JWT 刷新及双设备实际验收仍待完成。

## 本地数据库验证
运行 `npm run test:db`，需要 Docker 与 postgres:17-alpine 镜像。脚本创建无网络、无宿主端口的独立临时数据库，执行迁移和权限测试，结束后移除该测试容器，不接触其他容器。

`supabase/tests/local-auth-harness.sql` 只供本地模拟 JWT 身份，绝对不要在真实 Supabase 执行。真实项目仅执行 migrations 目录下的迁移。

已验证：匿名拒绝、跨账号读取隔离、直接写入拒绝、缺失身份拒绝、版本冲突、幂等重试、禁止账号模块入库。这不替代真实 Supabase JWT、HTTP API 和两台设备联调。

依据：[Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)、[数据库函数](https://supabase.com/docs/guides/database/functions)。

## 本地队列实现进展

src/local/sync-engine.ts 已实现账号绑定的持久化待发送队列、响应丢失重试、三方合并、冲突暂停与明确选择、本地并发编辑保留、退出后忽略在途响应。通过注入传输层的单元测试验证，并由同步控件连接到 Supabase 客户端；真实 Supabase 双设备验收仍是上线门槛。

## 页面集成进展

同步控制已连接原版导出/恢复与 Redux 订阅，支持首次选择、本地编辑防抖上传、15 秒轮询、恢复联网重试、退出停止、冲突整份选择及备份。入口位于原版侧边栏“迁移备份”，原版导入、导出保留在同一页面。浏览器模拟服务测试已走通原版编辑器添加后上传、远端修改拉取并显示、退出流程。仍不等同真实 Supabase 或两台设备验收。
