/**
 * dsh-sidebar-guide-scroll — 客户端半（Client half）。
 *
 * 右侧栏（DSH 原生 right sidebar）的「开始」页把每个可用工具渲染成一张卡片。
 * 卡片多了以后列表比面板高：内容是垂直居中的 flex 列，面板本身没有给它一个
 * 可滚动的视口，于是上下两端被裁掉、鼠标滚轮也带不动。
 *
 * 这个客户端半只做两件事，不碰任何业务组件：
 *  1. 给 `[data-sidebar-right-guide]`（「开始」页的根节点，上游自己带的稳定标记）
 *     一份作用域化 CSS：让它成为这一页自己的滚动视口，`overflow-y:auto` 天然
 *     只在溢出时出现滚动条；上下两个弹性占位让内容不足一屏时仍然居中。
 *  2. 用 ResizeObserver 把「视口高度」写死到元素上（CSS 的 height:100% 在某些
 *     嵌套布局里会失效），尺寸变化时同步。卸载时全部还原。
 *
 * 滚动条外观沿用宿主：`dsh-client-ui-theme` 已经给全站 `::-webkit-scrollbar`
 * 定了 5px、主题色、hover 变色，这里不再覆盖颜色。
 */
window.__ModuleLoader__.load({
  id: "dsh-sidebar-guide-scroll",
  factory: () => {
    /** 与 package.json 的 name 一致（模块 id 与样式归属标记）。 */
    const PACKAGE_ID = "dsh-sidebar-guide-scroll";
    /** 上游「开始」页根节点自带的稳定标记，不用猜哈希类名。 */
    const GUIDE_SELECTOR = "[data-sidebar-right-guide]";
    /** 上下留白，避免卡片贴边。 */
    const PADDING_BLOCK = 16;
    /** 扫描节流：面板内容会随标签页变化反复挂载。 */
    const SCAN_DELAY_MS = 120;

    const CSS = `
body [data-sidebar-right-guide] {
  box-sizing: border-box;
  height: 100%;
  max-height: 100%;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  justify-content: flex-start;
  padding-block: ${PADDING_BLOCK}px;
}
body [data-sidebar-right-guide]::before,
body [data-sidebar-right-guide]::after {
  content: "";
  flex: 1 1 auto;
  min-height: 0;
}
`;

    /**
     * 最近的那个「有视口的」祖先：溢出不是 visible、并且量得到高度。
     * 右侧栏的标签内容在 dock 面板里，最近的一层就是面板正文；
     * 浮动面板同理。找不到就退回第一个量得到高度的祖先。
     */
    function findViewport(element) {
      let fallback = null;
      let node = element.parentElement;
      while (node !== null && node !== document.body && node !== document.documentElement) {
        const style = window.getComputedStyle(node);
        if (node.clientHeight > 0) {
          if (style.overflowY !== "visible") return node;
          if (fallback === null) fallback = node;
        }
        node = node.parentElement;
      }
      return fallback;
    }

    /** 把当前视口高度同步到「开始」页上；尺寸为 0（面板收起/未显示）时清掉内联高度。 */
    function sync(element, viewport) {
      const height = viewport === null ? 0 : viewport.clientHeight;
      const next = height > 0 ? `${height}px` : "";
      if (element.style.height !== next) element.style.height = next;
      const nextMax = height > 0 ? `${height}px` : "";
      if (element.style.maxHeight !== nextMax) element.style.maxHeight = nextMax;
    }

    return {
      inject: [],
      apply(ctx) {
        // 样式表：随插件卸载自动移除。
        ctx.effect(() => {
          const tag = document.createElement("style");
          tag.setAttribute("data-plugin-css", PACKAGE_ID);
          tag.textContent = CSS;
          document.head.appendChild(tag);
          return () => tag.remove();
        }, PACKAGE_ID + ": stylesheet");

        // 视口测量：每个「开始」页实例一份 ResizeObserver。
        ctx.effect(() => {
          const tracked = new Map();
          let scanTimer = null;
          let observer = null;

          const reflow = (element) => {
            const record = tracked.get(element);
            if (record === undefined) return;
            const viewport = findViewport(element);
            if (record.viewport !== viewport) {
              if (record.viewport !== null) record.observer.unobserve(record.viewport);
              record.viewport = viewport;
              if (viewport !== null) record.observer.observe(viewport);
            }
            sync(element, viewport);
          };

          const track = (element) => {
            if (tracked.has(element)) return;
            const observer = new ResizeObserver(() => reflow(element));
            const record = { observer, viewport: null };
            tracked.set(element, record);
            observer.observe(element);
            reflow(element);
          };

          const untrack = (element) => {
            const record = tracked.get(element);
            if (record === undefined) return;
            record.observer.disconnect();
            tracked.delete(element);
            if (element.style.height !== "") element.style.height = "";
            if (element.style.maxHeight !== "") element.style.maxHeight = "";
          };

          const scan = () => {
            for (const element of document.querySelectorAll(GUIDE_SELECTOR)) track(element);
            for (const element of [...tracked.keys()]) {
              if (!element.isConnected) untrack(element);
            }
          };

          const scheduleScan = () => {
            if (scanTimer !== null) return;
            scanTimer = window.setTimeout(() => {
              scanTimer = null;
              scan();
            }, SCAN_DELAY_MS);
          };

          observer = new MutationObserver(scheduleScan);
          observer.observe(document.documentElement, { childList: true, subtree: true });
          scan();

          return () => {
            if (scanTimer !== null) window.clearTimeout(scanTimer);
            observer.disconnect();
            for (const element of [...tracked.keys()]) untrack(element);
          };
        }, PACKAGE_ID + ": viewport");
      },
    };
  },
});
