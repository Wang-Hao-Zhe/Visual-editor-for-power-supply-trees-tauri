/*
 * 用 jsdom（真实 DOM 实现）复现"增删节点不渲染"的操作路径
 *
 *   node _test/jsdom_probe.js
 *
 * 和 harness.js 的区别：harness 是手写 DOM 桩（只能验证数据层），
 * jsdom 是完整的 DOM 实现（innerHTML 会被真实解析成元素、事件正常派发、
 * 元素销毁/重建与浏览器一致），能验证「画面到底有没有重绘」。
 */
const {JSDOM}=require('jsdom');
const fs=require('fs');
const ROOT='C:/Users/彧/Desktop/無限進步/WorkBuddy/XYDownforceWing/power-tree-editor/';

function boot(file){
  const errs=[];
  const dom=new JSDOM(fs.readFileSync(file,'utf8'),{
    runScripts:'dangerously', pretendToBeVisual:true, url:'http://localhost/',
    beforeParse(w){
      w.HTMLElement.prototype.scrollIntoView=function(){};  // jsdom 未实现
      w.addEventListener('error',e=>errs.push(String((e.error&&e.error.stack)||e.message)));
    }});
  const w=dom.window, d=w.document;
  return {
    w,d,errs,
    count:()=>d.querySelectorAll('#canvas .node').length,
    names:()=>[...d.querySelectorAll('#canvas .node .nm')].map(e=>e.textContent),
    fire:(el,type)=>el.dispatchEvent(new w.Event(type,{bubbles:true}))
  };
}

function scenario(file,label,mode){
  console.log('\n===== '+label+' =====');
  const {w,d,errs,count,names,fire}=boot(file);
  const N0=count();
  console.log('初始节点数 =',N0);

  // 选一个有子节点的节点（模拟用户点中间层）
  const nodes=[...d.querySelectorAll('#canvas .node')];
  const target=nodes[2];
  console.log('选中 =',target.querySelector('.nm').textContent);
  target.click();
  console.log('  选中后节点数 =',count(),'(应不变)');

  if(mode==='typeFirst'){
    // 关键场景：先在输入框里改点东西（会触发 oninput -> render -> 面板重建）
    let inp=d.getElementById('fL');
    inp.value=inp.value+'X';
    fire(inp,'input');
    console.log('  在名称框输入后 =',count(),'| 面板是否重建 =',
      d.getElementById('fL')!==inp ? '是（旧元素已销毁）' : '否');
  }

  const bAdd=d.getElementById('bAdd');
  console.log('  bAdd 能否拿到 =',!!bAdd,'| onclick 是否绑定 =',typeof bAdd.onclick);
  try{ bAdd.click(); }catch(e){ console.log('  ⚠ bAdd.click() 抛异常:',e.message); }

  const N1=count();
  const added=names().filter(x=>x==='新子节点').length;
  console.log('  → 点 +子节点 后节点数 =',N1,'/ 期望',N0+1, N1===N0+1?'✅ 立刻渲染出来了':'❌ DOM 里没有出现');
  console.log('  → 画布上「新子节点」个数 =',added);

  // 只看 DOM 是否变化，不涉及视觉
  if(errs.length){ console.log('  ⚠ 页面异常:'); errs.forEach(e=>console.log('    '+e.split('\n')[0])); }
  else console.log('  无 JS 异常');
  return {N0,N1,ok:N1===N0+1};
}

scenario(ROOT+'_test/old_version.html','旧版 4fa9bfe · 直接点 +子节点','direct');
scenario(ROOT+'_test/old_version.html','旧版 4fa9bfe · 先在输入框打个字再点','typeFirst');
scenario(ROOT+'index.html','当前版本 · 直接点 +子节点','direct');
scenario(ROOT+'index.html','当前版本 · 先在输入框打个字再点','typeFirst');
