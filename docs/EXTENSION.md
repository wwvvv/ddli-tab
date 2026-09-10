# DTab 添加当前页面插件（开发版）

运行 npm run build:extension，生成 dist-extension。Chrome 或 Edge 扩展管理页开启开发者模式，选择“加载已解压的扩展程序”，选择该输出目录。

1. 打开自己的 DTab 网页并保持标签页开启。
2. 访问需要收藏的网站，点击 DTab 插件。
3. 第一次填写 DTab 网页根地址（正式 HTTPS 地址或本地 http://127.0.0.1:4173）。
4. 点击“授权连接并读取分组”，仅授予自己的 DTab 站点访问权限。
5. 核对 URL、标题和图标，选择分组后点击“添加到 DTab”。

插件使用 activeTab，仅在主动点击时读取当前标签页。通过可选站点权限向 DTab 网页发送分组查询与添加请求。不读取 Cookie，不保存密码，不自己访问 Supabase。数据进入网页原有存储与同步层；只有网页已经登录并启用同步时才会自动同步。

首次连接时若没有打开 DTab，会在后台新开一个标签页；待加载完成后再次读取分组。仅支持普通 HTTP/HTTPS 页面；浏览器内部页面不作为收藏来源。同一分组的相同 URL 会提示已存在。

网页桥的输入验证、添加、去重及刷新保存已通过浏览器测试。实际 Chrome/Edge 扩展安装、权限弹窗与完整交互测试尚待完成；未提交扩展商店。该实现不替代正式 Supabase 双设备验收。

## 自动化安装与采集验证
新增 tests/extension-runtime.spec.ts：在独立临时 Chromium 配置中实际加载 dist-extension，通过 CDP 触发扩展 action，检查真实弹窗读取当前页面 URL、标题和图标地址。没有替换 chrome.tabs 或模拟扩展 API；测试结束关闭独立配置，不操作日常浏览器。

运行：
```sh
npm run build
npm run build:extension
npx playwright install chromium
npx playwright test tests/extension-runtime.spec.ts
```

测试专用 --enable-unsafe-extension-debugging 仅用于临时测试实例，不是用户安装要求。弹窗是 other 类型调试目标，需要恢复调试器暂停后检查其 DOM。
此项已在本机通过；跨站点可选权限确认、连接分组和完整添加流程仍需扩展级联调，不能用网页桥测试代替。扩展商店发布尚未完成。
CDP 接口参考：https://chromedevtools.github.io/devtools-protocol/tot/Extensions/

连接状态修复：修改站点地址或重新连接时清空旧分组并禁用添加；迟到的旧连接响应不再恢复旧目标。真实扩展弹窗已覆盖地址编辑后的状态失效检查（测试预置旧 UI 状态，不等同于已完成授权）。
权限联调发现：自动化触发 chrome.permissions.request 后弹窗调试目标关闭，尚未验证原生权限确认后重新打开的完整用户流程，保持该验收项未完成。

## 首次授权流程更新
首次点击连接时，若没有站点权限，会打开独立的 DTab 站点授权标签页。核对地址后点击“授权此站点”，在浏览器原生提示中确认。设置页保存授权后的站点地址；回到待收藏网页重新打开插件，再读取分组并添加。已有权限时直接连接，无需重复授权。

独立页避免权限提示导致原弹窗关闭后丢失后续保存步骤。未添加新的 manifest 权限。自动化已验证实际插件跳转到授权页、携带地址及拒绝非本地 HTTP 地址；原生允许/拒绝点击以及授权后的全链路仍待验证。

目标保护：发送函数在目标页面内核对连接时记录的 origin，标签页已跳转则在派发任何收藏事件前终止。新增浏览器测试验证错误 origin 零事件、正确 origin 读取分组/添加/刷新持久化；这些验证仍不替代原生站点授权验收。
