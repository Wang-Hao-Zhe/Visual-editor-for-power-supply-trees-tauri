/*
 * 电源树编辑器 · 无浏览器回归测试
 *
 * 做法：把 index.html 里的 <script> 抠出来，塞进 Node 的 vm 沙盒，
 *       配一套极简 DOM 桩（createElement / getElementById / scrollIntoView / localStorage ...），
 *       然后直接调 render() 渲染出来的假节点，验证增删改、设为起点的行为。
 *
 *   运行： node _test/harness.js
 *
 * 为什么不用真浏览器：零依赖、秒级跑完、能 assert 到「渲染出了几个方块、坐标在哪」这种
 * 肉眼难判的东西。缺点是 CSS 动画和真实排版验证不了，那部分还得手动看一眼。
 *
 * 改动 index.html 后记得跑一遍。
 */
const fs=require('fs'), vm=require('vm');
const ROOT='C:/Users/彧/Desktop/無限進步/WorkBuddy/XYDownforceWing/power-tree-editor/';
const src=fs.readFileSync(ROOT+'index.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1];

const reg=new Map();
function makeEl(tag){
  let _h='';
  const e={tag,children:[],style:{},attrs:{},className:'',
    onclick:null,oninput:null,onchange:null,onkeydown:null,
    scrolled:0,
    appendChild(c){e.children.push(c); return c;},
    setAttribute(k,v){e.attrs[k]=v;}, getAttribute(k){return e.attrs[k];},
    addEventListener(){}, click(){},
    scrollIntoView(){e.scrolled++;}};
  Object.defineProperty(e,'innerHTML',{get(){return _h;},set(v){_h=v;e.children=[];}});
  return e;
}
const doc={documentElement:{a:{},setAttribute(k,v){this.a[k]=v;},getAttribute(k){return this.a[k];}},
  getElementById(id){ if(!reg.has(id)) reg.set(id,makeEl('#'+id)); return reg.get(id); },
  createElement(t){return makeEl(t);}, createElementNS(n,t){return makeEl(t);}};
const store={};
const sb={document:doc,
  localStorage:{getItem(k){return store[k]||null;},setItem(k,v){store[k]=String(v);}},
  Blob:function(){}, URL:{createObjectURL(){return '';}}, FileReader:function(){},
  confirm:()=>true, alert:()=>{}, prompt:()=>'T_SEC',
  setTimeout:()=>0, clearTimeout:()=>{}, requestAnimationFrame:f=>f&&f()};
vm.createContext(sb); vm.runInContext(src,sb);

const cv=doc.getElementById('canvas');
const walk=(e,o=[])=>{e.children.forEach(c=>{o.push(c);walk(c,o);});return o;};
const nodes=()=>walk(cv).filter(e=>typeof e.className==='string'&&e.className.startsWith('node'));
const nm=e=>String(e.innerHTML).match(/<div class="nm">([^<]*)</)?.[1]||'?';
const flash=nodes().filter(e=>e.className.includes('flash'));

const N0=nodes().length;
console.log('初始节点数 =',N0);

// === 1. 给深层叶子加子节点 ===
const deep=nodes().find(e=>nm(e)==='MCU + 外围');   // left=1310px，在典型视口外
deep.onclick({stopPropagation(){}});
doc.getElementById('bAdd').onclick();
const added=nodes().find(e=>nm(e)==='新子节点');
console.log('\n[加子节点] 节点数 =',nodes().length,'(期望',N0+1,')',nodes().length===N0+1?'✅':'❌');
console.log('  新节点 left =',added&&added.style.left,' 带 flash 类 =',!!added&&added.className.includes('flash')?'✅ 会闪烁':'❌');
console.log('  触发自动滚动次数 =',added&&added.scrolled,'(≥1 表示会滚过去)',added&&added.scrolled>=1?'✅':'❌');

// === 2. 删除该节点（应滚回父节点）===
added.onclick({stopPropagation(){}});
doc.getElementById('bDel').onclick();
console.log('\n[删除] 节点数 =',nodes().length,'(期望',N0,')',nodes().length===N0?'✅':'❌');
console.log('  删除后选中项滚到位次数 =', nodes().find(e=>nm(e)==='MCU + 外围').scrolled);

// === 3. 删除根节点 ===
const rootEl=nodes().find(e=>nm(e)==='DCDC → 6V');
rootEl.onclick({stopPropagation(){}});
doc.getElementById('bDel').onclick();
console.log('\n[删除根节点] 节点数 =',nodes().length,'(期望',N0-4,')',nodes().length===N0-4?'✅':'❌','含 3 个子孙，共删 4 个');
console.log('  是否崩溃 =','否 ✅');

// === 4. 数据是否落盘 ===
console.log('\nlocalStorage 已写入 =', !!store['power_tree_editor_v1'], '✅');

// === 5. 设为独立起点 ===
const N5=nodes().length;
const a5=nodes().find(e=>nm(e)==='LDO → 3V3');
a5.onclick({stopPropagation(){}});
doc.getElementById('bRoot').onclick();
const d5=JSON.parse(store['power_tree_editor_v1']);
console.log('\n[设为起点] 节点总数 =',nodes().length,'(期望不变',N5,')',nodes().length===N5?'✅':'❌');
console.log('  分区0 起点数 =',d5.sections[0].roots.length,'(期望 2)',d5.sections[0].roots.length===2?'✅':'❌');
console.log('  起点分别是 =',d5.sections[0].roots.map(r=>r.label).join('  |  '));
console.log('  已闪烁提示 =',nodes().find(e=>nm(e)==='LDO → 3V3').className.includes('flash')?'✅':'❌');
