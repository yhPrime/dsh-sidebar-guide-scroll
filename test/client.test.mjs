/**
 * 行为自检（无浏览器）：用最小 DOM 替身跑客户端半的 apply / 视口同步 / 卸载。
 * 运行：node test/client.test.mjs
 */
let failed = 0;
let passed = 0;
function check(name, condition) {
  if (condition) {
    passed += 1;
    console.log('  ok  ' + name);
  } else {
    failed += 1;
    console.log('  FAIL ' + name);
  }
}

class FakeElement {
  constructor(tag) {
    this.tagName = tag;
    this.style = {};
    this.attributes = {};
    this.children = [];
    this.parentElement = null;
    this.isConnected = true;
    this.clientHeight = 0;
    this.textContent = '';
    this.overflowY = 'visible';
  }
  setAttribute(name, value) {
    this.attributes[name] = value;
  }
  appendChild(child) {
    this.children.push(child);
    child.parentElement = this;
    child.isConnected = true;
    return child;
  }
  remove() {
    this.isConnected = false;
    if (this.parentElement !== null) {
      const index = this.parentElement.children.indexOf(this);
      if (index >= 0) this.parentElement.children.splice(index, 1);
    }
  }
}

const guides = [];
const documentElement = new FakeElement('html');
const body = new FakeElement('body');
const head = new FakeElement('head');
const documentStub = {
  head,
  body,
  documentElement,
  createElement: (tag) => new FakeElement(tag),
  querySelectorAll: () => guides.filter((guide) => guide.isConnected),
};

class FakeResizeObserver {
  constructor(callback) {
    this.callback = callback;
    this.targets = new Set();
    this.disconnected = false;
    FakeResizeObserver.instances.push(this);
  }
  observe(target) {
    this.targets.add(target);
  }
  unobserve(target) {
    this.targets.delete(target);
  }
  disconnect() {
    this.targets.clear();
    this.disconnected = true;
  }
}
FakeResizeObserver.instances = [];

class FakeMutationObserver {
  constructor(callback) {
    this.callback = callback;
    this.disconnected = false;
    FakeMutationObserver.last = this;
  }
  observe() {}
  disconnect() {
    this.disconnected = true;
    FakeMutationObserver.disconnected = true;
  }
}
FakeMutationObserver.disconnected = false;

const windowStub = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (id) => clearTimeout(id),
  getComputedStyle: (element) => ({ overflowY: element.overflowY ?? 'visible' }),
};
windowStub.__ModuleLoader__ = {
  load: (definition) => {
    registered = definition;
  },
};
windowStub.window = windowStub;
let registered = null;

globalThis.window = windowStub;
globalThis.document = documentStub;
globalThis.ResizeObserver = FakeResizeObserver;
globalThis.MutationObserver = FakeMutationObserver;

await import('../client.js');

console.log('module registration');
check('loader called once', registered !== null);
check('factory id is the package name', registered?.id === 'dsh-sidebar-guide-scroll');
check('factory is callable', typeof registered?.factory === 'function');

const plugin = registered.factory();
check('module exposes apply', typeof plugin.apply === 'function');
check('module injects nothing', Array.isArray(plugin.inject) && plugin.inject.length === 0);

console.log('apply');
const disposers = [];
const ctx = {
  effect: (fn) => {
    const dispose = fn();
    disposers.push(dispose);
  },
};
const viewport = new FakeElement('div');
viewport.overflowY = 'auto';
viewport.clientHeight = 300;
const guide = new FakeElement('div');
viewport.appendChild(guide);
guides.push(guide);

plugin.apply(ctx);
check('registers two effects', disposers.length === 2);

const styleTag = head.children.find((child) => child.attributes['data-plugin-css'] === 'dsh-sidebar-guide-scroll');
check('appends the scoped stylesheet', styleTag !== undefined);
check('stylesheet is scoped to the guide marker', styleTag.textContent.includes('body [data-sidebar-right-guide]'));
check('guide scrolls only when needed', styleTag.textContent.includes('overflow-y: auto'));
check('guide keeps vertical padding', styleTag.textContent.includes('padding-block: 16px'));

console.log('viewport sync');
check('existing guide adopts the viewport height', guide.style.height === '300px' && guide.style.maxHeight === '300px');

viewport.clientHeight = 120;
FakeResizeObserver.instances.at(-1).callback([]);
check('resize writes the new height', guide.style.height === '120px' && guide.style.maxHeight === '120px');

console.log('remount scan');
const secondViewport = new FakeElement('div');
secondViewport.overflowY = 'auto';
secondViewport.clientHeight = 200;
const second = new FakeElement('div');
secondViewport.appendChild(second);
guides.push(second);
FakeMutationObserver.last.callback([]);
await new Promise((resolve) => setTimeout(resolve, 200));
check('newly mounted guide is picked up', second.style.height === '200px');

second.isConnected = false;
FakeMutationObserver.last.callback([]);
await new Promise((resolve) => setTimeout(resolve, 200));
check('removed guide is untracked and cleared', second.style.height === '' && second.style.maxHeight === '');

console.log('dispose');
for (const dispose of disposers) dispose();
check('stylesheet removed', styleTag.isConnected === false);
check('resize observers disconnected', FakeResizeObserver.instances.every((instance) => instance.disconnected === true));
check('mutation observer disconnected', FakeMutationObserver.disconnected === true);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
