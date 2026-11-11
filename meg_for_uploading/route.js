// Approximate fastest rail route (no timetable) from current location to a store, using bundled 国土数値情報 rail data.
const RT={ready:null,nodes:[],adj:[],grp:[],lines:[]};
const W=80; // walk m/min
const SUBW=new Set(['東京地下鉄','東京都','大阪市高速電気軌道','名古屋市','札幌市','福岡市','京都市','神戸市','横浜市','仙台市']);
function lineSpeed(l){const[o,,t,k]=l;if(t===1)return 3300;if(k>=21)return 250;if(SUBW.has(o)||(k>=14&&k<=17))return 500;return t===2?750:650} // m/min
function rtLoad(){if(RT.ready)return RT.ready;RT.ready=(async()=>{
  const m=await (await fetch('data/rail-meta.json?v=5')).json();RT.lines=m.lines;
  const G=m.st.map(([n,la,lg,...l])=>({n,lat:la/1e5,lng:lg/1e5,l}));RT.grp=G;
  const key=new Map(),N=RT.nodes,A=RT.adj;const node=(g,l)=>{const k=g*1000+l;if(!key.has(k)){key.set(k,N.length);N.push({g,l});A.push([])}return key.get(k)};
  const edge=(a,b,w,kind)=>{A[a].push([b,w,kind]);A[b].push([a,w,kind])};
  const byLine=new Map();G.forEach((s,gi)=>s.l.forEach(l=>{node(gi,l);(byLine.get(l)||byLine.set(l,[]).get(l)).push(gi)}));
  const D=(a,b)=>hav(G[a].lat,G[a].lng,G[b].lat,G[b].lng);
  for(const[l,gs]of byLine){const L0=RT.lines[l],sp=lineSpeed(L0),mx=L0[2]===1?150000:15000,seen=new Set();
    gs.forEach(a=>{gs.filter(b=>b!==a).map(b=>[b,D(a,b)]).filter(x=>x[1]<=mx).sort((x,y)=>x[1]-y[1]).slice(0,2).forEach(([b,d])=>{const k=a<b?a+':'+b:b+':'+a;if(seen.has(k))return;seen.add(k);edge(node(a,l),node(b,l),d*1.15/sp+0.6,'ride')})})}
  G.forEach((s,gi)=>{for(let i=0;i<s.l.length;i++)for(let j=i+1;j<s.l.length;j++)edge(node(gi,s.l[i]),node(gi,s.l[j]),5,'xfer')});
  const cell=new Map(),C=.004;G.forEach((s,gi)=>{const k=Math.floor(s.lat/C)+':'+Math.floor(s.lng/C);(cell.get(k)||cell.set(k,[]).get(k)).push(gi)});
  G.forEach((s,gi)=>{const cy=Math.floor(s.lat/C),cx=Math.floor(s.lng/C);for(let y=cy-1;y<=cy+1;y++)for(let x=cx-1;x<=cx+1;x++)(cell.get(y+':'+x)||[]).forEach(gj=>{if(gj<=gi)return;const d=D(gi,gj);if(d>400)return;
    s.l.forEach(a=>G[gj].l.forEach(b=>edge(node(gi,a),node(gj,b),d/W+5,'xfer')))})});
  RT.key=key;return RT})();return RT.ready}
function near(lat,lng,r){const out=[];RT.grp.forEach((s,gi)=>{if(Math.abs(s.lat-lat)>r/90000||Math.abs(s.lng-lng)>r/70000)return;const d=hav(lat,lng,s.lat,s.lng);if(d<=r)out.push([gi,d])});return out.sort((a,b)=>a[1]-b[1]).slice(0,8)}
async function route(fromLat,fromLng,toLat,toLng){await rtLoad();const direct=hav(fromLat,fromLng,toLat,toLng),walkOnly=direct*1.25/W;
  let O=near(fromLat,fromLng,1500),T=near(toLat,toLng,1500);if(!O.length)O=near(fromLat,fromLng,5000).slice(0,3);if(!T.length)T=near(toLat,toLng,5000).slice(0,3);
  if(!O.length||!T.length)return{walkOnly,legs:null};
  const n=RT.nodes.length,dist=new Float64Array(n).fill(Infinity),prev=new Int32Array(n).fill(-1),pk=new Array(n),H=[];
  const push=(d,v)=>{H.push([d,v]);let i=H.length-1;while(i>0){const p=(i-1)>>1;if(H[p][0]<=H[i][0])break;[H[p],H[i]]=[H[i],H[p]];i=p}};
  const pop=()=>{const t=H[0],e=H.pop();if(H.length){H[0]=e;let i=0;for(;;){const l=2*i+1,r=l+1;let m=i;if(l<H.length&&H[l][0]<H[m][0])m=l;if(r<H.length&&H[r][0]<H[m][0])m=r;if(m===i)break;[H[m],H[i]]=[H[i],H[m]];i=m}}return t};
  O.forEach(([gi,d])=>RT.grp[gi].l.forEach(l=>{const v=RT.key.get(gi*1000+l),w=d*1.25/W+3;if(w<dist[v]){dist[v]=w;prev[v]=-2;push(w,v)}}));
  const goal=new Map();T.forEach(([gi,d])=>goal.set(gi,d*1.25/W));let best=Infinity,bv=-1;
  while(H.length){const[d,v]=pop();if(d>dist[v])continue;if(d>=best)break;const g=RT.nodes[v].g;if(goal.has(g)){const tot=d+goal.get(g);if(tot<best){best=tot;bv=v}}
    for(const[u,w,k]of RT.adj[v]){const nd=d+w;if(nd<dist[u]){dist[u]=nd;prev[u]=v;pk[u]=k;push(nd,u)}}}
  if(bv<0||best>=walkOnly)return{walkOnly,legs:null,total:walkOnly};
  const path=[];for(let v=bv;v>=0;v=prev[v])path.unshift(v);
  const legs=[];const g0=RT.grp[RT.nodes[path[0]].g];legs.push({k:'walk',min:hav(fromLat,fromLng,g0.lat,g0.lng)*1.25/W,to:g0.n});
  let cur=null;for(let i=0;i<path.length;i++){const nd=RT.nodes[path[i]],kind=i?pk[path[i]]:'start';
    if(kind==='xfer'){if(cur){legs.push(cur);cur=null}legs.push({k:'xfer',at:RT.grp[nd.g].n});continue}
    if(!cur)cur={k:'ride',line:RT.lines[nd.l],from:RT.grp[nd.g].n,stops:0,min:0,to:RT.grp[nd.g].n,t0:dist[path[i]]};
    else{cur.stops++;cur.to=RT.grp[nd.g].n;cur.min=dist[path[i]]-cur.t0}}
  if(cur)legs.push(cur);
  const merged=[];legs.forEach(l=>{const p=merged[merged.length-1];if(l.k==='xfer'&&p&&p.k==='xfer')return;if(l.k==='xfer'&&(!merged.some(x=>x.k==='ride')))return;merged.push(l)});
  while(merged.length&&merged[merged.length-1].k==='xfer')merged.pop();
  const gl=RT.grp[RT.nodes[bv].g];merged.push({k:'walk',min:goal.get(RT.nodes[bv].g),to:'店舗'});
  return{walkOnly,legs:merged.filter(l=>l.k!=='ride'||l.stops>0),total:best}}
// ---- UI ----
const fmtMin=m=>m<60?`${Math.max(1,Math.round(m))}分`:`${Math.floor(m/60)}時間${String(Math.round(m%60)).padStart(2,'0')}分`;
const lname=l=>(/旅客鉄道$/.test(l[0])?'JR':l[0].replace(/(電気鉄道|電鉄|鉄道|高速度交通|株式会社)$/,''))+' '+l[1];
function dirUrl(s,mode){const o=`${user.lat},${user.lng}`,d=`${s.lat},${s.lng}`;
  if(IOS)return `https://maps.apple.com/?saddr=${o}&daddr=${d}&dirflg=${mode==='transit'?'r':mode==='walk'?'w':'d'}`;
  return `https://www.google.com/maps/dir/?api=1&origin=${o}&destination=${d}&travelmode=${mode==='transit'?'transit':mode==='walk'?'walking':'driving'}`}
const RC=new Map();
async function routeBox(s){const el=document.getElementById('route');if(!el)return;const mode=st.mode==='transit'?'transit':'car';
  const car=s.d<800?null:Math.max(3,Math.round(s.d*1.35/(s.d<5000?300:s.d<30000?500:1000)));
  let h=`<div class="rt-sum"><span class="rt-dist"><b>${fmtD(s.d)}</b><small>直線</small></span><span title="徒歩" aria-label="徒歩"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13" cy="4" r="2" fill="currentColor" stroke="none"/><path d="M9 21l2.2-6.5M15.5 21l-2-5.5-2.2-2 1-4.5"/><path d="M7.5 11.5l2.5-3 3.2-.5 2.3 3 2.5 1"/></svg><b>${fmtMin(s.d*1.25/W)}</b></span>${s.d<60000?`<span title="自転車" aria-label="自転車"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="5.5" cy="16" r="3.5"/><circle cx="18.5" cy="16" r="3.5"/><path d="M5.5 16l4-7h6l3 7M9.5 9L12 16h3.5M14 6h2.5"/></svg><b>${fmtMin(s.d*1.25/250)}</b></span>`:''}${car?`<span title="車" aria-label="車"><svg viewBox="0 0 24 24" width="20" height="20"><path d="M5 11l1.6-4.2A2 2 0 0 1 8.5 5.5h7a2 2 0 0 1 1.9 1.3L19 11" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><rect x="3" y="11" width="18" height="6" rx="2" fill="currentColor"/><circle cx="7.5" cy="17.5" r="1.9" fill="currentColor"/><circle cx="16.5" cy="17.5" r="1.9" fill="currentColor"/></svg><b>${fmtMin(car)}</b></span>`:''}<span class="rt-tr" id="rtT" title="電車" aria-label="電車">${mode==='transit'?'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="14" rx="3"/><path d="M5 10h14"/><circle cx="9" cy="13.5" r=".8" fill="currentColor"/><circle cx="15" cy="13.5" r=".8" fill="currentColor"/><path d="M8 21l2-4M16 21l-2-4"/></svg><b>…</b>':''}</span></div>`;
  if(mode==='transit')h+=`<div class="rt-legs" id="rtLegs"><div class="rt-load">最速ルートを計算中…</div></div>`;
  h+=`<div class="rt-acts"><a href="${dirUrl(s,mode)}" target="_blank" rel="noopener">${mode==='transit'?'乗換案内（地図アプリ）':'カーナビ（地図アプリ）'}で開く ↗</a></div>`;
  el.innerHTML=h;if(mode!=='transit')return;
  const ck=s.id+'@'+user.lat.toFixed(4)+','+user.lng.toFixed(4);
  try{const r=RC.get(ck)||await route(user.lat,user.lng,s.lat,s.lng);RC.set(ck,r);if(st.sel!==s||!document.getElementById('rtLegs'))return;
    const T=document.getElementById('rtT'),L=document.getElementById('rtLegs');
    if(!r.legs){T.innerHTML='';L.innerHTML=`<div class="rt-note">${s.d<1500?'徒歩がいちばん早い距離です':'近くに使える鉄道路線が見つかりませんでした'}</div>`;return}
    T.innerHTML=`<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="14" rx="3"/><path d="M5 10h14"/><circle cx="9" cy="13.5" r=".8" fill="currentColor"/><circle cx="15" cy="13.5" r=".8" fill="currentColor"/><path d="M8 21l2-4M16 21l-2-4"/></svg><b>${fmtMin(r.total)}</b>`;
    const rides=r.legs.filter(l=>l.k==='ride');
    const chips=rides.map(l=>`<i style="background:${typeof colorOf==='function'?colorOf(l.line[0],l.line[1],l.line[2]):'#2f6b4f'}"></i>`).join('');
    L.classList.toggle('open',!!RT.open);
    L.innerHTML=`<button class="rt-h" id="rtTog" aria-expanded="${!!RT.open}"><span class="rt-ht"><b>最速ルート（目安）</b><small>${fmtMin(r.total)}・乗換 ${Math.max(0,rides.length-1)}回</small></span><span class="rt-chips">${chips}</span><span class="rt-car"></span></button><div class="rt-body"><div><ol>`+r.legs.map(l=>l.k==='walk'?`<li class="w"><i></i><span>徒歩 ${fmtMin(l.min)}</span><em>${l.to==='店舗'?'店舗へ':esc0(l.to)+'駅へ'}</em></li>`:
      l.k==='xfer'?`<li class="x"><i></i><span>乗換</span><em>${esc0(l.at)}</em></li>`:
      `<li class="r"><i style="background:${typeof colorOf==='function'?colorOf(l.line[0],l.line[1],l.line[2]):'#2f6b4f'}"></i><span>${esc0(lname(l.line))}</span><em>${esc0(l.from)} → ${esc0(l.to)}・${l.stops}駅・${fmtMin(l.min)}</em></li>`).join('')+
      `</ol><div class="rt-note">時刻表・待ち時間・運賃は含まない概算です（バス未対応）。正確な時刻は乗換案内で確認してください。</div></div></div>`;
    document.getElementById('rtTog').onclick=()=>{RT.open=!RT.open;L.classList.toggle('open',RT.open);document.getElementById('rtTog').setAttribute('aria-expanded',RT.open)}}
  catch(e){const L=document.getElementById('rtLegs');if(L)L.innerHTML='<div class="rt-note">ルートを計算できませんでした</div>'}}
const esc0=v=>String(v).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const _rd=renderDetail;renderDetail=function(show,pop){_rd(show,pop);if(st.sel)routeBox(st.sel)};
