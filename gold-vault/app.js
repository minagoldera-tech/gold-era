/* خزائن الذهب – تطبيق مستقل يعمل على Firebase (Firestore + Authentication) */
(function(){
"use strict";
const BR={b2:"بوابة 2",b4:"بوابة 4"};
const BKEYS=["b2","b4"];
const LOC={main:"الخزنة الرئيسية",sub:"الخزنة الفرعية",show:"البترينة",res:"محجوز للأبلكيشن"};
const LOCS=["main","sub","show","res"];          // every place gold can sit
const VAULTS=["main","sub","show"];              // places a person picks for counts/opening/purchases
const LOCSHORT={main:"رئيسية",sub:"فرعية",show:"بترينة",res:"محجوز"};
/* Movement types. fx = effect on a place (+/-). sale: counts as sales (+1) or returns (-1).
   pay: money flows in (+1, customer pays) or out (-1, we pay). loc: the person picks the place. */
const T={
  open:{l:"رصيد افتتاحي",loc:1,g:"وارد",cat:"in"},
  in_main:{l:"وارد للخزنة الرئيسية",fx:[["main",1]],g:"وارد",cat:"in"},
  buy:{l:"شراء من عميل",loc:1,g:"بيع وشراء",pay:-1,cat:"buy"},
  main_sub:{l:"تحويل: رئيسية ← فرعية",fx:[["main",-1],["sub",1]],g:"تحويل داخلي"},
  sub_main:{l:"مرتجع: فرعية ← رئيسية",fx:[["sub",-1],["main",1]],g:"تحويل داخلي"},
  main_show:{l:"تحويل: رئيسية ← بترينة",fx:[["main",-1],["show",1]],g:"تحويل داخلي"},
  sub_show:{l:"تحويل: فرعية ← بترينة",fx:[["sub",-1],["show",1]],g:"تحويل داخلي"},
  show_sub:{l:"مرتجع: بترينة ← فرعية",fx:[["show",-1],["sub",1]],g:"تحويل داخلي"},
  sale_sub:{l:"بيع من الخزنة الفرعية",fx:[["sub",-1]],sale:1,pay:1,g:"بيع وشراء",cat:"sale"},
  sale_show:{l:"بيع من البترينة",fx:[["show",-1]],sale:1,pay:1,g:"بيع وشراء",cat:"sale"},
  sale_main:{l:"بيع من الخزنة الرئيسية",fx:[["main",-1]],sale:1,pay:1,g:"بيع وشراء",cat:"sale"},
  cust_ret:{l:"مرتجع من عميل (للفرعية)",fx:[["sub",1]],sale:-1,pay:-1,g:"بيع وشراء",cat:"sale"},
  app_res:{l:"حجز طلب أبلكيشن (من الفرعية)",fx:[["sub",-1],["res",1]],app:1,g:"الأبلكيشن"},
  app_res_m:{l:"حجز طلب أبلكيشن (من الرئيسية)",fx:[["main",-1],["res",1]],app:1,g:"الأبلكيشن"},
  app_del:{l:"تسليم طلب أبلكيشن",fx:[["res",-1]],sale:1,pay:1,app:1,g:"الأبلكيشن",cat:"sale"},
  app_cancel:{l:"إلغاء حجز أبلكيشن",fx:[["res",-1],["sub",1]],app:1,g:"الأبلكيشن"},
  branch:{l:"تحويل للفرع الآخر (رئيسية ← رئيسية)",fx:[["main",-1]],to:[["main",1]],g:"بين الفروع"},
  out_main:{l:"منصرف من الرئيسية (مورد / تصنيع)",fx:[["main",-1]],g:"أخرى",cat:"out"},
  adjust:{l:"تسوية جرد (+ / −)",loc:1,signed:1,g:"أخرى",cat:"adj"}
};
const DEFAULT_ITEMS=[["1 جرام",1],["2.5 جرام",2.5],["2.5 جرام (الله)",2.5],["5 جرام",5],["5 جرام (قل أعوذ)",5],["5 جرام (الله)",5],
["8 جرام (دام عزك ياوطن)",8],["10 جرام",10],["10 جرام (قل أعوذ)",10],["10 جرام (لبيك الله)",10],["10 جرام (أمي جنة)",10],
["10 جرام (دام عزك ياوطن)",10],["15.55 جرام",15.55],["15.55 جرام (قل أعوذ)",15.55],["15.55 جرام الصقر",15.55],
["15.55 جرام الاهرامات",15.55],["20 جرام",20],["20 جرام (الكعبة)",20],["25 جرام",25],["25 جرام (لبيك الله)",25],
["25 جرام (صقر)",25],["أونصة 31.10 جرام",31.10],["31.10 جرام (المسجد النبوي)",31.10],["50 جرام",50],["5 Tola",58.325],
["100 جرام",100],["10 Tola",116.65],["999.9 ك (كيلو)",1000],["500 جرام",500],["250 جرام",250]];
const KARATS=[["999.9","999.9 (24)"],["995","995"],["916","916 (22)"],["875","875 (21)"],["750","750 (18)"]];
const CASH_CATS={in:["رصيد افتتاحي","إيداع ابلكيشن","إيداع نقدية","أخرى"],out:["مصروفات عامة","مرتبات","فواتير","توريد لحساب الشركة / البنك","أخرى"]};

const S={items:[],itemsLoaded:false,closing:null,closingLoaded:false,live:[],liveLoaded:false,cash:[],cashLoaded:false,appMoves:[],
  admins:[],staff:[],rolesLoaded:false,branch:"b2",route:"home",email:"",pending:false,online:navigator.onLine,draft:null,logRange:null,
  countSel:{b:"b2",loc:"main",vals:{}},itemsDraft:null};
let auth=null,db=null,CFG=null;
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt=n=>(Math.round((Number(n)||0)*100)/100).toLocaleString("en-US",{maximumFractionDigits:2});
const sar=n=>fmt(n)+" ر.س";
const dstr=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const today=()=>dstr(new Date());
const monthStart=()=>today().slice(0,8)+"01";
const AR_DAYS=["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];
const AR_MONTHS=["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const parseD=iso=>{const [y,m,d]=String(iso||"").split("-").map(Number);return new Date(y,(m||1)-1,d||1)};
/* "الخميس 5 نوفمبر 2026" */
const fdate=iso=>{if(!iso)return "";const d=parseD(iso);if(isNaN(d))return iso;return `${AR_DAYS[d.getDay()]} ${d.getDate()} ${AR_MONTHS[d.getMonth()]} ${d.getFullYear()}`};
const fmonth=ym=>{const [y,m]=ym.split("-").map(Number);return `${AR_MONTHS[m-1]} ${y}`};
const ftime=ts=>{if(!ts)return "";const d=new Date(ts);let h=d.getHours();const ap=h<12?"ص":"م";h=h%12||12;return `${h}:${String(d.getMinutes()).padStart(2,"0")} ${ap}`};
const addDays=(iso,n)=>{const d=parseD(iso);d.setDate(d.getDate()+n);return dstr(d)};
const monthEnd=ym=>{const [y,m]=ym.split("-").map(Number);return dstr(new Date(y,m,0))};
const addMonths=(ym,n)=>{const [y,m]=ym.split("-").map(Number);const d=new Date(y,m-1+n,1);return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")};
const store={get(k){try{return localStorage.getItem(k)}catch(e){return null}},set(k,v){try{localStorage.setItem(k,v)}catch(e){}}};
const other=b=>b==="b2"?"b4":"b2";
function toast(m){const t=$("#toast");t.textContent=m;t.hidden=false;clearTimeout(toast.h);toast.h=setTimeout(()=>t.hidden=true,3200)}
const itemById=id=>S.items.find(i=>i.id===id);
const iname=id=>itemById(id)?.name||"صنف محذوف";
const isG=id=>itemById(id)?.unit==="g";                       // sold by weight (raw gold)
const iw=id=>{const it=itemById(id);if(!it)return 0;return it.unit==="g"?1:(Number(it.weight)||0)};
const ik=id=>Number(itemById(id)?.karat)||999.9;
const unitOf=id=>isG(id)?"جم":"قطعة";
const lineG=ln=>(Number(ln.qty)||0)*iw(ln.item);
const lineG24=ln=>lineG(ln)*(Number(ln.k)||ik(ln.item))/999.9;
const payTotal=p=>(Number(p?.cash)||0)+(Number(p?.bank)||0)+(Number(p?.card)||0);
const activeItems=()=>S.items.filter(i=>!i.off);
const isAdmin=()=>S.admins.includes(S.email);
const isMember=()=>isAdmin()||S.staff.some(s=>s.email===S.email);
const myName=()=>S.staff.find(s=>s.email===S.email)?.name||store.get("gv.emp")||S.email.split("@")[0];
const nameOf=email=>S.staff.find(s=>s.email===email)?.name||(email?email.split("@")[0]:"");
const errText=e=>{const c=e?.code||"";
  if(c.includes("permission-denied"))return "مش مسموح لحسابك بالعملية دي (أو قواعد الأمان في Firebase محتاجة تتحدّث).";
  if(c.includes("wrong-password")||c.includes("invalid-credential")||c.includes("user-not-found")||c.includes("invalid-login"))return "الإيميل أو كلمة السر غلط.";
  if(c.includes("too-many-requests"))return "محاولات كتير – استنى شوية وجرّب تاني.";
  if(c.includes("network")||c.includes("unavailable"))return "مفيش اتصال بالإنترنت.";
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
const q=(bal,b,l,id)=>bal[b]?.[l]?.[id]||0;
function status(bal,b,it){
  const m=q(bal,b,"main",it.id),s=q(bal,b,"sub",it.id),w=q(bal,b,"show",it.id),r=q(bal,b,"res",it.id);
  if(m<0||s<0||w<0||r<0)return{k:"bad",t:"رصيد بالسالب – راجع السجل",r:0};
  if(it.unit==="g")return m+s+w+r>0?{k:"ok",t:"متوفر",r:9}:{k:"ok",t:"مفيش",r:9};
  if(m+s+w===0)return{k:"bad",t:"نفد – اطلب توريد",r:1};
  if(s===0&&m===0)return{k:"bad",t:"المتاح قطعة البترينة فقط",r:2};
  if(s<(Number(it.min)||0))return{k:"warn",t:m>0?"تحت الحد – حوّل من الرئيسية":"تحت الحد – الرئيسية فاضية",r:3,act:m>0?"main_sub":null};
  if(w<1)return{k:"warn",t:"البترينة ناقصة قطعة العرض",r:4,act:s>0?"sub_show":(m>0?"main_show":null)};
  return{k:"ok",t:"متوفر",r:9};
}
/* cash in each branch's box: closing snapshot + cash entries + cash part of sales/purchases */
function cashEffects(list,b){let t=0;for(const c of list){if(c.void||c.branch!==b)continue;t+=(c.kind==="in"?1:-1)*(Number(c.amount)||0)}return t}
function moveCash(list,b){let t=0;for(const m of list){if(m.void||m.branch!==b)continue;const p=T[m.type]?.pay;if(p&&m.pay)t+=p*(Number(m.pay.cash)||0)}return t}
const cashBal=b=>(Number(S.closing?.cash?.[b])||0)+cashEffects(S.cash,b)+moveCash(S.live,b);
async function movesInRange(from,to){
  const cd=S.closing?.date;
  if(!cd||from>cd)return S.live.filter(m=>m.date>=from&&m.date<=to);
  const snap=await db.collection("moves").where("date",">=",from).where("date","<=",to).get();
  const map=new Map();snap.docs.forEach(d=>map.set(d.id,{id:d.id,...d.data()}));
  S.live.forEach(m=>{if(m.date>=from&&m.date<=to)map.set(m.id,m)});
  return [...map.values()].sort((a,b)=>b.ts-a.ts);
}
async function cashInRange(from,to){
  const cd=S.closing?.date;
  if(!cd||from>cd)return S.cash.filter(c=>c.date>=from&&c.date<=to);
  const snap=await db.collection("cash").where("date",">=",from).where("date","<=",to).get();
  const map=new Map();snap.docs.forEach(d=>map.set(d.id,{id:d.id,...d.data()}));
  S.cash.forEach(c=>{if(c.date>=from&&c.date<=to)map.set(c.id,c)});
  return [...map.values()].sort((a,b)=>b.ts-a.ts);
}

/* ---------- shell ---------- */
const ROUTES=["home","stock","new","app","cash","archive","month","log","count","items"];
function readRoute(){const h=location.hash.slice(1);S.route=ROUTES.includes(h)?h:"home"}
window.addEventListener("hashchange",()=>{readRoute();render();window.scrollTo(0,0)});
window.addEventListener("online",()=>{S.online=true;syncChip()});
window.addEventListener("offline",()=>{S.online=false;syncChip()});
const bsel=()=>S.branch==="all"?BKEYS:[S.branch];
function setBranch(b){S.branch=b;store.set("gv.branch",b);render()}
function syncChip(){const c=$("#sync");if(!c)return;
  if(!S.online){c.className="sync off";c.textContent="غير متصل – هيتزامن لما النت يرجع"}
  else if(S.pending){c.className="sync wait";c.textContent="جاري المزامنة…"}
  else{c.className="sync on";c.textContent="متزامن"}}
function shell(on){$("#bar").hidden=!on;}
const VIEWFN={home:[()=>vHome(),()=>bHome()],stock:[()=>vStock(),()=>bStock()],new:[()=>vNew(),()=>bNew()],app:[()=>vApp(),()=>bApp()],
  cash:[()=>vCash(),()=>bCash()],archive:[()=>vArchive(),()=>bArchive()],month:[()=>vMonth(),()=>bMonth()],log:[()=>vLog(),()=>bLog()],
  count:[()=>vCount(),()=>bCount()],items:[()=>vItems(),()=>bItems()]};
function render(){
  if(!S.email)return;
  shell(true);document.body.classList.remove("loginbg");
  document.querySelectorAll("#branchSeg button").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.b===S.branch)));
  document.querySelectorAll("#tabs a").forEach(a=>{if(a.getAttribute("href")==="#"+S.route)a.setAttribute("aria-current","page");else a.removeAttribute("aria-current")});
  $("#who").textContent=myName();syncChip();
  const app=$("#app");
  if(!(S.rolesLoaded&&S.itemsLoaded&&S.closingLoaded&&S.liveLoaded&&S.cashLoaded)){app.innerHTML=`<div class="empty">جاري تحميل بيانات الخزائن…</div>`;return}
  if(!isMember()){app.innerHTML=`<div class="note bad">الحساب <b>${esc(S.email)}</b> مش متضاف للبرنامج. اطلب من المدير يضيفك من «الإعدادات ← المستخدمين».</div><button class="btn" id="lo2">تسجيل خروج</button>`;$("#lo2").onclick=()=>auth.signOut();return}
  let html="";
  if(!S.items.length&&S.route!=="items")html+=`<div class="note info">لسه مفيش أصناف. ادخل على «الإعدادات» وضيف الأصناف.</div>`;
  const [v,b]=VIEWFN[S.route];app.innerHTML=html+v();b();
}
let rt=null;function rerender(){
  const a=document.activeElement;
  if(a&&a.matches&&a.matches("input,textarea,select")&&["new","count","items","cash","app"].includes(S.route)){clearTimeout(rt);rt=setTimeout(rerender,1500);return}
  render();
}

/* ---------- HOME ---------- */
function vHome(){
  const bal=balances();const t=today();
  const allZero=BKEYS.every(b=>VAULTS.every(l=>Object.values(bal[b][l]).every(v=>!v)));
  let h=`<div class="head"><h2>نظرة عامة</h2><span class="muted small">${fdate(t)}</span></div>`;
  if(allZero)h+=`<div class="note info"><b>ابدأ من هنا:</b> لو عندك بيانات الشيت القديم، ادخل «الإعدادات ← استيراد». أو سجّل الرصيد الافتتاحي من «حركة جديدة ← حركات تانية ← رصيد افتتاحي»، أو من «الجرد».</div>`;
  h+=`<div class="grid2">`;
  for(const b of bsel()){
    let pcs={},gr={};for(const l of LOCS){pcs[l]=0;gr[l]=0}let g24=0;
    for(const it of S.items)for(const l of LOCS){const v=q(bal,b,l,it.id);if(it.unit!=="g")pcs[l]+=v;gr[l]+=v*iw(it.id);g24+=v*iw(it.id)*ik(it.id)/999.9}
    const sales=S.live.filter(m=>!m.void&&m.branch===b&&m.date===t&&T[m.type]?.sale);
    let sg=0,money=0;sales.forEach(m=>{const s=T[m.type].sale;m.lines.forEach(ln=>{sg+=s*lineG(ln)});money+=s*payTotal(m.pay)});
    h+=`<section class="panel"><div class="head"><h3>فرع ${BR[b]}</h3><span class="chip gold">مبيعات اليوم: ${fmt(sg)} جم · ${sar(money)}</span></div>
    <div class="tiles">${VAULTS.map(l=>`<div class="tile"><span>${LOC[l]}</span><b>${fmt(gr[l])}</b><i>جم · ${fmt(pcs[l])} قطعة</i></div>`).join("")}</div>
    ${gr.res?`<p class="small muted">محجوز لطلبات الأبلكيشن: <b>${fmt(gr.res)} جم</b></p>`:""}
    <div class="branch-total"><span class="muted">إجمالي الفرع (عيار 24)</span><span><b>${fmt(g24)}</b> جم</span></div>
    <div class="branch-total"><span class="muted">الكاش في الخزينة</span><span><b>${sar(cashBal(b))}</b></span></div></section>`;
  }
  h+=`</div><div class="grid2"><section class="panel"><div class="head"><h3>تنبيهات المخزون</h3><a class="btn sm" href="#stock">كل الأصناف</a></div>`;
  const al=[];for(const b of bsel())for(const it of activeItems()){const s=status(bal,b,it);if(s.k!=="ok")al.push({b,it,s})}
  al.sort((a,b)=>a.s.r-b.s.r);
  h+=al.length?`<div class="alerts">${al.slice(0,40).map(a=>`<div class="alert ${a.s.k}"><div class="t"><b>${esc(a.it.name)}</b> <span class="muted small">· ${BR[a.b]}</span><div class="small">${a.s.t}</div></div>${a.s.act?`<button class="btn sm" data-fix="${a.b}|${a.s.act}|${a.it.id}">${a.s.act==="main_sub"?"حوّل للفرعية":"عوّض البترينة"}</button>`:""}</div>`).join("")}</div>`:`<div class="empty">كل الأصناف متوفرة – مفيش تنبيهات</div>`;
  h+=`</section><section class="panel"><div class="head"><h3>آخر الحركات</h3><a class="btn sm" href="#log">السجل كامل</a></div>`;
  const rec=S.live.filter(m=>bsel().includes(m.branch)||bsel().includes(m.to)).slice(0,6);
  h+=rec.length?`<div class="moves">${rec.map(moveCard).join("")}</div>`:`<div class="empty">لسه مفيش حركات. سجّل أول حركة من «حركة جديدة».</div>`;
  return h+`</section></div>`;
}
function bindFix(){document.querySelectorAll("[data-fix]").forEach(b=>b.onclick=()=>{const [br,type,item]=b.dataset.fix.split("|");
  S.draft={branch:br,type,lines:[{item,qty:1}]};location.hash="new"})}
function bHome(){bindFix();bindMoves()}

/* ---------- STOCK ---------- */
const SV=(()=>{let v={};try{v=JSON.parse(store.get("gv.sv")||"{}")}catch(e){}return Object.assign({view:"all",sort:"weight",mode:"cards",q:"",hideZero:false},v,{q:""})})();
const saveSV=()=>store.set("gv.sv",JSON.stringify({view:SV.view,sort:SV.sort,mode:SV.mode,hideZero:SV.hideZero}));
const VIEWS={all:{l:"الإجمالي – كل الأماكن",locs:LOCS},main:{l:"الخزن الرئيسية",locs:["main"]},sub:{l:"الخزن الفرعية",locs:["sub"]},show:{l:"البترينات",locs:["show"]},res:{l:"المحجوز للأبلكيشن",locs:["res"]}};
if(!VIEWS[SV.view])SV.view="all";
const SEV={bad:0,warn:1,ok:2};
function stockRows(bal){
  const bs=bsel();const locs=VIEWS[SV.view].locs;
  let rows=S.items.filter(it=>!SV.q||it.name.includes(SV.q)).map(it=>{
    const per=bs.map(b=>{const by={};let t=0;for(const l of LOCS){by[l]=q(bal,b,l,it.id)}for(const l of locs)t+=by[l];return{b,by,t,st:status(bal,b,it)}});
    const pcs=per.reduce((a,p)=>a+p.t,0);const worst=per.reduce((w,p)=>SEV[p.st.k]<SEV[w.k]?p.st:w,{k:"ok",t:"متوفر"});
    const g=pcs*iw(it.id);return{it,per,pcs,g,g24:g*ik(it.id)/999.9,worst}});
  if(SV.hideZero)rows=rows.filter(r=>r.pcs!==0);
  const by={weight:(a,b)=>iw(a.it.id)-iw(b.it.id),grams:(a,b)=>b.g-a.g,low:(a,b)=>a.pcs-b.pcs,alerts:(a,b)=>SEV[a.worst.k]-SEV[b.worst.k]||iw(a.it.id)-iw(b.it.id)}[SV.sort];
  return rows.sort(by);
}
function vaultLabel(){const b=S.branch,v=SV.view;
  if(b==="all")return v==="all"?"كل الخزن والبترينات – الفرعين":VIEWS[v].l+" – الفرعين";
  return (v==="all"?"كل الخزن والبترينة":LOC[v])+" – "+BR[b]}
function vaultOptions(){const cur=S.branch+"|"+SV.view;const o=(val,l)=>`<option value="${val}" ${val===cur?"selected":""}>${l}</option>`;
  return `<optgroup label="الفرعين">${o("all|all","كل الخزن والبترينات")}${o("all|main","الخزن الرئيسية")}${o("all|sub","الخزن الفرعية")}${o("all|show","البترينات")}${o("all|res","المحجوز للأبلكيشن")}</optgroup>`+
    BKEYS.map(b=>`<optgroup label="${BR[b]}">${o(b+"|all",BR[b]+" – كل الخزن")}${o(b+"|main",BR[b]+" – الخزنة الرئيسية")}${o(b+"|sub",BR[b]+" – الخزنة الفرعية")}${o(b+"|show",BR[b]+" – البترينة")}${o(b+"|res",BR[b]+" – المحجوز للأبلكيشن")}</optgroup>`).join("")}
function vStock(){
  const bal=balances();const bs=bsel();const rows=stockRows(bal);const view=VIEWS[SV.view];
  const sel=(id,opts,cur)=>`<select id="${id}">${opts.map(([v,l])=>`<option value="${v}" ${v===cur?"selected":""}>${l}</option>`).join("")}</select>`;
  let h=`<div class="head"><div><h2>المخزون</h2><div class="vault-title">${vaultLabel()}</div></div><button class="btn sm" id="exStock">تحميل Excel</button></div>
  <section class="toolbar">
    <label class="grow">الخزنة<select id="sv_vault">${vaultOptions()}</select></label>
    <label>الترتيب${sel("sv_sort",[["weight","حسب الوزن"],["grams","الأكثر جرامات"],["low","الأقل كمية"],["alerts","التنبيهات أولاً"]],SV.sort)}</label>
    <label class="grow">بحث<input id="sq" placeholder="اسم الصنف…" value="${esc(SV.q)}"></label>
    <label class="chk"><input type="checkbox" id="sv_hz" ${SV.hideZero?"checked":""}> إخفاء الأصناف الفاضية</label>
    <div class="seg2" role="group" aria-label="شكل العرض"><button data-mode="cards" aria-pressed="${SV.mode==="cards"}">كروت</button><button data-mode="table" aria-pressed="${SV.mode==="table"}">جدول</button></div>
  </section>`;
  let tp=0,tg=0,t24=0,nWarn=0,nOut=0;
  for(const it of S.items){const per=bs.map(b=>({st:status(bal,b,it),t:view.locs.reduce((a,l)=>a+q(bal,b,l,it.id),0)}));
    const p=per.reduce((a,x)=>a+x.t,0);if(it.unit!=="g")tp+=p;tg+=p*iw(it.id);t24+=p*iw(it.id)*ik(it.id)/999.9;
    if(it.off)continue;if(per.some(x=>x.st.k==="bad"))nOut++;else if(per.some(x=>x.st.k==="warn"))nWarn++;}
  h+=`<div class="kpis">
    <div class="kpi"><span>إجمالي الجرامات</span><b>${fmt(tg)}</b><i>${view.l}</i></div>
    <div class="kpi"><span>عيار 24</span><b>${fmt(t24)}</b><i>جرام صافي</i></div>
    <div class="kpi"><span>عدد القطع</span><b>${fmt(tp)}</b><i>${bs.length>1?"الفرعين":BR[bs[0]]}</i></div>
    <div class="kpi warn"><span>تحت الحد</span><b>${nWarn}</b><i>صنف</i></div>
    <div class="kpi bad"><span>نافد / ناقص</span><b>${nOut}</b><i>صنف</i></div></div>`;
  h+=`<section class="panel dist"><div class="head"><h3>توزيع الذهب (بالجرام)</h3><div class="legend">${LOCS.map(l=>`<span><i class="sw ${l}"></i>${LOC[l]}</span>`).join("")}</div></div>`;
  const gb={};let gmax=0;for(const b of bs){gb[b]={};let t=0;for(const l of LOCS){let g=0;for(const it of S.items)g+=q(bal,b,l,it.id)*iw(it.id);gb[b][l]=Math.max(0,g);t+=gb[b][l]}gb[b].t=t;gmax=Math.max(gmax,t)}
  for(const b of bs){const t=gb[b].t||0;
    h+=`<div class="distrow"><span class="dn">${BR[b]}</span><div class="track">${LOCS.map(l=>{const w=gmax?gb[b][l]/gmax*100:0;return w>0?`<div class="seg-bar ${l} ${view.locs.length===1&&!view.locs.includes(l)?"dim":""}" style="width:${w}%" title="${LOC[l]}: ${fmt(gb[b][l])} جم"></div>`:""}).join("")}</div><span class="dv">${fmt(t)} جم</span></div>
    <div class="distnums">${LOCS.map(l=>`<span>${LOCSHORT[l]}: <b>${fmt(gb[b][l])}</b></span>`).join("")}</div>`}
  h+=`</section>`;
  if(!rows.length)return h+`<div class="empty">مفيش أصناف مطابقة</div>`;
  if(SV.mode==="cards"){
    const gm=Math.max(1,...rows.map(r=>r.g));
    h+=`<div class="cards">`;
    for(const r of rows){const g=r.it.unit==="g";
      h+=`<article class="card sev-${r.worst.k}${r.it.off?" off":""}">
      <div class="ch"><h4>${esc(r.it.name)}</h4><span class="wt">${g?"بالوزن":fmt(r.it.weight)+" جم"}</span></div>
      <div class="big"><b>${fmt(r.pcs)}</b><span>${g?"جرام":"قطعة"}</span><em>${fmt(r.g)} جم</em></div>
      <div class="mbar"><div style="width:${Math.max(0,r.g/gm*100)}%"></div></div>
      ${r.per.map(p=>`<div class="br">${bs.length>1?`<span class="bn">${BR[p.b]}</span>`:""}<div class="pills">${LOCS.filter(l=>l!=="res"||p.by.res).map(l=>`<span class="pill ${view.locs.length<4&&view.locs.includes(l)?"on":""} ${p.by[l]<0?"neg":p.by[l]===0?"z":""}">${LOCSHORT[l]} <b>${fmt(p.by[l])}</b></span>`).join("")}</div></div>`).join("")}
      ${(()=>{const w=r.per.filter(p=>p.st.k!=="ok").sort((x,y)=>x.st.r-y.st.r)[0];if(!w)return `<div class="cst"><span class="chip ok">${r.pcs>0||!g?"متوفر":"مفيش"}</span></div>`;
        return `<div class="cst"><span class="chip ${w.st.k}">${bs.length>1?BR[w.b]+": ":""}${w.st.t}</span>${w.st.act?`<button class="btn xs" data-fix="${w.b}|${w.st.act}|${r.it.id}">${w.st.act==="main_sub"?"حوّل للفرعية":"عوّض البترينة"}</button>`:""}</div>`})()}
      </article>`}
    h+=`</div>`;
  }else{
    const det=SV.view==="all";
    h+=`<div class="tbl-wrap"><table><thead><tr><th class="name">الصنف</th><th>الوزن</th>`;
    for(const b of bs)h+=det?`<th>${BR[b]} رئيسية</th><th>${BR[b]} فرعية</th><th>${BR[b]} بترينة</th><th>${BR[b]} محجوز</th>`:`<th>${BR[b]}</th>`;
    h+=`<th>العدد</th><th>الجرام</th><th>عيار 24</th><th>الحالة</th></tr></thead><tbody>`;
    const tot={};let ap=0,ag=0,a24=0;
    for(const r of rows){h+=`<tr><td class="name">${esc(r.it.name)}</td><td>${r.it.unit==="g"?"بالوزن":fmt(r.it.weight)}</td>`;
      for(const p of r.per){if(det)for(const l of LOCS){const v=p.by[l];tot[p.b+l]=(tot[p.b+l]||0)+v;h+=`<td class="${v<0?"neg":v===0?"zero":""}">${fmt(v)}</td>`}
        else{tot[p.b]=(tot[p.b]||0)+p.t;h+=`<td class="${p.t<0?"neg":p.t===0?"zero":""}">${fmt(p.t)}</td>`}}
      if(r.it.unit!=="g")ap+=r.pcs;ag+=r.g;a24+=r.g24;h+=`<td><b>${fmt(r.pcs)}</b></td><td>${fmt(r.g)}</td><td>${fmt(r.g24)}</td><td><span class="chip ${r.worst.k}">${r.worst.t}</span></td></tr>`}
    h+=`<tr class="tot"><td class="name">الإجمالي</td><td></td>`;for(const b of bs)h+=det?LOCS.map(l=>`<td>${fmt(tot[b+l]||0)}</td>`).join(""):`<td>${fmt(tot[b]||0)}</td>`;
    h+=`<td>${fmt(ap)}</td><td>${fmt(ag)}</td><td>${fmt(a24)}</td><td></td></tr></tbody></table></div>`;
  }
  return h;
}
function bStock(){
  $("#sv_vault").onchange=e=>{const [b,v]=e.target.value.split("|");SV.view=v;saveSV();setBranch(b)};
  $("#sv_hz").onchange=e=>{SV.hideZero=e.target.checked;saveSV();render()};
  $("#sv_sort").onchange=e=>{SV.sort=e.target.value;saveSV();render()};
  document.querySelectorAll("[data-mode]").forEach(b=>b.onclick=()=>{SV.mode=b.dataset.mode;saveSV();render()});
  const sq=$("#sq");sq.oninput=()=>{SV.q=sq.value.trim();const pos=sq.selectionStart;render();const n=$("#sq");n.focus();n.setSelectionRange(pos,pos)};
  bindFix();
  $("#exStock").onclick=()=>{const bal=balances();const rows=[["الصنف","الوزن (جم)","العيار",...BKEYS.flatMap(b=>LOCS.map(l=>`${BR[b]} - ${LOC[l]}`)),"الإجمالي","إجمالي الجرام","عيار 24"]];
    for(const it of S.items){let p=0;const r=[it.name,it.unit==="g"?"بالوزن":it.weight,ik(it.id)];for(const b of BKEYS)for(const l of LOCS){const v=q(bal,b,l,it.id);p+=v;r.push(v)}
      const g=p*iw(it.id);r.push(p,Math.round(g*100)/100,Math.round(g*ik(it.id)/999.9*100)/100);rows.push(r)}
    saveCsv(`مخزون_${today()}.csv`,rows)};
}

/* ---------- NEW MOVE ---------- */
const QUICK=[
  ["sale_sub","بيع","من الخزنة الفرعية","M4 7h16l-1.5 11h-13z M9 7a3 3 0 0 1 6 0"],
  ["main_sub","تحويل للفرعية","رئيسية ← فرعية","M5 12h14 M13 6l6 6-6 6"],
  ["sub_show","تعويض البترينة","فرعية ← بترينة","M4 5h16v11H4z M8 20h8"],
  ["in_main","وارد","للخزنة الرئيسية","M12 4v12 M6 10l6 6 6-6 M4 20h16"],
  ["buy","شراء","من عميل","M12 20V8 M6 14l6-6 6 6 M4 4h16"],
  ["sale_show","بيع من البترينة","لما الصنف يخلص","M4 5h16v11H4z M9 10h6"],
  ["app_res","حجز أبلكيشن","طلب عميل","M7 3h10v18l-5-4-5 4z"],
  ["cust_ret","مرتجع عميل","يرجع للفرعية","M9 7L4 12l5 5 M4 12h11a5 5 0 0 1 0 10"],
  ["branch","للفرع التاني","رئيسية ← رئيسية","M4 8h13 M13 4l4 4-4 4 M20 16H7 M11 12l-4 4 4 4"]
];
const QSET=new Set(QUICK.map(x=>x[0]));
function freshDraft(){return{branch:S.branch==="all"?"b2":S.branch,type:"sale_sub",loc:"main",date:today(),note:"",emp:myName(),lines:[],pick:{item:"",qty:1},
  inv:"",cash:"",bank:"",card:"",order:"",cust:""}}
function srcLoc(d){const t=T[d.type];if(t.loc)return d.type==="adjust"?d.loc:null;const neg=t.fx.find(f=>f[1]<0);return neg?neg[0]:null}
function flowText(d){const t=T[d.type];
  if(d.type==="open")return `هيتضاف العدد لرصيد ${LOC[d.loc]} في ${BR[d.branch]}.`;
  if(d.type==="buy")return `الدهب اللي اشتريته هيدخل ${LOC[d.loc]} في ${BR[d.branch]}، والفلوس اللي دفعتها كاش هتتخصم من الخزينة.`;
  if(t.loc)return `اكتب الفرق: موجب لو الجرد الفعلي أزيد، وسالب لو أقل – بيتعدل رصيد ${LOC[d.loc]}.`;
  const parts=t.fx.map(([l,s])=>`${s<0?"يخصم من":"يضيف إلى"} ${LOC[l]}`);
  if(t.to)parts.push(`يضيف إلى الخزنة الرئيسية في ${BR[other(d.branch)]}`);
  return parts.join(" ← ")+(t.sale?(t.sale>0?" · ويتحسب مبيعات":" · ويتخصم من المبيعات"):"")+(t.pay?(t.pay>0?" · والكاش يدخل الخزينة":" · والكاش يخرج من الخزينة"):"");
}
function itemGroups(){const g=[["سبائك صغيرة (حتى 8 جم)",i=>i.unit!=="g"&&i.weight<10],["10 – 31.10 جم",i=>i.unit!=="g"&&i.weight>=10&&i.weight<50],["50 – 116 جم",i=>i.unit!=="g"&&i.weight>=50&&i.weight<250],["سبائك كبيرة (250 جم فأكثر)",i=>i.unit!=="g"&&i.weight>=250],["بالوزن",i=>i.unit==="g"]];
  return g.map(([l,f])=>[l,activeItems().filter(f).sort((a,b)=>a.weight-b.weight)]).filter(x=>x[1].length)}
function vNew(){
  if(!S.draft)S.draft=freshDraft();const d=Object.assign(freshDraft(),S.draft);S.draft=d;
  if(T[d.type].loc&&!VAULTS.includes(d.loc))d.loc="main";
  d.lines=(d.lines||[]).filter(l=>l.item).map(l=>({...l,qty:l.qty===""?(isG(l.item)?"":1):l.qty}));
  const t=T[d.type];const bal=balances();const src=srcLoc(d);const avl=id=>src?q(bal,d.branch,src,id):(t.loc?q(bal,d.branch,d.loc,id):null);
  let step=1;
  let h=`<div class="head"><h2>حركة جديدة</h2><div class="seg2" role="group" aria-label="الفرع">${BKEYS.map(b=>`<button data-br="${b}" aria-pressed="${d.branch===b}">${BR[b]}</button>`).join("")}</div></div>
  <section class="panel"><h3 class="step"><span>${step++}</span>نوع الحركة</h3><div class="qa">`;
  for(const [k,l,sub,path] of QUICK)h+=`<button data-qt="${k}" aria-pressed="${d.type===k}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg><b>${l}</b><small>${sub}</small></button>`;
  h+=`</div><label>حركات تانية<select id="f_more"><option value="">— اختار —</option>${Object.entries(T).filter(([k])=>!QSET.has(k)).map(([k,v])=>`<option value="${k}" ${d.type===k?"selected":""}>${v.l}</option>`).join("")}</select></label>`;
  if(t.loc)h+=`<div class="seg2 wide" role="group" aria-label="المكان">${VAULTS.map(l=>`<button data-loc="${l}" aria-pressed="${d.loc===l}">${LOC[l]}</button>`).join("")}</div>`;
  if(t.app)h+=`<div class="form"><label>رقم الطلب / رقم العميل <b class="req">*</b><input id="f_order" value="${esc(d.order)}" placeholder="مثلاً 114333" inputmode="numeric"></label><label>اسم العميل<input id="f_cust" value="${esc(d.cust)}" placeholder="اختياري"></label></div>`;
  h+=`<div class="flow">${flowText(d)}</div></section>
  <section class="panel"><h3 class="step"><span>${step++}</span>الأصناف</h3>
  <div class="picker"><label class="grow">الصنف<select id="p_item"><option value="">اختار الصنف من القائمة…</option>${itemGroups().map(([g,its])=>`<optgroup label="${g}">${its.map(it=>{const a=avl(it.id);return `<option value="${it.id}" ${d.pick.item===it.id?"selected":""}>${esc(it.name)}${a!==null?` — ${src?"متاح":"رصيد"} ${fmt(a)}${it.unit==="g"?" جم":""}`:""}</option>`}).join("")}</optgroup>`).join("")}</select></label>
  <label>العدد / الوزن<div class="stepper"><button data-ps="-1" aria-label="أقل">−</button><input id="p_qty" type="number" inputmode="decimal" step="any" value="${esc(d.pick.qty)}"><button data-ps="1" aria-label="أكتر">+</button></div></label>
  <button class="btn pri add" id="p_add">إضافة</button></div>
  ${t.loc?`<button class="btn sm" id="allLines">إضافة كل الأصناف مرة واحدة</button>`:""}<div id="p_err"></div>`;
  if(!d.lines.length)h+=`<div class="empty small">اختار الصنف من القائمة، حدد العدد، واضغط «إضافة». تقدر تضيف أكتر من صنف في نفس الحركة.</div>`;
  else{h+=`<div class="cart">`;d.lines.forEach((ln,i)=>{const a=avl(ln.item);const over=src&&a!==null&&Number(ln.qty)>a;const g=isG(ln.item);
    h+=`<div class="ci ${over?"over":""}"><div class="cn"><b>${esc(iname(ln.item))}</b><small>${fmt(lineG(ln))} جم${g?` · عيار 24: ${fmt(lineG24(ln))} جم`:""}${a!==null?` · ${src?"المتاح":"الرصيد"} ${fmt(a)}`:""}${over?" · الكمية أكبر من المتاح":""}</small></div>
    ${g?`<select class="karat" data-lk="${i}" aria-label="العيار">${KARATS.map(([v,l])=>`<option value="${v}" ${String(ln.k||ik(ln.item))===v?"selected":""}>${l}</option>`).join("")}</select>`:""}
    <div class="stepper sm"><button data-ls="${i}|-1" aria-label="أقل">−</button><input type="number" inputmode="decimal" step="any" data-lq="${i}" value="${esc(ln.qty)}"><button data-ls="${i}|1" aria-label="أكتر">+</button></div>
    <button class="btn xs danger" data-rm="${i}" aria-label="حذف">✕</button></div>`});h+=`</div>`}
  h+=`</section>`;
  if(t.pay){const pt=(Number(d.cash)||0)+(Number(d.bank)||0)+(Number(d.card)||0);
    h+=`<section class="panel"><h3 class="step"><span>${step++}</span>${t.pay>0?"الفلوس اللي دفعها العميل":"الفلوس اللي اتدفعت للعميل"}</h3>
    <div class="form pay"><label>رقم الإذن / الفاتورة<input id="f_inv" value="${esc(d.inv)}" inputmode="numeric"></label>
    <label>كاش (ر.س)<input type="number" inputmode="decimal" step="any" min="0" id="f_cash" value="${esc(d.cash)}"></label>
    <label>بنك / تحويل (ر.س)<input type="number" inputmode="decimal" step="any" min="0" id="f_bank" value="${esc(d.bank)}"></label>
    <label>شبكة (ر.س)<input type="number" inputmode="decimal" step="any" min="0" id="f_card" value="${esc(d.card)}"></label></div>
    <div class="paytot">الإجمالي: <b id="f_ptot">${sar(pt)}</b></div></section>`}
  h+=`<section class="panel"><details class="more" ${d.note||d.date!==today()?"open":""}><summary>تفاصيل إضافية (التاريخ، الموظف، ملاحظات)</summary><div class="form">
  <label>التاريخ<input type="date" id="f_date" value="${d.date}"></label><label>اسم الموظف<input id="f_emp" value="${esc(d.emp)}"></label>
  <label style="grid-column:1/-1">ملاحظات<input id="f_note" value="${esc(d.note)}" placeholder="اختياري"></label></div></details></section>`;
  let gr=0,pcs=0;d.lines.forEach(ln=>{gr+=lineG(ln);if(!isG(ln.item))pcs+=Number(ln.qty)||0});
  h+=`<div id="f_err"></div><div class="savebar"><div><span class="muted small">${T[d.type].l} · ${BR[d.branch]}</span><div id="f_tot"><b>${fmt(gr)}</b> جم · ${fmt(pcs)} قطعة</div></div><div class="row"><button class="btn" id="reset">تفريغ</button><button class="btn gold" id="save">حفظ الحركة</button></div></div>`;
  return h;
}
function bNew(){
  const d=S.draft;
  const val=id=>{const e=$("#"+id);return e?e.value:undefined};
  const keep=()=>{const f=$("#f_date");if(f){d.date=f.value;d.note=$("#f_note").value;d.emp=$("#f_emp").value}
    for(const [k,id] of [["inv","f_inv"],["cash","f_cash"],["bank","f_bank"],["card","f_card"],["order","f_order"],["cust","f_cust"]]){const v=val(id);if(v!==undefined)d[k]=v}
    const pq=$("#p_qty");if(pq)d.pick.qty=pq.value};
  const tot=()=>{let gr=0,pcs=0;d.lines.forEach(ln=>{gr+=lineG(ln);if(!isG(ln.item))pcs+=Number(ln.qty)||0});$("#f_tot").innerHTML=`<b>${fmt(gr)}</b> جم · ${fmt(pcs)} قطعة`};
  document.querySelectorAll("[data-br]").forEach(b=>b.onclick=()=>{keep();d.branch=b.dataset.br;render()});
  document.querySelectorAll("[data-qt]").forEach(b=>b.onclick=()=>{keep();d.type=b.dataset.qt;render()});
  $("#f_more").onchange=e=>{if(!e.target.value)return;keep();d.type=e.target.value;render()};
  document.querySelectorAll("[data-loc]").forEach(b=>b.onclick=()=>{keep();d.loc=b.dataset.loc;render()});
  ["f_date","f_note","f_emp","f_inv","f_order","f_cust"].forEach(id=>{const e=$("#"+id);if(e)e.oninput=keep});
  ["f_cash","f_bank","f_card"].forEach(id=>{const e=$("#"+id);if(e)e.oninput=()=>{keep();$("#f_ptot").textContent=sar((Number(d.cash)||0)+(Number(d.bank)||0)+(Number(d.card)||0))}});
  $("#p_item").onchange=e=>{keep();d.pick.item=e.target.value;if(isG(d.pick.item)){d.pick.qty="";$("#p_qty").value="";$("#p_qty").placeholder="الوزن بالجرام";$("#p_qty").focus()}};
  $("#p_qty").oninput=e=>{d.pick.qty=e.target.value};
  document.querySelectorAll("[data-ps]").forEach(b=>b.onclick=()=>{const inp=$("#p_qty");let v=Math.round(((parseFloat(inp.value)||0)+Number(b.dataset.ps))*1000)/1000;if(!T[d.type].signed&&v<1)v=1;inp.value=v;d.pick.qty=v});
  const add=()=>{keep();const id=$("#p_item").value;const n=parseFloat($("#p_qty").value);const pe=$("#p_err");
    if(!id){pe.innerHTML=`<div class="note warn small">اختار الصنف الأول.</div>`;$("#p_item").focus();return}
    const okN=Number.isFinite(n)&&n!==0&&(T[d.type].signed||n>0)&&(isG(id)||Number.isInteger(n));
    if(!okN){pe.innerHTML=`<div class="note warn small">${isG(id)?"اكتب الوزن بالجرام.":"اكتب عدد صحيح."}</div>`;return}
    const ex=d.lines.find(l=>l.item===id&&!isG(id));if(ex)ex.qty=(Number(ex.qty)||0)+n;else d.lines.push({item:id,qty:n,...(isG(id)?{k:ik(id)}:{})});
    d.pick={item:"",qty:1};render();$("#p_item")?.focus()};
  $("#p_add").onclick=add;$("#p_qty").onkeydown=e=>{if(e.key==="Enter")add()};
  document.querySelectorAll("[data-ls]").forEach(b=>b.onclick=()=>{keep();const [i,s]=b.dataset.ls.split("|");const ln=d.lines[+i];let v=Math.round(((Number(ln.qty)||0)+Number(s))*1000)/1000;
    if(!T[d.type].signed&&v<=0){d.lines.splice(+i,1)}else ln.qty=v;render()});
  document.querySelectorAll("[data-lq]").forEach(s=>s.oninput=()=>{d.lines[+s.dataset.lq].qty=s.value;tot()});
  document.querySelectorAll("[data-lk]").forEach(s=>s.onchange=()=>{keep();d.lines[+s.dataset.lk].k=Number(s.value);render()});
  document.querySelectorAll("[data-rm]").forEach(b=>b.onclick=()=>{keep();d.lines.splice(+b.dataset.rm,1);render()});
  $("#allLines")&&($("#allLines").onclick=()=>{keep();const have=new Set(d.lines.map(l=>l.item));d.lines=d.lines.concat(activeItems().filter(i=>!have.has(i.id)).map(i=>({item:i.id,qty:""})));render()});
  $("#reset").onclick=()=>{const b=d.branch,t=d.type;S.draft=Object.assign(freshDraft(),{branch:b,type:t});render()};
  $("#save").onclick=()=>{keep();saveMove()};
}
function writeDoc(col,data,okMsg){
  /* With offline persistence the write lands in the local cache immediately and syncs later; errors arrive async. */
  db.collection(col).doc().set(data).catch(e=>toast("ما اتحفظش: "+errText(e)));
  if(okMsg)toast(S.online?okMsg:okMsg+" (هتتزامن لما النت يرجع)");
}
function buildMove(d){
  /* returns {m} or {err} */
  const t=T[d.type];const seen=new Map();
  for(const ln of d.lines){if(ln.qty===""||ln.qty===undefined)continue;
    const n=Number(ln.qty);
    if(!Number.isFinite(n)||(!t.signed&&n<0)||(!isG(ln.item)&&!Number.isInteger(n)))return{err:`اكتب ${isG(ln.item)?"وزن صحيح":"عدد صحيح"} للصنف «${iname(ln.item)}».`};
    if(n===0)continue;const key=ln.item+"|"+(isG(ln.item)?(ln.k||ik(ln.item)):"");
    const cur=seen.get(key)||{item:ln.item,qty:0,...(isG(ln.item)?{k:Number(ln.k)||ik(ln.item)}:{})};cur.qty=Math.round((cur.qty+n)*1000)/1000;seen.set(key,cur)}
  const lines=[...seen.values()].filter(l=>l.qty).map(l=>t.loc?{...l,loc:d.loc}:l);
  if(!lines.length)return{err:"ضيف صنف واحد على الأقل."};
  if(!d.date)return{err:"اختار التاريخ."};
  if(t.app&&!String(d.order||"").trim())return{err:"اكتب رقم الطلب / رقم العميل."};
  const m={date:d.date,ts:Date.now(),branch:d.branch,type:d.type,lines,note:String(d.note||"").trim(),emp:String(d.emp||"").trim(),by:S.email,void:false};
  if(t.to)m.to=other(d.branch);
  if(t.app){m.app=true;m.order=String(d.order).trim();if(String(d.cust||"").trim())m.cust=String(d.cust).trim()}
  if(t.pay){const p={};for(const k of ["cash","bank","card"]){const v=Number(d[k]);if(v<0||!Number.isFinite(v))return{err:"المبالغ لازم تكون أرقام موجبة."};if(v)p[k]=v}
    if(Object.keys(p).length)m.pay=p;if(String(d.inv||"").trim())m.inv=String(d.inv).trim()}
  const after=balances(m);const bad=[];
  for(const x of deltas(m)){const v=q(after,x.b,x.loc,x.item);if(v<0)bad.push(`«${iname(x.item)}» في ${LOC[x.loc]} (${BR[x.b]}) هيبقى ${fmt(v)}`)}
  if(bad.length)return{err:"الرصيد مش كفاية: "+[...new Set(bad)].join("، ")+". راجع العدد أو سجّل وارد/تحويل الأول."};
  return{m};
}
function saveMove(){
  const d=S.draft;const err=$("#f_err");
  if(!d.lines.length&&$("#p_item").value){$("#p_add").click();if(!S.draft.lines.length)return}
  const r=buildMove(S.draft);
  if(r.err){err.innerHTML=`<div class="note bad">${esc(r.err)}</div>`;err.scrollIntoView({block:"center"});return}
  if(d.emp)store.set("gv.emp",d.emp);
  writeDoc("moves",r.m,"اتسجلت الحركة ✓");
  S.draft=Object.assign(freshDraft(),{branch:d.branch,type:d.type,loc:d.loc,date:d.date,emp:d.emp});
  render();window.scrollTo(0,0);
}

/* ---------- MOVE CARD (shared) ---------- */
function lineSummary(m){return m.lines.map(ln=>`${esc(iname(ln.item))} × ${ln.qty>0&&T[m.type]?.signed?"+":""}${fmt(ln.qty)}${isG(ln.item)?" جم"+(ln.k&&ln.k!=999.9?" عيار "+ln.k:""):""}`).join("، ")}
function moveCard(m){
  const t=T[m.type]||{l:m.type};const g=m.lines.reduce((s,ln)=>s+Math.abs(lineG(ln)),0);
  const cls=t.sale>0?"ok":t.sale<0?"warn":m.type==="adjust"?"bad":m.type==="branch"?"gold":t.app?"gold":m.type==="buy"?"warn":"plain";
  const canVoid=isAdmin()&&!m.void&&!(S.closing&&m.ts<=S.closing.ts);
  const who=m.emp||nameOf(m.by);
  const pt=payTotal(m.pay);
  return `<div class="move ${m.void?"void":""}"><div class="mh"><span class="chip ${cls}">${t.l}</span><b>${BR[m.branch]||""}</b>${m.to?`<span class="muted">← ${BR[m.to]}</span>`:""}${t.loc&&m.lines[0]?.loc?`<span class="muted small">${LOC[m.lines[0].loc]}</span>`:""}${m.inv?`<span class="chip plain">إذن ${esc(m.inv)}</span>`:""}${m.order?`<span class="chip plain">طلب ${esc(m.order)}</span>`:""}<span class="muted small" style="margin-inline-start:auto">${fdate(m.date)} · ${ftime(m.ts)}${who?" · "+esc(who):""}</span>${m.void?'<span class="chip bad">ملغاة</span>':""}${m._pending?'<span class="chip warn">لسه ما اتزامنتش</span>':""}</div>
  <div class="ml">${lineSummary(m)} <span class="muted small">(${fmt(g)} جم)</span></div>
  ${pt?`<div class="paychips">${m.pay.cash?`<span>كاش <b>${fmt(m.pay.cash)}</b></span>`:""}${m.pay.bank?`<span>بنك <b>${fmt(m.pay.bank)}</b></span>`:""}${m.pay.card?`<span>شبكة <b>${fmt(m.pay.card)}</b></span>`:""}<span class="pt">الإجمالي <b>${sar(pt)}</b></span></div>`:""}
  ${m.note||m.cust?`<div class="muted small">${esc([m.cust,m.note].filter(Boolean).join(" · "))}</div>`:""}
  ${canVoid?`<div class="confirm" data-vbox="${m.id}"><button class="btn sm danger" data-void="${m.id}">إلغاء الحركة</button></div>`:""}</div>`;
}
function bindMoves(){
  document.querySelectorAll("[data-void]").forEach(b=>b.onclick=()=>{const id=b.dataset.void;const box=document.querySelector(`[data-vbox="${id}"]`);
    box.innerHTML=`<span>متأكد؟ الحركة هتتلغي وأثرها على الرصيد والكاش هيتشال.</span><button class="btn sm danger" data-yes>أيوه، ألغيها</button><button class="btn sm" data-no>لا</button>`;
    box.querySelector("[data-no]").onclick=()=>render();
    box.querySelector("[data-yes]").onclick=()=>{
      const m=S.live.find(x=>x.id===id);
      if(m){const bal=emptyBal();const cb=S.closing?.bal;if(cb)for(const b of BKEYS)for(const l of LOCS)Object.assign(bal[b][l],cb[b]?.[l]||{});
        for(const x of S.live){if(x.void||x.id===id)continue;for(const d of deltas(x))bal[d.b][d.loc][d.item]=(bal[d.b][d.loc][d.item]||0)+d.d}
        const bad=deltas(m).filter(d=>q(bal,d.b,d.loc,d.item)<0);
        if(bad.length){box.innerHTML=`<span class="note bad small">مينفعش تتلغي: «${esc(iname(bad[0].item))}» في ${LOC[bad[0].loc]} هيبقى بالسالب لأنه اتصرف بعدها. ألغِ الحركات اللي بعدها الأول أو اعمل تسوية جرد.</span>`;return}}
      db.collection("moves").doc(id).update({void:true,voidBy:S.email}).catch(e=>toast("الإلغاء ما نجحش: "+errText(e)));toast("اتلغت الحركة")};});
}

/* ---------- APP ORDERS ---------- */
function orders(){
  const map=new Map();
  for(const m of S.appMoves){if(m.void||!m.order)continue;const key=m.branch+"|"+m.order;
    let o=map.get(key);if(!o){o={key,branch:m.branch,order:m.order,cust:"",date:m.date,lines:{},moves:[],delivered:0,cancelled:0};map.set(key,o)}
    if(m.cust)o.cust=m.cust;o.moves.push(m);if(m.date<o.date)o.date=m.date;
    const s=m.type==="app_res"||m.type==="app_res_m"?1:-1;
    if(m.type==="app_del")o.delivered=1;if(m.type==="app_cancel")o.cancelled=1;
    for(const ln of m.lines)o.lines[ln.item]=(o.lines[ln.item]||0)+s*(Number(ln.qty)||0);}
  for(const o of map.values()){o.open=Object.values(o.lines).some(v=>v>0);o.last=o.moves.reduce((a,m)=>Math.max(a,m.ts||0),0)}
  return [...map.values()].sort((a,b)=>b.last-a.last);
}
let appOpenAct=null;
function vApp(){
  const os=orders().filter(o=>bsel().includes(o.branch));const open=os.filter(o=>o.open),done=os.filter(o=>!o.open).slice(0,30);
  let h=`<div class="head"><h2>طلبات الأبلكيشن</h2><button class="btn gold" id="ap_new">+ حجز طلب جديد</button></div>
  <div class="kpis"><div class="kpi"><span>طلبات محجوزة</span><b>${open.length}</b><i>مستنية تسليم</i></div>
  <div class="kpi"><span>جرامات محجوزة</span><b>${fmt(open.reduce((a,o)=>a+Object.entries(o.lines).reduce((s,[id,v])=>s+Math.max(0,v)*iw(id),0),0))}</b><i>جم</i></div></div>
  <section class="panel"><h3>محجوز – مستني التسليم</h3>`;
  if(!open.length)h+=`<div class="empty">مفيش طلبات محجوزة. اضغط «حجز طلب جديد» لما عميل يطلب من الأبلكيشن.</div>`;
  for(const o of open){const ls=Object.entries(o.lines).filter(([,v])=>v>0);
    h+=`<div class="order"><div class="mh"><span class="chip gold">طلب ${esc(o.order)}</span><b>${BR[o.branch]}</b>${o.cust?`<span>${esc(o.cust)}</span>`:""}<span class="muted small" style="margin-inline-start:auto">من ${fdate(o.date)}</span></div>
    <div class="ml">${ls.map(([id,v])=>`${esc(iname(id))} × ${fmt(v)}`).join("، ")} <span class="muted small">(${fmt(ls.reduce((a,[id,v])=>a+v*iw(id),0))} جم)</span></div>
    <div class="row" data-obox="${esc(o.key)}">${appOpenAct===o.key+"|del"?`<div class="form pay" style="flex:1"><label>رقم الإذن<input id="od_inv"></label><label>كاش<input type="number" step="any" min="0" id="od_cash"></label><label>بنك<input type="number" step="any" min="0" id="od_bank"></label><label>شبكة<input type="number" step="any" min="0" id="od_card"></label></div><button class="btn gold" data-odel="${esc(o.key)}">تأكيد التسليم</button><button class="btn" data-ocl>رجوع</button>`
      :appOpenAct===o.key+"|can"?`<span class="small">إلغاء الحجز يرجّع الأصناف للخزنة الفرعية. متأكد؟</span><button class="btn danger" data-ocan="${esc(o.key)}">أيوه، الغي الحجز</button><button class="btn" data-ocl>لا</button>`
      :`<button class="btn gold sm" data-oa="${esc(o.key)}|del">تم التسليم</button><button class="btn sm" data-oa="${esc(o.key)}|can">إلغاء الحجز</button>`}</div></div>`}
  h+=`</section><section class="panel"><h3>آخر الطلبات المقفولة</h3>`;
  h+=done.length?done.map(o=>`<div class="order done"><div class="mh"><span class="chip ${o.cancelled&&!o.delivered?"bad":"ok"}">${o.cancelled&&!o.delivered?"اتلغى":"اتسلّم"}</span><b>طلب ${esc(o.order)}</b><span>${BR[o.branch]}</span>${o.cust?`<span>${esc(o.cust)}</span>`:""}<span class="muted small" style="margin-inline-start:auto">${fdate(o.moves.reduce((a,m)=>m.date>a?m.date:a,o.date))}</span></div></div>`).join(""):`<div class="empty small">لسه مفيش.</div>`;
  h+=`</section><p class="muted small">إيداعات الأبلكيشن (الفلوس اللي العميل بيدفعها مقدم) بتتسجل من «الخزينة» ← إيداع ← «إيداع ابلكيشن».</p>`;
  return h;
}
function bApp(){
  $("#ap_new").onclick=()=>{S.draft=Object.assign(freshDraft(),{type:"app_res"});location.hash="new"};
  document.querySelectorAll("[data-oa]").forEach(b=>b.onclick=()=>{const v=b.dataset.oa;const i=v.lastIndexOf("|");appOpenAct=v.slice(0,i)+"|"+v.slice(i+1);render()});
  document.querySelectorAll("[data-ocl]").forEach(b=>b.onclick=()=>{appOpenAct=null;render()});
  const act=(key,type)=>{const o=orders().find(x=>x.key===key);if(!o)return;
    const lines=Object.entries(o.lines).filter(([,v])=>v>0).map(([item,qty])=>({item,qty}));
    const d={branch:o.branch,type,lines,date:today(),order:o.order,cust:o.cust,emp:myName(),note:""};
    if(type==="app_del"){d.inv=$("#od_inv").value;d.cash=$("#od_cash").value;d.bank=$("#od_bank").value;d.card=$("#od_card").value}
    const r=buildMove(d);if(r.err){toast(r.err);return}
    writeDoc("moves",r.m,type==="app_del"?"اتسجل التسليم ✓":"اتلغى الحجز");appOpenAct=null;render()};
  document.querySelectorAll("[data-odel]").forEach(b=>b.onclick=()=>act(b.dataset.odel,"app_del"));
  document.querySelectorAll("[data-ocan]").forEach(b=>b.onclick=()=>act(b.dataset.ocan,"app_cancel"));
}

/* ---------- CASH BOX ---------- */
const CS={kind:"out",month:null,draft:{cat:"",desc:"",amount:"",date:null,branch:null}};
function vCash(){
  if(!CS.month)CS.month=today().slice(0,7);const d=CS.draft;if(!d.date)d.date=today();if(!d.branch)d.branch=S.branch==="all"?"b2":S.branch;
  const cats=CASH_CATS[CS.kind];if(!cats.includes(d.cat))d.cat=cats[0];
  let h=`<div class="head"><h2>الخزينة (الكاش)</h2><button class="btn sm" id="exCash">تحميل Excel</button></div><div class="kpis">`;
  for(const b of bsel())h+=`<div class="kpi"><span>رصيد الكاش – ${BR[b]}</span><b>${fmt(cashBal(b))}</b><i>ريال سعودي</i></div>`;
  h+=`</div><section class="panel"><h3>تسجيل إيداع أو سحب</h3>
  <div class="row"><div class="seg2" role="group" aria-label="النوع"><button data-ck="in" aria-pressed="${CS.kind==="in"}">إيداع (داخل)</button><button data-ck="out" aria-pressed="${CS.kind==="out"}">سحب / مصروف (خارج)</button></div>
  <div class="seg2" role="group" aria-label="الفرع">${BKEYS.map(b=>`<button data-cb="${b}" aria-pressed="${d.branch===b}">${BR[b]}</button>`).join("")}</div></div>
  <div class="form"><label>البند<select id="c_cat">${cats.map(c=>`<option ${c===d.cat?"selected":""}>${c}</option>`).join("")}</select></label>
  <label>المبلغ (ر.س)<input type="number" inputmode="decimal" step="any" min="0" id="c_amt" value="${esc(d.amount)}"></label>
  <label>التاريخ<input type="date" id="c_date" value="${d.date}"></label>
  <label style="grid-column:1/-1">البيان<input id="c_desc" value="${esc(d.desc)}" placeholder="${CS.kind==="in"?"مثلاً: ايداع ابلكيشن عميل رقم (113808)":"مثلاً: راتب بيشوي ايمن"}"></label></div>
  <div id="c_err"></div><div class="row"><button class="btn gold" id="c_save">حفظ</button></div></section>
  <section class="daynav"><button class="btn" id="cm_prev">‹ الشهر اللي قبله</button><div class="dayc"><b>${fmonth(CS.month)}</b></div><button class="btn" id="cm_next" ${CS.month>=today().slice(0,7)?"disabled":""}>الشهر اللي بعده ›</button></section>
  <div id="cashBody"><div class="empty">جاري التحميل…</div></div>`;
  return h;
}
let cashRows=[];
function bCash(){
  const d=CS.draft;const keep=()=>{d.cat=$("#c_cat").value;d.amount=$("#c_amt").value;d.date=$("#c_date").value;d.desc=$("#c_desc").value};
  document.querySelectorAll("[data-ck]").forEach(b=>b.onclick=()=>{keep();CS.kind=b.dataset.ck;render()});
  document.querySelectorAll("[data-cb]").forEach(b=>b.onclick=()=>{keep();d.branch=b.dataset.cb;render()});
  ["c_cat","c_amt","c_date","c_desc"].forEach(id=>$("#"+id).oninput=keep);
  $("#c_save").onclick=()=>{keep();const a=Number(d.amount);const e=$("#c_err");
    if(!(a>0))return e.innerHTML=`<div class="note bad">اكتب المبلغ.</div>`;
    if(!d.date)return e.innerHTML=`<div class="note bad">اختار التاريخ.</div>`;
    writeDoc("cash",{date:d.date,ts:Date.now(),branch:d.branch,kind:CS.kind,cat:d.cat,desc:d.desc.trim(),amount:a,by:S.email,emp:myName(),void:false},CS.kind==="in"?"اتسجل الإيداع ✓":"اتسجل السحب ✓");
    CS.draft={cat:d.cat,desc:"",amount:"",date:d.date,branch:d.branch};render()};
  $("#cm_prev").onclick=()=>{CS.month=addMonths(CS.month,-1);render()};
  $("#cm_next").onclick=()=>{CS.month=addMonths(CS.month,1);render()};
  (async()=>{const box=$("#cashBody");const from=CS.month+"-01",to=monthEnd(CS.month);let list,mv;
    try{[list,mv]=await Promise.all([cashInRange(from,to),movesInRange(from,to)])}catch(e){box.innerHTML=`<div class="note bad">ما قدرناش نجيب الشهر ده (محتاج إنترنت).</div>`;return}
    if(!$("#cashBody"))return;
    const bs=bsel();list=list.filter(c=>bs.includes(c.branch));mv=mv.filter(m=>!m.void&&bs.includes(m.branch)&&T[m.type]?.pay&&m.pay);
    let tin=0,tout=0;for(const c of list){if(c.void)continue;if(c.kind==="in")tin+=c.amount;else tout+=c.amount}
    let sc=0,sb=0,sk=0,bc=0;for(const m of mv){const p=T[m.type].pay;if(p>0){sc+=m.pay.cash||0;sb+=m.pay.bank||0;sk+=m.pay.card||0}else bc+=m.pay.cash||0}
    let h=`<div class="kpis"><div class="kpi"><span>إيداعات الشهر</span><b>${fmt(tin)}</b><i>ر.س</i></div><div class="kpi bad"><span>سحب ومصروفات الشهر</span><b>${fmt(tout)}</b><i>ر.س</i></div>
      <div class="kpi"><span>مبيعات كاش</span><b>${fmt(sc)}</b><i>بنك ${fmt(sb)} · شبكة ${fmt(sk)}</i></div><div class="kpi warn"><span>كاش خارج (شراء/مرتجع)</span><b>${fmt(bc)}</b><i>ر.س</i></div></div>`;
    cashRows=[["التاريخ","الفرع","النوع","البند","البيان","المبلغ","الموظف","الحالة"]];
    h+=`<section class="panel"><h3>الإيداعات والسحوبات – ${fmonth(CS.month)}</h3>`;
    if(!list.length)h+=`<div class="empty">مفيش إيداعات أو سحوبات في الشهر ده.</div>`;
    else{h+=`<div class="tbl-wrap"><table><thead><tr><th>التاريخ</th><th>الفرع</th><th>النوع</th><th class="name">البند</th><th class="name">البيان</th><th>المبلغ</th><th>الموظف</th><th></th></tr></thead><tbody>`;
      for(const c of list.sort((a,b)=>a.date<b.date?1:a.date>b.date?-1:b.ts-a.ts)){const can=isAdmin()&&!c.void&&!(S.closing&&c.ts<=S.closing.ts);
        h+=`<tr class="${c.void?"voidrow":""}"><td>${fdate(c.date)}</td><td>${BR[c.branch]}</td><td><span class="chip ${c.kind==="in"?"ok":"bad"}">${c.kind==="in"?"إيداع":"سحب"}</span></td><td class="name">${esc(c.cat)}</td><td class="name">${esc(c.desc)}</td><td><b>${fmt(c.amount)}</b></td><td>${esc(c.emp||nameOf(c.by))}</td><td>${c.void?'<span class="chip bad">ملغي</span>':can?`<button class="btn xs danger" data-cv="${c.id}">إلغاء</button>`:""}</td></tr>`;
        cashRows.push([fdate(c.date),BR[c.branch],c.kind==="in"?"إيداع":"سحب",c.cat,c.desc,c.amount,c.emp||nameOf(c.by),c.void?"ملغي":""])}
      h+=`</tbody></table></div>`}
    box.innerHTML=h+`</section>`;
    document.querySelectorAll("[data-cv]").forEach(b=>b.onclick=()=>{if(b.dataset.sure){db.collection("cash").doc(b.dataset.cv).update({void:true,voidBy:S.email}).then(()=>{toast("اتلغى");render()}).catch(e=>toast(errText(e)))}else{b.dataset.sure=1;b.textContent="متأكد؟"}});
  })();
  $("#exCash").onclick=()=>saveCsv(`الخزينة_${CS.month}.csv`,cashRows);
}

/* ---------- DAILY ARCHIVE ---------- */
const AR={day:null,kind:"sales"};
function vArchive(){
  if(!AR.day)AR.day=today();
  return `<div class="head"><h2>الأرشيف اليومي</h2><button class="btn sm" id="exAr">تحميل Excel</button></div>
  <section class="daynav">
    <button class="btn" id="ar_prev">‹ اليوم اللي قبله</button>
    <div class="dayc"><b>${fdate(AR.day)}</b><input type="date" id="ar_day" value="${AR.day}" aria-label="اختار اليوم"></div>
    <button class="btn" id="ar_next" ${AR.day>=today()?"disabled":""}>اليوم اللي بعده ›</button>
  </section>
  <div class="row"><div class="seg2" role="group" aria-label="نوع العرض"><button data-ak="sales" aria-pressed="${AR.kind==="sales"}">المبيعات</button><button data-ak="all" aria-pressed="${AR.kind==="all"}">كل الحركات</button></div>
  ${AR.day!==today()?`<button class="btn sm" id="ar_today">النهارده</button>`:""}</div>
  <div id="arBody"><div class="empty">جاري التحميل…</div></div>`;
}
let arRows=[];
function bArchive(){
  const go=d=>{AR.day=d>today()?today():d;render()};
  $("#ar_prev").onclick=()=>go(addDays(AR.day,-1));
  $("#ar_next").onclick=()=>go(addDays(AR.day,1));
  $("#ar_day").onchange=e=>{if(e.target.value)go(e.target.value)};
  $("#ar_today")&&($("#ar_today").onclick=()=>go(today()));
  document.querySelectorAll("[data-ak]").forEach(b=>b.onclick=()=>{AR.kind=b.dataset.ak;render()});
  (async()=>{const box=$("#arBody");let list,cash;
    try{[list,cash]=await Promise.all([movesInRange(AR.day,AR.day),cashInRange(AR.day,AR.day)]);list=list.filter(m=>bsel().includes(m.branch)||bsel().includes(m.to));cash=cash.filter(c=>bsel().includes(c.branch)&&!c.void)}
    catch(e){box.innerHTML=`<div class="note bad">ما قدرناش نجيب اليوم ده (محتاج إنترنت).</div>`;return}
    if(!$("#arBody"))return;
    const sales=list.filter(m=>!m.void&&T[m.type]?.sale);const bs=bsel();
    let h=`<div class="kpis">`;
    for(const b of bs){let g=0,money=0;sales.filter(m=>m.branch===b).forEach(m=>{const s=T[m.type].sale;m.lines.forEach(ln=>{g+=s*lineG(ln)});money+=s*payTotal(m.pay)});
      h+=`<div class="kpi"><span>مبيعات ${BR[b]}</span><b>${fmt(g)}</b><i>جرام · ${sar(money)}</i></div>`}
    let pc=0,pb=0,pk=0;sales.forEach(m=>{const s=T[m.type].pay||0;pc+=s*(m.pay?.cash||0);pb+=s*(m.pay?.bank||0);pk+=s*(m.pay?.card||0)});
    h+=`<div class="kpi"><span>كاش</span><b>${fmt(pc)}</b><i>ر.س</i></div><div class="kpi"><span>بنك</span><b>${fmt(pb)}</b><i>ر.س</i></div><div class="kpi"><span>شبكة</span><b>${fmt(pk)}</b><i>ر.س</i></div>
      <div class="kpi"><span>عدد الفواتير</span><b>${sales.length}</b><i>عملية بيع</i></div></div>`;
    const sum={};for(const m of sales)for(const ln of m.lines){const k=ln.item;sum[k]=sum[k]||{p:0,b:{}};const v=T[m.type].sale*ln.qty;sum[k].p+=v;sum[k].b[m.branch]=(sum[k].b[m.branch]||0)+v}
    const items=Object.keys(sum).sort((a,b)=>iw(a)-iw(b));
    arRows=[["التاريخ","الوقت","الفرع","الحركة","رقم الإذن","الصنف","العدد","الوزن (جم)","كاش","بنك","شبكة","الموظف","ملاحظات","الحالة"]];
    if(AR.kind==="sales"){
      h+=`<section class="panel"><h3>اتباع إيه</h3>`;
      if(!items.length)h+=`<div class="empty">مفيش مبيعات متسجلة يوم ${fdate(AR.day)}.</div>`;
      else{h+=`<div class="tbl-wrap"><table><thead><tr><th class="name">الصنف</th>${bs.map(b=>`<th>${BR[b]}</th>`).join("")}<th>الإجمالي</th><th>الجرام</th></tr></thead><tbody>`;
        let tg=0;for(const k of items){const r=sum[k];tg+=r.p*iw(k);h+=`<tr><td class="name">${esc(iname(k))}</td>${bs.map(b=>`<td>${fmt(r.b[b]||0)}</td>`).join("")}<td><b>${fmt(r.p)}</b></td><td>${fmt(r.p*iw(k))}</td></tr>`}
        h+=`<tr class="tot"><td class="name">الإجمالي</td>${bs.map(()=>"<td></td>").join("")}<td></td><td>${fmt(tg)}</td></tr></tbody></table></div>`}
      h+=`</section>`;
    }
    const shown=AR.kind==="sales"?list.filter(m=>T[m.type]?.sale):list;
    h+=`<section class="panel"><h3>${AR.kind==="sales"?"الفواتير بالتفصيل":"كل حركات اليوم"} <span class="muted small">(${shown.length})</span></h3>`;
    h+=shown.length?`<div class="moves">${shown.map(moveCard).join("")}</div>`:`<div class="empty">مفيش حركات.</div>`;
    h+=`</section>`;
    if(cash.length)h+=`<section class="panel"><h3>الخزينة في اليوم ده</h3>${cash.map(c=>`<div class="alert"><span class="chip ${c.kind==="in"?"ok":"bad"}">${c.kind==="in"?"إيداع":"سحب"}</span><div class="t">${esc(c.cat)} – ${esc(c.desc)} <span class="muted small">· ${BR[c.branch]}</span></div><b>${sar(c.amount)}</b></div>`).join("")}</section>`;
    for(const m of shown)m.lines.forEach((ln,i)=>arRows.push([fdate(m.date),ftime(m.ts),BR[m.branch],T[m.type]?.l||m.type,m.inv||"",iname(ln.item),ln.qty,Math.round(lineG(ln)*100)/100,i?"":(m.pay?.cash||""),i?"":(m.pay?.bank||""),i?"":(m.pay?.card||""),m.emp||nameOf(m.by),m.note||"",m.void?"ملغاة":""]));
    box.innerHTML=h;bindMoves();
  })();
  $("#exAr").onclick=()=>saveCsv(`أرشيف_${AR.day}.csv`,arRows);
}

/* ---------- MONTHLY SUMMARY (like the old «رصيد» + «استوك» sheets) ---------- */
const MS={month:null};let monthRows=[];
function vMonth(){
  if(!MS.month)MS.month=today().slice(0,7);
  return `<div class="head"><h2>الملخص الشهري</h2><button class="btn sm" id="exMon">تحميل Excel</button></div>
  <section class="daynav"><button class="btn" id="ms_prev">‹ الشهر اللي قبله</button><div class="dayc"><b>${fmonth(MS.month)}</b><span class="muted small">${bsel().length>1?"الفرعين":BR[bsel()[0]]}</span></div><button class="btn" id="ms_next" ${MS.month>=today().slice(0,7)?"disabled":""}>الشهر اللي بعده ›</button></section>
  <div id="monBody"><div class="empty">جاري الحساب…</div></div>`;
}
function bMonth(){
  $("#ms_prev").onclick=()=>{MS.month=addMonths(MS.month,-1);render()};
  $("#ms_next").onclick=()=>{MS.month=addMonths(MS.month,1);render()};
  $("#exMon").onclick=()=>saveCsv(`ملخص_${MS.month}.csv`,monthRows);
  (async()=>{const box=$("#monBody");const from=MS.month+"-01",to=monthEnd(MS.month),t=today();const bs=bsel();
    let inM,after,cIn,cAfter;
    try{[inM,after,cIn,cAfter]=await Promise.all([movesInRange(from,to),to<t?movesInRange(addDays(to,1),t):[],cashInRange(from,to),to<t?cashInRange(addDays(to,1),t):[]])}
    catch(e){box.innerHTML=`<div class="note bad">ما قدرناش نجيب الشهر ده (محتاج إنترنت).</div>`;return}
    if(!$("#monBody"))return;
    inM=inM.filter(m=>!m.void);after=after.filter(m=>!m.void);
    // gold per item: end = current − after; start = end − all deltas in month
    const cur=balances();const end={},start={},col={};const C=["in","buy","out","sale","adj"];
    for(const it of S.items){let e=0;for(const b of bs)for(const l of LOCS)e+=q(cur,b,l,it.id);end[it.id]=e;col[it.id]={in:0,buy:0,out:0,sale:0,adj:0}}
    for(const m of after)for(const x of deltas(m))if(bs.includes(x.b)&&end[x.item]!==undefined)end[x.item]-=x.d;
    for(const it of S.items)start[it.id]=end[it.id];
    for(const m of inM){const t2=T[m.type];if(!t2)continue;
      for(const x of deltas(m)){if(!bs.includes(x.b)||start[x.item]===undefined)continue;start[x.item]-=x.d;
        let c=t2.cat;if(m.type==="branch"){if(bs.includes(m.branch)&&bs.includes(m.to))continue;c=x.d>0?"in":"out"}
        if(!c)continue;const v=c==="sale"||c==="out"?-x.d:x.d;col[x.item][c]+=v}}
    const g24=(id,n)=>n*iw(id)*ik(id)/999.9;
    let S24={start:0,end:0};const T24={in:0,buy:0,out:0,sale:0,adj:0};
    for(const it of S.items){S24.start+=g24(it.id,start[it.id]);S24.end+=g24(it.id,end[it.id]);for(const c of C)T24[c]+=g24(it.id,col[it.id][c])}
    // money
    let pc=0,pb=0,pk=0,buyCash=0,retCash=0;for(const m of inM){if(!bs.includes(m.branch)||!m.pay)continue;const p=T[m.type]?.pay;if(p>0){pc+=m.pay.cash||0;pb+=m.pay.bank||0;pk+=m.pay.card||0}else if(p<0){if(m.type==="buy")buyCash+=m.pay.cash||0;else retCash+=m.pay.cash||0}}
    const byCat={in:{},out:{}};let cin=0,cout=0;for(const c of cIn){if(c.void||!bs.includes(c.branch))continue;byCat[c.kind][c.cat]=(byCat[c.kind][c.cat]||0)+c.amount;if(c.kind==="in")cin+=c.amount;else cout+=c.amount}
    let cashEnd=0;for(const b of bs)cashEnd+=cashBal(b)-cashEffects(cAfter,b)-moveCash(after,b);
    const cashStart=cashEnd-(pc-buyCash-retCash+cin-cout);
    let h=`<div class="grid2"><section class="panel"><h3>رصيد الدهب (عيار 24 – جرام)</h3><div class="sumtbl">
      <div><span>رصيد أول الشهر</span><b>${fmt(S24.start)}</b></div><div><span>الوارد</span><b class="pos">+ ${fmt(T24.in)}</b></div><div><span>شراء من عملاء</span><b class="pos">+ ${fmt(T24.buy)}</b></div>
      <div><span>المنصرف</span><b class="neg">− ${fmt(T24.out)}</b></div><div><span>المبيعات</span><b class="neg">− ${fmt(T24.sale)}</b></div>${T24.adj?`<div><span>تسويات جرد</span><b>${T24.adj>0?"+ ":"− "}${fmt(Math.abs(T24.adj))}</b></div>`:""}
      <div class="end"><span>رصيد آخر الشهر</span><b>${fmt(S24.end)}</b></div></div></section>
      <section class="panel"><h3>الكاش (ريال)</h3><div class="sumtbl">
      <div><span>رصيد أول الشهر</span><b>${fmt(cashStart)}</b></div><div><span>مبيعات كاش</span><b class="pos">+ ${fmt(pc)}</b></div>
      ${Object.entries(byCat.in).map(([k,v])=>`<div><span>${esc(k)}</span><b class="pos">+ ${fmt(v)}</b></div>`).join("")}
      ${buyCash?`<div><span>شراء كاش</span><b class="neg">− ${fmt(buyCash)}</b></div>`:""}${retCash?`<div><span>مرتجعات كاش</span><b class="neg">− ${fmt(retCash)}</b></div>`:""}
      ${Object.entries(byCat.out).map(([k,v])=>`<div><span>${esc(k)}</span><b class="neg">− ${fmt(v)}</b></div>`).join("")}
      <div class="end"><span>رصيد آخر الشهر</span><b>${fmt(cashEnd)}</b></div></div>
      <p class="muted small">المبيعات بالبنك ${fmt(pb)} وبالشبكة ${fmt(pk)} – إجمالي مبيعات الشهر <b>${sar(pc+pb+pk)}</b> (البنك والشبكة مش بيدخلوا الكاش).</p></section></div>`;
    h+=`<section class="panel"><h3>الاستوك – ${fmonth(MS.month)}</h3><div class="tbl-wrap"><table><thead><tr><th class="name">الصنف</th><th>العيار</th><th>الوزن</th><th>أول الشهر</th><th>الوارد</th><th>شراء</th><th>منصرف</th><th>بيع</th>${Object.values(col).some(c=>c.adj)?"<th>تسوية</th>":""}<th>المتبقي</th><th>عيار 24</th></tr></thead><tbody>`;
    const hasAdj=Object.values(col).some(c=>c.adj);
    monthRows=[["الصنف","العيار","الوزن","أول الشهر","الوارد","شراء","منصرف","بيع","تسوية","المتبقي","عيار 24"]];
    const tt={start:0,in:0,buy:0,out:0,sale:0,adj:0,end:0};
    for(const it of [...S.items].sort((a,b)=>iw(a.id)-iw(b.id))){const c=col[it.id];if(!start[it.id]&&!end[it.id]&&!C.some(k=>c[k]))continue;
      h+=`<tr><td class="name">${esc(it.name)}</td><td>${ik(it.id)}</td><td>${it.unit==="g"?"بالوزن":fmt(it.weight)}</td><td>${fmt(start[it.id])}</td><td>${fmt(c.in)}</td><td>${fmt(c.buy)}</td><td>${fmt(c.out)}</td><td>${fmt(c.sale)}</td>${hasAdj?`<td>${fmt(c.adj)}</td>`:""}<td><b>${fmt(end[it.id])}</b></td><td>${fmt(g24(it.id,end[it.id]))}</td></tr>`;
      if(it.unit!=="g"){tt.start+=start[it.id];tt.in+=c.in;tt.buy+=c.buy;tt.out+=c.out;tt.sale+=c.sale;tt.adj+=c.adj;tt.end+=end[it.id]}
      monthRows.push([it.name,ik(it.id),it.unit==="g"?"بالوزن":it.weight,start[it.id],c.in,c.buy,c.out,c.sale,c.adj,end[it.id],Math.round(g24(it.id,end[it.id])*100)/100])}
    h+=`<tr class="tot"><td class="name">الإجمالي (قطع)</td><td></td><td></td><td>${fmt(tt.start)}</td><td>${fmt(tt.in)}</td><td>${fmt(tt.buy)}</td><td>${fmt(tt.out)}</td><td>${fmt(tt.sale)}</td>${hasAdj?`<td>${fmt(tt.adj)}</td>`:""}<td>${fmt(tt.end)}</td><td>${fmt(S24.end)}</td></tr></tbody></table></div></section>`;
    monthRows.push([],["رصيد الدهب عيار 24 أول الشهر",S24.start],["الوارد",T24.in],["شراء",T24.buy],["المنصرف",T24.out],["المبيعات",T24.sale],["رصيد آخر الشهر",S24.end],[],
      ["الكاش أول الشهر",cashStart],["مبيعات كاش",pc],["مبيعات بنك",pb],["مبيعات شبكة",pk],["إيداعات",cin],["سحب ومصروفات",cout],["شراء كاش",buyCash],["مرتجعات كاش",retCash],["الكاش آخر الشهر",cashEnd]);
    box.innerHTML=h;
  })();
}

/* ---------- LOG ---------- */
let logF={type:"",item:""};
function vLog(){
  if(!S.logRange)S.logRange={from:monthStart(),to:today()};
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
  $("#exLog").onclick=async()=>{const list=await filteredLog();const rows=[["التاريخ","الوقت","الفرع","نوع الحركة","رقم الإذن","رقم الطلب","الفرع المستلم","المكان","الصنف","العدد","الوزن (جم)","كاش","بنك","شبكة","الموظف","ملاحظات","الحالة"]];
    for(const m of list)m.lines.forEach((ln,i)=>rows.push([fdate(m.date),ftime(m.ts),BR[m.branch],T[m.type]?.l||m.type,m.inv||"",m.order||"",m.to?BR[m.to]:"",ln.loc?LOC[ln.loc]:"",iname(ln.item),ln.qty,Math.round(lineG(ln)*100)/100,i?"":(m.pay?.cash||""),i?"":(m.pay?.bank||""),i?"":(m.pay?.card||""),m.emp||nameOf(m.by),m.note||"",m.void?"ملغاة":""]));
    saveCsv(`سجل_الحركات_${S.logRange.from}_${S.logRange.to}.csv`,rows)};
}

/* ---------- COUNT ---------- */
function vCount(){
  const c=S.countSel;if(S.branch!=="all")c.b=S.branch;const bal=balances();
  let h=`<div class="head"><h2>الجرد الفعلي</h2><span class="muted small">اكتب العدد اللي لقيته فعلاً – الفرق بيتسجل «تسوية جرد» لوحده</span></div>
  <section class="panel"><div class="form"><label>الفرع<select id="c_b">${BKEYS.map(b=>`<option value="${b}" ${c.b===b?"selected":""}>${BR[b]}</option>`).join("")}</select></label>
  <label>المكان<select id="c_loc">${VAULTS.map(l=>`<option value="${l}" ${c.loc===l?"selected":""}>${LOC[l]}</option>`).join("")}</select></label></div>
  <div class="tbl-wrap"><table><thead><tr><th class="name">الصنف</th><th>رصيد السيستم</th><th>العدد الفعلي</th><th>الفرق</th></tr></thead><tbody>`;
  let diffs=0;
  for(const it of activeItems()){const sys=q(bal,c.b,c.loc,it.id);const v=c.vals[it.id];const has=v!==undefined&&v!=="";const df=has?Number(v)-sys:0;if(has&&df)diffs++;
    h+=`<tr><td class="name">${esc(it.name)}${it.unit==="g"?' <span class="muted small">(جم)</span>':""}</td><td>${fmt(sys)}</td><td style="width:120px"><input type="number" inputmode="decimal" min="0" step="${it.unit==="g"?"any":"1"}" data-cv="${it.id}" value="${esc(v??"")}" placeholder="—"></td><td class="${df<0?"neg":""}" data-cd="${it.id}">${has?(df>0?"+":"")+fmt(df):""}</td></tr>`}
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
    for(const [id,v] of Object.entries(c.vals)){if(v==="")continue;const n=Number(v);if(!Number.isFinite(n)||n<0||(!isG(id)&&!Number.isInteger(n))){$("#c_msg").innerHTML=`<div class="note bad">العدد الفعلي لازم يكون رقم صحيح من صفر وطالع («${esc(iname(id))}»).</div>`;return}
      const df=Math.round((n-q(bal,c.b,c.loc,id))*1000)/1000;if(df)lines.push({item:id,qty:df,loc:c.loc})}
    if(!lines.length){$("#c_msg").innerHTML=`<div class="note info">مفيش فروقات – الجرد مطابق للسيستم.</div>`;return}
    writeDoc("moves",{date:today(),ts:Date.now(),branch:c.b,type:"adjust",lines,note:`جرد ${LOC[c.loc]}`,emp:myName(),by:S.email,void:false},`اتسجلت تسوية لـ ${lines.length} صنف`);
    c.vals={};render()};
}

/* ---------- SETTINGS ---------- */
let importData=null;
function vItems(){
  if(!S.itemsDraft)S.itemsDraft=S.items.map(i=>({...i}));const ed=isAdmin();
  let h=`<div class="head"><h2>الإعدادات</h2>${ed?"":'<span class="chip plain">التعديل للمدير فقط</span>'}</div>
  <section class="panel"><div class="head"><h3>قائمة الأصناف</h3>${ed?'<button class="btn sm" id="i_add">+ صنف جديد</button>':""}</div>
  <div class="tbl-wrap"><table><thead><tr><th>م</th><th class="name">اسم الصنف</th><th>الوزن (جرام)</th><th>العيار</th><th>بالوزن؟</th><th>حد أدنى للفرعية</th><th>نشط</th></tr></thead><tbody>`;
  S.itemsDraft.forEach((it,i)=>{const dis=ed?"":"disabled";h+=`<tr><td>${i+1}</td><td style="min-width:200px"><input data-in="${i}" value="${esc(it.name)}" ${dis}></td>
    <td style="width:110px"><input type="number" step="any" min="0" data-iw="${i}" value="${it.unit==="g"?1:it.weight}" ${dis||(it.unit==="g"?"disabled":"")}></td>
    <td style="width:100px"><input type="number" step="any" min="0" data-ik="${i}" value="${it.karat??999.9}" ${dis}></td>
    <td><input type="checkbox" data-iu="${i}" ${it.unit==="g"?"checked":""} ${dis} style="width:auto" title="الصنف بيتباع بالجرام زي الدهب الخام"></td>
    <td style="width:100px"><input type="number" step="1" min="0" data-im="${i}" value="${it.min??0}" ${dis}></td><td><input type="checkbox" data-io="${i}" ${it.off?"":"checked"} ${dis} style="width:auto"></td></tr>`});
  h+=`</tbody></table></div><p class="muted small">«بالوزن» يعني الصنف بيتسجل بالجرام مش بالعدد (زي الدهب الخام). الصنف غير النشط بيختفي من القوائم، بس رصيده وسجله بيفضلوا.</p>
  <div id="i_msg"></div>${ed?'<div class="row"><button class="btn gold" id="i_save">حفظ الأصناف</button><button class="btn" id="i_undo">تراجع</button></div>':""}</section>`;
  if(ed){
    h+=`<section class="panel"><h3>المستخدمين</h3><p class="small muted">كل موظف بيدخل بإيميل وكلمة سر. المدير بس هو اللي يقدر يعدّل الأصناف ويلغي الحركات ويضيف موظفين.</p>
    <div class="tbl-wrap"><table><thead><tr><th class="name">الاسم</th><th class="name">الإيميل</th><th>الصلاحية</th><th></th></tr></thead><tbody>
    ${S.admins.map(e=>`<tr><td class="name">${esc(nameOf(e))}</td><td class="name">${esc(e)}</td><td><span class="chip gold">مدير</span></td><td></td></tr>`).join("")}
    ${S.staff.filter(s=>!S.admins.includes(s.email)).map(s=>`<tr><td class="name">${esc(s.name)}</td><td class="name">${esc(s.email)}</td><td><span class="chip plain">موظف</span></td><td><button class="btn sm danger" data-rmu="${esc(s.email)}">إيقاف</button></td></tr>`).join("")}
    </tbody></table></div>
    <div class="form"><label>اسم الموظف<input id="u_name" placeholder="مثلاً: أحمد – بوابة 2"></label><label>الإيميل<input id="u_email" type="email" dir="ltr" placeholder="ahmed@gmail.com"></label><label>كلمة السر (6 على الأقل)<input id="u_pass" dir="ltr" placeholder="••••••"></label></div>
    <div id="u_msg"></div><div class="row"><button class="btn pri" id="u_add">إضافة موظف</button></div></section>`;
    h+=`<section class="panel"><h3>استيراد بيانات شيت الإكسيل القديم</h3><p class="small">اختار ملف <b>gold-import.json</b> اللي اتبعتلك. هيضيف الأصناف الناقصة (زي الدهب الخام) ويحدّث أوزان التولة، وينقل الوارد والمبيعات بالفلوس ورقم الإذن، والمصروفات وإيداعات الأبلكيشن والرصيد الافتتاحي للكاش. البضاعة بتدخل <b>الخزنة الرئيسية – بوابة 2</b>. لو استوردت نفس الملف مرتين، مش هيتكرر حاجة.</p>
    <input type="file" id="imp_file" accept=".json,application/json"><div id="imp_msg">${importData?impSummary(importData):""}</div></section>`;
    const cl=S.closing;
    h+=`<section class="panel"><h3>إقفال الفترة (ترحيل الأرصدة)</h3><p class="small">بيحفظ الأرصدة الحالية (الدهب والكاش) كرصيد بداية عشان البرنامج يفضل سريع مع كتر الحركات. اعمله آخر كل شهر بعد الجرد. الحركات القديمة بتفضل في الأرشيف والملخص، بس مش هتقدر تلغيها بعد الإقفال.</p>
    <p class="muted small">${cl?`آخر إقفال: ${fdate(cl.date)}${cl.reset?" (تصفير)":""}`:"لسه ما اتعملش إقفال."} · الحركات المفتوحة دلوقتي: ${S.live.length}</p>
    <div class="confirm" id="cl_box"><button class="btn pri" id="cl_btn">إقفال الفترة الآن</button></div></section>
    <section class="panel danger-zone"><h3>تصفير البرنامج</h3><p class="small">بيخلّي رصيد كل الأصناف في كل الخزن والبترينات <b>صفر</b>، ورصيد الكاش <b>صفر</b>، عشان تبدأ من الأول. الحركات القديمة بتفضل في الأرشيف للرجوع ليها بس مبتأثرش على الأرصدة. الأصناف والموظفين مش بيتمسحوا.</p>
    <div class="confirm" id="rz_box"><button class="btn danger" id="rz_btn">تصفير كل الأرصدة</button></div></section>`;
  }
  return h;
}
function impSummary(d){const sales=d.moves.filter(m=>T[m.type]?.sale);
  return `<div class="note info small">الملف: <b>${esc(d.source||"")}</b> – ${d.moves.length} حركة (منها ${sales.length} فاتورة بيع)، ${d.cash.length} إيداع/سحب، ${d.items.length} صنف.</div><div class="row"><button class="btn gold" id="imp_go">ابدأ الاستيراد</button></div>`}
const norm=s=>String(s||"").replace(/[\sـ()]/g,"");
async function runImport(data,say){
  const items=S.items.map(i=>({...i}));const byN=new Map(items.map(i=>[norm(i.name),i]));
  for(const it of data.items){let ex=byN.get(norm(it.name));
    if(ex){ex.weight=it.weight;ex.karat=it.karat;if(it.unit==="g")ex.unit="g"}
    else{let n=1;while(items.some(i=>i.id==="i"+String(n).padStart(2,"0")))n++;ex={id:"i"+String(n).padStart(2,"0"),name:it.name,weight:it.weight,karat:it.karat,min:it.unit==="g"?0:2};if(it.unit==="g")ex.unit="g";items.push(ex);byN.set(norm(it.name),ex)}}
  say("بيحدّث الأصناف…");await db.doc("config/items").set({items});
  say("بيشوف اللي اتنقل قبل كده…");
  const have=new Set();for(const col of ["moves","cash"]){const s=await db.collection(col).where("imp","==",true).get();s.docs.forEach(d=>have.add(col+"/"+d.id))}
  let ts=Date.now();const writes=[];
  for(const m of data.moves){if(have.has("moves/"+m.id))continue;
    const lines=m.lines.map(l=>({item:byN.get(norm(l.name))?.id,qty:l.qty,...(l.k?{k:l.k}:{})}));
    if(lines.some(l=>!l.item))throw new Error("صنف مش موجود: "+m.lines.map(l=>l.name).join("، "));
    const doc={date:m.date,ts:ts++,branch:m.branch,type:m.type,lines,note:m.note||"",emp:m.emp||"",by:S.email,void:false,imp:true};
    if(m.pay)doc.pay=m.pay;if(m.inv)doc.inv=m.inv;writes.push(["moves",m.id,doc])}
  for(const c of data.cash){if(have.has("cash/"+c.id))continue;writes.push(["cash",c.id,{date:c.date,ts:ts++,branch:c.branch,kind:c.kind,cat:c.cat,desc:c.desc,amount:c.amount,by:S.email,emp:"",void:false,imp:true}])}
  if(!writes.length)return 0;
  for(let i=0;i<writes.length;i+=400){const b=db.batch();for(const [col,id,d] of writes.slice(i,i+400))b.set(db.collection(col).doc(id),d);
    say(`بينقل… ${Math.min(i+400,writes.length)} من ${writes.length}`);await b.commit()}
  return writes.length;
}
function bItems(){
  if(!isAdmin())return;const D=S.itemsDraft;
  document.querySelectorAll("[data-in]").forEach(x=>x.oninput=()=>D[+x.dataset.in].name=x.value);
  document.querySelectorAll("[data-iw]").forEach(x=>x.oninput=()=>D[+x.dataset.iw].weight=x.value);
  document.querySelectorAll("[data-ik]").forEach(x=>x.oninput=()=>D[+x.dataset.ik].karat=x.value);
  document.querySelectorAll("[data-iu]").forEach(x=>x.onchange=()=>{const it=D[+x.dataset.iu];if(x.checked){it.unit="g";it.weight=1}else delete it.unit;render()});
  document.querySelectorAll("[data-im]").forEach(x=>x.oninput=()=>D[+x.dataset.im].min=x.value);
  document.querySelectorAll("[data-io]").forEach(x=>x.onchange=()=>D[+x.dataset.io].off=!x.checked);
  $("#i_add").onclick=()=>{let n=1;while(D.some(i=>i.id==="i"+String(n).padStart(2,"0")))n++;D.push({id:"i"+String(n).padStart(2,"0"),name:"",weight:"",karat:999.9,min:2});render();const all=document.querySelectorAll("[data-in]");all[all.length-1].focus()};
  $("#i_undo").onclick=()=>{S.itemsDraft=null;render()};
  const msg=x=>{$("#i_msg").innerHTML=`<div class="note bad">${esc(x)}</div>`};
  $("#i_save").onclick=()=>{const out=[];for(const it of D){const name=String(it.name).trim();const g=it.unit==="g";const w=g?1:Number(it.weight),mn=Number(it.min),k=Number(it.karat)||999.9;
      if(!name){if(!S.items.some(x=>x.id===it.id))continue;return msg("اسم الصنف مينفعش يبقى فاضي.")}
      if(!(w>0))return msg(`اكتب وزن صحيح للصنف «${name}».`);if(!Number.isInteger(mn)||mn<0)return msg(`الحد الأدنى للصنف «${name}» لازم رقم صحيح.`);
      const o={id:it.id,name,weight:w,karat:k,min:mn};if(g)o.unit="g";if(it.off)o.off=true;out.push(o)}
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
  const bindImp=()=>{const go=$("#imp_go");if(!go)return;go.onclick=async()=>{if(!S.online){$("#imp_msg").innerHTML=`<div class="note warn">الاستيراد محتاج إنترنت.</div>`;return}
    go.disabled=true;const say=t=>{const m=$("#imp_msg");if(m)m.innerHTML=`<div class="note info">${esc(t)}</div>`};
    try{const n=await runImport(importData,say);importData=null;$("#imp_msg").innerHTML=`<div class="note info">${n?`خلص الاستيراد ✓ – اتنقل ${n} سجل. افتح «المخزون» و«الخزينة» واتأكد من الأرقام.`:"الملف ده اتنقل قبل كده بالكامل – مفيش حاجة جديدة."}</div>`}
    catch(e){go.disabled=false;$("#imp_msg").innerHTML=`<div class="note bad">الاستيراد وقف: ${esc(e.code?errText(e):e.message)}</div>`}}};
  $("#imp_file").onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const d=JSON.parse(r.result);if(!Array.isArray(d.moves)||!Array.isArray(d.items))throw 0;d.cash=d.cash||[];importData=d;$("#imp_msg").innerHTML=impSummary(d);bindImp()}catch(x){$("#imp_msg").innerHTML=`<div class="note bad">الملف ده مش ملف استيراد صحيح.</div>`}};r.readAsText(f)};
  bindImp();
  const lastTs=()=>Math.max(Date.now(),S.live.reduce((a,m)=>Math.max(a,m.ts||0),0),S.cash.reduce((a,c)=>Math.max(a,c.ts||0),0));
  $("#rz_btn").onclick=()=>{const box=$("#rz_box");
    if(!S.online){box.innerHTML=`<span class="note warn small">التصفير محتاج إنترنت.</span>`;return}
    box.innerHTML=`<span class="small"><b>متأكد؟</b> كل أرصدة الدهب والكاش هتبقى صفر في الفرعين.</span><button class="btn sm danger" id="rz_yes">أيوه، صفّر</button><button class="btn sm" id="rz_no">لا</button>`;
    $("#rz_no").onclick=()=>render();
    $("#rz_yes").onclick=async()=>{try{await db.doc("config/closing").set({ts:lastTs(),date:today(),bal:emptyBal(),cash:{b2:0,b4:0},by:S.email,reset:true});toast("اتصفّر البرنامج – كل الأرصدة صفر")}catch(e){toast("التصفير ما نجحش: "+errText(e))}}};
  $("#cl_btn").onclick=()=>{const box=$("#cl_box");
    if(!S.online){box.innerHTML=`<span class="note warn small">الإقفال محتاج إنترنت.</span>`;return}
    box.innerHTML=`<span class="small">هيتم ترحيل ${S.live.length} حركة و${S.cash.length} إيداع/سحب. متأكد؟</span><button class="btn sm pri" id="cl_yes">أيوه، اقفل</button><button class="btn sm" id="cl_no">لا</button>`;
    $("#cl_no").onclick=()=>render();
    $("#cl_yes").onclick=async()=>{const bal=balances();const clean=emptyBal();
      for(const b of BKEYS)for(const l of LOCS)for(const [k,v] of Object.entries(bal[b][l]))if(v)clean[b][l][k]=v;
      const cash={};for(const b of BKEYS)cash[b]=Math.round(cashBal(b)*100)/100;
      try{await db.doc("config/closing").set({ts:lastTs(),date:today(),bal:clean,cash,by:S.email});toast("اتقفلت الفترة ✓")}catch(e){toast("الإقفال ما نجحش: "+errText(e))}}};
}

/* ---------- utils ---------- */
function saveCsv(name,rows){
  const csv="﻿"+rows.map(r=>r.map(c=>{const s=String(c??"");return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s}).join(",")).join("\r\n");
  const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
  const a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);
}

/* ---------- login ---------- */
function renderLogin(msg){
  shell(false);document.body.classList.add("loginbg");
  $("#app").innerHTML=`<div class="loginwrap"><div class="loginphoto"><img src="login-bg.jpg" alt="كورنيش جدة ومسجد الرحمة"><span>جدة · كورنيش البحر الأحمر</span></div><section class="panel login"><div class="brand big"><svg class="ingot" viewBox="0 0 34 22" aria-hidden="true"><path d="M7 2h20l6 18H1z" fill="var(--gold)"/><path d="M9 5h16l3 9H6z" fill="#F3D779" opacity=".55"/></svg><div><h2>خزائن الذهب</h2><span class="muted small">بوابة 2 · بوابة 4</span></div></div>
  <label>الإيميل<input id="lg_e" type="email" dir="ltr" autocomplete="username" value="${esc(store.get("gv.lastEmail")||"")}"></label>
  <label>كلمة السر<input id="lg_p" type="password" dir="ltr" autocomplete="current-password"></label>
  <div id="lg_msg">${msg?`<div class="note bad">${esc(msg)}</div>`:""}</div>
  <button class="btn gold" id="lg_go">دخول</button><button class="btn" id="lg_reset">نسيت كلمة السر</button>
  <details class="first"><summary>أول مرة تشغّل البرنامج؟</summary><p class="small">اكتب إيميلك وكلمة سر جديدة فوق (6 حروف/أرقام على الأقل) واضغط الزرار ده. أول حساب بيتعمل بيبقى هو المدير.</p><button class="btn pri" id="lg_first">إنشاء حساب المدير</button></details></section></div>`;
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
  $("#app").innerHTML=`<section class="panel login"><h2>تجهيز البرنامج لأول مرة</h2><p>هنعمل حساب المدير بالإيميل <b dir="ltr">${esc(e)}</b> وكلمة السر اللي كتبتها، وهنضيف قائمة الأصناف. كل الأرصدة هتبدأ صفر.</p>
  <label>اسمك<input id="fr_n" placeholder="اسم المدير"></label><div id="fr_msg"></div><button class="btn gold" id="fr_go">إنشاء حساب المدير</button><button class="btn" id="fr_back">رجوع</button></section>`;
  $("#fr_back").onclick=()=>renderLogin();
  $("#fr_go").onclick=async()=>{const n=$("#fr_n").value.trim()||"المدير";$("#fr_go").disabled=true;
    try{S.firstName=n;await auth.createUserWithEmailAndPassword(e,p)}
    catch(err){
      if(String(err.code).includes("email-already-in-use")){try{await auth.signInWithEmailAndPassword(e,p);return}catch(e2){err=e2;if(String(e2.code).match(/invalid-credential|wrong-password/)){$("#fr_go").disabled=false;$("#fr_msg").innerHTML=`<div class="note bad">الإيميل ده عليه حساب بالفعل وكلمة السر مش مطابقة. اكتب كلمة السر الصح، أو ارجع واضغط «نسيت كلمة السر».</div>`;return}}}
      $("#fr_go").disabled=false;$("#fr_msg").innerHTML=`<div class="note bad">${esc(errText(err))}</div>`}};
}
async function bootstrapIfFirst(){
  /* Runs once after sign-in: if nobody is admin yet, this account becomes the admin and the catalog is seeded. Balances start at zero. */
  const ref=db.doc("config/admins");let snap;
  try{snap=await ref.get({source:"server"})}catch(e){return}
  if(snap.exists)return;
  await ref.set({emails:[S.email]});
  await db.doc("config/staff").set({list:[{email:S.email,name:S.firstName||"المدير"}],emails:[S.email]});
  const items=DEFAULT_ITEMS.map(([name,weight],i)=>({id:"i"+String(i+1).padStart(2,"0"),name,weight,karat:999.9,min:2}));
  items.push({id:"i31",name:"دهب خام",weight:1,karat:999.9,min:0,unit:"g"});
  await db.doc("config/items").set({items});
  toast("البرنامج جاهز – انت المدير ✓");
}

/* ---------- boot ---------- */
let subs=[];let unsubMoves=null,unsubCash=null,lastTs;
function stopSubs(){subs.forEach(u=>u&&u());subs=[];unsubMoves?.();unsubMoves=null;unsubCash?.();unsubCash=null}
function subLive(){
  unsubMoves?.();unsubCash?.();S.liveLoaded=false;S.cashLoaded=false;
  let qm=db.collection("moves"),qc=db.collection("cash");if(S.closing?.ts){qm=qm.where("ts",">",S.closing.ts);qc=qc.where("ts",">",S.closing.ts)}
  unsubMoves=qm.onSnapshot({includeMetadataChanges:true},snap=>{
    S.live=snap.docs.map(d=>({id:d.id,...d.data(),_pending:d.metadata.hasPendingWrites})).sort((a,b)=>(b.ts||0)-(a.ts||0));
    S.pending=snap.metadata.hasPendingWrites;S.liveLoaded=true;rerender()},
    e=>{S.liveLoaded=true;rerender()});
  unsubCash=qc.onSnapshot(snap=>{S.cash=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.ts||0)-(a.ts||0));S.cashLoaded=true;rerender()},
    e=>{S.cashLoaded=true;rerender()});
}
function startData(){
  stopSubs();lastTs=undefined;
  subs.push(db.doc("config/admins").onSnapshot(s=>{S.admins=(s.exists?s.data().emails:[])||[];S.rolesLoaded=true;rerender()},()=>{S.rolesLoaded=true;rerender()}));
  subs.push(db.doc("config/staff").onSnapshot(s=>{S.staff=(s.exists?s.data().list:[])||[];rerender()},()=>{}));
  subs.push(db.doc("config/items").onSnapshot(s=>{S.items=(s.exists?s.data().items:[])||[];S.itemsLoaded=true;if(S.route!=="items")S.itemsDraft=null;rerender()},()=>{S.itemsLoaded=true;rerender()}));
  subs.push(db.collection("moves").where("app","==",true).onSnapshot(s=>{S.appMoves=s.docs.map(d=>({id:d.id,...d.data()}));if(S.route==="app")rerender()},()=>{}));
  subs.push(db.doc("config/closing").onSnapshot(s=>{S.closing=s.exists?s.data():null;S.closingLoaded=true;const ts=S.closing?.ts||0;if(ts!==lastTs){lastTs=ts;subLive()}rerender()},()=>{S.closingLoaded=true;if(lastTs===undefined){lastTs=0;subLive()}rerender()}));
}
function boot(){
  CFG=window.FIREBASE_CONFIG;
  if(!CFG||!CFG.apiKey||/ضع|PASTE|xxx/i.test(CFG.apiKey)){shell(false);$("#app").innerHTML=`<section class="panel"><h2>البرنامج محتاج يتربط بقاعدة البيانات</h2><p>افتح ملف <b>config.js</b> وحط فيه بيانات مشروع Firebase بتاعك، وبعدين ارفع الملفات تاني.</p></section>`;return}
  if(!window.firebase){$("#app").innerHTML=`<div class="note bad">محتاج إنترنت لأول تشغيل للبرنامج.</div>`;return}
  firebase.initializeApp(CFG);auth=firebase.auth();db=firebase.firestore();
  db.enablePersistence({synchronizeTabs:true}).catch(()=>{});
  S.branch=store.get("gv.branch")||"b2";if(!["b2","b4","all"].includes(S.branch))S.branch="b2";
  readRoute();
  document.querySelectorAll("#branchSeg button").forEach(btn=>btn.onclick=()=>setBranch(btn.dataset.b));
  $("#logout").onclick=()=>{stopSubs();auth.signOut()};
  auth.onAuthStateChanged(async u=>{
    if(!u){S.email="";stopSubs();Object.assign(S,{rolesLoaded:false,itemsLoaded:false,closingLoaded:false,liveLoaded:false,cashLoaded:false,admins:[],staff:[],items:[],live:[],cash:[],appMoves:[]});renderLogin();return}
    S.email=(u.email||"").toLowerCase();render();
    await bootstrapIfFirst().catch(e=>toast(errText(e)));
    startData();
  });
}
window.__gv={S,balances,deltas,status,cashBal};
boot();
if("serviceWorker" in navigator&&location.protocol==="https:")navigator.serviceWorker.register("sw.js").catch(()=>{});
})();
