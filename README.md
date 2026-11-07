# dsh-sidebar-guide-scroll

A small DSH plugin that makes the right sidebar's **Start** page scroll when its tool cards overflow, using the theme scrollbar only while it is needed. It never edits DSH or any installed third-party package: the fix targets the stable `data-sidebar-right-guide` marker that the sidebar itself ships.

右侧栏（DSH 原生 right sidebar）的「开始」页把可用工具渲染成一列卡片：文件、代码审查和变更、
上下文、新建终端、Git、浏览器、任务管理、侧边对话、主题、会话数据诊断…卡片一多就比面板高，
而这一页没有自己的滚动视口，列表两端被裁掉、滚轮也带不动。

这个插件只修这一件事：

- 给「开始」页的根节点 `[data-sidebar-right-guide]`（上游自带的稳定标记）一份作用域化样式，
  让它成为这一页自己的滚动容器，`overflow-y: auto` 天然只在溢出时出现滚动条；
- 上下各放一个弹性占位，内容不足一屏时仍然保持原来的居中观感；
- 用 `ResizeObserver` 把视口高度写死在元素上，并在面板尺寸、标签页、窗口变化时同步；
- 滚动条外观完全沿用宿主：`dsh-client-ui-theme` 已经给全站 `::-webkit-scrollbar` 定了
  5px、主题色、hover 变色，这里不另设颜色。

不改 `node_modules` 里的任何第三方包，也不改 DSH 自身；上游升级换了内部哈希类名也不受影响
（只依赖 `data-sidebar-right-guide` 这个对外标记）。

**相关 / Related:** [`dsh-better-sidebar`](https://github.com/topics/dsh-better-sidebar) 的标签页也注册在右侧栏这一页（新建终端、侧边对话、Git、浏览器、任务管理等），本插件与它**同页协作**，但**不依赖**它——卸掉 better-sidebar 后，原生卡片照样会溢出，修复照样生效。
Better-sidebar's tabs register on this same page (new terminal, side chat, Git, browser, tasks…). This fix cooperates with that ecosystem but does **not** depend on it: the native cards overflow the same way without it.

## 安装

在 DSH 里用插件管理安装本目录（`plugin_manager` → `install_bundle`，target 为本目录绝对路径），
然后刷新页面；插件管理里会看到「侧边栏开始页滚动 / Sidebar start page scrolling」。

也可以直接从 GitHub 装进某个 profile：

```bash
dsh plugin --profile <profile> add git+https://github.com/yhPrime/dsh-sidebar-guide-scroll.git
```

装完在插件管理里启用它，再刷新页面（客户端插件在页面加载时注册）。

## 卸载

插件管理里关掉或删掉 `dsh-sidebar-guide-scroll` 即可：样式、观察器和内联高度都会随 `ctx.effect`
的清理函数一起还原，不需要手动清理。

## 许可

MIT，见 [LICENSE](LICENSE)。

## 文件

| 文件 | 作用 |
| --- | --- |
| `index.js` | Host 半，空 `apply`（浏览器半才是修复本体） |
| `client.js` | 浏览器半：注入样式 + 视口测量 |
| `cordis.patch.yml` | bundle 行 |
| `locale/en.json`、`locale/zh.json` | 插件管理里的标题与描述 |
| `icon.svg` | 插件图标 |
| `test/check.mjs` | 静态自检（`npm test`） |
