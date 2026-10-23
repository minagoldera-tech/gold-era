/* GOLD ERA ERP — application (React 18 + htm, no build step). */
"use strict";
const LOGO="assets/logo.jpg";
const {useState,useEffect,useMemo,useRef,useCallback}=React;
const html=htm.bind(React.createElement);
/* ---------- domain ---------- */
const LOC={vault:"الخزنة",prep:"التجهيز",hallmark:"الدمغة",finish:"التشطيب",packed:"التغليف",master:"المعلم",sold:"مباع"};
const LOC_ORDER=["vault","prep","hallmark","finish","packed","master","sold"];
const LOC_COLOR={vault:"var(--gold-500)",prep:"var(--gold-300)",hallmark:"var(--danger-strong)",finish:"var(--tab-green)",packed:"var(--info)",master:"var(--logo-gold)",sold:"var(--slate)"};
const LOC_PAGE={vault:"stock",prep:"prep",hallmark:"hallmark",finish:"finish",packed:"finish",master:"stock",sold:"sales"};
const KARATS=[[1000,"24 — 1000"],[999.9,"24 — 999.9"],[995,"24 — 995"],[875,"21 — 875"],[750,"18 — 750"]];
const karatLabel=k=>{const f=KARATS.find(x=>+x[0]===+k);return f?f[1]:String(k)};
const priceKey=k=>(+k>=990?"g24":+k>=870?"g21":"g18");
const ROLES={manager:{label:"مدير",pages:"*"},production:{label:"تصنيع وخزنة",pages:["bars","refine","strips","casting","orders","labels"]},stages:{label:"المراحل",pages:["prep","hallmark","finish","labels"]},sales:{label:"مبيعات وحسابات",pages:["sales","customers"]},viewer:{label:"مشاهد",pages:[]}};
const NAV=[
  ["الرئيسية",[["dash","لوحة التحكم"],["review","المراجعة"]]],
  ["الذهب",[["stock","الخزنة"],["bars","وارد محل"],["refine","الحل"],["strips","الشرايط"],["casting","التصنيع"],["orders","أوامر التصنيع"]]],
  ["المراحل",[["prep","التجهيز"],["hallmark","الدمغة"],["finish","التشطيب"]]],
  ["المخزون",[["count","الجرد والتسويات"],["labels","ملصقات QR"]]],
  ["التجارة",[["sales","المبيعات"],["customers","العملاء والحسابات"]]],
  ["العمال",[["workers","العمال والأقسام"],["attendance","وقت العمل"],["daily","التقرير اليومي"]]],
  ["الإدارة",[["reports","التقارير"],["settings","الإعدادات"]]]
];
const JOBS={
  refine:{label:"الحل",title:"الحل",desc:"تحويل دهب وارد محل لعيار 1000 — الناتج يتوزن ويدخل الخزنة، والخسية تتحسب تلقائياً",dept:"الحل",src:["shop"],icon:"drop",verb:"تسليم للحل",outL:"وزن الدهب بعد الحل (عيار 1000)"},
  strip:{label:"الشرايط",title:"الشرايط",desc:"الدهب المستلم من الخزنة ويتعمل شرايط جاهزة للتصنيع",dept:"الشرايط",src:["vault"],icon:"strips",verb:"تسليم وزنة للشرايط",outL:"وزن الشرايط المستلمة"},
  mfg:{label:"التصنيع",title:"التصنيع",desc:"تسليم العامل وزنة من الخام أو الشرايط — الوقت يتحسب تلقائياً من الاستلام لحد ما يسلّم الأصناف",dept:"التصنيع",src:["vault","strips"],icon:"flame",verb:"تسليم وزنة للتصنيع"},
  prep:{label:"التجهيز",dept:"تجهيز"},pack:{label:"التشطيب والتغليف",dept:"تغليف"}
};
const GOLD_JOBS=["refine","strip","mfg"];
const POOL={shop:"وارد محل",vault:"خام الخزنة",strips:"الشرايط الجاهزة"};
const COUNT_POOL={raw:"vault",shop:"shop",strips:"strips"};
const endDay=e=>e&&e.end?dkey(new Date(e.end)):null;
const pk=p=>p&&p.w>0.0001?p.f/p.w*1000:1000;
const PAGE_TITLE=Object.fromEntries(NAV.flatMap(g=>g[1]));
const ACTIONS={
  to_prep:{label:"تسليم للتجهيز",from:["vault"],to:"prep",worker:true,work:true,badge:"prep",startJob:"prep"},
  prep_back:{label:"إرجاع للخزنة",from:["prep"],to:"vault",badge:"",closeJob:"prep",closeFrom:"prep"},
  to_hallmark:{label:"تسليم دمغة",from:["prep","vault"],to:"hallmark",boxes:true,fee:true,badge:"recv",closeJob:"prep",closeFrom:"prep"},
  from_hallmark:{label:"استلام دمغة",from:["hallmark"],to:"finish",boxes:true,badge:"dlv"},
  back_hallmark:{label:"مرتجع للدمغة",from:["finish"],to:"hallmark",boxes:true,badge:"ret"},
  pack:{label:"تغليف",from:["finish"],to:"packed",boxes:true,worker:true,workerOpt:true,badge:"prep",closeJob:"pack",closeFrom:"finish",closeBy:"worker"},
  to_master:{label:"تسليم المعلم",from:["packed","finish"],to:"master",worker:true,badge:"done"}
};
const STAGES={
  prep:{loc:"prep",job:"prep",title:"التجهيز",sub:"تجهيز ( هزاز + ماتور + بلص ) — من الخزنة، والوقت يبدأ تلقائياً عند التسليم للعامل",actions:["to_prep","prep_back"]},
  hallmark:{loc:"hallmark",title:"الدمغة",sub:"تسليم دمغة، استلام دمغة، مرتجع للدمغة — والمتواجد حالياً في الدمغة",actions:["to_hallmark","from_hallmark","back_hallmark"]},
  finish:{loc:"finish",also:"packed",job:"pack",title:"التشطيب والتغليف",sub:"ما استُلم من الدمغة، ثم التغليف وتسليم المعلم",actions:["pack","to_master"]}
};
const WORKS=["هزاز","ماتور","بلص"];

/* ---------- utils ---------- */
const n=v=>{const x=parseFloat(String(v??"").replace(/,/g,""));return isFinite(x)?x:0};
const r2=x=>Math.round((x+Number.EPSILON)*100)/100;
const fg=x=>(r2(x)===0?0:r2(x)).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
const fi=x=>Math.round(x).toLocaleString("en-US");
const fm=x=>fg(x);
const pad=x=>String(x).padStart(2,"0");
const dkey=d=>d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
const today=()=>dkey(new Date());
const addDays=(k,i)=>{const [y,m,d]=k.split("-").map(Number);return dkey(new Date(y,m-1,d+i))};
const tme=iso=>{try{const d=new Date(iso);return pad(d.getHours())+":"+pad(d.getMinutes())}catch(e){return""}};
const newId=()=>(crypto.randomUUID?crypto.randomUUID().replace(/-/g,"").slice(0,16):Math.random().toString(36).slice(2,12)+Date.now().toString(36));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const MAPS=["bars","strips","casting","moves","sales","payments","counts","labels","sessions","evals"];

function buildLedger(days,catalog,until){
  const all=[];
  for(const [date,doc] of Object.entries(days)){
    for(const m of MAPS){const mp=doc[m];if(!mp||typeof mp!=="object")continue;
      for(const e of Object.values(mp)){if(e&&typeof e==="object"&&e.id)all.push({...e,_date:date,_map:m})}}
  }
  all.sort((a,b)=>(a.ts||"").localeCompare(b.ts||""));
  const ok=d=>!until||(!!d&&d<=until);
  const live=all.filter(e=>!e.void);
  const stock={};LOC_ORDER.forEach(l=>stock[l]={});
  const add=(l,it,c,w)=>{if(!it)return;const s=stock[l][it]||(stock[l][it]={c:0,w:0});s.c+=c;s.w+=w};
  const P={shop:{w:0,f:0},vault:{w:0,f:0},strips:{w:0,f:0}},W={refine:{w:0,f:0},strip:{w:0,f:0},mfg:{w:0,f:0}};
  const pa=(o,w,f)=>{if(o){o.w+=w;o.f+=f}};const kOf=it=>it?n(it.karat):999.9;
  const bars={},prod=[],losses=[];
  for(const e of live){const m=e._map;
    if(m==="sessions"){const J=e.job;if(!W[J]||!ok(e._date))continue;
      const iw=n(e.inW),ik=n(e.inK)||1000,src=P[e.src]?e.src:JOBS[J].src[0];
      pa(P[src],-iw,-iw*ik/1000);pa(W[J],iw,iw*ik/1000);if(e.serial&&bars[e.serial])bars[e.serial].issued+=iw;
      const ed=endDay(e);if(!e.end||!ok(ed))continue;
      pa(W[J],-iw,-iw*ik/1000);const rw=n(e.retW);pa(P[src],rw,rw*ik/1000);
      let lw=0,lf=0;
      if(J==="refine"){const o=n(e.outW);pa(P.vault,o,o);lf=(iw-rw)*ik/1000-o;lw=lf}
      else if(J==="strip"){const o=n(e.outW);pa(P.strips,o,o*ik/1000);lw=iw-rw-o;lf=lw*ik/1000}
      else{const ls=(e.lines||[]).filter(l=>l.item&&n(l.count)>0);const sc=ls.reduce((a,l)=>a+n(l.scale),0),sf=ls.reduce((a,l)=>a+n(l.scale)*kOf(catalog[l.item])/1000,0);
        lw=iw+n(e.added)-sc-rw;lf=(iw-rw)*ik/1000-sf;
        const base={_map:"casting",_virtual:true,_sid:e.id,_sdate:e._date,_date:ed,ts:e.end,by:e.by,worker:e.wname,wid:e.worker,order:e.order||"",orderNo:e.orderNo||0};
        (ls.length?ls:[{item:"",count:0,scale:0}]).forEach((l,i)=>{const it=catalog[l.item];add("vault",l.item,n(l.count),n(l.scale));const actual=it?n(it.w)*n(l.count):0;
          prod.push({...base,id:e.id+"-"+i,item:l.item,count:n(l.count),scale:n(l.scale),actual:r2(actual),diff:r2(actual-n(l.scale)),
            received:i===0?r2(iw+n(e.added)):0,cutW:i===0?r2(sc+rw):0,castW:i===0?n(e.castW):0,castLoss:i===0&&n(e.castW)?r2(iw+n(e.added)-n(e.castW)):0,
            cutLoss:i===0&&n(e.castW)&&n(e.cutW)?r2(n(e.castW)-n(e.cutW)):0,remaining:i===0?rw:0,_khF:i===0?lf:0})})}
      losses.push({_date:ed,job:J,worker:e.worker,wname:e.wname,w:lw,f:lf,id:e.id});
      continue}
    if(!ok(e._date))continue;
    if(m==="bars"){const w=n(e.weight),f=w*n(e.karat)/1000;pa(e.dest==="shop"?P.shop:P.vault,w,f);bars[e.serial]={...e,issued:0}}
    else if(m==="strips"){const w=n(e.weight),f=w*n(e.karat)/1000;
      if(e.kind==="return"){pa(P.vault,w,f);pa(W.mfg,-w,-f)}else{pa(P.vault,-w,-f);pa(W.mfg,w,f);if(e.serial&&bars[e.serial])bars[e.serial].issued+=w}}
    else if(m==="casting"){const it=catalog[e.item];const used=n(e.scale)+(n(e.received)-n(e.cutW));
      if(!e.opening)pa(W.mfg,-used,-used*kOf(it)/1000);add("vault",e.item,n(e.count),n(e.scale));const kh=khisya(e);if(kh&&!e.opening)losses.push({_date:e._date,job:"mfg",wname:e.worker,w:kh,f:kh*kOf(it)/1000,id:e.id})}
    else if(m==="moves"){add(e.from,e.item,-n(e.count),-n(e.weight));add(e.to,e.item,n(e.count),n(e.weight))}
    else if(m==="sales"){for(const ln of e.lines||[]){add("master",ln.item,-n(ln.count),-n(ln.weight));add("sold",ln.item,n(ln.count),n(ln.weight))}}
    else if(m==="counts"){const pool=COUNT_POOL[e.loc];for(const l of e.lines||[]){if(pool)pa(P[pool],n(l.dw),n(l.dw)*n(l.karat||999.9)/1000);else add(e.loc,l.item,n(l.dc),n(l.dw))}}
  }
  const custBal={};
  for(const e of live){if(!ok(e._date))continue;
    if(e._map==="sales"){custBal[e.customer]=(custBal[e.customer]||0)+n(e.total)-n(e.paid)}
    if(e._map==="payments"){custBal[e.customer]=(custBal[e.customer]||0)-n(e.amount)}
  }
  const wip={w:W.refine.w+W.strip.w+W.mfg.w,fine:W.refine.f+W.strip.f+W.mfg.f};
  return {all,live:live.concat(prod),stock,raw:{w:P.vault.w,fine:P.vault.f},wip,P,W,bars,custBal,prod,losses};
}
const locTotal=(stock,l)=>Object.values(stock[l]||{}).reduce((a,s)=>({c:a.c+s.c,w:a.w+s.w}),{c:0,w:0});
const khisya=e=>n(e.received)-n(e.cutW);

/* ---------- store ---------- */
const S={db:null,user:null,uid:null};
async function ensureDay(map,k){
  const ref=S.db.doc(map+"/"+k);
  for(let i=0;i<8;i++){
    const s=await ref.get();if(s.exists)return ref;
    const l=await ref.acquire({holder:S.uid||"anon",ttlMs:5000});
    if(l.acquired){const s2=await ref.get();if(!s2.exists)await ref.set({date:k,createdAt:new Date().toISOString()});return ref}
    await sleep(400+Math.random()*400);
  }
  return ref;
}
async function addEntry(map,body,k=today()){
  if(!S.db)throw {code:"no_db"};
  const ref=await ensureDay(map,k);const id=newId();
  const e={...body,id,ts:new Date().toISOString(),by:S.uid||null};
  await ref.update({[map]:{[id]:e}});return e;
}
async function voidEntry(e,reason){
  if(!S.db)throw {code:"no_db"};
  await S.db.doc(e._map+"/"+e._date).update({[e._map]:{[e.id]:{void:true,voidReason:reason||"",voidBy:S.uid||null,voidAt:new Date().toISOString()}}});
}
const errText=e=>{const c=e&&e.code;
  if(c==="no_db")return "قاعدة البيانات غير متاحة. تحقق من إعداد config.js.";
  if(c==="invalid_argument")return "لم يُحفظ: ليست لديك صلاحية لهذا الإجراء. اطلب من المالك مراجعة دورك.";
  if(c==="quota_exceeded")return "امتلأت مساحة قاعدة البيانات. صدّر التقارير القديمة ثم احذف أياماً قديمة.";
  if(c==="resource_exhausted")return "طلبات كثيرة في وقت قصير. انتظر ثواني ثم احفظ مرة أخرى.";
  return "تعذر الحفظ الآن. تأكد من الاتصال ثم أعد المحاولة.";};


/* ---------- icons ---------- */
const IP={
  dash:"M4 4h6v8H4zM14 4h6v5h-6zM14 13h6v7h-6zM4 16h6v4H4z",
  bar:"M3 19h18l-3.5-9h-11zM8.5 10l1.5-4h4l1.5 4",drop:"M12 3c3 4.5 6 7.8 6 11a6 6 0 0 1-12 0c0-3.2 3-6.5 6-11z",
  strips:"M12 3l9 5-9 5-9-5zM3 13l9 5 9-5M3 17.5l9 5 9-5",
  flame:"M12 3c.6 3 4.5 5 4.5 10a4.5 4.5 0 0 1-9 0c0-2.4 1.4-3.7 2.2-5.6.8 1.1 1.4 2.3 1.5 3.6 1.4-2 1.6-5 .8-8z",
  prep:"M20 12a8 8 0 1 1-2.4-5.7L20 8.5M20 3.5v5h-5",
  stamp:"M9 3h6v4.5l3.5 3V14h-13v-3.5L9 7.5zM5 17.5h14V21H5z",
  finish:"M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  box:"M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5zM3.5 7.5L12 12l8.5-4.5M12 12v9",
  receipt:"M6 3h12v18l-2.5-1.6L13 21l-2.5-1.6L8 21l-2-1.3zM9 8h6M9 12h6M9 16h3",
  users:"M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.3a3.5 3.5 0 0 1 0 6.4M18.5 14.5a6.5 6.5 0 0 1 3 5.5",
  chart:"M4 20V11M10 20V5M16 20v-6M2.5 20h19",
  gear:"M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zM19 13.5l1.8 1.4-2 3.4-2.1-.8a7.5 7.5 0 0 1-2.2 1.3L14.2 21h-4l-.3-2.2a7.5 7.5 0 0 1-2.2-1.3l-2.1.8-2-3.4 1.8-1.4a7.6 7.6 0 0 1 0-3L3.6 9.1l2-3.4 2.1.8a7.5 7.5 0 0 1 2.2-1.3L10.2 3h4l.3 2.2a7.5 7.5 0 0 1 2.2 1.3l2.1-.8 2 3.4L19 10.5a7.6 7.6 0 0 1 0 3z",
  search:"M10.5 17.5a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20.5 20.5l-5-5",
  plus:"M12 5v14M5 12h14",x:"M6 6l12 12M18 6L6 18",
  dl:"M12 3.5v11M7.5 10l4.5 4.5 4.5-4.5M4.5 20.5h15",
  alert:"M12 3.5l9.5 17h-19zM12 10v4.5M12 17.6v.1",
  check:"M4.5 12.5l5 5 10-11",
  qr:"M3.5 3.5h6v6h-6zM14.5 3.5h6v6h-6zM3.5 14.5h6v6h-6zM14.5 14.5h2.5V17h-2.5zM18 18h2.5v2.5H18zM18 14.5h2.5M14.5 18.5v2",
  ban:"M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM5.7 5.7l12.6 12.6",
  menu:"M4 7h16M4 12h16M4 17h16",chev:"M9 6l6 6-6 6",
  clock:"M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7.5V12l3 2",
  wallet:"M3.5 7h16v13h-16zM3.5 7l12-3.5V7M15 13.5h2",
  eye:"M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  arrow:"M5 12h14M13 6l6 6-6 6",clip:"M9 4h6v3H9zM7 5.5H5.5V21h13V5.5H17M8.5 12l2 2 4-4M8.5 17h7",info:"M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5.5M12 7.6v.1"
};
const I=({n,s})=>html`<svg class="i" viewBox="0 0 24 24" aria-hidden="true" style=${s?{width:s+"px",height:s+"px"}:null}><path d=${IP[n]}/></svg>`;
const NAV_ICON={dash:"dash",review:"eye",refine:"drop",bars:"bar",strips:"strips",casting:"flame",prep:"prep",hallmark:"stamp",finish:"finish",stock:"box",sales:"receipt",customers:"users",reports:"chart",settings:"gear",orders:"clip",count:"check",labels:"qr",workers:"users",attendance:"clock",daily:"clip"};
const MAP_ICON={bars:"bar",strips:"strips",casting:"flame",moves:"arrow",sales:"receipt",payments:"wallet",counts:"check",labels:"qr",sessions:"clock",evals:"check"};
const PAGE_GROUP=Object.fromEntries(NAV.flatMap(([g,items])=>items.map(([k])=>[k,g])));
const BADGE_TONE={prep:"gold",recv:"warn",dlv:"ok",done:"ok",ret:"bad","":"plain"};

/* ---------- shared bits ---------- */
const deltaOf=(a,b)=>b===0?(a===0?0:null):(a-b)/Math.abs(b)*100;
function Delta({v,good}){if(v===null||v===undefined||!isFinite(v))return null;const flat=Math.abs(v)<0.5;
  const cls=flat?"flat":(good==="up"?(v>0?"gup":"gdown"):(v>0?"up":"down"));
  return html`<span class=${"delta "+cls}><span class="num">${(v>0?"+":"")+v.toFixed(0)}%</span></span>`}
function Spark({data}){const w=92,h=30,mx=Math.max(...data,0.0001),mn=Math.min(...data,0);const sx=i=>i/(data.length-1||1)*w,sy=v=>h-2-(v-mn)/((mx-mn)||1)*(h-6);
  const pts=data.map((v,i)=>[sx(i),sy(v)]);const l="M"+pts.map(p=>p[0].toFixed(1)+" "+p[1].toFixed(1)).join(" L");
  return html`<svg class="spark" viewBox=${"0 0 "+w+" "+h} aria-hidden="true" style=${{transform:"scaleX(-1)"}}><path class="a" d=${l+" L"+w+" "+h+" L0 "+h+" Z"}/><path class="l" d=${l}/><circle cx=${pts[pts.length-1][0]} cy=${pts[pts.length-1][1]} r="2.5"/></svg>`}
function Kpi({label,icon,value,unit,sub,delta,good,spark,alert,onClick}){
  const inner=html`<div class="kpi__l">${icon&&html`<${I} n=${icon}/>`}${label}</div>
    <div class="kpi__row"><div class="kpi__v"><span class="num">${value}</span>${unit&&html`<small>${unit}</small>`}</div>${spark&&html`<${Spark} data=${spark}/>`}</div>
    <div class="kpi__s">${delta!==undefined&&html`<${Delta} v=${delta} good=${good}/>`}${sub&&html`<span>${sub}</span>`}</div>`;
  return onClick?html`<button class=${"kpi"+(alert?" alert":"")} onClick=${onClick}>${inner}</button>`:html`<div class=${"kpi"+(alert?" alert":"")}>${inner}</div>`}
function Card({title,sub,actions,children,body}){return html`<section class="card"><div class="card__h"><div><h2>${title}</h2>${sub&&html`<p>${sub}</p>`}</div>${actions}</div>${body?html`<div class="card__b">${children}</div>`:children}</section>`}
function PH({title,desc,children}){return html`<div class="ph"><div><h1>${title}</h1>${desc&&html`<p>${desc}</p>`}</div><div class="ph__a">${children}</div></div>`}
function Badge({tone,children}){return html`<span class=${"bd "+(tone||"")}>${children}</span>`}
function Empty({t,s,icon}){return html`<div class="empty"><${I} n=${icon||"box"}/><b>${t}</b>${s&&html`<span>${s}</span>`}</div>`}
function Seg({opts,value,set}){return html`<div class="seg" role="group">${opts.map(([v,l])=>html`<button type="button" key=${v} aria-pressed=${value===v?"true":"false"} onClick=${()=>set(v)}>${l}</button>`)}</div>`}
function Range({value,set}){return html`<${Seg} opts=${[["1","اليوم"],["7","7 أيام"],["30","30 يوماً"],["all","الكل"]]} value=${value} set=${set}/>`}
const inRange=(e,r)=>r==="all"||e._date>=addDays(today(),-(+r-1));
function F({label,hint,err,children,full}){return html`<label class=${"f"+(err?" err":"")+(full?" full":"")}><span>${label}</span>${children}${(err||hint)&&html`<small>${err||hint}</small>`}</label>`}
function Num({value,set,ro,ph,id}){return html`<input id=${id} class="in nm" inputmode="decimal" autocomplete="off" value=${value} placeholder=${ph||"0.00"} readOnly=${!!ro} onInput=${e=>set&&set(e.target.value)}/>`}
function Sel({id,value,set,children}){return html`<select id=${id} class="in" value=${value} onChange=${e=>set(e.target.value)}>${children}</select>`}
function ItemSel({value,set,catalog,id,only,avail}){const items=Object.entries(catalog).filter(([k])=>!only||only.includes(k)).sort((a,b)=>n(a[1].order)-n(b[1].order));
  return html`<${Sel} id=${id} value=${value} set=${set}><option value="">${items.length?"اختر الصنف":"لا توجد أصناف — أضفها من الإعدادات"}</option>${items.map(([k,it])=>html`<option key=${k} value=${k}>${it.name}${avail&&avail[k]?" — متاح "+fi(avail[k].c):""}</option>`)}</${Sel}>`}
function Calc({items}){return html`<div class="calc">${items.map((x,i)=>html`<div key=${i}><span>${x[0]}</span><b class=${x[2]||""}>${x[1]}</b></div>`)}</div>`}
function Who({id,names}){const p=id&&names[id];if(!id)return html`<span class="who" style=${{color:"var(--muted)"}}>مستورد من الإكسل</span>`;return html`<span class="who">${p&&p.avatarUrl&&html`<img alt="" src=${p.avatarUrl}/>`}${(p&&p.name)||"مستخدم"}</span>`}
function ReadOnly(){return html`<div class="note"><${I} n="info"/><span>صلاحيتك في هذه الصفحة: عرض فقط. المالك يغيّرها من الإعدادات ← المستخدمون والصلاحيات.</span></div>`}
function useEsc(f){useEffect(()=>{const h=e=>{if(e.key==="Escape")f()};addEventListener("keydown",h);return()=>removeEventListener("keydown",h)},[f])}
function Sheet({title,sub,onClose,children,footer}){useEsc(onClose);
  return html`<div class="ov" onMouseDown=${e=>{if(e.target===e.currentTarget)onClose()}}><aside class="sheet" role="dialog" aria-modal="true" aria-label=${title}>
    <div class="sheet__h"><div><h3>${title}</h3>${sub&&html`<p>${sub}</p>`}</div><button class="btn ghost sm" onClick=${onClose} aria-label="إغلاق"><${I} n="x"/></button></div>
    <div class="sheet__b">${children}</div>${footer&&html`<div class="sheet__f">${footer}</div>`}</aside></div>`}
function Modal({onClose,children,label}){useEsc(onClose);return html`<div class="ov center" onMouseDown=${e=>{if(e.target===e.currentTarget)onClose()}}><div class="modal" role="dialog" aria-modal="true" aria-label=${label}>${children}</div></div>`}
function QR({text}){const svg=useMemo(()=>{try{const q=qrcode(0,"M");q.addData(text);q.make();return q.createSvgTag(5,2)}catch(e){return""}},[text]);
  return html`<div class="qr"><div dangerouslySetInnerHTML=${{__html:svg}}></div><code>${text}</code></div>`}

/* DataTable: search, sort, paging, footer */
function DataTable({cols,rows,pageSize=12,empty,foot,onRow,sort,toolbar,rowCls,searchPh}){
  const [q,setQ]=useState("");const [sk,setSk]=useState(sort?sort[0]:null);const [sd,setSd]=useState(sort?sort[1]:"desc");const [pg,setPg]=useState(0);
  useEffect(()=>setPg(0),[q,rows.length]);
  const data=useMemo(()=>{let r=rows;const s=q.trim();
    if(s)r=r.filter(x=>cols.some(c=>{const v=c.text?c.text(x):(c.get?c.get(x):x[c.key]);return v!=null&&String(v).includes(s)}));
    if(sk){const c=cols.find(c=>c.key===sk);if(c){const g=c.get||(x=>x[c.key]);r=[...r].sort((a,b)=>{const A=g(a),B=g(b);const v=(typeof A==="number"&&typeof B==="number")?A-B:String(A??"").localeCompare(String(B??""),"ar");return sd==="asc"?v:-v})}}
    return r},[rows,q,sk,sd,cols]);
  const pages=Math.max(1,Math.ceil(data.length/pageSize));const p=Math.min(pg,pages-1);const view=data.slice(p*pageSize,p*pageSize+pageSize);
  const clickSort=c=>{if(c.sort===false)return;if(sk===c.key)setSd(sd==="asc"?"desc":"asc");else{setSk(c.key);setSd(c.num?"desc":"asc")}};
  return html`<div>
    <div class="tbar"><label class="tsearch"><${I} n="search" s=${15}/><input placeholder=${searchPh||"بحث في الجدول"} value=${q} onInput=${e=>setQ(e.target.value)} aria-label="بحث في الجدول"/></label>${toolbar}<span class="tcount"><span class="num">${fi(data.length)}</span> سجل</span></div>
    ${data.length?html`<div class="tw"><table class="t"><thead><tr>${cols.map(c=>html`<th key=${c.key} class=${(c.num?"n ":"")+(c.sort===false?"":"s")} onClick=${()=>clickSort(c)} aria-sort=${sk===c.key?(sd==="asc"?"ascending":"descending"):undefined}>${c.label}${c.sort!==false&&html` <span class="arr">${sk===c.key?(sd==="asc"?"↑":"↓"):""}</span>`}</th>`)}</tr></thead>
      <tbody>${view.map((r,i)=>html`<tr key=${r.id||i} class=${(onRow?"click ":"")+(rowCls?rowCls(r):"")} onClick=${onRow?()=>onRow(r):undefined}>${cols.map(c=>html`<td key=${c.key} class=${(c.num?"n ":"")+(c.cls||"")}>${c.render?c.render(r):(c.get?c.get(r):r[c.key])}</td>`)}</tr>`)}</tbody>
      ${foot&&html`<tfoot><tr>${cols.map((c,i)=>html`<td key=${c.key} class=${c.num?"n":""}>${foot[c.key]??(i===0?"الإجمالي":"")}</td>`)}</tr></tfoot>`}</table></div>
      ${pages>1&&html`<div class="pager"><span>عرض <span class="num">${p*pageSize+1}–${Math.min(data.length,(p+1)*pageSize)}</span> من <span class="num">${fi(data.length)}</span></span><div><button class="btn sm" disabled=${p===0} onClick=${()=>setPg(p-1)}>السابق</button><button class="btn sm" disabled=${p>=pages-1} onClick=${()=>setPg(p+1)}>التالي</button></div></div>`}`
    :(empty||html`<${Empty} t="لا توجد سجلات" s=${q?"لا نتائج لـ «"+q+"»":""}/>`)}
  </div>`;
}

/* entry details + void with reason */
function fieldsOf(e,catalog,customers){const it=catalog[e.item]?.name;const F=[];const g=(k,v)=>F.push([k,v]);
  switch(e._map){
    case "bars":g("رقم السبيكة",e.serial);g("المكان",e.dest==="shop"?"وارد محل":"الخزنة");g("الوزن",fg(n(e.weight))+" جم");g("العيار",karatLabel(e.karat));g("الفاين",fg(n(e.weight)*n(e.karat)/1000)+" جم");if(e.source)g("المصدر",e.source);break;
    case "strips":g("النوع",e.kind==="return"?"رد للخزنة":"صرف للتصنيع");g("الوزن",fg(n(e.weight))+" جم");g("العيار",karatLabel(e.karat));if(e.serial)g("السبيكة",e.serial);if(it){g("الصنف المطلوب",it);g("العدد المطلوب",fi(n(e.count)));g("وزن المطلوب",fg(n(e.reqWeight))+" جم")}break;
    case "casting":g("الصانع",e.worker||"—");if(e.order)g("أمر التصنيع",e.orderNo?"#"+e.orderNo:"مرتبط");g("الوزنة المتسلمة",fg(n(e.received)));g("وزنة السبك",fg(n(e.castW)));g("وزنة التقطيع",fg(n(e.cutW)));g("خسية السبك",fg(n(e.castLoss)));g("خسية التقطيع",fg(n(e.cutLoss)));g("الصنف",it||"—");g("العدد",fi(n(e.count)));g("الوزن علي الميزان",fg(n(e.scale)));g("الوزن الفعلي",fg(n(e.actual)));g("الفرق",fg(n(e.diff)));g("الوزنة المتبقية",fg(n(e.remaining)));break;
    case "moves":g("الحركة",ACTIONS[e.action]?.label||e.action);g("من ← إلى",LOC[e.from]+" ← "+LOC[e.to]);g("الصنف",it||"—");g("العدد",fi(n(e.count)));g("الوزن",fg(n(e.weight))+" جم");if(e.boxes)g("العلب",fi(n(e.boxes)));if(e.worker)g("المستلم",e.worker+(e.work?" · "+e.work:""));if(e.fee)g("رسوم الدمغة",fm(n(e.fee))+" ج.م");break;
    case "sales":g("رقم الفاتورة",e.no);g("العميل",customers[e.customer]?.name||"—");g("الإجمالي",fm(n(e.total))+" ج.م");g("المدفوع",fm(n(e.paid))+" ج.م");break;
    case "payments":g("العميل",customers[e.customer]?.name||"—");g("المبلغ",fm(n(e.amount))+" ج.م");g("الطريقة",e.method||"—");break;
    case "counts":g("المكان",(COUNT_LOCS.find(x=>x[0]===e.loc)||[0,""])[1]);(e.lines||[]).forEach(l=>g(l.item?(catalog[l.item]?.name||l.item):"الخام",(COUNT_POOL[e.loc]?"":fi(n(l.cntC))+" قطعة ("+(n(l.dc)>0?"+":"")+fi(n(l.dc))+") · ")+fg(n(l.cntW))+" جم ("+(n(l.dw)>0?"+":"")+fg(n(l.dw))+")"));break;
    case "sessions":g("العامل",e.wname||"—");g("القسم",e.dept||"—");g("الشغل",e.task||"—");
      if(GOLD_JOBS.includes(e.job)){g("من",POOL[e.src||JOBS[e.job].src[0]]);g("الوزنة المستلمة",fg(n(e.inW))+" جم عيار "+fi(n(e.inK)||1000));if(e.serial)g("السبيكة",e.serial);
        if(e.end){if(e.job==="mfg"){g("الأصناف",jobItems(e,catalog)||"—");g("وزن الأصناف",fg(jobOut(e))+" جم");if(n(e.castW))g("وزنة السبك",fg(n(e.castW)));if(n(e.cutW))g("وزنة التقطيع",fg(n(e.cutW)));if(n(e.added))g("إضافة للعيار",fg(n(e.added)))}else g("الناتج",fg(n(e.outW))+" جم");
          g("المرتجع",fg(n(e.retW))+" جم");g("الخسية",fg(n(e.loss))+" جم")}}if(it)g("الصنف",it);g("البداية",String(e.start||"").slice(0,16).replace("T"," "));g("النهاية",e.end?String(e.end).slice(0,16).replace("T"," "):"جارية");g("المدة",fh(sesHours(e)));if(e.end&&!GOLD_JOBS.includes(e.job)){g("القطع",fi(n(e.pcs)));g("الوزن",fg(n(e.weight))+" جم")}break;
    case "evals":g("العامل",e.wname||"—");g("التقييم",RATING[e.rating]?.[0]||"—");break;
    case "labels":g("الكود",e.prefix+"-001 … -"+String(n(e.count)).padStart(3,"0"));g("النوع",e.kind==="box"?"علب":"قطع");g("الصنف",it||"—");g("عدد الملصقات",fi(n(e.count)));if(e.perBox)g("قطع في العلبة",fi(n(e.perBox)));g("الوزن لكل ملصق",fg(n(e.weightEach))+" جم");break;
  }if(e.note)g("ملاحظة",e.note);return F}
function voidBlock(e,L,catalog){const it=catalog[e.item]?.name||"الصنف";
  if(e._map==="moves"){const a=(L.stock[e.to]||{})[e.item]||{c:0};if(a.c+0.0001<n(e.count))return "لا يمكن الإلغاء: المتبقي من "+it+" في "+LOC[e.to]+" "+fi(a.c)+" قطعة فقط، أي أن القطع تحركت بعد هذا القيد. ألغِ الحركات اللاحقة أولاً."}
  if(e._map==="casting"){const a=L.stock.vault[e.item]||{c:0};if(a.c+0.0001<n(e.count))return "لا يمكن الإلغاء: المتبقي من "+it+" في الخزنة الفرعية "+fi(a.c)+" قطعة فقط. ألغِ الحركات اللاحقة أولاً."}
  if(e._map==="counts"){for(const l of e.lines||[]){if(COUNT_POOL[e.loc]){if(n(l.dw)>0&&L.P[COUNT_POOL[e.loc]].w+0.001<n(l.dw))return "لا يمكن الإلغاء: الرصيد الحالي أقل من التسوية."}else{const a=(L.stock[e.loc]||{})[l.item]||{c:0};if(n(l.dc)>0&&a.c+0.0001<n(l.dc))return "لا يمكن الإلغاء: الرصيد الحالي من "+(catalog[l.item]?.name||"الصنف")+" أقل من التسوية."}}}
  if(e._map==="bars"&&(e.dest==="shop"?L.P.shop:L.P.vault).w+0.001<n(e.weight))return "لا يمكن الإلغاء: اتسلّم من الرصيد بعد استلام هذه السبيكة.";
  if(e._map==="sessions"&&e.end&&GOLD_JOBS.includes(e.job)){if(e.job==="refine"&&L.P.vault.w+0.001<n(e.outW))return "لا يمكن الإلغاء: دهب الحل اتسلّم من الخزنة بعدها.";
    if(e.job==="strip"&&L.P.strips.w+0.001<n(e.outW))return "لا يمكن الإلغاء: الشرايط اتسلّمت للتصنيع بعدها.";
    if(e.job==="mfg")for(const l of e.lines||[]){const a=L.stock.vault[l.item]||{c:0};if(a.c+0.0001<n(l.count))return "لا يمكن الإلغاء: قطع "+(catalog[l.item]?.name||"")+" اتحركت من الخزنة. ألغِ الحركات اللاحقة أولاً."}}
  if(e._map==="strips"&&e.kind!=="return"&&L.wip.w+0.001<n(e.weight))return "لا يمكن الإلغاء: سُبك جزء من هذه الشرايط بالفعل.";
  return ""}
function EntrySheet({e,L,catalog,customers,names,role,perm,onClose,toast}){
  const [reason,setReason]=useState("");const [ask,setAsk]=useState(false);const [busy,setBusy]=useState(false);const [err,setErr]=useState("");
  const mgr=!!(perm&&perm.void);
  const doVoid=async()=>{if(reason.trim().length<3)return setErr("اكتب سبب الإلغاء.");const blk=voidBlock(e,L,catalog);if(blk)return setErr(blk);setBusy(true);try{await voidEntry(e,reason.trim());toast("أُلغي القيد");onClose()}catch(er){setErr(errText(er))}setBusy(false)};
  return html`<${Sheet} title=${MAP_TITLE[e._map]} sub=${e._date+" · "+tme(e.ts)} onClose=${onClose} footer=${mgr&&!e.void?(ask?html`<span class="msg">${err}</span><button class="btn" onClick=${()=>setAsk(false)}>تراجع</button><button class="btn d" disabled=${busy} onClick=${doVoid}><${I} n="ban"/>تأكيد الإلغاء</button>`:html`<button class="btn d" onClick=${()=>setAsk(true)}><${I} n="ban"/>إلغاء القيد</button>`):null}>
    ${e.void&&html`<div class="note warn"><${I} n="alert"/><span>هذا القيد ملغى${e.voidReason?": "+e.voidReason:""}. <small style=${{display:"block",color:"var(--muted)"}}>بواسطة <${Who} id=${e.voidBy} names=${names}/> · ${String(e.voidAt||"").slice(0,16).replace("T"," ")}</small></span></div>`}
    <dl class="kv">${fieldsOf(e,catalog,customers).map(([k,v])=>html`<${React.Fragment} key=${k}><dt>${k}</dt><dd>${v}</dd></${React.Fragment}>`)}</dl>
    <div class="sect">التدقيق</div>
    <dl class="kv"><dt>سجّله</dt><dd><${Who} id=${e.by} names=${names}/></dd><dt>الوقت</dt><dd class="num">${String(e.ts||"").slice(0,19).replace("T"," ")}</dd><dt>المعرّف</dt><dd class="num" style=${{fontWeight:400,color:"var(--muted)"}}>${e.id}</dd></dl>
    ${ask&&html`<${F} label="سبب الإلغاء" hint="يظهر في سجل التدقيق ولا يمكن التراجع عنه"><textarea id="void-reason" class="in" value=${reason} onInput=${x=>setReason(x.target.value)}></textarea></${F}>`}
  </${Sheet}>`;
}
const MAP_TITLE={bars:"سبيكة",strips:"قيد شرايط (قديم)",casting:"صف سبك وتقطيع",moves:"حركة مرحلة",sales:"فاتورة بيع",payments:"تحصيل",counts:"جرد وتسوية",labels:"دفعة ملصقات",sessions:"جلسة عمل",evals:"تقييم يومي"};
const voidCls=r=>r.void?"void":"";
const stCol=()=>({key:"st",label:"",sort:false,cls:"keep",render:r=>r.void?html`<${Badge} tone="bad">ملغى</${Badge}>`:null});

/* ---------- dashboard ---------- */
function KhisyaChart({L,limit}){
  const t=today();const days=[...Array(30)].map((_,i)=>addDays(t,i-29));
  const vals=days.map(d=>L.live.filter(e=>e._map==="casting"&&e._date===d).reduce((a,e)=>a+khisya(e),0));
  const prod=days.map(d=>L.live.filter(e=>e._map==="casting"&&e._date===d).reduce((a,e)=>a+n(e.count),0));
  const [hv,setHv]=useState(-1);const box=useRef();
  const W=760,H=210,pl=8,pr=44,pt=14,pb=26,iw=W-pl-pr,ih=H-pt-pb;
  const mx=Math.max(limit*1.25,...vals,0.1);const step=mx>2?1:mx>1?0.5:mx>0.4?0.2:0.1;const top=Math.ceil(mx/step)*step;
  const y=v=>pt+ih-(Math.max(0,v)/top)*ih;const bw=iw/days.length;
  const xr=i=>pl+iw-(i+1)*bw; /* RTL: newest on the left end */
  const ticks=[];for(let v=0;v<=top+1e-9;v+=step)ticks.push(+v.toFixed(2));
  const bar=(x,w,y0)=>{const h=pt+ih-y0;if(h<=0)return "";const r=Math.min(4,w/2,h);return `M${x} ${pt+ih}V${y0+r}Q${x} ${y0} ${x+r} ${y0}H${x+w-r}Q${x+w} ${y0} ${x+w} ${y0+r}V${pt+ih}Z`};
  const avg=vals.reduce((a,b)=>a+b,0)/(vals.filter(v=>v!==0).length||1);
  return html`<div class="chart" ref=${box} onMouseLeave=${()=>setHv(-1)}>
    <svg viewBox=${"0 0 "+W+" "+H} role="img" aria-label="الخسية اليومية لآخر 30 يوماً بالجرام">
      ${ticks.map(v=>html`<g key=${v}><line class=${v===0?"base":"grid"} x1=${pl} x2=${pl+iw} y1=${y(v)} y2=${y(v)}/><text x=${W-pr+8} y=${y(v)+4} text-anchor="start" class="num">${v.toFixed(step<1?1:0)}</text></g>`)}
      <line class="lim" x1=${pl} x2=${pl+iw} y1=${y(limit)} y2=${y(limit)}/>
      ${vals.map((v,i)=>{const x=xr(days.length-1-i)+bw*0.2,w=bw*0.6;return html`<g key=${days[i]}>
        <path class=${"m"+(hv===i?" hov":"")} d=${bar(x,w,y(v))}/>
        ${(i%5===4||i===days.length-1)&&html`<text x=${x+w/2} y=${H-8} text-anchor="middle" class="num">${days[i].slice(8)}/${days[i].slice(5,7)}</text>`}
        <rect class="hit" x=${xr(days.length-1-i)} y=${pt} width=${bw} height=${ih} onMouseEnter=${()=>setHv(i)} onFocus=${()=>setHv(i)} tabindex="-1"/></g>`})}
    </svg>
    ${hv>=0&&(()=>{const x=xr(days.length-1-hv)+bw/2;return html`<div class="tip" style=${{left:(x/W*100)+"%",top:(y(vals[hv])/H*100)+"%"}}><span class="num">${days[hv]}</span><b><span class="num">${fg(vals[hv])}</span> جم خسية</b><span class="num">${fi(prod[hv])}</span> قطعة</div>`})()}
  </div>
  <div class="legend"><span><i></i>الخسية اليومية (جم)</span><span><i class="l"></i>الحد المسموح <span class="num">${fg(limit)}</span></span><span>متوسط أيام العمل <b class="num">${fg(avg)}</b></span></div>`;
}
function alertsOf(L,catalog,prices,limit){
  const A=[];const t=today();
  const kh=L.live.filter(e=>e._map==="casting"&&e._date===t).reduce((a,e)=>a+khisya(e),0);
  if(kh>limit)A.push(["bad","خسية التصنيع اليوم "+fg(kh)+" جم","أعلى من الحد المسموح "+fg(limit)+" جم","casting"]);
  for(const l of LOC_ORDER)for(const [k,s] of Object.entries(L.stock[l]))if(s.c<-0.0001)A.push(["bad","رصيد سالب في "+LOC[l],(catalog[k]?.name||k)+": "+fi(s.c)+" قطعة — راجع الحركات",LOC_PAGE[l]]);
  const hm=locTotal(L.stock,"hallmark");
  if(hm.c>0){const last=L.live.filter(e=>e._map==="moves"&&e.to==="hallmark").map(e=>e._date).sort()[0];
    if(last&&last<=addDays(t,-3))A.push(["warn",fi(hm.c)+" قطعة في الدمغة","أقدم تسليم منذ "+last,"hallmark"])}
  if(!prices.g21&&!prices.g24)A.push(["warn","أسعار الذهب غير محددة","الفواتير تحتاج سعر الجرام","settings"]);
  else if(prices.updatedAt&&String(prices.updatedAt).slice(0,10)<t)A.push(["warn","أسعار الذهب لم تُحدّث اليوم","آخر تحديث "+String(prices.updatedAt).slice(0,10),"settings"]);
  Object.values(window.__ORDERS||{}).filter(o=>o.status==="open"&&o.due&&o.due<t).forEach(o=>{const p=orderProgress(o,L);if(p.made<n(o.qty))A.push(["warn","أمر التصنيع #"+o.no+" متأخر",(catalog[o.item]?.name||"")+" — أُنتج "+fi(p.made)+" من "+fi(n(o.qty))+"، الموعد "+o.due,"orders"])});
  for(const [k,p] of Object.entries(L.P))if(p.w<-0.01)A.push(["warn","رصيد سالب في "+POOL[k],fg(p.w)+" جم — راجع القيود","stock"]);
  const old=L.live.filter(e=>e._map==="sessions"&&!e.end&&e.job&&e._date<addDays(t,-1));if(old.length)A.push(["warn",fi(old.length)+" شغل مفتوح من أكتر من يوم",old.map(e=>e.wname).slice(0,4).join("، "),"review"]);
  return A;
}
function Dashboard({L,catalog,go,names,customers,prices,config}){
  const t=today(),y1=addDays(t,-1);const limit=n(config.khisyaLimit)||0.5;
  const dayVal=(d,f)=>L.live.filter(e=>e._map==="casting"&&e._date===d).reduce((a,e)=>a+f(e),0);
  const last14=[...Array(14)].map((_,i)=>addDays(t,i-13));
  const kh=dayVal(t,khisya),khY=dayVal(y1,khisya);
  const pc=dayVal(t,e=>n(e.count)),pcY=dayVal(y1,e=>n(e.count)),pw=dayVal(t,e=>n(e.scale));
  const sales=d=>L.live.filter(e=>e._map==="sales"&&e._date===d).reduce((a,e)=>a+n(e.total),0);
  const hm=locTotal(L.stock,"hallmark");
  const recv=Object.values(L.custBal).reduce((a,v)=>a+(v>0?v:0),0);
  const inStages=LOC_ORDER.filter(l=>l!=="sold").reduce((a,l)=>a+locTotal(L.stock,l).w,0);
  const alerts=alertsOf(L,catalog,prices,limit);
  const flowMax=Math.max(1,...LOC_ORDER.map(l=>locTotal(L.stock,l).w));
  const recent=L.all.slice(-8).reverse();
  const topItems=Object.entries(L.live.filter(e=>e._map==="casting"&&e._date>=addDays(t,-29)).reduce((o,e)=>{const b=o[e.item]||(o[e.item]={c:0,w:0});b.c+=n(e.count);b.w+=n(e.scale);return o},{})).sort((a,b)=>b[1].w-a[1].w).slice(0,5);
  return html`<${React.Fragment}>
    <${PH} title="لوحة التحكم" desc="ملخص التشغيل اليوم ومسار الذهب عبر المراحل"/>
    <div class="kpis six">
      <${Kpi} icon="flame" label="الخسية اليوم" value=${fg(kh)} unit="جم" delta=${deltaOf(kh,khY)} good="down" sub="مقارنة بالأمس" spark=${last14.map(d=>dayVal(d,khisya))} alert=${kh>limit} onClick=${()=>go("casting")}/>
      <${Kpi} icon="box" label="إنتاج اليوم" value=${fi(pc)} unit="قطعة" delta=${deltaOf(pc,pcY)} good="up" sub=${fg(pw)+" جم"} spark=${last14.map(d=>dayVal(d,e=>n(e.count)))} onClick=${()=>go("casting")}/>
      <${Kpi} icon="stamp" label="في الدمغة الآن" value=${fi(hm.c)} unit="قطعة" sub=${fg(hm.w)+" جم"} onClick=${()=>go("hallmark")}/>
      <${Kpi} icon="bar" label="خام الخزنة" value=${fg(L.P.vault.w)} unit="جم" sub=${"وارد محل "+fg(L.P.shop.w)+" · مع العمال "+fg(L.wip.w)} onClick=${()=>go("stock")}/>
      <${Kpi} icon="receipt" label="مبيعات اليوم" value=${fm(sales(t))} unit="ج.م" delta=${deltaOf(sales(t),sales(y1))} good="up" spark=${last14.map(sales)} onClick=${()=>go("sales")}/>
      <${Kpi} icon="wallet" label="مستحقات العملاء" value=${fm(recv)} unit="ج.م" sub=${fi(Object.values(L.custBal).filter(v=>v>0.01).length)+" عميل"} onClick=${()=>go("customers")}/>
    </div>
    <section class="flow" aria-label="مسار المشغولات">${LOC_ORDER.map(l=>{const s=locTotal(L.stock,l);return html`<button key=${l} onClick=${()=>go(LOC_PAGE[l])}><span class="k"><i style=${{background:LOC_COLOR[l]}}></i>${LOC[l]}</span><span class="v num">${fi(s.c)}</span><span class="w"><span class="num">${fg(s.w)}</span> جم</span><span class="bar"><span style=${{width:Math.max(0,s.w/flowMax*100)+"%"}}></span></span></button>`})}</section>
    <div class="g2">
      <${Card} title="الخسية اليومية" sub="آخر 30 يوماً — مرّر على العمود لرؤية التفاصيل"><${KhisyaChart} L=${L} limit=${limit}/></${Card}>
      <${Card} title="التنبيهات" sub=${alerts.length?alerts.length+" يحتاج متابعة":"كل شيء في حدوده"}>
        <ul class="alerts">${alerts.length?alerts.map((a,i)=>html`<li key=${i} class=${a[0]}><${I} n="alert"/><div style=${{flex:1}}><b>${a[1]}</b><small>${a[2]}</small></div><button class="btn sm ghost" onClick=${()=>go(a[3])}>فتح</button></li>`)
          :html`<li class="ok"><${I} n="check"/><div><b>لا توجد تنبيهات</b><small>الخسية والأرصدة والأسعار في حدودها.</small></div></li>`}</ul>
      </${Card}>
    </div>
    <div class="g2">
      <${Card} title="آخر الحركات" sub="من كل الأقسام" actions=${html`<button class="btn sm" onClick=${()=>go("reports")}>كل السجل</button>`}>
        ${recent.length?html`<ul class="feed">${recent.map(e=>html`<li key=${e.id} style=${e.void?{opacity:.55}:null}><span class="ic"><${I} n=${MAP_ICON[e._map]}/></span><div><div class="t1">${describe(e,catalog,customers)}</div><div class="t2"><${Who} id=${e.by} names=${names}/> · <span class="num">${e._date}</span>${e.void?" · ملغى":""}</div></div><time class="num">${tme(e.ts)}</time></li>`)}</ul>`
          :html`<${Empty} icon="clock" t="لا توجد حركات بعد" s="ابدأ باستلام سبيكة أو تسجيل صف سبك."/>`}
      </${Card}>
      <${Card} title="أكثر الأصناف إنتاجاً" sub="آخر 30 يوماً">
        ${topItems.length?html`<div class="tw"><table class="t"><thead><tr><th>الصنف</th><th class="n">القطع</th><th class="n">الوزن</th></tr></thead><tbody>${topItems.map(([k,b])=>html`<tr key=${k}><td>${catalog[k]?.name||k}</td><td class="n">${fi(b.c)}</td><td class="n">${fg(b.w)}</td></tr>`)}</tbody></table></div>`:html`<${Empty} t="لا إنتاج في آخر 30 يوماً" s=""/>`}
      </${Card}>
    </div>
  </${React.Fragment}>`;
}
function describe(e,catalog,customers){
  const it=e.item&&catalog[e.item]?catalog[e.item].name:"";
  switch(e._map){
    case "bars":return "استلام سبيكة "+e.serial+(e.dest==="shop"?" (وارد محل)":"")+" — "+fg(n(e.weight))+" جم";
    case "strips":return (e.kind==="return"?"رد للخزنة ":"صرف شرايط ")+fg(n(e.weight))+" جم"+(it?" لـ "+it:"");
    case "casting":return "سبك "+it+" × "+fi(n(e.count))+" — خسية "+fg(khisya(e))+" جم";
    case "moves":return (ACTIONS[e.action]?.label||"حركة")+": "+it+" × "+fi(n(e.count));
    case "sales":return "فاتورة "+(e.no||"")+" — "+((customers[e.customer]||{}).name||"عميل")+" — "+fm(n(e.total))+" ج.م";
    case "payments":return "تحصيل من "+((customers[e.customer]||{}).name||"عميل")+" — "+fm(n(e.amount))+" ج.م";
    case "counts":{const ls=e.lines||[];const dw=ls.reduce((a,l)=>a+n(l.dw),0);return "جرد "+((COUNT_LOCS.find(x=>x[0]===e.loc)||[0,""])[1])+" — "+ls.length+" صنف، فرق "+fg(dw)+" جم"}
    case "labels":return "ملصقات "+e.prefix+" — "+fi(n(e.count))+" × "+it;
    case "sessions":if(GOLD_JOBS.includes(e.job))return (e.end?"استلام من ":"تسليم ")+(e.wname||"")+" — "+JOBS[e.job].label+" "+fg(n(e.inW))+" جم"+(e.end?" · خسية "+fg(n(e.loss)):"");return (e.end?"جلسة ":"بدء وقت ")+(e.wname||"")+" — "+(e.task||"")+(e.end?" · "+fh(sesHours(e))+" · "+fi(n(e.pcs))+" قطعة":"");
    case "evals":return "تقييم "+(e.wname||"")+": "+(RATING[e.rating]?.[0]||"")+(e.note?" — "+e.note:"");
  }return "";
}

/* ---------- bars ---------- */
function BarsPage({L,can,toast,names,role,open,intent,go}){
  const [sheet,setSheet]=useState(false);const [show,setShow]=useState(null);
  useEffect(()=>{if(intent&&intent.bar){const b=L.all.find(e=>e._map==="bars"&&e.serial===intent.bar);if(b)setShow(b)}},[intent]);
  const rows=L.all.filter(e=>e._map==="bars").reverse();const shopBars=Object.values(L.bars).filter(b=>b.dest==="shop");
  const cols=[
    {key:"serial",label:"رقم السبيكة",render:r=>html`<span class="num strong">${r.serial}</span>`},
    {key:"_date",label:"التاريخ",render:r=>html`<span class="num">${r._date}</span>`},
    {key:"weight",label:"الوزن (جم)",num:1,get:r=>n(r.weight),render:r=>fg(n(r.weight))},
    {key:"karat",label:"العيار",get:r=>n(r.karat),render:r=>karatLabel(r.karat)},
    {key:"fine",label:"الفاين",num:1,get:r=>n(r.weight)*n(r.karat)/1000,render:r=>fg(n(r.weight)*n(r.karat)/1000)},
    {key:"issued",label:"صُرف منها",num:1,get:r=>L.bars[r.serial]?.issued||0,render:r=>fg(L.bars[r.serial]?.issued||0)},
    {key:"dest",label:"المكان",get:r=>r.dest==="shop"?"وارد محل":"الخزنة",render:r=>html`<${Badge} tone=${r.dest==="shop"?"warn":"gold"}>${r.dest==="shop"?"وارد محل":"الخزنة"}</${Badge}>`,cls:"keep"},
    {key:"source",label:"المصدر",get:r=>r.source||"—"},
    {key:"qr",label:"QR",sort:false,render:r=>html`<button class="btn sm ghost" onClick=${ev=>{ev.stopPropagation();setShow(r)}} aria-label="عرض كود QR"><${I} n="qr"/></button>`},stCol()];
  return html`<${React.Fragment}>
    <${PH} title="وارد محل" desc="استلام السبائك البلدي الخام — بتتسلّم لقسم الحل وتتحول لعيار 1000 في الخزنة">${can&&html`<button class="btn p" onClick=${()=>setSheet(true)}><${I} n="plus"/>استلام سبيكة</button>`}</${PH}>
    ${!can&&html`<${ReadOnly} role=${role}/>`}
    <div class="kpis">
      <${Kpi} icon="bar" label="رصيد وارد محل" value=${fg(L.P.shop.w)} unit="جم" sub=${"فاين "+fg(L.P.shop.f)}/>
      <${Kpi} icon="drop" label="مع عمال الحل" value=${fg(L.W.refine.w)} unit="جم" sub="شغل جاري" onClick=${()=>go("refine")}/>
      <${Kpi} icon="qr" label="سبائك وارد محل" value=${fi(shopBars.length)} sub=${fi(shopBars.filter(b=>n(b.weight)-b.issued>0.01).length)+" لم تُحل بالكامل"}/>
    </div>
    <${Card} title="سجل السبائك" sub="اضغط على أي سبيكة لعرض التفاصيل">
      <${DataTable} cols=${cols} rows=${rows} sort=${["_date","desc"]} rowCls=${voidCls} onRow=${r=>open(r)} searchPh="رقم السبيكة أو المصدر" empty=${html`<${Empty} icon="bar" t="لا توجد سبائك" s=${can?"اضغط «استلام سبيكة» لتسجيل أول سبيكة.":""}/>`}/>
    </${Card}>
    ${sheet&&html`<${BarSheet} L=${L} dest="shop" toast=${toast} onClose=${()=>setSheet(false)}/>`}
    ${show&&html`<${Modal} label="كود السبيكة" onClose=${()=>setShow(null)}><div class="sheet__h"><div><h3>سبيكة <span class="num">${show.serial}</span></h3><p>${fg(n(show.weight))} جم · عيار ${karatLabel(show.karat)}</p></div><button class="btn ghost sm" onClick=${()=>setShow(null)} aria-label="إغلاق"><${I} n="x"/></button></div><div class="sheet__b"><${QR} text=${"https://qr.gold-era.com/bar/"+show.serial}/></div></${Modal}>`}
  </${React.Fragment}>`;
}
const serialClean=s=>{const m=String(s).match(/bar\/([A-Za-z0-9-]+)/);return (m?m[1]:String(s)).trim()};
function BarSheet({L,toast,onClose,dest}){const shop=dest==="shop";const pool=shop?L.P.shop:L.P.vault;
  const [f,setF]=useState({serial:"",weight:"",karat:shop?"875":"999.9",source:"",note:""});const [err,setErr]=useState("");const [busy,setBusy]=useState(false);
  const up=(k,v)=>setF(o=>({...o,[k]:v}));
  const save=async more=>{setErr("");const serial=serialClean(f.serial);
    if(!serial)return setErr("اكتب رقم السبيكة أو الصق رابط الـ QR.");if(L.bars[serial])return setErr("السبيكة "+serial+" مسجلة من قبل.");if(n(f.weight)<=0)return setErr("اكتب وزن السبيكة.");
    setBusy(true);try{await addEntry("bars",{serial,dest:shop?"shop":"vault",weight:n(f.weight),karat:n(f.karat),source:f.source.trim(),note:f.note.trim()});toast("سُجلت السبيكة "+serial);
      if(more)setF({serial:"",weight:"",karat:f.karat,source:f.source,note:""});else onClose()}catch(er){setErr(errText(er))}setBusy(false)};
  return html`<${Sheet} title=${shop?"استلام سبيكة — وارد محل":"استلام خام مباشر للخزنة"} sub=${shop?"سبائك بلدي خام، تتسلّم بعد كده لقسم الحل":"دهب صافي يدخل خام الخزنة من غير حل"} onClose=${onClose} footer=${html`<span class="msg">${err}</span><button class="btn" disabled=${busy} onClick=${()=>save(true)}>حفظ وإضافة أخرى</button><button class="btn p" disabled=${busy} onClick=${()=>save(false)}><${I} n="check"/>حفظ</button>`}>
    <div class="fg">
      <${F} full label="رقم السبيكة" hint="أو الصق رابط qr.gold-era.com/bar/…"><input id="bar-serial" class="in nm" autoFocus value=${f.serial} onInput=${e=>up("serial",e.target.value)} placeholder="791748110269161554"/></${F}>
      <${F} label="الوزن (جم)"><${Num} id="bar-w" value=${f.weight} set=${v=>up("weight",v)}/></${F}>
      <${F} label="العيار"><${Sel} id="bar-k" value=${f.karat} set=${v=>up("karat",v)}>${KARATS.map(([v,l])=>html`<option key=${v} value=${v}>${l}</option>`)}</${Sel}></${F}>
      <${F} label="المصدر / المورد"><input id="bar-src" class="in" value=${f.source} onInput=${e=>up("source",e.target.value)}/></${F}>
      <${F} label="ملاحظة"><input id="bar-note" class="in" value=${f.note} onInput=${e=>up("note",e.target.value)}/></${F}>
    </div>
    <${Calc} items=${[["الفاين",fg(n(f.weight)*n(f.karat)/1000)+" جم","hl"],[(shop?"رصيد وارد محل":"خام الخزنة")+" بعد الحفظ",fg(pool.w+n(f.weight))+" جم"],["العيار",karatLabel(f.karat)]]}/>
  </${Sheet}>`;
}

/* ---------- gold departments: الحل · الشرايط · التصنيع (every job starts its worker's clock) ---------- */
const fhs=ms=>{const s=Math.max(0,Math.floor(ms/1000));return Math.floor(s/3600)+":"+pad(Math.floor(s%3600/60))+":"+pad(s%60)};
const inRangeD=(d,r)=>r==="all"||(d&&d>=addDays(today(),-(+r-1)));
const jobOut=e=>e.job==="mfg"?(e.lines||[]).reduce((a,l)=>a+n(l.scale),0):n(e.outW);
const jobItems=(e,catalog)=>(e.lines||[]).filter(l=>l.item).map(l=>(catalog[l.item]?.name||"صنف")+" × "+fi(n(l.count))).join("، ");
async function startJob(job,w,body){const J=JOBS[job];return addEntry("sessions",{worker:w.id,wname:w.name,dept:J.dept,task:J.label,job,...body,start:new Date().toISOString(),end:null},today())}
async function closeTimer(s,extra){const end=new Date().toISOString();await stopSession(s,{end,hours:r2(hrs(new Date(end)-new Date(s.start))),...extra})}
const runningOf=(L,job)=>L.live.filter(e=>e._map==="sessions"&&e.job===job&&!e.end).sort((a,b)=>String(a.start).localeCompare(String(b.start)));
function SrcLabel({s}){return html`<${Badge} tone=${s==="strips"?"info":s==="shop"?"warn":"gold"}>${POOL[s]||"—"}</${Badge}>`}

function JobPage({job,L,catalog,workers,orders,can,toast,open,config,role}){
  useTick(1000);const J=JOBS[job];const limit=n(config.khisyaLimit)||0.5;
  const [start,setStart]=useState(false);const [close,setClose]=useState(null);const [rg,setRg]=useState("7");
  const t=today();const ses=L.live.filter(e=>e._map==="sessions"&&e.job===job);const running=runningOf(L,job);
  const done=L.all.filter(e=>e._map==="sessions"&&e.job===job&&e.end&&inRangeD(endDay(e),rg)).sort((a,b)=>String(b.end).localeCompare(String(a.end)));
  const tIn=ses.filter(e=>e._date===t).reduce((a,e)=>a+n(e.inW),0);
  const tOut=ses.filter(e=>e.end&&endDay(e)===t).reduce((a,e)=>a+jobOut(e),0);
  const tLoss=L.losses.filter(x=>x.job===job&&x._date===t).reduce((a,x)=>a+x.w,0);
  const prodT=L.prod.filter(e=>e._date===t);const pcsT=prodT.reduce((a,e)=>a+n(e.count),0);
  const runCols=[
    {key:"wname",label:"العامل",render:r=>html`<span class="strong">${r.wname}</span><span class="sub">${r.item&&catalog[r.item]?catalog[r.item].name:(r.orderNo?"أمر #"+r.orderNo:"")}</span>`},
    {key:"start",label:"استلم",get:r=>r.start,render:r=>html`<span class="num">${hhmm(r.start)}</span>${r._date!==t&&html`<span class="sub num">${r._date}</span>`}`},
    {key:"dur",label:"الوقت",num:1,get:r=>Date.now()-new Date(r.start),render:r=>html`<span class="strong timer">${fhs(Date.now()-new Date(r.start))}</span>`},
    {key:"inW",label:"الوزنة (جم)",num:1,get:r=>n(r.inW),render:r=>html`${fg(n(r.inW))}<span class="sub">عيار ${fi(n(r.inK)||1000)}</span>`},
    {key:"src",label:"من",get:r=>r.src,render:r=>html`<${SrcLabel} s=${r.src}/>`,cls:"keep"},
    {key:"act",label:"",sort:false,cls:"keep",render:r=>can?html`<button class="btn sm p" onClick=${ev=>{ev.stopPropagation();setClose(r)}}><${I} n="check"/>استلام من العامل</button>`:null}];
  const doneCols=[
    {key:"end",label:"سلّم",get:r=>r.end,render:r=>html`<span class="num">${endDay(r)}</span><span class="sub num">${hhmm(r.start)} ← ${hhmm(r.end)}</span>`},
    {key:"wname",label:"العامل"},
    {key:"h",label:"المدة",num:1,get:r=>sesHours(r),render:r=>fh(sesHours(r))},
    {key:"inW",label:"استلم",num:1,get:r=>n(r.inW),render:r=>fg(n(r.inW))},
    {key:"out",label:job==="mfg"?"الأصناف":"الناتج",num:job!=="mfg",cls:job==="mfg"?"wrap":"",get:r=>jobOut(r),render:r=>job==="mfg"?html`<span>${jobItems(r,catalog)||"—"}</span><span class="sub num">${fg(jobOut(r))} جم</span>`:fg(jobOut(r))},
    {key:"retW",label:"مرتجع",num:1,get:r=>n(r.retW),render:r=>n(r.retW)?fg(n(r.retW)):"—"},
    {key:"loss",label:"الخسية",num:1,get:r=>n(r.loss),render:r=>html`<span class=${n(r.loss)>limit?"neg strong":""}>${fg(n(r.loss))}</span>`},stCol()];
  const kp=job==="refine"?html`
      <${Kpi} icon="bar" label="رصيد وارد محل" value=${fg(L.P.shop.w)} unit="جم" sub=${"فاين "+fg(L.P.shop.f)}/>
      <${Kpi} icon="clock" label="مع عمال الحل الآن" value=${fg(L.W.refine.w)} unit="جم" sub=${fi(running.length)+" عامل"}/>
      <${Kpi} icon="drop" label="خرج من الحل اليوم" value=${fg(tOut)} unit="جم" sub="عيار 1000 → الخزنة"/>
      <${Kpi} icon="flame" label="خسية الحل اليوم" value=${fg(tLoss)} unit="جم فاين" alert=${tLoss>limit}/>`
    :job==="strip"?html`
      <${Kpi} icon="bar" label="خام الخزنة" value=${fg(L.P.vault.w)} unit="جم"/>
      <${Kpi} icon="clock" label="مع عمال الشرايط الآن" value=${fg(L.W.strip.w)} unit="جم" sub=${fi(running.length)+" عامل"}/>
      <${Kpi} icon="strips" label="شرايط جاهزة للتصنيع" value=${fg(L.P.strips.w)} unit="جم" sub=${"خرج اليوم "+fg(tOut)}/>
      <${Kpi} icon="flame" label="خسية الشرايط اليوم" value=${fg(tLoss)} unit="جم" alert=${tLoss>limit}/>`
    :html`
      <${Kpi} icon="bar" label="متاح للتصنيع" value=${fg(L.P.vault.w+L.P.strips.w)} unit="جم" sub=${"خام "+fg(L.P.vault.w)+" · شرايط "+fg(L.P.strips.w)}/>
      <${Kpi} icon="clock" label="مع عمال التصنيع الآن" value=${fg(L.W.mfg.w)} unit="جم" sub=${fi(running.length)+" عامل"}/>
      <${Kpi} icon="box" label="إنتاج اليوم" value=${fi(pcsT)} unit="قطعة" sub=${fg(prodT.reduce((a,e)=>a+n(e.scale),0))+" جم · استلموا "+fg(tIn)}/>
      <${Kpi} icon="flame" label="خسية التصنيع اليوم" value=${fg(tLoss)} unit="جم" alert=${tLoss>limit}/>`;
  return html`<${React.Fragment}>
    <${PH} title=${J.title} desc=${J.desc}>${can&&html`<button class="btn p" onClick=${()=>setStart(true)}><${I} n="plus"/>${J.verb}</button>`}</${PH}>
    ${!can&&html`<${ReadOnly} role=${role}/>`}
    <div class="kpis">${kp}</div>
    <${Card} title="شغل جاري الآن" sub=${running.length?"الوقت بدأ تلقائياً لحظة الاستلام، ويقف لما تستلم من العامل":"مفيش وزنة مع أي عامل دلوقتي"}>
      <${DataTable} cols=${runCols} rows=${running} pageSize=${30} onRow=${open} searchPh="اسم العامل" empty=${html`<${Empty} icon="clock" t="لا يوجد شغل جاري" s=${can?"اضغط «"+J.verb+"» لتسليم وزنة لعامل.":""}/>`}/>
    </${Card}>
    <${Card} title="سجل التسليم" actions=${html`<${Range} value=${rg} set=${setRg}/>`}>
      <${DataTable} cols=${doneCols} rows=${done} sort=${["end","desc"]} rowCls=${voidCls} onRow=${open} empty=${html`<${Empty} icon=${J.icon} t="لا يوجد شغل مُسلَّم في الفترة" s=""/>`}/>
    </${Card}>
    ${start&&html`<${JobStartSheet} job=${job} L=${L} catalog=${catalog} workers=${workers} orders=${orders} toast=${toast} onClose=${()=>setStart(false)}/>`}
    ${close&&html`<${JobCloseSheet} e=${close} L=${L} catalog=${catalog} config=${config} toast=${toast} onClose=${()=>setClose(null)}/>`}
  </${React.Fragment}>`;
}

function JobStartSheet({job,L,catalog,workers,orders,toast,onClose}){
  const J=JOBS[job];
  const [f,setF]=useState({worker:"",src:J.src[0],serial:"",weight:"",karat:"875",item:"",order:"",note:""});const [err,setErr]=useState("");const [busy,setBusy]=useState(false);
  const up=(k,v)=>setF(o=>({...o,[k]:v}));const pool=L.P[f.src]||{w:0,f:0};
  const bars=job==="refine"?Object.values(L.bars).filter(b=>b.dest==="shop"&&n(b.weight)-b.issued>0.001):[];
  const k=job==="refine"?n(f.karat):r2(pk(pool));
  const save=async()=>{setErr("");const w=workers[f.worker];if(!w)return setErr("اختر العامل.");if(n(f.weight)<=0)return setErr("اكتب الوزنة.");
    if(n(f.weight)>pool.w+0.001)return setErr("رصيد "+POOL[f.src]+" "+fg(pool.w)+" جم فقط.");if(job==="refine"&&!k)return setErr("اختر العيار.");
    setBusy(true);try{await startJob(job,w,{src:f.src,inW:r2(n(f.weight)),inK:k,serial:f.serial,item:f.item,order:f.order,orderNo:f.order&&orders[f.order]?orders[f.order].no:0,note:f.note.trim()});
      toast("استلم "+w.name+" "+fg(n(f.weight))+" جم — بدأ الوقت تلقائياً");onClose()}catch(e){setErr(errText(e))}setBusy(false)};
  return html`<${Sheet} title=${J.verb} sub=${"من "+POOL[f.src]+" — الوقت يبدأ لحظة الحفظ"} onClose=${onClose} footer=${html`<span class="msg">${err}</span><button class="btn" onClick=${onClose}>إلغاء</button><button class="btn p" disabled=${busy} onClick=${save}><${I} n="clock"/>تسليم وبدء الوقت</button>`}>
    <div class="fg">
      <${F} full label="العامل" hint=${"عمال قسم "+J.dept+" أولاً"}><${WorkerSel} id="js-w" workers=${workers} dept=${J.dept} value=${f.worker} set=${v=>up("worker",v)}/></${F}>
      ${J.src.length>1&&html`<${F} full label="من"><${Seg} opts=${J.src.map(s=>[s,POOL[s]+" · "+fg(L.P[s].w)])} value=${f.src} set=${v=>up("src",v)}/></${F}>`}
      ${job==="refine"&&html`<${F} full label="السبيكة" hint="اختياري — يملأ الوزن والعيار"><${Sel} id="js-bar" value=${f.serial} set=${v=>{up("serial",v);const b=L.bars[v];if(b){up("weight",String(r2(n(b.weight)-b.issued)));up("karat",String(b.karat))}}}><option value="">بدون</option>${bars.map(b=>html`<option key=${b.serial} value=${b.serial}>${b.serial} — ${fg(n(b.weight)-b.issued)} جم · ${karatLabel(b.karat)}</option>`)}</${Sel}></${F}>`}
      <${F} label="الوزنة (جم)"><${Num} id="js-wt" value=${f.weight} set=${v=>up("weight",v)}/></${F}>
      ${job==="refine"?html`<${F} label="العيار"><${Sel} id="js-k" value=${f.karat} set=${v=>up("karat",v)}>${KARATS.map(([v,l])=>html`<option key=${v} value=${v}>${l}</option>`)}</${Sel}></${F}>`
        :html`<${F} label="العيار" hint="متوسط عيار المصدر"><input class="in nm" readOnly value=${fi(k)}/></${F}>`}
      ${job!=="refine"&&html`<${F} full label="أمر التصنيع" hint="اختياري — يحدد الصنف"><${OrderSel} id="js-order" orders=${orders} value=${f.order} set=${v=>{up("order",v);if(v&&orders[v])up("item",orders[v].item)}}/></${F}>`}
      ${job!=="refine"&&html`<${F} full label="الصنف المطلوب" hint="اختياري"><${ItemSel} id="js-item" value=${f.item} set=${v=>up("item",v)} catalog=${catalog}/></${F}>`}
      <${F} full label="ملاحظة"><input id="js-note" class="in" value=${f.note} onInput=${e=>up("note",e.target.value)}/></${F}>
    </div>
    <${Calc} items=${[["الفاين",fg(n(f.weight)*k/1000)+" جم","hl"],["رصيد "+POOL[f.src]+" بعد التسليم",fg(pool.w-n(f.weight))+" جم",pool.w-n(f.weight)<-0.001?"neg":""],["الوقت","يبدأ تلقائياً"]]}/>
  </${Sheet}>`;
}

function JobCloseSheet({e,L,catalog,config,toast,onClose}){
  useTick(1000);const job=e.job;const J=JOBS[job];const iw=n(e.inW),ik=n(e.inK)||1000;const limit=n(config&&config.khisyaLimit)||0.5;
  const [f,setF]=useState({outW:"",retW:"",castW:"",cutW:"",added:"",note:e.note||""});const [lines,setLines]=useState([{item:e.item||"",count:"",scale:""}]);
  const [err,setErr]=useState("");const [busy,setBusy]=useState(false);const up=(k,v)=>setF(o=>({...o,[k]:v}));
  const setLn=(i,k,v)=>setLines(ls=>ls.map((l,j)=>j===i?{...l,[k]:v}:l));
  const ls=lines.filter(l=>l.item&&n(l.count)>0);const sc=ls.reduce((a,l)=>a+n(l.scale),0);
  const actual=ls.reduce((a,l)=>a+n(catalog[l.item]?.w)*n(l.count),0);
  const retAuto=job==="mfg"&&f.cutW!==""?r2(Math.max(0,n(f.cutW)-sc)):null;
  const rw=f.retW!==""?n(f.retW):(retAuto||0);
  const loss=job==="refine"?(iw-rw)*ik/1000-n(f.outW):job==="strip"?iw-rw-n(f.outW):iw+n(f.added)-sc-rw;
  const ms=Date.now()-new Date(e.start);
  const save=async()=>{setErr("");
    if(rw>iw+0.001)return setErr("المرتجع أكبر من الوزنة المستلمة.");
    if(job!=="mfg"&&n(f.outW)<=0&&rw<=0)return setErr("اكتب "+J.outL+".");
    if(job==="mfg"){if(lines.some(l=>l.item&&n(l.count)>0&&n(l.scale)<=0))return setErr("اكتب وزن الميزان لكل صنف.");if(!ls.length&&rw<=0)return setErr("سجّل الأصناف المنتجة أو الوزنة المرتجعة.")}
    if(loss<-0.05)return setErr("الخارج أكبر من المستلم بـ "+fg(-loss)+" جم."+(job==="mfg"?" لو أضفت نحاس للعيار اكتبه في «إضافة للعيار».":" راجع الأوزان."));
    const body={end:new Date().toISOString(),hours:r2(hrs(ms)),retW:r2(rw),loss:r2(loss),note:f.note.trim()};
    if(job==="mfg")Object.assign(body,{lines:ls.map(l=>({item:l.item,count:n(l.count),scale:r2(n(l.scale))})),castW:r2(n(f.castW)),cutW:r2(n(f.cutW)),added:r2(n(f.added)),pcs:ls.reduce((a,l)=>a+n(l.count),0),weight:r2(sc)});
    else Object.assign(body,{outW:r2(n(f.outW)),pcs:0,weight:r2(n(f.outW))});
    setBusy(true);try{await stopSession(e,body);toast("استُلم من "+e.wname+" — "+fhs(ms)+" · خسية "+fg(loss));onClose()}catch(x){setErr(errText(x))}setBusy(false)};
  const has=k=>f[k]!=="";
  return html`<${Sheet} title=${"استلام من "+e.wname} sub=${J.label+" · استلم "+fg(iw)+" جم عيار "+fi(ik)+" الساعة "+hhmm(e.start)} onClose=${onClose} footer=${html`<span class="msg">${err}</span><button class="btn" onClick=${onClose}>إلغاء</button><button class="btn p" disabled=${busy} onClick=${save}><${I} n="check"/>استلام وإيقاف الوقت</button>`}>
    <div class="note"><${I} n="clock"/><span>الوقت شغال: <b class="num timer">${fhs(ms)}</b> — يقف لحظة الحفظ.</span></div>
    ${job==="mfg"?html`
      <div class="sect">الأوزان</div>
      <div class="fg">
        <${F} label="وزنة السبك" hint="اختياري"><${Num} id="jc-cast" value=${f.castW} set=${v=>up("castW",v)}/></${F}>
        <${F} label="وزنة التقطيع" hint="اختياري — تحسب المتبقي"><${Num} id="jc-cut" value=${f.cutW} set=${v=>up("cutW",v)}/></${F}>
        <${F} label="إضافة للعيار (نحاس)" hint="لأصناف 21 من دهب 1000"><${Num} id="jc-add" value=${f.added} set=${v=>up("added",v)}/></${F}>
        <${F} label="الوزنة المتبقية المرتجعة" hint=${retAuto!==null&&f.retW===""?"محسوبة: التقطيع − الميزان":"ترجع "+POOL[e.src||"vault"]}><${Num} id="jc-ret" value=${f.retW!==""?f.retW:(retAuto!==null?String(retAuto):"")} set=${v=>up("retW",v)}/></${F}>
      </div>
      <div class="sect">الأصناف المنتجة</div>
      <div class="tw"><table class="t lines"><thead><tr><th>الصنف</th><th class="n">العدد</th><th class="n">الوزن على الميزان</th><th class="n">الفعلي</th><th></th></tr></thead><tbody>
        ${lines.map((l,i)=>{const it=catalog[l.item];return html`<tr key=${i}><td style=${{minWidth:"170px"}}><${ItemSel} id=${"jc-it-"+i} value=${l.item} set=${v=>setLn(i,"item",v)} catalog=${catalog}/></td>
          <td style=${{width:"90px"}}><${Num} id=${"jc-c-"+i} ph="0" value=${l.count} set=${v=>setLn(i,"count",v)}/></td>
          <td style=${{width:"120px"}}><${Num} id=${"jc-s-"+i} ph=${it&&n(l.count)?fg(n(it.w)*n(l.count)):"0.00"} value=${l.scale} set=${v=>setLn(i,"scale",v)}/></td>
          <td class="n">${it?fg(n(it.w)*n(l.count)):"—"}</td>
          <td>${lines.length>1&&html`<button class="btn ghost sm" aria-label="حذف الصنف" onClick=${()=>setLines(x=>x.filter((_,j)=>j!==i))}><${I} n="x"/></button>`}</td></tr>`})}
      </tbody></table></div>
      <button class="btn sm" style=${{justifySelf:"start"}} onClick=${()=>setLines(x=>[...x,{item:"",count:"",scale:""}])}><${I} n="plus"/>صنف آخر</button>
      <${Calc} items=${[["المستلم",fg(iw)+" جم"],["الأصناف (ميزان)",fg(sc)+" جم"],["الفرق عن الفعلي",fg(actual-sc),actual-sc<-0.005?"neg":""],["خسية السبك",has("castW")?fg(iw+n(f.added)-n(f.castW)):"—"],["خسية التقطيع",has("castW")&&has("cutW")?fg(n(f.castW)-n(f.cutW)):"—"],["الخسية",fg(loss),loss>limit?"neg":"hl"],["قطعة/ساعة",ms>60000&&ls.length?(ls.reduce((a,l)=>a+n(l.count),0)/hrs(ms)).toFixed(1):"—"]]}/>`
    :html`
      <div class="fg">
        <${F} label=${J.outL}><${Num} id="jc-out" value=${f.outW} set=${v=>up("outW",v)}/></${F}>
        <${F} label="مرتجع بدون شغل" hint=${"يرجع "+POOL[e.src||J.src[0]]}><${Num} id="jc-ret" value=${f.retW} set=${v=>up("retW",v)}/></${F}>
      </div>
      <${Calc} items=${job==="refine"?[["الفاين المستلم",fg(iw*ik/1000)+" جم"],["المتوقع بعد الحل",fg((iw-rw)*ik/1000)+" جم"],["الخسية",fg(loss)+" جم",loss>limit?"neg":"hl"],["يدخل الخزنة",fg(n(f.outW))+" جم عيار 1000"]]
        :[["المستلم",fg(iw)+" جم"],["الشرايط",fg(n(f.outW))+" جم"],["الخسية",fg(loss)+" جم",loss>limit?"neg":"hl"],["تدخل",POOL.strips]]}/>`}
    <${F} full label="ملاحظة"><input id="jc-note" class="in" value=${f.note} onInput=${x=>up("note",x.target.value)}/></${F}>
  </${Sheet}>`;
}

/* timers for the item stages (التجهيز / التغليف) */
function TimerStartSheet({job,catalog,workers,toast,onClose}){
  const J=JOBS[job];const tasks=job==="prep"?WORKS:["تشطيب","تغليف","تكويد"];
  const [wid,setW]=useState("");const [task,setTask]=useState(tasks[0]);const [item,setItem]=useState("");const [err,setErr]=useState("");const [busy,setBusy]=useState(false);
  const save=async()=>{setErr("");const w=workers[wid];if(!w)return setErr("اختر العامل.");setBusy(true);try{await startJob(job,w,{task,item,inW:0});toast("بدأ وقت "+w.name);onClose()}catch(e){setErr(errText(e))}setBusy(false)};
  return html`<${Sheet} title=${"بدء شغل — "+J.label} sub="الوقت يبدأ لحظة الحفظ" onClose=${onClose} footer=${html`<span class="msg">${err}</span><button class="btn" onClick=${onClose}>إلغاء</button><button class="btn p" disabled=${busy} onClick=${save}><${I} n="clock"/>بدء</button>`}>
    <div class="fg"><${F} full label="العامل"><${WorkerSel} id="ts-w" workers=${workers} dept=${J.dept} value=${wid} set=${setW}/></${F}>
      <${F} label="الشغل"><${Sel} id="ts-task" value=${task} set=${setTask}>${tasks.map(t=>html`<option key=${t}>${t}</option>`)}</${Sel}></${F}>
      <${F} label="الصنف" hint="اختياري"><${ItemSel} id="ts-item" value=${item} set=${setItem} catalog=${catalog}/></${F}></div>
  </${Sheet}>`;
}
function StageTimers({job,L,catalog,workers,can,toast,open}){
  useTick(1000);const [st,setSt]=useState(false);const [stop,setStop]=useState(null);const rows=runningOf(L,job);
  const cols=[{key:"wname",label:"العامل",render:r=>html`<span class="strong">${r.wname}</span><span class="sub">${r.task||""}${r.item&&catalog[r.item]?" · "+catalog[r.item].name+(r.count?" × "+fi(n(r.count)):""):""}</span>`},
    {key:"start",label:"بدأ",render:r=>html`<span class="num">${hhmm(r.start)}</span>`},
    {key:"dur",label:"الوقت",num:1,get:r=>Date.now()-new Date(r.start),render:r=>html`<span class="strong timer">${fhs(Date.now()-new Date(r.start))}</span>`},
    {key:"act",label:"",sort:false,cls:"keep",render:r=>can?html`<button class="btn sm d" onClick=${ev=>{ev.stopPropagation();setStop(r)}}>إنهاء</button>`:null}];
  return html`<${Card} title="العمال الشغالين الآن" sub="الوقت يبدأ تلقائياً عند التسليم للعامل، ويقف عند الاستلام منه" actions=${can&&html`<button class="btn sm" onClick=${()=>setSt(true)}><${I} n="clock"/>بدء شغل</button>`}>
    <${DataTable} cols=${cols} rows=${rows} pageSize=${20} onRow=${open} empty=${html`<${Empty} icon="clock" t="لا يوجد عمال شغالين الآن" s=""/>`}/>
    ${st&&html`<${TimerStartSheet} job=${job} catalog=${catalog} workers=${workers} toast=${toast} onClose=${()=>setSt(false)}/>`}
    ${stop&&html`<${StopSheet} e=${stop} catalog=${catalog} toast=${toast} onClose=${()=>setStop(null)}/>`}
  </${Card}>`;
}


/* ---------- stages ---------- */
function StagePage({cfg,L,catalog,workers,can,toast,role,open}){
  const [sheet,setSheet]=useState(null);const [rg,setRg]=useState("30");const [tab,setTab]=useState("log");
  const rows=L.all.filter(e=>e._map==="moves"&&(e.from===cfg.loc||e.to===cfg.loc||(cfg.also&&(e.from===cfg.also||e.to===cfg.also)))&&inRange(e,rg)).reverse();
  const here=locTotal(L.stock,cfg.loc);const live=rows.filter(e=>!e.void);
  const inP=live.filter(e=>e.to===cfg.loc).reduce((a,e)=>a+n(e.count),0),outP=live.filter(e=>e.from===cfg.loc).reduce((a,e)=>a+n(e.count),0);
  const fees=live.reduce((a,e)=>a+n(e.fee),0);
  const stockRows=Object.entries(L.stock[cfg.loc]||{}).filter(([,s])=>Math.abs(s.c)>0.0001).map(([k,s])=>({id:k,...s}));
  const cols=[
    {key:"_date",label:"التاريخ",get:r=>r.ts,render:r=>html`<span class="num">${r._date}</span><span class="sub num">${tme(r.ts)}</span>`},
    {key:"action",label:"الحالة",get:r=>ACTIONS[r.action]?.label,render:r=>html`<${Badge} tone=${BADGE_TONE[ACTIONS[r.action]?.badge||""]}>${ACTIONS[r.action]?.label||r.action}</${Badge}>`},
    {key:"path",label:"من ← إلى",get:r=>LOC[r.from]+" ← "+LOC[r.to]},
    {key:"item",label:"الصنف",get:r=>catalog[r.item]?.name||"—"},
    {key:"count",label:"العدد",num:1,get:r=>n(r.count),render:r=>fi(n(r.count))},
    {key:"weight",label:"الوزن",num:1,get:r=>n(r.weight),render:r=>fg(n(r.weight))},
    ...(cfg.loc!=="finish"?[{key:"boxes",label:"العلب",num:1,get:r=>n(r.boxes),render:r=>r.boxes?fi(n(r.boxes)):"—"}]:[]),
    {key:"worker",label:"المستلم",get:r=>(r.worker||"—")+(r.work?" · "+r.work:"")},
    ...(cfg.loc==="hallmark"?[{key:"fee",label:"الرسوم",num:1,get:r=>n(r.fee),render:r=>r.fee?fm(n(r.fee)):"—"}]:[]),stCol()];
  return html`<${React.Fragment}>
    <${PH} title=${cfg.title} desc=${cfg.sub}><${Range} value=${rg} set=${setRg}/>${can&&cfg.actions.map((a,i)=>html`<button key=${a} class=${"btn"+(i===0?" p":"")} onClick=${()=>setSheet(a)}>${i===0&&html`<${I} n="plus"/>`}${ACTIONS[a].label}</button>`)}</${PH}>
    ${!can&&html`<${ReadOnly} role=${role}/>`}
    <div class="kpis">
      <${Kpi} icon=${NAV_ICON[cfg.loc]||"box"} label=${"المتواجد في "+LOC[cfg.loc]} value=${fi(here.c)} unit="قطعة" sub=${fg(here.w)+" جم"}/>
      ${cfg.also&&html`<${Kpi} icon="box" label=${"جاهز في "+LOC[cfg.also]} value=${fi(locTotal(L.stock,cfg.also).c)} unit="قطعة" sub=${fg(locTotal(L.stock,cfg.also).w)+" جم"}/>`}
      <${Kpi} icon="arrow" label="وارد الفترة" value=${fi(inP)} unit="قطعة"/>
      <${Kpi} icon="arrow" label="صادر الفترة" value=${fi(outP)} unit="قطعة"/>
      ${cfg.loc==="hallmark"&&html`<${Kpi} icon="receipt" label="رسوم الدمغة" value=${fm(fees)} unit="ج.م" sub="في الفترة"/>`}
    </div>
    <${Card} title=${tab==="log"?"سجل الحركة":"المتواجد حالياً"} actions=${html`<div class="seg" role="tablist"><button role="tab" aria-pressed=${tab==="log"?"true":"false"} onClick=${()=>setTab("log")}>السجل</button><button role="tab" aria-pressed=${tab==="stock"?"true":"false"} onClick=${()=>setTab("stock")}>المتواجد <span class="num">(${fi(here.c)})</span></button></div>`}>
      ${tab==="log"?html`<${DataTable} key="log" cols=${cols} rows=${rows} sort=${["_date","desc"]} rowCls=${voidCls} onRow=${open} empty=${html`<${Empty} icon=${NAV_ICON[cfg.loc]} t="لا توجد حركات في هذه الفترة" s=""/>`}/>`
        :html`<${DataTable} key="stock" cols=${[{key:"id",label:"الصنف",get:r=>catalog[r.id]?.name||r.id},{key:"c",label:"العدد",num:1,render:r=>html`<span class=${r.c<0?"neg":""}>${fi(r.c)}</span>`},{key:"w",label:"الوزن (جم)",num:1,render:r=>fg(r.w)}]} rows=${stockRows} foot=${stockRows.length?{c:fi(here.c),w:fg(here.w)}:null} empty=${html`<${Empty} t=${"لا يوجد شيء في "+LOC[cfg.loc]+" الآن"} s=""/>`}/>`}
    </${Card}>
    ${cfg.job&&html`<${StageTimers} job=${cfg.job} L=${L} catalog=${catalog} workers=${workers} can=${can} toast=${toast} open=${open}/>`}
    ${sheet&&html`<${MoveSheet} action=${sheet} L=${L} catalog=${catalog} workers=${workers} toast=${toast} onClose=${()=>setSheet(null)}/>`}
  </${React.Fragment}>`;
}
function MoveSheet({action,L,catalog,workers,toast,onClose}){
  const A=ACTIONS[action];
  const [f,setF]=useState({from:A.from[0],item:"",count:"",weight:"",worker:"",work:WORKS[0],boxes:"",note:"",jobWorker:""});
  const openJobs=A.closeJob?L.live.filter(e=>e._map==="sessions"&&e.job===A.closeJob&&!e.end):[];
  const jobWs=[...new Map(openJobs.map(e=>[e.worker,e.wname])).entries()];const [wEd,setWEd]=useState(false);const [err,setErr]=useState("");const [busy,setBusy]=useState(false);
  const up=(k,v)=>setF(o=>({...o,[k]:v}));
  const avail=(L.stock[f.from]||{})[f.item]||{c:0,w:0};const it=catalog[f.item];
  const autoW=avail.c>0?avail.w/avail.c*n(f.count):(it?n(it.w)*n(f.count):0);const weight=wEd?n(f.weight):autoW;
  const fee=A.fee&&it?n(it.fee)*n(f.count):0;
  const only=Object.keys(L.stock[f.from]||{}).filter(k=>L.stock[f.from][k].c>0);
  const save=async more=>{setErr("");if(!f.item)return setErr("اختر الصنف.");if(n(f.count)<=0)return setErr("اكتب العدد.");
    if(n(f.count)>avail.c+0.0001)return setErr("المتاح في "+LOC[f.from]+" "+fi(avail.c)+" قطعة فقط.");if(A.worker&&!A.workerOpt&&!f.worker)return setErr("اختر "+(action==="to_master"?"المعلم":"المستلم")+".");
    setBusy(true);try{const mv=await addEntry("moves",{action,from:f.from,to:A.to,item:f.item,count:n(f.count),weight:r2(weight),worker:f.worker,work:A.work?f.work:"",boxes:A.boxes?n(f.boxes):0,fee:r2(fee),note:f.note.trim()});
      const wk=Object.values(workers).find(x=>x.name===f.worker);
      if(A.startJob&&wk)await startJob(A.startJob,wk,{task:A.work?f.work:JOBS[A.startJob].label,item:f.item,count:n(f.count),inW:0,moveId:mv.id});
      if(A.closeJob&&f.from===A.closeFrom){const who=A.closeBy==="worker"?(wk&&wk.id):f.jobWorker;if(who)for(const s of openJobs.filter(e=>e.worker===who))await closeTimer(s,{pcs:n(f.count),weight:r2(weight)})}
      toast(A.label+": "+fi(n(f.count))+" "+(it?it.name:""));if(more){setF(o=>({...o,item:"",count:"",weight:"",boxes:"",note:""}));setWEd(false)}else onClose()}catch(er){setErr(errText(er))}setBusy(false)};
  return html`<${Sheet} title=${A.label} sub=${LOC[f.from]+" ← "+LOC[A.to]} onClose=${onClose} footer=${html`<span class="msg">${err}</span><button class="btn" disabled=${busy} onClick=${()=>save(true)}>حفظ وإضافة أخرى</button><button class="btn p" disabled=${busy} onClick=${()=>save(false)}><${I} n="check"/>${A.label}</button>`}>
    <div class="fg">
      ${A.from.length>1&&html`<${F} full label="من"><${Sel} id="mv-from" value=${f.from} set=${v=>{up("from",v);up("item","")}}>${A.from.map(l=>html`<option key=${l} value=${l}>${LOC[l]} — ${fi(locTotal(L.stock,l).c)} قطعة</option>`)}</${Sel}></${F}>`}
      <${F} full label="الصنف" hint=${only.length?"":"لا توجد أصناف متاحة في "+LOC[f.from]}><${ItemSel} id="mv-item" value=${f.item} set=${v=>up("item",v)} catalog=${catalog} only=${only} avail=${L.stock[f.from]}/></${F}>
      <${F} label="العدد"><${Num} id="mv-c" ph="0" value=${f.count} set=${v=>up("count",v)}/></${F}>
      <${F} label="الوزن (جم)" hint=${wEd?"وزن مُدخل يدوياً":"محسوب من متوسط الرصيد"}><${Num} id="mv-w" value=${wEd?f.weight:(autoW?String(r2(autoW)):"")} set=${v=>{setWEd(true);up("weight",v)}}/></${F}>
      ${A.boxes&&html`<${F} label="عدد العلب"><${Num} id="mv-b" ph="0" value=${f.boxes} set=${v=>up("boxes",v)}/></${F}>`}
      ${A.worker&&html`<${F} label=${action==="to_master"?"المعلم":"اسم المستلم"}><${Sel} id="mv-wk" value=${f.worker} set=${v=>up("worker",v)}><option value="">—</option>${workerList(workers,true).map(w=>html`<option key=${w.name} value=${w.name}>${w.name}${deptsOf(w).length?" — "+wDept(w):""}</option>`)}</${Sel}></${F}>`}
      ${A.closeJob&&A.closeBy!=="worker"&&f.from===A.closeFrom&&jobWs.length>0&&html`<${F} label="استلام من العامل" hint="يوقف وقته تلقائياً"><${Sel} id="mv-jw" value=${f.jobWorker} set=${v=>up("jobWorker",v)}><option value="">—</option>${jobWs.map(([id,nm])=>html`<option key=${id} value=${id}>${nm}</option>`)}</${Sel}></${F}>`}
      ${A.startJob&&html`<div class="full sub" style=${{gridColumn:"1/-1"}}>الوقت يبدأ تلقائياً للمستلم لحظة الحفظ.</div>`}
      ${A.work&&html`<${F} label="نوع الشغل"><${Sel} id="mv-work" value=${f.work} set=${v=>up("work",v)}>${WORKS.map(w=>html`<option key=${w}>${w}</option>`)}</${Sel}></${F}>`}
      <${F} full label="ملاحظة"><input id="mv-note" class="in" value=${f.note} onInput=${e=>up("note",e.target.value)}/></${F}>
    </div>
    <${Calc} items=${[["المتاح",f.item?fi(avail.c)+" قطعة":"—"],["بعد الحركة",f.item?fi(avail.c-n(f.count))+" قطعة":"—",avail.c-n(f.count)<0?"neg":""],A.fee?["رسوم الدمغة",fm(fee)+" ج.م","hl"]:["الوزن",fg(weight)+" جم","hl"]]}/>
  </${Sheet}>`;
}

/* ---------- الخزنة: every weight, raw and items, and where each item stands ---------- */
const itemsFine=(X,catalog,locs)=>(locs||LOC_ORDER.filter(l=>l!=="sold")).reduce((a,l)=>a+Object.entries(X.stock[l]||{}).reduce((b,[k,s])=>b+s.w*n(catalog[k]?.karat||999.9)/1000,0),0);
const totalFine=(X,catalog)=>X.P.shop.f+X.P.vault.f+X.P.strips.f+X.W.refine.f+X.W.strip.f+X.W.mfg.f+itemsFine(X,catalog);
function StockPage({L,catalog,can,toast,go}){
  const [sheet,setSheet]=useState(false);
  const locs=LOC_ORDER.filter(l=>l!=="sold");
  const rows=Object.entries(catalog).sort((a,b)=>n(a[1].order)-n(b[1].order)).filter(([k])=>LOC_ORDER.some(l=>L.stock[l][k]&&(Math.abs(L.stock[l][k].c)>0||Math.abs(L.stock[l][k].w)>0.004))).map(([k,it])=>{
    const r={id:k,name:it.name,karat:it.karat};let c=0,w=0;locs.forEach(l=>{const s=L.stock[l][k]||{c:0,w:0};r[l]=s;c+=s.c;w+=s.w});r.tc=c;r.tw=w;r.sold=L.stock.sold[k]||{c:0,w:0};r.fine=w*n(it.karat)/1000;
    r.where=locs.filter(l=>Math.abs(r[l].c)>0.0001).map(l=>LOC[l]+" "+fi(r[l].c)).join(" · ");return r});
  const cell=s=>s&&(s.c||s.w)?html`<span class=${s.c<0?"neg":""}>${fi(s.c)}</span><span class="sub">${fg(s.w)}</span>`:html`<span style=${{color:"var(--line-strong)"}}>—</span>`;
  const cols=[{key:"name",label:"الصنف",render:r=>html`<span class="strong">${r.name}</span><span class="sub">واقف على: ${r.where||"—"}</span>`},
    ...locs.map(l=>({key:l,label:LOC[l],num:1,get:r=>r[l].c,render:r=>cell(r[l])})),
    {key:"tc",label:"الإجمالي",num:1,render:r=>html`<span class="strong">${fi(r.tc)}</span><span class="sub">${fg(r.tw)}</span>`},
    {key:"fine",label:"فاين",num:1,render:r=>fg(r.fine)},{key:"soldc",label:"مباع",num:1,get:r=>r.sold.c,render:r=>cell(r.sold)}];
  const pcs=rows.reduce((a,r)=>a+r.tc,0),wt=rows.reduce((a,r)=>a+r.tw,0),fineIn=itemsFine(L,catalog);
  const withW=L.W.refine.w+L.W.strip.w+L.W.mfg.w;
  const pools=[
    {id:"shop",name:"وارد محل",sub:"سبائك بلدي خام — تنتظر الحل",p:L.P.shop,pg:"bars"},
    {id:"wr",name:"مع عمال الحل",sub:"شغل جاري",p:L.W.refine,pg:"refine"},
    {id:"vault",name:"خام الخزنة",sub:"عيار 1000 بعد الحل",p:L.P.vault,pg:"refine"},
    {id:"ws",name:"مع عمال الشرايط",sub:"شغل جاري",p:L.W.strip,pg:"strips"},
    {id:"strips",name:"شرايط جاهزة",sub:"تنتظر التصنيع",p:L.P.strips,pg:"strips"},
    {id:"wm",name:"مع عمال التصنيع",sub:"شغل جاري",p:L.W.mfg,pg:"casting"},
    ...locs.map(l=>{const t=locTotal(L.stock,l);const f=itemsFine(L,catalog,[l]);return {id:"i-"+l,name:"أصناف — "+LOC[l],sub:fi(t.c)+" قطعة",p:{w:t.w,f},pg:LOC_PAGE[l]}})];
  const tot=pools.reduce((a,r)=>({w:a.w+r.p.w,f:a.f+r.p.f}),{w:0,f:0});
  return html`<${React.Fragment}>
    <${PH} title="الخزنة" desc="كل الأوزان في مكان واحد: الخام، اللي مع العمال، والأصناف وكل صنف واقف على أي مرحلة">${can&&html`<button class="btn" onClick=${()=>setSheet(true)}><${I} n="plus"/>استلام خام مباشر للخزنة</button>`}</${PH}>
    <div class="kpis six">
      <${Kpi} icon="bar" label="خام الخزنة" value=${fg(L.P.vault.w)} unit="جم" sub=${"فاين "+fg(L.P.vault.f)} onClick=${()=>go("refine")}/>
      <${Kpi} icon="bar" label="وارد محل" value=${fg(L.P.shop.w)} unit="جم" sub=${"فاين "+fg(L.P.shop.f)} onClick=${()=>go("bars")}/>
      <${Kpi} icon="strips" label="شرايط جاهزة" value=${fg(L.P.strips.w)} unit="جم" onClick=${()=>go("strips")}/>
      <${Kpi} icon="clock" label="مع العمال الآن" value=${fg(withW)} unit="جم" sub=${"حل "+fg(L.W.refine.w)+" · شرايط "+fg(L.W.strip.w)+" · تصنيع "+fg(L.W.mfg.w)}/>
      <${Kpi} icon="box" label="أصناف في الخزنة" value=${fi(locTotal(L.stock,"vault").c)} unit="قطعة" sub=${fg(locTotal(L.stock,"vault").w)+" جم · كل المراحل "+fi(pcs)}/>
      <${Kpi} icon="chart" label="إجمالي الذهب (فاين)" value=${fg(totalFine(L,catalog))} unit="جم" sub="خام + مع العمال + أصناف"/>
    </div>
    <div class="g2">
      <${Card} title="الأوزان" sub="الرصيد الحالي لكل مكان — اضغط للفتح">
        <div class="tw"><table class="t"><thead><tr><th>المكان</th><th class="n">الوزن (جم)</th><th class="n">فاين</th></tr></thead><tbody>
          ${pools.map(r=>html`<tr key=${r.id} class="click" onClick=${()=>go(r.pg)}><td><span class="strong">${r.name}</span><span class="sub">${r.sub}</span></td><td class=${"n"+(r.p.w<-0.001?" neg":"")}>${fg(r.p.w)}</td><td class="n">${fg(r.p.f)}</td></tr>`)}
        </tbody><tfoot><tr><td>الإجمالي</td><td class="n">${fg(tot.w)}</td><td class="n">${fg(tot.f)}</td></tr></tfoot></table></div>
      </${Card}>
      <${Card} title="السبائك في الخزنة" sub="سبائك استُلمت مباشرة للخزنة">
        <${DataTable} cols=${[{key:"serial",label:"رقم",render:r=>html`<span class="num strong">${r.serial}</span>`},{key:"_date",label:"التاريخ",render:r=>html`<span class="num">${r._date}</span>`},{key:"w",label:"الوزن",num:1,get:r=>n(r.weight),render:r=>fg(n(r.weight))},{key:"k",label:"العيار",get:r=>n(r.karat),render:r=>karatLabel(r.karat)}]} rows=${Object.values(L.bars).filter(b=>b.dest!=="shop").reverse()} pageSize=${8} empty=${html`<${Empty} icon="bar" t="لا توجد سبائك مباشرة" s="الدهب يدخل الخزنة عادةً من قسم الحل."/>`}/>
      </${Card}>
    </div>
    <${Card} title="الأصناف × المراحل" sub="كل صنف واقف فين: العدد، وتحته الوزن بالجرام">
      <${DataTable} cols=${cols} rows=${rows} pageSize=${25} foot=${rows.length?Object.fromEntries([...locs.map(l=>{const t=locTotal(L.stock,l);return [l,html`${fi(t.c)}<span class="sub">${fg(t.w)}</span>`]}),["tc",html`${fi(pcs)}<span class="sub">${fg(wt)}</span>`],["fine",fg(fineIn)]]):null}
        empty=${html`<${Empty} icon="box" t="لا توجد أصناف بعد" s="الأصناف تدخل الخزنة لما تستلم من عامل التصنيع."/>`}/>
    </${Card}>
    ${sheet&&html`<${BarSheet} L=${L} dest="vault" toast=${toast} onClose=${()=>setSheet(false)}/>`}
  </${React.Fragment}>`;
}

/* ---------- المراجعة: the whole day, live ---------- */
function ReviewPage({L,days,catalog,workers,config,go}){
  useTick(1000);const [d,setD]=useState(today());const limit=n(config.khisyaLimit)||0.5;const isT=d===today();
  const O=useMemo(()=>buildLedger(days,catalog,addDays(d,-1)),[days,catalog,d]);
  const C=useMemo(()=>isT?L:buildLedger(days,catalog,d),[days,catalog,d,L,isT]);
  const sum=(a,f)=>a.reduce((x,e)=>x+f(e),0);
  const ses=L.live.filter(e=>e._map==="sessions"&&GOLD_JOBS.includes(e.job));
  const st=j=>ses.filter(e=>e.job===j&&e._date===d),en=j=>ses.filter(e=>e.job===j&&e.end&&endDay(e)===d);
  const bars=L.live.filter(e=>e._map==="bars"&&e._date===d);
  const shopIn=sum(bars.filter(b=>b.dest==="shop"),e=>n(e.weight)),vaultIn=sum(bars.filter(b=>b.dest!=="shop"),e=>n(e.weight));
  const ret=(j,src)=>sum(en(j).filter(e=>(e.src||JOBS[j].src[0])===src),e=>n(e.retW));
  const R={rIn:sum(st("refine"),e=>n(e.inW)),rOut:sum(en("refine"),e=>n(e.outW)),sIn:sum(st("strip"),e=>n(e.inW)),sOut:sum(en("strip"),e=>n(e.outW)),
    mIn:sum(st("mfg"),e=>n(e.inW)),mInV:sum(st("mfg").filter(e=>e.src!=="strips"),e=>n(e.inW)),mInS:sum(st("mfg").filter(e=>e.src==="strips"),e=>n(e.inW))};
  const lw=j=>sum(L.losses.filter(x=>x.job===j&&x._date===d),x=>x.w);
  const prod=L.prod.filter(e=>e._date===d).concat(L.live.filter(e=>e._map==="casting"&&!e._virtual&&e._date===d));
  const pcs=sum(prod,e=>n(e.count)),pw=sum(prod,e=>n(e.scale));
  const byItem={};prod.forEach(e=>{if(!e.item)return;const b=byItem[e.item]||(byItem[e.item]={id:e.item,c:0,w:0,a:0,ws:new Set()});b.c+=n(e.count);b.w+=n(e.scale);b.a+=n(e.actual);if(e.worker)b.ws.add(e.worker)});
  const mvOut=sum(L.live.filter(e=>e._map==="moves"&&e._date===d&&e.from==="vault"),e=>n(e.count)),mvIn=sum(L.live.filter(e=>e._map==="moves"&&e._date===d&&e.to==="vault"),e=>n(e.count));
  const vO=locTotal(O.stock,"vault"),vC=locTotal(C.stock,"vault");
  const inF=sum(bars,e=>n(e.weight)*n(e.karat)/1000);
  const soldF=sum(L.live.filter(e=>e._map==="sales"&&e._date===d),e=>(e.lines||[]).reduce((a,l)=>a+n(l.weight)*n(l.karat||catalog[l.item]?.karat||999.9)/1000,0));
  const lossF=sum(L.losses.filter(x=>x._date===d),x=>x.f);
  const adjF=sum(L.live.filter(e=>e._map==="counts"&&e._date===d),e=>(e.lines||[]).reduce((a,l)=>a+n(l.dw)*n(l.karat||999.9)/1000,0));
  const f0=totalFine(O,catalog),f1=totalFine(C,catalog),bal=f1-(f0+inF-soldF-lossF+adjF);
  const running=L.live.filter(e=>e._map==="sessions"&&!e.end&&e.job).sort((a,b)=>String(a.start).localeCompare(String(b.start)));
  const nm=GOLD_JOBS.reduce((o,j)=>(o[j]=running.filter(e=>e.job===j).length,o),{});
  const B=x=>html`<b class="num">${fg(x)}</b>`;
  const rows=[
    {id:"shop",k:"وارد محل",o:O.P.shop.w,i:shopIn,x:R.rIn,l:0,c:C.P.shop.w,pg:"bars"},
    {id:"ref",k:"الحل (مع العمال)",o:O.W.refine.w,i:R.rIn,x:R.rOut+ret("refine","shop"),l:lw("refine"),c:C.W.refine.w,pg:"refine",run:nm.refine},
    {id:"vault",k:"خام الخزنة",o:O.P.vault.w,i:R.rOut+vaultIn+ret("strip","vault")+ret("mfg","vault"),x:R.sIn+R.mInV,l:0,c:C.P.vault.w,pg:"stock"},
    {id:"str",k:"الشرايط (مع العمال)",o:O.W.strip.w,i:R.sIn,x:R.sOut+ret("strip","vault"),l:lw("strip"),c:C.W.strip.w,pg:"strips",run:nm.strip},
    {id:"sp",k:"شرايط جاهزة",o:O.P.strips.w,i:R.sOut+ret("mfg","strips"),x:R.mInS,l:0,c:C.P.strips.w,pg:"strips"},
    {id:"mfg",k:"التصنيع (مع العمال)",o:O.W.mfg.w,i:R.mIn,x:pw+ret("mfg","vault")+ret("mfg","strips"),l:lw("mfg"),c:C.W.mfg.w,pg:"casting",run:nm.mfg},
    {id:"items",k:"أصناف الخزنة",o:vO.w,i:pw,x:Math.max(0,vO.w+pw-vC.w),l:0,c:vC.w,pg:"stock",sub:fi(vO.c)+" ← "+fi(vC.c)+" قطعة"}];
  const rcols=[{key:"k",label:"القسم",render:r=>html`<span class="strong">${r.k}</span>${(r.run||r.sub)&&html`<span class="sub">${r.run?fi(r.run)+" عامل شغال":r.sub}</span>`}`},
    {key:"o",label:"أول اليوم",num:1,render:r=>fg(r.o)},{key:"i",label:"وارد",num:1,render:r=>r.i?html`<span style=${{color:"var(--ok)"}}>+${fg(r.i)}</span>`:"—"},
    {key:"x",label:"صادر",num:1,render:r=>r.x?html`<span>−${fg(r.x)}</span>`:"—"},{key:"l",label:"خسية",num:1,render:r=>r.l?html`<span class=${r.l>limit?"neg strong":""}>${fg(r.l)}</span>`:"—"},
    {key:"c",label:isT?"الآن":"آخر اليوم",num:1,render:r=>html`<span class=${"strong"+(r.c<-0.001?" neg":"")}>${fg(r.c)}</span>`}];
  return html`<${React.Fragment}>
    <${PH} title="المراجعة" desc=${isT?"مراجعة اليوم كامل — بتتحدث لحظياً مع كل حركة في المصنع":"مراجعة يوم "+d}>
      <button class="btn sm" onClick=${()=>setD(addDays(d,-1))}>اليوم السابق</button><input id="rv-d" type="date" class="in" style=${{width:"auto",height:"36px"}} value=${d} max=${today()} onChange=${e=>setD(e.target.value||today())} aria-label="اليوم"/><button class="btn sm" disabled=${isT} onClick=${()=>setD(addDays(d,1))}>التالي</button>
      ${isT&&html`<span class="live"><i></i>مباشر <span class="num">${new Date().toLocaleTimeString("en-GB")}</span></span>`}</${PH}>
    <section class="card review"><div class="card__b">
      <p>استلمت من <b>قسم الحل</b> ${B(R.rOut)} جم عيار 1000${R.rIn?html` (اتسلّم للحل ${B(R.rIn)} جم بلدي، خسية ${B(lw("refine"))} جم فاين)`:""}.</p>
      <p>اتسلّم <b>للتصنيع</b> ${B(R.mIn)} جم${R.mInS?html` (منها ${B(R.mInS)} جم شرايط)`:""}، اتصنع منها <b class="num">${fi(pcs)}</b> قطعة وزنها ${B(pw)} جم، وخسية التصنيع ${html`<b class=${"num"+(lw("mfg")>limit?" neg":"")}>${fg(lw("mfg"))}</b>`} جم.</p>
      ${(R.sIn||R.sOut)?html`<p>قسم <b>الشرايط</b> استلم ${B(R.sIn)} جم وسلّم ${B(R.sOut)} جم شرايط، خسية ${B(lw("strip"))} جم.</p>`:""}
      <p>المتبقي ${isT?"الآن":"آخر اليوم"}: ${B(C.W.mfg.w)} جم في <b>التصنيع</b>${isT&&nm.mfg?" مع "+nm.mfg+" عامل":""}، ${B(C.P.strips.w)} جم شرايط جاهزة، و${B(C.P.vault.w)} جم خام في <b>الخزنة</b> + <b class="num">${fi(vC.c)}</b> قطعة (${B(vC.w)} جم).</p>
      <p class=${Math.abs(bal)<0.01?"ok":"bad"}><${I} n=${Math.abs(bal)<0.01?"check":"alert"}/> إجمالي الذهب فاين: أول اليوم ${B(f0)} + وارد ${B(inF)} − مبيع ${B(soldF)} − خسية ${B(lossF)}${adjF?html` ${adjF>0?"+":"−"} تسوية ${B(Math.abs(adjF))}`:""} = ${B(f1)} جم ${Math.abs(bal)<0.01?"— متوازن":"— فرق "+fg(bal)+" جم راجع القيود"}</p>
    </div></section>
    <div class="kpis six">
      <${Kpi} icon="drop" label="خرج من الحل" value=${fg(R.rOut)} unit="جم" sub="عيار 1000" onClick=${()=>go("refine")}/>
      <${Kpi} icon="flame" label="استلم التصنيع" value=${fg(R.mIn)} unit="جم" onClick=${()=>go("casting")}/>
      <${Kpi} icon="box" label="اتصنع" value=${fi(pcs)} unit="قطعة" sub=${fg(pw)+" جم"}/>
      <${Kpi} icon="alert" label="الخسية كلها" value=${fg(lw("refine")+lw("strip")+lw("mfg"))} unit="جم" sub=${"حل "+fg(lw("refine"))+" · شرايط "+fg(lw("strip"))+" · تصنيع "+fg(lw("mfg"))} alert=${lw("mfg")>limit}/>
      <${Kpi} icon="clock" label="مع العمال الآن" value=${fg(C.W.refine.w+C.W.strip.w+C.W.mfg.w)} unit="جم" sub=${fi(running.length)+" عامل شغال"}/>
      <${Kpi} icon="bar" label="في الخزنة" value=${fg(C.P.vault.w)} unit="جم خام" sub=${fi(vC.c)+" قطعة · "+fg(vC.w)+" جم"} onClick=${()=>go("stock")}/>
    </div>
    <${Card} title="حركة الأقسام" sub="أول اليوم + وارد − صادر − خسية = الرصيد"><${DataTable} cols=${rcols} rows=${rows} pageSize=${20} onRow=${r=>go(r.pg)}/></${Card}>
    <div class="g2">
      <${Card} title="الأصناف اللي اتصنعت" sub=${fi(pcs)+" قطعة · "+fg(pw)+" جم"}>
        <${DataTable} cols=${[{key:"id",label:"الصنف",get:r=>catalog[r.id]?.name||r.id,render:r=>html`<span class="strong">${catalog[r.id]?.name||r.id}</span><span class="sub">${[...r.ws].join("، ")}</span>`},{key:"c",label:"العدد",num:1,render:r=>fi(r.c)},{key:"w",label:"الميزان",num:1,render:r=>fg(r.w)},{key:"d",label:"الفرق",num:1,get:r=>r.a-r.w,render:r=>html`<span class=${r.a-r.w<-0.005?"neg":""}>${fg(r.a-r.w)}</span>`}]} rows=${Object.values(byItem)} sort=${["w","desc"]} empty=${html`<${Empty} icon="box" t="لم يُستلم إنتاج بعد" s=""/>`}/>
        ${(mvOut||mvIn)?html`<div class="card__b sub">من الخزنة للتجهيز والمراحل: <b class="num">${fi(mvOut)}</b> قطعة · رجع للخزنة <b class="num">${fi(mvIn)}</b></div>`:""}
      </${Card}>
      <${Card} title="العمال الشغالين الآن" sub="الوقت بيعد لحظياً">
        <${DataTable} cols=${[{key:"wname",label:"العامل",render:r=>html`<span class="strong">${r.wname}</span><span class="sub">${JOBS[r.job]?.label||r.task||""}</span>`},{key:"inW",label:"الوزنة",num:1,get:r=>n(r.inW),render:r=>n(r.inW)?fg(n(r.inW)):(r.count?fi(n(r.count))+" قطعة":"—")},{key:"t",label:"الوقت",num:1,get:r=>Date.now()-new Date(r.start),render:r=>html`<span class="strong timer">${fhs(Date.now()-new Date(r.start))}</span>`}]} rows=${running} pageSize=${12} empty=${html`<${Empty} icon="clock" t="لا يوجد عمال شغالين" s=""/>`}/>
      </${Card}>
    </div>
  </${React.Fragment}>`;
}

/* ---------- daily snapshots (saved automatically) ---------- */
function dailySnap(L,catalog,workers,d,limit){const D=dayData(L,catalog,d);const wd=workerList(workers).map(w=>workerDay(w,D,limit)).filter(r=>r.active);
  return {date:d,made:D.made,madeW:r2(D.madeW),received:r2(D.received),kh:r2(D.kh),refineOut:r2(D.refineOut),stripOut:r2(D.stripOut),
    workers:wd.map(r=>({id:r.id,name:r.w.name,depts:wDept(r.w),h:r2(r.h),pcs:r.pcs,wt:r2(r.wt),rec:r2(r.rec),kh:r2(r.kh),status:r.auto[1],rating:(D.evals[r.id]&&D.evals[r.id].rating)||"",note:(D.evals[r.id]&&D.evals[r.id].note)||"",jobs:r.jobs.length}))}}

/* ---------- sales ---------- */
function invoiceHtml(e,catalog,customers){
  const c=customers[e.customer]||{};const esc=s=>String(s??"").replace(/[&<>"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[ch]));
  const rows=(e.lines||[]).map(l=>`<tr><td>${esc(catalog[l.item]?.name||l.item)}</td><td class="n">${fi(n(l.count))}</td><td class="n">${fg(n(l.weight))}</td><td class="n">${fm(n(l.price))}</td><td class="n">${fm(n(l.gold))}</td><td class="n">${fm(n(l.laborT))}</td><td class="n">${fm(n(l.total))}</td></tr>`).join("");
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>فاتورة ${esc(e.no)}</title><style>body{font-family:Tahoma,sans-serif;margin:0;color:#17140e}.top{background:#000;color:#fff;display:flex;justify-content:space-between;align-items:center;padding:20px 28px}.top img{height:56px}h1{color:#ddb546;margin:0;font-size:20px}.b{padding:24px 28px}.m{display:flex;gap:12px;margin-bottom:18px}.m div{flex:1;border:1px solid #e7e4dd;border-radius:4px;padding:10px 12px;font-size:13px}.m span{display:block;color:#676b74;font-size:11px}table{width:100%;border-collapse:collapse;font-size:13px}th{background:#f9f8f5;color:#676b74;text-align:right;padding:8px 10px;border-bottom:1px solid #e7e4dd}td{padding:9px 10px;border-bottom:1px solid #eee}.n{text-align:left;direction:ltr}.t{width:300px;margin:18px 0 0 auto;font-size:14px}.t div{display:flex;justify-content:space-between;padding:4px 0}.g{border-top:2px solid #17140e;font-weight:bold}</style></head><body><div class="top"><img src="${LOGO}" alt="GOLD ERA"><div style="text-align:left"><h1>فاتورة بيع</h1><div>رقم ${esc(e.no)} · ${esc(e._date)}</div></div></div><div class="b"><div class="m"><div><span>العميل</span>${esc(c.name||"—")}</div><div><span>الهاتف</span>${esc(c.phone||"—")}</div><div><span>عدد القطع</span>${fi((e.lines||[]).reduce((a,l)=>a+n(l.count),0))}</div></div><table><thead><tr><th>الصنف</th><th>العدد</th><th>الوزن (جم)</th><th>سعر الجرام</th><th>قيمة الذهب</th><th>المصنعية</th><th>الإجمالي</th></tr></thead><tbody>${rows}</tbody></table><div class="t"><div><span>الإجمالي</span><b>${fm(n(e.total))} ج.م</b></div><div><span>المدفوع</span><span>${fm(n(e.paid))} ج.م</span></div><div class="g"><span>المتبقي</span><span>${fm(n(e.total)-n(e.paid))} ج.م</span></div></div>${e.note?`<p style="color:#676b74;font-size:12px">ملاحظة: ${esc(e.note)}</p>`:""}</div></body></html>`;
}
function InvoiceView({e,catalog,customers,onClose,toast}){
  const c=customers[e.customer]||{};
  const dl=async()=>{const d=await platform.use("downloads");if(!d)return toast("التنزيل غير متاح في هذا العرض.");try{await d.save({filename:"invoice-"+e.no+".html",data:invoiceHtml(e,catalog,customers)})}catch(er){if(er&&er.code!=="declined")toast("تعذر التنزيل.")}};
  return html`<${Modal} label=${"فاتورة "+e.no} onClose=${onClose}>
    <div class="inv"><div class="inv__top"><img src=${LOGO} alt="GOLD ERA"/><div><h4>فاتورة بيع</h4>رقم <span class="num">${e.no}</span> · <span class="num">${e._date}</span></div></div>
      <div class="inv__body">
        ${e.void&&html`<div class="note warn"><${I} n="alert"/><span>فاتورة ملغاة${e.voidReason?": "+e.voidReason:""}</span></div>`}
        <div class="inv__meta"><div><span>العميل</span><b>${c.name||"—"}</b></div><div><span>الهاتف</span><b class="num">${c.phone||"—"}</b></div><div><span>القطع / الوزن</span><b class="num">${fi((e.lines||[]).reduce((a,l)=>a+n(l.count),0))} / ${fg((e.lines||[]).reduce((a,l)=>a+n(l.weight),0))} جم</b></div></div>
        <div class="tw"><table><thead><tr><th>الصنف</th><th class="n">العدد</th><th class="n">الوزن</th><th class="n">سعر الجرام</th><th class="n">قيمة الذهب</th><th class="n">المصنعية</th><th class="n">الإجمالي</th></tr></thead><tbody>${(e.lines||[]).map((l,i)=>html`<tr key=${i}><td>${catalog[l.item]?.name||l.item}</td><td class="n">${fi(n(l.count))}</td><td class="n">${fg(n(l.weight))}</td><td class="n">${fm(n(l.price))}</td><td class="n">${fm(n(l.gold))}</td><td class="n">${fm(n(l.laborT))}</td><td class="n">${fm(n(l.total))}</td></tr>`)}</tbody></table></div>
        <div class="inv__tot"><div><span>الإجمالي</span><b class="num">${fm(n(e.total))} ج.م</b></div><div><span>المدفوع</span><span class="num">${fm(n(e.paid))} ج.م</span></div><div class="g"><span>المتبقي</span><span class="num">${fm(n(e.total)-n(e.paid))} ج.م</span></div></div>
        <div class="inv__foot"><span>GOLD ERA FACTORY</span><span style=${{display:"flex",gap:"8px"}}><button class="btn" onClick=${onClose}>إغلاق</button><button class="btn p" onClick=${dl}><${I} n="dl"/>تنزيل الفاتورة</button></span></div>
      </div></div>
  </${Modal}>`;
}
function SalesPage({L,catalog,customers,prices,can,toast,role,go,intent}){
  const [sheet,setSheet]=useState(false);const [rg,setRg]=useState("30");const [view,setView]=useState(null);
  useEffect(()=>{if(intent&&intent.invoice){const v=L.all.find(e=>e._map==="sales"&&e.id===intent.invoice);if(v)setView(v)}},[intent]);
  const rows=L.all.filter(e=>e._map==="sales"&&inRange(e,rg)).reverse();const live=rows.filter(e=>!e.void);
  const tot=live.reduce((a,e)=>a+n(e.total),0),paid=live.reduce((a,e)=>a+n(e.paid),0),wt=live.reduce((a,e)=>a+(e.lines||[]).reduce((b,l)=>b+n(l.weight),0),0);
  const cols=[
    {key:"no",label:"رقم",num:1,get:r=>n(r.no),render:r=>html`<span class="strong">#${r.no}</span>`},
    {key:"_date",label:"التاريخ",get:r=>r.ts,render:r=>html`<span class="num">${r._date}</span>`},
    {key:"cust",label:"العميل",get:r=>customers[r.customer]?.name||"—"},
    {key:"pcs",label:"القطع",num:1,get:r=>(r.lines||[]).reduce((a,l)=>a+n(l.count),0),render:r=>fi((r.lines||[]).reduce((a,l)=>a+n(l.count),0))},
    {key:"w",label:"الوزن",num:1,get:r=>(r.lines||[]).reduce((a,l)=>a+n(l.weight),0),render:r=>fg((r.lines||[]).reduce((a,l)=>a+n(l.weight),0))},
    {key:"total",label:"الإجمالي",num:1,get:r=>n(r.total),render:r=>html`<span class="strong">${fm(n(r.total))}</span>`},
    {key:"paid",label:"الحالة",get:r=>n(r.total)-n(r.paid),render:r=>r.void?html`<${Badge} tone="bad">ملغاة</${Badge}>`:(n(r.total)-n(r.paid)<0.01?html`<${Badge} tone="ok">مدفوعة</${Badge}>`:n(r.paid)>0?html`<${Badge} tone="warn">جزئي · ${fm(n(r.total)-n(r.paid))}</${Badge}>`:html`<${Badge} tone="info">على الحساب</${Badge}>`),cls:"keep"}];
  return html`<${React.Fragment}>
    <${PH} title="المبيعات" desc="فواتير البيع من مخزون المعلم بسعر الجرام اليومي + المصنعية"><${Range} value=${rg} set=${setRg}/>${can&&html`<button class="btn p" onClick=${()=>setSheet(true)}><${I} n="plus"/>فاتورة جديدة</button>`}</${PH}>
    ${!can&&html`<${ReadOnly} role=${role}/>`}
    ${!(prices.g21||prices.g24)&&html`<div class="note warn"><${I} n="alert"/><span>لم تُحدد أسعار الذهب بعد. <button class="link" onClick=${()=>go("settings")}>حددها من الإعدادات</button> قبل إصدار الفواتير.</span></div>`}
    <div class="kpis">
      <${Kpi} icon="receipt" label="مبيعات الفترة" value=${fm(tot)} unit="ج.م" sub=${fi(live.length)+" فاتورة · "+fg(wt)+" جم"}/>
      <${Kpi} icon="wallet" label="المحصّل مع الفواتير" value=${fm(paid)} unit="ج.م" sub=${"على الحساب "+fm(tot-paid)}/>
      <${Kpi} icon="bar" label="جرام 21 / 24" value=${prices.g21?fm(n(prices.g21)):"—"} unit=${prices.g24?"/ "+fm(n(prices.g24)):""} sub=${prices.updatedAt?"تحديث "+String(prices.updatedAt).slice(0,10):"غير محدد"}/>
      <${Kpi} icon="box" label="متاح لدى المعلم" value=${fi(locTotal(L.stock,"master").c)} unit="قطعة" sub=${fg(locTotal(L.stock,"master").w)+" جم"}/>
    </div>
    <${Card} title="الفواتير"><${DataTable} cols=${cols} rows=${rows} sort=${["no","desc"]} rowCls=${voidCls} onRow=${setView} searchPh="رقم الفاتورة أو العميل" foot=${live.length?{total:fm(tot)}:null} empty=${html`<${Empty} icon="receipt" t="لا توجد فواتير في هذه الفترة" s=""/>`}/></${Card}>
    ${sheet&&html`<${SaleSheet} L=${L} catalog=${catalog} customers=${customers} prices=${prices} toast=${toast} onClose=${()=>setSheet(false)} onSaved=${setView}/>`}
    ${view&&html`<${InvoiceView} e=${view} catalog=${catalog} customers=${customers} toast=${toast} onClose=${()=>setView(null)}/>`}
  </${React.Fragment}>`;
}
function SaleSheet({L,catalog,customers,prices,toast,onClose}){
  const blank={item:"",count:"",labor:""};
  const [cust,setCust]=useState("");const [lines,setLines]=useState([{...blank}]);const [paid,setPaid]=useState("");const [note,setNote]=useState("");const [err,setErr]=useState("");const [busy,setBusy]=useState(false);
  const avail=L.stock.master;
  const calc=lines.map(ln=>{const it=catalog[ln.item];const a=avail[ln.item]||{c:0,w:0};const w=a.c>0?a.w/a.c*n(ln.count):(it?n(it.w)*n(ln.count):0);
    const pg=it?n(prices[priceKey(it.karat)]):0;const gold=w*pg,labor=n(ln.labor)*n(ln.count);return {...ln,weight:r2(w),price:pg,gold:r2(gold),laborT:r2(labor),total:r2(gold+labor),avail:a.c,karat:it?n(it.karat):0}});
  const total=calc.reduce((a,l)=>a+l.total,0);
  const setLn=(i,k,v)=>setLines(ls=>ls.map((l,j)=>j===i?{...l,[k]:v}:l));
  const save=async()=>{setErr("");if(!cust)return setErr("اختر العميل.");const ok=calc.filter(l=>l.item&&n(l.count)>0);if(!ok.length)return setErr("أضف صنفاً واحداً على الأقل.");
    for(const l of ok){if(n(l.count)>l.avail+0.0001)return setErr("المتاح لدى المعلم من "+catalog[l.item].name+" "+fi(l.avail)+" فقط.");if(!l.price)return setErr("حدد سعر جرام عيار "+karatLabel(l.karat)+" من الإعدادات.")}
    setBusy(true);try{const t=r2(ok.reduce((a,l)=>a+l.total,0));const no=Math.max(0,...L.all.filter(e=>e._map==="sales").map(e=>n(e.no)))+1;
      await addEntry("sales",{no,customer:cust,lines:ok.map(l=>({item:l.item,count:n(l.count),weight:l.weight,karat:l.karat,price:l.price,gold:l.gold,labor:n(l.labor),laborT:l.laborT,total:l.total})),total:t,paid:Math.min(n(paid),t)||0,note:note.trim()});
      toast("حُفظت الفاتورة رقم "+no);onClose()}catch(er){setErr(errText(er))}setBusy(false)};
  const custList=Object.entries(customers).sort((a,b)=>(a[1].name||"").localeCompare(b[1].name||"","ar"));
  const only=Object.keys(avail).filter(k=>avail[k].c>0);
  return html`<${Sheet} title="فاتورة بيع جديدة" sub=${"جرام 21: "+(prices.g21?fm(n(prices.g21)):"—")+" · جرام 24: "+(prices.g24?fm(n(prices.g24)):"—")} onClose=${onClose} footer=${html`<span class="msg">${err}</span><button class="btn" onClick=${onClose}>إلغاء</button><button class="btn p" disabled=${busy} onClick=${save}><${I} n="check"/>حفظ الفاتورة</button>`}>
    <${F} label="العميل" hint=${custList.length?"":"أضف العملاء من «العملاء والحسابات» أولاً"}><${Sel} id="s-cust" value=${cust} set=${setCust}><option value="">اختر العميل</option>${custList.map(([k,c])=>html`<option key=${k} value=${k}>${c.name}</option>`)}</${Sel}></${F}>
    <div class="sect">الأصناف</div>
    ${!only.length&&html`<div class="note"><${I} n="info"/><span>لا توجد قطع لدى المعلم. البيع يكون مما سُلم للمعلم من صفحة «التشطيب».</span></div>`}
    <div class="tw"><table class="t lines"><thead><tr><th>الصنف</th><th class="n">العدد</th><th class="n">مصنعية/قطعة</th><th class="n">الإجمالي</th><th></th></tr></thead><tbody>
      ${calc.map((l,i)=>html`<tr key=${i}><td style=${{minWidth:"170px"}}><${ItemSel} id=${"s-it-"+i} value=${l.item} set=${v=>setLn(i,"item",v)} catalog=${catalog} only=${only} avail=${avail}/><span class="sub num">${l.item?fg(l.weight)+" جم × "+fm(l.price):""}</span></td>
        <td style=${{width:"84px"}}><${Num} id=${"s-c-"+i} ph="0" value=${l.count} set=${v=>setLn(i,"count",v)}/></td><td style=${{width:"104px"}}><${Num} id=${"s-l-"+i} value=${l.labor} set=${v=>setLn(i,"labor",v)}/></td>
        <td class="n strong">${fm(l.total)}</td><td>${lines.length>1&&html`<button type="button" class="btn ghost sm" aria-label="حذف السطر" onClick=${()=>setLines(ls=>ls.filter((_,j)=>j!==i))}><${I} n="x"/></button>`}</td></tr>`)}
    </tbody></table></div>
    <div><button type="button" class="btn sm" onClick=${()=>setLines(ls=>[...ls,{...blank}])}><${I} n="plus"/>سطر جديد</button></div>
    <div class="fg"><${F} label="المدفوع الآن (ج.م)"><${Num} id="s-paid" value=${paid} set=${setPaid}/></${F}><${F} label="ملاحظة"><input id="s-note" class="in" value=${note} onInput=${e=>setNote(e.target.value)}/></${F}></div>
    <${Calc} items=${[["قيمة الذهب",fm(calc.reduce((a,l)=>a+l.gold,0))],["المصنعية",fm(calc.reduce((a,l)=>a+l.laborT,0))],["الإجمالي",fm(total)+" ج.م","hl"],["الوزن",fg(calc.reduce((a,l)=>a+l.weight,0))+" جم"],["المدفوع",fm(Math.min(n(paid),total))],["على الحساب",fm(Math.max(0,total-n(paid)))]]}/>
  </${Sheet}>`;
}

/* ---------- customers ---------- */
function CustomersPage({L,customers,can,toast,role,intent}){
  const [sheet,setSheet]=useState(null);const [stmt,setStmt]=useState(null);
  useEffect(()=>{if(intent&&intent.customer&&customers[intent.customer])setStmt({k:intent.customer,...customers[intent.customer]})},[intent]);
  const rows=Object.entries(customers).map(([k,c])=>({id:k,k,...c,bal:L.custBal[k]||0,last:(L.live.filter(e=>(e._map==="sales"||e._map==="payments")&&e.customer===k).map(e=>e._date).sort().pop())||""}));
  const total=rows.reduce((a,c)=>a+(c.bal>0?c.bal:0),0);const todayColl=L.live.filter(e=>e._map==="payments"&&e._date===today()).reduce((a,e)=>a+n(e.amount),0);
  const cols=[{key:"name",label:"العميل",render:r=>html`<span class="strong">${r.name}</span><span class="sub num">${r.phone||""}</span>`},
    {key:"kind",label:"النوع",render:r=>html`<${Badge} tone="plain">${r.kind||"—"}</${Badge}>`},
    {key:"last",label:"آخر حركة",render:r=>html`<span class="num">${r.last||"—"}</span>`},
    {key:"bal",label:"الرصيد المستحق",num:1,render:r=>html`<span class=${"strong "+(r.bal<-0.01?"neg":"")}>${fm(r.bal)}</span>`}];
  return html`<${React.Fragment}>
    <${PH} title="العملاء والحسابات" desc="أرصدة العملاء بالجنيه: الفواتير ناقص المدفوع والتحصيلات">${can&&html`<button class="btn" onClick=${()=>setSheet("cust")}><${I} n="plus"/>عميل جديد</button><button class="btn p" onClick=${()=>setSheet("pay")}><${I} n="wallet"/>تسجيل تحصيل</button>`}</${PH}>
    ${!can&&html`<${ReadOnly} role=${role}/>`}
    <div class="kpis">
      <${Kpi} icon="users" label="العملاء" value=${fi(rows.length)} sub=${fi(rows.filter(r=>r.bal>0.01).length)+" عليهم رصيد"}/>
      <${Kpi} icon="wallet" label="إجمالي المستحقات" value=${fm(total)} unit="ج.م"/>
      <${Kpi} icon="check" label="تحصيلات اليوم" value=${fm(todayColl)} unit="ج.م"/>
    </div>
    <${Card} title="الأرصدة" sub="اضغط على العميل لكشف الحساب"><${DataTable} cols=${cols} rows=${rows} sort=${["bal","desc"]} onRow=${setStmt} searchPh="اسم العميل أو الهاتف" foot=${rows.length?{bal:fm(rows.reduce((a,r)=>a+r.bal,0))}:null} empty=${html`<${Empty} icon="users" t="لا يوجد عملاء بعد" s=${can?"اضغط «عميل جديد».":""}/>`}/></${Card}>
    ${sheet==="cust"&&html`<${CustSheet} toast=${toast} onClose=${()=>setSheet(null)}/>`}
    ${sheet==="pay"&&html`<${PaySheet} rows=${rows} toast=${toast} onClose=${()=>setSheet(null)}/>`}
    ${stmt&&html`<${StatementSheet} c=${stmt} L=${L} onClose=${()=>setStmt(null)}/>`}
  </${React.Fragment}>`;
}
function CustSheet({toast,onClose}){
  const [f,setF]=useState({name:"",phone:"",kind:"تاجر"});const [err,setErr]=useState("");const [busy,setBusy]=useState(false);
  const save=async()=>{setErr("");if(!f.name.trim())return setErr("اكتب اسم العميل.");if(!S.db)return setErr(errText({code:"no_db"}));
    setBusy(true);try{await S.db.collection("customers").add({name:f.name.trim(),phone:f.phone.trim(),kind:f.kind,createdAt:new Date().toISOString(),by:S.uid});toast("أُضيف العميل "+f.name.trim());onClose()}catch(er){setErr(errText(er))}setBusy(false)};
  return html`<${Sheet} title="عميل جديد" onClose=${onClose} footer=${html`<span class="msg">${err}</span><button class="btn" onClick=${onClose}>إلغاء</button><button class="btn p" disabled=${busy} onClick=${save}><${I} n="check"/>إضافة العميل</button>`}>
    <div class="fg"><${F} full label="الاسم"><input id="n-name" class="in" autoFocus value=${f.name} onInput=${e=>setF(o=>({...o,name:e.target.value}))}/></${F}>
      <${F} label="الهاتف"><input id="n-phone" class="in nm" inputmode="tel" value=${f.phone} onInput=${e=>setF(o=>({...o,phone:e.target.value}))}/></${F}>
      <${F} label="النوع"><${Sel} id="n-kind" value=${f.kind} set=${v=>setF(o=>({...o,kind:v}))}>${["تاجر","محل","عميل فرد"].map(m=>html`<option key=${m}>${m}</option>`)}</${Sel}></${F}></div>
  </${Sheet}>`;
}
function PaySheet({rows,toast,onClose}){
  const [f,setF]=useState({customer:"",amount:"",method:"نقدي",note:""});const [err,setErr]=useState("");const [busy,setBusy]=useState(false);
  const c=rows.find(r=>r.k===f.customer);
  const save=async()=>{setErr("");if(!f.customer)return setErr("اختر العميل.");if(n(f.amount)<=0)return setErr("اكتب المبلغ.");
    setBusy(true);try{await addEntry("payments",{customer:f.customer,amount:n(f.amount),method:f.method,note:f.note.trim()});toast("سُجل التحصيل");onClose()}catch(er){setErr(errText(er))}setBusy(false)};
  return html`<${Sheet} title="تسجيل تحصيل" onClose=${onClose} footer=${html`<span class="msg">${err}</span><button class="btn" onClick=${onClose}>إلغاء</button><button class="btn p" disabled=${busy} onClick=${save}><${I} n="check"/>تسجيل</button>`}>
    <div class="fg"><${F} full label="العميل"><${Sel} id="p-cust" value=${f.customer} set=${v=>setF(o=>({...o,customer:v}))}><option value="">اختر العميل</option>${rows.map(r=>html`<option key=${r.k} value=${r.k}>${r.name} — ${fm(r.bal)}</option>`)}</${Sel}></${F}>
      <${F} label="المبلغ (ج.م)"><${Num} id="p-amt" value=${f.amount} set=${v=>setF(o=>({...o,amount:v}))}/></${F}>
      <${F} label="الطريقة"><${Sel} id="p-m" value=${f.method} set=${v=>setF(o=>({...o,method:v}))}>${["نقدي","تحويل بنكي","شيك"].map(m=>html`<option key=${m}>${m}</option>`)}</${Sel}></${F}>
      <${F} full label="ملاحظة"><input id="p-note" class="in" value=${f.note} onInput=${e=>setF(o=>({...o,note:e.target.value}))}/></${F}></div>
    ${c&&html`<${Calc} items=${[["الرصيد الحالي",fm(c.bal)],["التحصيل",fm(n(f.amount)),"hl"],["بعد التحصيل",fm(c.bal-n(f.amount)),c.bal-n(f.amount)<-0.01?"neg":""]]}/>`}
  </${Sheet}>`;
}
function StatementSheet({c,L,onClose}){
  let bal=0;const rows=L.live.filter(e=>(e._map==="sales"||e._map==="payments")&&e.customer===c.k).map(e=>{const d=e._map==="sales"?n(e.total):0,cr=e._map==="sales"?n(e.paid):n(e.amount);bal+=d-cr;return {id:e.id,e,d,cr,bal}});
  return html`<${Sheet} title=${"كشف حساب — "+c.name} sub=${(c.kind||"")+(c.phone?" · "+c.phone:"")} onClose=${onClose}>
    <${Calc} items=${[["إجمالي الفواتير",fm(rows.reduce((a,r)=>a+r.d,0))],["إجمالي المدفوع",fm(rows.reduce((a,r)=>a+r.cr,0))],["الرصيد",fm(bal),"hl"]]}/>
    ${rows.length?html`<div class="card"><div class="tw"><table class="t"><thead><tr><th>التاريخ</th><th>البيان</th><th class="n">مدين</th><th class="n">دائن</th><th class="n">الرصيد</th></tr></thead><tbody>${rows.map(r=>html`<tr key=${r.id}><td class="num">${r.e._date}</td><td>${r.e._map==="sales"?"فاتورة #"+(r.e.no||""):"تحصيل "+(r.e.method||"")}</td><td class="n">${r.d?fm(r.d):"—"}</td><td class="n">${r.cr?fm(r.cr):"—"}</td><td class="n strong">${fm(r.bal)}</td></tr>`)}</tbody></table></div></div>`:html`<${Empty} t="لا توجد حركات لهذا العميل" s=""/>`}
  </${Sheet}>`;
}

/* ---------- reports ---------- */
function ReportsPage({L,catalog,customers,names,toast,open,prices,months,role,perm,workers,config}){
  const [from,setFrom]=useState(addDays(today(),-29));const [to,setTo]=useState(today());const [tab,setTab]=useState("monthly");
  const E=L.live.filter(e=>e._date>=from&&e._date<=to);const ALL=L.all.filter(e=>e._date>=from&&e._date<=to).slice().reverse();
  const cast=E.filter(e=>e._map==="casting");
  const byDay={};cast.forEach(e=>{const d=byDay[e._date]||(byDay[e._date]={id:e._date,cast:0,cut:0,c:0,s:0});d.cast+=n(e.castLoss);d.cut+=n(e.cutLoss);d.c+=n(e.count);d.s+=n(e.scale)});
  const byItem={};cast.forEach(e=>{const b=byItem[e.item]||(byItem[e.item]={id:e.item,c:0,s:0,a:0});b.c+=n(e.count);b.s+=n(e.scale);b.a+=n(e.actual)});
  const byWorker={};cast.forEach(e=>{const k=e.worker||"—";const b=byWorker[k]||(byWorker[k]={id:k,rec:0,kh:0,c:0});b.rec+=n(e.received);b.kh+=khisya(e);b.c+=n(e.count)});
  const fees=E.filter(e=>e._map==="moves").reduce((a,e)=>a+n(e.fee),0),sales=E.filter(e=>e._map==="sales").reduce((a,e)=>a+n(e.total),0);
  const coll=E.filter(e=>e._map==="payments").reduce((a,e)=>a+n(e.amount),0)+E.filter(e=>e._map==="sales").reduce((a,e)=>a+n(e.paid),0);
  const khT=cast.reduce((a,e)=>a+khisya(e),0),recT=cast.reduce((a,e)=>a+n(e.received),0);
  const M={bars:"السبائك",strips:"الشرايط",casting:"السبك والتقطيع",moves:"المراحل",sales:"المبيعات",payments:"التحصيل",counts:"الجرد",labels:"الملصقات"};
  const exportCsv=async()=>{const dl=await platform.use("downloads");if(!dl)return toast("التصدير غير متاح في هذا العرض.");
    const q=s=>'"'+String(s??"").replace(/"/g,'""')+'"';const rows=[["التاريخ","الوقت","القسم","البيان","الصنف","العدد","الوزن","المبلغ","بواسطة","الحالة"]];
    ALL.forEach(e=>rows.push([e._date,tme(e.ts),M[e._map],describe(e,catalog,customers),catalog[e.item]?.name||"",e.count??"",e.weight??e.scale??"",e.total??e.amount??e.fee??"",(e.by&&names[e.by]?.name)||"",e.void?"ملغى: "+(e.voidReason||""):""]));
    try{await dl.save({filename:"gold-era-"+from+"_"+to+".csv",data:"﻿"+rows.map(r=>r.map(q).join(",")).join("\r\n")})}catch(er){if(er&&er.code!=="declined")toast("تعذر التصدير.")}};
  const tabsEl=html`<div class="tabs" role="tablist">${[["monthly","الشهر والأرباح"],["wprod","إنتاجية العمال"],["khisya","الخسية اليومية"],["items","الإنتاج حسب الصنف"],["workers","خسية الصناع"],["audit","سجل التدقيق"]].map(([k,l])=>html`<button key=${k} role="tab" aria-selected=${tab===k?"true":"false"} onClick=${()=>setTab(k)}>${l}</button>`)}</div>`;
  if(tab==="wprod")return html`<${React.Fragment}><${PH} title="التقارير" desc="إنتاجية كل عامل لشهر أو عدة شهور أو سنة"/>${tabsEl}<${WorkerReport} L=${L} workers=${workers||{}} config=${config||{}} toast=${toast}/></${React.Fragment}>`;
  if(tab==="monthly")return html`<${React.Fragment}><${PH} title="التقارير" desc="الملخص الشهري والربح التقديري، والخسية والإنتاج، وسجل التدقيق"/>${tabsEl}<${MonthlyReport} L=${L} catalog=${catalog} prices=${prices} months=${months} perm=${perm} toast=${toast}/></${React.Fragment}>`;
  return html`<${React.Fragment}>
    <${PH} title="التقارير" desc="الخسية والإنتاج والدمغة والمبيعات، وسجل التدقيق الكامل">
      <input id="r-from" type="date" class="in" style=${{width:"auto",height:"36px"}} value=${from} onChange=${e=>setFrom(e.target.value)} aria-label="من"/><span style=${{color:"var(--muted)"}}>إلى</span><input id="r-to" type="date" class="in" style=${{width:"auto",height:"36px"}} value=${to} onChange=${e=>setTo(e.target.value)} aria-label="إلى"/>
      <button class="btn" onClick=${exportCsv}><${I} n="dl"/>تصدير CSV</button></${PH}>
    <div class="kpis">
      <${Kpi} icon="flame" label="الخسية" value=${fg(khT)} unit="جم" sub=${recT?(khT/recT*1000).toFixed(2)+" ‰ من المتسلمة":""}/>
      <${Kpi} icon="box" label="الإنتاج" value=${fi(cast.reduce((a,e)=>a+n(e.count),0))} unit="قطعة"/>
      <${Kpi} icon="stamp" label="رسوم الدمغة" value=${fm(fees)} unit="ج.م"/>
      <${Kpi} icon="receipt" label="المبيعات" value=${fm(sales)} unit="ج.م" sub=${"التحصيل "+fm(coll)}/>
    </div>
    <div class="tabs" role="tablist">${[["monthly","الشهر والأرباح"],["wprod","إنتاجية العمال"],["khisya","الخسية اليومية"],["items","الإنتاج حسب الصنف"],["workers","خسية الصناع"],["audit","سجل التدقيق"]].map(([k,l])=>html`<button key=${k} role="tab" aria-selected=${tab===k?"true":"false"} onClick=${()=>setTab(k)}>${l}</button>`)}</div>
    <${Card} title=${{khisya:"الخسية يوماً بيوم",items:"الإنتاج حسب الصنف",workers:"الخسية حسب الصانع",audit:"كل القيود في الفترة"}[tab]} sub=${from+" ← "+to}>
      ${tab==="khisya"&&html`<${DataTable} key="k" cols=${[{key:"id",label:"اليوم",render:r=>html`<span class="num">${r.id}</span>`},{key:"cast",label:"سبك",num:1,render:r=>fg(r.cast)},{key:"cut",label:"تقطيع",num:1,render:r=>fg(r.cut)},{key:"kh",label:"الخسية",num:1,get:r=>r.cast+r.cut,render:r=>html`<span class="strong">${fg(r.cast+r.cut)}</span>`},{key:"c",label:"القطع",num:1,render:r=>fi(r.c)},{key:"s",label:"وزن الميزان",num:1,render:r=>fg(r.s)}]} rows=${Object.values(byDay)} sort=${["id","desc"]} foot=${{kh:fg(khT)}}/>`}
      ${tab==="items"&&html`<${DataTable} key="i" cols=${[{key:"id",label:"الصنف",get:r=>catalog[r.id]?.name||r.id},{key:"c",label:"العدد",num:1,render:r=>fi(r.c)},{key:"s",label:"الميزان",num:1,render:r=>fg(r.s)},{key:"a",label:"الفعلي",num:1,render:r=>fg(r.a)},{key:"d",label:"الفرق",num:1,get:r=>r.a-r.s,render:r=>html`<span class=${r.a-r.s<0?"neg":""}>${fg(r.a-r.s)}</span>`}]} rows=${Object.values(byItem)} sort=${["s","desc"]}/>`}
      ${tab==="workers"&&html`<${DataTable} key="w" cols=${[{key:"id",label:"الصانع"},{key:"rec",label:"المتسلمة",num:1,render:r=>fg(r.rec)},{key:"kh",label:"الخسية",num:1,render:r=>fg(r.kh)},{key:"pm",label:"النسبة",num:1,get:r=>r.rec?r.kh/r.rec:0,render:r=>r.rec?(r.kh/r.rec*1000).toFixed(2)+" ‰":"—"},{key:"c",label:"القطع",num:1,render:r=>fi(r.c)}]} rows=${Object.values(byWorker)} sort=${["kh","desc"]}/>`}
      ${tab==="audit"&&html`<${DataTable} key="a" cols=${[{key:"ts",label:"الوقت",render:r=>html`<span class="num">${r._date}</span><span class="sub num">${tme(r.ts)}</span>`},{key:"_map",label:"القسم",get:r=>M[r._map],render:r=>html`<${Badge} tone="plain">${M[r._map]}</${Badge}>`},{key:"d",label:"البيان",cls:"wrap",get:r=>describe(r,catalog,customers)},{key:"by",label:"بواسطة",get:r=>(r.by&&names[r.by]?.name)||"",render:r=>html`<${Who} id=${r.by} names=${names}/>`},stCol()]} rows=${ALL} sort=${["ts","desc"]} pageSize=${20} rowCls=${voidCls} onRow=${open}/>`}
    </${Card}>
  </${React.Fragment}>`;
}

/* ---------- settings ---------- */
function SettingsPage({catalog,workers,prices,names,toast,perm,isOwner,config}){
  const [tab,setTab]=useState(isOwner?"users":"catalog");const mgr=!!(perm&&perm.settings);
  return html`<${React.Fragment}>
    <${PH} title="الإعدادات" desc="الأصناف، العمال، الأسعار، حدود التشغيل، والمستخدمون"/>
    <div class="tabs" role="tablist">${[...(isOwner?[["users","المستخدمون والصلاحيات"]]:[]),["catalog","الأصناف"],["prices","أسعار الذهب"],["ops","حدود التشغيل"],["backup","النسخ الاحتياطي"]].map(([k,l])=>html`<button key=${k} role="tab" aria-selected=${tab===k?"true":"false"} onClick=${()=>setTab(k)}>${l}</button>`)}</div>
    ${tab==="catalog"&&html`<${CatalogEdit} catalog=${catalog} can=${mgr} toast=${toast}/>`}
    ${tab==="prices"&&html`<${PricesEdit} prices=${prices} can=${mgr} toast=${toast}/>`}
    ${tab==="ops"&&html`<${OpsEdit} config=${config} can=${mgr} toast=${toast}/>`}
    ${tab==="backup"&&html`<${BackupEdit} isOwner=${isOwner} mgr=${mgr} toast=${toast}/>`}
    ${tab==="users"&&isOwner&&html`<${UsersAdmin} names=${names} toast=${toast}/>`}
  </${React.Fragment}>`;
}
const saveDoc=async(path,data,setErr)=>{try{if(!S.db)throw {code:"no_db"};await S.db.doc(path).set({...data,updatedAt:new Date().toISOString(),by:S.uid});return true}catch(er){setErr(errText(er));return false}};
function CatalogEdit({catalog,can,toast}){
  const toRows=c=>Object.entries(c).sort((a,b)=>n(a[1].order)-n(b[1].order)).map(([k,v])=>({k,...v}));
  const [rows,setRows]=useState(()=>toRows(catalog));const [dirty,setDirty]=useState(false);const [err,setErr]=useState("");
  useEffect(()=>{if(!dirty)setRows(toRows(catalog))},[catalog]);
  const up=(i,k,v)=>{setDirty(true);setRows(rs=>rs.map((r,j)=>j===i?{...r,[k]:v}:r))};
  const save=async()=>{setErr("");if(rows.some(r=>!String(r.name).trim()||n(r.w)<=0))return setErr("كل صنف يحتاج اسماً ووزناً.");
    const items={};rows.forEach((r,i)=>{items[r.k]={name:String(r.name).trim(),w:n(r.w),karat:n(r.karat),fee:n(r.fee),order:i+1}});if(await saveDoc("settings/catalog",{items},setErr)){setDirty(false);toast("حُفظ الكتالوج")}};
  return html`<${Card} title="كتالوج الأصناف" sub="الوزن بالجرام لعيار الصنف · رسوم الدمغة بالجنيه للقطعة" actions=${can&&html`<div class="ph__a">${err&&html`<span class="msg">${err}</span>`}<button class="btn" onClick=${()=>{setDirty(true);setRows(rs=>[...rs,{k:"i"+newId().slice(0,8),name:"",w:"",karat:999.9,fee:0}])}}><${I} n="plus"/>صنف</button><button class="btn p" disabled=${!dirty} onClick=${save}>حفظ التغييرات</button></div>`}>
    ${!rows.length&&html`<div class="card__b"><${Empty} icon="box" t="لا توجد أصناف في الكتالوج" s="حمّل الأصناف العشرين من ملف المصنع، أو أضف صنفاً بنفسك."/>${can&&html`<div style=${{textAlign:"center"}}><button class="btn p" onClick=${async()=>{if(await seedDefaults())toast("تم تحميل الأصناف");else setErr("تعذر التحميل.")}}><${I} n="dl"/>تحميل الأصناف الافتراضية</button></div>`}</div>`}
    <div class="tw"><table class="t lines"><thead><tr><th>م</th><th>الصنف</th><th class="n">الوزن (جم)</th><th>العيار</th><th class="n">رسوم الدمغة</th><th class="n">فاين القطعة</th></tr></thead><tbody>
      ${rows.map((r,i)=>html`<tr key=${r.k}><td class="num">${i+1}</td><td style=${{minWidth:"170px"}}>${can?html`<input id=${"cat-n-"+r.k} class="in" value=${r.name} onInput=${e=>up(i,"name",e.target.value)}/>`:r.name}</td>
        <td class="n" style=${{width:"120px"}}>${can?html`<${Num} id=${"cat-w-"+r.k} value=${String(r.w)} set=${v=>up(i,"w",v)}/>`:fg(n(r.w))}</td>
        <td style=${{width:"150px"}}>${can?html`<${Sel} id=${"cat-k-"+r.k} value=${String(r.karat)} set=${v=>up(i,"karat",v)}>${KARATS.map(([v,l])=>html`<option key=${v} value=${v}>${l}</option>`)}</${Sel}>`:karatLabel(r.karat)}</td>
        <td class="n" style=${{width:"110px"}}>${can?html`<${Num} id=${"cat-f-"+r.k} value=${String(r.fee)} set=${v=>up(i,"fee",v)}/>`:fm(n(r.fee))}</td><td class="n">${fg(n(r.w)*n(r.karat)/1000)}</td></tr>`)}
    </tbody></table></div></${Card}>`;
}
function WorkersEdit({workers,can,toast}){
  const [name,setName]=useState("");const [kind,setKind]=useState("سبك");const [err,setErr]=useState("");
  const save=m=>saveDoc("settings/workers",{list:m},setErr);
  return html`<${Card} title="العمال" sub="يظهرون في قوائم الصانع والمستلم والمعلم">
    <div class="tw"><table class="t"><thead><tr><th>الاسم</th><th>القسم</th>${can&&html`<th></th>`}</tr></thead><tbody>
      ${Object.entries(workers).map(([k,w])=>html`<tr key=${k}><td class="strong">${w.name}</td><td><${Badge} tone="plain">${w.kind||"—"}</${Badge}></td>${can&&html`<td class="n"><button class="btn sm ghost" onClick=${async()=>{const m={...workers};delete m[k];if(await save(m))toast("حُذف "+w.name)}}>حذف</button></td>`}</tr>`)}
    </tbody></table></div>
    ${can&&html`<div class="card__b" style=${{borderTop:"1px solid var(--line)"}}><div class="fg" style=${{gridTemplateColumns:"minmax(0,2fr) minmax(0,1fr) auto",alignItems:"end"}}>
      <${F} label="اسم العامل"><input id="wk-name" class="in" value=${name} onInput=${e=>setName(e.target.value)}/></${F}>
      <${F} label="القسم"><${Sel} id="wk-kind" value=${kind} set=${setKind}>${["سبك","تجهيز","تشطيب","معلم"].map(k=>html`<option key=${k}>${k}</option>`)}</${Sel}></${F}>
      <button class="btn p" onClick=${async()=>{setErr("");if(!name.trim())return setErr("اكتب الاسم.");if(await save({...workers,["w"+newId().slice(0,8)]:{name:name.trim(),kind}})){toast("أُضيف "+name.trim());setName("")}}}><${I} n="plus"/>إضافة</button></div>${err&&html`<p class="msg">${err}</p>`}</div>`}
  </${Card}>`;
}
function PricesEdit({prices,can,toast}){
  const [f,setF]=useState({g24:prices.g24||"",g21:prices.g21||"",g18:prices.g18||""});const [err,setErr]=useState("");
  useEffect(()=>setF({g24:prices.g24||"",g21:prices.g21||"",g18:prices.g18||""}),[prices.updatedAt]);
  return html`<${Card} title="أسعار جرام الذهب" sub=${prices.updatedAt?"آخر تحديث "+String(prices.updatedAt).replace("T"," ").slice(0,16):"لم تُحدد بعد"} body=${true}>
    ${can?html`<div class="fg" style=${{gridTemplateColumns:"repeat(3,minmax(0,1fr)) auto",alignItems:"end"}}>${[["g24","عيار 24 (ج.م)"],["g21","عيار 21 (ج.م)"],["g18","عيار 18 (ج.م)"]].map(([k,l])=>html`<${F} key=${k} label=${l}><${Num} id=${"pr-"+k} value=${String(f[k])} set=${v=>setF(o=>({...o,[k]:v}))}/></${F}>`)}
      <button class="btn p" onClick=${async()=>{setErr("");if(await saveDoc("settings/prices",{g24:n(f.g24),g21:n(f.g21),g18:n(f.g18)},setErr))toast("حُدثت الأسعار")}}>حفظ الأسعار</button></div>${err&&html`<p class="msg">${err}</p>`}`
      :html`<div class="kpis">${[["عيار 24","g24"],["عيار 21","g21"],["عيار 18","g18"]].map(([l,k])=>html`<${Kpi} key=${k} label=${l} value=${prices[k]?fm(n(prices[k])):"—"} unit="ج.م"/>`)}</div>`}
  </${Card}>`;
}
function OpsEdit({config,can,toast}){
  const [lim,setLim]=useState(String(config.khisyaLimit||0.5));const [err,setErr]=useState("");
  return html`<${Card} title="حدود التشغيل" sub="تُستخدم في التنبيهات ولوحة التحكم" body=${true}>
    <div class="fg" style=${{gridTemplateColumns:"minmax(0,280px) auto",alignItems:"end"}}><${F} label="الحد المسموح للخسية اليومية (جم)" hint="يظهر تنبيه عند تجاوزه"><${Num} id="ops-lim" value=${lim} set=${setLim} ro=${!can}/></${F}>
      ${can&&html`<button class="btn p" onClick=${async()=>{setErr("");if(n(lim)<=0)return setErr("اكتب قيمة أكبر من صفر.");if(await saveDoc("settings/config",{khisyaLimit:n(lim)},setErr))toast("حُفظ الحد")}}>حفظ</button>`}</div>${err&&html`<p class="msg">${err}</p>`}
  </${Card}>`;
}
/* ---------- command palette ---------- */
function Command({L,catalog,customers,onClose,go,visible}){
  const [q,setQ]=useState("");const [sel,setSel]=useState(0);useEsc(onClose);
  const s=q.trim();
  const res=useMemo(()=>{const R=[];
    NAV.forEach(([g,items])=>items.forEach(([k,l])=>{if((!visible||visible.includes(k))&&(!s||l.includes(s)))R.push({g:"الصفحات",icon:NAV_ICON[k],t:l,sub:g,act:()=>go(k)})}));
    if(s){Object.values(L.bars).filter(b=>String(b.serial).includes(serialClean(s))).slice(0,5).forEach(b=>R.push({g:"السبائك",icon:"bar",t:b.serial,sub:fg(n(b.weight))+" جم",act:()=>go("bars",{bar:b.serial})}));
      Object.entries(customers).filter(([,c])=>(c.name||"").includes(s)||(c.phone||"").includes(s)).slice(0,5).forEach(([k,c])=>R.push({g:"العملاء",icon:"users",t:c.name,sub:"رصيد "+fm(L.custBal[k]||0),act:()=>go("customers",{customer:k})}));
      L.all.filter(e=>e._map==="sales"&&(String(e.no)===s.replace("#","")||(customers[e.customer]?.name||"").includes(s))).slice(-5).reverse().forEach(e=>R.push({g:"الفواتير",icon:"receipt",t:"فاتورة #"+e.no,sub:(customers[e.customer]?.name||"")+" · "+fm(n(e.total)),act:()=>go("sales",{invoice:e.id})}));
      Object.values(window.__ORDERS||{}).filter(o=>String(o.no)===s.replace("#","")||(catalog[o.item]?.name||"").includes(s)).slice(0,4).forEach(o=>R.push({g:"أوامر التصنيع",icon:"clip",t:"أمر #"+o.no,sub:(catalog[o.item]?.name||"")+" · "+fi(n(o.qty))+" قطعة",act:()=>go("orders",{order:o.id})}));
      L.all.filter(e=>e._map==="labels"&&s.length>=4&&String(e.prefix).toUpperCase().includes(s.toUpperCase().split("-").slice(0,2).join("-"))).slice(0,4).forEach(e=>R.push({g:"الملصقات",icon:"qr",t:e.prefix,sub:(catalog[e.item]?.name||"")+" · "+fi(n(e.count))+" ملصق",act:()=>go("labels",{label:e.id})}));
      Object.values(window.__WORKERS||{}).filter(w=>(w.name||"").includes(s)||(w.code||"")===s).slice(0,4).forEach(w=>R.push({g:"العمال",icon:"users",t:w.name,sub:wDept(w),act:()=>go("workers")}));
      Object.entries(catalog).filter(([,it])=>it.name.includes(s)).slice(0,4).forEach(([k,it])=>R.push({g:"الأصناف",icon:"box",t:it.name,sub:"المخزون",act:()=>go("stock")}))}
    return R.slice(0,14)},[s,L,customers,catalog]);
  useEffect(()=>setSel(0),[s]);
  const key=e=>{if(e.key==="ArrowDown"){e.preventDefault();setSel(x=>Math.min(res.length-1,x+1))}else if(e.key==="ArrowUp"){e.preventDefault();setSel(x=>Math.max(0,x-1))}else if(e.key==="Enter"&&res[sel]){res[sel].act();onClose()}};
  let lastG="";
  return html`<div class="ov" style=${{display:"block"}} onMouseDown=${e=>{if(e.target===e.currentTarget)onClose()}}><div class="cmd" role="dialog" aria-modal="true" aria-label="بحث شامل">
    <div class="cmd__in"><${I} n="search"/><input autoFocus placeholder="ابحث عن صفحة، رقم سبيكة، عميل، أو رقم فاتورة" value=${q} onInput=${e=>setQ(e.target.value)} onKeyDown=${key} aria-label="بحث"/></div>
    <ul role="listbox">${res.length?res.map((r,i)=>{const head=r.g!==lastG;lastG=r.g;return html`<${React.Fragment} key=${i}>${head&&html`<li class="grp">${r.g}</li>`}<li><button role="option" aria-selected=${i===sel?"true":"false"} onMouseEnter=${()=>setSel(i)} onClick=${()=>{r.act();onClose()}}><${I} n=${r.icon}/><span class=${r.g==="السبائك"?"num":""}>${r.t}</span><small>${r.sub}</small></button></li></${React.Fragment}>`}):html`<li class="grp" style=${{padding:"18px 10px"}}>لا نتائج لـ «${q}»</li>`}</ul>
  </div></div>`;
}

/* ---------- production orders ---------- */
const ORDER_ST={open:["مفتوح","info"],done:["مكتمل","ok"],closed:["مُغلق","plain"],cancelled:["ملغى","bad"]};
function orderProgress(o,L){const rows=L.live.filter(e=>e._map==="casting"&&e.order===o.id);const made=rows.reduce((a,e)=>a+n(e.count),0),w=rows.reduce((a,e)=>a+n(e.scale),0);
  const strips=L.live.filter(e=>e._map==="strips"&&e.order===o.id&&e.kind!=="return").reduce((a,e)=>a+n(e.weight),0);
  const st=o.status==="open"&&made>=n(o.qty)?"done":o.status;const late=o.status==="open"&&st!=="done"&&o.due&&o.due<today();
  return {made,w,strips,rows,st,late,pct:n(o.qty)?Math.min(100,made/n(o.qty)*100):0}}
const openOrders=orders=>Object.values(orders).filter(o=>o.status==="open").sort((a,b)=>n(a.no)-n(b.no));
function OrderSel({orders,value,set,id,item}){const list=openOrders(orders).filter(o=>!item||o.item===item||o.id===value);
  return html`<${Sel} id=${id} value=${value} set=${set}><option value="">بدون أمر تصنيع</option>${list.map(o=>html`<option key=${o.id} value=${o.id}>#${o.no} — ${fi(n(o.qty))} قطعة${o.due?" · تسليم "+o.due:""}</option>`)}</${Sel}>`}
function OrdersPage({L,catalog,customers,orders,can,toast,role,intent}){
  const [sheet,setSheet]=useState(false);const [view,setView]=useState(null);const [flt,setFlt]=useState("open");
  useEffect(()=>{if(intent&&intent.order&&orders[intent.order])setView(orders[intent.order])},[intent]);
  const all=Object.values(orders).map(o=>({...o,...orderProgress(o,L)}));
  const rows=all.filter(o=>flt==="all"||(flt==="open"?o.status==="open":o.status!=="open")).sort((a,b)=>n(b.no)-n(a.no));
  const open=all.filter(o=>o.status==="open");const remain=open.reduce((a,o)=>a+Math.max(0,n(o.qty)-o.made),0);
  const cols=[
    {key:"no",label:"رقم",num:1,get:r=>n(r.no),render:r=>html`<span class="strong">#${r.no}</span>`},
    {key:"item",label:"الصنف",get:r=>catalog[r.item]?.name||"—",render:r=>html`<span class="strong">${catalog[r.item]?.name||"—"}</span>${r.customer&&html`<span class="sub">${customers[r.customer]?.name||""}</span>`}`},
    {key:"qty",label:"المطلوب",num:1,get:r=>n(r.qty),render:r=>fi(n(r.qty))},
    {key:"made",label:"المُنتج",num:1,render:r=>fi(r.made)},
    {key:"pct",label:"الإنجاز",num:1,render:r=>html`<span style=${{display:"inline-flex",alignItems:"center",gap:"8px"}}><span class="prog"><span style=${{width:r.pct+"%"}}></span></span><span class="num">${r.pct.toFixed(0)}%</span></span>`},
    {key:"due",label:"موعد التسليم",get:r=>r.due||"",render:r=>html`<span class=${"num"+(r.late?" neg":"")}>${r.due||"—"}</span>`},
    {key:"st",label:"الحالة",get:r=>r.st,render:r=>r.late?html`<${Badge} tone="bad">متأخر</${Badge}>`:html`<${Badge} tone=${ORDER_ST[r.st]?.[1]}>${ORDER_ST[r.st]?.[0]}</${Badge}>`}];
  return html`<${React.Fragment}>
    <${PH} title="أوامر التصنيع" desc="طلبات الإنتاج بالصنف والعدد وموعد التسليم، ونسبة الإنجاز من صفوف السبك المرتبطة بها">
      <${Seg} opts=${[["open","المفتوحة"],["closed","المنتهية"],["all","الكل"]]} value=${flt} set=${setFlt}/>${can&&html`<button class="btn p" onClick=${()=>setSheet(true)}><${I} n="plus"/>أمر تصنيع</button>`}</${PH}>
    ${!can&&html`<${ReadOnly} role=${role}/>`}
    <div class="kpis">
      <${Kpi} icon="clip" label="أوامر مفتوحة" value=${fi(open.length)} sub=${fi(open.filter(o=>o.st==="done").length)+" اكتمل إنتاجها"}/>
      <${Kpi} icon="box" label="قطع متبقية" value=${fi(remain)} unit="قطعة" sub="في الأوامر المفتوحة"/>
      <${Kpi} icon="alert" label="أوامر متأخرة" value=${fi(open.filter(o=>o.late).length)} alert=${open.some(o=>o.late)}/>
    </div>
    <${Card} title="الأوامر" sub="اضغط على الأمر لعرض التفاصيل وإغلاقه"><${DataTable} cols=${cols} rows=${rows} sort=${["no","desc"]} onRow=${r=>setView(orders[r.id])} searchPh="رقم الأمر أو الصنف" empty=${html`<${Empty} icon="clip" t="لا توجد أوامر" s=${can?"اضغط «أمر تصنيع» لإنشاء أول أمر.":""}/>`}/></${Card}>
    ${sheet&&html`<${OrderSheet} catalog=${catalog} customers=${customers} orders=${orders} toast=${toast} onClose=${()=>setSheet(false)}/>`}
    ${view&&html`<${OrderView} o=${orders[view.id]||view} L=${L} catalog=${catalog} customers=${customers} can=${can} toast=${toast} onClose=${()=>setView(null)}/>`}
  </${React.Fragment}>`;
}
function OrderSheet({catalog,customers,orders,toast,onClose}){
  const [f,setF]=useState({item:"",qty:"",due:addDays(today(),7),customer:"",note:""});const [err,setErr]=useState("");const [busy,setBusy]=useState(false);const up=(k,v)=>setF(o=>({...o,[k]:v}));
  const it=catalog[f.item];
  const save=async()=>{setErr("");if(!f.item)return setErr("اختر الصنف.");if(n(f.qty)<=0)return setErr("اكتب العدد المطلوب.");if(!S.db)return setErr(errText({code:"no_db"}));
    setBusy(true);try{const id=newId();const no=Math.max(0,...Object.values(orders).map(o=>n(o.no)))+1;
      await S.db.doc("orders/"+id).set({id,no,item:f.item,qty:n(f.qty),due:f.due||"",customer:f.customer,note:f.note.trim(),status:"open",createdAt:new Date().toISOString(),by:S.uid});toast("أُنشئ أمر التصنيع #"+no);onClose()}catch(e){setErr(errText(e))}setBusy(false)};
  return html`<${Sheet} title="أمر تصنيع جديد" onClose=${onClose} footer=${html`<span class="msg">${err}</span><button class="btn" onClick=${onClose}>إلغاء</button><button class="btn p" disabled=${busy} onClick=${save}><${I} n="check"/>إنشاء الأمر</button>`}>
    <div class="fg">
      <${F} full label="الصنف"><${ItemSel} id="o-item" value=${f.item} set=${v=>up("item",v)} catalog=${catalog}/></${F}>
      <${F} label="العدد المطلوب"><${Num} id="o-qty" ph="0" value=${f.qty} set=${v=>up("qty",v)}/></${F}>
      <${F} label="موعد التسليم"><input id="o-due" type="date" class="in" value=${f.due} onChange=${e=>up("due",e.target.value)}/></${F}>
      <${F} full label="العميل" hint="اختياري"><${Sel} id="o-cust" value=${f.customer} set=${v=>up("customer",v)}><option value="">للمخزون</option>${Object.entries(customers).map(([k,c])=>html`<option key=${k} value=${k}>${c.name}</option>`)}</${Sel}></${F}>
      <${F} full label="ملاحظة"><input id="o-note" class="in" value=${f.note} onInput=${e=>up("note",e.target.value)}/></${F}>
    </div>
    <${Calc} items=${[["الوزن المطلوب",it?fg(n(it.w)*n(f.qty))+" جم":"—","hl"],["الفاين",it?fg(n(it.w)*n(f.qty)*n(it.karat)/1000)+" جم":"—"],["العيار",it?karatLabel(it.karat):"—"]]}/>
  </${Sheet}>`;
}
function OrderView({o,L,catalog,customers,can,toast,onClose}){
  const p=orderProgress(o,L);const [busy,setBusy]=useState(false);const [err,setErr]=useState("");
  const setStatus=async st=>{setBusy(true);setErr("");try{await S.db.doc("orders/"+o.id).update({status:st,closedAt:new Date().toISOString(),closedBy:S.uid});toast(st==="closed"?"أُغلق الأمر":st==="open"?"أُعيد فتح الأمر":"أُلغي الأمر")}catch(e){setErr(errText(e))}setBusy(false)};
  const it=catalog[o.item];
  return html`<${Sheet} title=${"أمر تصنيع #"+o.no} sub=${(it?.name||"")+(o.customer?" · "+(customers[o.customer]?.name||""):"")} onClose=${onClose}
    footer=${can?html`<span class="msg">${err}</span>${o.status==="open"?html`<button class="btn d" disabled=${busy} onClick=${()=>setStatus("cancelled")}>إلغاء الأمر</button><button class="btn p" disabled=${busy} onClick=${()=>setStatus("closed")}><${I} n="check"/>إغلاق الأمر</button>`:html`<button class="btn" disabled=${busy} onClick=${()=>setStatus("open")}>إعادة فتح</button>`}`:null}>
    ${p.late&&html`<div class="note warn"><${I} n="alert"/><span>الأمر متأخر عن موعد التسليم <span class="num">${o.due}</span>.</span></div>`}
    <${Calc} items=${[["المطلوب",fi(n(o.qty))+" قطعة"],["المُنتج",fi(p.made)+" قطعة","hl"],["المتبقي",fi(Math.max(0,n(o.qty)-p.made))+" قطعة"],["الإنجاز",p.pct.toFixed(0)+"%"],["وزن الإنتاج",fg(p.w)+" جم"],["شرايط مصروفة له",fg(p.strips)+" جم"]]}/>
    <dl class="kv"><dt>الحالة</dt><dd><${Badge} tone=${ORDER_ST[p.st]?.[1]}>${ORDER_ST[p.st]?.[0]}</${Badge}></dd><dt>موعد التسليم</dt><dd class="num">${o.due||"—"}</dd><dt>أُنشئ</dt><dd class="num">${String(o.createdAt||"").slice(0,10)}</dd>${o.note&&html`<dt>ملاحظة</dt><dd>${o.note}</dd>`}</dl>
    <div class="sect">صفوف السبك المرتبطة</div>
    ${p.rows.length?html`<div class="card"><div class="tw"><table class="t"><thead><tr><th>اليوم</th><th>الصانع</th><th class="n">العدد</th><th class="n">الميزان</th><th class="n">الخسية</th></tr></thead><tbody>${p.rows.map(e=>html`<tr key=${e.id}><td class="num">${e._date}</td><td>${e.worker||"—"}</td><td class="n">${fi(n(e.count))}</td><td class="n">${fg(n(e.scale))}</td><td class="n">${fg(khisya(e))}</td></tr>`)}</tbody></table></div></div>`
      :html`<${Empty} icon="flame" t="لا توجد صفوف سبك مرتبطة بعد" s="اختر الأمر في نموذج «صف سبك جديد»."/>`}
  </${Sheet}>`;
}

/* ---------- stocktake ---------- */
const COUNT_LOCS=[["raw","خام الخزنة"],["shop","وارد محل"],["strips","الشرايط الجاهزة"],["vault","أصناف الخزنة"],["prep","التجهيز"],["hallmark","الدمغة"],["finish","التشطيب"],["packed","التغليف"],["master","المعلم"]];
function CountPage({L,catalog,can,toast,role,open}){
  const [loc,setLoc]=useState("vault");const [all,setAll]=useState(false);const [vals,setVals]=useState({});const [note,setNote]=useState("");const [err,setErr]=useState("");const [busy,setBusy]=useState(false);const [ask,setAsk]=useState(false);
  useEffect(()=>{setVals({});setAsk(false);setErr("")},[loc]);
  const pl=COUNT_POOL[loc];const items=pl?[{id:"__raw",name:POOL[pl],c:null,w:L.P[pl].w,karat:r2(pk(L.P[pl]))}]
    :Object.entries(catalog).sort((a,b)=>n(a[1].order)-n(b[1].order)).map(([k,it])=>{const s=(L.stock[loc]||{})[k]||{c:0,w:0};return {id:k,name:it.name,c:s.c,w:s.w,karat:n(it.karat)}}).filter(r=>all||Math.abs(r.c)>0.0001||Math.abs(r.w)>0.004);
  const up=(id,k,v)=>setVals(o=>({...o,[id]:{...(o[id]||{}),[k]:v}}));
  const lines=items.map(r=>{const v=vals[r.id]||{};const hasC=v.c!==undefined&&v.c!=="",hasW=v.w!==undefined&&v.w!=="";const cc=hasC?n(v.c):r.c,cw=hasW?n(v.w):r.w;
    return {...r,counted:hasC||hasW,cc,cw,dc:r.c===null?0:cc-r.c,dw:cw-r.w}});
  const done=lines.filter(l=>l.counted);const diffs=done.filter(l=>Math.abs(l.dc)>0.0001||Math.abs(l.dw)>0.004);
  const save=async()=>{setErr("");if(!done.length)return setErr("أدخل الجرد الفعلي لصنف واحد على الأقل.");if(diffs.length&&note.trim().length<3)return setErr("اكتب سبب الفروقات في الملاحظة.");
    setBusy(true);try{await addEntry("counts",{loc,note:note.trim(),lines:done.map(l=>({item:l.id==="__raw"?"":l.id,karat:r2(l.karat),sysC:l.c===null?0:l.c,sysW:r2(l.w),cntC:l.c===null?0:l.cc,cntW:r2(l.cw),dc:l.dc,dw:r2(l.dw)}))});
      toast(diffs.length?"اعتُمد الجرد وسُجلت "+diffs.length+" تسوية":"اعتُمد الجرد — مطابق");setVals({});setNote("");setAsk(false)}catch(e){setErr(errText(e))}setBusy(false)};
  const hist=L.all.filter(e=>e._map==="counts").reverse();
  const inCls=(l,k)=>"in nm"+((k==="c"?Math.abs(l.dc)>0.0001:Math.abs(l.dw)>0.004)&&l.counted?" diff":"");
  return html`<${React.Fragment}>
    <${PH} title="الجرد والتسويات" desc="قارن الموجود فعلياً بالرصيد في النظام، واعتمد الفروقات كتسويات مسجلة"><${Sel} id="cnt-loc" value=${loc} set=${setLoc}>${COUNT_LOCS.map(([k,l])=>html`<option key=${k} value=${k}>${l}</option>`)}</${Sel}></${PH}>
    ${!can&&html`<${ReadOnly} role=${role}/>`}
    <div class="kpis">
      <${Kpi} icon="check" label="أصناف جُردت" value=${fi(done.length)} sub=${"من "+fi(lines.length)+" صنف"}/>
      <${Kpi} icon="alert" label="أصناف بها فروق" value=${fi(diffs.length)} alert=${diffs.length>0}/>
      <${Kpi} icon="box" label="فرق العدد" value=${fi(diffs.reduce((a,l)=>a+l.dc,0))} unit="قطعة"/>
      <${Kpi} icon="bar" label="فرق الوزن" value=${fg(diffs.reduce((a,l)=>a+l.dw,0))} unit="جم"/>
    </div>
    <${Card} title=${"جرد "+COUNT_LOCS.find(x=>x[0]===loc)[1]} sub="اترك الخانة فارغة لما لم يُجرد" actions=${!COUNT_POOL[loc]&&html`<label class="chk"><input type="checkbox" checked=${all} onChange=${e=>setAll(e.target.checked)}/> إظهار كل الأصناف</label>`}>
      ${lines.length?html`<div class="tw"><table class="t lines"><thead><tr><th>الصنف</th>${!COUNT_POOL[loc]&&html`<th class="n">العدد بالنظام</th><th class="n">العدد الفعلي</th><th class="n">فرق العدد</th>`}<th class="n">الوزن بالنظام</th><th class="n">الوزن الفعلي</th><th class="n">فرق الوزن</th></tr></thead><tbody>
        ${lines.map(l=>html`<tr key=${l.id}><td class="strong">${l.name}</td>
          ${!COUNT_POOL[loc]&&html`<td class="n">${fi(l.c)}</td><td style=${{width:"110px"}}><input id=${"cc-"+l.id} class=${inCls(l,"c")} inputmode="decimal" placeholder=${fi(l.c)} disabled=${!can} value=${vals[l.id]?.c??""} onInput=${e=>up(l.id,"c",e.target.value)}/></td><td class=${"n "+(l.dc<0?"neg":"")}>${l.counted?fi(l.dc):"—"}</td>`}
          <td class="n">${fg(l.w)}</td><td style=${{width:"120px"}}><input id=${"cw-"+l.id} class=${inCls(l,"w")} inputmode="decimal" placeholder=${fg(l.w)} disabled=${!can} value=${vals[l.id]?.w??""} onInput=${e=>up(l.id,"w",e.target.value)}/></td><td class=${"n "+(l.dw<0?"neg":"")}>${l.counted?fg(l.dw):"—"}</td></tr>`)}
      </tbody></table></div>`:html`<${Empty} icon="box" t="لا توجد أصناف بها رصيد هنا" s="فعّل «إظهار كل الأصناف» لجرد صنف غير مسجل."/>`}
      ${can&&html`<div class="card__b" style=${{borderTop:"1px solid var(--line)",display:"grid",gap:"12px"}}>
        <${F} label="ملاحظة / سبب الفروقات"><input id="cnt-note" class="in" value=${note} onInput=${e=>setNote(e.target.value)}/></${F}>
        <div class="ph__a" style=${{justifyContent:"flex-end"}}>${err&&html`<span class="msg" style=${{marginInlineEnd:"auto"}}>${err}</span>`}
          ${ask?html`<span style=${{fontSize:"13px",color:"var(--ink-2)"}}>${diffs.length?"سيُعدَّل الرصيد بـ "+diffs.length+" تسوية.":"الجرد مطابق."}</span><button class="btn" onClick=${()=>setAsk(false)}>رجوع</button><button class="btn p" disabled=${busy} onClick=${save}><${I} n="check"/>تأكيد الاعتماد</button>`
            :html`<button class="btn" onClick=${()=>setVals({})}>مسح</button><button class="btn p" onClick=${()=>{if(!done.length)return setErr("أدخل الجرد الفعلي لصنف واحد على الأقل.");setErr("");setAsk(true)}}>اعتماد الجرد</button>`}</div></div>`}
    </${Card}>
    <${Card} title="سجل الجرد" sub="كل جرد معتمد وتسوياته">
      <${DataTable} cols=${[{key:"_date",label:"التاريخ",get:r=>r.ts,render:r=>html`<span class="num">${r._date}</span><span class="sub num">${tme(r.ts)}</span>`},{key:"loc",label:"المكان",get:r=>(COUNT_LOCS.find(x=>x[0]===r.loc)||[0,""])[1]},{key:"n",label:"أصناف",num:1,get:r=>(r.lines||[]).length},{key:"dc",label:"فرق العدد",num:1,get:r=>(r.lines||[]).reduce((a,l)=>a+n(l.dc),0),render:r=>fi((r.lines||[]).reduce((a,l)=>a+n(l.dc),0))},{key:"dw",label:"فرق الوزن",num:1,get:r=>(r.lines||[]).reduce((a,l)=>a+n(l.dw),0),render:r=>fg((r.lines||[]).reduce((a,l)=>a+n(l.dw),0))},{key:"note",label:"ملاحظة",cls:"wrap",get:r=>r.note||"—"},stCol()]}
        rows=${hist} sort=${["_date","desc"]} rowCls=${voidCls} onRow=${open} empty=${html`<${Empty} icon="check" t="لم يُعتمد أي جرد بعد" s=""/>`}/>
    </${Card}>
  </${React.Fragment}>`;
}

/* ---------- QR labels ---------- */
const LABEL_SIZES={"50x30":{l:"50×30 مم (طابعة ملصقات)",w:50,h:30,page:"50mm 30mm"},"40x25":{l:"40×25 مم (طابعة ملصقات)",w:40,h:25,page:"40mm 25mm"},"a4":{l:"ورق A4 — 3×8",w:70,h:37,page:"A4"}};
const qrSvg=(text,cell)=>{try{const q=qrcode(0,"M");q.addData(text);q.make();return q.createSvgTag(cell||2,0)}catch(e){return""}};
function labelCodes(b){return [...Array(n(b.count))].map((_,i)=>b.prefix+"-"+String(i+1).padStart(3,"0"))}
function labelText(b,code,catalog){const it=catalog[b.item];return ["GOLD ERA",code,it?it.name:"",b.kind==="box"?("علبة × "+fi(n(b.perBox))):"",fg(n(b.weightEach))+" g",it?"K"+karatLabel(it.karat).split(" ")[0]:""].filter(Boolean).join(" | ")}
function labelsHtml(b,catalog,orders){
  const S0=LABEL_SIZES[b.size]||LABEL_SIZES["50x30"];const it=catalog[b.item]||{};const codes=labelCodes(b);const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const one=(code,i)=>`<div class="lb"><div class="q">${qrSvg(labelText(b,code,catalog),2)}</div><div class="tx"><b>GOLD ERA</b><span class="it">${esc(it.name||"")}</span><span>${b.kind==="box"?"علبة "+(i+1)+"/"+codes.length+" · "+fi(n(b.perBox))+" قطعة":"عيار "+esc(karatLabel(it.karat).split(" ")[0])}</span><span class="w">${fg(n(b.weightEach))} جم</span><span class="c">${esc(code)}</span>${b.order&&orders[b.order]?`<span>أمر #${orders[b.order].no}</span>`:""}</div></div>`;
  const grid=b.size==="a4";
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>ملصقات ${esc(b.prefix)}</title><style>
@page{size:${S0.page};margin:${grid?"10mm 0":"0"}}*{box-sizing:border-box}body{margin:0;font-family:Tahoma,Arial,sans-serif;color:#000}
.wrap{${grid?"display:grid;grid-template-columns:repeat(3,70mm);grid-auto-rows:37mm;justify-content:center":""}}
.lb{width:${S0.w}mm;height:${S0.h}mm;display:flex;align-items:center;gap:2mm;padding:2mm;overflow:hidden;${grid?"border:0.2mm dashed #bbb":"page-break-after:always"}}
.q{flex:none;width:${S0.h-5}mm;height:${S0.h-5}mm}.q svg{width:100%;height:100%}
.tx{display:flex;flex-direction:column;gap:.3mm;font-size:${S0.h<28?"6.5pt":"7.5pt"};line-height:1.15;min-width:0}
.tx b{font-size:${S0.h<28?"7pt":"8.5pt"};letter-spacing:.04em}.it{font-weight:bold}.w{font-weight:bold;direction:ltr;text-align:right}.c{direction:ltr;text-align:right;font-family:monospace;font-size:6.5pt}
@media screen{body{background:#eee;padding:10px}.lb{background:#fff;margin:0 auto 6px}}
</style></head><body><div class="wrap">${codes.map(one).join("")}</div></body></html>`;
}
function LabelsPage({L,catalog,orders,can,toast,role,intent}){
  const [sheet,setSheet]=useState(false);const [view,setView]=useState(null);
  useEffect(()=>{if(intent&&intent.label){const b=L.all.find(e=>e._map==="labels"&&e.id===intent.label);if(b)setView(b)}},[intent]);
  const rows=L.all.filter(e=>e._map==="labels").reverse();const live=rows.filter(e=>!e.void);
  const cols=[{key:"_date",label:"التاريخ",get:r=>r.ts,render:r=>html`<span class="num">${r._date}</span>`},
    {key:"prefix",label:"الكود",render:r=>html`<span class="num strong">${r.prefix}</span><span class="sub num">-001 … -${String(n(r.count)).padStart(3,"0")}</span>`},
    {key:"kind",label:"النوع",get:r=>r.kind,render:r=>html`<${Badge} tone=${r.kind==="box"?"gold":"info"}>${r.kind==="box"?"علب":"قطع"}</${Badge}>`},
    {key:"item",label:"الصنف",get:r=>catalog[r.item]?.name||"—"},
    {key:"count",label:"عدد الملصقات",num:1,get:r=>n(r.count),render:r=>fi(n(r.count))},
    {key:"weightEach",label:"الوزن / ملصق",num:1,get:r=>n(r.weightEach),render:r=>fg(n(r.weightEach))},
    {key:"order",label:"أمر التصنيع",get:r=>r.order&&orders[r.order]?"#"+orders[r.order].no:"—"},stCol()];
  return html`<${React.Fragment}>
    <${PH} title="ملصقات QR" desc="ملصقات للقطع والعلب بكود فريد لكل ملصق، تُطبع على طابعة الملصقات أو ورق A4">${can&&html`<button class="btn p" onClick=${()=>setSheet(true)}><${I} n="plus"/>دفعة ملصقات</button>`}</${PH}>
    ${!can&&html`<${ReadOnly} role=${role}/>`}
    <div class="kpis">
      <${Kpi} icon="qr" label="ملصقات مطبوعة" value=${fi(live.reduce((a,e)=>a+n(e.count),0))} sub=${fi(live.length)+" دفعة"}/>
      <${Kpi} icon="box" label="ملصقات علب" value=${fi(live.filter(e=>e.kind==="box").reduce((a,e)=>a+n(e.count),0))}/>
      <${Kpi} icon="clock" label="آخر دفعة" value=${live.length?live[live.length-1]._date:"—"}/>
    </div>
    <${Card} title="دفعات الملصقات" sub="اضغط على الدفعة لمعاينتها وطباعتها مرة أخرى"><${DataTable} cols=${cols} rows=${rows} sort=${["_date","desc"]} rowCls=${voidCls} onRow=${setView} searchPh="الكود أو الصنف" empty=${html`<${Empty} icon="qr" t="لا توجد ملصقات بعد" s=${can?"اضغط «دفعة ملصقات».":""}/>`}/></${Card}>
    ${sheet&&html`<${LabelSheet} L=${L} catalog=${catalog} orders=${orders} toast=${toast} onClose=${()=>setSheet(false)} onSaved=${setView}/>`}
    ${view&&html`<${LabelView} b=${view} catalog=${catalog} orders=${orders} toast=${toast} onClose=${()=>setView(null)}/>`}
  </${React.Fragment}>`;
}
function LabelSheet({L,catalog,orders,toast,onClose,onSaved}){
  const [f,setF]=useState({kind:"piece",item:"",count:"",perBox:"",order:"",size:"50x30",weight:""});const [err,setErr]=useState("");const [busy,setBusy]=useState(false);const up=(k,v)=>setF(o=>({...o,[k]:v}));
  const it=catalog[f.item];const autoW=it?(f.kind==="box"?n(it.w)*n(f.perBox):n(it.w)):0;const wEach=f.weight!==""?n(f.weight):autoW;
  const save=async()=>{setErr("");if(!f.item)return setErr("اختر الصنف.");if(n(f.count)<=0||n(f.count)>500)return setErr("عدد الملصقات من 1 إلى 500.");if(f.kind==="box"&&n(f.perBox)<=0)return setErr("اكتب عدد القطع في العلبة.");
    setBusy(true);try{const d=today().replace(/-/g,"").slice(2);const prefix="GE"+d+"-"+newId().slice(0,4).toUpperCase();
      const e=await addEntry("labels",{kind:f.kind,item:f.item,count:n(f.count),perBox:f.kind==="box"?n(f.perBox):0,weightEach:r2(wEach),order:f.order,size:f.size,prefix});
      toast("أُنشئت "+fi(n(f.count))+" ملصق");onClose();onSaved({...e,_date:today(),_map:"labels"})}catch(er){setErr(errText(er))}setBusy(false)};
  return html`<${Sheet} title="دفعة ملصقات QR" sub="كل ملصق يأخذ كوداً فريداً" onClose=${onClose} footer=${html`<span class="msg">${err}</span><button class="btn" onClick=${onClose}>إلغاء</button><button class="btn p" disabled=${busy} onClick=${save}><${I} n="qr"/>إنشاء ومعاينة</button>`}>
    <${Seg} opts=${[["piece","ملصقات قطع"],["box","ملصقات علب"]]} value=${f.kind} set=${v=>up("kind",v)}/>
    <div class="fg">
      <${F} full label="الصنف"><${ItemSel} id="lb-item" value=${f.item} set=${v=>{up("item",v);up("order","")}} catalog=${catalog}/></${F}>
      <${F} label=${f.kind==="box"?"عدد العلب":"عدد الملصقات"}><${Num} id="lb-c" ph="0" value=${f.count} set=${v=>up("count",v)}/></${F}>
      ${f.kind==="box"&&html`<${F} label="قطع في كل علبة"><${Num} id="lb-pb" ph="0" value=${f.perBox} set=${v=>up("perBox",v)}/></${F}>`}
      <${F} label=${f.kind==="box"?"وزن العلبة (جم)":"وزن القطعة (جم)"} hint=${f.weight===""?"من الكتالوج":"وزن مُدخل"}><${Num} id="lb-w" value=${f.weight!==""?f.weight:(autoW?String(r2(autoW)):"")} set=${v=>up("weight",v)}/></${F}>
      <${F} label="مقاس الملصق"><${Sel} id="lb-size" value=${f.size} set=${v=>up("size",v)}>${Object.entries(LABEL_SIZES).map(([k,s])=>html`<option key=${k} value=${k}>${s.l}</option>`)}</${Sel}></${F}>
      <${F} full label="أمر التصنيع" hint="اختياري"><${OrderSel} id="lb-order" orders=${orders} item=${f.item} value=${f.order} set=${v=>up("order",v)}/></${F}>
    </div>
    ${it&&html`<div class="lbprev"><div dangerouslySetInnerHTML=${{__html:qrSvg(labelText({...f,weightEach:wEach},"GE…-001",catalog),3)}}></div><div><b>GOLD ERA</b><span>${it.name}</span><span class="num">${fg(wEach)} جم</span><small>معاينة الملصق الأول</small></div></div>`}
  </${Sheet}>`;
}
function LabelView({b,catalog,orders,toast,onClose}){
  const doc=useMemo(()=>labelsHtml(b,catalog,orders),[b]);const inPreview=!!(window.claude&&window.claude.use);
  const print=()=>{const fr=document.createElement("iframe");fr.style.cssText="position:fixed;width:0;height:0;border:0;left:-9999px";document.body.appendChild(fr);
    fr.onload=()=>{try{fr.contentWindow.focus();fr.contentWindow.print()}catch(e){toast("تعذرت الطباعة من هنا — نزّل الملف واطبعه.")}setTimeout(()=>fr.remove(),60000)};fr.srcdoc=doc};
  const dl=async()=>{try{const d=await platform.use("downloads");await d.save({filename:"labels-"+b.prefix+".html",data:doc})}catch(e){if(e&&e.code!=="declined")toast("تعذر التنزيل.")}};
  return html`<${Modal} label="معاينة الملصقات" onClose=${onClose}>
    <div class="sheet__h"><div><h3>ملصقات <span class="num">${b.prefix}</span></h3><p>${catalog[b.item]?.name||""} · ${fi(n(b.count))} ${b.kind==="box"?"علبة":"ملصق"} · ${LABEL_SIZES[b.size]?.l||""}</p></div><button class="btn ghost sm" onClick=${onClose} aria-label="إغلاق"><${I} n="x"/></button></div>
    <iframe title="معاينة" class="lbframe" srcdoc=${doc}></iframe>
    <div class="sheet__f">${inPreview&&html`<span class="msg" style=${{color:"var(--muted)",fontWeight:400}}>الطباعة المباشرة تعمل بعد النشر على GitHub. هنا نزّل الملف واطبعه.</span>`}<button class="btn" onClick=${dl}><${I} n="dl"/>تنزيل الملف</button>${!inPreview&&html`<button class="btn p" onClick=${print}><${I} n="qr"/>طباعة</button>`}</div>
  </${Modal}>`;
}

/* ---------- monthly report & profit ---------- */
const ymOf=d=>d.slice(0,7);
const monthName=ym=>{const [y,m]=ym.split("-").map(Number);return new Date(y,m-1,1).toLocaleDateString("ar-EG",{month:"long",year:"numeric"})};
const addMonths=(ym,k)=>{const [y,m]=ym.split("-").map(Number);const d=new Date(y,m-1+k,1);return d.getFullYear()+"-"+pad(d.getMonth()+1)};
function monthStats(L,catalog,ym,prices,months){
  const E=L.live.filter(e=>ymOf(e._date)===ym);const cast=E.filter(e=>e._map==="casting");
  const LS=L.losses.filter(x=>ymOf(x._date)===ym);const kh=LS.reduce((a,x)=>a+x.w,0);const khFine=LS.reduce((a,x)=>a+x.f,0);
  const rec=cast.reduce((a,e)=>a+n(e.received),0);const pcs=cast.reduce((a,e)=>a+n(e.count),0),pw=cast.reduce((a,e)=>a+n(e.scale),0);
  const g24=n(prices.g24);const khCost=g24?khFine/0.9999*g24:0;
  const fees=E.filter(e=>e._map==="moves").reduce((a,e)=>a+n(e.fee),0);
  const sl=E.filter(e=>e._map==="sales");const sales=sl.reduce((a,e)=>a+n(e.total),0);const labor=sl.reduce((a,e)=>a+(e.lines||[]).reduce((b,l)=>b+n(l.laborT),0),0);
  const goldV=sl.reduce((a,e)=>a+(e.lines||[]).reduce((b,l)=>b+n(l.gold),0),0);const soldW=sl.reduce((a,e)=>a+(e.lines||[]).reduce((b,l)=>b+n(l.weight),0),0);
  const coll=E.filter(e=>e._map==="payments").reduce((a,e)=>a+n(e.amount),0)+sl.reduce((a,e)=>a+n(e.paid),0);
  const adj=E.filter(e=>e._map==="counts").reduce((a,e)=>a+(e.lines||[]).reduce((b,l)=>b+n(l.dw)*n(l.karat||999.9)/1000,0),0);
  const adjCost=g24?-adj/0.9999*g24:0;
  const exp=((months[ym]||{}).expenses||[]).reduce((a,x)=>a+n(x.amount),0);
  const profit=labor-fees-khCost-Math.max(0,adjCost)-exp+Math.max(0,-adjCost);
  return {ym,pcs,pw,kh,khFine,rec,khCost,fees,sales,labor,goldV,soldW,coll,adj,adjCost,exp,profit,days:new Set(cast.map(e=>e._date)).size,invoices:sl.length}
}
function MonthBars({data,label}){
  const [hv,setHv]=useState(-1);const W=760,H=180,pl=8,pr=60,pt=14,pb=26,iw=W-pl-pr,ih=H-pt-pb;
  const nice=v=>{if(v<=0)return 0;const p=Math.pow(10,Math.floor(Math.log10(v)));const m=v/p;return (m<=1?1:m<=2?2:m<=5?5:10)*p};const mxp=Math.max(0,...data.map(d=>d.v)),mnn=Math.min(0,...data.map(d=>d.v));const top=nice(mxp)||(mnn<0?0:1000),bot=mnn<0?-nice(-mnn):0;
  const y=v=>pt+(top-v)/(top-bot)*ih;const bw=iw/data.length;const xr=i=>pl+iw-(i+1)*bw;
  const ticks=[bot,bot/2,0,top/2,top].filter((v,i,a)=>a.indexOf(v)===i&&(v!==0||true));
  return html`<div class="chart" onMouseLeave=${()=>setHv(-1)}><svg viewBox=${"0 0 "+W+" "+H} role="img" aria-label=${label}>
    ${ticks.map(v=>html`<g key=${v}><line class=${v===0?"base":"grid"} x1=${pl} x2=${pl+iw} y1=${y(v)} y2=${y(v)}/><text x=${W-pr+8} y=${y(v)+4} text-anchor="start" class="num">${fi(v)}</text></g>`)}
    ${data.map((d,i)=>{const x=xr(i)+bw*0.2,w=bw*0.6;const y0=y(Math.max(0,d.v)),y1=y(Math.min(0,d.v));return html`<g key=${d.k}>
      <rect class=${"m"+(hv===i?" hov":"")+(d.v<0?" neg":"")} x=${x} y=${y0} width=${w} height=${Math.max(d.v?1.5:0,y1-y0)} rx="3"/>
      <text x=${x+w/2} y=${H-8} text-anchor="middle">${d.l}</text><rect class="hit" x=${xr(i)} y=${pt} width=${bw} height=${ih} onMouseEnter=${()=>setHv(i)}/></g>`})}
  </svg>${hv>=0&&html`<div class="tip" style=${{left:((xr(hv)+bw/2)/W*100)+"%",top:(y(Math.max(0,data[hv].v))/H*100)+"%"}}>${data[hv].t}<b><span class="num">${fm(data[hv].v)}</span> ج.م</b></div>`}</div>`;
}
function MonthlyReport({L,catalog,prices,months,perm,toast}){
  const [ym,setYm]=useState(ymOf(today()));const mgr=!!(perm&&perm.settings);
  const st=monthStats(L,catalog,ym,prices,months);const prev=monthStats(L,catalog,addMonths(ym,-1),prices,months);
  const last12=[...Array(12)].map((_,i)=>addMonths(ym,i-11)).map(m=>({m,s:monthStats(L,catalog,m,prices,months)}));
  const [lbl,setLbl]=useState("");const [amt,setAmt]=useState("");const [err,setErr]=useState("");
  const exps=(months[ym]||{}).expenses||[];
  const saveExp=async list=>{setErr("");try{await S.db.doc("months/"+ym).set({expenses:list,updatedAt:new Date().toISOString(),by:S.uid});return true}catch(e){setErr(errText(e));return false}};
  const g24=n(prices.g24);
  const exportCsv=async()=>{const q=s=>'"'+String(s??"").replace(/"/g,'""')+'"';const rows=[["الشهر","القطع","وزن الإنتاج","الخسية (جم)","تكلفة الخسية","رسوم الدمغة","المبيعات","إيراد المصنعية","مصروفات أخرى","الربح التقديري"]];
    last12.forEach(({m,s})=>rows.push([m,s.pcs,r2(s.pw),r2(s.kh),r2(s.khCost),r2(s.fees),r2(s.sales),r2(s.labor),r2(s.exp),r2(s.profit)]));
    try{const d=await platform.use("downloads");await d.save({filename:"gold-era-monthly-"+ym+".csv",data:"﻿"+rows.map(r=>r.map(q).join(",")).join("\r\n")})}catch(e){if(e&&e.code!=="declined")toast("تعذر التصدير.")}};
  const pl=[["إيراد المصنعية",st.labor,"من فواتير الشهر"],["رسوم الدمغة",-st.fees,"تسليمات الدمغة"],["تكلفة الخسية",-st.khCost,fg(st.khFine)+" جم فاين × سعر عيار 24"],
    ...(st.adj?[["تسويات الجرد",-st.adjCost,fg(st.adj)+" جم فاين"]]:[]),["مصروفات أخرى",-st.exp,exps.length+" بند"]];
  return html`<${React.Fragment}>
    <div class="ph__a" style=${{justifyContent:"space-between"}}><div class="ph__a"><button class="btn sm" onClick=${()=>setYm(addMonths(ym,-1))}>الشهر السابق</button><input id="m-ym" type="month" class="in" style=${{width:"auto",height:"30px"}} value=${ym} onChange=${e=>e.target.value&&setYm(e.target.value)} aria-label="الشهر"/><button class="btn sm" disabled=${ym>=ymOf(today())} onClick=${()=>setYm(addMonths(ym,1))}>الشهر التالي</button></div><button class="btn sm" onClick=${exportCsv}><${I} n="dl"/>تصدير آخر 12 شهراً</button></div>
    ${!g24&&html`<div class="note warn"><${I} n="alert"/><span>حدد سعر جرام عيار 24 في الإعدادات لحساب تكلفة الخسية والربح.</span></div>`}
    <div class="kpis six">
      <${Kpi} icon="box" label="الإنتاج" value=${fi(st.pcs)} unit="قطعة" delta=${deltaOf(st.pcs,prev.pcs)} good="up" sub=${fg(st.pw)+" جم · "+st.days+" يوم عمل"}/>
      <${Kpi} icon="flame" label="الخسية" value=${fg(st.kh)} unit="جم" delta=${deltaOf(st.kh,prev.kh)} good="down" sub=${st.rec?(st.kh/st.rec*1000).toFixed(2)+" ‰ من المتسلمة":""}/>
      <${Kpi} icon="receipt" label="المبيعات" value=${fm(st.sales)} unit="ج.م" delta=${deltaOf(st.sales,prev.sales)} good="up" sub=${fi(st.invoices)+" فاتورة · "+fg(st.soldW)+" جم"}/>
      <${Kpi} icon="wallet" label="التحصيل" value=${fm(st.coll)} unit="ج.م"/>
      <${Kpi} icon="stamp" label="المصنعية" value=${fm(st.labor)} unit="ج.م" delta=${deltaOf(st.labor,prev.labor)} good="up"/>
      <${Kpi} icon="chart" label="الربح التقديري" value=${fm(st.profit)} unit="ج.م" delta=${deltaOf(st.profit,prev.profit)} good="up" alert=${st.profit<0}/>
    </div>
    <div class="g2">
      <${Card} title=${"قائمة الربح — "+monthName(ym)} sub="الذهب يُباع بسعر الجرام ويُشترى بسعره، فالربح من المصنعية ناقص التكاليف">
        <div class="tw"><table class="t"><tbody>${pl.map(([k,v,s])=>html`<tr key=${k}><td><span class="strong">${k}</span><span class="sub">${s}</span></td><td class=${"n strong "+(v<0?"neg":"")}>${fm(v)}</td></tr>`)}</tbody>
          <tfoot><tr><td>الربح التقديري</td><td class=${"n "+(st.profit<0?"neg":"")}>${fm(st.profit)} ج.م</td></tr></tfoot></table></div>
        <div class="card__b" style=${{borderTop:"1px solid var(--line)",fontSize:"12.5px",color:"var(--muted)"}}>قيمة الذهب في فواتير الشهر <b class="num">${fm(st.goldV)}</b> ج.م (تمرير بسعر اليوم، لا تدخل في الربح). تكلفة الخسية محسوبة بسعر عيار 24 الحالي <b class="num">${g24?fm(g24):"—"}</b>.</div>
      </${Card}>
      <${Card} title="مصروفات الشهر" sub="أجور، كهرباء، إيجار… تدخل في الربح التقديري">
        ${exps.length?html`<div class="tw"><table class="t"><tbody>${exps.map((x,i)=>html`<tr key=${i}><td>${x.label}</td><td class="n strong">${fm(n(x.amount))}</td>${mgr&&html`<td class="n" style=${{width:"60px"}}><button class="btn ghost sm" aria-label="حذف" onClick=${()=>saveExp(exps.filter((_,j)=>j!==i))}><${I} n="x"/></button></td>`}</tr>`)}</tbody><tfoot><tr><td>الإجمالي</td><td class="n">${fm(st.exp)}</td>${mgr&&html`<td></td>`}</tr></tfoot></table></div>`:html`<${Empty} icon="wallet" t="لا توجد مصروفات مسجلة لهذا الشهر" s=""/>`}
        ${mgr&&html`<div class="card__b" style=${{borderTop:"1px solid var(--line)"}}><div class="fg" style=${{gridTemplateColumns:"minmax(0,2fr) minmax(0,1fr) auto",alignItems:"end"}}>
          <${F} label="البند"><input id="ex-l" class="in" value=${lbl} onInput=${e=>setLbl(e.target.value)} placeholder="مثال: كهرباء"/></${F}><${F} label="المبلغ"><${Num} id="ex-a" value=${amt} set=${setAmt}/></${F}>
          <button class="btn p" onClick=${async()=>{if(!lbl.trim()||n(amt)<=0)return setErr("اكتب البند والمبلغ.");if(await saveExp([...exps,{label:lbl.trim(),amount:n(amt)}])){setLbl("");setAmt("");toast("أُضيف المصروف")}}}><${I} n="plus"/>إضافة</button></div>${err&&html`<p class="msg">${err}</p>`}</div>`}
      </${Card}>
    </div>
    <${Card} title="الربح التقديري — آخر 12 شهراً" sub="ج.م"><${MonthBars} label="الربح التقديري الشهري" data=${last12.map(({m,s})=>({k:m,v:r2(s.profit),l:m.slice(5)+"/"+m.slice(2,4),t:monthName(m)}))}/></${Card}>
    <${Card} title="مقارنة الشهور"><${DataTable} cols=${[{key:"m",label:"الشهر",render:r=>monthName(r.m)},{key:"pcs",label:"القطع",num:1,render:r=>fi(r.pcs)},{key:"pw",label:"وزن الإنتاج",num:1,render:r=>fg(r.pw)},{key:"kh",label:"الخسية",num:1,render:r=>fg(r.kh)},{key:"sales",label:"المبيعات",num:1,render:r=>fm(r.sales)},{key:"labor",label:"المصنعية",num:1,render:r=>fm(r.labor)},{key:"profit",label:"الربح التقديري",num:1,render:r=>html`<span class=${"strong "+(r.profit<0?"neg":"")}>${fm(r.profit)}</span>`}]}
      rows=${last12.map(({m,s})=>({id:m,...s,m}))} sort=${["m","desc"]} pageSize=${12}/></${Card}>
  </${React.Fragment}>`;
}

async function seedDefaults(){try{const r=await fetch("data/defaults.json");if(!r.ok)return false;const d=await r.json();const s=await S.db.doc("settings/catalog").get();if((!s.exists||!Object.keys((s.data()||{}).items||{}).length)&&d.catalog)await S.db.doc("settings/catalog").set({items:d.catalog,updatedAt:new Date().toISOString(),by:S.uid});return true}catch(e){console.warn("seed failed",e);return false}}
function BackupEdit({isOwner,mgr,toast}){
  const [err,setErr]=useState("");const [busy,setBusy]=useState(false);const [pending,setPending]=useState(null);
  const exportAll=async()=>{setErr("");setBusy(true);try{const out={app:"gold-era-erp",version:1,exportedAt:new Date().toISOString(),docs:{}};
      for(const c of ["settings","customers","orders","months",...ALL_LEDGER]){const q=await S.db.collection(c).get();q.docs.forEach(d=>{out.docs[c+"/"+d.id]=d.data()})}
      const dl=await platform.use("downloads");await dl.save({filename:"gold-era-backup-"+today()+".json",data:JSON.stringify(out,null,1)});toast("تم تنزيل النسخة الاحتياطية")}catch(e){setErr(errText(e))}setBusy(false)};
  const pick=async ev=>{setErr("");const f=ev.target.files&&ev.target.files[0];if(!f)return;try{const d=JSON.parse(await f.text());if(!d||d.app!=="gold-era-erp"||!d.docs)throw 0;setPending(d)}catch(e){setErr("الملف ليس نسخة احتياطية من هذا النظام.")}ev.target.value=""};
  const restore=async()=>{setBusy(true);setErr("");try{for(const [p,v] of Object.entries(pending.docs)){if(!/^(settings|customers|orders|months|bars|strips|casting|moves|sales|payments|counts|labels)\/[A-Za-z0-9_.~:@+-]+$/.test(p))continue;await S.db.doc(p).set(v)}toast("تمت الاستعادة");setPending(null)}catch(e){setErr(errText(e))}setBusy(false)};
  return html`<${Card} title="النسخ الاحتياطي" sub="تنزيل كل البيانات في ملف واحد، واستعادتها عند الحاجة" body=${true}>
    <div style=${{display:"grid",gap:"14px"}}>
      <div class="ph__a"><button class="btn p" disabled=${busy||!mgr} onClick=${exportAll}><${I} n="dl"/>تنزيل نسخة احتياطية</button>
        ${isOwner&&html`<label class="btn"><${I} n="plus"/>استعادة من ملف<input type="file" accept="application/json,.json" hidden onChange=${pick}/></label>`}</div>
      ${pending&&html`<div class="note warn"><${I} n="alert"/><span>الملف يحتوي <b class="num">${fi(Object.keys(pending.docs).length)}</b> مستند، بتاريخ <span class="num">${String(pending.exportedAt||"").slice(0,10)}</span>. الاستعادة تستبدل المستندات التي تحمل نفس الأسماء. <span style=${{display:"flex",gap:"8px",marginTop:"8px"}}><button class="btn d sm" disabled=${busy} onClick=${restore}>تأكيد الاستعادة</button><button class="btn sm" onClick=${()=>setPending(null)}>إلغاء</button></span></span></div>`}
      <div class="note"><${I} n="info"/><span>احفظ نسخة أسبوعياً على الأقل خارج المتصفح. الاستعادة للمالك فقط.</span></div>
      ${err&&html`<span class="msg">${err}</span>`}
    </div></${Card}>`}
/* ---------- workers, departments ---------- */
const DEFAULT_DEPTS=["وارد محل","الحل","الشرايط","التصنيع","سبك","تقطيع","تجهيز","دمغة","تشطيب","تغليف","تكويد","معلم"];
const CORE_DEPTS=["الحل","الشرايط","التصنيع","تجهيز","تغليف"];
const deptsOf=w=>w?(Array.isArray(w.depts)&&w.depts.length?w.depts:(w.dept?[w.dept]:[])):[];
const wDept=w=>deptsOf(w).join("، ");
const TASKS=["حل","شرايط","تصنيع","سبك","تقطيع","هزاز","ماتور","بلص","تشطيب","تغليف","تكويد","دمغة","أخرى"];
const hrs=ms=>ms/3600000;
const fh=h=>{const m=Math.round(h*60);return Math.floor(m/60)+":"+pad(m%60)};
const sesEnd=e=>e.end?new Date(e.end).getTime():Date.now();
const sesHours=e=>e.start?Math.max(0,hrs(sesEnd(e)-new Date(e.start).getTime())):0;
const hhmm=iso=>{try{const d=new Date(iso);return pad(d.getHours())+":"+pad(d.getMinutes())}catch(e){return "—"}};
const atTime=(dateKey,t)=>{const [y,m,d]=dateKey.split("-").map(Number);const [H,M]=String(t||"00:00").split(":").map(Number);return new Date(y,m-1,d,H||0,M||0).toISOString()};
function useTick(ms){const [,set]=useState(0);useEffect(()=>{const t=setInterval(()=>set(x=>x+1),ms);return()=>clearInterval(t)},[ms])}
async function saveWorker(id,data){if(!S.db)throw {code:"no_db"};await S.db.doc("staff/"+id).set({...data,updatedAt:new Date().toISOString(),by:S.uid})}
const workerList=(workers,activeOnly)=>Object.values(workers).filter(w=>!activeOnly||w.active!==false).sort((a,b)=>(a.dept||"").localeCompare(b.dept||"","ar")||(a.name||"").localeCompare(b.name||"","ar"));
function WorkerSel({workers,value,set,id,dept,byName,optional}){const act=workerList(workers,true);let list=act.filter(w=>!dept||deptsOf(w).includes(dept));if(dept&&!list.length)list=act;else if(dept)list=list.concat(act.filter(w=>!list.includes(w)&&!deptsOf(w).length));
  return html`<${Sel} id=${id} value=${value} set=${set}><option value="">${optional?"—":"اختر العامل"}</option>${list.map(w=>html`<option key=${w.id} value=${byName?w.name:w.id}>${w.name}${deptsOf(w).length?" — "+wDept(w):""}</option>`)}</${Sel}>`}

function WorkersPage({L,workers,depts,can,toast,go}){
  const [edit,setEdit]=useState(null);const [dep,setDep]=useState("");const [nd,setNd]=useState("");const [err,setErr]=useState("");
  const t=today();const live=L.live;
  const open=live.filter(e=>e._map==="sessions"&&!e.end);
  const rows=workerList(workers).filter(w=>!dep||deptsOf(w).includes(dep)).map(w=>{const s=open.find(e=>e.worker===w.id);const th=live.filter(e=>e._map==="sessions"&&e.worker===w.id&&e._date===t).reduce((a,e)=>a+sesHours(e),0);return {...w,now:s,th}});
  const saveDepts=async list=>{setErr("");try{await S.db.doc("staff/__departments").set({list,updatedAt:new Date().toISOString(),by:S.uid});return true}catch(e){setErr(errText(e));return false}};
  const cols=[{key:"name",label:"العامل",render:r=>html`<span class="strong">${r.name}</span>${r.code&&html`<span class="sub num">${r.code}</span>`}`},
    {key:"dept",label:"الأقسام",get:r=>wDept(r),cls:"keep wrap",render:r=>deptsOf(r).length?html`<span style=${{display:"inline-flex",gap:"4px",flexWrap:"wrap"}}>${deptsOf(r).map(d=>html`<${Badge} key=${d} tone="gold">${d}</${Badge}>`)}</span>`:"—"},
    {key:"phone",label:"الهاتف",render:r=>html`<span class="num">${r.phone||"—"}</span>`},
    {key:"joined",label:"تاريخ الالتحاق",render:r=>html`<span class="num">${r.joined||"—"}</span>`},
    {key:"now",label:"الآن",get:r=>r.now?1:0,render:r=>r.now?html`<${Badge} tone="ok">يعمل منذ ${hhmm(r.now.start)}</${Badge}>`:html`<span class="sub">—</span>`,cls:"keep"},
    {key:"th",label:"ساعات اليوم",num:1,render:r=>r.th?fh(r.th):"—"},
    {key:"active",label:"الحالة",get:r=>r.active===false?0:1,render:r=>r.active===false?html`<${Badge} tone="bad">موقوف</${Badge}>`:html`<${Badge} tone="ok">نشط</${Badge}>`,cls:"keep"}];
  const counts={};workerList(workers,true).forEach(w=>(deptsOf(w).length?deptsOf(w):["—"]).forEach(d=>{counts[d]=(counts[d]||0)+1}));
  return html`<${React.Fragment}>
    <${PH} title="العمال والأقسام" desc="بيانات العمال وأقسامهم، تُستخدم في وقت العمل والسبك والمراحل والتقارير">
      <${Sel} id="w-dep" value=${dep} set=${setDep}><option value="">كل الأقسام</option>${depts.map(d=>html`<option key=${d} value=${d}>${d}</option>`)}</${Sel}>
      ${can&&html`<button class="btn p" onClick=${()=>setEdit({})}><${I} n="plus"/>عامل جديد</button>`}</${PH}>
    ${!can&&html`<${ReadOnly}/>`}
    <div class="kpis">
      <${Kpi} icon="users" label="عمال نشطون" value=${fi(workerList(workers,true).length)} sub=${fi(Object.keys(workers).length)+" مسجل"}/>
      <${Kpi} icon="clock" label="يعملون الآن" value=${fi(open.length)} onClick=${()=>go("attendance")}/>
      <${Kpi} icon="dash" label="الأقسام" value=${fi(depts.length)} sub=${Object.entries(counts).slice(0,3).map(([d,c])=>d+" "+c).join(" · ")}/>
    </div>
    <div class="g2">
      <${Card} title="العمال" sub="اضغط على العامل لتعديل بياناته"><${DataTable} cols=${cols} rows=${rows} sort=${["dept","asc"]} onRow=${can?r=>setEdit(r):null} searchPh="الاسم أو الكود أو الهاتف" empty=${html`<${Empty} icon="users" t="لا يوجد عمال" s=${can?"اضغط «عامل جديد».":""}/>`}/></${Card}>
      <${Card} title="الأقسام" sub="تظهر في بيانات العمال ووقت العمل">
        <div class="card__b" style=${{display:"grid",gap:"12px"}}>
          <div class="ph__a">${depts.map(d=>html`<span key=${d} class="bd gold plain" style=${{height:"28px",padding:"0 10px"}}>${d} <span class="num" style=${{opacity:.7}}>${counts[d]||0}</span>${can&&html`<button class="xbtn" style=${{padding:"0 0 0 2px"}} aria-label=${"حذف "+d} onClick=${async()=>{if(counts[d])return setErr("انقل عمال قسم «"+d+"» أولاً.");if(await saveDepts(depts.filter(x=>x!==d)))toast("حُذف القسم")}}>×</button>`}</span>`)}</div>
          ${can&&html`<div class="fg" style=${{gridTemplateColumns:"minmax(0,1fr) auto",alignItems:"end"}}><${F} label="قسم جديد"><input id="dep-new" class="in" value=${nd} onInput=${e=>setNd(e.target.value)} placeholder="مثال: الصب"/></${F}><button class="btn" onClick=${async()=>{const v=nd.trim();if(!v)return;if(depts.includes(v))return setErr("القسم موجود.");if(await saveDepts([...depts,v])){setNd("");toast("أُضيف القسم")}}}><${I} n="plus"/>إضافة</button></div>`}
          ${err&&html`<span class="msg">${err}</span>`}
        </div>
      </${Card}>
    </div>
    ${edit&&html`<${WorkerSheet} w=${edit.id?edit:null} depts=${depts} workers=${workers} toast=${toast} onClose=${()=>setEdit(null)}/>`}
  </${React.Fragment}>`;
}
function WorkerSheet({w,depts,workers,toast,onClose}){
  const [f,setF]=useState(()=>w?{name:w.name||"",depts:deptsOf(w),code:w.code||"",phone:w.phone||"",joined:w.joined||"",active:w.active!==false,note:w.note||""}:{name:"",depts:[],code:"",phone:"",joined:today(),active:true,note:""});
  const [err,setErr]=useState("");const [busy,setBusy]=useState(false);const up=(k,v)=>setF(o=>({...o,[k]:v}));
  const save=async()=>{setErr("");const name=f.name.trim();if(!name)return setErr("اكتب اسم العامل.");if(!f.depts.length)return setErr("اختر قسماً واحداً على الأقل.");if(Object.values(workers).some(x=>x.name===name&&(!w||x.id!==w.id)))return setErr("يوجد عامل بنفس الاسم.");
    setBusy(true);try{const id=w?w.id:"w"+newId().slice(0,10);await saveWorker(id,{id,name,dept:f.depts[0],depts:f.depts,code:f.code.trim(),phone:f.phone.trim(),joined:f.joined,active:f.active,note:f.note.trim()});toast(w?"حُفظت بيانات "+name:"أُضيف "+name);onClose()}catch(e){setErr(errText(e))}setBusy(false)};
  return html`<${Sheet} title=${w?w.name:"عامل جديد"} onClose=${onClose} footer=${html`<span class="msg">${err}</span><button class="btn" onClick=${onClose}>إلغاء</button><button class="btn p" disabled=${busy} onClick=${save}><${I} n="check"/>حفظ</button>`}>
    <div class="fg">
      <${F} full label="الاسم"><input id="wk-n" class="in" autoFocus value=${f.name} onInput=${e=>up("name",e.target.value)}/></${F}>
      <${F} full label="الأقسام" hint="اختار كل الأقسام اللي العامل بيشتغل فيها — الأول هو الأساسي"><div class="chips" role="group">${depts.map(d=>html`<button type="button" key=${d} class="chip" aria-pressed=${f.depts.includes(d)?"true":"false"} onClick=${()=>up("depts",f.depts.includes(d)?f.depts.filter(x=>x!==d):[...f.depts,d])}>${f.depts.includes(d)&&html`<${I} n="check" s=${13}/>`}${d}</button>`)}</div></${F}>
      <${F} label="الكود" hint="اختياري"><input id="wk-c" class="in nm" value=${f.code} onInput=${e=>up("code",e.target.value)}/></${F}>
      <${F} label="الهاتف"><input id="wk-p" class="in nm" inputmode="tel" value=${f.phone} onInput=${e=>up("phone",e.target.value)}/></${F}>
      <${F} label="تاريخ الالتحاق"><input id="wk-j" type="date" class="in" value=${f.joined} onChange=${e=>up("joined",e.target.value)}/></${F}>
      <${F} full label="الحالة"><${Seg} opts=${[["on","نشط"],["off","موقوف"]]} value=${f.active?"on":"off"} set=${v=>up("active",v==="on")}/></${F}>
      <${F} full label="ملاحظة"><input id="wk-note" class="in" value=${f.note} onInput=${e=>up("note",e.target.value)}/></${F}>
    </div>
  </${Sheet}>`;
}

/* ---------- work time ---------- */
async function startSession(w,body,startISO){const k=dkey(new Date(startISO));return addEntry("sessions",{worker:w.id,wname:w.name,dept:w.dept||"",...body,start:startISO,end:null},k)}
async function stopSession(e,body){await S.db.doc("sessions/"+e._date).update({sessions:{[e.id]:{...body,closedBy:S.uid}}})}
function AttendancePage({L,catalog,workers,orders,can,toast,open,config}){
  useTick(1000);
  const [start,setStart]=useState(null);const [stop,setStop]=useState(null);const [day,setDay]=useState(today());
  const ses=L.live.filter(e=>e._map==="sessions");const running=ses.filter(e=>!e.end);
  const dayRows=L.all.filter(e=>e._map==="sessions"&&(e._date===day||(!e.end&&day===today()))).reverse();
  const live=dayRows.filter(e=>!e.void);
  const totH=live.reduce((a,e)=>a+sesHours(e),0),pcs=live.reduce((a,e)=>a+n(e.pcs),0),wt=live.reduce((a,e)=>a+n(e.weight),0);
  const board=workerList(workers,true).map(w=>{const r=running.find(e=>e.worker===w.id);const mine=live.filter(e=>e.worker===w.id);return {id:w.id,w,r,h:mine.reduce((a,e)=>a+sesHours(e),0),p:mine.reduce((a,e)=>a+n(e.pcs),0),g:mine.reduce((a,e)=>a+n(e.weight),0),cnt:mine.length}});
  const cols=[{key:"name",label:"العامل",get:r=>r.w.name,render:r=>html`<span class="strong">${r.w.name}</span><span class="sub">${wDept(r.w)}</span>`},
    {key:"st",label:"الحالة",get:r=>r.r?1:0,cls:"keep",render:r=>r.r?html`<${Badge} tone="ok">يعمل · ${(r.r.job&&JOBS[r.r.job]?JOBS[r.r.job].label:r.r.task)||""} · منذ ${hhmm(r.r.start)}</${Badge}>`:html`<${Badge} tone="plain">متوقف</${Badge}>`},
    {key:"live",label:"المدة الحالية",num:1,get:r=>r.r?sesHours(r.r):0,render:r=>r.r?html`<span class="strong timer">${fhs(Date.now()-new Date(r.r.start))}</span>`:"—"},
    {key:"h",label:"ساعات اليوم",num:1,render:r=>r.h?fh(r.h):"—"},{key:"p",label:"قطع اليوم",num:1,render:r=>r.p?fi(r.p):"—"},{key:"g",label:"وزن اليوم",num:1,render:r=>r.g?fg(r.g):"—"},
    {key:"act",label:"",sort:false,cls:"keep",render:r=>can&&day===today()?(r.r?html`<button class="btn sm d" onClick=${ev=>{ev.stopPropagation();setStop(r.r)}}>إنهاء</button>`:html`<button class="btn sm p" onClick=${ev=>{ev.stopPropagation();setStart(r.w)}}>بدء</button>`):null}];
  const scol=[{key:"start",label:"البداية",get:r=>r.start,render:r=>html`<span class="num">${hhmm(r.start)}</span>${r._date!==day&&html`<span class="sub num">${r._date}</span>`}`},
    {key:"end",label:"النهاية",get:r=>r.end||"z",render:r=>r.end?html`<span class="num">${hhmm(r.end)}</span>`:html`<${Badge} tone="ok">جارية</${Badge}>`,cls:"keep"},
    {key:"wname",label:"العامل"},{key:"task",label:"الشغل",get:r=>(r.task||"")+(r.item&&catalog[r.item]?" · "+catalog[r.item].name:"")},
    {key:"dur",label:"المدة",num:1,get:r=>sesHours(r),render:r=>fh(sesHours(r))},{key:"pcs",label:"القطع",num:1,get:r=>n(r.pcs),render:r=>r.end?fi(n(r.pcs)):"—"},
    {key:"weight",label:"الوزن",num:1,get:r=>n(r.weight),render:r=>r.end?fg(n(r.weight)):"—"},{key:"rate",label:"قطعة/ساعة",num:1,get:r=>sesHours(r)?n(r.pcs)/sesHours(r):0,render:r=>r.end&&sesHours(r)?(n(r.pcs)/sesHours(r)).toFixed(1):"—"},stCol()];
  const stale=running.filter(e=>e._date<today());
  return html`<${React.Fragment}>
    <${PH} title="وقت العمل" desc="الوقت يبدأ تلقائياً لما العامل يستلم شغله في أي قسم، ويقف لما يسلّم — وتقدر تبدأ وقت يدوي لأي شغل تاني">
      <input id="at-day" type="date" class="in" style=${{width:"auto",height:"36px"}} value=${day} max=${today()} onChange=${e=>setDay(e.target.value||today())} aria-label="اليوم"/></${PH}>
    ${!can&&html`<${ReadOnly}/>`}
    ${stale.length>0&&html`<div class="note warn"><${I} n="alert"/><span>${fi(stale.length)} جلسة مفتوحة من أيام سابقة: ${stale.map(e=>e.wname).join("، ")}. أنهِها بوقتها الصحيح.</span></div>`}
    <div class="kpis">
      <${Kpi} icon="clock" label="يعملون الآن" value=${fi(running.length)} sub=${fi(workerList(workers,true).length)+" عامل نشط"}/>
      <${Kpi} icon="chart" label="ساعات العمل" value=${fh(totH)} sub=${fi(live.length)+" جلسة"}/>
      <${Kpi} icon="box" label="إنتاج الجلسات" value=${fi(pcs)} unit="قطعة" sub=${fg(wt)+" جم"}/>
      <${Kpi} icon="flame" label="متوسط الإنتاجية" value=${totH?(pcs/totH).toFixed(1):"—"} unit=${totH?"قطعة/ساعة":""}/>
    </div>
    <${Card} title="لوحة العمال" sub=${day===today()?"اضغط «بدء» عند بداية الشغل و«إنهاء» عند التسليم":"يوم "+day}>
      <${DataTable} cols=${cols} rows=${board} sort=${["st","desc"]} pageSize=${30} searchPh="اسم العامل" empty=${html`<${Empty} icon="users" t="لا يوجد عمال نشطون" s="أضف العمال من صفحة «العمال والأقسام»."/>`}/>
    </${Card}>
    <${Card} title="الجلسات" sub=${"يوم "+day}><${DataTable} cols=${scol} rows=${dayRows} sort=${["start","desc"]} rowCls=${voidCls} onRow=${open} empty=${html`<${Empty} icon="clock" t="لا توجد جلسات" s=""/>`}/></${Card}>
    ${start&&html`<${StartSheet} w=${start} catalog=${catalog} orders=${orders} toast=${toast} onClose=${()=>setStart(null)}/>`}
    ${stop&&(GOLD_JOBS.includes(stop.job)?html`<${JobCloseSheet} e=${stop} L=${L} catalog=${catalog} config=${config} toast=${toast} onClose=${()=>setStop(null)}/>`:html`<${StopSheet} e=${stop} catalog=${catalog} toast=${toast} onClose=${()=>setStop(null)}/>`)}
  </${React.Fragment}>`;
}
function StartSheet({w,catalog,orders,toast,onClose}){
  const d0=new Date();const [f,setF]=useState({task:TASKS.includes(w.dept)?w.dept:(w.dept==="دمغة"?"دمغة":TASKS[0]),item:"",order:"",time:pad(d0.getHours())+":"+pad(d0.getMinutes()),note:""});const [err,setErr]=useState("");const [busy,setBusy]=useState(false);const up=(k,v)=>setF(o=>({...o,[k]:v}));
  const save=async()=>{setErr("");const st=atTime(today(),f.time);if(new Date(st).getTime()>Date.now()+60000)return setErr("وقت البداية في المستقبل.");
    setBusy(true);try{await startSession(w,{task:f.task,item:f.item,order:f.order,note:f.note.trim()},st);toast("بدأ وقت "+w.name);onClose()}catch(e){setErr(errText(e))}setBusy(false)};
  return html`<${Sheet} title=${"بدء وقت — "+w.name} sub=${wDept(w)} onClose=${onClose} footer=${html`<span class="msg">${err}</span><button class="btn" onClick=${onClose}>إلغاء</button><button class="btn p" disabled=${busy} onClick=${save}><${I} n="clock"/>بدء</button>`}>
    <div class="fg">
      <${F} label="الشغل"><${Sel} id="ss-task" value=${f.task} set=${v=>up("task",v)}>${TASKS.map(t=>html`<option key=${t}>${t}</option>`)}</${Sel}></${F}>
      <${F} label="وقت البداية"><input id="ss-time" type="time" class="in nm" value=${f.time} onChange=${e=>up("time",e.target.value)}/></${F}>
      <${F} full label="الصنف" hint="اختياري"><${ItemSel} id="ss-item" value=${f.item} set=${v=>up("item",v)} catalog=${catalog}/></${F}>
      <${F} full label="أمر التصنيع" hint="اختياري"><${OrderSel} id="ss-order" orders=${orders} item=${f.item} value=${f.order} set=${v=>{up("order",v);if(v&&orders[v])up("item",orders[v].item)}}/></${F}>
      <${F} full label="ملاحظة"><input id="ss-note" class="in" value=${f.note} onInput=${e=>up("note",e.target.value)}/></${F}>
    </div>
  </${Sheet}>`;
}
function StopSheet({e,catalog,toast,onClose}){
  const d0=new Date();const sameDay=e._date===today();
  const [f,setF]=useState({date:sameDay?today():e._date,time:pad(d0.getHours())+":"+pad(d0.getMinutes()),pcs:"",weight:"",note:e.note||""});const [err,setErr]=useState("");const [busy,setBusy]=useState(false);const up=(k,v)=>setF(o=>({...o,[k]:v}));
  const it=catalog[e.item];const endISO=atTime(f.date,f.time);const h=Math.max(0,hrs(new Date(endISO)-new Date(e.start)));
  const autoW=it?n(it.w)*n(f.pcs):0;const w=f.weight!==""?n(f.weight):autoW;
  const save=async()=>{setErr("");if(new Date(endISO)<=new Date(e.start))return setErr("وقت النهاية قبل البداية.");if(new Date(endISO).getTime()>Date.now()+60000)return setErr("وقت النهاية في المستقبل.");
    setBusy(true);try{await stopSession(e,{end:endISO,pcs:n(f.pcs),weight:r2(w),note:f.note.trim(),hours:r2(h)});toast("انتهى وقت "+e.wname+" — "+fh(h));onClose()}catch(x){setErr(errText(x))}setBusy(false)};
  return html`<${Sheet} title=${"إنهاء وقت — "+e.wname} sub=${(e.task||"")+" · بدأ "+hhmm(e.start)+(sameDay?"":" يوم "+e._date)} onClose=${onClose} footer=${html`<span class="msg">${err}</span><button class="btn" onClick=${onClose}>إلغاء</button><button class="btn p" disabled=${busy} onClick=${save}><${I} n="check"/>إنهاء وحفظ الإنتاج</button>`}>
    <div class="fg">
      ${!sameDay&&html`<${F} label="تاريخ النهاية"><input id="se-date" type="date" class="in" value=${f.date} min=${e._date} max=${today()} onChange=${x=>up("date",x.target.value)}/></${F}>`}
      <${F} label="وقت النهاية"><input id="se-time" type="time" class="in nm" value=${f.time} onChange=${x=>up("time",x.target.value)}/></${F}>
      <${F} label="عدد القطع المنجزة"><${Num} id="se-pcs" ph="0" value=${f.pcs} set=${v=>up("pcs",v)}/></${F}>
      <${F} label="الوزن (جم)" hint=${f.weight===""&&it?"من الكتالوج":""}><${Num} id="se-w" value=${f.weight!==""?f.weight:(autoW?String(r2(autoW)):"")} set=${v=>up("weight",v)}/></${F}>
      <${F} full label="ملاحظة"><input id="se-note" class="in" value=${f.note} onInput=${x=>up("note",x.target.value)}/></${F}>
    </div>
    <${Calc} items=${[["المدة",fh(h),"hl"],["قطعة/ساعة",h&&n(f.pcs)?(n(f.pcs)/h).toFixed(1):"—"],["جم/ساعة",h&&w?fg(w/h):"—"]]}/>
  </${Sheet}>`;
}

/* ---------- daily report ---------- */
const RATING={good:["كويس","ok"],ok:["متوسط","warn"],bad:["مش كويس","bad"]};
function dayData(L,catalog,d){
  const E=L.live.filter(e=>e._date===d);const cast=E.filter(e=>e._map==="casting");const mv=a=>E.filter(e=>e._map==="moves"&&e.action===a);
  const sum=(arr,f)=>arr.reduce((a,e)=>a+f(e),0);
  return {cast,received:sum(cast,e=>n(e.received)),made:sum(cast,e=>n(e.count)),madeW:sum(cast,e=>n(e.scale)),kh:sum(cast,khisya),
    prep:{c:sum(mv("to_prep"),e=>n(e.count)),w:sum(mv("to_prep"),e=>n(e.weight))},
    hmOut:{c:sum(mv("to_hallmark"),e=>n(e.count)),w:sum(mv("to_hallmark"),e=>n(e.weight)),b:sum(mv("to_hallmark"),e=>n(e.boxes)),fee:sum(mv("to_hallmark"),e=>n(e.fee))},
    hmIn:{c:sum(mv("from_hallmark"),e=>n(e.count)),w:sum(mv("from_hallmark"),e=>n(e.weight)),b:sum(mv("from_hallmark"),e=>n(e.boxes))},
    hmRet:{c:sum(mv("back_hallmark"),e=>n(e.count)),w:sum(mv("back_hallmark"),e=>n(e.weight))},
    pack:{c:sum(mv("pack"),e=>n(e.count)),w:sum(mv("pack"),e=>n(e.weight)),b:sum(mv("pack"),e=>n(e.boxes))},
    master:{c:sum(mv("to_master"),e=>n(e.count)),w:sum(mv("to_master"),e=>n(e.weight))},
    labels:{c:sum(E.filter(e=>e._map==="labels"),e=>n(e.count)),b:E.filter(e=>e._map==="labels").length},
    sales:{t:sum(E.filter(e=>e._map==="sales"),e=>n(e.total)),c:sum(E.filter(e=>e._map==="sales"),e=>(e.lines||[]).reduce((a,l)=>a+n(l.count),0))},
    refineOut:sum(L.live.filter(e=>e._map==="sessions"&&e.job==="refine"&&endDay(e)===d),e=>n(e.outW)),refineIn:sum(E.filter(e=>e._map==="sessions"&&e.job==="refine"),e=>n(e.inW)),
    stripOut:sum(L.live.filter(e=>e._map==="sessions"&&e.job==="strip"&&endDay(e)===d),e=>n(e.outW)),stripIn:sum(E.filter(e=>e._map==="sessions"&&e.job==="strip"),e=>n(e.inW)),
    mfgIn:sum(E.filter(e=>e._map==="sessions"&&e.job==="mfg"),e=>n(e.inW)),lossAll:sum(L.losses.filter(x=>x._date===d),x=>x.w),
    ses:E.filter(e=>e._map==="sessions"),evals:Object.fromEntries(E.filter(e=>e._map==="evals").map(e=>[e.worker,e]))}
}
function workerDay(w,D,limit){
  const ses=D.ses.filter(e=>e.worker===w.id);const cast=D.cast.filter(e=>e.worker===w.name);
  /* production comes from the work-time sessions when they record output, otherwise from casting rows — never both */
  const h=ses.reduce((a,e)=>a+sesHours(e),0),sp=ses.reduce((a,e)=>a+n(e.pcs),0),sw=ses.reduce((a,e)=>a+n(e.weight),0);
  const pcs=sp>0?sp:cast.reduce((a,e)=>a+n(e.count),0),wt=sp>0?sw:cast.reduce((a,e)=>a+n(e.scale),0);
  const kh=cast.reduce((a,e)=>a+khisya(e),0)+ses.filter(e=>e.end&&(e.job==="refine"||e.job==="strip")).reduce((a,e)=>a+n(e.loss),0),diff=cast.reduce((a,e)=>a+n(e.diff),0),openS=ses.some(e=>!e.end);
  const rec=ses.reduce((a,e)=>a+n(e.inW),0)+cast.filter(e=>!e._virtual).reduce((a,e)=>a+n(e.received),0);
  const flags=[];if(kh>limit)flags.push(["bad","خسية "+fg(kh)+" جم فوق الحد"]);if(cast.length&&diff<-0.005)flags.push(["warn","فرق ميزان "+fg(diff)]);if(openS)flags.push(["info","ما زال يعمل"]);
  const active=ses.length||cast.length;
  const auto=!active?["plain","لم يُسجَّل له شغل"]:flags.some(f=>f[0]==="bad")?["bad","يحتاج متابعة"]:flags.some(f=>f[0]==="warn")?["warn","ملاحظة"]:["ok","جيد"];
  return {id:w.id,w,h,pcs,wt,kh,diff,flags,auto,active,rate:h?pcs/h:0,rec,jobs:ses,cast}
}
async function saveEval(d,w,rating,note){const ref=await ensureDay("evals",d);await ref.update({evals:{[w.id]:{id:w.id,worker:w.id,wname:w.name,rating,note,ts:new Date().toISOString(),by:S.uid}}})}
function EvalCell({d,w,ev,can,toast}){const [note,setNote]=useState(ev?.note||"");const [busy,setBusy]=useState(false);
  useEffect(()=>setNote(ev?.note||""),[ev?.note]);
  const set=async(r,nt)=>{setBusy(true);try{await saveEval(d,w,r,nt)}catch(e){toast(errText(e))}setBusy(false)};
  if(!can)return html`<span>${ev?html`<${Badge} tone=${RATING[ev.rating]?.[1]}>${RATING[ev.rating]?.[0]}</${Badge}> <span class="sub" style=${{display:"inline"}}>${ev.note||""}</span>`:html`<span class="sub">—</span>`}</span>`;
  return html`<span style=${{display:"inline-flex",gap:"6px",alignItems:"center"}} onClick=${e=>e.stopPropagation()}>
    <span class="seg rate">${Object.entries(RATING).map(([k,[l,t]])=>html`<button key=${k} type="button" disabled=${busy} class=${"r-"+t} aria-pressed=${ev?.rating===k?"true":"false"} onClick=${()=>set(k,note)}>${l}</button>`)}</span>
    <input class="in" style=${{height:"30px",width:"170px",fontSize:"12.5px"}} placeholder="ملاحظة" value=${note} onInput=${e=>setNote(e.target.value)} onBlur=${()=>{if(ev&&note!==(ev.note||""))set(ev.rating,note)}} aria-label=${"ملاحظة "+w.name}/></span>`}
function DailyReport({L,catalog,workers,config,can,toast,open,dailies}){
  const [d,setD]=useState(today());const [wv,setWv]=useState(null);const limit=n(config.khisyaLimit)||0.5;
  const D=dayData(L,catalog,d);const wd=workerList(workers).map(w=>workerDay(w,D,limit)).filter(r=>r.active||r.w.active!==false);
  const evd=D.evals;const good=wd.filter(r=>(evd[r.id]?.rating||(r.auto[0]==="ok"?"good":r.auto[0]==="bad"?"bad":null))==="good").length;
  const bad=wd.filter(r=>evd[r.id]?.rating==="bad"||(!evd[r.id]&&r.auto[0]==="bad")).length;
  const stage=[["الحل","drop",[["اتسلّم للحل",fg(D.refineIn)+" جم"],["خرج عيار 1000",fg(D.refineOut)+" جم"]]],
    ["الشرايط","strips",[["اتسلّم",fg(D.stripIn)+" جم"],["شرايط جاهزة",fg(D.stripOut)+" جم"]]],
    ["التصنيع","flame",[["المتسلم",fg(D.mfgIn||D.received)+" جم"],["المُنتج",fi(D.made)+" قطعة · "+fg(D.madeW)+" جم"],["الخسية",fg(D.kh)+" جم",D.kh>limit]]],
    ["التجهيز","prep",[["سُلم للتجهيز",fi(D.prep.c)+" قطعة · "+fg(D.prep.w)+" جم"]]],
    ["الدمغة","stamp",[["سُلم للدمغة",fi(D.hmOut.c)+" قطعة · "+fi(D.hmOut.b)+" علبة"],["استُلم من الدمغة",fi(D.hmIn.c)+" قطعة · "+fg(D.hmIn.w)+" جم"],["مرتجع",fi(D.hmRet.c)+" قطعة",D.hmRet.c>0],["رسوم",fm(D.hmOut.fee)+" ج.م"]]],
    ["التغليف","box",[["غُلِّف",fi(D.pack.c)+" قطعة · "+fi(D.pack.b)+" علبة"],["سُلم للمعلم",fi(D.master.c)+" قطعة · "+fg(D.master.w)+" جم"]]],
    ["التكويد","qr",[["ملصقات",fi(D.labels.c)+" ملصق · "+fi(D.labels.b)+" دفعة"]]],
    ["المبيعات","receipt",[["مُباع",fi(D.sales.c)+" قطعة · "+fm(D.sales.t)+" ج.م"]]]];
  const cols=[{key:"name",label:"العامل",get:r=>r.w.name,render:r=>html`<span class="strong">${r.w.name}</span><span class="sub">${wDept(r.w)}</span>`},
    {key:"h",label:"اشتغل",num:1,render:r=>r.h?fh(r.h):"—"},{key:"rec",label:"استلم (جم)",num:1,render:r=>r.rec?fg(r.rec):"—"},{key:"pcs",label:"أنتج قطع",num:1,render:r=>r.pcs?fi(r.pcs):"—"},{key:"wt",label:"الوزن",num:1,render:r=>r.wt?fg(r.wt):"—"},
    {key:"rate",label:"قطعة/ساعة",num:1,render:r=>r.rate?r.rate.toFixed(1):"—"},{key:"kh",label:"الخسية",num:1,render:r=>r.kh?html`<span class=${r.kh>limit?"neg":""}>${fg(r.kh)}</span>`:"—"},
    {key:"auto",label:"الحالة التلقائية",get:r=>r.auto[1],cls:"keep wrap",render:r=>html`<${Badge} tone=${r.auto[0]}>${r.auto[1]}</${Badge}>${r.flags.length>0&&html`<span class="sub">${r.flags.map(f=>f[1]).join(" · ")}</span>`}`},
    {key:"ev",label:"تقييم المشرف",sort:false,cls:"keep",render:r=>html`<${EvalCell} d=${d} w=${r.w} ev=${evd[r.id]} can=${can} toast=${toast}/>`}];
  const exportCsv=async()=>{const q=s=>'"'+String(s??"").replace(/"/g,'""')+'"';const rows=[["التقرير اليومي",d],[],["المرحلة","البند","القيمة"]];
    stage.forEach(([s,,items])=>items.forEach(([k,v])=>rows.push([s,k,v])));rows.push([],["العامل","القسم","الساعات","القطع","الوزن","قطعة/ساعة","الخسية","الحالة","التقييم","ملاحظة"]);
    wd.forEach(r=>rows.push([r.w.name,wDept(r.w),r.h?fh(r.h):"",r.pcs,r2(r.wt),r.rate?r.rate.toFixed(1):"",r2(r.kh),r.auto[1]+(r.flags.length?" ("+r.flags.map(f=>f[1]).join("، ")+")":""),evd[r.id]?RATING[evd[r.id].rating]?.[0]:"",evd[r.id]?.note||""]));
    try{const dl=await platform.use("downloads");await dl.save({filename:"gold-era-daily-"+d+".csv",data:"﻿"+rows.map(r=>r.map(q).join(",")).join("\r\n")})}catch(e){if(e&&e.code!=="declined")toast("تعذر التصدير.")}};
  return html`<${React.Fragment}>
    <${PH} title="التقرير اليومي" desc="كل عامل اشتغل قد إيه وأنتج قد إيه، وما تم في كل قسم — ويتحفظ يومياً">
      <button class="btn sm" onClick=${()=>setD(addDays(d,-1))}>اليوم السابق</button><input id="dr-d" type="date" class="in" style=${{width:"auto",height:"36px"}} value=${d} max=${today()} onChange=${e=>setD(e.target.value||today())} aria-label="اليوم"/><button class="btn sm" disabled=${d>=today()} onClick=${()=>setD(addDays(d,1))}>التالي</button>
      <button class="btn" onClick=${exportCsv}><${I} n="dl"/>تصدير</button></${PH}>
    <div class="kpis six">
      <${Kpi} icon="flame" label="صُنع" value=${fi(D.made)} unit="قطعة" sub=${fg(D.madeW)+" جم"}/>
      <${Kpi} icon="bar" label="استُلم وزن" value=${fg(D.mfgIn||D.received)} unit="جم" sub=${"للتصنيع · من الحل "+fg(D.refineOut)}/>
      <${Kpi} icon="stamp" label="الدمغة" value=${fi(D.hmIn.c)} unit="مستلم" sub=${fi(D.hmOut.c)+" مُسلّم · "+fi(D.hmRet.c)+" مرتجع"}/>
      <${Kpi} icon="box" label="غُلِّف" value=${fi(D.pack.c)} unit="قطعة" sub=${fi(D.pack.b)+" علبة"}/>
      <${Kpi} icon="qr" label="كُوِّد" value=${fi(D.labels.c)} unit="ملصق"/>
      <${Kpi} icon="users" label="عمال اشتغلوا" value=${fi(wd.filter(r=>r.active).length)} sub=${fi(good)+" كويس · "+fi(bad)+" يحتاج متابعة"} alert=${bad>0}/>
    </div>
    <${Card} title=${"المراحل — "+d}><div class="stagegrid">${stage.map(([s,ic,items])=>html`<div key=${s} class="stagebox"><div class="kpi__l"><${I} n=${ic}/>${s}</div>${items.map(([k,v,warn])=>html`<div key=${k} class="sline"><span>${k}</span><b class=${"num"+(warn?" neg":"")}>${v}</b></div>`)}</div>`)}</div></${Card}>
    <${Card} title="حالة شغل العمال" sub=${can?"الحالة التلقائية من الساعات والخسية والفرق، والتقييم تختاره أنت":"الحالة التلقائية وتقييم المشرف"}>
      <${DataTable} cols=${cols} rows=${wd} sort=${["auto","asc"]} pageSize=${40} onRow=${setWv} searchPh="اسم العامل" empty=${html`<${Empty} icon="users" t="لا يوجد عمال" s="أضف العمال من «العمال والأقسام»."/>`}/>
    </${Card}>
    <${Card} title="التقارير المحفوظة" sub="كل يوم بيتحفظ تلقائياً — اضغط على اليوم لفتحه">
      <${DataTable} cols=${[{key:"date",label:"اليوم",render:r=>html`<span class="num strong">${r.date}</span>`},{key:"made",label:"اتصنع",num:1,render:r=>fi(n(r.made))},{key:"madeW",label:"الوزن",num:1,render:r=>fg(n(r.madeW))},{key:"kh",label:"الخسية",num:1,render:r=>fg(n(r.kh))},{key:"wn",label:"عمال",num:1,get:r=>(r.workers||[]).length},{key:"savedAt",label:"آخر حفظ",render:r=>html`<span class="num sub">${String(r.savedAt||"").slice(0,16).replace("T"," ")}</span>`}]} rows=${Object.values(dailies||{})} sort=${["date","desc"]} pageSize=${10} onRow=${r=>setD(r.date)} empty=${html`<${Empty} icon="clip" t="لا توجد تقارير محفوظة بعد" s="أول ما يتسجل شغل، التقرير بيتحفظ لوحده."/>`}/>
    </${Card}>
    ${wv&&html`<${Sheet} title=${wv.w.name} sub=${wDept(wv.w)+" · "+d} onClose=${()=>setWv(null)}>
      <${Calc} items=${[["اشتغل",fh(wv.h),"hl"],["استلم",fg(wv.rec)+" جم"],["أنتج",fi(wv.pcs)+" قطعة · "+fg(wv.wt)+" جم"],["الخسية",fg(wv.kh)+" جم",wv.kh>limit?"neg":""],["قطعة/ساعة",wv.rate?wv.rate.toFixed(1):"—"],["الحالة",wv.auto[1]]]}/>
      <div class="sect">شغل اليوم</div>
      ${wv.jobs.length?html`<div class="tw"><table class="t"><thead><tr><th>القسم</th><th>الوقت</th><th class="n">المدة</th><th class="n">استلم</th><th>الناتج</th><th class="n">خسية</th></tr></thead><tbody>${wv.jobs.map(e=>html`<tr key=${e.id}><td>${(e.job&&JOBS[e.job]?JOBS[e.job].label:e.dept)||""}<span class="sub">${e.task||""}</span></td><td class="num">${hhmm(e.start)} ← ${e.end?hhmm(e.end):"جاري"}</td><td class="n">${fh(sesHours(e))}</td><td class="n">${n(e.inW)?fg(n(e.inW)):"—"}</td><td>${e.job==="mfg"?(jobItems(e,catalog)||"—"):e.end?(n(e.outW)?fg(n(e.outW))+" جم":(n(e.pcs)?fi(n(e.pcs))+" قطعة":"—")):"—"}</td><td class="n">${e.end&&GOLD_JOBS.includes(e.job)?fg(n(e.loss)):"—"}</td></tr>`)}</tbody></table></div>`:html`<${Empty} icon="clock" t="لا توجد أوقات مسجلة" s=""/>`}
    </${Sheet}>`}
  </${React.Fragment}>`;
}

/* ---------- worker productivity over months / year ---------- */
function workerPeriod(L,workers,from,to,limit){
  const E=L.live.filter(e=>e._date>=from&&e._date<=to);const byName={};Object.values(workers).forEach(w=>byName[w.name]=w.id);
  const R={};const g=id=>R[id]||(R[id]={id,days:new Set(),h:0,sess:0,pcs:0,wt:0,kh:0,rec:0,good:0,ok:0,bad:0,months:{}});
  const mo=(r,d)=>r.months[d.slice(0,7)]||(r.months[d.slice(0,7)]={h:0,pcs:0,wt:0,kh:0,days:new Set(),good:0,ok:0,bad:0});
  const day={};const dd=(id,d)=>{const k=id+"|"+d;return day[k]||(day[k]={id,d,sp:0,sw:0,cp:0,cw:0})};
  for(const e of E){
    if(e._map==="sessions"&&workers[e.worker]){const r=g(e.worker),m=mo(r,e._date);const h=sesHours(e);r.h+=h;m.h+=h;r.sess++;const x=dd(e.worker,e._date);x.sp+=n(e.pcs);x.sw+=n(e.weight);r.days.add(e._date);m.days.add(e._date)}
    else if(e._map==="casting"&&byName[e.worker]){const id=byName[e.worker];const r=g(id),m=mo(r,e._date);const x=dd(id,e._date);x.cp+=n(e.count);x.cw+=n(e.scale);r.kh+=khisya(e);m.kh+=khisya(e);r.rec+=n(e.received);r.days.add(e._date);m.days.add(e._date)}
    else if(e._map==="evals"&&workers[e.worker]&&RATING[e.rating]){const r=g(e.worker),m=mo(r,e._date);r[e.rating]++;m[e.rating]++}
  }
  /* per day: session output when recorded, otherwise casting rows — never both */
  for(const x of Object.values(day)){const r=g(x.id),m=mo(r,x.d);const p=x.sp>0?x.sp:x.cp,w=x.sp>0?x.sw:x.cw;r.pcs+=p;m.pcs+=p;r.wt+=w;m.wt+=w}
  return Object.values(R).map(r=>({...r,w:workers[r.id],nd:r.days.size,rate:r.h?r.pcs/r.h:0,grate:r.h?r.wt/r.h:0,pm:r.rec?r.kh/r.rec*1000:0}));
}
function WorkerReport({L,workers,config,toast}){
  const y=today().slice(0,4),ym=ymOf(today());
  const [rg,setRg]=useState("month");const [cf,setCf]=useState(addDays(today(),-29));const [ct,setCt]=useState(today());const [view,setView]=useState(null);
  const [from,to]=rg==="month"?[ym+"-01",today()]:rg==="q"?[addMonths(ym,-2)+"-01",today()]:rg==="year"?[y+"-01-01",today()]:rg==="lastyear"?[(+y-1)+"-01-01",(+y-1)+"-12-31"]:[cf,ct];
  const rows=workerPeriod(L,workers,from,to,n(config.khisyaLimit)||0.5);
  const cols=[{key:"name",label:"العامل",get:r=>r.w?.name||"",render:r=>html`<span class="strong">${r.w?.name}</span><span class="sub">${wDept(r.w)}</span>`},
    {key:"nd",label:"أيام عمل",num:1,render:r=>fi(r.nd)},{key:"h",label:"الساعات",num:1,render:r=>fh(r.h)},{key:"pcs",label:"القطع",num:1,render:r=>fi(r.pcs)},{key:"wt",label:"الوزن",num:1,render:r=>fg(r.wt)},
    {key:"rate",label:"قطعة/ساعة",num:1,render:r=>r.h?r.rate.toFixed(1):"—"},{key:"kh",label:"الخسية",num:1,render:r=>fg(r.kh)},{key:"pm",label:"‰",num:1,render:r=>r.rec?r.pm.toFixed(2):"—"},
    {key:"good",label:"التقييمات",num:1,render:r=>html`<span class="num" style=${{color:"var(--ok)"}}>${r.good}</span> / <span class="num" style=${{color:"var(--warn)"}}>${r.ok}</span> / <span class="num" style=${{color:"var(--bad)"}}>${r.bad}</span>`}];
  const exportCsv=async()=>{const q=s=>'"'+String(s??"").replace(/"/g,'""')+'"';const out=[["إنتاجية العمال",from,to],["العامل","القسم","الشهر","أيام عمل","الساعات","القطع","الوزن","قطعة/ساعة","الخسية","كويس","متوسط","مش كويس"]];
    rows.forEach(r=>{out.push([r.w?.name,wDept(r.w),"الفترة كلها",r.nd,fh(r.h),r.pcs,r2(r.wt),r.h?r.rate.toFixed(1):"",r2(r.kh),r.good,r.ok,r.bad]);Object.entries(r.months).sort().forEach(([m,v])=>out.push([r.w?.name,wDept(r.w),m,v.days.size,fh(v.h),v.pcs,r2(v.wt),v.h?(v.pcs/v.h).toFixed(1):"",r2(v.kh),v.good,v.ok,v.bad]))});
    try{const dl=await platform.use("downloads");await dl.save({filename:"gold-era-workers-"+from+"_"+to+".csv",data:"﻿"+out.map(r=>r.map(q).join(",")).join("\r\n")})}catch(e){if(e&&e.code!=="declined")toast("تعذر التصدير.")}};
  const tot=rows.reduce((a,r)=>({h:a.h+r.h,pcs:a.pcs+r.pcs,kh:a.kh+r.kh}),{h:0,pcs:0,kh:0});
  return html`<${React.Fragment}>
    <div class="ph__a" style=${{justifyContent:"space-between"}}><div class="ph__a"><${Seg} opts=${[["month","هذا الشهر"],["q","آخر 3 شهور"],["year","هذه السنة"],["lastyear","السنة الماضية"],["custom","مخصص"]]} value=${rg} set=${setRg}/>
      ${rg==="custom"&&html`<input type="date" class="in" style=${{width:"auto",height:"30px"}} value=${cf} onChange=${e=>setCf(e.target.value)} aria-label="من"/><input type="date" class="in" style=${{width:"auto",height:"30px"}} value=${ct} onChange=${e=>setCt(e.target.value)} aria-label="إلى"/>`}</div>
      <button class="btn sm" onClick=${exportCsv}><${I} n="dl"/>تصدير بالشهور</button></div>
    <div class="kpis"><${Kpi} icon="users" label="عمال لهم شغل" value=${fi(rows.length)} sub=${from+" ← "+to}/><${Kpi} icon="clock" label="إجمالي الساعات" value=${fh(tot.h)}/><${Kpi} icon="box" label="إجمالي القطع" value=${fi(tot.pcs)} sub=${tot.h?(tot.pcs/tot.h).toFixed(1)+" قطعة/ساعة":""}/><${Kpi} icon="flame" label="خسية الصناع" value=${fg(tot.kh)} unit="جم"/></div>
    <${Card} title="إنتاجية العمال" sub="اضغط على العامل لعرض تفاصيله شهراً بشهر"><${DataTable} cols=${cols} rows=${rows} sort=${["pcs","desc"]} onRow=${setView} pageSize=${30} empty=${html`<${Empty} icon="users" t="لا يوجد شغل مسجل في الفترة" s="سجّل الأوقات من «وقت العمل» أو صفوف السبك باسم الصانع."/>`}/></${Card}>
    ${view&&html`<${Sheet} title=${view.w?.name} sub=${wDept(view.w)+" · "+from+" ← "+to} onClose=${()=>setView(null)}>
      <${Calc} items=${[["أيام عمل",fi(view.nd)],["الساعات",fh(view.h),"hl"],["القطع",fi(view.pcs)],["قطعة/ساعة",view.h?view.rate.toFixed(1):"—"],["الخسية",fg(view.kh)+" جم"],["التقييم",view.good+" كويس · "+view.bad+" مش كويس"]]}/>
      <div class="card"><div class="tw"><table class="t"><thead><tr><th>الشهر</th><th class="n">أيام</th><th class="n">ساعات</th><th class="n">قطع</th><th class="n">وزن</th><th class="n">ق/س</th><th class="n">خسية</th><th class="n">تقييم</th></tr></thead><tbody>
        ${Object.entries(view.months).sort().reverse().map(([m,v])=>html`<tr key=${m}><td>${monthName(m)}</td><td class="n">${v.days.size}</td><td class="n">${fh(v.h)}</td><td class="n">${fi(v.pcs)}</td><td class="n">${fg(v.wt)}</td><td class="n">${v.h?(v.pcs/v.h).toFixed(1):"—"}</td><td class="n">${fg(v.kh)}</td><td class="n"><span style=${{color:"var(--ok)"}}>${v.good}</span>/<span style=${{color:"var(--bad)"}}>${v.bad}</span></td></tr>`)}
      </tbody></table></div></div>
      <div class="sect">ملاحظات المشرف</div>
      ${(()=>{const ev=L.live.filter(e=>e._map==="evals"&&e.worker===view.id&&e._date>=from&&e._date<=to).sort((a,b)=>b._date.localeCompare(a._date));return ev.length?html`<ul class="feed">${ev.slice(0,30).map(e=>html`<li key=${e._date} style=${{gridTemplateColumns:"auto minmax(0,1fr)"}}><${Badge} tone=${RATING[e.rating]?.[1]}>${RATING[e.rating]?.[0]}</${Badge}><div><div class="t1">${e.note||"—"}</div><div class="t2 num">${e._date}</div></div></li>`)}</ul>`:html`<${Empty} t="لا توجد تقييمات في الفترة" s=""/>`})()}
    </${Sheet}>`}
  </${React.Fragment}>`;
}

async function migrateWorkers(){try{const s=await S.db.doc("settings/workers").get();const list=s.exists?(s.data().list||{}):{};const map={"سبك":"سبك","تجهيز":"تجهيز","تشطيب":"تشطيب","معلم":"معلم"};for(const [k,w] of Object.entries(list)){if(!w||!w.name)continue;await saveWorker(k,{id:k,name:w.name,dept:map[w.kind]||"سبك",active:true,code:"",phone:"",joined:"",note:""})}}catch(e){console.warn("migrate",e)}}
/* ---------- per-user access ---------- */
const PAGE_LIST=NAV.flatMap(([g,items])=>items.map(([k,l])=>({k,l,g})));
const ALL_LEDGER=["bars","strips","casting","moves","sales","payments","counts","labels","sessions","evals"];
/* collections a page has to read to show correct balances */
const GOLD_READ=[...ALL_LEDGER,"staff","orders"];
const READ_NEEDS={dash:[...ALL_LEDGER,"customers","orders"],review:GOLD_READ,stock:GOLD_READ,bars:GOLD_READ,refine:GOLD_READ,strips:GOLD_READ,casting:GOLD_READ,orders:GOLD_READ,
  prep:GOLD_READ,hallmark:GOLD_READ,finish:GOLD_READ,workers:["staff","sessions"],attendance:GOLD_READ,daily:[...GOLD_READ,"dailies"],
  count:GOLD_READ,labels:["labels","orders"],sales:["sales","moves","casting","counts","customers","payments"],
  customers:["customers","sales","payments"],reports:[...GOLD_READ,"customers","months","dailies"],settings:[]};
/* collections a page writes to when its access is "edit" */
const WRITE_OF={orders:["orders"],stock:["bars"],bars:["bars"],refine:["sessions"],strips:["sessions"],casting:["sessions"],prep:["moves","sessions"],hallmark:["moves","sessions"],finish:["moves","sessions"],count:["counts"],labels:["labels"],sales:["sales"],customers:["customers","payments"],workers:["staff"],attendance:["sessions"],daily:["evals","dailies"]};
const PRESETS={
  manager:{label:"مدير",pages:Object.fromEntries(PAGE_LIST.map(p=>[p.k,"edit"])),void:true,settings:true},
  production:{label:"تصنيع وخزنة",pages:{review:"view",stock:"edit",orders:"edit",bars:"edit",refine:"edit",strips:"edit",casting:"edit",labels:"edit",attendance:"edit"}},
  stages:{label:"المراحل",pages:{prep:"edit",hallmark:"edit",finish:"edit",labels:"edit",attendance:"edit"}},
  supervisor:{label:"مشرف عمال",pages:{review:"view",workers:"edit",attendance:"edit",daily:"edit"}},
  sales:{label:"مبيعات وحسابات",pages:{sales:"edit",customers:"edit"}},
  viewer:{label:"مشاهد",pages:Object.fromEntries(PAGE_LIST.filter(p=>p.k!=="settings").map(p=>[p.k,"view"]))}
};
function compileAccess(a){const pages={};for(const p of PAGE_LIST){const v=a.pages&&a.pages[p.k];if(v==="view"||v==="edit")pages[p.k]=v}
  const read=new Set(),write=new Set();for(const [k,v] of Object.entries(pages)){(READ_NEEDS[k]||[]).forEach(c=>read.add(c));if(v==="edit")(WRITE_OF[k]||[]).forEach(c=>{write.add(c);read.add(c)})}
  if(a.settings)read.add("months");
  return {name:a.name||"",username:a.username||"",active:a.active!==false,pages,void:!!a.void,settings:!!a.settings,read:[...read].sort(),write:[...write].sort(),updatedAt:new Date().toISOString(),by:S.uid}}
const OWNER_PERM={owner:true,pages:Object.fromEntries(PAGE_LIST.map(p=>[p.k,"edit"])),void:true,settings:true,read:[...ALL_LEDGER,"orders","customers","months","staff","dailies"]};
const presetOf=a=>{for(const [k,p] of Object.entries(PRESETS)){if(JSON.stringify(compileAccess({...p,name:"",username:""}).pages)===JSON.stringify(a.pages||{})&&!!p.void===!!a.void&&!!p.settings===!!a.settings)return k}return "custom"};

function UsersAdmin({names,toast}){
  const [users,setUsers]=useState({});const [edit,setEdit]=useState(null);const [err,setErr]=useState("");
  useEffect(()=>{if(!S.db)return;const un=S.db.collection("access").onSnapshot(q=>{const o={};q.docs.forEach(d=>o[d.id]={...d.data(),id:d.id});setUsers(o)},e=>setErr(errText(e)));return un},[]);
  const rows=Object.values(users).sort((a,b)=>(a.name||"").localeCompare(b.name||"","ar"));
  const cols=[{key:"name",label:"المستخدم",render:r=>html`<span class="strong">${r.name||r.username}</span><span class="sub num">${r.username}</span>`},
    {key:"preset",label:"القالب",get:r=>presetOf(r),render:r=>{const k=presetOf(r);return html`<${Badge} tone=${k==="custom"?"plain":"gold"}>${k==="custom"?"مخصص":PRESETS[k].label}</${Badge}>`}},
    {key:"pages",label:"الصفحات",get:r=>Object.keys(r.pages||{}).length,render:r=>{const p=r.pages||{};const e=Object.values(p).filter(v=>v==="edit").length,v=Object.values(p).filter(v=>v==="view").length;return html`<span class="num">${e}</span> تسجيل · <span class="num">${v}</span> عرض`}},
    {key:"flags",label:"صلاحيات خاصة",sort:false,render:r=>html`${r.void&&html`<${Badge} tone="warn">الإلغاء</${Badge}> `}${r.settings&&html`<${Badge} tone="info">الإعدادات</${Badge}>`}${!r.void&&!r.settings?"—":""}`},
    {key:"active",label:"الحالة",get:r=>r.active?1:0,render:r=>r.active?html`<${Badge} tone="ok">مفعّل</${Badge}>`:html`<${Badge} tone="bad">موقوف</${Badge}>`,cls:"keep"}];
  return html`<${Card} title="المستخدمون والصلاحيات" sub="أنشئ حساباً لكل موظف وحدد بالضبط ما يراه وما يسجّل فيه" actions=${html`<button class="btn p" onClick=${()=>setEdit({})}><${I} n="plus"/>مستخدم جديد</button>`}>
    ${err&&html`<div class="card__b"><span class="msg">${err}</span></div>`}
    <${DataTable} cols=${cols} rows=${rows} sort=${["name","asc"]} onRow=${r=>setEdit(r)} searchPh="الاسم أو اسم المستخدم" empty=${html`<${Empty} icon="users" t="لا يوجد مستخدمون بعد" s="اضغط «مستخدم جديد» لإنشاء حساب لأول موظف."/>`}/>
    ${edit&&html`<${UserSheet} u=${edit.id?users[edit.id]||edit:null} users=${users} toast=${toast} onClose=${()=>setEdit(null)}/>`}
  </${Card}>`;
}
async function recompileAccess(){try{const q=await S.db.collection("access").get();for(const d of q.docs){const u=d.data();const c=compileAccess(u);
  if(JSON.stringify(c.read)!==JSON.stringify(u.read||[])||JSON.stringify(c.write)!==JSON.stringify(u.write||[]))await S.db.doc("access/"+d.id).set({...u,pages:c.pages,read:c.read,write:c.write,updatedAt:c.updatedAt})}}catch(e){console.warn("access refresh",e)}}
async function savePeople(users){try{const map={};Object.values(users).forEach(u=>{map[u.id]={name:u.name||u.username}});map[S.uid]={name:(await S.user.me()).name||"المالك"};await S.db.doc("settings/people").set({map,updatedAt:new Date().toISOString()})}catch(e){console.warn(e)}}
function UserSheet({u,users,toast,onClose}){
  const isNew=!u;
  const [f,setF]=useState(()=>u?{name:u.name||"",username:u.username||"",password:"",active:u.active!==false,pages:{...(u.pages||{})},void:!!u.void,settings:!!u.settings}:{name:"",username:"",password:"",active:true,...JSON.parse(JSON.stringify(PRESETS.production))});
  const [err,setErr]=useState("");const [busy,setBusy]=useState(false);const [pw,setPw]=useState("");
  const up=(k,v)=>setF(o=>({...o,[k]:v}));const setPage=(k,v)=>setF(o=>({...o,pages:{...o.pages,[k]:v}}));
  const applyPreset=k=>{const p=PRESETS[k];setF(o=>({...o,pages:{...p.pages},void:!!p.void,settings:!!p.settings}))};
  const preset=presetOf(f);
  const save=async()=>{setErr("");if(!f.name.trim())return setErr("اكتب اسم الموظف.");
    if(!Object.values(f.pages).some(v=>v==="view"||v==="edit"))return setErr("اختر صفحة واحدة على الأقل.");
    setBusy(true);try{let uid=u&&u.id;
      if(isNew){const un=f.username.trim().toLowerCase();if(!/^[a-z0-9._-]{3,32}$/.test(un))throw "اسم المستخدم: 3 إلى 32 حرفاً إنجليزياً أو أرقاماً أو . _ -";if(f.password.length<6)throw "كلمة المرور: 6 أحرف على الأقل.";uid=await platform.createUser(un,f.password)}
      const doc=compileAccess({...f,username:isNew?f.username.trim().toLowerCase():u.username});await S.db.doc("access/"+uid).set(doc);
      await savePeople({...users,[uid]:{...doc,id:uid}});toast(isNew?"أُنشئ حساب "+f.name.trim():"حُفظت صلاحيات "+f.name.trim());onClose()}catch(e){setErr(typeof e==="string"?e:errText(e))}setBusy(false)};
  const resetPw=async()=>{setErr("");try{await platform.resetPassword(u.username,pw);setPw("");toast("تغيّرت كلمة المرور")}catch(e){setErr(typeof e==="string"?e:errText(e))}};
  const groups=[...new Set(PAGE_LIST.map(p=>p.g))];
  const setAll=v=>setF(o=>({...o,pages:Object.fromEntries(PAGE_LIST.map(p=>[p.k,v]))}));
  return html`<${Sheet} title=${isNew?"مستخدم جديد":(u.name||u.username)} sub=${isNew?"حساب دخول باسم مستخدم وكلمة مرور":"اسم المستخدم: "+u.username} onClose=${onClose}
    footer=${html`<span class="msg">${err}</span><button class="btn" onClick=${onClose}>إلغاء</button><button class="btn p" disabled=${busy} onClick=${save}><${I} n="check"/>${isNew?"إنشاء الحساب":"حفظ الصلاحيات"}</button>`}>
    <div class="fg">
      <${F} full label="اسم الموظف"><input id="u-name" class="in" value=${f.name} onInput=${e=>up("name",e.target.value)} placeholder="مثال: مصطفي"/></${F}>
      ${isNew&&html`<${F} label="اسم المستخدم" hint="بالإنجليزي، يُستخدم للدخول"><input id="u-user" class="in nm" autocomplete="off" value=${f.username} onInput=${e=>up("username",e.target.value)} placeholder="mostafa"/></${F}>
        <${F} label="كلمة المرور" hint="6 أحرف على الأقل"><input id="u-pass" class="in nm" type="text" autocomplete="new-password" value=${f.password} onInput=${e=>up("password",e.target.value)}/></${F}>`}
      ${!isNew&&html`<${F} full label="حالة الحساب"><${Seg} opts=${[["on","مفعّل"],["off","موقوف — لا يستطيع الدخول للبيانات"]]} value=${f.active?"on":"off"} set=${v=>up("active",v==="on")}/></${F}>`}
    </div>
    <div class="sect">قالب سريع</div>
    <div class="ph__a">${Object.entries(PRESETS).map(([k,p])=>html`<button key=${k} type="button" class=${"btn sm"+(preset===k?" p":"")} onClick=${()=>applyPreset(k)}>${p.label}</button>`)}${preset==="custom"&&html`<${Badge} tone="plain">مخصص</${Badge}>`}</div>
    <div class="sect" style=${{display:"flex",justifyContent:"space-between",alignItems:"center"}}><span>الصفحات</span><span class="ph__a"><button type="button" class="link" onClick=${()=>setAll("none")}>إخفاء الكل</button><button type="button" class="link" onClick=${()=>setAll("view")}>عرض الكل</button></span></div>
    <div class="card"><table class="t perm"><thead><tr><th>الصفحة</th><th>مخفية</th><th>عرض</th><th>عرض وتسجيل</th></tr></thead><tbody>
      ${groups.map(g=>html`<${React.Fragment} key=${g}><tr class="grp"><td colSpan="4">${g}</td></tr>${PAGE_LIST.filter(p=>p.g===g).map(p=>{const v=f.pages[p.k]||"none";const canEdit=!!WRITE_OF[p.k]||p.k==="settings";
        return html`<tr key=${p.k}><td><span class="who"><${I} n=${NAV_ICON[p.k]}/>${p.l}</span></td>${["none","view","edit"].map(x=>html`<td key=${x}>${x==="edit"&&!canEdit?html`<span class="sub">—</span>`:html`<input type="radio" name=${"pg-"+p.k} aria-label=${p.l+" "+x} checked=${v===x||(x==="none"&&v!=="view"&&v!=="edit")} onChange=${()=>setPage(p.k,x)}/>`}</td>`)}</tr>`})}</${React.Fragment}>`)}
    </tbody></table></div>
    <div class="sect">صلاحيات خاصة</div>
    <label class="chk"><input type="checkbox" checked=${f.void} onChange=${e=>up("void",e.target.checked)}/> إلغاء القيود (بسبب مكتوب) في الصفحات المسموح له بالتسجيل فيها</label>
    <label class="chk"><input type="checkbox" checked=${f.settings} onChange=${e=>up("settings",e.target.checked)}/> تعديل الإعدادات: الأصناف، العمال، الأسعار، الحدود، والمصروفات الشهرية</label>
    <div class="note"><${I} n="info"/><span>قاعدة البيانات نفسها تمنع المستخدم من قراءة أو تسجيل أي قسم غير مسموح له. الصفحات المسموحة تقرأ البيانات التي تحتاجها لحساب أرصدتها فقط.</span></div>
    ${!isNew&&platform.canResetPasswords&&html`<div class="sect">كلمة المرور</div><div class="fg" style=${{gridTemplateColumns:"minmax(0,1fr) auto",alignItems:"end"}}><${F} label="كلمة مرور جديدة"><input id="u-newpw" class="in nm" type="text" autocomplete="new-password" value=${pw} onInput=${e=>setPw(e.target.value)}/></${F}><button type="button" class="btn" disabled=${pw.length<6} onClick=${resetPw}>تغيير</button></div>`}
    ${!isNew&&!platform.canResetPasswords&&html`<div class="note"><${I} n="info"/><span>لتغيير كلمة مرور موظف نسيها: أوقف هذا الحساب وأنشئ له حساباً جديداً، أو احذفه من Firebase ← Authentication وأعد إنشاءه بنفس الاسم. الموظف يغيّر كلمة مروره بنفسه من القائمة.</span></div>`}
  </${Sheet}>`;
}

function Gate({children}){return html`<div class="gate"><div class="gate__card">${children}</div></div>`}
function Login(){const [u,setU]=useState("");const [p,setP]=useState("");const [rem,setRem]=useState(true);const [err,setErr]=useState("");const [busy,setBusy]=useState(false);const [setupOwner,setSetupOwner]=useState(false);
  const go=async e=>{e.preventDefault();setErr("");if(!u.trim()||!p)return setErr("اكتب اسم المستخدم وكلمة المرور.");setBusy(true);try{await platform.signIn(u,p,rem)}catch(x){setErr(String(x))}setBusy(false)};
  if(setupOwner)return html`<${Setup} firebase=${true} onBack=${()=>setSetupOwner(false)}/>`;
  return html`<${Gate}><img alt="GOLD ERA" src=${LOGO}/><h1>نظام إدارة المصنع</h1><p>ادخل باسم المستخدم وكلمة المرور اللي أعطاهم لك مدير النظام.</p>
    <form onSubmit=${go} style=${{display:"grid",gap:"12px",textAlign:"right"}}>
      <${F} label="اسم المستخدم"><input id="l-user" class="in nm" autocomplete="username" autoFocus value=${u} onInput=${e=>setU(e.target.value)}/></${F}>
      <${F} label="كلمة المرور"><input id="l-pass" class="in nm" type="password" autocomplete="current-password" value=${p} onInput=${e=>setP(e.target.value)}/></${F}>
      <label class="chk"><input type="checkbox" checked=${rem} onChange=${e=>setRem(e.target.checked)}/> تذكرني على هذا الجهاز</label>
      <button class="btn p" disabled=${busy}>دخول</button>${err&&html`<p class="msg" style=${{margin:0}}>${err}</p>`}
    </form>
    ${platform.mode==="firebase"&&platform.owners.length>0&&html`<button class="link" style=${{fontSize:"12.5px"}} onClick=${()=>setSetupOwner(true)}>أول تشغيل؟ إنشاء حساب المالك</button>`}
  </${Gate}>`}
function Setup({firebase,onBack}){const [n2,setN]=useState("");const [u,setU]=useState(firebase?(platform.owners[0]||""):"mina");const [p,setP]=useState("");const [p2,setP2]=useState("");const [err,setErr]=useState("");const [busy,setBusy]=useState(false);
  const go=async e=>{e.preventDefault();setErr("");if(p.length<6)return setErr("كلمة المرور: 6 أحرف على الأقل.");if(p!==p2)return setErr("كلمتا المرور غير متطابقتين.");setBusy(true);
    try{await platform.setupOwner(u,p,n2.trim());if(!firebase)await platform.signIn(u,p,true)}catch(x){setErr(String(x))}setBusy(false)};
  return html`<${Gate}><img alt="GOLD ERA" src=${LOGO}/><h1>إنشاء حساب المالك</h1><p>${firebase?"المالك هو mina — هو بس اللي يتحكم في كل المستخدمين. الخطوة دي مرة واحدة فقط.":"أول تشغيل: أنشئ حساب المالك. المالك يرى كل شيء ويُنشئ حسابات الموظفين ويحدد صلاحياتهم."}</p>
    <form onSubmit=${go} style=${{display:"grid",gap:"12px",textAlign:"right"}}>
      ${!firebase&&html`<${F} label="اسمك"><input id="s-name" class="in" value=${n2} onInput=${e=>setN(e.target.value)} placeholder="مثال: مينا"/></${F}>`}
      <${F} label="اسم المستخدم"><input id="s-user" class="in nm" value=${u} readOnly=${firebase} onInput=${e=>setU(e.target.value)}/></${F}>
      <${F} label="كلمة المرور"><input id="s-pass" class="in nm" type="password" autocomplete="new-password" value=${p} onInput=${e=>setP(e.target.value)}/></${F}>
      <${F} label="تأكيد كلمة المرور"><input id="s-pass2" class="in nm" type="password" autocomplete="new-password" value=${p2} onInput=${e=>setP2(e.target.value)}/></${F}>
      <button class="btn p" disabled=${busy}>إنشاء الحساب والدخول</button>${err&&html`<p class="msg" style=${{margin:0}}>${err}</p>`}
    </form>${onBack&&html`<button class="link" style=${{fontSize:"12.5px"}} onClick=${onBack}>رجوع لتسجيل الدخول</button>`}
  </${Gate}>`}
function NoAccess({me}){return html`<${Gate}><img alt="GOLD ERA" src=${LOGO}/><h1>لا توجد صلاحيات</h1><p>حسابك <b class="num">${me?.username||""}</b> غير مفعّل أو لم تُحدد له صفحات. اطلب من مدير النظام تفعيله.</p><div style=${{display:"flex",gap:"8px",justifyContent:"center"}}><button class="btn" onClick=${()=>location.reload()}>إعادة التحميل</button><button class="btn ghost" onClick=${()=>platform.signOut()}>تسجيل الخروج</button></div></${Gate}>`}
function PasswordSheet({onClose,toast}){const [a,setA]=useState("");const [b,setB]=useState("");const [c,setC]=useState("");const [err,setErr]=useState("");const [busy,setBusy]=useState(false);
  const save=async()=>{setErr("");if(b.length<6)return setErr("كلمة المرور الجديدة: 6 أحرف على الأقل.");if(b!==c)return setErr("كلمتا المرور غير متطابقتين.");setBusy(true);try{await platform.changePassword(a,b);toast("تغيّرت كلمة المرور");onClose()}catch(x){setErr(String(x))}setBusy(false)};
  return html`<${Sheet} title="تغيير كلمة المرور" onClose=${onClose} footer=${html`<span class="msg">${err}</span><button class="btn" onClick=${onClose}>إلغاء</button><button class="btn p" disabled=${busy} onClick=${save}><${I} n="check"/>حفظ</button>`}>
    <div class="fg"><${F} full label="كلمة المرور الحالية"><input id="pw-a" class="in nm" type="password" autocomplete="current-password" value=${a} onInput=${e=>setA(e.target.value)}/></${F}>
    <${F} label="الجديدة"><input id="pw-b" class="in nm" type="password" autocomplete="new-password" value=${b} onInput=${e=>setB(e.target.value)}/></${F}><${F} label="تأكيد الجديدة"><input id="pw-c" class="in nm" type="password" autocomplete="new-password" value=${c} onInput=${e=>setC(e.target.value)}/></${F}></div>
  </${Sheet}>`}

/* ---------- app ---------- */
function App(){
  const [gate,setGate]=useState("loading");const [access,setAccess]=useState(null);
  const [ready,setReady]=useState(false);const [online,setOnline]=useState(false);
  const [catalog,setCatalog]=useState({});const [workers,setWorkers]=useState({});const [depts,setDepts]=useState(DEFAULT_DEPTS);const [prices,setPrices]=useState({});const [config,setConfig]=useState({});
  const [days,setDays]=useState({});const [dailies,setDailies]=useState({});const snapRef=useRef({});const [customers,setCustomers]=useState({});const [orders,setOrders]=useState({});const [months,setMonths]=useState({});
  const [me,setMe]=useState(null);const [names,setNames]=useState({});
  const [page,setPage]=useState(()=>{const h=(location.hash||"").slice(1);return PAGE_TITLE[h]?h:"dash"});
  const [intent,setIntent]=useState(null);const [entry,setEntry]=useState(null);const [cmd,setCmd]=useState(false);const [menu,setMenu]=useState(false);const [pwSheet,setPwSheet]=useState(false);
  const [toastMsg,setToastMsg]=useState("");const tt=useRef();
  const toast=m=>{setToastMsg(m);clearTimeout(tt.current);tt.current=setTimeout(()=>setToastMsg(""),3200)};
  useEffect(()=>{let un=[];(async()=>{
    if(await platform.needsSetup()){setGate("setup");return}
    const u=await platform.auth();if(!u){setGate("login");return}
    const [db,user]=await Promise.all([platform.use("db"),platform.use("user")]);S.db=db;S.user=user;
    const m=await user.me();S.uid=m.id;setMe(m);
    let perm=OWNER_PERM;
    if(!m.isOwner){const a=await db.doc("access/"+m.id).get();if(!a.exists||a.data().active!==true||!Object.keys(a.data().pages||{}).length){setGate("noaccess");return}perm=a.data()}
    setAccess(perm);setGate("app");
    const R=new Set(perm.read||[]);
    const fail=()=>setOnline(false);const d=(p,f)=>un.push(db.doc(p).onSnapshot(s=>{f(s.exists?s.data():{},s.exists);setOnline(true)},fail));
    if(!m.isOwner)un.push(db.doc("access/"+m.id).onSnapshot(s=>{if(s.exists){const x=s.data();if(x.active!==true)location.reload();else setAccess(x)}},()=>{}));
    d("settings/catalog",(x,ex)=>{setCatalog(x.items||{});if((!ex||!Object.keys(x.items||{}).length)&&m.isOwner)seedDefaults()});
    if(m.isOwner)recompileAccess();
    if(R.has("dailies"))un.push(db.collection("dailies").onSnapshot(qs=>{const o={};qs.docs.forEach(x=>o[x.id]={...x.data(),date:x.id});setDailies(o)},()=>{}));d("settings/prices",setPrices);d("settings/config",setConfig);
    d("settings/people",x=>setNames(Object.fromEntries(Object.entries(x.map||{}).map(([k,v])=>[k,{id:k,name:v.name,avatarUrl:null}]))));
    if(R.has("staff")||m.isOwner)un.push(db.collection("staff").onSnapshot(qs=>{const o={};let dp=null;qs.docs.forEach(x=>{if(x.id==="__departments")dp=x.data().list;else{const v=x.data();o[x.id]={...v,id:x.id,kind:v.dept}}});window.__WORKERS=o;setWorkers(o);setDepts([...new Set([...(dp&&dp.length?dp:DEFAULT_DEPTS),...CORE_DEPTS])]);
      if(m.isOwner&&!qs.docs.length)migrateWorkers()},fail));
    if(R.has("orders"))un.push(db.collection("orders").onSnapshot(qs=>{const o={};qs.docs.forEach(x=>o[x.id]={...x.data(),id:x.id});window.__ORDERS=o;setOrders(o)},fail));
    if(R.has("months"))un.push(db.collection("months").onSnapshot(qs=>{const o={};qs.docs.forEach(x=>o[x.id]=x.data());setMonths(o)},fail));
    if(R.has("customers"))un.push(db.collection("customers").onSnapshot(qs=>{const o={};qs.docs.forEach(x=>o[x.id]=x.data());setCustomers(o)},fail));
    const parts={};let pending=ALL_LEDGER.filter(c=>R.has(c)).length;if(!pending)setReady(true);
    const rebuild=()=>{const o={};for(const [c,docs] of Object.entries(parts))for(const [id,v] of Object.entries(docs)){const t=o[id]||(o[id]={date:id});t[c]=v[c]}setDays(o)};
    ALL_LEDGER.filter(c=>R.has(c)).forEach(c=>{let first=true;un.push(db.collection(c).onSnapshot(qs=>{const o={};qs.docs.forEach(x=>o[x.id]=x.data());parts[c]=o;rebuild();if(first){first=false;if(--pending<=0)setReady(true)}},fail))});
    setTimeout(()=>setReady(true),4000);
  })();return()=>un.forEach(f=>{try{f()}catch(e){}})},[]);
  useEffect(()=>{const h=e=>{if((e.ctrlKey||e.metaKey)&&(e.key==="k"||e.key==="K")){e.preventDefault();setCmd(true)}};addEventListener("keydown",h);return()=>removeEventListener("keydown",h)},[]);
  const L=useMemo(()=>buildLedger(days,catalog),[days,catalog]);
  /* the daily report is saved by itself: today and yesterday, whenever their numbers change */
  useEffect(()=>{if(gate!=="app"||!ready||!access||!S.db)return;if(!(access.owner||(access.write||[]).includes("dailies")))return;
    const tm=setTimeout(async()=>{for(const d of [addDays(today(),-1),today()]){const s=dailySnap(L,catalog,workers,d,n(config.khisyaLimit)||0.5);
      if(!s.workers.length&&!s.made&&!s.received&&!s.refineOut)continue;const key=JSON.stringify(s);if(snapRef.current[d]===key)continue;
      try{await S.db.doc("dailies/"+d).set({...s,savedAt:new Date().toISOString(),by:S.uid});snapRef.current[d]=key}catch(e){console.warn("daily save",e)}}},8000);
    return()=>clearTimeout(tm)},[L,workers,gate,ready,access]);
  const visible=access?PAGE_LIST.filter(p=>access.owner||access.pages?.[p.k]==="view"||access.pages?.[p.k]==="edit").map(p=>p.k):[];
  useEffect(()=>{if(access&&visible.length&&!visible.includes(page))setPage(visible[0])},[access]);
  useEffect(()=>{try{history.replaceState(null,"","#"+page)}catch(e){}window.scrollTo(0,0);setMenu(false)},[page]);
  useEffect(()=>{if(entry){const fresh=L.all.find(e=>e.id===entry.id&&e._date===entry._date);if(fresh&&fresh!==entry)setEntry(fresh)}},[L]);
  if(gate==="loading")return html`<div class="loading"><img alt="GOLD ERA" src=${LOGO}/></div>`;
  if(gate==="setup")return html`<${Setup} firebase=${false}/>`;
  if(gate==="login")return html`<${Login}/>`;
  if(gate==="noaccess")return html`<${NoAccess} me=${me}/>`;
  const perm=access||{pages:{}};
  const can=p=>!!perm.owner||perm.pages?.[p]==="edit";
  const role=perm.owner?"manager":"user";
  const go=(p,it)=>{if(!visible.includes(p))return;setPage(p);setIntent(it?{...it,t:Date.now()}:null)};
  const counts={hallmark:locTotal(L.stock,"hallmark").c,prep:locTotal(L.stock,"prep").c,finish:locTotal(L.stock,"finish").c,orders:openOrders(orders).length,refine:runningOf(L,"refine").length,strips:runningOf(L,"strip").length,casting:runningOf(L,"mfg").length};
  const props={L,days,catalog,workers,prices,customers,names,toast,role,perm,go,open:setEntry,intent,config,orders,months,dailies};
  const cur=visible.includes(page)?page:visible[0];
  let body;
  if(STAGES[cur])body=html`<${StagePage} key=${cur} cfg=${STAGES[cur]} ...${props} can=${can(cur)}/>`;
  else switch(cur){
    case "bars":body=html`<${BarsPage} ...${props} can=${can("bars")}/>`;break;
    case "refine":body=html`<${JobPage} key="refine" job="refine" ...${props} can=${can("refine")}/>`;break;
    case "strips":body=html`<${JobPage} key="strip" job="strip" ...${props} can=${can("strips")}/>`;break;
    case "casting":body=html`<${JobPage} key="mfg" job="mfg" ...${props} can=${can("casting")}/>`;break;
    case "stock":body=html`<${StockPage} ...${props} can=${can("stock")}/>`;break;
    case "review":body=html`<${ReviewPage} ...${props}/>`;break;
    case "orders":body=html`<${OrdersPage} ...${props} can=${can("orders")}/>`;break;
    case "count":body=html`<${CountPage} ...${props} can=${can("count")}/>`;break;
    case "labels":body=html`<${LabelsPage} ...${props} can=${can("labels")}/>`;break;
    case "sales":body=html`<${SalesPage} ...${props} can=${can("sales")}/>`;break;
    case "customers":body=html`<${CustomersPage} ...${props} can=${can("customers")}/>`;break;
    case "reports":body=html`<${ReportsPage} ...${props}/>`;break;
    case "workers":body=html`<${WorkersPage} ...${props} depts=${depts} can=${can("workers")}/>`;break;
    case "attendance":body=html`<${AttendancePage} ...${props} can=${can("attendance")}/>`;break;
    case "daily":body=html`<${DailyReport} ...${props} can=${can("daily")}/>`;break;
    case "settings":body=html`<${SettingsPage} ...${props} isOwner=${!!me?.isOwner}/>`;break;
    default:body=html`<${Dashboard} ...${props}/>`;
  }
  return html`<div class="layout">
    <aside class=${"rail"+(menu?" open":"")} aria-label="القائمة الرئيسية">
      <div class="rail__brand"><img alt="GOLD ERA" src=${LOGO}/><small>نظام إدارة<br/>المصنع</small></div>
      <nav class="rail__nav">${NAV.map(([g,items])=>{const its=items.filter(([k])=>visible.includes(k));return its.length?html`<${React.Fragment} key=${g}><div class="rail__g">${g}</div>${its.map(([k,l])=>html`<button key=${k} class="rail__i" aria-current=${cur===k?"page":undefined} onClick=${()=>go(k)}><${I} n=${NAV_ICON[k]}/><span>${l}</span>${perm.pages?.[k]==="view"&&!perm.owner?html`<${I} n="eye" s=${14}/>`:null}${counts[k]>0&&html`<span class="cnt num">${fi(counts[k])}</span>`}</button>`)}</${React.Fragment}>`:null})}</nav>
      <div class="rail__me"><img alt="" src=${me?.avatarUrl}/><div style=${{minWidth:0,flex:1}}><b>${me?.name||me?.username}</b><span><i class=${"dot"+(online?"":" off")}></i>${perm.owner?"المالك":"@"+me?.username} · ${platform.mode==="local"?"وضع محلي":online?(platform.mode==="claude"?"متزامن":"متصل"):"غير متصل"}</span></div>
        <div style=${{display:"grid",gap:"2px"}}><button class="btn ghost sm rail__btn" onClick=${()=>setPwSheet(true)}>كلمة المرور</button><button class="btn ghost sm rail__btn" onClick=${()=>platform.signOut()}>خروج</button></div></div>
    </aside>
    ${menu&&html`<div class="scrim" onClick=${()=>setMenu(false)}></div>`}
    <div class="main">
      <header class="top">
        <button class="menubtn" onClick=${()=>setMenu(true)} aria-label="فتح القائمة"><${I} n="menu"/></button>
        <div class="crumb"><span>${PAGE_GROUP[cur]}</span><${I} n="chev"/><b>${PAGE_TITLE[cur]}</b></div>
        <button class="gsearch" onClick=${()=>setCmd(true)} aria-label="بحث شامل"><${I} n="search" s=${16}/><span>بحث شامل…</span><kbd>Ctrl K</kbd></button>
        <span class="datechip">${new Date().toLocaleDateString("ar-EG",{weekday:"long",day:"numeric",month:"long"})}</span>
      </header>
      <main class="content">
        ${platform.mode==="claude"&&cur==="dash"&&html`<div class="note"><${I} n="info"/><span>نسخة تجريبية متزامنة: البيانات تظهر لحظياً على كل أجهزتك وعند من تشاركه الرابط. للتشغيل الفعلي في المصنع انشر نسخة GitHub مع Firebase.</span></div>`}
        ${platform.mode==="local"&&cur==="dash"&&html`<div class="note"><${I} n="info"/><span>وضع محلي: البيانات والحسابات محفوظة في هذا المتصفح فقط. لتشغيل النظام لعدة موظفين على أجهزة مختلفة، اربطه بـ Firebase كما في ملف README.</span></div>`}
        ${ready?body:html`<${Empty} icon="clock" t="جاري تحميل البيانات…" s=""/>`}
      </main>
    </div>
    ${entry&&html`<${EntrySheet} e=${entry} L=${L} catalog=${catalog} customers=${customers} names=${names} role=${role} perm=${perm} toast=${toast} onClose=${()=>setEntry(null)}/>`}
    ${cmd&&html`<${Command} L=${L} catalog=${catalog} customers=${customers} go=${go} visible=${visible} onClose=${()=>setCmd(false)}/>`}
    ${pwSheet&&html`<${PasswordSheet} toast=${toast} onClose=${()=>setPwSheet(false)}/>`}
    ${toastMsg&&html`<div class="toast" role="status"><${I} n="check"/>${toastMsg}</div>`}
  </div>`;
}

ReactDOM.createRoot(document.getElementById("app")).render(html`<${App}/>`);
