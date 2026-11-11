// Cross-device stamp sync via Firebase Realtime Database, keyed by a pass-phrase (共有コード).
// Requires sync-config.js to define window.MEGURI_FIREBASE. Without it, the sync card explains setup.
(function(){
const CFG=window.MEGURI_FIREBASE||null,CODE_KEY='meguri-sync-code',META_KEY='meguri-sync-meta';
const S={code:localStorage.getItem(CODE_KEY)||'',db:null,ref:null,remote:{},meta:{},state:CFG?'off':'nocfg',last:null,snap:null,vis:null,busy:false};
try{S.meta=JSON.parse(localStorage.getItem(META_KEY)||'{}')}catch(e){}
const saveMeta=()=>localStorage.setItem(META_KEY,JSON.stringify(S.meta));
async function sha(t){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('meguri:'+t.trim()));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}
const load=src=>new Promise((ok,ng)=>{const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=ng;document.head.appendChild(s)});
async function ensureDb(){if(S.db)return S.db;
  await load('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');await load('https://www.gstatic.com/firebasejs/10.12.2/firebase-database-compat.js');
  firebase.initializeApp(CFG);S.db=firebase.database();
  S.db.ref('.info/connected').on('value',v=>{if(!S.ref)return;S.state=v.val()?'on':'offline';paint()});return S.db}
const snapOf=()=>Object.assign({},visited);
function markers(ids){let any=false;ids.forEach(id=>{const s=byId(id);if(s){s.m.setStyle(mstyle(s));any=true}});
  if(!any)return;if(st.stamp!=='all')applyFilter(false);else renderHome();if(st.tab==='book')renderBook();if(st.sel&&ids.includes(st.sel.id))renderDetail(false)}
// remote → local
function applyRemote(){if(!S.ref)return;const ch=[];
  for(const id in S.remote){const r=S.remote[id];if(!byId(id))continue;const lt=S.meta[id]||0;if(r.t<=lt)continue;
    if(r.d){if(visited[id]!==r.d){visited[id]=r.d;ch.push(id)}}else if(visited[id]){delete visited[id];ch.push(id)}
    S.meta[id]=r.t}
  if(ch.length){if(window.persistVisited)persistVisited();else localStorage.setItem(KEY,JSON.stringify(visited));saveMeta();markers(ch)}
  S.snap=snapOf();S.vis=visited;S.last=new Date();paint()}
// local → remote
function push(id,d){const t=Date.now();S.meta[id]=t;saveMeta();if(S.ref)S.ref.child(id).set({d:d||null,t}).catch(()=>{S.state='err';paint()})}
function diffPush(){if(S.vis!==visited){S.vis=visited;S.snap=snapOf();applyRemote();pushLocalOnly();return}
  const a=S.snap||{},b=visited;for(const id in b)if(a[id]!==b[id])push(id,b[id]);for(const id in a)if(!(id in b))push(id,null);S.snap=snapOf()}
function pushLocalOnly(){for(const id in visited){const r=S.remote[id];if(!r)push(id,visited[id])}}
window.onVisitedChange=()=>{diffPush();paint()};
setInterval(()=>{if(S.ref&&S.vis!==visited)diffPush()},1500);
async function connect(code){code=(code||'').trim();if(code.length<8){toast('合言葉は8文字以上にしてください');return}
  if(!CFG){toast('同期サーバーが未設定です（README参照）');return}
  S.busy=true;paint();
  try{await ensureDb();if(S.ref)S.ref.off();const h=await sha(code);S.ref=S.db.ref('books/'+h+'/visits');S.code=code;localStorage.setItem(CODE_KEY,code);
    const first=await S.ref.get();S.remote=first.val()||{};S.vis=visited;applyRemote();pushLocalOnly();
    S.ref.on('child_added',v=>{S.remote[v.key]=v.val();applyRemote()});S.ref.on('child_changed',v=>{S.remote[v.key]=v.val();applyRemote()});
    S.state='on';toast('同期を開始しました')}
  catch(e){S.state='err';S.ref=null;toast('同期サーバーに接続できませんでした')}
  S.busy=false;paint()}
function disconnect(){if(S.ref)S.ref.off();S.ref=null;S.code='';S.remote={};localStorage.removeItem(CODE_KEY);S.state=CFG?'off':'nocfg';paint();toast('この端末の同期を解除しました（記録は残ります）')}
function newCode(){const w='abcdefghjkmnpqrstuvwxyz23456789',r=crypto.getRandomValues(new Uint8Array(12));return [0,4,8].map(i=>[...r.slice(i,i+4)].map(x=>w[x%w.length]).join('')).join('-')}
// UI card in 巡り帖
const mask=c=>c.length<=4?'••••':c.slice(0,4)+'••••'+c.slice(-2);
function cardHtml(){const t=S.last?`${S.last.getHours()}:${String(S.last.getMinutes()).padStart(2,'0')}`:'—';
  if(S.state==='nocfg')return `<div class="sy-h"><b>端末間で同期</b><span class="sy-st off">未設定</span></div><p class="sy-p">同期サーバーの設定（sync-config.js）がまだありません。README の手順で設定すると、合言葉で複数端末の記録を共有できます。</p>`;
  if(S.ref)return `<div class="sy-h"><b>端末間で同期</b><span class="sy-st ${S.state==='on'?'on':S.state==='offline'?'wait':'off'}">${S.state==='on'?'同期中':S.state==='offline'?'オフライン（再接続で反映）':'エラー'}</span></div>
    <div class="sy-row"><span>合言葉</span><code id="syCode">${mask(S.code)}</code><button id="syShow">表示</button></div>
    <div class="sy-row"><span>最終同期</span><code>${t}</code><button id="syOff">解除</button></div><p class="sy-p">ほかの端末で同じ合言葉を入れると、スタンプが即時に反映されます。</p>`;
  return `<div class="sy-h"><b>端末間で同期</b><span class="sy-st off">この端末のみ</span></div>
    <p class="sy-p">合言葉を決めて、スマホとPCで同じものを入力してください。</p>
    <div class="sy-form"><input id="syIn" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="合言葉（8文字以上）" value=""><button id="syGo" ${S.busy?'disabled':''}>${S.busy?'接続中…':'接続'}</button></div>
    <button id="syNew" class="sy-link">ランダムな合言葉を作る</button>`}
function paint(){const c=document.getElementById('sycard');if(!c)return;c.innerHTML=cardHtml();
  const g=document.getElementById('syGo');if(g)g.onclick=()=>connect(document.getElementById('syIn').value);
  const i=document.getElementById('syIn');if(i)i.onkeydown=e=>{if(e.key==='Enter')connect(i.value)};
  const n=document.getElementById('syNew');if(n)n.onclick=()=>{document.getElementById('syIn').value=newCode()};
  const o=document.getElementById('syOff');if(o)o.onclick=()=>{if(confirm('この端末の同期を解除しますか？'))disconnect()};
  const sh=document.getElementById('syShow');if(sh)sh.onclick=()=>{const el=document.getElementById('syCode');const on=el.textContent===S.code;el.textContent=on?mask(S.code):S.code;sh.textContent=on?'表示':'隠す'}}
const _rb=renderBook;renderBook=function(){_rb();const p=document.querySelector('#book .bk-prog');if(p&&!document.getElementById('sycard')){const d=document.createElement('div');d.id='sycard';d.className='sycard';p.after(d)}paint()};
if(st.tab==='book')renderBook();
if(S.code&&CFG)connect(S.code);
})();
