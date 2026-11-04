/* خزائن الذهب – تطبيق مستقل يعمل على Firebase (Firestore + Authentication) */
(function(){
"use strict";
const BR={b2:"بوابة 2",b4:"بوابة 4"};
const BKEYS=["b2","b4"];
const LOC={main:"الخزنة الرئيسية",sub:"الخزنة الفرعية",show:"البترينة"};
const LOCS=["main","sub","show"];
const T={
  open:{l:"رصيد افتتاحي",loc:1,g:"وارد"},
  in_main:{l:"وارد للخزنة الرئيسية",fx:[["main",1]],g:"وارد"},
  main_sub:{l:"تحويل: رئيسية ← فرعية",fx:[["main",-1],["sub",1]],g:"تحويل داخلي"},
  sub_main:{l:"مرتجع: فرعية ← رئيسية",fx:[["sub",-1],["main",1]],g:"تحويل داخلي"},
  main_show:{l:"تحويل: رئيسية ← بترينة",fx:[["main",-1],["show",1]],g:"تحويل داخلي"},
  sub_show:{l:"تحويل: فرعية ← بترينة",fx:[["sub",-1],["show",1]],g:"تحويل داخلي"},
  show_sub:{l:"مرتجع: بترينة ← فرعية",fx:[["show",-1],["sub",1]],g:"تحويل داخلي"},
  sale_sub:{l:"بيع من الخزنة الفرعية",fx:[["sub",-1]],sale:1,g:"بيع"},
  sale_show:{l:"بيع من البترينة",fx:[["show",-1]],sale:1,g:"بيع"},
  cust_ret:{l:"مرتجع من عميل (للفرعية)",fx:[["sub",1]],sale:-1,g:"بيع"},
  branch:{l:"تحويل للفرع الآخر (رئيسية ← رئيسية)",fx:[["main",-1]],to:[["main",1]],g:"بين الفروع"},
  out_main:{l:"صرف من الرئيسية (مورد / تصنيع)",fx:[["main",-1]],g:"أخرى"},
  adjust:{l:"تسوية جرد (+ / −)",loc:1,signed:1,g:"أخرى"}
};
const DEFAULT_ITEMS=[["1 جرام",1],["2.5 جرام",2.5],["2.5 جرام (الله)",2.5],["5 جرام",5],["5 جرام (قل أعوذ)",5],["5 جرام (الله)",5],
["8 جرام (دام عزك ياوطن)",8],["10 جرام",10],["10 جرام (قل أعوذ)",10],["10 جرام (لبيك الله)",10],["10 جرام (أمي جنة)",10],
["10 جرام (دام عزك ياوطن)",10],["15.55 جرام",15.55],["15.55 جرام (قل أعوذ)",15.55],["15.55 جرام الصقر",15.55],
["15.55 جرام الاهرامات",15.55],["20 جرام",20],["20 جرام (الكعبة)",20],["25 جرام",25],["25 جرام (لبيك الله)",25],
["25 جرام (صقر)",25],["أونصة 31.10 جرام",31.10],["31.10 جرام (المسجد النبوي)",31.10],["50 جرام",50],["5 Tola",58.32],
["100 جرام",100],["10 Tola",116.64],["999.9 ك (كيلو)",1000],["500 جرام",500],["250 جرام",250]];

const S={items:[],itemsLoaded:false,closing:null,closingLoaded:false,live:[],liveLoaded:false,admins:[],staff:[],rolesLoaded:false,
  branch:"b2",route:"home",email:"",pending:false,online:navigator.onLine,draft:null,logRange:null,repRange:null,
  countSel:{b:"b2",loc:"main",vals:{}},itemsDraft:null};
let auth=null,db=null,CFG=null;
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt=n=>(Math.round(n*100)/100).toLocaleString("en-US",{maximumFractionDigits:2});
const dstr=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const today=()=>dstr(new Date());
const monthStart=()=>today().slice(0,8)+"01";
const store={get(k){try{return localStorage.getItem(k)}catch(e){return null}},set(k,v){try{localStorage.setItem(k,v)}catch(e){}}};
const other=b=>b==="b2"?"b4":"b2";
function toast(m){const t=$("#toast");t.textContent=m;t.hidden=false;clearTimeout(toast.h);toast.h=setTimeout(()=>t.hidden=true,3000)}
const itemById=id=>S.items.find(i=>i.id===id);
const iname=id=>itemById(id)?.name||"صنف محذوف";
const iw=id=>Number(itemById(id)?.weight)||0;
const activeItems=()=>S.items.filter(i=>!i.off);
const isAdmin=()=>S.admins.includes(S.email);
const isMember=()=>isAdmin()||S.staff.some(s=>s.email===S.email);
const myName=()=>S.staff.find(s=>s.email===S.email)?.name||store.get("gv.emp")||S.email.split("@")[0];
const nameOf=email=>S.staff.find(s=>s.email===email)?.name||(email?email.split("@")[0]:"");
const errText=e=>{const c=e?.code||"";
  if(c.includes("permission-denied"))return "مش مسموح لحسابك بالعملية دي.";
  if(c.includes("wrong-password")||c.includes("invalid-credential")||c.includes("user-not-found")||c.includes("invalid-login"))return "الإيميل أو كلمة السر غلط.";
  if(c.includes("too-many-requests"))return "محاولات كتير – استنى شوية وجرّب تاني.";
  if(c.includes("network"))return "مفيش اتصال بالإنترنت.";
  if(c.includes("email-already-in-use"))return "الإيميل ده عليه حساب بالفعل.";
  if(c.includes("weak-password"))return "كلمة السر لازم 6 حروف/أرقام على الأقل.";
  if(c.includes("invalid-email"))return "الإيميل مكتوب غلط.";
  return "حصل خطأ: "+(e?.message||c||"غير معروف");};

/* ---------- balances ---------- */
function deltas(m){
  const out=[];const t=T[m.type];if(!t)return out;
  for(const ln of m.lines||[]){const q=Number(ln.qty)||0;
    if(t.loc){out.push({b:m.branch,loc:ln.loc||m.loc,item:ln.item,d:q});continue}
    for(const [loc,s] of t.fx)out.push({b:m.branch,loc,item:ln.item,d:s*q});
    if(t.to&&m.to)for(const [loc,s] of t.to)out.push({b:m.to,loc,item:ln.item,d:s*q});
  }return out;
}
function emptyBal(){const o={};for(const b of BKEYS){o[b]={};for(const l of LOCS)o[b][l]={}}return o}
function balances(extra){
  const bal=emptyBal();const cb=S.closing?.bal;
  if(cb)for(const b of BKEYS)for(const l of LOCS)Object.assign(bal[b][l],cb[b]?.[l]||{});
  const list=extra?S.live.concat([extra]):S.live;
  for(const m of list){if(m.void)continue;for(const x of deltas(m)){const L=bal[x.b]?.[x.loc];if(!L)continue;L[x.item]=(L[x.item]||0)+x.d}}
  return bal;
}
const q=(bal,b,l,id)=>bal[b][l][id]||0;
function status(bal,b,it){
  const m=q(bal,b,"main",it.id),s=q(bal,b,"sub",it.id),w=q(bal,b,"show",it.id);
  if(m<0||s<0||w<0)return{k:"bad",t:"رصيد بالسالب – راجع السجل",r:0};
  if(m+s+w===0)return{k:"bad",t:"نفد – اطلب توريد",r:1};
  if(s===0&&m===0)return{k:"bad",t:"المتاح قطعة البترينة فقط",r:2};
  if(s<(Number(it.min)||0))return{k:"warn",t:m>0?"تحت الحد – حوّل من الرئيسية":"تحت الحد – الرئيسية فاضية",r:3,act:m>0?"main_sub":null};
  if(w<1)return{k:"warn",t:"البترينة ناقصة قطعة العرض",r:4,act:s>0?"sub_show":(m>0?"main_show":null)};
  return{k:"ok",t:"متوفر",r:9};
}
async function movesInRange(from,to){
  const cd=S.closing?.date;
  if(!cd||from>cd)return S.live.filter(m=>m.date>=from&&m.date<=to);
  const snap=await db.collection("moves").where("date",">=",from).where("date","<=",to).get();
  const map=new Map();snap.docs.forEach(d=>map.set(d.id,{id:d.id,...d.data()}));
  S.live.forEach(m=>{if(m.date>=from&&m.date<=to)map.set(m.id,m)});
  return [...map.values()].sort((a,b)=>b.ts-a.ts);
}

/* ---------- shell ---------- */
const ROUTES=["home","stock","new","log","reports","count","items"];
function readRoute(){const h=location.hash.slice(1);S.route=ROUTES.includes(h)?h:"home"}
window.addEventListener("hashchange",()=>{readRoute();render();window.scrollTo(0,0)});
window.addEventListener("online",()=>{S.online=true;syncChip()});
window.addEventListener("offline",()=>{S.online=false;syncChip()});
const bsel=()=>S.branch==="all"?BKEYS:[S.branch];
function setBranch(b){S.branch=b;store.set("gv.branch",b);render()}
function syncChip(){const c=$("#sync");if(!c)return;
  if(!S.online){c.className="sync off";c.textContent="غير متصل – الحركات هتتزامن لما النت يرجع"}
  else if(S.pending){c.className="sync wait";c.textContent="جاري المزامنة…"}
  else{c.className="sync on";c.textContent="متزامن"}}
function shell(on){$("#bar").hidden=!on;}

function render(){
  if(!S.email)return;
  shell(true);
  document.querySelectorAll("#branchSeg button").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.b===S.branch)));
  document.querySelectorAll("#tabs a").forEach(a=>{if(a.getAttribute("href")==="#"+S.route)a.setAttribute("aria-current","page");else a.removeAttribute("aria-current")});
  $("#who").textContent=myName();syncChip();
  const app=$("#app");
  if(!(S.rolesLoaded&&S.itemsLoaded&&S.closingLoaded&&S.liveLoaded)){app.innerHTML=`<div class="empty">جاري تحميل بيانات الخزائن…</div>`;return}
  if(!isMember()){app.innerHTML=`<div class="note bad">الحساب <b>${esc(S.email)}</b> مش متضاف للبرنامج. اطلب من المدير يضيفك من «الإعدادات ← المستخدمين».</div><button class="btn" id="lo2">تسجيل خروج</button>`;$("#lo2").onclick=()=>auth.signOut();return}
  let html="";
  if(!S.items.length&&S.route!=="items")html+=`<div class="note info">لسه مفيش أصناف. ادخل على «الإعدادات» وضيف الأصناف.</div>`;
  app.innerHTML=html+({home:vHome,stock:vStock,new:vNew,log:vLog,reports:vReports,count:vCount,items:vItems}[S.route])();
  ({home:bHome,stock:bStock,new:bNew,log:bLog,reports:bReports,count:bCount,items:bItems}[S.route])?.();
}
let rt=null;function rerender(){
  const a=document.activeElement;
  if(a&&a.matches&&a.matches("input,textarea,select")&&["new","count","items"].includes(S.route)){clearTimeout(rt);rt=setTimeout(rerender,1500);return}
  render();
}

/* ---------- HOME ---------- */
function vHome(){
  const bal=balances();const t=today();
  const allZero=BKEYS.every(b=>["main","sub"].every(l=>Object.values(bal[b][l]).every(v=>!v)));
  let h=`<div class="head"><h2>نظرة عامة</h2><span class="muted small">اليوم ${t}</span></div>`;
  if(allZero)h+=`<div class="note info"><b>ابدأ من هنا:</b> سجّل الرصيد الافتتاحي للخزنة الرئيسية والفرعية من «حركة جديدة» ← «رصيد افتتاحي»، أو من «الجرد» لو هتعدّ الخزنة صنف صنف.</div>`;
  h+=`<div class="grid2">`;
  for(const b of bsel()){
    let pcs={main:0,sub:0,show:0},gr={main:0,sub:0,show:0};
    for(const it of S.items)for(const l of LOCS){const v=q(bal,b,l,it.id);pcs[l]+=v;gr[l]+=v*iw(it.id)}
    const sales=S.live.filter(m=>!m.void&&m.branch===b&&m.date===t&&T[m.type]?.sale);
    let sp=0,sg=0;sales.forEach(m=>m.lines.forEach(ln=>{const k=T[m.type].sale*ln.qty;sp+=k;sg+=k*iw(ln.item)}));
    h+=`<section class="panel"><div class="head"><h3>فرع ${BR[b]}</h3><span class="chip gold">مبيعات اليوم: ${fmt(sp)} قطعة · ${fmt(sg)} جم</span></div>
    <div class="tiles">${LOCS.map(l=>`<div class="tile"><span>${LOC[l]}</span><b>${fmt(pcs[l])}</b><i>${fmt(gr[l])} جم</i></div>`).join("")}</div>
    <div class="branch-total"><span class="muted">إجمالي الفرع</span><span><b>${fmt(gr.main+gr.sub+gr.show)}</b> جرام · ${fmt(pcs.main+pcs.sub+pcs.show)} قطعة</span></div></section>`;
  }
  h+=`</div><div class="grid2"><section class="panel"><div class="head"><h3>تنبيهات المخزون</h3><a class="btn sm" href="#stock">كل الأصناف</a></div>`;
  const al=[];for(const b of bsel())for(const it of activeItems()){const s=status(bal,b,it);if(s.k!=="ok")al.push({b,it,s})}
  al.sort((a,b)=>a.s.r-b.s.r);
  h+=al.length?`<div class="alerts">${al.map(a=>`<div class="alert ${a.s.k}"><div class="t"><b>${esc(a.it.name)}</b> <span class="muted small">· ${BR[a.b]}</span><div class="small">${a.s.t}</div></div>${a.s.act?`<button class="btn sm" data-fix="${a.b}|${a.s.act}|${a.it.id}">${a.s.act==="main_sub"?"حوّل للفرعية":"عوّض البترينة"}</button>`:""}</div>`).join("")}</div>`:`<div class="empty">كل الأصناف متوفرة – مفيش تنبيهات</div>`;
  h+=`</section><section class="panel"><div class="head"><h3>آخر الحركات</h3><a class="btn sm" href="#log">السجل كامل</a></div>`;
  const rec=S.live.filter(m=>bsel().includes(m.branch)||bsel().includes(m.to)).slice(0,6);
  h+=rec.length?`<div class="moves">${rec.map(moveCard).join("")}</div>`:`<div class="empty">لسه مفيش حركات. سجّل أول حركة من «حركة جديدة».</div>`;
  return h+`</section></div>`;
}
function bHome(){
  document.querySelectorAll("[data-fix]").forEach(b=>b.onclick=()=>{const [br,type,item]=b.dataset.fix.split("|");
    S.draft={branch:br,type,lines:[{item,qty:""}]};location.hash="new"});
  bindMoves();
}

/* ---------- STOCK ---------- */
const SV=(()=>{let v={};try{v=JSON.parse(store.get("gv.sv")||"{}")}catch(e){}return Object.assign({view:"all",sort:"weight",mode:"cards",q:""},v,{q:""})})();
const saveSV=()=>store.set("gv.sv",JSON.stringify({view:SV.view,sort:SV.sort,mode:SV.mode}));
const VIEWS={all:{l:"الإجمالي – كل الأماكن",locs:LOCS},main:{l:"الخزن الرئيسية",locs:["main"]},sub:{l:"الخزن الفرعية",locs:["sub"]},show:{l:"البترينات",locs:["show"]}};
const LOCSHORT={main:"رئيسية",sub:"فرعية",show:"بترينة"};
const SEV={bad:0,warn:1,ok:2};
function stockRows(bal){
  const bs=bsel();const locs=VIEWS[SV.view].locs;
  let rows=S.items.filter(it=>!SV.q||it.name.includes(SV.q)).map(it=>{
    const per=bs.map(b=>{const by={};let t=0;for(const l of LOCS){by[l]=q(bal,b,l,it.id)}for(const l of locs)t+=by[l];return{b,by,t,st:status(bal,b,it)}});
    const pcs=per.reduce((a,p)=>a+p.t,0);const worst=per.reduce((w,p)=>SEV[p.st.k]<SEV[w.k]?p.st:w,{k:"ok",t:"متوفر"});
    return{it,per,pcs,g:pcs*(Number(it.weight)||0),worst}});
  const by={weight:(a,b)=>a.it.weight-b.it.weight,grams:(a,b)=>b.g-a.g,low:(a,b)=>a.pcs-b.pcs,alerts:(a,b)=>SEV[a.worst.k]-SEV[b.worst.k]||a.it.weight-b.it.weight}[SV.sort];
  return rows.sort(by);
}
function vStock(){
  const bal=balances();const bs=bsel();const rows=stockRows(bal);const view=VIEWS[SV.view];
  const sel=(id,opts,cur)=>`<select id="${id}">${opts.map(([v,l])=>`<option value="${v}" ${v===cur?"selected":""}>${l}</option>`).join("")}</select>`;
  let h=`<div class="head"><h2>المخزون</h2><button class="btn sm" id="exStock">تحميل Excel</button></div>
  <section class="toolbar">
    <label>العرض${sel("sv_view",Object.entries(VIEWS).map(([k,v])=>[k,v.l]),SV.view)}</label>
    <label>الفرع${sel("sv_branch",[["all","الفرعين"],["b2","بوابة 2"],["b4","بوابة 4"]],S.branch)}</label>
    <label>الترتيب${sel("sv_sort",[["weight","حسب الوزن"],["grams","الأكثر جرامات"],["low","الأقل كمية"],["alerts","التنبيهات أولاً"]],SV.sort)}</label>
    <label class="grow">بحث<input id="sq" placeholder="اسم الصنف…" value="${esc(SV.q)}"></label>
    <div class="seg2" role="group" aria-label="شكل العرض"><button data-mode="cards" aria-pressed="${SV.mode==="cards"}">كروت</button><button data-mode="table" aria-pressed="${SV.mode==="table"}">جدول</button></div>
  </section>`;
  // KPIs for the selected view
  let tp=0,tg=0,nWarn=0,nOut=0;
  for(const r of S.items.map(it=>({it,per:bs.map(b=>({st:status(bal,b,it),t:view.locs.reduce((a,l)=>a+q(bal,b,l,it.id),0)}))}))){
    const p=r.per.reduce((a,x)=>a+x.t,0);tp+=p;tg+=p*(Number(r.it.weight)||0);
    if(r.it.off)continue;if(r.per.some(x=>x.st.k==="bad"))nOut++;else if(r.per.some(x=>x.st.k==="warn"))nWarn++;}
  h+=`<div class="kpis">
    <div class="kpi"><span>إجمالي الجرامات</span><b>${fmt(tg)}</b><i>${view.l}</i></div>
    <div class="kpi"><span>عدد القطع</span><b>${fmt(tp)}</b><i>${bs.length>1?"الفرعين":BR[bs[0]]}</i></div>
    <div class="kpi warn"><span>تحت الحد</span><b>${nWarn}</b><i>صنف</i></div>
    <div class="kpi bad"><span>نافد / ناقص</span><b>${nOut}</b><i>صنف</i></div></div>`;
  // distribution of grams across locations, per branch
  h+=`<section class="panel dist"><div class="head"><h3>توزيع الذهب (بالجرام)</h3><div class="legend">${LOCS.map(l=>`<span><i class="sw ${l}"></i>${LOC[l]}</span>`).join("")}</div></div>`;
  const gb={};let gmax=0;for(const b of bs){gb[b]={};let t=0;for(const l of LOCS){let g=0;for(const it of S.items)g+=q(bal,b,l,it.id)*(Number(it.weight)||0);gb[b][l]=Math.max(0,g);t+=gb[b][l]}gb[b].t=t;gmax=Math.max(gmax,t)}
  for(const b of bs){const t=gb[b].t||0;
    h+=`<div class="distrow"><span class="dn">${BR[b]}</span><div class="track">${LOCS.map(l=>{const w=gmax?gb[b][l]/gmax*100:0;return w>0?`<div class="seg-bar ${l} ${view.locs.length===1&&!view.locs.includes(l)?"dim":""}" style="width:${w}%" title="${LOC[l]}: ${fmt(gb[b][l])} جم"></div>`:""}).join("")}</div><span class="dv">${fmt(t)} جم</span></div>
    <div class="distnums">${LOCS.map(l=>`<span>${LOCSHORT[l]}: <b>${fmt(gb[b][l])}</b></span>`).join("")}</div>`}
  h+=`</section>`;
  if(!rows.length)return h+`<div class="empty">مفيش أصناف مطابقة</div>`;
  if(SV.mode==="cards"){
    const gm=Math.max(1,...rows.map(r=>r.g));
    h+=`<div class="cards">`;
    for(const r of rows){
      h+=`<article class="card sev-${r.worst.k}${r.it.off?" off":""}">
      <div class="ch"><h4>${esc(r.it.name)}</h4><span class="wt">${fmt(r.it.weight)} جم</span></div>
      <div class="big"><b>${fmt(r.pcs)}</b><span>قطعة</span><em>${fmt(r.g)} جم</em></div>
      <div class="mbar"><div style="width:${Math.max(0,r.g/gm*100)}%"></div></div>
      ${r.per.map(p=>`<div class="br">${bs.length>1?`<span class="bn">${BR[p.b]}</span>`:""}<div class="pills">${LOCS.map(l=>`<span class="pill ${view.locs.length<3&&view.locs.includes(l)?"on":""} ${p.by[l]<0?"neg":p.by[l]===0?"z":""}">${LOCSHORT[l]} <b>${fmt(p.by[l])}</b></span>`).join("")}</div></div>`).join("")}
      ${(()=>{const w=r.per.filter(p=>p.st.k!=="ok").sort((x,y)=>x.st.r-y.st.r)[0];if(!w)return `<div class="cst"><span class="chip ok">متوفر</span></div>`;
        return `<div class="cst"><span class="chip ${w.st.k}">${bs.length>1?BR[w.b]+": ":""}${w.st.t}</span>${w.st.act?`<button class="btn xs" data-fix="${w.b}|${w.st.act}|${r.it.id}">${w.st.act==="main_sub"?"حوّل للفرعية":"عوّض البترينة"}</button>`:""}</div>`})()}
      </article>`}
    h+=`</div>`;
  }else{
    const det=SV.view==="all";
    h+=`<div class="tbl-wrap"><table><thead><tr><th class="name">الصنف</th><th>الوزن</th>`;
    for(const b of bs)h+=det?`<th>${BR[b]} رئيسية</th><th>${BR[b]} فرعية</th><th>${BR[b]} بترينة</th>`:`<th>${BR[b]}</th>`;
    h+=`<th>القطع</th><th>الجرام</th><th>الحالة</th></tr></thead><tbody>`;
    const tot={};let ap=0,ag=0;
    for(const r of rows){h+=`<tr><td class="name">${esc(r.it.name)}</td><td>${fmt(r.it.weight)}</td>`;
      for(const p of r.per){if(det)for(const l of LOCS){const v=p.by[l];tot[p.b+l]=(tot[p.b+l]||0)+v;h+=`<td class="${v<0?"neg":v===0?"zero":""}">${fmt(v)}</td>`}
        else{tot[p.b]=(tot[p.b]||0)+p.t;h+=`<td class="${p.t<0?"neg":p.t===0?"zero":""}">${fmt(p.t)}</td>`}}
      ap+=r.pcs;ag+=r.g;h+=`<td><b>${fmt(r.pcs)}</b></td><td>${fmt(r.g)}</td><td><span class="chip ${r.worst.k}">${r.worst.t}</span></td></tr>`}
    h+=`<tr class="tot"><td class="name">الإجمالي</td><td></td>`;for(const b of bs)h+=det?LOCS.map(l=>`<td>${fmt(tot[b+l]||0)}</td>`).join(""):`<td>${fmt(tot[b]||0)}</td>`;
    h+=`<td>${fmt(ap)}</td><td>${fmt(ag)}</td><td></td></tr></tbody></table></div>`;
  }
  return h;
}
function bStock(){
  $("#sv_view").onchange=e=>{SV.view=e.target.value;saveSV();render()};
  $("#sv_branch").onchange=e=>setBranch(e.target.value);
  $("#sv_sort").onchange=e=>{SV.sort=e.target.value;saveSV();render()};
  document.querySelectorAll("[data-mode]").forEach(b=>b.onclick=()=>{SV.mode=b.dataset.mode;saveSV();render()});
  const sq=$("#sq");sq.oninput=()=>{SV.q=sq.value.trim();const pos=sq.selectionStart;render();const n=$("#sq");n.focus();n.setSelectionRange(pos,pos)};
  document.querySelectorAll("[data-fix]").forEach(b=>b.onclick=()=>{const [br,type,item]=b.dataset.fix.split("|");S.draft={branch:br,type,lines:[{item,qty:1}]};location.hash="new"});
  $("#exStock").onclick=()=>{const bal=balances();const rows=[["الصنف","الوزن (جم)",...BKEYS.flatMap(b=>LOCS.map(l=>`${BR[b]} - ${LOC[l]}`)),"إجمالي القطع","إجمالي الجرام"]];
    for(const it of S.items){let p=0;const r=[it.name,it.weight];for(const b of BKEYS)for(const l of LOCS){const v=q(bal,b,l,it.id);p+=v;r.push(v)}r.push(p,Math.round(p*it.weight*100)/100);rows.push(r)}
    saveCsv(`مخزون_${today()}.csv`,rows)};
}

/* ---------- NEW MOVE ---------- */
const QUICK=[
  ["sale_sub","بيع","من الخزنة الفرعية","M4 7h16l-1.5 11h-13z M9 7a3 3 0 0 1 6 0"],
  ["main_sub","تحويل للفرعية","رئيسية ← فرعية","M5 12h14 M13 6l6 6-6 6"],
  ["sub_show","تعويض البترينة","فرعية ← بترينة","M4 5h16v11H4z M8 20h8"],
  ["in_main","وارد","للخزنة الرئيسية","M12 4v12 M6 10l6 6 6-6 M4 20h16"],
  ["sale_show","بيع من البترينة","لما الصنف يخلص","M4 5h16v11H4z M9 10h6"],
  ["cust_ret","مرتجع عميل","يرجع للفرعية","M9 7L4 12l5 5 M4 12h11a5 5 0 0 1 0 10"],
  ["branch","للفرع التاني","رئيسية ← رئيسية","M4 8h13 M13 4l4 4-4 4 M20 16H7 M11 12l-4 4 4 4"]
];
const QSET=new Set(QUICK.map(x=>x[0]));
function freshDraft(){return{branch:S.branch==="all"?"b2":S.branch,type:"sale_sub",loc:"main",date:today(),note:"",emp:myName(),lines:[],pick:{item:"",qty:1}}}
function srcLoc(d){const t=T[d.type];if(t.loc)return null;const neg=t.fx.find(f=>f[1]<0);return neg?neg[0]:null}
function flowText(d){const t=T[d.type];
  if(t.loc)return d.type==="open"?`هيتضاف العدد لرصيد ${LOC[d.loc]} في ${BR[d.branch]}.`:`اكتب الفرق: موجب لو الجرد الفعلي أزيد، وسالب لو أقل – بيتعدل رصيد ${LOC[d.loc]}.`;
  const parts=t.fx.map(([l,s])=>`${s<0?"يخصم من":"يضيف إلى"} ${LOC[l]}`);
  if(t.to)parts.push(`يضيف إلى الخزنة الرئيسية في ${BR[other(d.branch)]}`);
  return parts.join(" ← ")+(t.sale?(t.sale>0?" · ويتحسب مبيعات":" · ويتخصم من المبيعات"):"");
}
function itemGroups(){const g=[["سبائك صغيرة (حتى 8 جم)",i=>i.weight<10],["10 – 31.10 جم",i=>i.weight>=10&&i.weight<50],["50 – 116 جم",i=>i.weight>=50&&i.weight<250],["سبائك كبيرة (250 جم فأكثر)",i=>i.weight>=250]];
  return g.map(([l,f])=>[l,activeItems().filter(f).sort((a,b)=>a.weight-b.weight)]).filter(x=>x[1].length)}
function vNew(){
  if(!S.draft)S.draft=freshDraft();const d=Object.assign(freshDraft(),S.draft);S.draft=d;
  d.lines=(d.lines||[]).filter(l=>l.item).map(l=>({item:l.item,qty:l.qty===""?1:l.qty}));
  const t=T[d.type];const bal=balances();const src=srcLoc(d);const avl=id=>src?q(bal,d.branch,src,id):(t.loc?q(bal,d.branch,d.loc,id):null);
  let h=`<div class="head"><h2>حركة جديدة</h2><div class="seg2" role="group" aria-label="الفرع">${BKEYS.map(b=>`<button data-br="${b}" aria-pressed="${d.branch===b}">${BR[b]}</button>`).join("")}</div></div>
  <section class="panel"><h3 class="step"><span>1</span>نوع الحركة</h3><div class="qa">`;
  for(const [k,l,sub,path] of QUICK)h+=`<button data-qt="${k}" aria-pressed="${d.type===k}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg><b>${l}</b><small>${sub}</small></button>`;
  h+=`</div><label>حركات تانية<select id="f_more"><option value="">— اختار —</option>${Object.entries(T).filter(([k])=>!QSET.has(k)).map(([k,v])=>`<option value="${k}" ${d.type===k?"selected":""}>${v.l}</option>`).join("")}</select></label>`;
  if(t.loc)h+=`<div class="seg2 wide" role="group" aria-label="المكان">${LOCS.map(l=>`<button data-loc="${l}" aria-pressed="${d.loc===l}">${LOC[l]}</button>`).join("")}</div>`;
  h+=`<div class="flow">${flowText(d)}</div></section>
  <section class="panel"><h3 class="step"><span>2</span>الأصناف</h3>
  <div class="picker"><label class="grow">الصنف<select id="p_item"><option value="">اختار الصنف من القائمة…</option>${itemGroups().map(([g,its])=>`<optgroup label="${g}">${its.map(it=>{const a=avl(it.id);return `<option value="${it.id}" ${d.pick.item===it.id?"selected":""}>${esc(it.name)}${a!==null?` — ${src?"متاح":"رصيد"} ${fmt(a)}`:""}</option>`}).join("")}</optgroup>`).join("")}</select></label>
  <label>العدد<div class="stepper"><button data-ps="-1" aria-label="أقل">−</button><input id="p_qty" type="number" inputmode="numeric" step="1" value="${esc(d.pick.qty)}"><button data-ps="1" aria-label="أكتر">+</button></div></label>
  <button class="btn pri add" id="p_add">إضافة</button></div>
  ${t.loc?`<button class="btn sm" id="allLines">إضافة كل الأصناف مرة واحدة</button>`:""}<div id="p_err"></div>`;
  if(!d.lines.length)h+=`<div class="empty small">اختار الصنف من القائمة، حدد العدد، واضغط «إضافة». تقدر تضيف أكتر من صنف في نفس الحركة.</div>`;
  else{h+=`<div class="cart">`;d.lines.forEach((ln,i)=>{const a=avl(ln.item);const over=src&&a!==null&&Number(ln.qty)>a;
    h+=`<div class="ci ${over?"over":""}"><div class="cn"><b>${esc(iname(ln.item))}</b><small>${fmt((Number(ln.qty)||0)*iw(ln.item))} جم${a!==null?` · ${src?"المتاح":"الرصيد"} ${fmt(a)}`:""}${over?" · الكمية أكبر من المتاح":""}</small></div>
    <div class="stepper sm"><button data-ls="${i}|-1" aria-label="أقل">−</button><input type="number" inputmode="numeric" step="1" data-lq="${i}" value="${esc(ln.qty)}"><button data-ls="${i}|1" aria-label="أكتر">+</button></div>
    <button class="btn xs danger" data-rm="${i}" aria-label="حذف">✕</button></div>`});h+=`</div>`}
  h+=`<details class="more" ${d.note||d.date!==today()?"open":""}><summary>تفاصيل إضافية (التاريخ، الموظف، ملاحظات)</summary><div class="form">
  <label>التاريخ<input type="date" id="f_date" value="${d.date}"></label><label>اسم الموظف<input id="f_emp" value="${esc(d.emp)}"></label>
  <label style="grid-column:1/-1">ملاحظات / رقم الفاتورة<input id="f_note" value="${esc(d.note)}" placeholder="اختياري"></label></div></details></section>`;
  let pcs=0,gr=0;d.lines.forEach(ln=>{const n=Number(ln.qty)||0;pcs+=n;gr+=n*iw(ln.item)});
  h+=`<div id="f_err"></div><div class="savebar"><div><span class="muted small">${T[d.type].l} · ${BR[d.branch]}</span><div id="f_tot"><b>${fmt(gr)}</b> جم · ${fmt(pcs)} قطعة</div></div><div class="row"><button class="btn" id="reset">تفريغ</button><button class="btn gold" id="save">حفظ الحركة</button></div></div>`;
  return h;
}
function bNew(){
  const d=S.draft;
  const keep=()=>{const f=$("#f_date");if(f){d.date=f.value;d.note=$("#f_note").value;d.emp=$("#f_emp").value}const pq=$("#p_qty");if(pq)d.pick.qty=pq.value};
  const tot=()=>{let pcs=0,gr=0;d.lines.forEach(ln=>{const n=Number(ln.qty)||0;pcs+=n;gr+=n*iw(ln.item)});$("#f_tot").innerHTML=`<b>${fmt(gr)}</b> جم · ${fmt(pcs)} قطعة`};
  document.querySelectorAll("[data-br]").forEach(b=>b.onclick=()=>{keep();d.branch=b.dataset.br;render()});
  document.querySelectorAll("[data-qt]").forEach(b=>b.onclick=()=>{keep();d.type=b.dataset.qt;render()});
  $("#f_more").onchange=e=>{if(!e.target.value)return;keep();d.type=e.target.value;render()};
  document.querySelectorAll("[data-loc]").forEach(b=>b.onclick=()=>{keep();d.loc=b.dataset.loc;render()});
  ["f_date","f_note","f_emp"].forEach(id=>$("#"+id).oninput=keep);
  $("#p_item").onchange=e=>{keep();d.pick.item=e.target.value;};
  $("#p_qty").oninput=e=>{d.pick.qty=e.target.value};
  document.querySelectorAll("[data-ps]").forEach(b=>b.onclick=()=>{const inp=$("#p_qty");let v=(parseInt(inp.value,10)||0)+Number(b.dataset.ps);if(!T[d.type].signed&&v<1)v=1;inp.value=v;d.pick.qty=v});
  const add=()=>{keep();const id=$("#p_item").value;const n=parseInt($("#p_qty").value,10);const pe=$("#p_err");
    if(!id){pe.innerHTML=`<div class="note warn small">اختار الصنف الأول.</div>`;$("#p_item").focus();return}
    if(!Number.isInteger(n)||n===0||(!T[d.type].signed&&n<0)){pe.innerHTML=`<div class="note warn small">اكتب عدد صحيح.</div>`;return}
    const ex=d.lines.find(l=>l.item===id);if(ex)ex.qty=(Number(ex.qty)||0)+n;else d.lines.push({item:id,qty:n});
    d.pick={item:"",qty:1};render();$("#p_item")?.focus()};
  $("#p_add").onclick=add;$("#p_qty").onkeydown=e=>{if(e.key==="Enter")add()};
  document.querySelectorAll("[data-ls]").forEach(b=>b.onclick=()=>{keep();const [i,s]=b.dataset.ls.split("|");const ln=d.lines[+i];let v=(Number(ln.qty)||0)+Number(s);
    if(!T[d.type].signed&&v<1){d.lines.splice(+i,1)}else ln.qty=v;render()});
  document.querySelectorAll("[data-lq]").forEach(s=>s.oninput=()=>{d.lines[+s.dataset.lq].qty=s.value;tot()});
  document.querySelectorAll("[data-rm]").forEach(b=>b.onclick=()=>{keep();d.lines.splice(+b.dataset.rm,1);render()});
  $("#allLines")&&($("#allLines").onclick=()=>{keep();const have=new Set(d.lines.map(l=>l.item));d.lines=d.lines.concat(activeItems().filter(i=>!have.has(i.id)).map(i=>({item:i.id,qty:""})));render()});
  $("#reset").onclick=()=>{const b=d.branch,t=d.type;S.draft=Object.assign(freshDraft(),{branch:b,type:t});render()};
  $("#save").onclick=saveMove;
}
function writeMove(m,okMsg){
  /* With offline persistence the write lands in the local cache immediately and syncs later; errors arrive async. */
  const ref=db.collection("moves").doc();
  ref.set(m).catch(e=>toast("الحركة ما اتحفظتش: "+errText(e)));
  toast(S.online?okMsg:okMsg+" (هتتزامن لما النت يرجع)");
}
function saveMove(){
  const d=S.draft;const t=T[d.type];const err=$("#f_err");
  const showErr=x=>{err.innerHTML=`<div class="note bad">${esc(x)}</div>`;err.scrollIntoView({block:"center"});return false};
  d.date=$("#f_date").value;d.note=$("#f_note").value.trim();d.emp=$("#f_emp").value.trim();
  if(!d.lines.length&&$("#p_item").value)$("#p_add").click();
  const seen={};
  for(const ln of d.lines){if(ln.qty===""||ln.qty===undefined)continue;
    const n=Number(ln.qty);
    if(!Number.isInteger(n)||(!t.signed&&n<0))return showErr(`اكتب عدد صحيح للصنف «${iname(ln.item)}».`);
    if(n===0)continue;
    seen[ln.item]=(seen[ln.item]||0)+n;}
  const lines=[];for(const [item,qty] of Object.entries(seen)){if(!qty)continue;const o={item,qty};if(t.loc)o.loc=d.loc;lines.push(o)}
  if(!lines.length)return showErr("ضيف صنف واحد على الأقل.");
  if(!d.date)return showErr("اختار التاريخ.");
  const m={date:d.date,ts:Date.now(),branch:d.branch,type:d.type,lines,note:d.note,emp:d.emp,by:S.email,void:false};
  if(t.to)m.to=other(d.branch);
  const after=balances(m);const bad=[];
  for(const x of deltas(m)){const v=q(after,x.b,x.loc,x.item);if(v<0)bad.push(`«${iname(x.item)}» في ${LOC[x.loc]} (${BR[x.b]}) هيبقى ${fmt(v)}`)}
  if(bad.length)return showErr("الرصيد مش كفاية: "+[...new Set(bad)].join("، ")+". راجع العدد أو سجّل وارد/تحويل الأول.");
  if(d.emp)store.set("gv.emp",d.emp);
  writeMove(m,"اتسجلت الحركة ✓");
  S.draft=Object.assign(freshDraft(),{branch:d.branch,type:d.type,loc:d.loc,date:d.date,emp:d.emp});
  render();window.scrollTo(0,0);
}

/* ---------- LOG ---------- */
let logF={type:"",item:""};
function lineSummary(m){return m.lines.map(ln=>`${esc(iname(ln.item))} × ${ln.qty>0&&T[m.type]?.signed?"+":""}${fmt(ln.qty)}`).join("، ")}
function moveCard(m){
  const t=T[m.type]||{l:m.type};const g=m.lines.reduce((s,ln)=>s+Math.abs(ln.qty)*iw(ln.item),0);
  const cls=t.sale>0?"ok":t.sale<0?"warn":m.type==="adjust"?"bad":m.type==="branch"?"gold":"plain";
  const canVoid=isAdmin()&&!m.void&&!(S.closing&&m.ts<=S.closing.ts);
  const who=m.emp||nameOf(m.by);
  return `<div class="move ${m.void?"void":""}"><div class="mh"><span class="chip ${cls}">${t.l}</span><b>${BR[m.branch]||""}</b>${m.to?`<span class="muted">← ${BR[m.to]}</span>`:""}${t.loc&&m.lines[0]?.loc?`<span class="muted small">${LOC[m.lines[0].loc]}</span>`:""}<span class="muted small" style="margin-inline-start:auto">${m.date}${who?" · "+esc(who):""}</span>${m.void?'<span class="chip bad">ملغاة</span>':""}${m._pending?'<span class="chip warn">لسه ما اتزامنتش</span>':""}</div>
  <div class="ml">${lineSummary(m)} <span class="muted small">(${fmt(g)} جم)</span></div>${m.note?`<div class="muted small">${esc(m.note)}</div>`:""}
  ${canVoid?`<div class="confirm" data-vbox="${m.id}"><button class="btn sm danger" data-void="${m.id}">إلغاء الحركة</button></div>`:""}</div>`;
}
function bindMoves(){
  document.querySelectorAll("[data-void]").forEach(b=>b.onclick=()=>{const id=b.dataset.void;const box=document.querySelector(`[data-vbox="${id}"]`);
    box.innerHTML=`<span>متأكد؟ الحركة هتتلغي وأثرها على الرصيد هيتشال.</span><button class="btn sm danger" data-yes>أيوه، ألغيها</button><button class="btn sm" data-no>لا</button>`;
    box.querySelector("[data-no]").onclick=()=>render();
    box.querySelector("[data-yes]").onclick=()=>{
      const m=S.live.find(x=>x.id===id);
      if(m){const bal=emptyBal();const cb=S.closing?.bal;if(cb)for(const b of BKEYS)for(const l of LOCS)Object.assign(bal[b][l],cb[b]?.[l]||{});
        for(const x of S.live){if(x.void||x.id===id)continue;for(const d of deltas(x))bal[d.b][d.loc][d.item]=(bal[d.b][d.loc][d.item]||0)+d.d}
        const bad=deltas(m).filter(d=>q(bal,d.b,d.loc,d.item)<0);
        if(bad.length){box.innerHTML=`<span class="note bad small">مينفعش تتلغي: «${esc(iname(bad[0].item))}» في ${LOC[bad[0].loc]} هيبقى بالسالب لأنه اتصرف بعدها. ألغِ الحركات اللي بعدها الأول أو اعمل تسوية جرد.</span>`;return}}
      db.collection("moves").doc(id).update({void:true,voidBy:S.email}).catch(e=>toast("الإلغاء ما نجحش: "+errText(e)));toast("اتلغت الحركة")};});
}
function vLog(){
  if(!S.logRange)S.logRange={from:S.closing?.date&&S.closing.date>monthStart()?S.closing.date:monthStart(),to:today()};
  const r=S.logRange;
  return `<div class="head"><h2>سجل الحركات</h2><button class="btn sm" id="exLog">تحميل Excel</button></div>
  <section class="panel"><div class="form">
  <label>من تاريخ<input type="date" id="l_from" value="${r.from}"></label><label>إلى تاريخ<input type="date" id="l_to" value="${r.to}"></label>
  <label>نوع الحركة<select id="l_type"><option value="">الكل</option>${Object.entries(T).map(([k,v])=>`<option value="${k}" ${logF.type===k?"selected":""}>${v.l}</option>`).join("")}</select></label>
  <label>الصنف<select id="l_item"><option value="">الكل</option>${S.items.map(i=>`<option value="${i.id}" ${logF.item===i.id?"selected":""}>${esc(i.name)}</option>`).join("")}</select></label>
  </div></section><div id="logList"><div class="empty">جاري التحميل…</div></div>`;
}
async function filteredLog(){
  const r=S.logRange;let list=await movesInRange(r.from,r.to);
  return list.filter(m=>(bsel().includes(m.branch)||bsel().includes(m.to))&&(!logF.type||m.type===logF.type)&&(!logF.item||m.lines.some(l=>l.item===logF.item)));
}
function bLog(){
  const upd=()=>{S.logRange={from:$("#l_from").value||monthStart(),to:$("#l_to").value||today()};logF.type=$("#l_type").value;logF.item=$("#l_item").value;fill()};
  ["l_from","l_to","l_type","l_item"].forEach(id=>$("#"+id).onchange=upd);
  const fill=async()=>{const box=$("#logList");if(!box)return;try{const list=await filteredLog();
    box.innerHTML=list.length?`<p class="muted small">${list.length} حركة</p><div class="moves">${list.map(moveCard).join("")}</div>`:`<div class="empty">مفيش حركات في الفترة دي.</div>`;bindMoves()}
    catch(e){box.innerHTML=`<div class="note bad">ما قدرناش نجيب الحركات القديمة دلوقتي (محتاج إنترنت). ${esc(errText(e))}</div>`}};
  fill();
  $("#exLog").onclick=async()=>{const list=await filteredLog();const rows=[["التاريخ","الفرع","نوع الحركة","الفرع المستلم","المكان","الصنف","العدد","الوزن (جم)","الموظف","ملاحظات","الحالة"]];
    for(const m of list)for(const ln of m.lines)rows.push([m.date,BR[m.branch],T[m.type]?.l||m.type,m.to?BR[m.to]:"",ln.loc?LOC[ln.loc]:"",iname(ln.item),ln.qty,Math.round(ln.qty*iw(ln.item)*100)/100,m.emp||nameOf(m.by),m.note||"",m.void?"ملغاة":""]);
    saveCsv(`سجل_الحركات_${S.logRange.from}_${S.logRange.to}.csv`,rows)};
}

/* ---------- REPORTS ---------- */
let repRows=[];
function vReports(){
  if(!S.repRange)S.repRange={from:monthStart(),to:today()};
  return `<div class="head"><h2>تقرير المبيعات والحركة</h2><button class="btn sm" id="exRep">تحميل Excel</button></div>
  <section class="panel"><div class="form"><label>من تاريخ<input type="date" id="r_from" value="${S.repRange.from}"></label><label>إلى تاريخ<input type="date" id="r_to" value="${S.repRange.to}"></label>
  <label>فترة سريعة<select id="r_quick"><option value="">—</option><option value="d">النهارده</option><option value="w">آخر 7 أيام</option><option value="m">الشهر ده</option></select></label></div></section>
  <div id="repBody"><div class="empty">جاري الحساب…</div></div>`;
}
function bReports(){
  const run=async()=>{const box=$("#repBody");if(!box)return;let list;
    try{list=(await movesInRange(S.repRange.from,S.repRange.to)).filter(m=>!m.void)}catch(e){box.innerHTML=`<div class="note bad">ما قدرناش نجيب بيانات الفترة دي (محتاج إنترنت).</div>`;return}
    const sale={},inn={},trf={};
    for(const m of list){const t=T[m.type];if(!t)continue;for(const ln of m.lines){const k=m.branch+ln.item;
      if(t.sale)sale[k]=(sale[k]||0)+t.sale*ln.qty;
      if(m.type==="in_main")inn[m.branch]=(inn[m.branch]||0)+ln.qty*iw(ln.item);
      if(m.type==="branch")trf[m.branch]=(trf[m.branch]||0)+ln.qty*iw(ln.item);}}
    const bs=bsel();let h=`<div class="grid2">`;
    for(const b of bs){let p=0,g=0;for(const it of S.items){const v=sale[b+it.id]||0;p+=v;g+=v*it.weight}
      h+=`<section class="panel"><h3>${BR[b]}</h3><div class="tiles"><div class="tile"><span>قطع مباعة</span><b>${fmt(p)}</b></div><div class="tile"><span>جرامات مباعة</span><b>${fmt(g)}</b></div><div class="tile"><span>وارد للرئيسية</span><b>${fmt(inn[b]||0)}</b><i>جرام</i></div></div>
      ${trf[b]?`<p class="muted small">اتحوّل للفرع الآخر: ${fmt(trf[b])} جرام</p>`:""}</section>`}
    h+=`</div><section class="panel"><h3>المبيعات حسب الصنف</h3><div class="tbl-wrap"><table><thead><tr><th class="name">الصنف</th>${bs.map(b=>`<th>${BR[b]} قطع</th><th>${BR[b]} جرام</th>`).join("")}${bs.length>1?"<th>إجمالي قطع</th><th>إجمالي جرام</th>":""}</tr></thead><tbody>`;
    repRows=[["الصنف",...bs.flatMap(b=>[BR[b]+" قطع",BR[b]+" جرام"]),"إجمالي قطع","إجمالي جرام"]];let any=false;
    for(const it of S.items){const vals=bs.map(b=>sale[b+it.id]||0);const tp=vals.reduce((a,c)=>a+c,0);if(!vals.some(Boolean))continue;any=true;
      h+=`<tr><td class="name">${esc(it.name)}</td>${vals.map(v=>`<td>${fmt(v)}</td><td>${fmt(v*it.weight)}</td>`).join("")}${bs.length>1?`<td><b>${fmt(tp)}</b></td><td>${fmt(tp*it.weight)}</td>`:""}</tr>`;
      repRows.push([it.name,...vals.flatMap(v=>[v,Math.round(v*it.weight*100)/100]),tp,Math.round(tp*it.weight*100)/100]);}
    if(!any)h+=`<tr><td colspan="9" class="muted">مفيش مبيعات في الفترة دي</td></tr>`;
    box.innerHTML=h+`</tbody></table></div><p class="muted small">المبيعات = بيع من الخزنة الفرعية + بيع من البترينة − مرتجعات العملاء.</p></section>`;
  };
  const upd=()=>{S.repRange={from:$("#r_from").value||monthStart(),to:$("#r_to").value||today()};run()};
  $("#r_from").onchange=upd;$("#r_to").onchange=upd;
  $("#r_quick").onchange=e=>{const v=e.target.value;const t=today();if(v==="d")S.repRange={from:t,to:t};if(v==="m")S.repRange={from:monthStart(),to:t};
    if(v==="w"){const d=new Date();d.setDate(d.getDate()-6);S.repRange={from:dstr(d),to:t}}render()};
  $("#exRep").onclick=()=>saveCsv(`تقرير_المبيعات_${S.repRange.from}_${S.repRange.to}.csv`,repRows);
  run();
}

/* ---------- COUNT ---------- */
function vCount(){
  const c=S.countSel;if(S.branch!=="all")c.b=S.branch;const bal=balances();
  let h=`<div class="head"><h2>الجرد الفعلي</h2><span class="muted small">اكتب العدد اللي لقيته فعلاً – الفرق بيتسجل «تسوية جرد» لوحده</span></div>
  <section class="panel"><div class="form"><label>الفرع<select id="c_b">${BKEYS.map(b=>`<option value="${b}" ${c.b===b?"selected":""}>${BR[b]}</option>`).join("")}</select></label>
  <label>المكان<select id="c_loc">${LOCS.map(l=>`<option value="${l}" ${c.loc===l?"selected":""}>${LOC[l]}</option>`).join("")}</select></label></div>
  <div class="tbl-wrap"><table><thead><tr><th class="name">الصنف</th><th>رصيد السيستم</th><th>العدد الفعلي</th><th>الفرق</th></tr></thead><tbody>`;
  let diffs=0;
  for(const it of activeItems()){const sys=q(bal,c.b,c.loc,it.id);const v=c.vals[it.id];const has=v!==undefined&&v!=="";const df=has?Number(v)-sys:0;if(has&&df)diffs++;
    h+=`<tr><td class="name">${esc(it.name)}</td><td>${fmt(sys)}</td><td style="width:120px"><input type="number" inputmode="numeric" min="0" step="1" data-cv="${it.id}" value="${esc(v??"")}" placeholder="—"></td><td class="${df<0?"neg":""}" data-cd="${it.id}">${has?(df>0?"+":"")+fmt(df):""}</td></tr>`}
  h+=`</tbody></table></div><div id="c_msg"></div><div class="row"><button class="btn gold" id="c_save">حفظ الجرد وتسوية الفروقات</button><button class="btn" id="c_clear">مسح الخانات</button><span class="muted small" id="c_cnt">${diffs} صنف فيهم فرق</span></div></section>`;
  return h;
}
function bCount(){
  const c=S.countSel;
  $("#c_b").onchange=e=>{c.b=e.target.value;c.vals={};render()};$("#c_loc").onchange=e=>{c.loc=e.target.value;c.vals={};render()};
  document.querySelectorAll("[data-cv]").forEach(inp=>inp.oninput=()=>{c.vals[inp.dataset.cv]=inp.value;const bal=balances();const sys=q(bal,c.b,c.loc,inp.dataset.cv);
    const cell=document.querySelector(`[data-cd="${inp.dataset.cv}"]`);if(inp.value===""){cell.textContent="";return}const df=Number(inp.value)-sys;cell.textContent=(df>0?"+":"")+fmt(df);cell.className=df<0?"neg":"";
    $("#c_cnt").textContent=Object.keys(c.vals).filter(k=>c.vals[k]!==""&&Number(c.vals[k])-q(bal,c.b,c.loc,k)!==0).length+" صنف فيهم فرق"});
  $("#c_clear").onclick=()=>{c.vals={};render()};
  $("#c_save").onclick=()=>{const bal=balances();const lines=[];
    for(const [id,v] of Object.entries(c.vals)){if(v==="")continue;const n=Number(v);if(!Number.isInteger(n)||n<0){$("#c_msg").innerHTML=`<div class="note bad">العدد الفعلي لازم يكون رقم صحيح من صفر وطالع («${esc(iname(id))}»).</div>`;return}
      const df=n-q(bal,c.b,c.loc,id);if(df)lines.push({item:id,qty:df,loc:c.loc})}
    if(!lines.length){$("#c_msg").innerHTML=`<div class="note info">مفيش فروقات – الجرد مطابق للسيستم.</div>`;return}
    writeMove({date:today(),ts:Date.now(),branch:c.b,type:"adjust",lines,note:`جرد ${LOC[c.loc]}`,emp:myName(),by:S.email,void:false},`اتسجلت تسوية لـ ${lines.length} صنف`);
    c.vals={};render()};
}

/* ---------- SETTINGS (items, users, closing) ---------- */
function vItems(){
  if(!S.itemsDraft)S.itemsDraft=S.items.map(i=>({...i}));const ed=isAdmin();
  let h=`<div class="head"><h2>الإعدادات</h2>${ed?"":'<span class="chip plain">التعديل للمدير فقط</span>'}</div>
  <section class="panel"><div class="head"><h3>قائمة الأصناف</h3>${ed?'<button class="btn sm" id="i_add">+ صنف جديد</button>':""}</div>
  <div class="tbl-wrap"><table><thead><tr><th>م</th><th class="name">اسم الصنف</th><th>الوزن (جرام)</th><th>حد أدنى للفرعية</th><th>نشط</th></tr></thead><tbody>`;
  S.itemsDraft.forEach((it,i)=>{h+=`<tr><td>${i+1}</td><td style="min-width:200px"><input data-in="${i}" value="${esc(it.name)}" ${ed?"":"disabled"}></td><td style="width:120px"><input type="number" step="0.01" min="0" data-iw="${i}" value="${it.weight}" ${ed?"":"disabled"}></td><td style="width:110px"><input type="number" step="1" min="0" data-im="${i}" value="${it.min??0}" ${ed?"":"disabled"}></td><td><input type="checkbox" data-io="${i}" ${it.off?"":"checked"} ${ed?"":"disabled"} style="width:auto"></td></tr>`});
  h+=`</tbody></table></div><p class="muted small">الصنف غير النشط بيختفي من قوائم الحركات والجرد، بس رصيده وسجله بيفضلوا.</p>
  <div id="i_msg"></div>${ed?'<div class="row"><button class="btn gold" id="i_save">حفظ الأصناف</button><button class="btn" id="i_undo">تراجع</button></div>':""}</section>`;
  if(ed){
    h+=`<section class="panel"><h3>المستخدمين</h3><p class="small muted">كل موظف بيدخل بإيميل وكلمة سر. المدير بس هو اللي يقدر يعدّل الأصناف ويلغي الحركات ويضيف موظفين.</p>
    <div class="tbl-wrap"><table><thead><tr><th class="name">الاسم</th><th class="name">الإيميل</th><th>الصلاحية</th><th></th></tr></thead><tbody>
    ${S.admins.map(e=>`<tr><td class="name">${esc(nameOf(e))}</td><td class="name">${esc(e)}</td><td><span class="chip gold">مدير</span></td><td></td></tr>`).join("")}
    ${S.staff.filter(s=>!S.admins.includes(s.email)).map(s=>`<tr><td class="name">${esc(s.name)}</td><td class="name">${esc(s.email)}</td><td><span class="chip plain">موظف</span></td><td><button class="btn sm danger" data-rmu="${esc(s.email)}">إيقاف</button></td></tr>`).join("")}
    </tbody></table></div>
    <div class="form"><label>اسم الموظف<input id="u_name" placeholder="مثلاً: أحمد – بوابة 2"></label><label>الإيميل<input id="u_email" type="email" dir="ltr" placeholder="ahmed@gmail.com"></label><label>كلمة السر (6 على الأقل)<input id="u_pass" dir="ltr" placeholder="••••••"></label></div>
    <div id="u_msg"></div><div class="row"><button class="btn pri" id="u_add">إضافة موظف</button></div></section>`;
    const cl=S.closing;
    h+=`<section class="panel"><h3>إقفال الفترة (ترحيل الأرصدة)</h3><p class="small">بيحفظ الأرصدة الحالية كرصيد بداية عشان البرنامج يفضل سريع مع كتر الحركات. اعمله آخر كل شهر بعد الجرد. الحركات القديمة بتفضل في السجل والتقارير، بس مش هتقدر تلغيها بعد الإقفال.</p>
    <p class="muted small">${cl?`آخر إقفال: ${cl.date}`:"لسه ما اتعملش إقفال."} · الحركات المفتوحة دلوقتي: ${S.live.length}</p>
    <div class="confirm" id="cl_box"><button class="btn pri" id="cl_btn">إقفال الفترة الآن</button></div></section>`;
  }
  return h;
}
function bItems(){
  if(!isAdmin())return;const D=S.itemsDraft;
  document.querySelectorAll("[data-in]").forEach(x=>x.oninput=()=>D[+x.dataset.in].name=x.value);
  document.querySelectorAll("[data-iw]").forEach(x=>x.oninput=()=>D[+x.dataset.iw].weight=x.value);
  document.querySelectorAll("[data-im]").forEach(x=>x.oninput=()=>D[+x.dataset.im].min=x.value);
  document.querySelectorAll("[data-io]").forEach(x=>x.onchange=()=>D[+x.dataset.io].off=!x.checked);
  $("#i_add").onclick=()=>{let n=1;while(D.some(i=>i.id==="i"+String(n).padStart(2,"0")))n++;D.push({id:"i"+String(n).padStart(2,"0"),name:"",weight:"",min:2});render();const all=document.querySelectorAll("[data-in]");all[all.length-1].focus()};
  $("#i_undo").onclick=()=>{S.itemsDraft=null;render()};
  const msg=x=>{$("#i_msg").innerHTML=`<div class="note bad">${esc(x)}</div>`};
  $("#i_save").onclick=()=>{const out=[];for(const it of D){const name=String(it.name).trim();const w=Number(it.weight),mn=Number(it.min);
      if(!name){if(!S.items.some(x=>x.id===it.id))continue;return msg("اسم الصنف مينفعش يبقى فاضي.")}
      if(!(w>0))return msg(`اكتب وزن صحيح للصنف «${name}».`);if(!Number.isInteger(mn)||mn<0)return msg(`الحد الأدنى للصنف «${name}» لازم رقم صحيح.`);
      const o={id:it.id,name,weight:w,min:mn};if(it.off)o.off=true;out.push(o)}
    db.doc("config/items").set({items:out}).catch(e=>toast(errText(e)));S.itemsDraft=null;toast("اتحفظت الأصناف ✓");render()};
  document.querySelectorAll("[data-rmu]").forEach(b=>b.onclick=()=>{const e=b.dataset.rmu;
    db.doc("config/staff").set({list:S.staff.filter(s=>s.email!==e),emails:S.staff.filter(s=>s.email!==e).map(s=>s.email)}).then(()=>toast("اتوقف الحساب")).catch(x=>toast(errText(x)))});
  $("#u_add").onclick=async()=>{const name=$("#u_name").value.trim(),email=$("#u_email").value.trim().toLowerCase(),pass=$("#u_pass").value;
    const um=x=>{$("#u_msg").innerHTML=x};
    if(!name||!email)return um(`<div class="note bad">اكتب الاسم والإيميل.</div>`);
    if(S.staff.some(s=>s.email===email))return um(`<div class="note bad">الموظف ده متضاف بالفعل.</div>`);
    const btn=$("#u_add");btn.disabled=true;btn.textContent="جاري الإضافة…";let note="";
    try{
      const sec=firebase.apps.find(a=>a.name==="sec")||firebase.initializeApp(CFG,"sec");
      try{await sec.auth().createUserWithEmailAndPassword(email,pass);await sec.auth().signOut()}
      catch(e){if(String(e.code).includes("email-already-in-use"))note="الإيميل كان عليه حساب قبل كده، فاتدّى صلاحية الدخول بنفس كلمة السر القديمة.";else throw e}
      const list=S.staff.concat([{email,name}]);
      await db.doc("config/staff").set({list,emails:list.map(s=>s.email)});
      toast("اتضاف الموظف ✓");um(note?`<div class="note info">${note}</div>`:"");
    }catch(e){um(`<div class="note bad">${esc(errText(e))}</div>`)}
    btn.disabled=false;btn.textContent="إضافة موظف";};
  $("#cl_btn").onclick=()=>{const box=$("#cl_box");
    if(!S.online){box.innerHTML=`<span class="note warn small">الإقفال محتاج إنترنت.</span>`;return}
    box.innerHTML=`<span class="small">هيتم ترحيل ${S.live.length} حركة. متأكد؟</span><button class="btn sm pri" id="cl_yes">أيوه، اقفل</button><button class="btn sm" id="cl_no">لا</button>`;
    $("#cl_no").onclick=()=>render();
    $("#cl_yes").onclick=async()=>{const bal=balances();const clean=emptyBal();
      for(const b of BKEYS)for(const l of LOCS)for(const [k,v] of Object.entries(bal[b][l]))if(v)clean[b][l][k]=v;
      const ts=S.live.reduce((a,m)=>Math.max(a,m.ts||0),S.closing?.ts||0);
      try{await db.doc("config/closing").set({ts,date:today(),bal:clean,by:S.email});toast("اتقفلت الفترة ✓")}catch(e){toast("الإقفال ما نجحش: "+errText(e))}}};
}

/* ---------- utils ---------- */
function saveCsv(name,rows){
  const csv="﻿"+rows.map(r=>r.map(c=>{const s=String(c??"");return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s}).join(",")).join("\r\n");
  const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
  const a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);
}

/* ---------- login ---------- */
function renderLogin(msg){
  shell(false);
  $("#app").innerHTML=`<section class="panel login"><div class="brand big"><svg class="ingot" viewBox="0 0 34 22" aria-hidden="true"><path d="M7 2h20l6 18H1z" fill="var(--gold)"/><path d="M9 5h16l3 9H6z" fill="#F3D779" opacity=".55"/></svg><div><h2>خزائن الذهب</h2><span class="muted small">بوابة 2 · بوابة 4</span></div></div>
  <label>الإيميل<input id="lg_e" type="email" dir="ltr" autocomplete="username" value="${esc(store.get("gv.lastEmail")||"")}"></label>
  <label>كلمة السر<input id="lg_p" type="password" dir="ltr" autocomplete="current-password"></label>
  <div id="lg_msg">${msg?`<div class="note bad">${esc(msg)}</div>`:""}</div>
  <button class="btn gold" id="lg_go">دخول</button><button class="btn" id="lg_reset">نسيت كلمة السر</button>
  <details class="first"><summary>أول مرة تشغّل البرنامج؟</summary><p class="small">اكتب إيميلك وكلمة سر جديدة فوق (6 حروف/أرقام على الأقل) واضغط الزرار ده. أول حساب بيتعمل بيبقى هو المدير.</p><button class="btn pri" id="lg_first">إنشاء حساب المدير</button></details></section>`;
  const go=async()=>{const e=$("#lg_e").value.trim().toLowerCase(),p=$("#lg_p").value;if(!e||!p)return;
    $("#lg_go").disabled=true;$("#lg_go").textContent="جاري الدخول…";
    try{store.set("gv.lastEmail",e);await auth.signInWithEmailAndPassword(e,p)}
    catch(err){renderLogin(errText(err))}};
  $("#lg_first").onclick=()=>{const e=$("#lg_e").value.trim().toLowerCase(),p=$("#lg_p").value;if(!e||p.length<6){$("#lg_msg").innerHTML=`<div class="note warn">اكتب الإيميل وكلمة سر 6 حروف/أرقام على الأقل.</div>`;return}store.set("gv.lastEmail",e);firstRun(e,p)};
  $("#lg_go").onclick=go;$("#lg_p").onkeydown=ev=>{if(ev.key==="Enter")go()};
  $("#lg_reset").onclick=async()=>{const e=$("#lg_e").value.trim();if(!e){$("#lg_msg").innerHTML=`<div class="note warn">اكتب الإيميل الأول.</div>`;return}
    try{await auth.sendPasswordResetEmail(e);$("#lg_msg").innerHTML=`<div class="note info">بعتنالك رسالة على الإيميل لتغيير كلمة السر.</div>`}catch(err){$("#lg_msg").innerHTML=`<div class="note bad">${esc(errText(err))}</div>`}};
}
function firstRun(e,p){
  $("#app").innerHTML=`<section class="panel login"><h2>تجهيز البرنامج لأول مرة</h2><p>هنعمل حساب المدير بالإيميل <b dir="ltr">${esc(e)}</b> وكلمة السر اللي كتبتها، وهنضيف الثلاثين صنف وقطعة عرض في بترينة كل فرع.</p>
  <label>اسمك<input id="fr_n" placeholder="اسم المدير"></label><div id="fr_msg"></div><button class="btn gold" id="fr_go">إنشاء حساب المدير</button><button class="btn" id="fr_back">رجوع</button></section>`;
  $("#fr_back").onclick=()=>renderLogin();
  $("#fr_go").onclick=async()=>{const n=$("#fr_n").value.trim()||"المدير";$("#fr_go").disabled=true;
    try{S.firstName=n;await auth.createUserWithEmailAndPassword(e,p)}
    catch(err){
      if(String(err.code).includes("email-already-in-use")){try{await auth.signInWithEmailAndPassword(e,p);return}catch(e2){err=e2;if(String(e2.code).match(/invalid-credential|wrong-password/)){$("#fr_go").disabled=false;$("#fr_msg").innerHTML=`<div class="note bad">الإيميل ده عليه حساب بالفعل وكلمة السر مش مطابقة. اكتب كلمة السر الصح، أو ارجع واضغط «نسيت كلمة السر».</div>`;return}}}
      $("#fr_go").disabled=false;$("#fr_msg").innerHTML=`<div class="note bad">${esc(errText(err))}</div>`}};
}
async function bootstrapIfFirst(){
  /* Runs once after sign-in: if nobody is admin yet, this account becomes the admin and the catalog is seeded. */
  const ref=db.doc("config/admins");let snap;
  try{snap=await ref.get({source:"server"})}catch(e){return}
  if(snap.exists)return;
  await ref.set({emails:[S.email]});
  const list=[{email:S.email,name:S.firstName||"المدير"}];
  await db.doc("config/staff").set({list,emails:[S.email]});
  const items=DEFAULT_ITEMS.map(([name,weight],i)=>({id:"i"+String(i+1).padStart(2,"0"),name,weight,min:2}));
  await db.doc("config/items").set({items});
  const ts=Date.now();
  for(const [k,b] of BKEYS.entries())await db.collection("moves").doc("open-show-"+b).set({date:today(),ts:ts+k,branch:b,type:"open",lines:items.map(i=>({item:i.id,qty:1,loc:"show"})),note:"قطعة عرض من كل صنف (رصيد افتتاحي للبترينة)",emp:S.firstName||"المدير",by:S.email,void:false});
  toast("البرنامج جاهز – انت المدير ✓");
}

/* ---------- boot ---------- */
let subs=[];
function stopSubs(){subs.forEach(u=>u&&u());subs=[];unsubMoves?.();unsubMoves=null}
let unsubMoves=null,lastTs;
function subMoves(){
  unsubMoves?.();S.liveLoaded=false;
  let qy=db.collection("moves");if(S.closing?.ts)qy=qy.where("ts",">",S.closing.ts);
  unsubMoves=qy.onSnapshot({includeMetadataChanges:true},snap=>{
    S.live=snap.docs.map(d=>({id:d.id,...d.data(),_pending:d.metadata.hasPendingWrites})).sort((a,b)=>(b.ts||0)-(a.ts||0));
    S.pending=snap.metadata.hasPendingWrites;S.liveLoaded=true;rerender()},
    e=>{S.liveLoaded=true;if(String(e.code).includes("permission"))S.rolesLoaded=true;rerender()});
}
function startData(){
  stopSubs();lastTs=undefined;
  subs.push(db.doc("config/admins").onSnapshot(s=>{S.admins=(s.exists?s.data().emails:[])||[];S.rolesLoaded=true;rerender()},()=>{S.rolesLoaded=true;rerender()}));
  subs.push(db.doc("config/staff").onSnapshot(s=>{S.staff=(s.exists?s.data().list:[])||[];rerender()},()=>{}));
  subs.push(db.doc("config/items").onSnapshot(s=>{S.items=(s.exists?s.data().items:[])||[];S.itemsLoaded=true;if(S.route!=="items")S.itemsDraft=null;rerender()},()=>{S.itemsLoaded=true;rerender()}));
  subs.push(db.doc("config/closing").onSnapshot(s=>{S.closing=s.exists?s.data():null;S.closingLoaded=true;const ts=S.closing?.ts||0;if(ts!==lastTs){lastTs=ts;subMoves()}rerender()},()=>{S.closingLoaded=true;if(lastTs===undefined){lastTs=0;subMoves()}rerender()}));
}
function boot(){
  CFG=window.FIREBASE_CONFIG;
  if(!CFG||!CFG.apiKey||/ضع|PASTE|xxx/i.test(CFG.apiKey)){shell(false);$("#app").innerHTML=`<section class="panel"><h2>البرنامج محتاج يتربط بقاعدة البيانات</h2><p>افتح ملف <b>config.js</b> وحط فيه بيانات مشروع Firebase بتاعك (موجودة في «دليل التشغيل»)، وبعدين ارفع الملفات تاني.</p></section>`;return}
  if(!window.firebase){$("#app").innerHTML=`<div class="note bad">محتاج إنترنت لأول تشغيل للبرنامج.</div>`;return}
  firebase.initializeApp(CFG);auth=firebase.auth();db=firebase.firestore();
  db.enablePersistence({synchronizeTabs:true}).catch(()=>{});
  S.branch=store.get("gv.branch")||"b2";if(!["b2","b4","all"].includes(S.branch))S.branch="b2";
  readRoute();
  document.querySelectorAll("#branchSeg button").forEach(btn=>btn.onclick=()=>setBranch(btn.dataset.b));
  $("#logout").onclick=()=>{stopSubs();auth.signOut()};
  auth.onAuthStateChanged(async u=>{
    if(!u){S.email="";stopSubs();Object.assign(S,{rolesLoaded:false,itemsLoaded:false,closingLoaded:false,liveLoaded:false,admins:[],staff:[],items:[],live:[]});renderLogin();return}
    S.email=(u.email||"").toLowerCase();render();
    await bootstrapIfFirst().catch(e=>toast(errText(e)));
    startData();
  });
}
window.__gv={S,balances,deltas,status};
boot();
if("serviceWorker" in navigator&&location.protocol==="https:")navigator.serviceWorker.register("sw.js").catch(()=>{});
})();
