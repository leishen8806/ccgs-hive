/*!
 * CCGS styles-pack.js —— 7 种大屏风格（网状 Mesh / 星系 / 叶脉 / 电路板 / 暗河 / 分拣工厂 / 神经网络）
 * 从 views.html 原样抽出的画面代码，只改了接口。依赖：window.d3（7.9.0）。不含任何回放/调度逻辑。
 *
 * 用法：
 *   const pack = CCGSStylePack.create(hostDiv, window.CCGS49, { legend:true, hubLogo:'assets/drlife-logo-mark.png' });
 *   // hubLogo 可选：网状视图中枢圆里显示的图片（不传则显示原六边形）；hubLogoSize 可选 [宽,高]，默认 [54,66]
 *   // hostDiv：宿主容器，内部按 1920×852 逻辑坐标绘制；宿主需 position:relative/absolute，宽高 1920×852（随整页一起缩放即可）
 *   pack.setStyle('galaxy');              // 'mesh'|'galaxy'|'leaf'|'pcb'|'cave'|'factory'|'neural'
 *   pack.resize(K);                       // K = 页面缩放比例 × devicePixelRatio（窗口变化时调用）
 *   // 每帧：
 *   pack.frame(dt, agents, info);
 *     dt     ：本帧经过的秒数（已乘速度；暂停时传 0）
 *     agents ：当前所有岗位蜂 [{ key, roleId, src, state, frac }]
 *              key   稳定唯一键（同一只蜂每帧相同）
 *              src   资料源 id（ccgs49-data.js 的 sources[].id）
 *              state 'wait'|'out'|'collect'|'back'|'drop'（停靠的蜂不要传，或传 'wait'）
 *              frac  0→1 = 从中心到资料源的进度；out 由 0 增到 1，back 由 1 减到 0，collect 传 1，drop 传 0
 *     info   ：{ mode:'replay'|'live'|'demo', centerText:'已完成运行 6（真实）', reduced:false, runs:[{roleId,start,end}] }
 *              runs 可选；不传时用 ccgs49-data.js 里的 runs.runs。用于网状视图的 ×N 次数和琥珀边。
 *   pack.reset();                         // 回放重新开始时调用，清空粒子与计数
 *   pack.legendHtml(mode)                 // 当前风格的图例 HTML（options.legend=true 时模块自己显示在宿主内）
 *   pack.STYLES                           // [{id,name}]
 * 状态切换由模块自己识别：进入 collect 时资料源点亮；collect→back 时网状视图出现入线粒子；
 * back→drop / 从列表消失 时算一次归集（中心闪光、网状视图交付物线亮起、有产出文件的标签闪亮）。
 */
(function(){
'use strict';
const STYLE_CSS=`
.csp-host{--bg:#070b0e;--line:#1d2c33;--ink:#e9eef0;--muted:#8299a1;--dim:#4f646c;--amber:#f0c27b;--amber2:#ffdca3;--blue:#9fd3ea;--teal:#3fd6b0;position:relative;width:1920px;height:852px;overflow:hidden;font-family:"Microsoft YaHei","PingFang SC","Segoe UI",sans-serif;color:var(--ink)}
.csp-host *{box-sizing:border-box}
.csp-cv{position:absolute;left:0;top:0;width:1920px;height:852px}
.csp-mesh{position:absolute;left:0;top:0;width:1920px;height:852px;display:none;background:radial-gradient(ellipse 900px 600px at 1100px 430px,rgba(63,214,176,.05),transparent 70%),#070b0e}
.csp-svg,.csp-mcv{position:absolute;left:0;top:0;width:1920px;height:852px}
.csp-mcv{pointer-events:none}
.csp-mhtml{position:absolute;left:0;top:0;width:1920px;height:852px;pointer-events:none}
.csp-mhtml>*{pointer-events:auto}
.csp-legend{position:absolute;max-width:700px;font-size:12px;color:var(--muted);background:rgba(7,11,14,.78);border:1px solid var(--line);border-radius:6px;padding:7px 12px;line-height:1.6;pointer-events:none;z-index:6}
.csp-legend b{color:var(--ink);font-weight:500}
.csp-tip{position:absolute;pointer-events:none;z-index:30;max-width:360px;padding:9px 12px;border-radius:8px;background:rgba(6,12,15,.96);border:1px solid var(--blue);font-size:12px;line-height:1.7;opacity:0;transition:opacity .12s;box-shadow:0 0 18px rgba(159,211,234,.18)}
.csp-tip h4{font-size:14px;font-weight:500;color:var(--amber);margin:0 0 2px}
.csp-tip span{color:var(--muted)}
/* mesh html */
.csp-spill{position:absolute;left:30px;width:118px;height:24px;display:flex;align-items:center;justify-content:space-between;padding:0 8px;background:#d5dee1;color:#0a1216;border-radius:2px;font:600 11px Consolas,monospace;letter-spacing:.03em;cursor:pointer}
.csp-spill em{font-style:normal;font-weight:400;color:#47595f;font-size:10px}
.csp-spill.on{background:#3fd6b0;box-shadow:0 0 14px rgba(63,214,176,.6)}
.csp-spill.rel{background:#f0c27b}
.csp-pill{position:absolute;left:650px;width:190px;height:15px;display:flex;align-items:center;gap:6px;padding:0 6px 0 1px;border:1px solid color-mix(in srgb,var(--c) 55%,transparent);border-radius:8px;background:#0b1317;font-size:11px;line-height:1;color:#c9d6da;cursor:pointer;white-space:nowrap;overflow:hidden}
.csp-pill .csp-pb{flex:none;font:600 9px/13px Consolas,monospace;padding:0 4px;border-radius:6px;background:var(--c);color:#071014}
.csp-pill .csp-pn{overflow:hidden;text-overflow:ellipsis}
.csp-pill .csp-pr{margin-left:auto;font:9px Consolas,monospace;color:var(--amber)}
.csp-pill.ran{border-color:var(--amber)}
.csp-pill.act{background:color-mix(in srgb,var(--c) 30%,#0b1317);box-shadow:0 0 12px var(--c);color:#fff}
.csp-pill.rel{background:color-mix(in srgb,var(--c) 18%,#0b1317);color:#fff}
.csp-pill.dim,.csp-tag.dim,.csp-spill.dim{opacity:.28}
.csp-card{position:absolute;width:250px;border:1px solid var(--amber);border-radius:9px;background:#0b1317;padding:10px 13px;font-size:11px;color:var(--muted);line-height:1.45;box-shadow:0 0 22px rgba(240,194,123,.07)}
.csp-card.sp{border-color:#5d7880}
.csp-card .csp-ct{display:flex;justify-content:space-between;align-items:center;color:var(--ink);font-size:14px;font-weight:600}
.csp-card .csp-ok{width:20px;height:20px;border-radius:4px;background:var(--amber);color:#0b1317;display:flex;align-items:center;justify-content:center;font-size:12px}
.csp-card.sp .csp-ok{background:#5d7880;color:#e9eef0}
.csp-card .csp-cs{font:10px Consolas,monospace;color:var(--dim);margin-bottom:6px}
.csp-card .csp-tg{display:flex;align-items:center;gap:6px;color:#9fd3ea;margin-bottom:6px}
.csp-card .csp-tg i{width:22px;height:11px;border-radius:6px;background:#2f7fd0;position:relative}
.csp-card .csp-tg i::after{content:"";position:absolute;right:2px;top:2px;width:7px;height:7px;border-radius:50%;background:#fff}
.csp-card .csp-cl{font-size:9px;color:var(--dim);margin-top:5px}
.csp-card .csp-cvv{color:#c9d6da}
.csp-card .csp-cvv code{font:10px Consolas,monospace;background:#1d2a30;color:#9fd3ea;padding:0 4px;border-radius:3px}
.csp-card .csp-cf{text-align:right;font-size:10px;color:var(--dim);margin-top:6px}
.csp-tag{position:absolute;width:206px;height:18px;padding:0 6px;display:flex;align-items:center;gap:6px;font:11px Consolas,"Microsoft YaHei",monospace;background:#18232a;color:#9fb3ba;border-radius:2px;white-space:nowrap;overflow:hidden;cursor:pointer}
.csp-tag em{font-style:normal;font-size:9px;color:var(--dim);flex:none}
.csp-tag span{overflow:hidden;text-overflow:ellipsis}
.csp-tag.art{background:#3a2f1c;color:var(--amber2)}
.csp-tag.art em{color:var(--amber)}
.csp-tag.rel{background:#24414a;color:#e9eef0}
.csp-tag.hot{background:#f0c27b;color:#0b1317}
.csp-tag.hot em{color:#5a4320}
.csp-hub-l{position:absolute;left:198px;top:478px;width:104px;text-align:center;font:600 10px Consolas,monospace;letter-spacing:.06em;color:#0b1317;background:#d5dee1;border-radius:2px;padding:2px 0;pointer-events:none}
.csp-col-h{position:absolute;top:-2px;font:10px Consolas,monospace;color:var(--dim);letter-spacing:.06em;pointer-events:none}
.csp-svg path{fill:none}
.csp-svg .e{stroke-width:.8;opacity:.22;transition:opacity .15s}
.csp-svg.focus .e{opacity:.035}
.csp-svg.focus .e.hl{opacity:.85;stroke-width:1.3}
.csp-svg .e.hot{opacity:.75;stroke-width:1.2}
.csp-svg .tmp{stroke:#3fd6b0;stroke-width:1.4;opacity:.9;stroke-dasharray:4 4}
`;
const hm=ms=>new Date(ms).toTimeString().slice(0,8);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function rng(seed){ return ()=>{ seed|=0; seed=seed+0x6D2B79F5|0; let t=Math.imul(seed^seed>>>15,1|seed); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
const MW=1920, MH=852, TAU=Math.PI*2;
const STYLE_LIST=[{id:'mesh',name:'网状 Mesh'},{id:'galaxy',name:'星系'},{id:'leaf',name:'叶脉'},{id:'pcb',name:'电路板'},{id:'cave',name:'暗河'},{id:'factory',name:'分拣工厂'},{id:'neural',name:'神经网络'}];

function create(host,D,options={}){
if(!window.d3) throw new Error('styles-pack 需要 d3');
if(!D||!D.roles||!D.sources) throw new Error('styles-pack 需要 ccgs49-data.js 数据');
if(!document.getElementById('csp-style')){ const st=document.createElement('style'); st.id='csp-style'; st.textContent=STYLE_CSS; document.head.appendChild(st); }
host.classList.add('csp-host'); host.innerHTML='';
const ROLES=D.roles, SOURCES=D.sources, FLOWS=D.workflows||[];
const roleById=Object.fromEntries(ROLES.map(r=>[r.id,r])), roleBySlug=Object.fromEntries(ROLES.map(r=>[r.slug,r]));
const srcById=Object.fromEntries(SOURCES.map(s=>[s.id,s]));
ROLES.forEach(r=>r.inputs.forEach(i=>{ if(!srcById[i.src]) i.src=SOURCES[0].id; }));
const GROUPS=[...new Set(ROLES.map(r=>r.group))];
const GPAL=['#ffdca3','#f0c27b','#7fd3ea','#b9a8ec','#8fd8ba','#eba9a1','#c9d48a'];
const gcol=g=>GPAL[GROUPS.indexOf(g)%GPAL.length];
const num=id=>String(id).replace(/\D+/g,'');
const srcUsers={}; SOURCES.forEach(s=>srcUsers[s.id]=new Set()); ROLES.forEach(r=>r.inputs.forEach(i=>srcUsers[i.src].add(r)));
const ARTS=(D.runs&&D.runs.artifacts)||{};
let info={mode:'replay',centerText:'',reduced:false}, reduced=false, simT=0, deposits=0, K=1;
const A=[]; const byKey=new Map(); let seq=0;
const runsList=()=>info.runs||((D.runs&&D.runs.runs)||[]);
function countRuns(){ const c={}; for(const r of runsList()) if(r.roleId) c[r.roleId]=(c[r.roleId]||0)+1; return c; }
const meshSvg=document.createElementNS('http://www.w3.org/2000/svg','svg'); meshSvg.setAttribute('class','csp-svg'); meshSvg.setAttribute('viewBox','0 0 1920 852');
const meshCv=document.createElement('canvas'); meshCv.className='csp-mcv'; const mctx=meshCv.getContext('2d');
const meshHtml=document.createElement('div'); meshHtml.className='csp-mhtml';
const meshBox=document.createElement('div'); meshBox.className='csp-mesh'; meshBox.append(meshSvg,meshCv,meshHtml);
const legendEl=document.createElement('div'); legendEl.className='csp-legend';
const tip=document.createElement('div'); tip.className='csp-tip';
/* ================= 几何工具 ================= */
function mkPoly(pts){ const P=[pts[0]]; for(let i=1;i<pts.length;i++){ const a=P[P.length-1],b=pts[i]; if(Math.hypot(b.x-a.x,b.y-a.y)>.01) P.push(b); } const cum=[0]; for(let i=1;i<P.length;i++) cum.push(cum[i-1]+Math.hypot(P[i].x-P[i-1].x,P[i].y-P[i-1].y)); return {pts:P,cum,len:cum[cum.length-1]||1}; }
function at(poly,f,off=0){ const P=poly.pts; if(P.length<2) return {x:P[0].x,y:P[0].y,ang:0};
  const L=Math.max(0,Math.min(1,f))*poly.len; let lo=0,hi=poly.cum.length-1; while(hi-lo>1){ const m=(lo+hi)>>1; if(poly.cum[m]<L) lo=m; else hi=m; }
  const a=P[lo],b=P[hi],seg=(poly.cum[hi]-poly.cum[lo])||1,k=(L-poly.cum[lo])/seg,ang=Math.atan2(b.y-a.y,b.x-a.x);
  return {x:a.x+(b.x-a.x)*k-Math.sin(ang)*off,y:a.y+(b.y-a.y)*k+Math.cos(ang)*off,ang}; }
function quad(p0,c,p1,n=24){ const o=[]; for(let i=0;i<=n;i++){ const t=i/n,u=1-t; o.push({x:u*u*p0.x+2*u*t*c.x+t*t*p1.x,y:u*u*p0.y+2*u*t*c.y+t*t*p1.y}); } return o; }
function cubic(p0,p1,p2,p3,n=28){ const o=[]; for(let i=0;i<=n;i++){ const t=i/n,u=1-t; o.push({x:u*u*u*p0.x+3*u*u*t*p1.x+3*u*t*t*p2.x+t*t*t*p3.x,y:u*u*u*p0.y+3*u*u*t*p1.y+3*u*t*t*p2.y+t*t*t*p3.y}); } return o; }
function hcurve(x1,y1,x2,y2,k=.5,n=28){ const dx=(x2-x1)*k; return cubic({x:x1,y:y1},{x:x1+dx,y:y1},{x:x2-dx,y:y2},{x:x2,y:y2},n); }
function hpath(x1,y1,x2,y2,k=.5){ const dx=(x2-x1)*k; return `M${x1},${y1}C${x1+dx},${y1} ${x2-dx},${y2} ${x2},${y2}`; }
function catmull(pts,n=18){ const P=[pts[0],...pts,pts[pts.length-1]],o=[]; for(let i=1;i<P.length-2;i++){ const p0=P[i-1],p1=P[i],p2=P[i+1],p3=P[i+2]; for(let k=0;k<n;k++){ const t=k/n,t2=t*t,t3=t2*t; o.push({x:.5*((2*p1.x)+(-p0.x+p2.x)*t+(2*p0.x-5*p1.x+4*p2.x-p3.x)*t2+(-p0.x+3*p1.x-3*p2.x+p3.x)*t3),y:.5*((2*p1.y)+(-p0.y+p2.y)*t+(2*p0.y-5*p1.y+4*p2.y-p3.y)*t2+(-p0.y+3*p1.y-3*p2.y+p3.y)*t3)}); } } o.push(pts[pts.length-1]); return o; }
function chamfer(pts,c=13){ const P=mkPoly(pts).pts; if(P.length<3) return P; const o=[P[0]]; for(let i=1;i<P.length-1;i++){ const a=P[i-1],b=P[i],n=P[i+1],d1=Math.hypot(b.x-a.x,b.y-a.y),d2=Math.hypot(n.x-b.x,n.y-b.y),k1=Math.min(c,d1/2),k2=Math.min(c,d2/2); o.push({x:b.x-(b.x-a.x)/d1*k1,y:b.y-(b.y-a.y)/d1*k1},{x:b.x+(n.x-b.x)/d2*k2,y:b.y+(n.y-b.y)/d2*k2}); } o.push(P[P.length-1]); return o; }
function strokePts(g,pts){ g.beginPath(); pts.forEach((p,i)=>i?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y)); g.stroke(); }
const spriteCache={};
function glow(rgb,size=64){ const k=rgb+size; if(spriteCache[k]) return spriteCache[k]; const c=document.createElement('canvas'); c.width=c.height=size; const g=c.getContext('2d'),gr=g.createRadialGradient(size/2,size/2,0,size/2,size/2,size/2); gr.addColorStop(0,`rgba(${rgb},1)`); gr.addColorStop(.25,`rgba(${rgb},.45)`); gr.addColorStop(1,`rgba(${rgb},0)`); g.fillStyle=gr; g.fillRect(0,0,size,size); return spriteCache[k]=c; }
function glowAt(g,rgb,x,y,r,a=1){ g.globalAlpha=a; g.drawImage(glow(rgb),x-r,y-r,r*2,r*2); g.globalAlpha=1; }
function label(g,text,x,y,{size=13,color='#e9eef0',align='center',weight=500,font='"Microsoft YaHei",sans-serif',shadow=true}={}){ g.font=`${weight} ${size}px ${font}`; g.textAlign=align; g.textBaseline='middle'; if(shadow){ g.lineWidth=3; g.strokeStyle='rgba(3,6,8,.85)'; g.strokeText(text,x,y); } g.fillStyle=color; g.fillText(text,x,y); }

/* ================= 智能体造型 ================= */
function drawSpider(g,x,y,ang,o){
  g.save(); g.translate(x,y); g.rotate(ang+Math.PI/2); const s=o.scale||1; g.scale(s,s); g.lineCap='round'; g.lineJoin='round';
  g.strokeStyle=o.leg; g.lineWidth=1.3;
  for(const sd of [-1,1]) for(let k=0;k<4;k++){ const by=-3+k*2.6, w=Math.sin(o.phase*15+k*1.7+(sd>0?0:Math.PI))*1.8;
    g.beginPath(); g.moveTo(sd*3,by); g.lineTo(sd*(9+w*.4),by-4+k*1.2+w); g.lineTo(sd*(13+k*.6),by+3+k*1.8+w*.6); g.stroke(); }
  g.fillStyle=o.body; g.beginPath(); g.ellipse(0,6,5,7,0,0,TAU); g.fill(); g.beginPath(); g.arc(0,-4,4.2,0,TAU); g.fill();
  g.fillStyle=o.mark; g.globalAlpha=.85; g.fillRect(-3.5,4,7,1.4); g.fillRect(-3,7.5,6,1.4); g.globalAlpha=1;
  g.fillStyle=o.eye; g.beginPath(); g.arc(-1.7,-5.8,1.1,0,TAU); g.arc(1.7,-5.8,1.1,0,TAU); g.fill();
  if(o.carry){ g.shadowColor=o.carry; g.shadowBlur=10; g.fillStyle=o.carry; if(o.box){ g.fillRect(-4.5,12,9,8); g.shadowBlur=0; g.strokeStyle='rgba(0,0,0,.4)'; g.lineWidth=1; g.strokeRect(-4.5,12,9,8); } else { g.beginPath(); g.moveTo(0,12); g.bezierCurveTo(-5,18,-3,22,0,22); g.bezierCurveTo(3,22,5,18,0,12); g.fill(); } g.shadowBlur=0; }
  g.restore();
}
function drawShip(g,x,y,ang,o){
  g.save(); g.translate(x,y); g.rotate(ang+Math.PI/2); const s=o.scale||1; g.scale(s,s); g.lineCap='round';
  const fl=6+Math.sin(o.phase*30)*2; const gr=g.createLinearGradient(0,8,0,8+fl*2); gr.addColorStop(0,'rgba(160,230,255,.9)'); gr.addColorStop(1,'rgba(160,230,255,0)');
  g.fillStyle=gr; g.beginPath(); g.moveTo(-3,8); g.lineTo(0,8+fl*2); g.lineTo(3,8); g.fill();
  g.strokeStyle=o.leg; g.lineWidth=1.1; for(const sd of [-1,1]) for(let k=0;k<3;k++){ const w=Math.sin(o.phase*10+k)*1.2; g.beginPath(); g.moveTo(sd*4,-1+k*3); g.lineTo(sd*(10+w),-4+k*4); g.lineTo(sd*12,1+k*4); g.stroke(); }
  g.fillStyle=o.body; g.beginPath(); g.moveTo(0,-12); g.lineTo(6,6); g.lineTo(0,9); g.lineTo(-6,6); g.closePath(); g.fill();
  g.strokeStyle=o.mark; g.lineWidth=1; g.stroke();
  g.fillStyle=o.eye; g.beginPath(); g.arc(0,-4,2,0,TAU); g.fill();
  if(o.carry){ g.shadowColor=o.carry; g.shadowBlur=10; g.fillStyle=o.carry; g.beginPath(); g.arc(0,14,3.2,0,TAU); g.fill(); g.shadowBlur=0; }
  g.restore();
}
function drawBug(g,x,y,ang,o){
  g.save(); g.translate(x,y); g.rotate(ang+Math.PI/2); const s=o.scale||1; g.scale(s,s); g.lineCap='round';
  g.strokeStyle=o.leg; g.lineWidth=1.2;
  for(const sd of [-1,1]) for(let k=0;k<3;k++){ const w=Math.sin(o.phase*16+k*2.1+(sd>0?0:Math.PI))*2; g.beginPath(); g.moveTo(sd*2.5,-2+k*3.5); g.lineTo(sd*(7+w*.3),-4+k*4+w); g.lineTo(sd*9,0+k*4.5+w*.5); g.stroke(); }
  g.beginPath(); g.moveTo(-1.5,-8); g.quadraticCurveTo(-4,-13,-6,-14); g.moveTo(1.5,-8); g.quadraticCurveTo(4,-13,6,-14); g.stroke();
  g.fillStyle=o.body; g.beginPath(); g.ellipse(0,6,4,6.5,0,0,TAU); g.fill(); g.beginPath(); g.ellipse(0,-1,3.3,3.5,0,0,TAU); g.fill(); g.beginPath(); g.arc(0,-6,2.8,0,TAU); g.fill();
  g.fillStyle=o.mark; g.globalAlpha=.7; g.fillRect(-.6,2,1.2,9); g.globalAlpha=1;
  g.fillStyle=o.eye; g.beginPath(); g.arc(-1.2,-7,.9,0,TAU); g.arc(1.2,-7,.9,0,TAU); g.fill();
  if(o.carry){ g.shadowColor=o.carry; g.shadowBlur=9; g.fillStyle=o.carry; g.beginPath(); g.arc(0,15,3,0,TAU); g.fill(); g.shadowBlur=0; }
  g.restore();
}

/* ================= 画布主题（6 个） ================= */
const canvasEl=document.createElement('canvas'), ctx=canvasEl.getContext('2d'); canvasEl.className='csp-cv';
const staticLayer=document.createElement('canvas'), sctx=staticLayer.getContext('2d');

function baseTheme(t){ return Object.assign({nodes:{},paths:{},center:{x:960,y:426},flash:0,amb:[]},t); }
function ambientSetup(t,n,seed){ const r=rng(seed); t.amb=d3.range(n).map(()=>{ const s=SOURCES[Math.floor(r()*SOURCES.length)]; return {src:s.id,f:r(),v:.03+r()*.05,size:.8+r()*1.4}; }); }
function drawAmbient(g,t,dt,rgb,alpha=.5,dir=-1){ for(const a of t.amb){ a.f+=dir*a.v*dt; if(a.f<0)a.f+=1; if(a.f>1)a.f-=1; const p=at(t.paths[a.src],a.f); g.globalAlpha=alpha*Math.sin(a.f*Math.PI); g.fillStyle=`rgb(${rgb})`; g.beginPath(); g.arc(p.x,p.y,a.size,0,TAU); g.fill(); } g.globalAlpha=1; }

/* --- 1 星系 --- */
const GALAXY=baseTheme({id:'galaxy',name:'星系',key:'2',
  sub:'星系引力采集 · 资料源是星球，探测飞船是运行中的岗位，数据像星尘沿引力丝汇向中心恒星',
  legend:'<b>星球</b> = 18 个资料源（大小按输入条数）　<b>飞船</b> = 运行中的岗位　<b>中心恒星</b> = 归集仓',
  col:{trail:'159,211,234',drop:'205,238,250',carry:'#ffdca3'}, agent:'ship', lg:{right:'20px',bottom:'14px',maxWidth:'520px'},
  look:{body:'#cfe9f5',leg:'#7fb6c9',mark:'#3d8db0',eye:'#ffdca3',scale:1.15},
  layout(){ const C=this.center={x:960,y:420}; const rings=[{rx:280,ry:150,n:5,off:.35},{rx:480,ry:258,n:6,off:.95},{rx:700,ry:356,n:7,off:.12}];
    const order=[...SOURCES].sort((a,b)=>a.inputs-b.inputs); let k=0; this.nodes={}; this.rings=rings;
    rings.forEach(rg=>{ for(let j=0;j<rg.n;j++){ const s=order[k++]; const a=rg.off+j/rg.n*TAU; this.nodes[s.id]={x:C.x+Math.cos(a)*rg.rx,y:C.y+Math.sin(a)*rg.ry,r:6+Math.sqrt(s.inputs)*2.5,a,rg,hue:185+(k*37)%110}; } });
    for(const s of SOURCES){ const n=this.nodes[s.id], pts=[{...C}]; for(let i=1;i<=64;i++){ const t=i/64,f=.07+.93*t,a=n.a-(1-t)*1.35; pts.push({x:C.x+Math.cos(a)*n.rg.rx*f,y:C.y+Math.sin(a)*n.rg.ry*f}); } this.paths[s.id]=mkPoly(pts); }
    const r=rng(11); this.tw=d3.range(140).map(()=>({x:r()*MW,y:r()*MH,s:.6+r()*1.4,ph:r()*TAU})); ambientSetup(this,90,5); },
  drawStatic(g){ const C=this.center; let gr=g.createRadialGradient(C.x,C.y,0,C.x,C.y,1000); gr.addColorStop(0,'#0c1830'); gr.addColorStop(1,'#03050b'); g.fillStyle=gr; g.fillRect(0,0,MW,MH);
    for(const [x,y,r,c] of [[420,220,420,'90,120,230'],[1500,620,480,'150,90,210'],[1200,180,300,'60,170,200']]) glowAt(g,c,x,y,r,.09);
    const r=rng(7); for(let i=0;i<900;i++){ g.globalAlpha=.15+r()*.7; g.fillStyle=r()<.2?'#bfe3ff':'#fff'; g.fillRect(r()*MW,r()*MH,r()<.93?.9:1.7,r()<.93?.9:1.7); } g.globalAlpha=1;
    g.setLineDash([2,7]); g.strokeStyle='rgba(130,190,230,.16)'; g.lineWidth=1; for(const rg of this.rings){ g.beginPath(); g.ellipse(C.x,C.y,rg.rx,rg.ry,0,0,TAU); g.stroke(); } g.setLineDash([]);
    g.strokeStyle='rgba(120,200,240,.08)'; for(const s of SOURCES) strokePts(g,this.paths[s.id].pts);
    for(const s of SOURCES){ const n=this.nodes[s.id],col=`hsl(${n.hue},55%,62%)`; glowAt(g,`${Math.round(120+n.hue/4)},${170},235`,n.x,n.y,n.r*3.2,.35);
      gr=g.createRadialGradient(n.x-n.r*.35,n.y-n.r*.35,n.r*.1,n.x,n.y,n.r); gr.addColorStop(0,`hsl(${n.hue},70%,82%)`); gr.addColorStop(.6,col); gr.addColorStop(1,`hsl(${n.hue},45%,22%)`); g.fillStyle=gr; g.beginPath(); g.arc(n.x,n.y,n.r,0,TAU); g.fill();
      if(s.inputs>=12){ g.strokeStyle=`hsla(${n.hue},60%,75%,.55)`; g.lineWidth=1.3; g.beginPath(); g.ellipse(n.x,n.y,n.r*1.9,n.r*.55,-.35,0,TAU); g.stroke(); }
      label(g,s.short,n.x,n.y+n.r+14,{size:13}); label(g,s.inputs+' 条输入',n.x,n.y+n.r+29,{size:11,color:'#8299a1',weight:400}); } },
  drawDyn(g,dt,t){ for(const s of this.tw){ g.globalAlpha=.25+.6*Math.abs(Math.sin(t*1.3+s.ph)); g.fillStyle='#e6f6ff'; g.fillRect(s.x,s.y,s.s,s.s); } g.globalAlpha=1;
    if(!reduced) drawAmbient(g,this,dt,'190,230,250',.55);
    const C=this.center,p=1+Math.sin(t*2)*.05+this.flash*.25; g.globalCompositeOperation='lighter'; glowAt(g,'255,200,120',C.x,C.y,120*p,.55); glowAt(g,'255,236,200',C.x,C.y,46*p,.9); g.globalCompositeOperation='source-over';
    g.save(); g.translate(C.x,C.y); g.rotate(t*.08); g.strokeStyle='rgba(255,220,170,.18)'; g.lineWidth=1; for(let i=0;i<12;i++){ g.rotate(TAU/12); g.beginPath(); g.moveTo(26,0); g.lineTo(80+(i%3)*18,0); g.stroke(); } g.restore();
    g.fillStyle='#fff8ea'; g.beginPath(); g.arc(C.x,C.y,15,0,TAU); g.fill();
    label(g,'中心恒星 · 归集仓',C.x,C.y+42,{size:13,color:'#ffdca3'}); label(g,(info.centerText||''),C.x,C.y+60,{size:12,color:'#e9eef0',weight:400});
    activeHalos(g,this,'159,211,234'); } });

/* --- 2 叶脉 --- */
const LEAF=baseTheme({id:'leaf',name:'叶脉',key:'3',
  sub:'叶脉输水网络 · 叶片末梢是资料源，小虫沿叶脉采集养分，顺主脉汇入根部数据库',
  legend:'<b>叶脉末梢</b> = 18 个资料源　<b>小虫</b> = 运行中的岗位　<b>主根</b> = 归集仓（数据库）',
  col:{trail:'120,230,170',drop:'190,255,215',carry:'#d9ffb0'}, agent:'bug',
  look:{body:'#7fd6a0',leg:'#4f9c75',mark:'#1d5a3f',eye:'#eaffd0',scale:1.15},
  layout(){ const mid=s=>({x:300+1500*s,y:430-42*Math.sin(Math.PI*s)}), w=s=>350*Math.pow(Math.max(0,Math.sin(Math.PI*Math.min(1,Math.pow(Math.max(s,0),.8)))),.85);
    this.mid=mid; this.w=w; const R0=this.center={x:118,y:430};
    this.veins={}; this.nodes={};
    SOURCES.forEach((s,i)=>{ const s0=.07+i*(.8/17), side=i%2?1:-1, s1=Math.min(.985,s0+.11), m0=mid(s0), m1=mid(s1);
      const end={x:m1.x,y:m1.y+side*w(s1)*.93}, ctrl={x:mid(s0+.035).x,y:m0.y+side*w(s0)*.62};
      const vein=quad(m0,ctrl,end,26); this.veins[s.id]=vein; this.nodes[s.id]={...end,side,r:4+Math.sqrt(s.inputs)*1.4};
      const pts=[{...R0},{x:200,y:430}]; for(let k=0;k<=40;k++) pts.push(mid(s0*k/40)); pts.push(...vein); this.paths[s.id]=mkPoly(pts); });
    const r=rng(21); this.tert=[]; for(const s of SOURCES){ const vp=mkPoly(this.veins[s.id]), side=this.nodes[s.id].side; for(const t of [.3,.5,.68,.84]){ const p=at(vp,t), a=p.ang+side*(.75+r()*.4), L=26+r()*42; const e={x:p.x+Math.cos(a)*L,y:p.y+Math.sin(a)*L}; this.tert.push(quad(p,{x:(p.x+e.x)/2+Math.cos(a+side)*6,y:(p.y+e.y)/2+Math.sin(a+side)*6},e,8)); } }
    ambientSetup(this,110,9); },
  outline(){ const up=[],lo=[]; for(let i=0;i<=90;i++){ const s=i/90,m=this.mid(s),w=this.w(s); up.push({x:m.x,y:m.y-w}); lo.push({x:m.x,y:m.y+w}); } return [...up,...lo.reverse()]; },
  drawStatic(g){ let gr=g.createRadialGradient(1000,430,0,1000,430,1100); gr.addColorStop(0,'#0b1a15'); gr.addColorStop(1,'#030806'); g.fillStyle=gr; g.fillRect(0,0,MW,MH);
    const ol=this.outline(); g.beginPath(); ol.forEach((p,i)=>i?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y)); g.closePath();
    gr=g.createLinearGradient(300,0,1800,0); gr.addColorStop(0,'rgba(30,80,62,.55)'); gr.addColorStop(1,'rgba(18,52,44,.35)'); g.fillStyle=gr; g.fill(); g.strokeStyle='rgba(110,220,170,.28)'; g.lineWidth=1.4; g.stroke();
    g.save(); g.clip(); const r=rng(3); g.strokeStyle='rgba(120,220,170,.07)'; g.lineWidth=.6; for(let i=0;i<900;i++){ const x=300+r()*1500,y=60+r()*740,a=r()*TAU,L=6+r()*14; g.beginPath(); g.moveTo(x,y); g.lineTo(x+Math.cos(a)*L,y+Math.sin(a)*L); g.stroke(); } g.restore();
    g.strokeStyle='rgba(120,230,175,.35)'; g.lineWidth=.8; for(const t of this.tert) strokePts(g,t);
    g.lineCap='round'; for(const s of SOURCES){ const v=this.veins[s.id]; for(let i=1;i<v.length;i++){ g.strokeStyle='rgba(140,240,190,.55)'; g.lineWidth=2.6-1.9*(i/v.length); g.beginPath(); g.moveTo(v[i-1].x,v[i-1].y); g.lineTo(v[i].x,v[i].y); g.stroke(); } }
    for(let i=1;i<=80;i++){ const a=this.mid((i-1)/80),b=this.mid(i/80); g.strokeStyle='rgba(170,250,205,.7)'; g.lineWidth=6-4.6*(i/80); g.beginPath(); g.moveTo(a.x,a.y); g.lineTo(b.x,b.y); g.stroke(); }
    g.strokeStyle='rgba(150,190,120,.75)'; g.lineWidth=6; g.beginPath(); g.moveTo(150,430); g.lineTo(300,430); g.stroke();
    for(const s of SOURCES){ const n=this.nodes[s.id]; glowAt(g,'140,255,190',n.x,n.y,n.r*4,.5); g.fillStyle='#c9ffe0'; g.beginPath(); g.arc(n.x,n.y,n.r,0,TAU); g.fill();
      const ly=n.y+n.side*(n.r+16); label(g,s.short,n.x,ly,{size:13}); label(g,s.inputs+' 条输入',n.x,ly+n.side*15,{size:11,color:'#8299a1',weight:400}); } },
  drawDyn(g,dt,t){ if(!reduced) drawAmbient(g,this,dt,'190,255,215',.7,-1);
    const C=this.center,p=1+this.flash*.3; glowAt(g,'140,255,190',C.x,C.y,70*p,.5);
    g.fillStyle='#0f2a20'; g.strokeStyle='#8ff0be'; g.lineWidth=1.6; const x=C.x-22,y=C.y-26; g.beginPath(); g.ellipse(C.x,y,22,7,0,0,TAU); g.fill(); g.stroke(); g.fillRect(x,y,44,46); g.beginPath(); g.moveTo(x,y); g.lineTo(x,y+46); g.moveTo(x+44,y); g.lineTo(x+44,y+46); g.stroke(); g.beginPath(); g.ellipse(C.x,y+46,22,7,0,0,Math.PI); g.stroke(); g.beginPath(); g.ellipse(C.x,y+16,22,7,0,0,Math.PI); g.stroke(); g.beginPath(); g.ellipse(C.x,y+31,22,7,0,0,Math.PI); g.stroke();
    label(g,'主根 · 数据库',C.x,C.y+50,{size:13,color:'#bfffd9'}); label(g,(info.centerText||''),C.x,C.y+67,{size:12,weight:400});
    activeHalos(g,this,'140,255,190'); } });

/* --- 3 电路板 --- */
const PCB=baseTheme({id:'pcb',name:'电路板',key:'4',
  sub:'电路板走线 · 焊盘是资料源，铜箔走线是通道，机械蜘蛛沿走线抓取数据，脉冲汇入中央芯片',
  legend:'<b>焊盘</b> = 18 个资料源　<b>机械蜘蛛</b> = 运行中的岗位　<b>中央芯片</b> = 归集仓',
  col:{trail:'120,230,220',drop:'200,255,250',carry:'#9ff5ea'}, agent:'spider',
  look:{body:'#b9c7c9',leg:'#7d9396',mark:'#2f6b66',eye:'#5ff3e0',scale:1.1},
  layout(){ const C=this.center={x:960,y:426}; const H=120, L=C.x-H, R=C.x+H, T=C.y-H, B=C.y+H; this.chip={L,R,T,B};
    const S=SOURCES, xs=d3.range(6).map(i=>300+i*264), pinX=d3.range(6).map(i=>870+i*36); this.routes={};
    const mk=(s,pts,pin,inner)=>{ const route=chamfer(pts); this.routes[s.id]=route; this.nodes[s.id]={x:pts[0].x,y:pts[0].y,r:15}; this.paths[s.id]=mkPoly([{...C},inner,pin,...[...route].reverse()]); };
    const laneOf=(i,pad,pin,base,step)=>{ const left=d3.range(6).filter(j=>xs[j]<pinX[j]), right=d3.range(6).filter(j=>xs[j]>=pinX[j]); return left.includes(i)?base-left.indexOf(i)*step:base-(right.length-1-right.indexOf(i))*step; };
    for(let i=0;i<6;i++){ const s=S[i]; if(!s) continue; const pad={x:xs[i],y:70},pin={x:pinX[i],y:T},ly=laneOf(i,pad,pin,250,24); mk(s,[pad,{x:pad.x,y:ly},{x:pin.x,y:ly},pin],pin,{x:pin.x,y:T+30}); }
    for(let i=0;i<6;i++){ const s=S[6+i]; if(!s) continue; const pad={x:xs[i],y:708},pin={x:pinX[i],y:B},ly=850-laneOf(i,pad,pin,250,24); mk(s,[pad,{x:pad.x,y:ly},{x:pin.x,y:ly},pin],pin,{x:pin.x,y:B-30}); }
    const ys=[286,426,566], pinY=[390,426,462];
    for(let i=0;i<3;i++){ const s=S[12+i]; if(!s) continue; const pad={x:120,y:ys[i]},pin={x:L,y:pinY[i]}; mk(s,[pad,{x:760,y:pad.y},{x:760,y:pin.y},pin],pin,{x:L+30,y:pin.y}); }
    for(let i=0;i<3;i++){ const s=S[15+i]; if(!s) continue; const pad={x:1800,y:ys[i]},pin={x:R,y:pinY[i]}; mk(s,[pad,{x:1160,y:pad.y},{x:1160,y:pin.y},pin],pin,{x:R-30,y:pin.y}); }
    const r=rng(41); this.deco=d3.range(46).map(()=>{ let x=Math.round(r()*80)*24,y=Math.round(r()*35)*24; const pts=[{x,y}]; for(let k=0;k<3;k++){ if(k%2) y+=(r()<.5?-1:1)*(48+Math.round(r()*5)*24); else x+=(r()<.5?-1:1)*(48+Math.round(r()*6)*24); pts.push({x,y}); } return chamfer(pts,10); });
    ambientSetup(this,80,13); },
  drawStatic(g){ g.fillStyle='#061210'; g.fillRect(0,0,MW,MH); g.fillStyle='rgba(90,160,150,.13)'; for(let x=12;x<MW;x+=24) for(let y=12;y<MH;y+=24) g.fillRect(x,y,1.2,1.2);
    g.strokeStyle='rgba(90,170,160,.28)'; g.lineWidth=1.5; g.strokeRect(16,16,MW-32,MH-32);
    g.lineCap='round'; g.lineJoin='round'; g.strokeStyle='rgba(60,120,112,.22)'; g.lineWidth=2; for(const d of this.deco){ strokePts(g,d); const e=d[d.length-1]; g.fillStyle='rgba(90,160,150,.3)'; g.beginPath(); g.arc(e.x,e.y,3,0,TAU); g.fill(); }
    for(const s of SOURCES){ const pts=this.paths[s.id].pts; g.strokeStyle='#123430'; g.lineWidth=8; strokePts(g,pts); g.strokeStyle='rgba(84,180,166,.55)'; g.lineWidth=3; strokePts(g,pts); }
    const c=this.chip; g.fillStyle='#0a1817'; g.strokeStyle='#5fa89b'; g.lineWidth=2; g.fillRect(c.L,c.T,c.R-c.L,c.B-c.T); g.strokeRect(c.L,c.T,c.R-c.L,c.B-c.T);
    g.strokeStyle='rgba(95,168,155,.4)'; g.strokeRect(c.L+16,c.T+16,c.R-c.L-32,c.B-c.T-32); g.fillStyle='#5fa89b'; g.beginPath(); g.arc(c.L+28,c.T+28,5,0,TAU); g.fill();
    g.fillStyle='#8fb9b2'; for(let i=0;i<14;i++){ const v=c.L+14+i*16.4; g.fillRect(v,c.T-8,6,8); g.fillRect(v,c.B,6,8); g.fillRect(c.L-8,c.T+14+i*16.4,8,6); g.fillRect(c.R,c.T+14+i*16.4,8,6); }
    label(g,'CCGS CORE',this.center.x,this.center.y-22,{size:15,color:'#cfeee9',font:'Consolas,monospace',weight:600,shadow:false});
    for(const s of SOURCES){ const n=this.nodes[s.id]; g.fillStyle='#24423d'; g.strokeStyle='#8fe0d2'; g.lineWidth=2.2; g.beginPath(); g.arc(n.x,n.y,15,0,TAU); g.fill(); g.stroke(); g.fillStyle='#061210'; g.beginPath(); g.arc(n.x,n.y,5,0,TAU); g.fill();
      const top=n.y<100, bot=n.y>680, lft=n.x<200; const lx=lft?n.x+26:n.x>1700?n.x-26:n.x, ly=top?n.y-26:bot?n.y+26:n.y-26, al=lft?'left':n.x>1700?'right':'center';
      label(g,s.short+'  '+s.inputs,lx,ly,{size:12,color:'#d8efeb',align:al,font:'Consolas,"Microsoft YaHei",monospace'}); } },
  drawDyn(g,dt,t){ if(!reduced) for(const a of this.amb){ a.f-=a.v*1.6*dt; if(a.f<0)a.f+=1; const p=at(this.paths[a.src],a.f); g.globalCompositeOperation='lighter'; glowAt(g,'120,240,225',p.x,p.y,7,.7); g.globalCompositeOperation='source-over'; }
    const c=this.center; glowAt(g,'95,240,220',c.x,c.y,110,.15+this.flash*.4);
    label(g,'中央芯片 · 归集仓',c.x,c.y+6,{size:13,color:'#9ff5ea',shadow:false}); label(g,(info.centerText||''),c.x,c.y+28,{size:12,weight:400,shadow:false});
    activeHalos(g,this,'95,240,220'); } });

/* --- 4 暗河 --- */
const CAVE=baseTheme({id:'cave',name:'暗河',key:'5',
  sub:'地下暗河溶洞 · 泉眼是资料源，水蛛在暗流里抓取水珠数据，顺暗河汇入地下湖',
  legend:'<b>泉眼</b> = 18 个资料源　<b>水蛛</b> = 运行中的岗位　<b>地下湖</b> = 归集仓',
  col:{trail:'120,190,255',drop:'200,230,255',carry:'#cfe6ff'}, agent:'spider',
  look:{body:'#1b2c40',leg:'#7fb0e0',mark:'#7fd0ff',eye:'#bfe8ff',scale:1.15},
  layout(){ const Lk=this.lake={x:960,y:722,rx:430,ry:82}; const C=this.center={x:Lk.x,y:Lk.y};
    const spr=SOURCES.map((s,i)=>{ const a=Math.PI+(i+.5)/SOURCES.length*Math.PI; return {x:960+Math.cos(a)*860,y:722+Math.sin(a)*640}; });
    const J=d3.range(6).map(gi=>{ const g3=spr.slice(gi*3,gi*3+3); const ax=d3.mean(g3,p=>p.x),ay=d3.mean(g3,p=>p.y); return {x:ax+(C.x-ax)*.4,y:ay+(C.y-ay)*.4}; });
    const ML={x:700,y:585},MR={x:1220,y:585},EL={x:852,y:668},ER={x:1068,y:668}; this.trunks=[];
    SOURCES.forEach((s,i)=>{ const gi=Math.min(5,Math.floor(i/3)), left=gi<3; const pts=catmull([{...C},left?EL:ER,left?ML:MR,J[gi],spr[i]],14); this.paths[s.id]=mkPoly(pts); this.nodes[s.id]={...spr[i],r:5+Math.sqrt(s.inputs)*1.3}; });
    this.trunkPaths=[0,1,2,3,4,5].map(gi=>catmull([{...C},gi<3?EL:ER,gi<3?ML:MR,J[gi]],14));
    const r=rng(5); this.rocks=d3.range(70).map(()=>{ const x=r()*MW,y=r()*MH,rad=30+r()*120,n=7; return d3.range(n).map(k=>{ const a=k/n*TAU,rr=rad*(.6+r()*.5); return {x:x+Math.cos(a)*rr,y:y+Math.sin(a)*rr*.6}; }); });
    this.stal=d3.range(55).map(()=>({x:r()*MW,w:8+r()*26,h:30+r()*120}));
    this.fog=d3.range(6).map(i=>({x:r()*MW,y:200+r()*500,r:260+r()*260,v:(r()-.5)*14}));
    ambientSetup(this,0,1); },
  drawStatic(g){ let gr=g.createLinearGradient(0,0,0,MH); gr.addColorStop(0,'#02050a'); gr.addColorStop(1,'#071322'); g.fillStyle=gr; g.fillRect(0,0,MW,MH);
    for(const rk of this.rocks){ g.fillStyle='rgba(14,24,36,.65)'; g.strokeStyle='rgba(90,130,170,.06)'; g.lineWidth=1; g.beginPath(); rk.forEach((p,i)=>i?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y)); g.closePath(); g.fill(); g.stroke(); }
    for(const s of this.stal){ gr=g.createLinearGradient(0,0,0,s.h); gr.addColorStop(0,'#0d1a28'); gr.addColorStop(1,'rgba(40,80,120,.25)'); g.fillStyle=gr; g.beginPath(); g.moveTo(s.x-s.w/2,0); g.lineTo(s.x+s.w/2,0); g.lineTo(s.x,s.h); g.closePath(); g.fill(); }
    g.lineCap='round'; g.lineJoin='round';
    for(const s of SOURCES){ g.strokeStyle='rgba(60,130,210,.18)'; g.lineWidth=9; strokePts(g,this.paths[s.id].pts); }
    for(const tp of this.trunkPaths){ g.strokeStyle='rgba(60,140,220,.16)'; g.lineWidth=16; strokePts(g,tp); }
    const Lk=this.lake; gr=g.createRadialGradient(Lk.x,Lk.y,0,Lk.x,Lk.y,Lk.rx); gr.addColorStop(0,'rgba(110,200,255,.7)'); gr.addColorStop(.55,'rgba(40,110,200,.38)'); gr.addColorStop(1,'rgba(20,60,120,0)'); g.fillStyle=gr; g.beginPath(); g.ellipse(Lk.x,Lk.y,Lk.rx,Lk.ry,0,0,TAU); g.fill();
    for(const s of SOURCES){ const n=this.nodes[s.id]; glowAt(g,'110,190,255',n.x,n.y,n.r*4,.55); g.fillStyle='rgba(170,220,255,.85)'; g.beginPath(); g.ellipse(n.x,n.y,n.r*1.5,n.r*.7,0,0,TAU); g.fill();
      label(g,s.short,n.x,n.y-n.r-22,{size:13}); label(g,s.inputs+' 条输入',n.x,n.y-n.r-8,{size:11,color:'#8299a1',weight:400}); } },
  drawDyn(g,dt,t){ for(const f of this.fog){ f.x+=f.v*dt; if(f.x<-300)f.x=MW+300; if(f.x>MW+300)f.x=-300; glowAt(g,'70,130,200',f.x,f.y,f.r,.07); }
    if(!reduced){ g.setLineDash([3,24]); g.lineDashOffset=t*42; g.strokeStyle='rgba(170,220,255,.35)'; g.lineWidth=1.6; for(const s of SOURCES) strokePts(g,this.paths[s.id].pts); g.setLineDash([]); }
    const Lk=this.lake; g.strokeStyle='rgba(170,220,255,.25)'; g.lineWidth=1; for(let i=0;i<3;i++){ const k=((t*.25+i/3)%1); g.globalAlpha=1-k; g.beginPath(); g.ellipse(Lk.x,Lk.y,Lk.rx*(.2+k*.7),Lk.ry*(.2+k*.7),0,0,TAU); g.stroke(); } g.globalAlpha=1;
    glowAt(g,'120,200,255',Lk.x,Lk.y,200,.12+this.flash*.35);
    label(g,'地下湖 · 归集仓',Lk.x,Lk.y-6,{size:13,color:'#cfe6ff'}); label(g,(info.centerText||''),Lk.x,Lk.y+12,{size:12,weight:400});
    activeHalos(g,this,'120,200,255'); } });

/* --- 5 分拣工厂 --- */
const FACTORY=baseTheme({id:'factory',name:'分拣工厂',key:'6',
  sub:'传送带分拣工厂 · 机械蜘蛛从各入口抓取数据包，经清洗、校验、结构化工位送入仓库',
  legend:'<b>入口</b> = 18 个资料源　<b>机械蜘蛛</b> = 运行中的岗位　<b>三个工位</b> = 流程示意（不代表已执行清洗/校验）　<b>仓库</b> = 归集仓',
  col:{trail:'140,180,220',drop:'210,230,250',carry:'#9fd3ea'}, agent:'spider', lg:{right:'20px',top:'14px',maxWidth:'600px'},
  look:{body:'#9fb4c8',leg:'#6f8aa3',mark:'#f0c27b',eye:'#f0c27b',scale:1.15,box:true},
  layout(){ const C=this.center={x:1712,y:426}; this.wh={L:1572,R:1860,T:226,B:626}; const E={x:1572,y:426},M=this.merge={x:840,y:426};
    this.st=[{x:1062,n:'清洗',f:0},{x:1238,n:'校验',f:0},{x:1414,n:'结构化',f:0}];
    SOURCES.forEach((s,i)=>{ const a=Math.PI/2+(i+.5)/SOURCES.length*Math.PI; const d={x:M.x+Math.cos(a)*690,y:M.y+Math.sin(a)*380}; this.nodes[s.id]={...d,r:12,a};
      const pts=[{...C},E,{x:1414,y:426},{x:1238,y:426},{x:1062,y:426},{x:M.x+44,y:426}]; const ang=Math.atan2(d.y-M.y,d.x-M.x); pts.push({x:M.x+Math.cos(ang)*44,y:M.y+Math.sin(ang)*44},d); this.paths[s.id]=mkPoly(pts); this.belt=this.belt||{}; this.belt[s.id]=[{x:M.x+Math.cos(ang)*44,y:M.y+Math.sin(ang)*44},d]; });
    this.bins=0; },
  drawRail(g,a,b,w){ const ang=Math.atan2(b.y-a.y,b.x-a.x),nx=-Math.sin(ang)*w,ny=Math.cos(ang)*w; g.fillStyle='#121b24'; g.beginPath(); g.moveTo(a.x+nx,a.y+ny); g.lineTo(b.x+nx,b.y+ny); g.lineTo(b.x-nx,b.y-ny); g.lineTo(a.x-nx,a.y-ny); g.closePath(); g.fill();
    g.strokeStyle='rgba(111,154,199,.55)'; g.lineWidth=1.4; g.beginPath(); g.moveTo(a.x+nx,a.y+ny); g.lineTo(b.x+nx,b.y+ny); g.moveTo(a.x-nx,a.y-ny); g.lineTo(b.x-nx,b.y-ny); g.stroke();
    const L=Math.hypot(b.x-a.x,b.y-a.y); g.strokeStyle='rgba(111,154,199,.16)'; g.lineWidth=1; for(let d=8;d<L;d+=14){ const x=a.x+Math.cos(ang)*d,y=a.y+Math.sin(ang)*d; g.beginPath(); g.moveTo(x+nx*.8,y+ny*.8); g.lineTo(x-nx*.8,y-ny*.8); g.stroke(); } },
  drawStatic(g){ g.fillStyle='#0a1017'; g.fillRect(0,0,MW,MH); g.strokeStyle='rgba(110,140,170,.06)'; g.lineWidth=1; for(let x=0;x<MW;x+=40){ g.beginPath(); g.moveTo(x,0); g.lineTo(x,MH); g.stroke(); } for(let y=0;y<MH;y+=40){ g.beginPath(); g.moveTo(0,y); g.lineTo(MW,y); g.stroke(); }
    for(const s of SOURCES){ const [a,b]=this.belt[s.id]; this.drawRail(g,b,a,8); }
    this.drawRail(g,{x:this.merge.x+40,y:426},{x:this.wh.L,y:426},15);
    const M=this.merge; g.fillStyle='#16212c'; g.strokeStyle='#6f9ac7'; g.lineWidth=2; g.beginPath(); g.arc(M.x,M.y,44,0,TAU); g.fill(); g.stroke();
    for(const st of this.st){ g.fillStyle='#111b25'; g.strokeStyle='#6f9ac7'; g.lineWidth=1.6; g.fillRect(st.x-56,426-52,112,104); g.strokeRect(st.x-56,426-52,112,104); g.fillStyle='rgba(111,154,199,.12)'; g.fillRect(st.x-56,426-52,112,22); label(g,st.n,st.x,426-41,{size:13,shadow:false}); label(g,'工位 · 示意',st.x,426+40,{size:10,color:'#5d7880',weight:400,shadow:false}); }
    const w=this.wh; g.fillStyle='#101923'; g.strokeStyle='#9fb4c8'; g.lineWidth=2; g.fillRect(w.L,w.T,w.R-w.L,w.B-w.T); g.strokeRect(w.L,w.T,w.R-w.L,w.B-w.T);
    for(let i=0;i<10;i++){ g.fillStyle=i%2?'#f0c27b':'#1a222b'; g.fillRect(w.L-12,w.T+i*40,8,40); }
    label(g,'中央仓库 · 归集仓',(w.L+w.R)/2,w.T-18,{size:14,color:'#e9eef0'});
    for(const s of SOURCES){ const n=this.nodes[s.id]; g.fillStyle='#16212c'; g.strokeStyle='#9fb4c8'; g.lineWidth=1.5; g.fillRect(n.x-15,n.y-15,30,30); g.strokeRect(n.x-15,n.y-15,30,30); g.fillStyle='#f0c27b'; g.fillRect(n.x-15,n.y-15,30,4);
      const ax=Math.cos(n.a),ay=Math.sin(n.a); const lx=n.x+ax*34, ly=n.y+ay*24; label(g,s.short+' · '+s.inputs,lx,ly,{size:12,align:ax<-.4?'right':'center'}); } },
  drawDyn(g,dt,t){ const M=this.merge;
    if(!reduced){ g.strokeStyle='rgba(159,211,234,.35)'; g.lineWidth=1.4; for(const s of SOURCES){ const [a,b]=this.belt[s.id], L=Math.hypot(b.x-a.x,b.y-a.y), ang=Math.atan2(a.y-b.y,a.x-b.x); for(let d=(t*40)%30;d<L;d+=30){ const x=b.x+Math.cos(ang)*d,y=b.y+Math.sin(ang)*d; g.beginPath(); g.moveTo(x-Math.cos(ang-.6)*5,y-Math.sin(ang-.6)*5); g.lineTo(x,y); g.lineTo(x-Math.cos(ang+.6)*5,y-Math.sin(ang+.6)*5); g.stroke(); } }
      for(let d=(t*50)%34;d<this.wh.L-M.x-40;d+=34){ const x=M.x+40+d; g.beginPath(); g.moveTo(x-5,421); g.lineTo(x,426); g.lineTo(x-5,431); g.stroke(); } }
    g.save(); g.translate(M.x,M.y); g.rotate(t*.8); g.strokeStyle='rgba(111,154,199,.6)'; g.lineWidth=2; for(let i=0;i<6;i++){ g.rotate(TAU/6); g.beginPath(); g.moveTo(8,0); g.lineTo(38,0); g.stroke(); } g.restore();
    for(const st of this.st){ st.f=Math.max(0,st.f-dt*1.5); for(const a of A) if(a.state==='back'&&a.pos&&Math.abs(a.pos.x-st.x)<30&&Math.abs(a.pos.y-426)<20) st.f=1;
      g.fillStyle=st.f>.05?`rgba(240,194,123,${.3+st.f*.7})`:'rgba(111,154,199,.25)'; g.beginPath(); g.arc(st.x,426+14,5,0,TAU); g.fill(); if(st.f>.05) glowAt(g,'240,194,123',st.x,426,60,st.f*.25); }
    const w=this.wh, cols=6, rows=8, lit=Math.min(cols*rows, deposits%(cols*rows+1)); for(let i=0;i<cols*rows;i++){ const cx=i%cols, cy=Math.floor(i/cols); g.fillStyle=i<lit?'rgba(159,211,234,.75)':'rgba(111,154,199,.12)'; g.fillRect(w.L+24+cx*42,w.T+40+cy*40,30,26); }
    glowAt(g,'159,211,234',this.center.x,this.center.y,170,.06+this.flash*.3);
    label(g,(info.centerText||''),(w.L+w.R)/2,w.B+20,{size:12,weight:400});
    activeHalos(g,this,'159,211,234'); } });

/* --- 6 神经网络 --- */
const NEURAL=baseTheme({id:'neural',name:'神经网络',key:'7',
  sub:'神经突触网络 · 神经元是资料源，信使蜘蛛沿突触传递信号，向核心脑区汇聚',
  legend:'<b>外圈神经元</b> = 18 个资料源　<b>信使蜘蛛</b> = 运行中的岗位　<b>核心脑区</b> = 归集仓',
  col:{trail:'185,160,255',drop:'225,210,255',carry:'#e6d9ff'}, agent:'spider', lg:{right:'20px',bottom:'14px',maxWidth:'520px'},
  look:{body:'#3a2d5c',leg:'#a894e6',mark:'#d7c8ff',eye:'#f0c27b',scale:1.1},
  layout(){ const C=this.center={x:960,y:426}, r=rng(77); const ring=(n,rx,ry,j,off=0)=>d3.range(n).map(i=>{ const a=off+i/n*TAU+(r()-.5)*j; return {x:C.x+Math.cos(a)*rx*(1+(r()-.5)*.12),y:C.y+Math.sin(a)*ry*(1+(r()-.5)*.12),f:0,d:d3.range(5).map(()=>({a:r()*TAU,l:6+r()*12}))}; });
    this.core=ring(10,56,46,.2); this.inner=ring(13,240,150,.35,.2); this.midl=ring(22,470,270,.25,.1);
    const src=SOURCES.map((s,i)=>{ const a=-Math.PI/2+(i+.5)/SOURCES.length*TAU+(r()-.5)*.08; return {x:C.x+Math.cos(a)*800,y:C.y+Math.sin(a)*372}; });
    const near=(p,arr,k)=>[...arr].sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y)).slice(0,k);
    this.links=[]; const link=(a,b)=>{ const mx=(a.x+b.x)/2,my=(a.y+b.y)/2,dx=b.x-a.x,dy=b.y-a.y,L=Math.hypot(dx,dy)||1,bend=(r()-.5)*.35*L; const pts=quad(a,{x:mx-dy/L*bend,y:my+dx/L*bend},b,14); this.links.push({a,b,pts}); return pts; };
    this.mid2in={}; for(const m of this.midl) for(const n of near(m,this.inner,2)) link(m,n); for(const n of this.inner) for(const c of near(n,this.core,2)) link(n,c);
    SOURCES.forEach((s,i)=>{ const p=src[i], m=near(p,this.midl,2); link(p,m[1]); const m0=m[0], n0=near(m0,this.inner,1)[0], c0=near(n0,this.core,1)[0];
      const seg=(a,b)=>{ const L=this.links.find(l=>l.a===a&&l.b===b); return L?L.pts:[a,b]; };
      const fwd=[...link(p,m0),...seg(m0,n0).slice(1),...seg(n0,c0).slice(1),{...C}];
      this.paths[s.id]=mkPoly([...fwd].reverse()); this.nodes[s.id]={...p,r:8+Math.sqrt(s.inputs)*1.6,d:d3.range(8).map(()=>({a:r()*TAU,l:10+r()*18})),f:0}; });
    this.allN=[...this.core,...this.inner,...this.midl]; this.sparks=d3.range(36).map(()=>({l:Math.floor(r()*this.links.length),f:r(),v:.3+r()*.6})); },
  drawStatic(g){ let gr=g.createRadialGradient(960,426,0,960,426,1050); gr.addColorStop(0,'#140f2a'); gr.addColorStop(1,'#040309'); g.fillStyle=gr; g.fillRect(0,0,MW,MH);
    glowAt(g,'120,90,220',960,426,520,.12);
    g.strokeStyle='rgba(170,150,255,.16)'; g.lineWidth=1; for(const l of this.links) strokePts(g,l.pts);
    const neuron=(n,rad,col)=>{ g.strokeStyle=`rgba(${col},.35)`; g.lineWidth=1; for(const d of n.d||[]){ g.beginPath(); g.moveTo(n.x,n.y); g.lineTo(n.x+Math.cos(d.a)*(rad+d.l),n.y+Math.sin(d.a)*(rad+d.l)); g.stroke(); } glowAt(g,col,n.x,n.y,rad*3.2,.45); g.fillStyle=`rgb(${col})`; g.beginPath(); g.arc(n.x,n.y,rad,0,TAU); g.fill(); };
    for(const n of this.midl) neuron(n,3.2,'150,140,240'); for(const n of this.inner) neuron(n,3.8,'170,150,250'); for(const n of this.core) neuron(n,4.2,'220,200,255');
    for(const s of SOURCES){ const n=this.nodes[s.id]; neuron(n,n.r*.6,'200,180,255'); const below=n.y>426; label(g,s.short,n.x,n.y+(below?1:-1)*(n.r+16),{size:13}); label(g,s.inputs+' 条输入',n.x,n.y+(below?1:-1)*(n.r+31),{size:11,color:'#8299a1',weight:400}); } },
  drawDyn(g,dt,t){ g.globalCompositeOperation='lighter';
    if(!reduced) for(const sp of this.sparks){ sp.f+=sp.v*dt; if(sp.f>1){ sp.f=0; sp.l=Math.floor(Math.random()*this.links.length); } const L=this.links[sp.l]; const p=at(mkPolyCache(L),sp.f); glowAt(g,'200,180,255',p.x,p.y,6,.7*Math.sin(sp.f*Math.PI)); }
    for(const n of this.allN){ n.f=Math.max(0,n.f-dt*2); for(const a of A) if(a.pos&&Math.abs(a.pos.x-n.x)<16&&Math.abs(a.pos.y-n.y)<16) n.f=1; if(n.f>.02) glowAt(g,'230,215,255',n.x,n.y,26,n.f*.8); }
    const C=this.center,p=1+Math.sin(t*1.6)*.06+this.flash*.3; glowAt(g,'190,160,255',C.x,C.y,130*p,.45); glowAt(g,'255,240,255',C.x,C.y,40*p,.6);
    g.globalCompositeOperation='source-over';
    label(g,'核心脑区 · 归集仓',C.x,C.y+84,{size:13,color:'#e6d9ff'}); label(g,(info.centerText||''),C.x,C.y+101,{size:12,weight:400});
    activeHalos(g,this,'200,180,255'); } });
const polyCache=new WeakMap(); function mkPolyCache(L){ let p=polyCache.get(L); if(!p){ p=mkPoly(L.pts); polyCache.set(L,p); } return p; }

/* 当前正在采集的资料源：光环 */
const srcHeat={}; SOURCES.forEach(s=>srcHeat[s.id]=0);
function activeHalos(g,t,rgb){ for(const s of SOURCES){ const h=srcHeat[s.id]; if(h<.02) continue; const n=t.nodes[s.id]; g.globalCompositeOperation='lighter'; glowAt(g,rgb,n.x,n.y,(n.r||10)*5,h*.6); g.globalCompositeOperation='source-over'; g.strokeStyle=`rgba(${rgb},${h})`; g.lineWidth=1.5; g.beginPath(); g.arc(n.x,n.y,(n.r||10)+6+Math.sin(simT*6)*2,0,TAU); g.stroke(); } }

/* ================= 网状视图（Bot Mesh） ================= */
const MESH={id:'mesh',name:'网状 Mesh',mesh:true,
  sub:'Bot Mesh · 资料源 → 规则 → 49 岗位 → 协作网 → 交付物',
  legend:'<b>左</b> 18 个资料源　<b>中</b> 2 条岗位库约定 + 49 岗位（琥珀边 = 有真实运行）　<b>右</b> 287 条协作（青 下派 · 琥珀 上报 · 蓝 协作）与 99 项交付物 + 产出文件　悬停查看关联，点击固定',
  built:false, lg:{left:'176px',bottom:'8px',maxWidth:'440px'} };
const MX={src:30,srcW:118,hub:{x:250,y:426},role:650,roleW:190,d1:880,d2:1150,tagX:[1232,1458,1684],tagW:206};
const srcY=i=>24+i*44.6, roleY=i=>12+i*16.9;
const DIRC={delegates_to:'#3fd6b0',reports_to:'#f0c27b',collaborates_with:'#6fa8dc'};
let meshPolys={in:{},co:{},dv:{}}, meshTags=[], pinned=null;
function buildMesh(){
  if(MESH.built) return; MESH.built=true;
  const svg=d3.select(meshSvg), html=meshHtml;
  const roleIdx=Object.fromEntries(ROLES.map((r,i)=>[r.id,i])), srcIdx=Object.fromEntries(SOURCES.map((s,i)=>[s.id,i]));
  const ry=r=>roleY(roleIdx[r.id])+7.5, sy=s=>srcY(srcIdx[s.id])+12;
  // 交付物标签：先放真实产出文件，再按名称排序
  const arts=[]; for(const [slug,list] of Object.entries(ARTS)){ const r=roleBySlug[slug]; if(r) for(const a of list) arts.push({role:r,name:a.path.split('/').pop(),art:a}); }
  arts.sort((a,b)=>a.name.localeCompare(b.name));
  const dels=ROLES.flatMap(r=>r.deliverables.map(n=>({role:r,name:n}))).sort((a,b)=>a.name.localeCompare(b.name,'zh'));
  meshTags=[...arts,...dels]; const perCol=Math.ceil(meshTags.length/3), pitch=Math.min(23.6,(MH-30)/perCol);
  meshTags.forEach((t,k)=>{ t.col=Math.floor(k/perCol); t.x=MX.tagX[t.col]; t.y=14+(k%perCol)*pitch; t.cy=t.y+9; });
  const gE=svg.append('g'), gTmp=svg.append('g').attr('id','g-tmp'), gP=svg.append('g');
  const add=(d,cls,col,data)=>gE.append('path').attr('d',d).attr('class','e '+cls).attr('stroke',col).attr('data-r',data.r||'').attr('data-s',data.s||'');
  // 资料源 → 中枢
  SOURCES.forEach(s=>add(hpath(MX.src+MX.srcW,sy(s),MX.hub.x-40,MX.hub.y,.5),'e-in','#9fb3ba',{s:s.id}));
  const CK={x:332,y:96,w:250,h:262}, SPc={x:332,y:500,w:250,h:250}; MESH.cards={CK,SPc};
  add(hpath(MX.hub.x+40,MX.hub.y,CK.x,CK.y+CK.h/2,.5),'e-hub','#f0c27b',{}); add(hpath(MX.hub.x+40,MX.hub.y,SPc.x,SPc.y+SPc.h/2,.5),'e-hub','#9fb3ba',{});
  const flowRoles=new Set(FLOWS.flatMap(f=>f.roles));
  ROLES.forEach(r=>{ add(hpath(CK.x+CK.w,CK.y+CK.h/2,MX.role,ry(r),.55),'e-rule','#f0c27b',{r:r.id}); if(flowRoles.has(r.id)) add(hpath(SPc.x+SPc.w,SPc.y+SPc.h/2,MX.role,ry(r),.55),'e-rule','#9fb3ba',{r:r.id});
    add(`M${MX.role+MX.roleW},${ry(r)}L${MX.d1},${ry(r)}`,'e-port','#5d7880',{r:r.id}); });
  ROLES.forEach(r=>{ meshPolys.co[r.id]=[]; r.collaboration.forEach(c=>{ const t=roleBySlug[c.to]; if(!t) return; add(hpath(MX.d1,ry(r),MX.d2,ry(t),.5),'e-co',DIRC[c.dir]||'#6fa8dc',{r:r.id+' '+t.id}); meshPolys.co[r.id].push(mkPoly(hcurve(MX.d1,ry(r),MX.d2,ry(t),.5,24))); }); });
  meshTags.forEach(t=>{ add(hpath(MX.d2,ry(t.role),t.x-6,t.cy,.45),'e-dv '+(t.art?'art':''),t.art?'#f0c27b':gcol(t.role.group),{r:t.role.id}); (meshPolys.dv[t.role.id]=meshPolys.dv[t.role.id]||[]).push({poly:mkPoly(hcurve(MX.d2,ry(t.role),t.x-6,t.cy,.45,24)),tag:t}); });
  // 端口点
  ROLES.forEach(r=>{ gP.append('circle').attr('cx',MX.d1).attr('cy',ry(r)).attr('r',2.6).attr('fill','#3fd6b0'); gP.append('circle').attr('cx',MX.d2).attr('cy',ry(r)).attr('r',2.6).attr('fill','#3fd6b0'); });
  meshTags.forEach(t=>gP.append('circle').attr('cx',t.x-6).attr('cy',t.cy).attr('r',2.4).attr('fill','none').attr('stroke',t.art?'#f0c27b':'#5d7880').attr('stroke-width',1.2));
  SOURCES.forEach(s=>gP.append('circle').attr('cx',MX.src+MX.srcW+4).attr('cy',sy(s)).attr('r',3.5).attr('fill','#070b0e').attr('stroke','#d5dee1').attr('stroke-width',1.4));
  const hub=gP.append('g').attr('transform',`translate(${MX.hub.x},${MX.hub.y})`); hub.append('circle').attr('r',46).attr('fill','#0c1418').attr('stroke','#f0c27b').attr('stroke-width',2);
  hub.append('circle').attr('r',54).attr('fill','none').attr('stroke','rgba(240,194,123,.25)').attr('stroke-dasharray','3 5');
  if(options.hubLogo){ const lw=options.hubLogoSize&&options.hubLogoSize[0]||54, lh=options.hubLogoSize&&options.hubLogoSize[1]||66; hub.append('image').attr('href',options.hubLogo).attr('x',-lw/2).attr('y',-lh/2).attr('width',lw).attr('height',lh).attr('preserveAspectRatio','xMidYMid meet'); }
  else { hub.append('path').attr('d','M0,-24 20.8,-12 20.8,12 0,24 -20.8,12 -20.8,-12Z').attr('fill','rgba(240,194,123,.18)').attr('stroke','#f0c27b').attr('stroke-width',2);
  hub.append('path').attr('d','M0,-11 9.5,-5.5 9.5,5.5 0,11 -9.5,5.5 -9.5,-5.5Z').attr('fill','#9fd3ea'); }
  // 静态说明
  ROLES.forEach(r=>{ meshPolys.in[r.id]={}; for(const i of r.inputs){ if(!meshPolys.in[r.id][i.src]) meshPolys.in[r.id][i.src]=mkPoly(hcurve(MX.src+MX.srcW,sy(srcById[i.src]),MX.role,ry(r),.5,30)); } });
  // HTML：资料源、规则卡、岗位、交付物
  let h='<div class="csp-hub-l">GENERAL COMMANDER</div>';
  h+=`<div class="csp-col-h" style="left:30px">SOURCES · 18</div><div class="csp-col-h" style="left:650px">ROLES · 49</div><div class="csp-col-h" style="left:870px">PORTS</div><div class="csp-col-h" style="left:1110px">COLLAB · ${D.meta.counts.collaboration}</div><div class="csp-col-h" style="left:1232px">DELIVERABLES · ${dels.length} + 产出文件 ${arts.length}</div>`;
  SOURCES.forEach((s,i)=>{ h+=`<div class="csp-spill" data-src="${s.id}" style="top:${srcY(i)}px">${esc(s.short)}<em>${s.inputs}</em></div>`; });
  h+=`<div class="csp-card" style="left:${CK.x}px;top:${CK.y}px;min-height:${CK.h}px"><div class="csp-ct">交接检查<span class="csp-ok">✓</span></div><div class="csp-cs">rule_handoff_check</div><div class="csp-tg"><i></i>已启用 · 岗位库约定</div>
    <div class="csp-cl">规则</div><div class="csp-cvv">区分事实、推断、建议；没有实际运行的写“未执行”，不伪造通过</div>
    <div class="csp-cl">来源</div><div class="csp-cvv"><code>PROTOCOL.md</code> 第 3、8 条</div>
    <div class="csp-cl">类型</div><div class="csp-cvv">提示词约定，非自动校验</div>
    <div class="csp-cl">连接</div><div class="csp-cvv">· ${ROLES.length} 个岗位</div><div class="csp-cf">↳ 全部岗位</div></div>`;
  const ex=FLOWS[0]; h+=`<div class="csp-card sp" style="left:${SPc.x}px;top:${SPc.y}px;min-height:${SPc.h}px"><div class="csp-ct">工作流拆分<span class="csp-ok">⑂</span></div><div class="csp-cs">rule_workflow_split</div><div class="csp-tg"><i></i>已启用 · 岗位库约定</div>
    <div class="csp-cl">规则</div><div class="csp-cvv">按团队工作流时序把任务拆给岗位，最多 3 组并行</div>
    <div class="csp-cl">工作流</div><div class="csp-cvv">${FLOWS.length} 个 · 覆盖 ${flowRoles.size} 岗</div>
    ${ex?`<div class="csp-cl">示例</div><div class="csp-cvv">${esc(ex.name)}：${esc(ex.sequence).slice(0,40)}</div>`:''}
    <div class="csp-cl">状态</div><div class="csp-cvv">原文参考，未执行</div><div class="csp-cf">↳ ${flowRoles.size} 个岗位</div></div>`;
  const runCount=countRuns();
  ROLES.forEach((r,i)=>{ h+=`<div class="csp-pill${runCount[r.id]?' ran':''}" data-role="${r.id}" style="top:${roleY(i)}px;--c:${gcol(r.group)}"><span class="csp-pb">${num(r.id)}</span><span class="csp-pn">${esc(r.name)}</span>${runCount[r.id]?`<span class="csp-pr">×${runCount[r.id]}</span>`:''}</div>`; });
  meshTags.forEach((t,k)=>{ h+=`<div class="csp-tag${t.art?' art':''}" data-tag="${k}" style="left:${t.x}px;top:${t.y}px;height:${Math.min(18,pitch-3)}px"><em>${num(t.role.id)}</em><span>${esc(t.name)}</span></div>`; });
  html.innerHTML=h;
  MESH.svg=svg; MESH.gTmp=gTmp; MESH.sy=sy; MESH.ry=ry;
  MESH.pillEl=Object.fromEntries([...html.querySelectorAll('.csp-pill')].map(e=>[e.dataset.role,e]));
  MESH.srcEl=Object.fromEntries([...html.querySelectorAll('.csp-spill')].map(e=>[e.dataset.src,e]));
  MESH.tagEl=[...html.querySelectorAll('.csp-tag')];
  MESH.edges=[...svg.node().querySelectorAll('.e')];
  html.addEventListener('mouseover',e=>{ const t=e.target.closest('[data-role],[data-src],[data-tag]'); if(!t||pinned) return; meshFocus(t); });
  html.addEventListener('mousemove',e=>{ const t=e.target.closest('[data-role],[data-src],[data-tag]'); if(t) showTip(e,meshTipHtml(t)); });
  html.addEventListener('mouseout',e=>{ const t=e.target.closest('[data-role],[data-src],[data-tag]'); if(!t) return; hideTip(); if(!pinned) meshClear(); });
  html.addEventListener('click',e=>{ const t=e.target.closest('[data-role],[data-src],[data-tag]'); if(!t){ pinned=null; meshClear(); return; } const key=t.dataset.role||t.dataset.src||t.dataset.tag; if(pinned===key){ pinned=null; meshClear(); } else { pinned=null; meshFocus(t); pinned=key; } });
  meshSvg.addEventListener('click',()=>{ pinned=null; meshClear(); });
}
function meshRolesOf(el){ if(el.dataset.role) return [roleById[el.dataset.role]]; if(el.dataset.src) return [...srcUsers[el.dataset.src]]; return [meshTags[+el.dataset.tag].role]; }
function meshFocus(el){ meshClear(); const roles=meshRolesOf(el), ids=new Set(roles.map(r=>r.id)), single=roles.length===1?roles[0]:null;
  MESH.svg.classed('focus',true);
  for(const e of MESH.edges){ const r=e.getAttribute('data-r'); if(!r) continue; const parts=r.split(' '); if(single?parts[0]===single.id||(parts[1]===single.id&&e.classList.contains('e-co')):parts.some(p=>ids.has(p))&&!e.classList.contains('e-co')) e.classList.add('hl'); }
  const rel=new Set(); if(single) single.collaboration.forEach(c=>{ const t=roleBySlug[c.to]; if(t) rel.add(t.id); });
  for(const [id,p] of Object.entries(MESH.pillEl)){ p.classList.toggle('rel',ids.has(id)||rel.has(id)); p.classList.toggle('dim',!ids.has(id)&&!rel.has(id)); }
  const srcs=new Set(roles.flatMap(r=>r.inputs.map(i=>i.src))); if(el.dataset.src) { srcs.clear(); srcs.add(el.dataset.src); }
  for(const [id,p] of Object.entries(MESH.srcEl)){ p.classList.toggle('rel',srcs.has(id)); p.classList.toggle('dim',!srcs.has(id)); }
  MESH.tagEl.forEach((t,k)=>{ const on=ids.has(meshTags[k].role.id); t.classList.toggle('rel',on); t.classList.toggle('dim',!on); });
  for(const r of roles) for(const sId of new Set(r.inputs.map(i=>i.src))){ if(el.dataset.src&&sId!==el.dataset.src) continue; MESH.gTmp.append('path').attr('class','tmp').attr('d',hpath(MX.src+MX.srcW,MESH.sy(srcById[sId]),MX.role,MESH.ry(r),.5)); }
}
function meshClear(){ if(!MESH.built) return; MESH.svg.classed('focus',false); MESH.gTmp.selectAll('*').remove(); for(const e of MESH.edges) e.classList.remove('hl'); for(const p of Object.values(MESH.pillEl)) p.classList.remove('rel','dim'); for(const p of Object.values(MESH.srcEl)) p.classList.remove('rel','dim'); MESH.tagEl.forEach(t=>t.classList.remove('rel','dim')); }
function meshTipHtml(el){
  if(el.dataset.role){ const r=roleById[el.dataset.role], runs=runsList().filter(x=>x.roleId===r.id); return `<h4>${esc(r.id)} · ${esc(r.name)}</h4><span>${esc(r.group)} · ${esc(r.slug)}</span><br>${esc(r.goal).slice(0,70)}…<br><span>输入</span> ${r.inputs.length} 条　<span>交付物</span> ${r.deliverables.length}　<span>协作</span> ${r.collaboration.length}<br><span>真实运行</span> ${runs.length?runs.map(x=>hm(Date.parse(x.start))+'–'+(x.end?hm(Date.parse(x.end)):'进行中')).join('、'):'无记录'}`; }
  if(el.dataset.src){ const s=srcById[el.dataset.src]; return `<h4>${esc(s.name)}</h4><span>归入的岗位输入</span> ${s.inputs} 条 · ${srcUsers[s.id].size} 个岗位<br><span>按关键词归类，可在 build_data.py 调整</span>`; }
  const t=meshTags[+el.dataset.tag]; return t.art?`<h4>产出文件 · ${esc(t.name)}</h4><span>${esc(t.role.id)} ${esc(t.role.name)}</span><br>${esc(t.art.title)}<br><span>修改时间</span> ${esc(t.art.mtime.replace('T',' '))}`:`<h4>${esc(t.name)}</h4><span>交付物定义 · ${esc(t.role.id)} ${esc(t.role.name)}</span>`;
}


const parts=[];
const VIEWS={mesh:MESH,galaxy:GALAXY,leaf:LEAF,pcb:PCB,cave:CAVE,factory:FACTORY,neural:NEURAL};
let view=MESH;
host.append(canvasEl,meshBox,legendEl,tip);
if(options.legend===false) legendEl.style.display='none';

function showTip(e,html){ tip.innerHTML=html; tip.style.opacity=1; const r=host.getBoundingClientRect(), s=r.width/MW; let x=(e.clientX-r.left)/s+16,y=(e.clientY-r.top)/s+16; if(x>MW-380)x-=396; if(y>MH-170)y-=170; tip.style.left=x+'px'; tip.style.top=y+'px'; }
function hideTip(){ tip.style.opacity=0; }

function legendHtml(mode){ return view.legend+(mode==='demo'?'<br>演示调度：按团队工作流模拟派工，岗位并未实际运行。':'<br>运行起止时间来自 agent-audit.log；采集路线按岗位输入归类示意，日志不记录实际读了哪些输入。'); }
function updateLegend(){ Object.assign(legendEl.style,{left:'',right:'',top:'',bottom:'',maxWidth:''}); Object.assign(legendEl.style,view.lg||{left:'20px',bottom:'14px'}); legendEl.innerHTML=legendHtml(info.mode); }
function buildStatic(){ if(view.mesh) return; staticLayer.width=Math.round(MW*K); staticLayer.height=Math.round(MH*K); sctx.setTransform(K,0,0,K,0,0); sctx.clearRect(0,0,MW,MH); view.drawStatic(sctx); }
function setStyle(id){ const v=VIEWS[id]||MESH; view=v; meshBox.style.display=v.mesh?'block':'none'; canvasEl.style.display=v.mesh?'none':'block';
  if(v.mesh) buildMesh(); else { if(!v.laid){ v.layout(); v.laid=true; } buildStatic(); }
  parts.length=0; hideTip(); updateLegend(); }
function resize(k){ K=Math.max(.25,k||1); for(const c of [canvasEl,meshCv]){ c.width=Math.round(MW*K); c.height=Math.round(MH*K); } buildStatic(); }

/* ---------- 输入蜂状态 → 内部智能体，识别状态切换 ---------- */
function sync(list){
  const seen=new Set();
  for(const x of list||[]){ if(!x||x.key==null) continue; const role=roleById[x.roleId]; if(!role) continue; seen.add(x.key);
    let a=byKey.get(x.key); const st=x.state||'wait';
    if(!a){ a={id:++seq,key:x.key,role,src:x.src,state:'wait',frac:0,lane:(seq%3)-1,pos:null}; byKey.set(x.key,a); A.push(a); }
    const prev=a.state; a.role=role; a.src=srcById[x.src]?x.src:a.src; a.state=st; a.frac=Math.max(0,Math.min(1,+x.frac||0)); if(st==='collect') a.frac=1;
    if(prev!==st){ if(prev==='collect'&&st==='back') meshInbound(a); if(prev==='back'&&(st==='drop'||st==='wait'||st==='out')) arrive(a); } }
  for(let i=A.length-1;i>=0;i--){ const a=A[i]; if(!seen.has(a.key)){ if(a.state==='back'||a.state==='drop') arrive(a); byKey.delete(a.key); A.splice(i,1); } }
}
function arrive(a){ if(a.arrivedAt===simT) return; a.arrivedAt=simT; deposits++; view.flash=1; meshOutbound(a);
  if(!view.mesh&&!reduced){ const C=view.center; for(let k=0;k<14;k++){ const an=Math.random()*TAU,v=30+Math.random()*90; parts.push({type:'spark',x:C.x,y:C.y,vx:Math.cos(an)*v,vy:Math.sin(an)*v,life:.7,max:.7,rgb:view.col.drop,size:1.6+Math.random()*1.5}); } } }
function meshInbound(a){ if(!view.mesh||reduced) return; const poly=meshPolys.in[a.role.id]&&meshPolys.in[a.role.id][a.src]; if(!poly) return; for(let k=0;k<4;k++) parts.push({type:'mdot',poly,f:-k*.06,v:.55,life:3,rgb:'63,214,176',size:2.2}); }
function meshOutbound(a){ if(!view.mesh||reduced) return; for(const d of meshPolys.dv[a.role.id]||[]) parts.push({type:'mdot',poly:d.poly,f:0,v:.7,life:2,rgb:'240,194,123',size:2,tag:d.tag}); for(const poly of (meshPolys.co[a.role.id]||[]).slice(0,6)) parts.push({type:'mdot',poly,f:0,v:.6,life:2.2,rgb:'159,211,234',size:1.6}); }
function stepParts(dt){ for(let i=parts.length-1;i>=0;i--){ const p=parts[i]; p.life-=dt;
  if(p.type==='mdot'){ p.f+=p.v*dt; if(p.f>=1) p.life=0; }
  else if(p.type==='drop'){ const tp=p.a.pos||p; p.x+=(tp.x-p.x)*Math.min(1,dt*4); p.y+=(tp.y-p.y)*Math.min(1,dt*4); }
  else { p.x+=p.vx*dt; p.y+=p.vy*dt; p.vx*=.95; p.vy*=.95; }
  if(p.life<=0) parts.splice(i,1); } }

/* ---------- 渲染 ---------- */
function themePos(a,th){ if(th.mesh||!a.src||a.state==='wait') return null; const poly=th.paths[a.src]; if(!poly) return null; if(a.state==='drop'){ const p=at(poly,0,0); p.ang=Math.PI/2; return p; } const p=at(poly,a.frac,a.lane*6); if(a.state==='collect'){ p.x+=Math.sin(simT*3+a.id)*4; p.y+=Math.cos(simT*4+a.id)*3-6; p.ang=-Math.PI/2; } else if(a.state==='back') p.ang+=Math.PI; return p; }
function renderTheme(dt){
  const th=view; ctx.setTransform(K,0,0,K,0,0); ctx.clearRect(0,0,MW,MH); ctx.drawImage(staticLayer,0,0,MW,MH);
  th.flash=Math.max(0,th.flash-dt*1.4);
  for(const a of A){ a.pos=themePos(a,th); if(a.state==='collect') srcHeat[a.src]=1; }
  th.drawDyn(ctx,dt,simT);
  for(const a of A){ if(a.pos&&!reduced&&(a.state==='out'||a.state==='back')&&Math.random()<dt*50) parts.push({type:'trail',x:a.pos.x,y:a.pos.y,vx:-Math.cos(a.pos.ang)*18+(Math.random()-.5)*8,vy:-Math.sin(a.pos.ang)*18+(Math.random()-.5)*8,life:.7,max:.7,rgb:a.state==='back'?'240,194,123':th.col.trail,size:1+Math.random()*1.2});
    if(a.pos&&a.state==='collect'&&!reduced&&Math.random()<dt*8){ const n=th.nodes[a.src],an=Math.random()*TAU,d=(n.r||10)+6+Math.random()*16; parts.push({type:'drop',a,x:n.x+Math.cos(an)*d,y:n.y+Math.sin(an)*d,life:.9,max:.9,rgb:th.col.drop,size:1.8+Math.random()*1.4}); } }
  ctx.globalCompositeOperation='lighter'; for(const p of parts){ if(p.type==='mdot') continue; glowAt(ctx,p.rgb,p.x,p.y,p.size*4,Math.max(0,p.life/(p.max||1))*.9); } ctx.globalCompositeOperation='source-over';
  for(const a of A){ if(!a.pos) continue; const look={...th.look,phase:simT+a.id,carry:(a.state==='back'||a.state==='drop')?th.col.carry:null};
    glowAt(ctx,a.state==='back'?'240,194,123':th.col.trail,a.pos.x,a.pos.y,22,.35);
    (th.agent==='ship'?drawShip:th.agent==='bug'?drawBug:drawSpider)(ctx,a.pos.x,a.pos.y,a.pos.ang,look);
    if(a.state!=='collect') label(ctx,num(a.role.id),a.pos.x,a.pos.y+22,{size:10,font:'Consolas,monospace',color:'rgba(238,240,234,.85)',weight:400}); }
}
let runSig='';
function renderMesh(dt){
  mctx.setTransform(K,0,0,K,0,0); mctx.clearRect(0,0,MW,MH);
  mctx.setLineDash([4,5]); mctx.lineDashOffset=-simT*30; mctx.lineWidth=1.5;
  for(const a of A){ if(a.state!=='collect'&&a.state!=='back') continue; const poly=meshPolys.in[a.role.id]&&meshPolys.in[a.role.id][a.src]; if(!poly) continue; mctx.strokeStyle='rgba(63,214,176,.6)'; strokePts(mctx,poly.pts); }
  mctx.setLineDash([]); mctx.globalCompositeOperation='lighter';
  for(const p of parts){ if(p.type!=='mdot'||p.f<0) continue; const q=at(p.poly,p.f); glowAt(mctx,p.rgb,q.x,q.y,p.size*4,.95); if(p.tag&&p.f>.97) p.tag.hot=1; }
  mctx.globalCompositeOperation='source-over';
}
let meshUiAcc=0;
function meshUi(){ const act=new Set(A.filter(a=>a.state!=='wait').map(a=>a.role.id)); const col=new Set(A.filter(a=>a.state==='collect').map(a=>a.src));
  for(const [id,p] of Object.entries(MESH.pillEl)) p.classList.toggle('act',act.has(id));
  for(const [id,p] of Object.entries(MESH.srcEl)) p.classList.toggle('on',col.has(id));
  for(const e of MESH.edges){ const r=e.getAttribute('data-r'); if(!r||!e.classList.contains('e-co')&&!e.classList.contains('e-dv')) continue; e.classList.toggle('hot',act.has(r.split(' ')[0])); }
  MESH.tagEl.forEach((el,k)=>{ const t=meshTags[k]; if(t.hot){ t.hot=Math.max(0,t.hot-.12); } el.classList.toggle('hot',!!t.hot&&t.hot>.05); });
  const rc=countRuns(), sig=JSON.stringify(rc); if(sig!==runSig){ runSig=sig; for(const [id,p] of Object.entries(MESH.pillEl)){ const n=rc[id]||0; p.classList.toggle('ran',n>0); let pr=p.querySelector('.csp-pr'); if(n&&!pr){ pr=document.createElement('span'); pr.className='csp-pr'; p.appendChild(pr); } if(pr) pr.textContent=n?'×'+n:''; } } }

canvasEl.addEventListener('mousemove',e=>{ const r=canvasEl.getBoundingClientRect(), p={x:(e.clientX-r.left)/r.width*MW,y:(e.clientY-r.top)/r.height*MH};
  const a=A.find(a=>a.pos&&Math.hypot(a.pos.x-p.x,a.pos.y-p.y)<20); if(a) return showTip(e,`<h4>${esc(a.role.id)} · ${esc(a.role.name)}</h4><span>${{out:'出发',collect:'采集中',back:'返回',drop:'入仓'}[a.state]||''}</span> ${esc(srcById[a.src]?.name||'')}<br><span>${info.mode==='demo'?'演示调度':'真实运行中 · 路线为输入归类示意'}</span>`);
  for(const s of SOURCES){ const n=view.nodes&&view.nodes[s.id]; if(n&&Math.hypot(n.x-p.x,n.y-p.y)<Math.max(22,(n.r||10)+8)) return showTip(e,`<h4>${esc(s.name)}</h4><span>归入的岗位输入</span> ${s.inputs} 条 · ${srcUsers[s.id].size} 个岗位<br><span>正在采集</span> ${A.filter(a=>a.src===s.id&&a.state==='collect').map(a=>a.role.id).join('、')||'无'}`); }
  hideTip(); });
canvasEl.addEventListener('mouseleave',hideTip);

let lastMode=null;
function frame(dt,list,inf){ dt=Math.max(0,Math.min(.1,+dt||0)); info=Object.assign({},info,inf||{}); reduced=!!info.reduced; simT+=dt;
  if(info.mode!==lastMode){ lastMode=info.mode; updateLegend(); }
  sync(list); for(const k in srcHeat) srcHeat[k]=Math.max(0,srcHeat[k]-dt*1.2); stepParts(dt);
  if(view.mesh){ renderMesh(dt); meshUiAcc+=dt||.016; if(meshUiAcc>.12){ meshUiAcc=0; meshUi(); } } else renderTheme(dt); }
function reset(){ parts.length=0; deposits=0; A.length=0; byKey.clear(); for(const k in srcHeat) srcHeat[k]=0; }

resize(options.k||1); setStyle(options.style||'mesh');
return { setStyle, resize, frame, reset, legendHtml:m=>legendHtml(m||info.mode), get style(){ return view.id; }, STYLES:STYLE_LIST };
}
window.CCGSStylePack={ create, STYLES:STYLE_LIST, version:'1.1.0' };
})();
