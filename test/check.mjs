/**
 * 静态自检：不依赖浏览器。真实视觉（滚动条是否出现、能否滚动）需要刷新页面后人工确认。
 * 运行：npm test
 */
import { readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (name) => readFileSync(join(root, name), 'utf8');
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

const pkg = JSON.parse(read('package.json'));
const clientSource = read('client.js');
const indexSource = read('index.js');
const patch = read('cordis.patch.yml');
const en = JSON.parse(read('locale/en.json'));
const zh = JSON.parse(read('locale/zh.json'));
const icon = read('icon.svg');

console.log('package manifest');
check('name matches module id', pkg.name === 'dsh-sidebar-guide-scroll');
check('type module', pkg.type === 'module');
check('exports "."', pkg.exports['.'] === './index.js');
check('exports "./client"', pkg.exports['./client'] === './client.js');
check('bundle patch declared', pkg.dsh?.bundle?.patch === './cordis.patch.yml');
check('client platform web', pkg.dsh?.client?.platform === 'web');
check('client loads immediately', pkg.dsh?.client?.immediately === true);
check('files lists every runtime file', ['index.js', 'client.js', 'cordis.patch.yml', 'icon.svg'].every((name) => pkg.files.includes(name)));

console.log('host half');
check('exports apply()', /export function apply\(\)/.test(indexSource));

console.log('bundle patch');
check('patch inserts our id', /id:\s*dsh-sidebar-guide-scroll/.test(patch));
check('patch row uses package name', /name:\s*dsh-sidebar-guide-scroll/.test(patch));

console.log('client half');
check('registers through the module loader', /window\.__ModuleLoader__\.load\(\{/.test(clientSource));
check('factory id equals package name', /id:\s*"dsh-sidebar-guide-scroll"/.test(clientSource));
check('targets the stable guide marker', clientSource.includes('[data-sidebar-right-guide]'));
check('guide becomes its own scroll port', /overflow-y:\s*auto/.test(clientSource));
check('only appears while overflowing (auto, not scroll)', !/overflow-y:\s*scroll/.test(clientSource));
check('keeps content centred when it fits', /flex:\s*1 1 auto/.test(clientSource));
check('measures the real viewport', clientSource.includes('ResizeObserver'));
check('rescans when the guide remounts', clientSource.includes('MutationObserver'));
check('releases styles and observers on dispose', clientSource.includes('tag.remove()') && clientSource.includes('observer.disconnect()') && clientSource.includes('untrack(element)'));
check('no hardcoded theme colours', !/#[0-9a-f]{3,8}\b/i.test(clientSource));
check('no inline script injection', !/innerHTML/.test(clientSource));

console.log('display metadata');
check('en title', typeof en.meta?.title === 'string' && en.meta.title.length > 0);
check('en description', typeof en.meta?.description === 'string' && en.meta.description.length > 0);
check('zh title', typeof zh.meta?.title === 'string' && zh.meta.title.length > 0);
check('zh description', typeof zh.meta?.description === 'string' && zh.meta.description.length > 0);
check('icon is svg with viewBox', icon.trimStart().startsWith('<svg') && icon.includes('viewBox='));
check('icon under 256 KiB', statSync(join(root, 'icon.svg')).size <= 256 * 1024);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
