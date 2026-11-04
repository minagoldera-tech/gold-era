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
   pay: money flows in (+1, customer pays) or out (-1, we pay). loc: the person picks the place. perm: permission needed. */
const T={
  open:{l:"رصيد افتتاحي",loc:1,g:"وارد",cat:"in",perm:"stockin"},
  in_main:{l:"وارد للخزنة الرئيسية",fx:[["main",1]],g:"وارد",cat:"in",perm:"stockin"},
  buy:{l:"شراء من عميل",loc:1,g:"بيع وشراء",pay:-1,cat:"buy",perm:"buy",cust:1},
  main_sub:{l:"تحويل: رئيسية ← فرعية",fx:[["main",-1],["sub",1]],g:"تحويل داخلي",perm:"transfer"},
  sub_main:{l:"مرتجع: فرعية ← رئيسية",fx:[["sub",-1],["main",1]],g:"تحويل داخلي",perm:"transfer"},
  main_show:{l:"تحويل: رئيسية ← بترينة",fx:[["main",-1],["show",1]],g:"تحويل داخلي",perm:"transfer"},
  sub_show:{l:"تحويل: فرعية ← بترينة",fx:[["sub",-1],["show",1]],g:"تحويل داخلي",perm:"transfer"},
  show_sub:{l:"مرتجع: بترينة ← فرعية",fx:[["show",-1],["sub",1]],g:"تحويل داخلي",perm:"transfer"},
  sale_sub:{l:"بيع من الخزنة الفرعية",fx:[["sub",-1]],sale:1,pay:1,g:"بيع وشراء",cat:"sale",perm:"sale",cust:1},
  sale_show:{l:"بيع من البترينة",fx:[["show",-1]],sale:1,pay:1,g:"بيع وشراء",cat:"sale",perm:"sale",cust:1},
  sale_main:{l:"بيع من الخزنة الرئيسية",fx:[["main",-1]],sale:1,pay:1,g:"بيع وشراء",cat:"sale",perm:"sale",cust:1},
  cust_ret:{l:"مرتجع من عميل (للفرعية)",fx:[["sub",1]],sale:-1,pay:-1,g:"بيع وشراء",cat:"sale",perm:"sale",cust:1},
  app_res:{l:"حجز طلب أبلكيشن (من الفرعية)",fx:[["sub",-1],["res",1]],app:1,g:"الأبلكيشن",perm:"app",cust:1},
  app_res_m:{l:"حجز طلب أبلكيشن (من الرئيسية)",fx:[["main",-1],["res",1]],app:1,g:"الأبلكيشن",perm:"app",cust:1},
  app_del:{l:"تسليم طلب أبلكيشن",fx:[["res",-1]],sale:1,pay:1,app:1,g:"الأبلكيشن",cat:"sale",perm:"app",cust:1},
  app_cancel:{l:"إلغاء حجز أبلكيشن",fx:[["res",-1],["sub",1]],app:1,g:"الأبلكيشن",perm:"app",cust:1},
  branch:{l:"تحويل للفرع الآخر (رئيسية ← رئيسية)",fx:[["main",-1]],to:[["main",1]],g:"بين الفروع",perm:"transfer"},
  out_main:{l:"منصرف من الرئيسية (مورد / تصنيع)",fx:[["main",-1]],g:"أخرى",cat:"out",perm:"stockin"},
  adjust:{l:"تسوية جرد (+ / −)",loc:1,signed:1,g:"أخرى",cat:"adj",perm:"count"}
};
/* What a staff account can see and do. The owner (admin) can do everything. */
const SCREENS=[["stock","المخزون"],["new","حركة جديدة"],["app","الأبلكيشن"],["cash","الخزينة"],["archive","الأرشيف اليومي"],["month","الملخص الشهري"],["log","سجل الحركات"],["count","الجرد"]];
const ACTIONS=[["sale","بيع ومرتجعات"],["transfer","تحويلات (بين الخزن والفروع)"],["stockin","وارد / منصرف / رصيد افتتاحي"],["buy","شراء من عملاء"],["app","طلبات الأبلكيشن"],["cash","تسجيل في الخزينة"],["count","الجرد"],["edit","تعديل وتراجع عن العمليات"],["money","يشوف أرصدة الفلوس والتقارير المالية"]];
const DEFAULT_PERMS={s_stock:true,s_new:true,s_archive:true,s_log:true,sale:true,transfer:true};
const USER_DOMAIN="users.goldvault.app";
const DEFAULT_ITEMS=[["1 جرام",1],["2.5 جرام",2.5],["2.5 جرام (الله)",2.5],["5 جرام",5],["5 جرام (قل أعوذ)",5],["5 جرام (الله)",5],
["8 جرام (دام عزك ياوطن)",8],["10 جرام",10],["10 جرام (قل أعوذ)",10],["10 جرام (لبيك الله)",10],["10 جرام (أمي جنة)",10],
["10 جرام (دام عزك ياوطن)",10],["15.55 جرام",15.55],["15.55 جرام (قل أعوذ)",15.55],["15.55 جرام الصقر",15.55],
["15.55 جرام الاهرامات",15.55],["20 جرام",20],["20 جرام (الكعبة)",20],["25 جرام",25],["25 جرام (لبيك الله)",25],
["25 جرام (صقر)",25],["أونصة 31.10 جرام",31.10],["31.10 جرام (المسجد النبوي)",31.10],["50 جرام",50],["5 Tola",58.325],
["100 جرام",100],["10 Tola",116.65],["999.9 ك (كيلو)",1000],["500 جرام",500],["250 جرام",250]];
const KARATS=[["999.9","999.9 (24)"],["995","995"],["916","916 (22)"],["875","875 (21)"],["750","750 (18)"]];
const CASH_CATS={in:["رصيد افتتاحي","إيداع ابلكيشن","إيداع نقدية","أخرى"],out:["مصروفات عامة","مرتبات","فواتير","توريد لحساب الشركة / البنك","أخرى"]};

const S={items:[],itemsLoaded:false,closing:null,closingLoaded:false,live:[],liveLoaded:false,cash:[],cashLoaded:false,appMoves:[],
  admins:[],rolesLoaded:false,me:null,meLoaded:false,users:[],branch:"b2",route:"home",email:"",pending:false,online:navigator.onLine,draft:null,
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
const fdateShort=iso=>{if(!iso)return "";const d=parseD(iso);return `${d.getDate()} ${AR_MONTHS[d.getMonth()]}`};
const fmonth=ym=>{const [y,m]=ym.split("-").map(Number);return `${AR_MONTHS[m-1]} ${y}`};
const ftime=ts=>{if(!ts)return "";const d=new Date(ts);let h=d.getHours();const ap=h<12?"ص":"م";h=h%12||12;return `${h}:${String(d.getMinutes()).padStart(2,"0")} ${ap}`};
const addDays=(iso,n)=>{const d=parseD(iso);d.setDate(d.getDate()+n);return dstr(d)};
const monthEnd=ym=>{const [y,m]=ym.split("-").map(Number);return dstr(new Date(y,m,0))};
const addMonths=(ym,n)=>{const [y,m]=ym.split("-").map(Number);const d=new Date(y,m-1+n,1);return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")};
const store={get(k){try{return localStorage.getItem(k)}catch(e){return null}},set(k,v){try{localStorage.setItem(k,v)}catch(e){}}};
const other=b=>b==="b2"?"b4":"b2";
const custKey=s=>String(s||"").trim().replace(/\s+/g," ").toLowerCase();
function toast(m){const t=$("#toast");t.textContent=m;t.hidden=false;clearTimeout(toast.h);toast.h=setTimeout(()=>t.hidden=true,3200)}
const itemById=id=>S.items.find(i=>i.id===id);
const iname=id=>itemById(id)?.name||"صنف محذوف";
const isG=id=>itemById(id)?.unit==="g";                       // sold by weight (raw gold)
const iw=id=>{const it=itemById(id);if(!it)return 0;return it.unit==="g"?1:(Number(it.weight)||0)};
const ik=id=>Number(itemById(id)?.karat)||999.9;
const lineG=ln=>(Number(ln.qty)||0)*iw(ln.item);
const lineG24=ln=>lineG(ln)*(Number(ln.k)||ik(ln.item))/999.9;
const payTotal=p=>(Number(p?.cash)||0)+(Number(p?.bank)||0)+(Number(p?.card)||0);
const activeItems=()=>S.items.filter(i=>!i.off);
/* ---- people & permissions ---- */
const isAdmin=()=>S.admins.includes(S.email);
const isMember=()=>isAdmin()||S.me?.active===true;
const can=p=>isAdmin()||S.me?.perms?.[p]===true;
const canSee=r=>r==="home"||(r==="items"?isAdmin():can("s_"+r));
const showMoney=()=>can("money");
const allowedBranches=()=>isAdmin()?BKEYS:BKEYS.filter(b=>(S.me?.branches||[]).includes(b));
const myName=()=>S.me?.name||(S.email?S.email.split("@")[0]:"");
const nameOf=email=>S.users.find(u=>u.id===email)?.name||(email?email.split("@")[0]:"");
const toLoginEmail=s=>{s=String(s||"").trim().toLowerCase();if(s.includes("@"))return s;return s.split(/[\s.]+/).filter(Boolean).join(".")+"@"+USER_DOMAIN};
const errText=e=>{const c=e?.code||"";
  if(c.includes("permission-denied"))return "مش مسموح لحسابك بالعملية دي (أو قواعد الأمان في Firebase محتاجة تتحدّث).";
  if(c.includes("wrong-password")||c.includes("invalid-credential")||c.includes("user-not-found")||c.includes("invalid-login"))return "اسم المستخدم أو كلمة السر غلط.";
  if(c.includes("too-many-requests"))return "محاولات كتير – استنى شوية وجرّب تاني.";
  if(c.includes("network")||c.includes("unavailable"))return "مفيش اتصال بالإنترنت.";
  if(c.includes("email-already-in-use"))return "اسم المستخدم ده موجود بالفعل.";
  if(c.includes("weak-password"))return "كلمة السر لازم 6 حروف/أرقام على الأقل.";
  if(c.includes("invalid-email"))return "اسم المستخدم مكتوب غلط.";
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
/* extra: a move not saved yet; skip: id of a move to leave out (when editing it) */
function balances(extra,skip){
  const bal=emptyBal();const cb=S.closing?.bal;
  if(cb)for(const b of BKEYS)for(const l of LOCS)Object.assign(bal[b][l],cb[b]?.[l]||{});
  const list=extra?S.live.concat([extra]):S.live;
  for(const m of list){if(m.void||(skip&&m.id===skip))continue;for(const x of deltas(m)){const L=bal[x.b]?.[x.loc];if(!L)continue;L[x.item]=(L[x.item]||0)+x.d}}
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
const knownCustomers=()=>{const s=new Map();for(const m of S.live.concat(S.appMoves))if(m.cust&&!s.has(custKey(m.cust)))s.set(custKey(m.cust),m.cust);return [...s.values()].sort()};

/* ---------- shell ---------- */
const ROUTES=["home","stock","new","app","cash","archive","month","log","count","items"];
function readRoute(){const h=location.hash.slice(1);S.route=ROUTES.includes(h)?h:"home"}
window.addEventListener("hashchange",()=>{readRoute();render();window.scrollTo(0,0)});
window.addEventListener("online",()=>{S.online=true;syncChip()});
window.addEventListener("offline",()=>{S.online=false;syncChip()});
const bsel=()=>{const a=allowedBranches();return S.branch==="all"?a:(a.includes(S.branch)?[S.branch]:a.slice(0,1))};
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
  const ab=allowedBranches();
  if(S.branch!=="all"&&!ab.includes(S.branch))S.branch=ab[0]||"b2";
  if(S.branch==="all"&&ab.length<2)S.branch=ab[0]||"b2";
  document.querySelectorAll("#branchSeg button").forEach(b=>{const v=b.dataset.b;b.hidden=v==="all"?ab.length<2:!ab.includes(v);b.setAttribute("aria-pressed",String(v===S.branch))});
  document.querySelectorAll("#tabs a").forEach(a=>{const r=a.getAttribute("href").slice(1);a.hidden=!canSee(r);if(r===S.route)a.setAttribute("aria-current","page");else a.removeAttribute("aria-current")});
  $("#who").textContent=myName();syncChip();
  const app=$("#app");
  if(!(S.rolesLoaded&&S.meLoaded&&S.itemsLoaded&&S.closingLoaded&&S.liveLoaded&&S.cashLoaded)){app.innerHTML=`<div class="empty">جاري تحميل بيانات الخزائن…</div>`;return}
  if(!isMember()){app.innerHTML=`<div class="note bad">الحساب ده مش مفعّل في البرنامج. اطلب من المدير يفعّله.</div><button class="btn" id="lo2">تسجيل خروج</button>`;$("#lo2").onclick=()=>auth.signOut();return}
  if(!ab.length){app.innerHTML=`<div class="note bad">حسابك مش مربوط بأي فرع. اطلب من المدير يحدد الفروع بتاعتك.</div>`;return}
  if(!canSee(S.route)){S.route="home"}
  let html="";
  if(!S.items.length&&S.route!=="items")html+=`<div class="note info">لسه مفيش أصناف.${isAdmin()?" ادخل على «الإعدادات» وضيف الأصناف.":""}</div>`;
  const [v,b]=VIEWFN[S.route];app.innerHTML=html+v();b();
}
let rt=null;function rerender(){
  const a=document.activeElement;
  if(a&&a.matches&&a.matches("input,textarea,select")&&["new","count","items","cash","app","log"].includes(S.route)){clearTimeout(rt);rt=setTimeout(rerender,1500);return}
  render();
}

/* ---------- HOME ---------- */
function vHome(){
  const bal=balances();const t=today();
  const allZero=BKEYS.every(b=>VAULTS.every(l=>Object.values(bal[b][l]).every(v=>!v)));
  let h=`<div class="head"><h2>نظرة عامة</h2><span class="muted small">${fdate(t)}</span></div>`;
  if(allZero&&isAdmin())h+=`<div class="note info"><b>ابدأ من هنا:</b> لو عندك بيانات الشيت القديم، ادخل «الإعدادات ← استيراد». أو سجّل الرصيد الافتتاحي من «حركة جديدة ← حركات تانية ← رصيد افتتاحي»، أو من «الجرد».</div>`;
  h+=`<div class="grid2">`;
  for(const b of bsel()){
    let pcs={},gr={};for(const l of LOCS){pcs[l]=0;gr[l]=0}let g24=0;
    for(const it of S.items)for(const l of LOCS){const v=q(bal,b,l,it.id);if(it.unit!=="g")pcs[l]+=v;gr[l]+=v*iw(it.id);g24+=v*iw(it.id)*ik(it.id)/999.9}
    const sales=S.live.filter(m=>!m.void&&m.branch===b&&m.date===t&&T[m.type]?.sale);
    let sg=0,money=0;sales.forEach(m=>{const s=T[m.type].sale;m.lines.forEach(ln=>{sg+=s*lineG(ln)});money+=s*payTotal(m.pay)});
    h+=`<section class="panel"><div class="head"><h3>فرع ${BR[b]}</h3><span class="chip gold">مبيعات اليوم: ${fmt(sg)} جم${showMoney()?" · "+sar(money):""}</span></div>
    <div class="tiles">${VAULTS.map(l=>`<div class="tile"><span>${LOC[l]}</span><b>${fmt(gr[l])}</b><i>جم · ${fmt(pcs[l])} قطعة</i></div>`).join("")}</div>
    ${gr.res?`<p class="small muted">محجوز لطلبات الأبلكيشن: <b>${fmt(gr.res)} جم</b></p>`:""}
    <div class="branch-total"><span class="muted">إجمالي الفرع (عيار 24)</span><span><b>${fmt(g24)}</b> جم</span></div>
    ${showMoney()?`<div class="branch-total"><span class="muted">الكاش في الخزينة</span><span><b>${sar(cashBal(b))}</b></span></div>`:""}</section>`;
  }
  h+=`</div><div class="grid2"><section class="panel"><div class="head"><h3>تنبيهات المخزون</h3>${canSee("stock")?`<a class="btn sm" href="#stock">كل الأصناف</a>`:""}</div>`;
  const al=[];for(const b of bsel())for(const it of activeItems()){const s=status(bal,b,it);if(s.k!=="ok")al.push({b,it,s})}
  al.sort((a,b)=>a.s.r-b.s.r);
  h+=al.length?`<div class="alerts">${al.slice(0,40).map(a=>`<div class="alert ${a.s.k}"><div class="t"><b>${esc(a.it.name)}</b> <span class="muted small">· ${BR[a.b]}</span><div class="small">${a.s.t}</div></div>${a.s.act&&can("transfer")?`<button class="btn sm" data-fix="${a.b}|${a.s.act}|${a.it.id}">${a.s.act==="main_sub"?"حوّل للفرعية":"عوّض البترينة"}</button>`:""}</div>`).join("")}</div>`:`<div class="empty">كل الأصناف متوفرة – مفيش تنبيهات</div>`;
  h+=`</section><section class="panel"><div class="head"><h3>آخر الحركات</h3>${canSee("log")?`<a class="btn sm" href="#log">السجل كامل</a>`:""}</div>`;
  const rec=S.live.filter(m=>bsel().includes(m.branch)||bsel().includes(m.to)).slice(0,6);
  h+=rec.length?`<div class="moves">${rec.map(moveCard).join("")}</div>`:`<div class="empty">لسه مفيش حركات.</div>`;
  return h+`</section></div>`;
}
function bindFix(){document.querySelectorAll("[data-fix]").forEach(b=>b.onclick=()=>{const [br,type,item]=b.dataset.fix.split("|");
  S.draft={branch:br,type,lines:[{item,qty:1}]};location.hash="new"})}
function bHome(){bindFix();bindMoveActions()}

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
function vaultLabel(){const bs=bsel(),v=SV.view;
  if(bs.length>1)return v==="all"?"كل الخزن والبترينات – الفرعين":VIEWS[v].l+" – الفرعين";
  return (v==="all"?"كل الخزن والبترينة":LOC[v])+" – "+BR[bs[0]]}
function vaultOptions(){const bs=bsel();const cur=(bs.length>1?"all":bs[0])+"|"+SV.view;const o=(val,l)=>`<option value="${val}" ${val===cur?"selected":""}>${l}</option>`;const ab=allowedBranches();
  return (ab.length>1?`<optgroup label="الفرعين">${o("all|all","كل الخزن والبترينات")}${o("all|main","الخزن الرئيسية")}${o("all|sub","الخزن الفرعية")}${o("all|show","البترينات")}${o("all|res","المحجوز للأبلكيشن")}</optgroup>`:"")+
    ab.map(b=>`<optgroup label="${BR[b]}">${o(b+"|all",BR[b]+" – كل الخزن")}${o(b+"|main",BR[b]+" – الخزنة الرئيسية")}${o(b+"|sub",BR[b]+" – الخزنة الفرعية")}${o(b+"|show",BR[b]+" – البترينة")}${o(b+"|res",BR[b]+" – المحجوز للأبلكيشن")}</optgroup>`).join("")}
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
        return `<div class="cst"><span class="chip ${w.st.k}">${bs.length>1?BR[w.b]+": ":""}${w.st.t}</span>${w.st.act&&can("transfer")?`<button class="btn xs" data-fix="${w.b}|${w.st.act}|${r.it.id}">${w.st.act==="main_sub"?"حوّل للفرعية":"عوّض البترينة"}</button>`:""}</div>`})()}
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

/* ---------- NEW MOVE / INVOICE ---------- */
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
const typeOk=k=>can(T[k].perm);
function freshDraft(){const ab=allowedBranches();const firstType=["sale_sub",...Object.keys(T)].find(typeOk)||"sale_sub";
  return{branch:ab.includes(S.branch)?S.branch:ab[0],type:firstType,loc:"main",date:today(),note:"",lines:[],pickOpen:true,inv:"",cash:"",bank:"",card:"",order:"",cust:"",phone:""}}
function srcLoc(d){const t=T[d.type];if(t.loc)return d.type==="adjust"?d.loc:null;const neg=t.fx.find(f=>f[1]<0);return neg?neg[0]:null}
function flowText(d){const t=T[d.type];
  if(d.type==="open")return `هيتضاف العدد لرصيد ${LOC[d.loc]} في ${BR[d.branch]}.`;
  if(d.type==="buy")return `الدهب اللي اشتريته هيدخل ${LOC[d.loc]} في ${BR[d.branch]}، والفلوس اللي دفعتها كاش هتتخصم من الخزينة.`;
  if(t.loc)return `اكتب الفرق: موجب لو الجرد الفعلي أزيد، وسالب لو أقل – بيتعدل رصيد ${LOC[d.loc]}.`;
  const parts=t.fx.map(([l,s])=>`${s<0?"يخصم من":"يضيف إلى"} ${LOC[l]}`);
  if(t.to)parts.push(`يضيف إلى الخزنة الرئيسية في ${BR[other(d.branch)]}`);
  return parts.join(" ← ")+(t.sale?(t.sale>0?" · ويتحسب مبيعات":" · ويتخصم من المبيعات"):"")+(t.pay?(t.pay>0?" · والكاش يدخل الخزينة":" · والكاش يخرج من الخزينة"):"");
}
function itemGroups(){const g=[["سبائك صغيرة",i=>i.unit!=="g"&&i.weight<10],["10 – 31.10 جرام",i=>i.unit!=="g"&&i.weight>=10&&i.weight<50],["50 – 116 جرام",i=>i.unit!=="g"&&i.weight>=50&&i.weight<250],["سبائك كبيرة",i=>i.unit!=="g"&&i.weight>=250],["بالوزن",i=>i.unit==="g"]];
  return g.map(([l,f])=>[l,activeItems().filter(f).sort((a,b)=>a.weight-b.weight)]).filter(x=>x[1].length)}
function vNew(){
  if(!S.draft)S.draft=freshDraft();const d=Object.assign(freshDraft(),S.draft);S.draft=d;
  if(!typeOk(d.type))d.type=freshDraft().type;
  if(!allowedBranches().includes(d.branch))d.branch=allowedBranches()[0];
  if(T[d.type].loc&&!VAULTS.includes(d.loc))d.loc="main";
  const t=T[d.type];const bal=balances(null,d.editOf);const src=srcLoc(d);const avl=id=>src?q(bal,d.branch,src,id):null;
  let step=1;
  let h=`<div class="head"><h2>${d.editOf?"تعديل حركة":"حركة جديدة / فاتورة"}</h2><div class="seg2" role="group" aria-label="الفرع">${allowedBranches().map(b=>`<button data-br="${b}" aria-pressed="${d.branch===b}">${BR[b]}</button>`).join("")}</div></div>`;
  if(d.editOf)h+=`<div class="note warn">بتعدّل حركة متسجلة. لما تحفظ، الحركة القديمة هتتلغي وتتسجل الجديدة مكانها (والاتنين بيفضلوا ظاهرين في السجل). <button class="btn sm" id="ed_cancel">إلغاء التعديل</button></div>`;
  h+=`<section class="panel"><h3 class="step"><span>${step++}</span>نوع الحركة</h3><div class="qa">`;
  for(const [k,l,sub,path] of QUICK)if(typeOk(k))h+=`<button data-qt="${k}" aria-pressed="${d.type===k}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg><b>${l}</b><small>${sub}</small></button>`;
  const more=Object.entries(T).filter(([k])=>!QSET.has(k)&&typeOk(k));
  h+=`</div>${more.length?`<label>حركات تانية<select id="f_more"><option value="">— اختار —</option>${more.map(([k,v])=>`<option value="${k}" ${d.type===k?"selected":""}>${v.l}</option>`).join("")}</select></label>`:""}`;
  if(t.loc)h+=`<div class="seg2 wide" role="group" aria-label="المكان">${VAULTS.map(l=>`<button data-loc="${l}" aria-pressed="${d.loc===l}">${LOC[l]}</button>`).join("")}</div>`;
  if(t.app)h+=`<div class="form"><label>رقم الطلب / رقم العميل <b class="req">*</b><input id="f_order" value="${esc(d.order)}" inputmode="numeric"></label></div>`;
  h+=`<div class="flow">${flowText(d)}</div></section>`;
  // items
  const inCart={};d.lines.forEach(l=>inCart[l.item]=(inCart[l.item]||0)+(Number(l.qty)||0));
  h+=`<section class="panel"><div class="head"><h3 class="step"><span>${step++}</span>الأصناف</h3><button class="btn sm" id="ip_toggle">${d.pickOpen?"إخفاء قائمة الأصناف":"+ إضافة صنف"}</button></div>`;
  if(d.pickOpen){
    h+=`<div class="ipick"><input id="ip_q" placeholder="ابحث عن صنف… (مثلاً 10 أو الكعبة)"><p class="muted small">اضغط على الصنف يتضاف للفاتورة. اضغط تاني يزيد واحد.</p>
    ${itemGroups().map(([g,its])=>`<div class="ip-g"><span class="ip-gl">${g}</span><div class="ip-items">${its.map(it=>`<button class="ip-it ${inCart[it.id]?"on":""}" data-pi="${it.id}" data-name="${esc(it.name)}">${esc(it.name)}${inCart[it.id]?`<i>${fmt(inCart[it.id])}</i>`:""}</button>`).join("")}</div></div>`).join("")}
    ${t.loc?`<button class="btn sm" id="allLines">إضافة كل الأصناف مرة واحدة</button>`:""}</div>`;
  }
  if(!d.lines.length)h+=`<div class="empty small">لسه مفيش أصناف في الفاتورة.</div>`;
  else{h+=`<div class="cart">`;d.lines.forEach((ln,i)=>{const a=avl(ln.item);const over=src&&a!==null&&Number(ln.qty)>a;const g=isG(ln.item);
    h+=`<div class="ci ${over?"over":""}"><div class="cn"><b class="iname">${esc(iname(ln.item))}</b><small>${fmt(lineG(ln))} جم${g?` · عيار 24: ${fmt(lineG24(ln))} جم`:""}${over?` · الكمية أكبر من الموجود (${fmt(a)})`:""}</small></div>
    ${g?`<select class="karat" data-lk="${i}" aria-label="العيار">${KARATS.map(([v,l])=>`<option value="${v}" ${String(ln.k||ik(ln.item))===v?"selected":""}>${l}</option>`).join("")}</select>`:""}
    <div class="stepper sm"><button data-ls="${i}|-1" aria-label="أقل">−</button><input type="number" inputmode="decimal" step="any" data-lq="${i}" value="${esc(ln.qty)}" placeholder="${g?"جرام":""}"><button data-ls="${i}|1" aria-label="أكتر">+</button></div>
    <button class="btn xs danger" data-rm="${i}" aria-label="حذف">✕</button></div>`});h+=`</div>`}
  h+=`</section>`;
  // invoice details
  h+=`<section class="panel"><h3 class="step"><span>${step++}</span>${t.pay||t.cust?"بيانات الفاتورة":"تفاصيل"}</h3><div class="form">`;
  if(t.pay)h+=`<label>رقم الإذن / الفاتورة<input id="f_inv" value="${esc(d.inv)}" inputmode="numeric"></label>`;
  if(t.cust)h+=`<label>اسم العميل <span class="muted">(اختياري)</span><input id="f_cust" value="${esc(d.cust)}" list="custList" autocomplete="off"></label>
    <label>موبايل العميل <span class="muted">(اختياري)</span><input id="f_phone" value="${esc(d.phone)}" inputmode="tel" dir="ltr"></label>
    <datalist id="custList">${knownCustomers().map(c=>`<option value="${esc(c)}">`).join("")}</datalist>`;
  h+=`<label>التاريخ<input type="date" id="f_date" value="${d.date}"></label>
  <label style="grid-column:1/-1">ملاحظات<input id="f_note" value="${esc(d.note)}" placeholder="اختياري"></label></div>`;
  if(t.pay){const pt=(Number(d.cash)||0)+(Number(d.bank)||0)+(Number(d.card)||0);
    h+=`<h4 class="sub">${t.pay>0?"الفلوس اللي دفعها العميل":"الفلوس اللي اتدفعت للعميل"}</h4>
    <div class="form pay"><label>كاش (ر.س)<input type="number" inputmode="decimal" step="any" min="0" id="f_cash" value="${esc(d.cash)}"></label>
    <label>بنك / تحويل (ر.س)<input type="number" inputmode="decimal" step="any" min="0" id="f_bank" value="${esc(d.bank)}"></label>
    <label>شبكة (ر.س)<input type="number" inputmode="decimal" step="any" min="0" id="f_card" value="${esc(d.card)}"></label></div>
    <div class="paytot">الإجمالي: <b id="f_ptot">${sar(pt)}</b></div>`}
  h+=`</section>`;
  let gr=0,pcs=0;d.lines.forEach(ln=>{gr+=lineG(ln);if(!isG(ln.item))pcs+=Number(ln.qty)||0});
  h+=`<div id="f_err"></div><div class="savebar"><div><span class="muted small">${T[d.type].l} · ${BR[d.branch]}</span><div id="f_tot"><b>${fmt(gr)}</b> جم · ${fmt(pcs)} قطعة · ${d.lines.length} صنف</div></div><div class="row"><button class="btn" id="reset">${d.editOf?"إلغاء":"تفريغ"}</button><button class="btn gold" id="save">${d.editOf?"حفظ التعديل":"حفظ الحركة"}</button></div></div>`;
  return h;
}
function bNew(){
  const d=S.draft;
  const keep=()=>{for(const [k,id] of [["date","f_date"],["note","f_note"],["inv","f_inv"],["cash","f_cash"],["bank","f_bank"],["card","f_card"],["order","f_order"],["cust","f_cust"],["phone","f_phone"]]){const e=$("#"+id);if(e)d[k]=e.value}};
  const tot=()=>{let gr=0,pcs=0;d.lines.forEach(ln=>{gr+=lineG(ln);if(!isG(ln.item))pcs+=Number(ln.qty)||0});$("#f_tot").innerHTML=`<b>${fmt(gr)}</b> جم · ${fmt(pcs)} قطعة · ${d.lines.length} صنف`};
  document.querySelectorAll("[data-br]").forEach(b=>b.onclick=()=>{keep();d.branch=b.dataset.br;render()});
  document.querySelectorAll("[data-qt]").forEach(b=>b.onclick=()=>{keep();d.type=b.dataset.qt;render()});
  $("#f_more")&&($("#f_more").onchange=e=>{if(!e.target.value)return;keep();d.type=e.target.value;render()});
  document.querySelectorAll("[data-loc]").forEach(b=>b.onclick=()=>{keep();d.loc=b.dataset.loc;render()});
  ["f_date","f_note","f_inv","f_order","f_cust","f_phone"].forEach(id=>{const e=$("#"+id);if(e)e.oninput=keep});
  ["f_cash","f_bank","f_card"].forEach(id=>{const e=$("#"+id);if(e)e.oninput=()=>{keep();$("#f_ptot").textContent=sar((Number(d.cash)||0)+(Number(d.bank)||0)+(Number(d.card)||0))}});
  $("#ip_toggle").onclick=()=>{keep();d.pickOpen=!d.pickOpen;render()};
  const ipq=$("#ip_q");if(ipq)ipq.oninput=()=>{const v=ipq.value.trim();document.querySelectorAll(".ip-it").forEach(b=>b.hidden=v&&!b.dataset.name.includes(v));document.querySelectorAll(".ip-g").forEach(g=>g.hidden=![...g.querySelectorAll(".ip-it")].some(b=>!b.hidden))};
  document.querySelectorAll("[data-pi]").forEach(b=>b.onclick=()=>{keep();const id=b.dataset.pi;const qv=ipq?ipq.value:"";
    if(isG(id)){d.lines.push({item:id,qty:"",k:ik(id)});render();const all=document.querySelectorAll("[data-lq]");all[all.length-1]?.focus();return}
    const ex=d.lines.find(l=>l.item===id);if(ex)ex.qty=(Number(ex.qty)||0)+1;else d.lines.push({item:id,qty:1});
    const y=window.scrollY;render();window.scrollTo(0,y);if(qv&&$("#ip_q")){$("#ip_q").value=qv;$("#ip_q").dispatchEvent(new Event("input"))}});
  document.querySelectorAll("[data-ls]").forEach(b=>b.onclick=()=>{keep();const [i,s]=b.dataset.ls.split("|");const ln=d.lines[+i];let v=Math.round(((Number(ln.qty)||0)+Number(s))*1000)/1000;
    if(!T[d.type].signed&&v<=0){d.lines.splice(+i,1)}else ln.qty=v;const y=window.scrollY;render();window.scrollTo(0,y)});
  document.querySelectorAll("[data-lq]").forEach(s=>s.oninput=()=>{d.lines[+s.dataset.lq].qty=s.value;tot()});
  document.querySelectorAll("[data-lk]").forEach(s=>s.onchange=()=>{keep();d.lines[+s.dataset.lk].k=Number(s.value);render()});
  document.querySelectorAll("[data-rm]").forEach(b=>b.onclick=()=>{keep();d.lines.splice(+b.dataset.rm,1);render()});
  $("#allLines")&&($("#allLines").onclick=()=>{keep();const have=new Set(d.lines.map(l=>l.item));d.lines=d.lines.concat(activeItems().filter(i=>!have.has(i.id)).map(i=>({item:i.id,qty:""})));d.pickOpen=false;render()});
  const cancelEdit=()=>{S.draft=null;location.hash="log"};
  $("#ed_cancel")&&($("#ed_cancel").onclick=cancelEdit);
  $("#reset").onclick=()=>{if(d.editOf)return cancelEdit();const b=d.branch,t=d.type;S.draft=Object.assign(freshDraft(),{branch:b,type:t});render()};
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
  if(!typeOk(d.type))return{err:"مش مسموح لحسابك بالنوع ده من الحركات."};
  if(!allowedBranches().includes(d.branch))return{err:"مش مسموح لحسابك بالفرع ده."};
  for(const ln of d.lines){if(ln.qty===""||ln.qty===undefined)continue;
    const n=Number(ln.qty);
    if(!Number.isFinite(n)||(!t.signed&&n<0)||(!isG(ln.item)&&!Number.isInteger(n)))return{err:`اكتب ${isG(ln.item)?"وزن صحيح":"عدد صحيح"} للصنف «${iname(ln.item)}».`};
    if(n===0)continue;const key=ln.item+"|"+(isG(ln.item)?(ln.k||ik(ln.item)):"");
    const cur=seen.get(key)||{item:ln.item,qty:0,...(isG(ln.item)?{k:Number(ln.k)||ik(ln.item)}:{})};cur.qty=Math.round((cur.qty+n)*1000)/1000;seen.set(key,cur)}
  const lines=[...seen.values()].filter(l=>l.qty).map(l=>t.loc?{...l,loc:d.loc}:l);
  if(!lines.length)return{err:"ضيف صنف واحد على الأقل."};
  if(!d.date)return{err:"اختار التاريخ."};
  if(t.app&&!String(d.order||"").trim())return{err:"اكتب رقم الطلب / رقم العميل."};
  const m={date:d.date,ts:Date.now(),branch:d.branch,type:d.type,lines,note:String(d.note||"").trim(),emp:myName(),by:S.email,void:false};
  if(t.to)m.to=other(d.branch);
  if(t.app){m.app=true;m.order=String(d.order).trim()}
  if(t.cust&&String(d.cust||"").trim()){m.cust=String(d.cust).trim().replace(/\s+/g," ");m.custKey=custKey(m.cust)}
  if(t.cust&&String(d.phone||"").trim())m.phone=String(d.phone).trim();
  if(t.pay){const p={};for(const k of ["cash","bank","card"]){const v=Number(d[k]||0);if(v<0||!Number.isFinite(v))return{err:"المبالغ لازم تكون أرقام موجبة."};if(v)p[k]=v}
    if(Object.keys(p).length)m.pay=p;if(String(d.inv||"").trim())m.inv=String(d.inv).trim()}
  if(d.editOf)m.editOf=d.editOf;
  const after=balances(m,d.editOf);const bad=[];
  for(const x of deltas(m)){const v=q(after,x.b,x.loc,x.item);if(v<0)bad.push(`«${iname(x.item)}» في ${LOC[x.loc]} (${BR[x.b]}) هيبقى ${fmt(v)}`)}
  if(bad.length)return{err:"الرصيد مش كفاية: "+[...new Set(bad)].join("، ")+". راجع العدد أو سجّل وارد/تحويل الأول."};
  return{m};
}
function saveMove(){
  const d=S.draft;const err=$("#f_err");
  const r=buildMove(d);
  if(r.err){err.innerHTML=`<div class="note bad">${esc(r.err)}</div>`;err.scrollIntoView({block:"center"});return}
  if(d.editOf){
    const ref=db.collection("moves").doc();const b=db.batch();
    b.set(ref,r.m);b.update(db.collection("moves").doc(d.editOf),{void:true,voidBy:S.email,voidAt:Date.now(),replacedBy:ref.id});
    b.commit().catch(e=>toast("التعديل ما اتحفظش: "+errText(e)));
    toast("اتحفظ التعديل ✓");S.draft=null;location.hash="log";return;
  }
  writeDoc("moves",r.m,"اتسجلت الحركة ✓");
  S.draft=Object.assign(freshDraft(),{branch:d.branch,type:d.type,loc:d.loc,date:d.date});
  render();window.scrollTo(0,0);
}

/* ---------- MOVE CARD + ACTIONS (shared) ---------- */
function lineSummary(m){return m.lines.map(ln=>`<b>${esc(iname(ln.item))}</b> × ${ln.qty>0&&T[m.type]?.signed?"+":""}${fmt(ln.qty)}${isG(ln.item)?" جم"+(ln.k&&ln.k!=999.9?" عيار "+ln.k:""):""}`).join("، ")}
const editable=m=>can("edit")&&!(S.closing&&m.ts<=S.closing.ts)&&allowedBranches().includes(m.branch);
function moveActions(m){
  if(!editable(m))return "";
  if(m.void)return m.replacedBy?"":`<button class="btn xs" data-restore="${m.id}">استرجاع</button>`;
  return `<button class="btn xs" data-edit="${m.id}">تعديل</button><button class="btn xs danger" data-undo="${m.id}">تراجع</button>`;
}
function typeChip(m){const t=T[m.type]||{l:m.type};const cls=t.sale>0?"ok":t.sale<0?"warn":m.type==="adjust"?"bad":m.type==="branch"?"gold":t.app?"gold":m.type==="buy"?"warn":"plain";return `<span class="chip ${cls}">${t.l}</span>`}
function moveCard(m){
  const t=T[m.type]||{l:m.type};const g=m.lines.reduce((s,ln)=>s+Math.abs(lineG(ln)),0);const pt=payTotal(m.pay);
  return `<div class="move ${m.void?"void":""}"><div class="mh">${typeChip(m)}<b>${BR[m.branch]||""}</b>${m.to?`<span class="muted">← ${BR[m.to]}</span>`:""}${t.loc&&m.lines[0]?.loc?`<span class="muted small">${LOC[m.lines[0].loc]}</span>`:""}${m.inv?`<span class="chip plain">إذن ${esc(m.inv)}</span>`:""}${m.order?`<span class="chip plain">طلب ${esc(m.order)}</span>`:""}<span class="muted small" style="margin-inline-start:auto">${fdate(m.date)} · ${ftime(m.ts)}${m.emp?" · "+esc(m.emp):""}</span>${m.void?`<span class="chip bad">${m.replacedBy?"اتعدّلت":"اتلغت"}</span>`:""}${m.editOf?'<span class="chip plain">معدّلة</span>':""}${m._pending?'<span class="chip warn">لسه ما اتزامنتش</span>':""}</div>
  <div class="ml">${lineSummary(m)} <span class="muted small">(${fmt(g)} جم)</span></div>
  ${pt?`<div class="paychips">${m.pay.cash?`<span>كاش <b>${fmt(m.pay.cash)}</b></span>`:""}${m.pay.bank?`<span>بنك <b>${fmt(m.pay.bank)}</b></span>`:""}${m.pay.card?`<span>شبكة <b>${fmt(m.pay.card)}</b></span>`:""}<span class="pt">الإجمالي <b>${sar(pt)}</b></span></div>`:""}
  ${m.note||m.cust?`<div class="muted small">${m.cust?`<b>العميل:</b> ${esc(m.cust)}${m.phone?" ("+esc(m.phone)+")":""}`:""}${m.cust&&m.note?" · ":""}${esc(m.note||"")}</div>`:""}
  <div class="row acts" data-abox="${m.id}">${moveActions(m)}</div></div>`;
}
const findMove=id=>S.live.find(x=>x.id===id)||LOGSTATE.list.find(x=>x.id===id);
function bindMoveActions(){
  document.querySelectorAll("[data-undo]").forEach(b=>b.onclick=()=>{const id=b.dataset.undo;const box=document.querySelector(`[data-abox="${id}"]`);
    box.innerHTML=`<span class="small">التراجع بيلغي العملية وأثرها على الرصيد والكاش. متأكد؟</span><button class="btn xs danger" data-yes>أيوه، تراجع</button><button class="btn xs" data-no>لا</button>`;
    box.querySelector("[data-no]").onclick=()=>render();
    box.querySelector("[data-yes]").onclick=()=>{const m=findMove(id);
      if(m){const bal=balances(null,id);const bad=deltas(m).map(d=>({...d,v:q(bal,d.b,d.loc,d.item)})).filter(d=>d.v<0);
        if(bad.length){box.innerHTML=`<span class="note bad small">مينفعش التراجع: «${esc(iname(bad[0].item))}» في ${LOC[bad[0].loc]} هيبقى بالسالب لأنه اتصرف بعدها. اتراجع عن العمليات اللي بعدها الأول.</span>`;return}}
      db.collection("moves").doc(id).update({void:true,voidBy:S.email,voidAt:Date.now()}).then(()=>{if(S.route==="log")LOGSTATE.reload()}).catch(e=>toast("ما نجحش: "+errText(e)));toast("اتراجعت العملية")};});
  document.querySelectorAll("[data-restore]").forEach(b=>b.onclick=()=>{const id=b.dataset.restore;const m=findMove(id);if(!m)return;
    const after=balances(Object.assign({},m,{void:false}),id);const bad=deltas(m).filter(d=>q(after,d.b,d.loc,d.item)<0);
    if(bad.length){toast(`مينفعش الاسترجاع: «${iname(bad[0].item)}» هيبقى بالسالب.`);return}
    db.collection("moves").doc(id).update({void:false,voidBy:S.email,voidAt:Date.now()}).then(()=>{if(S.route==="log")LOGSTATE.reload()}).catch(e=>toast("ما نجحش: "+errText(e)));toast("اترجعت العملية")});
  document.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>{const m=findMove(b.dataset.edit);if(!m)return;
    S.draft=Object.assign(freshDraft(),{editOf:m.id,branch:m.branch,type:m.type,date:m.date,note:m.note||"",loc:m.lines[0]?.loc||"main",
      lines:m.lines.map(l=>({item:l.item,qty:l.qty,...(l.k?{k:l.k}:{})})),pickOpen:false,inv:m.inv||"",cash:m.pay?.cash||"",bank:m.pay?.bank||"",card:m.pay?.card||"",
      order:m.order||"",cust:m.cust||"",phone:m.phone||""});location.hash="new"});
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
  const os=orders().filter(o=>bsel().includes(o.branch));const open=os.filter(o=>o.open),done=os.filter(o=>!o.open).slice(0,30);const act=can("app");
  let h=`<div class="head"><h2>طلبات الأبلكيشن</h2>${act?`<button class="btn gold" id="ap_new">+ حجز طلب جديد</button>`:""}</div>
  <div class="kpis"><div class="kpi"><span>طلبات محجوزة</span><b>${open.length}</b><i>مستنية تسليم</i></div>
  <div class="kpi"><span>جرامات محجوزة</span><b>${fmt(open.reduce((a,o)=>a+Object.entries(o.lines).reduce((s,[id,v])=>s+Math.max(0,v)*iw(id),0),0))}</b><i>جم</i></div></div>
  <section class="panel"><h3>محجوز – مستني التسليم</h3>`;
  if(!open.length)h+=`<div class="empty">مفيش طلبات محجوزة.</div>`;
  for(const o of open){const ls=Object.entries(o.lines).filter(([,v])=>v>0);
    h+=`<div class="order"><div class="mh"><span class="chip gold">طلب ${esc(o.order)}</span><b>${BR[o.branch]}</b>${o.cust?`<span>${esc(o.cust)}</span>`:""}<span class="muted small" style="margin-inline-start:auto">من ${fdate(o.date)}</span></div>
    <div class="ml">${ls.map(([id,v])=>`<b>${esc(iname(id))}</b> × ${fmt(v)}`).join("، ")} <span class="muted small">(${fmt(ls.reduce((a,[id,v])=>a+v*iw(id),0))} جم)</span></div>
    ${act?`<div class="row" data-obox="${esc(o.key)}">${appOpenAct===o.key+"|del"?`<div class="form pay" style="flex:1"><label>رقم الإذن<input id="od_inv"></label><label>كاش<input type="number" step="any" min="0" id="od_cash"></label><label>بنك<input type="number" step="any" min="0" id="od_bank"></label><label>شبكة<input type="number" step="any" min="0" id="od_card"></label></div><button class="btn gold" data-odel="${esc(o.key)}">تأكيد التسليم</button><button class="btn" data-ocl>رجوع</button>`
      :appOpenAct===o.key+"|can"?`<span class="small">إلغاء الحجز يرجّع الأصناف للخزنة الفرعية. متأكد؟</span><button class="btn danger" data-ocan="${esc(o.key)}">أيوه، الغي الحجز</button><button class="btn" data-ocl>لا</button>`
      :`<button class="btn gold sm" data-oa="${esc(o.key)}|del">تم التسليم</button><button class="btn sm" data-oa="${esc(o.key)}|can">إلغاء الحجز</button>`}</div>`:""}</div>`}
  h+=`</section><section class="panel"><h3>آخر الطلبات المقفولة</h3>`;
  h+=done.length?done.map(o=>`<div class="order done"><div class="mh"><span class="chip ${o.cancelled&&!o.delivered?"bad":"ok"}">${o.cancelled&&!o.delivered?"اتلغى":"اتسلّم"}</span><b>طلب ${esc(o.order)}</b><span>${BR[o.branch]}</span>${o.cust?`<span>${esc(o.cust)}</span>`:""}<span class="muted small" style="margin-inline-start:auto">${fdate(o.moves.reduce((a,m)=>m.date>a?m.date:a,o.date))}</span></div></div>`).join(""):`<div class="empty small">لسه مفيش.</div>`;
  h+=`</section><p class="muted small">إيداعات الأبلكيشن (الفلوس اللي العميل بيدفعها مقدم) بتتسجل من «الخزينة» ← إيداع ← «إيداع ابلكيشن».</p>`;
  return h;
}
function bApp(){
  $("#ap_new")&&($("#ap_new").onclick=()=>{S.draft=Object.assign(freshDraft(),{type:"app_res"});location.hash="new"});
  document.querySelectorAll("[data-oa]").forEach(b=>b.onclick=()=>{appOpenAct=b.dataset.oa;render()});
  document.querySelectorAll("[data-ocl]").forEach(b=>b.onclick=()=>{appOpenAct=null;render()});
  const act=(key,type)=>{const o=orders().find(x=>x.key===key);if(!o)return;
    const lines=Object.entries(o.lines).filter(([,v])=>v>0).map(([item,qty])=>({item,qty}));
    const d={branch:o.branch,type,lines,date:today(),order:o.order,cust:o.cust,note:""};
    if(type==="app_del"){d.inv=$("#od_inv").value;d.cash=$("#od_cash").value;d.bank=$("#od_bank").value;d.card=$("#od_card").value}
    const r=buildMove(d);if(r.err){toast(r.err);return}
    writeDoc("moves",r.m,type==="app_del"?"اتسجل التسليم ✓":"اتلغى الحجز");appOpenAct=null;render()};
  document.querySelectorAll("[data-odel]").forEach(b=>b.onclick=()=>act(b.dataset.odel,"app_del"));
  document.querySelectorAll("[data-ocan]").forEach(b=>b.onclick=()=>act(b.dataset.ocan,"app_cancel"));
}

/* ---------- CASH BOX ---------- */
const CS={kind:"out",month:null,draft:{cat:"",desc:"",amount:"",date:null,branch:null}};
function vCash(){
  if(!CS.month)CS.month=today().slice(0,7);const d=CS.draft;if(!d.date)d.date=today();if(!d.branch||!allowedBranches().includes(d.branch))d.branch=bsel()[0];
  const cats=CASH_CATS[CS.kind];if(!cats.includes(d.cat))d.cat=cats[0];
  let h=`<div class="head"><h2>الخزينة (الكاش)</h2><button class="btn sm" id="exCash">تحميل Excel</button></div>`;
  if(showMoney()){h+=`<div class="kpis">`;for(const b of bsel())h+=`<div class="kpi"><span>رصيد الكاش – ${BR[b]}</span><b>${fmt(cashBal(b))}</b><i>ريال سعودي</i></div>`;h+=`</div>`}
  if(can("cash"))h+=`<section class="panel"><h3>تسجيل إيداع أو سحب</h3>
  <div class="row"><div class="seg2" role="group" aria-label="النوع"><button data-ck="in" aria-pressed="${CS.kind==="in"}">إيداع (داخل)</button><button data-ck="out" aria-pressed="${CS.kind==="out"}">سحب / مصروف (خارج)</button></div>
  ${allowedBranches().length>1?`<div class="seg2" role="group" aria-label="الفرع">${allowedBranches().map(b=>`<button data-cb="${b}" aria-pressed="${d.branch===b}">${BR[b]}</button>`).join("")}</div>`:""}</div>
  <div class="form"><label>البند<select id="c_cat">${cats.map(c=>`<option ${c===d.cat?"selected":""}>${c}</option>`).join("")}</select></label>
  <label>المبلغ (ر.س)<input type="number" inputmode="decimal" step="any" min="0" id="c_amt" value="${esc(d.amount)}"></label>
  <label>التاريخ<input type="date" id="c_date" value="${d.date}"></label>
  <label style="grid-column:1/-1">البيان<input id="c_desc" value="${esc(d.desc)}" placeholder="${CS.kind==="in"?"مثلاً: ايداع ابلكيشن عميل رقم (113808)":"مثلاً: راتب بيشوي ايمن"}"></label></div>
  <div id="c_err"></div><div class="row"><button class="btn gold" id="c_save">حفظ</button></div></section>`;
  h+=`<section class="daynav"><button class="btn" id="cm_prev">‹ الشهر اللي قبله</button><div class="dayc"><b>${fmonth(CS.month)}</b></div><button class="btn" id="cm_next" ${CS.month>=today().slice(0,7)?"disabled":""}>الشهر اللي بعده ›</button></section>
  <div id="cashBody"><div class="empty">جاري التحميل…</div></div>`;
  return h;
}
let cashRows=[];
function bCash(){
  const d=CS.draft;const keep=()=>{const g=id=>$("#"+id);if(!g("c_cat"))return;d.cat=g("c_cat").value;d.amount=g("c_amt").value;d.date=g("c_date").value;d.desc=g("c_desc").value};
  document.querySelectorAll("[data-ck]").forEach(b=>b.onclick=()=>{keep();CS.kind=b.dataset.ck;render()});
  document.querySelectorAll("[data-cb]").forEach(b=>b.onclick=()=>{keep();d.branch=b.dataset.cb;render()});
  ["c_cat","c_amt","c_date","c_desc"].forEach(id=>{const e=$("#"+id);if(e)e.oninput=keep});
  $("#c_save")&&($("#c_save").onclick=()=>{keep();const a=Number(d.amount);const e=$("#c_err");
    if(!(a>0))return e.innerHTML=`<div class="note bad">اكتب المبلغ.</div>`;
    if(!d.date)return e.innerHTML=`<div class="note bad">اختار التاريخ.</div>`;
    writeDoc("cash",{date:d.date,ts:Date.now(),branch:d.branch,kind:CS.kind,cat:d.cat,desc:d.desc.trim(),amount:a,by:S.email,emp:myName(),void:false},CS.kind==="in"?"اتسجل الإيداع ✓":"اتسجل السحب ✓");
    CS.draft={cat:d.cat,desc:"",amount:"",date:d.date,branch:d.branch};render()});
  $("#cm_prev").onclick=()=>{CS.month=addMonths(CS.month,-1);render()};
  $("#cm_next").onclick=()=>{CS.month=addMonths(CS.month,1);render()};
  (async()=>{const box=$("#cashBody");const from=CS.month+"-01",to=monthEnd(CS.month);let list,mv;
    try{[list,mv]=await Promise.all([cashInRange(from,to),movesInRange(from,to)])}catch(e){box.innerHTML=`<div class="note bad">ما قدرناش نجيب الشهر ده (محتاج إنترنت).</div>`;return}
    if(!$("#cashBody"))return;
    const bs=bsel();list=list.filter(c=>bs.includes(c.branch));mv=mv.filter(m=>!m.void&&bs.includes(m.branch)&&T[m.type]?.pay&&m.pay);
    let tin=0,tout=0;for(const c of list){if(c.void)continue;if(c.kind==="in")tin+=c.amount;else tout+=c.amount}
    let sc=0,sb=0,sk=0,bc=0;for(const m of mv){const p=T[m.type].pay;if(p>0){sc+=m.pay.cash||0;sb+=m.pay.bank||0;sk+=m.pay.card||0}else bc+=m.pay.cash||0}
    let h=showMoney()?`<div class="kpis"><div class="kpi"><span>إيداعات الشهر</span><b>${fmt(tin)}</b><i>ر.س</i></div><div class="kpi bad"><span>سحب ومصروفات الشهر</span><b>${fmt(tout)}</b><i>ر.س</i></div>
      <div class="kpi"><span>مبيعات كاش</span><b>${fmt(sc)}</b><i>بنك ${fmt(sb)} · شبكة ${fmt(sk)}</i></div><div class="kpi warn"><span>كاش خارج (شراء/مرتجع)</span><b>${fmt(bc)}</b><i>ر.س</i></div></div>`:"";
    cashRows=[["التاريخ","الفرع","النوع","البند","البيان","المبلغ","الموظف","الحالة"]];
    h+=`<section class="panel"><h3>الإيداعات والسحوبات – ${fmonth(CS.month)}</h3>`;
    if(!list.length)h+=`<div class="empty">مفيش إيداعات أو سحوبات في الشهر ده.</div>`;
    else{h+=`<div class="tbl-wrap"><table><thead><tr><th>التاريخ</th><th>الفرع</th><th>النوع</th><th class="name">البند</th><th class="name">البيان</th><th>المبلغ</th><th>الموظف</th><th></th></tr></thead><tbody>`;
      for(const c of list.sort((a,b)=>a.date<b.date?1:a.date>b.date?-1:b.ts-a.ts)){const ok=can("edit")&&!(S.closing&&c.ts<=S.closing.ts);
        h+=`<tr class="${c.void?"voidrow":""}"><td>${fdate(c.date)}</td><td>${BR[c.branch]}</td><td><span class="chip ${c.kind==="in"?"ok":"bad"}">${c.kind==="in"?"إيداع":"سحب"}</span></td><td class="name">${esc(c.cat)}</td><td class="name">${esc(c.desc)}</td><td><b>${fmt(c.amount)}</b></td><td>${esc(c.emp||nameOf(c.by))}</td><td>${ok?(c.void?`<button class="btn xs" data-cr="${c.id}">استرجاع</button>`:`<button class="btn xs danger" data-cv="${c.id}">تراجع</button>`):(c.void?'<span class="chip bad">ملغي</span>':"")}</td></tr>`;
        cashRows.push([fdate(c.date),BR[c.branch],c.kind==="in"?"إيداع":"سحب",c.cat,c.desc,c.amount,c.emp||nameOf(c.by),c.void?"ملغي":""])}
      h+=`</tbody></table></div>`}
    box.innerHTML=h+`</section>`;
    const upd=(id,v)=>db.collection("cash").doc(id).update({void:v,voidBy:S.email,voidAt:Date.now()}).then(()=>{toast(v?"اتراجع":"اترجع");render()}).catch(e=>toast(errText(e)));
    document.querySelectorAll("[data-cv]").forEach(b=>b.onclick=()=>{if(b.dataset.sure)upd(b.dataset.cv,true);else{b.dataset.sure=1;b.textContent="متأكد؟"}});
    document.querySelectorAll("[data-cr]").forEach(b=>b.onclick=()=>upd(b.dataset.cr,false));
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
      h+=`<div class="kpi"><span>مبيعات ${BR[b]}</span><b>${fmt(g)}</b><i>جرام${showMoney()?" · "+sar(money):""}</i></div>`}
    if(showMoney()){let pc=0,pb=0,pk=0;sales.forEach(m=>{const s=T[m.type].pay||0;pc+=s*(m.pay?.cash||0);pb+=s*(m.pay?.bank||0);pk+=s*(m.pay?.card||0)});
      h+=`<div class="kpi"><span>كاش</span><b>${fmt(pc)}</b><i>ر.س</i></div><div class="kpi"><span>بنك</span><b>${fmt(pb)}</b><i>ر.س</i></div><div class="kpi"><span>شبكة</span><b>${fmt(pk)}</b><i>ر.س</i></div>`}
    h+=`<div class="kpi"><span>عدد الفواتير</span><b>${sales.length}</b><i>عملية بيع</i></div></div>`;
    const sum={};for(const m of sales)for(const ln of m.lines){const k=ln.item;sum[k]=sum[k]||{p:0,b:{}};const v=T[m.type].sale*ln.qty;sum[k].p+=v;sum[k].b[m.branch]=(sum[k].b[m.branch]||0)+v}
    const items=Object.keys(sum).sort((a,b)=>iw(a)-iw(b));
    arRows=[["التاريخ","الوقت","الفرع","الحركة","رقم الإذن","العميل","الصنف","العدد","الوزن (جم)","كاش","بنك","شبكة","الموظف","ملاحظات","الحالة"]];
    if(AR.kind==="sales"){
      h+=`<section class="panel"><h3>اتباع إيه</h3>`;
      if(!items.length)h+=`<div class="empty">مفيش مبيعات متسجلة يوم ${fdate(AR.day)}.</div>`;
      else{h+=`<div class="tbl-wrap"><table><thead><tr><th class="name">الصنف</th>${bs.map(b=>`<th>${BR[b]}</th>`).join("")}<th>الإجمالي</th><th>الجرام</th></tr></thead><tbody>`;
        let tg=0;for(const k of items){const r=sum[k];tg+=r.p*iw(k);h+=`<tr><td class="name"><b>${esc(iname(k))}</b></td>${bs.map(b=>`<td>${fmt(r.b[b]||0)}</td>`).join("")}<td><b>${fmt(r.p)}</b></td><td>${fmt(r.p*iw(k))}</td></tr>`}
        h+=`<tr class="tot"><td class="name">الإجمالي</td>${bs.map(()=>"<td></td>").join("")}<td></td><td>${fmt(tg)}</td></tr></tbody></table></div>`}
      h+=`</section>`;
    }
    const shown=AR.kind==="sales"?list.filter(m=>T[m.type]?.sale):list;
    h+=`<section class="panel"><h3>${AR.kind==="sales"?"الفواتير بالتفصيل":"كل حركات اليوم"} <span class="muted small">(${shown.length})</span></h3>`;
    h+=shown.length?`<div class="moves">${shown.map(moveCard).join("")}</div>`:`<div class="empty">مفيش حركات.</div>`;
    h+=`</section>`;
    if(cash.length&&canSee("cash"))h+=`<section class="panel"><h3>الخزينة في اليوم ده</h3>${cash.map(c=>`<div class="alert"><span class="chip ${c.kind==="in"?"ok":"bad"}">${c.kind==="in"?"إيداع":"سحب"}</span><div class="t">${esc(c.cat)} – ${esc(c.desc)} <span class="muted small">· ${BR[c.branch]}</span></div><b>${sar(c.amount)}</b></div>`).join("")}</section>`;
    for(const m of shown)m.lines.forEach((ln,i)=>arRows.push([fdate(m.date),ftime(m.ts),BR[m.branch],T[m.type]?.l||m.type,m.inv||"",m.cust||"",iname(ln.item),ln.qty,Math.round(lineG(ln)*100)/100,i?"":(m.pay?.cash||""),i?"":(m.pay?.bank||""),i?"":(m.pay?.card||""),m.emp||nameOf(m.by),m.note||"",m.void?"ملغاة":""]));
    box.innerHTML=h;LOGSTATE.list=list;bindMoveActions();
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
    let pc=0,pb=0,pk=0,buyCash=0,retCash=0;for(const m of inM){if(!bs.includes(m.branch)||!m.pay)continue;const p=T[m.type]?.pay;if(p>0){pc+=m.pay.cash||0;pb+=m.pay.bank||0;pk+=m.pay.card||0}else if(p<0){if(m.type==="buy")buyCash+=m.pay.cash||0;else retCash+=m.pay.cash||0}}
    const byCat={in:{},out:{}};let cin=0,cout=0;for(const c of cIn){if(c.void||!bs.includes(c.branch))continue;byCat[c.kind][c.cat]=(byCat[c.kind][c.cat]||0)+c.amount;if(c.kind==="in")cin+=c.amount;else cout+=c.amount}
    let cashEnd=0;for(const b of bs)cashEnd+=cashBal(b)-cashEffects(cAfter,b)-moveCash(after,b);
    const cashStart=cashEnd-(pc-buyCash-retCash+cin-cout);
    let h=`<div class="grid2"><section class="panel"><h3>رصيد الدهب (عيار 24 – جرام)</h3><div class="sumtbl">
      <div><span>رصيد أول الشهر</span><b>${fmt(S24.start)}</b></div><div><span>الوارد</span><b class="pos">+ ${fmt(T24.in)}</b></div><div><span>شراء من عملاء</span><b class="pos">+ ${fmt(T24.buy)}</b></div>
      <div><span>المنصرف</span><b class="neg">− ${fmt(T24.out)}</b></div><div><span>المبيعات</span><b class="neg">− ${fmt(T24.sale)}</b></div>${T24.adj?`<div><span>تسويات جرد</span><b>${T24.adj>0?"+ ":"− "}${fmt(Math.abs(T24.adj))}</b></div>`:""}
      <div class="end"><span>رصيد آخر الشهر</span><b>${fmt(S24.end)}</b></div></div></section>`;
    if(showMoney())h+=`<section class="panel"><h3>الكاش (ريال)</h3><div class="sumtbl">
      <div><span>رصيد أول الشهر</span><b>${fmt(cashStart)}</b></div><div><span>مبيعات كاش</span><b class="pos">+ ${fmt(pc)}</b></div>
      ${Object.entries(byCat.in).map(([k,v])=>`<div><span>${esc(k)}</span><b class="pos">+ ${fmt(v)}</b></div>`).join("")}
      ${buyCash?`<div><span>شراء كاش</span><b class="neg">− ${fmt(buyCash)}</b></div>`:""}${retCash?`<div><span>مرتجعات كاش</span><b class="neg">− ${fmt(retCash)}</b></div>`:""}
      ${Object.entries(byCat.out).map(([k,v])=>`<div><span>${esc(k)}</span><b class="neg">− ${fmt(v)}</b></div>`).join("")}
      <div class="end"><span>رصيد آخر الشهر</span><b>${fmt(cashEnd)}</b></div></div>
      <p class="muted small">المبيعات بالبنك ${fmt(pb)} وبالشبكة ${fmt(pk)} – إجمالي مبيعات الشهر <b>${sar(pc+pb+pk)}</b> (البنك والشبكة مش بيدخلوا الكاش).</p></section>`;
    h+=`</div>`;
    const hasAdj=Object.values(col).some(c=>c.adj);
    h+=`<section class="panel"><h3>الاستوك – ${fmonth(MS.month)}</h3><div class="tbl-wrap"><table><thead><tr><th class="name">الصنف</th><th>العيار</th><th>الوزن</th><th>أول الشهر</th><th>الوارد</th><th>شراء</th><th>منصرف</th><th>بيع</th>${hasAdj?"<th>تسوية</th>":""}<th>المتبقي</th><th>عيار 24</th></tr></thead><tbody>`;
    monthRows=[["الصنف","العيار","الوزن","أول الشهر","الوارد","شراء","منصرف","بيع","تسوية","المتبقي","عيار 24"]];
    const tt={start:0,in:0,buy:0,out:0,sale:0,adj:0,end:0};
    for(const it of [...S.items].sort((a,b)=>iw(a.id)-iw(b.id))){const c=col[it.id];if(!start[it.id]&&!end[it.id]&&!C.some(k=>c[k]))continue;
      h+=`<tr><td class="name"><b>${esc(it.name)}</b></td><td>${ik(it.id)}</td><td>${it.unit==="g"?"بالوزن":fmt(it.weight)}</td><td>${fmt(start[it.id])}</td><td>${fmt(c.in)}</td><td>${fmt(c.buy)}</td><td>${fmt(c.out)}</td><td>${fmt(c.sale)}</td>${hasAdj?`<td>${fmt(c.adj)}</td>`:""}<td><b>${fmt(end[it.id])}</b></td><td>${fmt(g24(it.id,end[it.id]))}</td></tr>`;
      if(it.unit!=="g"){tt.start+=start[it.id];tt.in+=c.in;tt.buy+=c.buy;tt.out+=c.out;tt.sale+=c.sale;tt.adj+=c.adj;tt.end+=end[it.id]}
      monthRows.push([it.name,ik(it.id),it.unit==="g"?"بالوزن":it.weight,start[it.id],c.in,c.buy,c.out,c.sale,c.adj,end[it.id],Math.round(g24(it.id,end[it.id])*100)/100])}
    h+=`<tr class="tot"><td class="name">الإجمالي (قطع)</td><td></td><td></td><td>${fmt(tt.start)}</td><td>${fmt(tt.in)}</td><td>${fmt(tt.buy)}</td><td>${fmt(tt.out)}</td><td>${fmt(tt.sale)}</td>${hasAdj?`<td>${fmt(tt.adj)}</td>`:""}<td>${fmt(tt.end)}</td><td>${fmt(S24.end)}</td></tr></tbody></table></div></section>`;
    monthRows.push([],["رصيد الدهب عيار 24 أول الشهر",S24.start],["الوارد",T24.in],["شراء",T24.buy],["المنصرف",T24.out],["المبيعات",T24.sale],["رصيد آخر الشهر",S24.end]);
    if(showMoney())monthRows.push([],["الكاش أول الشهر",cashStart],["مبيعات كاش",pc],["مبيعات بنك",pb],["مبيعات شبكة",pk],["إيداعات",cin],["سحب ومصروفات",cout],["شراء كاش",buyCash],["مرتجعات كاش",retCash],["الكاش آخر الشهر",cashEnd]);
    box.innerHTML=h;
  })();
}

/* ---------- LOG (professional journal: filter, search, edit, undo, restore) ---------- */
const LOGSTATE={from:null,to:null,type:"",item:"",status:"",q:"",page:0,list:[],custMode:null,reload:()=>{}};
const PAGE=50;
function vLog(){
  const L=LOGSTATE;if(!L.from){L.from=monthStart();L.to=today()}
  const groups={};for(const [k,v] of Object.entries(T))(groups[v.g]=groups[v.g]||[]).push([k,v]);
  return `<div class="head"><h2>سجل الحركات</h2><button class="btn sm" id="exLog">تحميل Excel</button></div>
  <section class="toolbar">
    <label class="grow">بحث<input id="l_q" value="${esc(L.q)}" placeholder="اسم العميل، رقم الإذن، رقم الطلب، موبايل، ملاحظة…"></label>
    <label>من<input type="date" id="l_from" value="${L.from}"></label><label>إلى<input type="date" id="l_to" value="${L.to}"></label>
    <label>النوع<select id="l_type"><option value="">كل الحركات</option><option value="@sale" ${L.type==="@sale"?"selected":""}>المبيعات والمرتجعات</option>${Object.entries(groups).map(([g,a])=>`<optgroup label="${g}">${a.map(([k,v])=>`<option value="${k}" ${L.type===k?"selected":""}>${v.l}</option>`).join("")}</optgroup>`).join("")}</select></label>
    <label>الصنف<select id="l_item"><option value="">كل الأصناف</option>${S.items.map(i=>`<option value="${i.id}" ${L.item===i.id?"selected":""}>${esc(i.name)}</option>`).join("")}</select></label>
    <label>الحالة<select id="l_st"><option value="">الكل</option><option value="ok" ${L.status==="ok"?"selected":""}>سارية</option><option value="void" ${L.status==="void"?"selected":""}>ملغاة / متعدّلة</option></select></label>
  </section>
  ${L.custMode?`<div class="note info">بتعرض <b>كل فواتير العميل «${esc(L.custMode)}»</b> من أول ما اتسجل. <button class="btn sm" id="l_custx">رجوع للسجل العادي</button></div>`:""}
  <div id="logBody"><div class="empty">جاري التحميل…</div></div>`;
}
function logRowMatch(m){const L=LOGSTATE;
  if(!(bsel().includes(m.branch)||bsel().includes(m.to)))return false;
  if(L.type==="@sale"){if(!T[m.type]?.sale)return false}else if(L.type&&m.type!==L.type)return false;
  if(L.item&&!m.lines.some(l=>l.item===L.item))return false;
  if(L.status==="ok"&&m.void)return false;if(L.status==="void"&&!m.void)return false;
  if(L.q){const s=custKey(L.q);const hay=custKey([m.cust,m.inv,m.order,m.phone,m.note,m.emp,m.lines.map(l=>iname(l.item)).join(" ")].join(" "));if(!hay.includes(s))return false}
  return true;}
function bLog(){
  const L=LOGSTATE;
  const fill=async()=>{const box=$("#logBody");if(!box)return;let raw;
    try{raw=L.custMode?(await db.collection("moves").where("custKey","==",custKey(L.custMode)).get()).docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>b.ts-a.ts):await movesInRange(L.from,L.to)}
    catch(e){box.innerHTML=`<div class="note bad">ما قدرناش نجيب الحركات (محتاج إنترنت). ${esc(errText(e))}</div>`;return}
    if(!$("#logBody"))return;
    L.list=raw;const list=raw.filter(logRowMatch);L.shown=list;
    let sg=0,sm=0,nInv=0;for(const m of list){if(m.void||!T[m.type]?.sale)continue;nInv++;const s=T[m.type].sale;m.lines.forEach(ln=>sg+=s*lineG(ln));sm+=s*payTotal(m.pay)}
    const pages=Math.max(1,Math.ceil(list.length/PAGE));if(L.page>=pages)L.page=pages-1;const slice=list.slice(L.page*PAGE,(L.page+1)*PAGE);
    const custHit=L.q&&!L.custMode&&knownCustomers().find(c=>custKey(c).includes(custKey(L.q)));
    let h=`<div class="logsum"><span><b>${list.length}</b> حركة</span><span><b>${nInv}</b> فاتورة بيع</span><span>مبيعات <b>${fmt(sg)}</b> جم</span>${showMoney()?`<span>بقيمة <b>${sar(sm)}</b></span>`:""}
      ${custHit?`<button class="btn sm" id="l_cust" data-c="${esc(custHit)}">كل فواتير «${esc(custHit)}» من الأول</button>`:""}</div>`;
    if(!list.length){box.innerHTML=h+`<div class="empty">مفيش حركات مطابقة.</div>`;bindTop();return}
    h+=`<div class="tbl-wrap journal"><table><thead><tr><th>التاريخ</th><th>النوع</th><th>الفرع</th><th>الإذن / الطلب</th><th class="name">العميل</th><th class="name">الأصناف</th><th>الجرام</th>${showMoney()?"<th>المبلغ</th>":""}<th>الموظف</th><th>الحالة</th><th></th></tr></thead><tbody>`;
    for(const m of slice){const g=m.lines.reduce((s,ln)=>s+Math.abs(lineG(ln)),0);const pt=payTotal(m.pay);
      h+=`<tr class="${m.void?"voidrow":""}"><td class="nowrap">${fdateShort(m.date)}<br><span class="muted small">${ftime(m.ts)}</span></td><td>${typeChip(m)}</td><td class="nowrap">${BR[m.branch]||""}${m.to?" ← "+BR[m.to]:""}</td>
        <td>${m.inv?esc(m.inv):""}${m.order?`<span class="muted small">طلب ${esc(m.order)}</span>`:""}</td><td class="name">${m.cust?`<a href="#log" class="custlink" data-c="${esc(m.cust)}">${esc(m.cust)}</a>${m.phone?`<br><span class="muted small" dir="ltr">${esc(m.phone)}</span>`:""}`:""}</td>
        <td class="name wrap">${lineSummary(m)}${m.note?`<div class="muted small">${esc(m.note)}</div>`:""}</td><td>${fmt(g)}</td>${showMoney()?`<td>${pt?`<b>${fmt(pt)}</b><div class="muted small">${[m.pay.cash?"كاش "+fmt(m.pay.cash):"",m.pay.bank?"بنك "+fmt(m.pay.bank):"",m.pay.card?"شبكة "+fmt(m.pay.card):""].filter(Boolean).join(" · ")}</div>`:""}</td>`:""}
        <td>${esc(m.emp||nameOf(m.by))}</td><td>${m.void?`<span class="chip bad">${m.replacedBy?"اتعدّلت":"اتلغت"}</span>`:m.editOf?'<span class="chip plain">معدّلة</span>':'<span class="chip ok">سارية</span>'}</td>
        <td class="nowrap"><div class="acts" data-abox="${m.id}">${moveActions(m)}</div></td></tr>`}
    h+=`</tbody></table></div>`;
    if(pages>1)h+=`<div class="row pager"><button class="btn sm" id="pg_prev" ${L.page?"":"disabled"}>‹ السابق</button><span class="muted small">صفحة ${L.page+1} من ${pages}</span><button class="btn sm" id="pg_next" ${L.page<pages-1?"":"disabled"}>التالي ›</button></div>`;
    box.innerHTML=h;bindTop();bindMoveActions();
    $("#pg_prev")&&($("#pg_prev").onclick=()=>{L.page--;fill()});$("#pg_next")&&($("#pg_next").onclick=()=>{L.page++;fill()});
    document.querySelectorAll(".custlink").forEach(a=>a.onclick=e=>{e.preventDefault();L.custMode=a.dataset.c;L.page=0;render()});
  };
  const bindTop=()=>{$("#l_cust")&&($("#l_cust").onclick=()=>{L.custMode=$("#l_cust").dataset.c;L.page=0;render()})};
  L.reload=fill;
  const upd=()=>{L.from=$("#l_from").value||monthStart();L.to=$("#l_to").value||today();L.type=$("#l_type").value;L.item=$("#l_item").value;L.status=$("#l_st").value;L.page=0;fill()};
  ["l_from","l_to","l_type","l_item","l_st"].forEach(id=>$("#"+id).onchange=upd);
  let qt;$("#l_q").oninput=e=>{clearTimeout(qt);qt=setTimeout(()=>{L.q=e.target.value.trim();L.page=0;fill()},250)};
  $("#l_custx")&&($("#l_custx").onclick=()=>{L.custMode=null;render()});
  fill();
  $("#exLog").onclick=()=>{const list=L.shown||[];const rows=[["التاريخ","الوقت","الفرع","نوع الحركة","رقم الإذن","رقم الطلب","العميل","موبايل","الفرع المستلم","المكان","الصنف","العدد","الوزن (جم)","كاش","بنك","شبكة","الموظف","ملاحظات","الحالة"]];
    for(const m of list)m.lines.forEach((ln,i)=>rows.push([fdate(m.date),ftime(m.ts),BR[m.branch],T[m.type]?.l||m.type,m.inv||"",m.order||"",m.cust||"",m.phone||"",m.to?BR[m.to]:"",ln.loc?LOC[ln.loc]:"",iname(ln.item),ln.qty,Math.round(lineG(ln)*100)/100,i?"":(m.pay?.cash||""),i?"":(m.pay?.bank||""),i?"":(m.pay?.card||""),m.emp||nameOf(m.by),m.note||"",m.void?(m.replacedBy?"اتعدّلت":"اتلغت"):"سارية"]));
    saveCsv(`سجل_الحركات_${L.custMode?custKey(L.custMode):L.from+"_"+L.to}.csv`,rows)};
}

/* ---------- COUNT ---------- */
function vCount(){
  const c=S.countSel;if(!allowedBranches().includes(c.b))c.b=bsel()[0];if(S.branch!=="all")c.b=bsel()[0];const bal=balances();
  let h=`<div class="head"><h2>الجرد الفعلي</h2><span class="muted small">اكتب العدد اللي لقيته فعلاً – الفرق بيتسجل «تسوية جرد» لوحده</span></div>
  <section class="panel"><div class="form"><label>الفرع<select id="c_b">${allowedBranches().map(b=>`<option value="${b}" ${c.b===b?"selected":""}>${BR[b]}</option>`).join("")}</select></label>
  <label>المكان<select id="c_loc">${VAULTS.map(l=>`<option value="${l}" ${c.loc===l?"selected":""}>${LOC[l]}</option>`).join("")}</select></label></div>
  <div class="tbl-wrap"><table><thead><tr><th class="name">الصنف</th><th>رصيد السيستم</th><th>العدد الفعلي</th><th>الفرق</th></tr></thead><tbody>`;
  let diffs=0;
  for(const it of activeItems()){const sys=q(bal,c.b,c.loc,it.id);const v=c.vals[it.id];const has=v!==undefined&&v!=="";const df=has?Number(v)-sys:0;if(has&&df)diffs++;
    h+=`<tr><td class="name"><b>${esc(it.name)}</b>${it.unit==="g"?' <span class="muted small">(جم)</span>':""}</td><td>${fmt(sys)}</td><td style="width:120px"><input type="number" inputmode="decimal" min="0" step="${it.unit==="g"?"any":"1"}" data-cv="${it.id}" value="${esc(v??"")}" placeholder="—"></td><td class="${df<0?"neg":""}" data-cd="${it.id}">${has?(df>0?"+":"")+fmt(df):""}</td></tr>`}
  h+=`</tbody></table></div><div id="c_msg"></div>${can("count")?`<div class="row"><button class="btn gold" id="c_save">حفظ الجرد وتسوية الفروقات</button><button class="btn" id="c_clear">مسح الخانات</button><span class="muted small" id="c_cnt">${diffs} صنف فيهم فرق</span></div>`:`<p class="muted small">حسابك يقدر يشوف الجرد بس، من غير ما يسجّل تسوية.</p>`}</section>`;
  return h;
}
function bCount(){
  const c=S.countSel;
  $("#c_b").onchange=e=>{c.b=e.target.value;c.vals={};render()};$("#c_loc").onchange=e=>{c.loc=e.target.value;c.vals={};render()};
  document.querySelectorAll("[data-cv]").forEach(inp=>inp.oninput=()=>{c.vals[inp.dataset.cv]=inp.value;const bal=balances();const sys=q(bal,c.b,c.loc,inp.dataset.cv);
    const cell=document.querySelector(`[data-cd="${inp.dataset.cv}"]`);if(inp.value===""){cell.textContent="";return}const df=Number(inp.value)-sys;cell.textContent=(df>0?"+":"")+fmt(df);cell.className=df<0?"neg":"";
    const cnt=$("#c_cnt");if(cnt)cnt.textContent=Object.keys(c.vals).filter(k=>c.vals[k]!==""&&Number(c.vals[k])-q(bal,c.b,c.loc,k)!==0).length+" صنف فيهم فرق"});
  if(!$("#c_save"))return;
  $("#c_clear").onclick=()=>{c.vals={};render()};
  $("#c_save").onclick=()=>{const bal=balances();const lines=[];
    for(const [id,v] of Object.entries(c.vals)){if(v==="")continue;const n=Number(v);if(!Number.isFinite(n)||n<0||(!isG(id)&&!Number.isInteger(n))){$("#c_msg").innerHTML=`<div class="note bad">العدد الفعلي لازم يكون رقم صحيح من صفر وطالع («${esc(iname(id))}»).</div>`;return}
      const df=Math.round((n-q(bal,c.b,c.loc,id))*1000)/1000;if(df)lines.push({item:id,qty:df,loc:c.loc})}
    if(!lines.length){$("#c_msg").innerHTML=`<div class="note info">مفيش فروقات – الجرد مطابق للسيستم.</div>`;return}
    writeDoc("moves",{date:today(),ts:Date.now(),branch:c.b,type:"adjust",lines,note:`جرد ${LOC[c.loc]}`,emp:myName(),by:S.email,void:false},`اتسجلت تسوية لـ ${lines.length} صنف`);
    c.vals={};render()};
}

/* ---------- SETTINGS (owner only) ---------- */
let importData=null;const UE={edit:null};
function permBoxes(prefix,u){const p=u?.perms||DEFAULT_PERMS;const br=u?.branches||BKEYS;
  return `<div class="permgrid"><div><h4>يشوف الشاشات دي</h4>${SCREENS.map(([k,l])=>`<label class="chk"><input type="checkbox" data-${prefix}p="s_${k}" ${p["s_"+k]?"checked":""}> ${l}</label>`).join("")}</div>
  <div><h4>يقدر يعمل</h4>${ACTIONS.map(([k,l])=>`<label class="chk"><input type="checkbox" data-${prefix}p="${k}" ${p[k]?"checked":""}> ${l}</label>`).join("")}</div>
  <div><h4>الفروع</h4>${BKEYS.map(b=>`<label class="chk"><input type="checkbox" data-${prefix}b="${b}" ${br.includes(b)?"checked":""}> ${BR[b]}</label>`).join("")}</div></div>`}
function readPerms(prefix){const perms={};document.querySelectorAll(`[data-${prefix}p]`).forEach(x=>{if(x.checked)perms[x.getAttribute(`data-${prefix}p`)]=true});
  const branches=[...document.querySelectorAll(`[data-${prefix}b]`)].filter(x=>x.checked).map(x=>x.getAttribute(`data-${prefix}b`));return{perms,branches}}
function vItems(){
  if(!isAdmin())return `<div class="note bad">الصفحة دي للمدير بس.</div>`;
  if(!S.itemsDraft)S.itemsDraft=S.items.map(i=>({...i}));
  let h=`<div class="head"><h2>الإعدادات</h2></div>
  <section class="panel"><div class="head"><h3>المستخدمين والصلاحيات</h3></div>
  <p class="small muted">كل موظف بيدخل باسم إنجليزي من كلمتين (زي <b dir="ltr">Ahmed Ali</b>) وكلمة سر. انت بتحدد هو يشوف إيه ويعمل إيه وفي أنهي فرع.</p>
  <div class="tbl-wrap"><table><thead><tr><th class="name">الاسم</th><th class="name">اسم الدخول</th><th>الفروع</th><th class="name">الصلاحيات</th><th>الحالة</th><th></th></tr></thead><tbody>
  <tr><td class="name"><b>${esc(myName())}</b></td><td class="name" dir="ltr">${esc(S.email)}</td><td>الكل</td><td class="name">كل حاجة</td><td><span class="chip gold">المدير</span></td><td></td></tr>
  ${S.users.filter(u=>!S.admins.includes(u.id)).map(u=>`<tr class="${u.active?"":"voidrow"}"><td class="name"><b>${esc(u.name)}</b></td><td class="name" dir="ltr">${esc(u.user||u.id)}</td><td>${(u.branches||[]).map(b=>BR[b]).join("، ")||"—"}</td>
    <td class="name small">${[...SCREENS.filter(([k])=>u.perms?.["s_"+k]).map(([,l])=>l),...ACTIONS.filter(([k])=>u.perms?.[k]).map(([,l])=>l)].join("، ")||"—"}</td>
    <td>${u.active?'<span class="chip ok">شغّال</span>':'<span class="chip bad">موقوف</span>'}</td><td class="nowrap"><button class="btn xs" data-ue="${esc(u.id)}">تعديل</button><button class="btn xs ${u.active?"danger":""}" data-ua="${esc(u.id)}">${u.active?"إيقاف":"تفعيل"}</button></td></tr>
    ${UE.edit===u.id?`<tr><td colspan="6"><div class="useredit"><label>الاسم<input id="ue_name" value="${esc(u.name)}" dir="ltr"></label>${permBoxes("e",u)}<div class="row"><button class="btn gold" id="ue_save">حفظ الصلاحيات</button><button class="btn" id="ue_cancel">إلغاء</button></div></div></td></tr>`:""}`).join("")}
  </tbody></table></div>
  <h4 class="sub">إضافة موظف جديد</h4>
  <div class="form"><label>الاسم الأول (إنجليزي)<input id="u_first" dir="ltr" placeholder="Ahmed" autocomplete="off"></label><label>الاسم التاني (إنجليزي)<input id="u_last" dir="ltr" placeholder="Ali" autocomplete="off"></label><label>كلمة السر (6 على الأقل)<input id="u_pass" dir="ltr" autocomplete="new-password"></label></div>
  ${permBoxes("n",null)}
  <div id="u_msg"></div><div class="row"><button class="btn pri" id="u_add">إضافة الموظف</button></div></section>`;
  h+=`<section class="panel"><div class="head"><h3>قائمة الأصناف</h3><button class="btn sm" id="i_add">+ صنف جديد</button></div>
  <div class="tbl-wrap"><table><thead><tr><th>م</th><th class="name">اسم الصنف</th><th>الوزن (جرام)</th><th>العيار</th><th>بالوزن؟</th><th>حد أدنى للفرعية</th><th>نشط</th></tr></thead><tbody>`;
  S.itemsDraft.forEach((it,i)=>{h+=`<tr><td>${i+1}</td><td style="min-width:200px"><input data-in="${i}" value="${esc(it.name)}"></td>
    <td style="width:110px"><input type="number" step="any" min="0" data-iw="${i}" value="${it.unit==="g"?1:it.weight}" ${it.unit==="g"?"disabled":""}></td>
    <td style="width:100px"><input type="number" step="any" min="0" data-ik="${i}" value="${it.karat??999.9}"></td>
    <td><input type="checkbox" data-iu="${i}" ${it.unit==="g"?"checked":""} style="width:auto" title="الصنف بيتباع بالجرام زي الدهب الخام"></td>
    <td style="width:100px"><input type="number" step="1" min="0" data-im="${i}" value="${it.min??0}"></td><td><input type="checkbox" data-io="${i}" ${it.off?"":"checked"} style="width:auto"></td></tr>`});
  h+=`</tbody></table></div><p class="muted small">«بالوزن» يعني الصنف بيتسجل بالجرام مش بالعدد (زي الدهب الخام). الصنف غير النشط بيختفي من القوائم، بس رصيده وسجله بيفضلوا.</p>
  <div id="i_msg"></div><div class="row"><button class="btn gold" id="i_save">حفظ الأصناف</button><button class="btn" id="i_undo">تراجع</button></div></section>`;
  h+=`<section class="panel"><h3>استيراد بيانات شيت الإكسيل القديم</h3><p class="small">اختار ملف <b>gold-import.json</b>. هيضيف الأصناف الناقصة (زي الدهب الخام) ويحدّث أوزان التولة، وينقل الوارد والمبيعات بالفلوس ورقم الإذن، والمصروفات وإيداعات الأبلكيشن والرصيد الافتتاحي للكاش. البضاعة بتدخل <b>الخزنة الرئيسية – بوابة 2</b>. لو استوردت نفس الملف مرتين، مش هيتكرر حاجة.</p>
  <input type="file" id="imp_file" accept=".json,application/json"><div id="imp_msg">${importData?impSummary(importData):""}</div></section>`;
  const cl=S.closing;
  h+=`<section class="panel"><h3>إقفال الفترة (ترحيل الأرصدة)</h3><p class="small">بيحفظ الأرصدة الحالية (الدهب والكاش) كرصيد بداية عشان البرنامج يفضل سريع مع كتر الحركات. اعمله آخر كل شهر بعد الجرد. الحركات القديمة بتفضل في الأرشيف والملخص، بس مش هتقدر تعدّلها أو تتراجع عنها بعد الإقفال.</p>
  <p class="muted small">${cl?`آخر إقفال: ${fdate(cl.date)}${cl.reset?" (تصفير)":""}`:"لسه ما اتعملش إقفال."} · الحركات المفتوحة دلوقتي: ${S.live.length}</p>
  <div class="confirm" id="cl_box"><button class="btn pri" id="cl_btn">إقفال الفترة الآن</button></div></section>
  <section class="panel danger-zone"><h3>تصفير البرنامج</h3><p class="small">بيخلّي رصيد كل الأصناف في كل الخزن والبترينات <b>صفر</b>، ورصيد الكاش <b>صفر</b>، عشان تبدأ من الأول. الحركات القديمة بتفضل في الأرشيف للرجوع ليها بس مبتأثرش على الأرصدة. الأصناف والموظفين مش بيتمسحوا.</p>
  <div class="confirm" id="rz_box"><button class="btn danger" id="rz_btn">تصفير كل الأرصدة</button></div></section>`;
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
    if(m.pay)doc.pay=m.pay;if(m.inv)doc.inv=m.inv;if(m.cust){doc.cust=m.cust;doc.custKey=custKey(m.cust)}writes.push(["moves",m.id,doc])}
  for(const c of data.cash){if(have.has("cash/"+c.id))continue;writes.push(["cash",c.id,{date:c.date,ts:ts++,branch:c.branch,kind:c.kind,cat:c.cat,desc:c.desc,amount:c.amount,by:S.email,emp:"",void:false,imp:true}])}
  if(!writes.length)return 0;
  for(let i=0;i<writes.length;i+=400){const b=db.batch();for(const [col,id,d] of writes.slice(i,i+400))b.set(db.collection(col).doc(id),d);
    say(`بينقل… ${Math.min(i+400,writes.length)} من ${writes.length}`);await b.commit()}
  return writes.length;
}
function bItems(){
  if(!isAdmin())return;const D=S.itemsDraft;
  // users
  document.querySelectorAll("[data-ue]").forEach(b=>b.onclick=()=>{UE.edit=UE.edit===b.dataset.ue?null:b.dataset.ue;render()});
  document.querySelectorAll("[data-ua]").forEach(b=>b.onclick=()=>{const u=S.users.find(x=>x.id===b.dataset.ua);if(!u)return;
    db.doc("users/"+u.id).update({active:!u.active}).then(()=>toast(u.active?"اتوقف الحساب":"اتفعّل الحساب")).catch(e=>toast(errText(e)))});
  $("#ue_cancel")&&($("#ue_cancel").onclick=()=>{UE.edit=null;render()});
  $("#ue_save")&&($("#ue_save").onclick=()=>{const {perms,branches}=readPerms("e");const name=$("#ue_name").value.trim();
    if(!branches.length){toast("اختار فرع واحد على الأقل.");return}
    db.doc("users/"+UE.edit).update({perms,branches,...(name?{name}:{})}).then(()=>{toast("اتحفظت الصلاحيات ✓");UE.edit=null;render()}).catch(e=>toast(errText(e)))});
  $("#u_add").onclick=async()=>{const first=$("#u_first").value.trim(),last=$("#u_last").value.trim(),pass=$("#u_pass").value;const {perms,branches}=readPerms("n");
    const um=x=>{$("#u_msg").innerHTML=x};
    if(!/^[A-Za-z]{2,}$/.test(first)||!/^[A-Za-z]{2,}$/.test(last))return um(`<div class="note bad">اكتب الاسم الأول والتاني بحروف إنجليزي بس (من غير مسافات أو أرقام).</div>`);
    if(pass.length<6)return um(`<div class="note bad">كلمة السر لازم 6 حروف/أرقام على الأقل.</div>`);
    if(!branches.length)return um(`<div class="note bad">اختار فرع واحد على الأقل.</div>`);
    const cap=s=>s[0].toUpperCase()+s.slice(1).toLowerCase();const name=cap(first)+" "+cap(last);const user=(first+"."+last).toLowerCase();const email=user+"@"+USER_DOMAIN;
    if(S.users.some(u=>u.id===email))return um(`<div class="note bad">الاسم ده موجود بالفعل. لو عايز تعيد تفعيله اضغط «تفعيل» جنبه.</div>`);
    const btn=$("#u_add");btn.disabled=true;btn.textContent="جاري الإضافة…";
    try{
      const sec=firebase.apps.find(a=>a.name==="sec")||firebase.initializeApp(CFG,"sec");
      await sec.auth().createUserWithEmailAndPassword(email,pass);await sec.auth().signOut();
      await db.doc("users/"+email).set({name,user:cap(first)+" "+cap(last),perms,branches,active:true,created:Date.now()});
      toast("اتضاف "+name+" ✓");um(`<div class="note info">ابعت للموظف: اسم الدخول <b dir="ltr">${esc(name)}</b> وكلمة السر اللي كتبتها.</div>`);
      $("#u_first").value="";$("#u_last").value="";$("#u_pass").value="";
    }catch(e){um(`<div class="note bad">${esc(errText(e))}</div>`)}
    btn.disabled=false;btn.textContent="إضافة الموظف";};
  // items
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
  // import
  const bindImp=()=>{const go=$("#imp_go");if(!go)return;go.onclick=async()=>{if(!S.online){$("#imp_msg").innerHTML=`<div class="note warn">الاستيراد محتاج إنترنت.</div>`;return}
    go.disabled=true;const say=t=>{const m=$("#imp_msg");if(m)m.innerHTML=`<div class="note info">${esc(t)}</div>`};
    try{const n=await runImport(importData,say);importData=null;$("#imp_msg").innerHTML=`<div class="note info">${n?`خلص الاستيراد ✓ – اتنقل ${n} سجل. افتح «الملخص الشهري» واتأكد من الأرقام.`:"الملف ده اتنقل قبل كده بالكامل – مفيش حاجة جديدة."}</div>`}
    catch(e){go.disabled=false;$("#imp_msg").innerHTML=`<div class="note bad">الاستيراد وقف: ${esc(e.code?errText(e):e.message)}</div>`}}};
  $("#imp_file").onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const d=JSON.parse(r.result);if(!Array.isArray(d.moves)||!Array.isArray(d.items))throw 0;d.cash=d.cash||[];importData=d;$("#imp_msg").innerHTML=impSummary(d);bindImp()}catch(x){$("#imp_msg").innerHTML=`<div class="note bad">الملف ده مش ملف استيراد صحيح.</div>`}};r.readAsText(f)};
  bindImp();
  // closing & reset
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
  <label>اسم المستخدم<input id="lg_e" dir="ltr" autocomplete="username" placeholder="Ahmed Ali" value="${esc(store.get("gv.lastUser")||"")}"></label>
  <label>كلمة السر<input id="lg_p" type="password" dir="ltr" autocomplete="current-password"></label>
  <div id="lg_msg">${msg?`<div class="note bad">${esc(msg)}</div>`:""}</div>
  <button class="btn gold" id="lg_go">دخول</button>
  <p class="muted small">المدير بيدخل بالإيميل بتاعه. الموظفين بيدخلوا بالاسم الإنجليزي اللي المدير عمله ليهم.</p>
  <details class="first"><summary>أول مرة تشغّل البرنامج؟</summary><p class="small">اكتب إيميلك وكلمة سر جديدة فوق (6 حروف/أرقام على الأقل) واضغط الزرار ده. أول حساب بيتعمل بيبقى هو المدير.</p><button class="btn pri" id="lg_first">إنشاء حساب المدير</button><button class="btn" id="lg_reset">نسيت كلمة السر (للمدير)</button></details></section></div>`;
  const go=async()=>{const raw=$("#lg_e").value.trim(),p=$("#lg_p").value;if(!raw||!p)return;const e=toLoginEmail(raw);
    $("#lg_go").disabled=true;$("#lg_go").textContent="جاري الدخول…";
    try{store.set("gv.lastUser",raw);await auth.signInWithEmailAndPassword(e,p)}
    catch(err){renderLogin(errText(err))}};
  $("#lg_first").onclick=()=>{const e=$("#lg_e").value.trim().toLowerCase(),p=$("#lg_p").value;if(!e.includes("@")||p.length<6){$("#lg_msg").innerHTML=`<div class="note warn">اكتب إيميلك وكلمة سر 6 حروف/أرقام على الأقل.</div>`;return}store.set("gv.lastUser",e);firstRun(e,p)};
  $("#lg_go").onclick=go;$("#lg_p").onkeydown=ev=>{if(ev.key==="Enter")go()};
  $("#lg_reset").onclick=async()=>{const e=$("#lg_e").value.trim();if(!e.includes("@")){$("#lg_msg").innerHTML=`<div class="note warn">اكتب إيميل المدير الأول. الموظفين لو نسيوا كلمة السر، المدير يعملهم حساب جديد.</div>`;return}
    try{await auth.sendPasswordResetEmail(e);$("#lg_msg").innerHTML=`<div class="note info">بعتنالك رسالة على الإيميل لتغيير كلمة السر.</div>`}catch(err){$("#lg_msg").innerHTML=`<div class="note bad">${esc(errText(err))}</div>`}};
}
function firstRun(e,p){
  $("#app").innerHTML=`<section class="panel login"><h2>تجهيز البرنامج لأول مرة</h2><p>هنعمل حساب المدير بالإيميل <b dir="ltr">${esc(e)}</b> وكلمة السر اللي كتبتها، وهنضيف قائمة الأصناف. كل الأرصدة هتبدأ صفر.</p>
  <label>اسمك<input id="fr_n" placeholder="Mina" dir="ltr"></label><div id="fr_msg"></div><button class="btn gold" id="fr_go">إنشاء حساب المدير</button><button class="btn" id="fr_back">رجوع</button></section>`;
  $("#fr_back").onclick=()=>renderLogin();
  $("#fr_go").onclick=async()=>{const n=$("#fr_n").value.trim()||"المدير";$("#fr_go").disabled=true;
    try{S.firstName=n;await auth.createUserWithEmailAndPassword(e,p)}
    catch(err){
      if(String(err.code).includes("email-already-in-use")){try{await auth.signInWithEmailAndPassword(e,p);return}catch(e2){err=e2;if(String(e2.code).match(/invalid-credential|wrong-password/)){$("#fr_go").disabled=false;$("#fr_msg").innerHTML=`<div class="note bad">الإيميل ده عليه حساب بالفعل وكلمة السر مش مطابقة.</div>`;return}}}
      $("#fr_go").disabled=false;$("#fr_msg").innerHTML=`<div class="note bad">${esc(errText(err))}</div>`}};
}
async function bootstrapIfFirst(){
  /* First sign-in ever: this account becomes the owner and the catalog is seeded. Owners from older versions get a profile doc. */
  const ref=db.doc("config/admins");let snap;
  try{snap=await ref.get({source:"server"})}catch(e){return}
  if(snap.exists){
    if((snap.data().emails||[]).includes(S.email)){const me=await db.doc("users/"+S.email).get().catch(()=>null);
      if(me&&!me.exists){let name=S.email.split("@")[0];try{const st=await db.doc("config/staff").get();name=(st.data()?.list||[]).find(x=>x.email===S.email)?.name||name}catch(e){}
        await db.doc("users/"+S.email).set({name,user:S.email,role:"owner",active:true,perms:{},branches:BKEYS}).catch(()=>{})}}
    return}
  await ref.set({emails:[S.email]});
  await db.doc("users/"+S.email).set({name:S.firstName||"المدير",user:S.email,role:"owner",active:true,perms:{},branches:BKEYS});
  const items=DEFAULT_ITEMS.map(([name,weight],i)=>({id:"i"+String(i+1).padStart(2,"0"),name,weight,karat:999.9,min:2}));
  items.push({id:"i31",name:"دهب خام",weight:1,karat:999.9,min:0,unit:"g"});
  await db.doc("config/items").set({items});
  toast("البرنامج جاهز – انت المدير ✓");
}

/* ---------- boot ---------- */
let subs=[];let unsubMoves=null,unsubCash=null,lastTs,unsubUsers=null;
function stopSubs(){subs.forEach(u=>u&&u());subs=[];unsubMoves?.();unsubMoves=null;unsubCash?.();unsubCash=null;unsubUsers?.();unsubUsers=null}
function subLive(){
  unsubMoves?.();unsubCash?.();S.liveLoaded=false;S.cashLoaded=false;
  let qm=db.collection("moves"),qc=db.collection("cash");if(S.closing?.ts){qm=qm.where("ts",">",S.closing.ts);qc=qc.where("ts",">",S.closing.ts)}
  unsubMoves=qm.onSnapshot({includeMetadataChanges:true},snap=>{
    S.live=snap.docs.map(d=>({id:d.id,...d.data(),_pending:d.metadata.hasPendingWrites})).sort((a,b)=>(b.ts||0)-(a.ts||0));
    S.pending=snap.metadata.hasPendingWrites;S.liveLoaded=true;rerender()},
    e=>{S.liveLoaded=true;rerender()});
  unsubCash=qc.onSnapshot(snap=>{S.cash=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.ts||0)-(a.ts||0));S.cashLoaded=true;rerender()},
    e=>{S.cash=[];S.cashLoaded=true;rerender()});
}
function startData(){
  stopSubs();lastTs=undefined;
  subs.push(db.doc("config/admins").onSnapshot(s=>{S.admins=(s.exists?s.data().emails:[])||[];S.rolesLoaded=true;
    if(isAdmin()&&!unsubUsers)unsubUsers=db.collection("users").onSnapshot(u=>{S.users=u.docs.map(d=>({id:d.id,...d.data()}));if(S.route==="items"||S.route==="log")rerender()},()=>{});
    rerender()},()=>{S.rolesLoaded=true;rerender()}));
  subs.push(db.doc("users/"+S.email).onSnapshot(s=>{S.me=s.exists?s.data():null;S.meLoaded=true;rerender()},()=>{S.meLoaded=true;rerender()}));
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
    if(!u){S.email="";stopSubs();Object.assign(S,{rolesLoaded:false,meLoaded:false,itemsLoaded:false,closingLoaded:false,liveLoaded:false,cashLoaded:false,admins:[],me:null,users:[],items:[],live:[],cash:[],appMoves:[]});renderLogin();return}
    S.email=(u.email||"").toLowerCase();render();
    await bootstrapIfFirst().catch(e=>toast(errText(e)));
    startData();
  });
}
window.__gv={S,balances,deltas,status,cashBal};
boot();
if("serviceWorker" in navigator&&location.protocol==="https:")navigator.serviceWorker.register("sw.js").catch(()=>{});
})();
