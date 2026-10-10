/*
 * graph.html 的 jsdom 验证
 *   NODE_PATH=<node workspace>/node_modules node _test/jsdom_graph.js
 *
 * 覆盖：初始渲染 / 新增节点 / 拖动 / 连线（含拒绝规则）/ 删线删点 /
 *       自动布局 / 并联多进一出 / 「输入时面板不重建」(=不再掉焦点)
 */
const {JSDOM}=require('jsdom');
const fs=require('fs');
const ROOT='C:/Users/彧/Desktop/無限進步/WorkBuddy/XYDownforceWing/power-tree-editor/';

const errs=[];
const dom=new JSDOM(fs.readFileSync(ROOT+'graph.html','utf8'),{
  runScripts:'dangerously', pretendToBeVisual:true, url:'http://localhost/',
  beforeParse(w){
    w.HTMLElement.prototype.scrollIntoView=function(){};
    if(!w.PointerEvent) w.PointerEvent=w.MouseEvent;
    w.Element.prototype.setPointerCapture=function(){};
    w.Element.prototype.releasePointerCapture=function(){};
    w.confirm=()=>true;          // jsdom 没实现 confirm，不桩的话删除类操作会被卡住
    w.alert=()=>{};
    w.addEventListener('error',e=>errs.push(String((e.error&&e.error.stack)||e.message)));
  }});
const w=dom.window, d=w.document;
let fakeHit=null;                       // elementFromPoint 的假目标
d.elementFromPoint=()=>fakeHit;         // jsdom 无布局引擎，只能桩掉

const stage=d.getElementById('stage');
const nodes=()=>d.querySelectorAll('.node');
const wires=()=>d.querySelectorAll('.wire-hit');
const byLabel=t=>[...nodes()].find(e=>e.querySelector('.nm').textContent===t);
const pd=(el,x,y)=>el.dispatchEvent(new w.PointerEvent('pointerdown',{bubbles:true,clientX:x,clientY:y}));
const pm=(x,y)=>stage.dispatchEvent(new w.PointerEvent('pointermove',{bubbles:true,clientX:x,clientY:y}));
const pu=(x,y)=>stage.dispatchEvent(new w.PointerEvent('pointerup',{bubbles:true,clientX:x,clientY:y}));
const P=(n,p)=>n.querySelector('.port.'+p);
let pass=0,fail=0;
const chk=(name,got,want)=>{const ok=got===want;ok?pass++:fail++;
  console.log('  '+(ok?'✅':'❌')+' '+name+' = '+got+(ok?'':'  (期望 '+want+')'));};

console.log('=== 1. 初始渲染 ===');
chk('节点数',nodes().length,12);
chk('连线数',wires().length,11);

console.log('\n=== 2. 并联（多进一出）已存在于示例 ===');
const mcu=byLabel('MCU + 外围');
const mcuCard=mcu.querySelector('.dt').textContent;
chk('MCU 显示多路汇入', /2路汇入/.test(mcuCard)?'是':'否','是');

console.log('\n=== 3. 拖动节点 ===');
const beforeStyle=mcu.style.transform;
pd(mcu,200,200); pm(260,240); pu(260,240);
chk('位移后 transform 变了', mcu.style.transform!==beforeStyle?'是':'否','是');

console.log('\n=== 4. 连线规则 ===');
function tryLink(srcLabel,srcPort,dstLabel,dstPort){
  const n0=wires().length;
  const src=byLabel(srcLabel), dst=byLabel(dstLabel);
  pd(P(src,srcPort),100,100);
  fakeHit=P(dst,dstPort);
  pm(300,300); pu(300,300);
  return wires().length-n0;
}
chk('①合法 舵机#1.out → USB.in', tryLink('舵机 #1','out','USB / 外设','in'), 1);
chk('②拒绝 自己连自己',          tryLink('USB / 外设','out','USB / 外设','in'), 0);
chk('③拒绝 out→out',            tryLink('USB / 外设','out','舵机 #1','out'), 0);
chk('④拒绝 重复连线',            tryLink('舵机 #1','out','USB / 外设','in'), 0);

console.log('\n=== 5. 删除 ===');
// 点一条线选中 -> 按 Delete
const n5=wires().length;
wires()[0].dispatchEvent(new w.PointerEvent('pointerdown',{bubbles:true}));
d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Delete',bubbles:true}));
chk('删线后连线数',wires().length,n5-1);
const n5b=nodes().length;
byLabel('舵机 #2').dispatchEvent(new w.PointerEvent('pointerdown',{bubbles:true,clientX:1,clientY:1}));
d.getElementById('bnDel').click();
chk('删节点后节点数',nodes().length,n5b-1);

console.log('\n=== 6. 整理版面 ===');
const n6=nodes().length;
const pos1=[...nodes()].map(e=>e.style.transform).join('|');
d.getElementById('btnTidy').click();
chk('整理后节点数不变',nodes().length,n6);
chk('坐标被重排',[...nodes()].map(e=>e.style.transform).join('|')!==pos1?'是':'否','是');

console.log('\n=== 7. 输入时面板不重建（＝不掉焦点）===');
const target=byLabel('220V 市电');
pd(target,50,50); pu(50,50);
const f1=d.getElementById('fL');
f1.value='改过的名字';
f1.dispatchEvent(new w.Event('input',{bubbles:true}));
const f2=d.getElementById('fL');
chk('输入框是同一个 DOM（焦点不丢）', f1===f2?'是':'否','是');
chk('方块文字已同步更新', target.querySelector('.nm').textContent,'改过的名字');

console.log('\n=== 8. 新增节点 ===');
const n8=nodes().length;
d.getElementById('btnAdd').click();
chk('新增后节点数',nodes().length,n8+1);

console.log('\n=== 9. 数据落盘 ===');
chk('localStorage 已写', !!w.localStorage.getItem('power_tree_graph_v1')?'是':'否','是');

console.log('\n=== 10. 拖动中途被取消（pointercancel）→ 必须能松手 ===');
// 这是真实 bug：触摸设备拖拽被系统手势接管，只发 pointercancel 不发 pointerup，
// 若不处理，drag 永远挂着 -> 表现为「抓住了松不开」。
const tg=byLabel('USB / 外设');
const posStart=tg.style.transform;
pd(tg,30,30); pm(90,90);
const during=tg.style.transform;
stage.dispatchEvent(new w.PointerEvent('pointercancel',{bubbles:true,clientX:90,clientY:90}));
const afterCancel=tg.style.transform;
pm(300,300);                 // cancel 之后再移动，不应再拖动（drag 已清）
chk('pointercancel 后拖动被终止', tg.style.transform===afterCancel?'是':'否','是');
chk('拖动过程中确实有位移', during!==posStart?'是':'否','是');

console.log('\n'+(errs.length?'⚠ 页面异常:\n'+errs.join('\n'):'✅ 无 JS 异常'));
console.log('\n结果：'+pass+' 通过 / '+fail+' 失败');

console.log('\n'+(errs.length?'⚠ 页面异常:\n'+errs.join('\n'):'✅ 无 JS 异常'));
console.log('\n结果：'+pass+' 通过 / '+fail+' 失败');
