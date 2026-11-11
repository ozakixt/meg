// Overlay layers: car share (bundled CSV → OSM fallback) and bike share (official GBFS via ODPT, live availability).
const LY={
  times:{n:'タイムズカーシェア',c:'#2E7FD6',k:'car',re:/タイムズ|times/i},
  dcar:{n:'dカーシェア',c:'#8E44AD',k:'car',re:/dカーシェア|d\s*car\s*share|d-carshare/i},
  hello:{n:'HELLO CYCLING',c:'#F2C200',k:'bike',feeds:['hellocycling']},
  docomo:{n:'ドコモ・バイクシェア',c:'#E60012',k:'bike',feeds:['docomo-cycle-tokyo','docomo-cycle'],home:'https://docomo-cycle.jp/'}
};
const GBFS='https://api-public.odpt.org/api/v4/gbfs/';
const LKEY='meguri-layers';
map.createPane('spots');map.getPane('spots').style.zIndex=390;
const spotR=L.canvas({pane:'spots',padding:.3});
const MINZ={car:12,bike:11};
let lyOn={};try{lyOn=JSON.parse(localStorage.getItem(LKEY)||'{}')}catch(e){}
for(const k in LY)Object.assign(LY[k],{g:L.layerGroup(),pts:new Map(),state:'',loaded:false,busy:false,csv:null});
const spotRad=()=>{const z=map.getZoom();return z<13?2.5:z<15?3.5:5};
function lyStatus(k,t){LY[k].state=t;const el=document.getElementById('ly-'+k);if(el)el.textContent=t}
function addSpot(k,id,lat,lng,info){const L0=LY[k];if(L0.pts.has(id))return;
  const m=L.circleMarker([lat,lng],{radius:spotRad(),color:'#fff',weight:1.5,fillColor:L0.c,fillOpacity:1});
  m.info=info;m.k=k;m.on('click',e=>{L.DomEvent.stop(e);openSpot(m)});
  L0.pts.set(id,m);L0.g.addLayer(m)}
const PARK={street_parking:'路上',parking_lot:'駐輪場',underground_parking:'地下駐輪場',sidewalk_parking:'歩道上',other:'その他'};
const VT={};
async function vtypes(f){if(VT[f])return VT[f];try{const j=await (await fetch(GBFS+f+'/vehicle_types.json')).json();VT[f]={};(j.data.vehicle_types||[]).forEach(v=>VT[f][v.vehicle_type_id]=v.name||(v.propulsion_type==='human'?'自転車':v.propulsion_type?'電動アシスト自転車':v.form_factor))}catch(e){VT[f]={}}return VT[f]}
const RG={};
async function regions(f){if(RG[f])return RG[f];try{const j=await (await fetch(GBFS+f+'/system_regions.json')).json();RG[f]={};(j.data.regions||[]).forEach(r=>RG[f][r.region_id]=r.name)}catch(e){RG[f]={}}return RG[f]}
const SYS={};
async function sysInfo(f){if(SYS[f])return SYS[f];try{const j=await (await fetch(GBFS+f+'/system_information.json')).json();SYS[f]=j.data||{}}catch(e){SYS[f]={}}return SYS[f]}
async function revGeo(lat,lng){try{const r=await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&accept-language=ja&zoom=18&lat=${lat}&lon=${lng}`);const j=await r.json();const a=j.address||{};
  return [a.province||a.state,a.city||a.town||a.village,a.city_district||a.suburb,a.quarter||a.neighbourhood,a.road].filter(Boolean).join('')||j.display_name||''}catch(e){return ''}}
const stCache={};
async function feedStatus(f){const c=stCache[f];if(c&&Date.now()-c.t<20000)return c.m;const j=await (await fetch(GBFS+f+'/station_status.json',{cache:'no-store'})).json();const m=new Map();j.data.stations.forEach(x=>m.set(String(x.station_id),x));stCache[f]={t:Date.now(),m};return m}
const hm=t=>{const d=new Date(t*1000);return `${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`};
const drow=(k,v)=>v===''||v==null?'':`<dt>${k}</dt><dd>${v}</dd>`;
const esc=v=>String(v).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const spotPop=L.popup({className:'spot-pop',closeButton:true,offset:[0,-4],maxWidth:280,autoPanPaddingTopLeft:[10,220],autoPanPaddingBottomRight:[10,160]});let curSpot=null;
const isOpen=m=>curSpot===m&&map.hasLayer(spotPop);
function openSpot(m){curSpot=m;spotPop.setLatLng(m.getLatLng()).setContent(spotHtml(m.k,m)).openOn(map);repan(m);spotDetail(m)}
map.on('popupclose',e=>{if(e.popup===spotPop)curSpot=null});
async function spotDetail(m){const L0=LY[m.k],i=m.info;m.info.loading=true;if(isOpen(m))spotPop.setContent(spotHtml(m.k,m));
  try{if(L0.k==='bike'){const[f,id]=m.feedId;const ll=m.getLatLng();const[sm,vt,rg,sy,ad]=await Promise.all([feedStatus(f),vtypes(f),regions(f),sysInfo(f),i.addr||i.geo!==undefined?Promise.resolve(null):revGeo(ll.lat,ll.lng)]);
      if(ad!==null){i.geo=ad}i.region=rg[i.raw&&i.raw.region_id]||'';i.sys=sy;const x=sm.get(String(id));
      if(x){i.st={b:x.num_bikes_available,d:x.num_docks_available};i.live={renting:x.is_renting,returning:x.is_returning,installed:x.is_installed,at:x.last_reported,types:(x.vehicle_types_available||[]).map(v=>({n:vt[v.vehicle_type_id]||'車種'+v.vehicle_type_id,c:v.count}))};
        m.setStyle({fillOpacity:x.num_bikes_available>0&&x.is_renting!==false?1:.3})}}
    else if(i.tags===undefined&&i.osm){i.tags=null;for(const ep of ENDPOINTS){try{const r=await fetch(ep,{method:'POST',body:'data='+encodeURIComponent(`[out:json][timeout:15];${i.osm[0]}(${i.osm[1]});out tags;`)});if(r.ok){const j=await r.json();i.tags=(j.elements[0]||{}).tags||{};break}}catch(e){}}}
  }catch(e){i.err=true}
  i.loading=false;if(isOpen(m)){spotPop.setContent(spotHtml(m.k,m));repan(m)}}
function repan(m){requestAnimationFrame(()=>{const el=spotPop.getElement();if(!el)return;const lg=document.querySelector('.legend'),lgb=lg&&getComputedStyle(lg).display!=='none'?lg.getBoundingClientRect().bottom:0,top=Math.max($('.top').getBoundingClientRect().bottom,lgb)-$('#app').getBoundingClientRect().top+8,r=el.getBoundingClientRect(),ar=$('#app').getBoundingClientRect(),rt=r.top-ar.top;if(rt<top)map.panBy([0,rt-top],{animate:true})})}
function spotHtml(k,m){const L0=LY[k],i=m.info,s=i.st,lv=i.live,r=i.raw||{};let body='';
  if(L0.k==='bike'){
    const av=s?`<div class="sp-av"><span><b>${s.b}</b>貸出可</span><span><b>${s.d}</b>返却可</span>${(r.capacity||r.vehicle_capacity)?`<span><b>${r.capacity||r.vehicle_capacity}</b>台分</span>`:''}</div>`:'';
    const flags=lv?[lv.renting===false?'貸出停止中':'',lv.returning===false?'返却停止中':'',lv.installed===false?'未設置':''].filter(Boolean):[];
    body=av+(flags.length?`<div class="sp-warn">${flags.join('・')}</div>`:'')+`<dl class="sp-dl">${drow('住所',esc(i.addr||'')||(i.geo?esc(i.geo)+'<small style="display:block;color:var(--ink3);font-size:10px">位置からの推定</small>':''))}${drow('エリア',esc(i.region||''))}${drow('運営',esc(i.sys&&(i.sys.operator||i.sys.name)||''))}${drow('ポート番号',esc(i.code||''))}${drow('問合せ',i.raw&&i.raw.contact_phone?esc(i.raw.contact_phone.replace(/^\+810?/,'0')):'')}${drow('車種',lv&&lv.types.length?lv.types.map(t=>esc(t.n)+' '+t.c+'台').join('<br>'):'')}${drow('設置場所',PARK[r.parking_type]||'')}${drow('充電',r.is_charging_station?'充電ステーション':'')}${drow('ポートID',esc(m.feedId[1]))}${drow('座標',m.getLatLng().lat.toFixed(5)+', '+m.getLatLng().lng.toFixed(5))}${drow('更新',lv&&lv.at?hm(lv.at):'')}</dl>`;
  }else{const t=i.tags||{};
    body=`<dl class="sp-dl">${drow('住所',esc(i.addr||[t['addr:province'],t['addr:city'],t['addr:quarter'],t['addr:neighbourhood'],t['addr:block_number'],t['addr:housenumber']].filter(Boolean).join('')))}${drow('運営',esc(t.operator||t.brand||''))}${drow('台数',t.capacity?esc(t.capacity)+'台':'')}${drow('利用時間',esc(t.opening_hours||''))}${drow('駐車場',esc(t['parking']||t['location']||''))}${drow('備考',esc(t.description||t.note||''))}</dl>${i.tags&&!Object.keys(i.tags).length?'<div class="sp-sub">詳細情報は登録されていません</div>':''}`;
    if(!i.url&&t.website)i.url=t.website}
  return `<div class="sp-k"><i style="background:${L0.c}"></i>${L0.n}</div><div class="sp-n">${esc(i.name||'名称未登録')}</div>${body}${i.loading?'<div class="sp-load">最新の情報を取得中…</div>':''}${i.err?'<div class="sp-sub">詳細を取得できませんでした</div>':''}${(i.url||L0.home)?`<a class="sp-a" href="${esc(i.url||L0.home)}" target="_blank" rel="noopener">${i.url?'公式ページで開く':'公式サイトを開く'} ↗</a>`:''}`}
let sfT;function storesFront(){clearTimeout(sfT);sfT=setTimeout(()=>{st.list.forEach(x=>{if(layer.hasLayer(x.m))x.m.bringToFront()});if(typeof selRing!=='undefined'&&map.hasLayer(selRing))selRing.bringToFront()},0)}
function lyVisible(k){const L0=LY[k],ok=lyOn[k]&&st.tab==='map'&&map.getZoom()>=MINZ[L0.k];
  if(ok&&!map.hasLayer(L0.g)){L0.g.addTo(map);storesFront()}if(!ok&&map.hasLayer(L0.g))map.removeLayer(L0.g);
  if(lyOn[k]&&map.getZoom()<MINZ[L0.k])lyStatus(k,'拡大すると表示されます');else if(lyOn[k]&&L0.loaded&&L0.k==='bike')lyStatus(k,`${L0.pts.size.toLocaleString()}か所 · 空き状況 ${L0.upd||'—'}`)}

// ---- bike share (GBFS) ----
async function loadBike(k){const L0=LY[k];if(L0.loaded||L0.busy)return;L0.busy=true;lyStatus(k,'読み込み中…');
  try{for(const f of L0.feeds){const j=await (await fetch(GBFS+f+'/station_information.json')).json();
      j.data.stations.forEach(s=>{const cm=String(s.name).match(/^([A-Z]?\d+[-\d]*)\./);addSpot(k,f+':'+s.station_id,s.lat,s.lon,{code:cm?cm[1]:'',name:s.name.replace(/^[A-Z]?\d+[-\d]*\./,''),addr:s.address||'',url:s.rental_uris&&s.rental_uris.web||'',raw:s});const m=L0.pts.get(f+':'+s.station_id);if(m)m.feedId=[f,s.station_id]})}
    L0.loaded=true;await bikeStatus(k)}catch(e){lyStatus(k,'取得できませんでした')}
  L0.busy=false;lyVisible(k);storesFront()}
async function bikeStatus(k){const L0=LY[k];try{for(const f of L0.feeds){const j=await (await fetch(GBFS+f+'/station_status.json',{cache:'no-store'})).json();
    j.data.stations.forEach(s=>{const m=L0.pts.get(f+':'+s.station_id);if(!m)return;m.info.st={b:s.num_bikes_available,d:s.num_docks_available};m.setStyle({fillOpacity:s.num_bikes_available>0&&s.is_renting!==false?1:.3})})}
  const t=new Date();L0.upd=`${t.getHours()}:${String(t.getMinutes()).padStart(2,'0')}`;lyVisible(k)}catch(e){}}
setInterval(()=>{for(const k in LY)if(lyOn[k]&&LY[k].k==='bike'&&LY[k].loaded)bikeStatus(k)},60000);

// ---- car share: data/<key>.csv if provided, else OpenStreetMap by viewport ----
const carCells=new Set();let carBusy=false;
async function carCSV(k){const L0=LY[k];if(L0.csv!==null)return L0.csv;
  try{const r=await fetch(`data/${k}.csv`,{cache:'no-cache'});if(!r.ok)throw 0;const rows=parseCSV(await r.text());let n=0;
    rows.forEach((o,i)=>{const la=+pick(o,['lat','latitude','緯度']),lg=+pick(o,['lng','lon','longitude','経度']);if(!la||!lg)return;
      addSpot(k,'c'+i,la,lg,{name:String(pick(o,['name','名称','ステーション名'])||''),addr:String(pick(o,['address','住所'])||''),url:String(pick(o,['url'])||''),tags:{capacity:pick(o,['capacity','台数'])||'',opening_hours:pick(o,['hours','利用時間','営業時間'])||'',operator:LY[k].n,description:pick(o,['note','備考'])||''}});n++});
    L0.csv=n>0;if(n){L0.loaded=true;lyStatus(k,`${n.toLocaleString()}か所（同梱データ）`)}}catch(e){L0.csv=false}
  return L0.csv}
async function loadCar(){const ks=['times','dcar'].filter(k=>lyOn[k]&&LY[k].csv===false);if(!ks.length||carBusy||map.getZoom()<12)return;
  const C=.25,b=map.getBounds().pad(.1),need=[];
  for(let y=Math.floor(b.getSouth()/C);y<=Math.floor(b.getNorth()/C);y++)for(let x=Math.floor(b.getWest()/C);x<=Math.floor(b.getEast()/C);x++)if(!carCells.has(y+':'+x))need.push([y,x]);
  if(!need.length)return;const ys=need.map(c=>c[0]),xs=need.map(c=>c[1]),bb=`${Math.min(...ys)*C},${Math.min(...xs)*C},${(Math.max(...ys)+1)*C},${(Math.max(...xs)+1)*C}`;
  carBusy=true;ks.forEach(k=>lyStatus(k,'OpenStreetMapから読み込み中…'));
  try{let j=null,last;for(const ep of ENDPOINTS){const ac=new AbortController(),to=setTimeout(()=>ac.abort(),25000);
      try{const r=await fetch(ep,{method:'POST',body:'data='+encodeURIComponent(`[out:json][timeout:25];nwr["amenity"="car_sharing"](${bb});out center tags;`),signal:ac.signal});clearTimeout(to);if(!r.ok)throw new Error(r.status);j=await r.json();break}catch(e){clearTimeout(to);last=e}}
    if(!j)throw last;need.forEach(c=>carCells.add(c.join(':')));
    j.elements.forEach(e=>{const t=e.tags||{},la=e.lat??e.center?.lat,lg=e.lon??e.center?.lon;if(la==null)return;const s=[t.operator,t.brand,t.network,t.name,t['name:ja']].join(' ');
      for(const k of ['times','dcar'])if(LY[k].re.test(s))addSpot(k,'o'+e.id,la,lg,{name:t['name:ja']||t.name||'',addr:'',url:t.website||'',tags:t})});
    ks.forEach(k=>{LY[k].loaded=true;lyStatus(k,`${LY[k].pts.size.toLocaleString()}か所（OpenStreetMap・表示範囲）`)})}
  catch(e){ks.forEach(k=>lyStatus(k,'サーバー混雑中 · 地図を動かすと再試行'))}
  carBusy=false;ks.forEach(lyVisible);storesFront()}

// ---- UI ----
async function setLayer(k,on){lyOn[k]=on;localStorage.setItem(LKEY,JSON.stringify(lyOn));const L0=LY[k];
  if(!on){if(map.hasLayer(L0.g))map.removeLayer(L0.g);lyStatus(k,'');renderLyBtn();return}
  if(L0.k==='bike')loadBike(k);else{if(!(await carCSV(k)))loadCar()}
  lyVisible(k);renderLyBtn()}
function renderLyBtn(){const n=Object.keys(LY).filter(k=>lyOn[k]).length,b=document.getElementById('lyBtn');if(!b)return;
  b.classList.toggle('on',n>0);b.querySelector('b').textContent=n?`レイヤー ${n}`:'レイヤー';
  b.querySelector('.lydots').innerHTML=Object.keys(LY).filter(k=>lyOn[k]).map(k=>`<i style="background:${LY[k].c}"></i>`).join('')}
(function(){const btn=document.createElement('button');btn.className='chip';btn.id='lyBtn';btn.innerHTML='<span class="lydots"></span><b>レイヤー</b>';
  btn.className='fab lyfab';btn.title='レイヤー';btn.innerHTML='<span class="lydots"></span><b>レイヤー</b>';$('#app').appendChild(btn);
  const p=document.createElement('div');p.className='lyp';p.id='lyp';
  p.innerHTML=`<div class="lyp-h"><b>重ねて表示</b><button class="x" id="lypx" aria-label="閉じる"></button></div>
  <div class="lyp-g">カーシェア</div>${['times','dcar'].map(row).join('')}
  <div class="lyp-g">シェアサイクル<span>空き台数つき</span></div>${['hello','docomo'].map(row).join('')}
  <div class="lyp-f">シェアサイクル：公共交通オープンデータセンター（GBFS）／カーシェア：OpenStreetMap（登録分のみ。data/times.csv・data/dcar.csv があれば優先）</div>`;
  function row(k){return `<label class="lyr"><i style="background:${LY[k].c}"></i><span><b>${LY[k].n}</b><small id="ly-${k}">${LY[k].state}</small></span><input type="checkbox" ${lyOn[k]?'checked':''} data-k="${k}"><em></em></label>`}
  $('#app').appendChild(p);
  btn.onclick=e=>{e.stopPropagation();p.classList.toggle('show')};$('#lypx').onclick=()=>p.classList.remove('show');
  p.querySelectorAll('input').forEach(i=>i.onchange=()=>setLayer(i.dataset.k,i.checked));
  map.on('click',()=>p.classList.remove('show'));
  map.attributionControl.addAttribution('シェアサイクル: <a href="https://www.odpt.org/">ODPT</a>');
  renderLyBtn();for(const k in LY)if(lyOn[k])setLayer(k,true);
})();
map.on('zoomend',()=>{const r=spotRad();for(const k in LY)if(lyOn[k])LY[k].pts.forEach(m=>m.setRadius(r))});
map.on('moveend',()=>{for(const k in LY)if(lyOn[k])lyVisible(k);loadCar()});
const _setTab=setTab;setTab=function(t){_setTab(t);for(const k in LY)lyVisible(k)};

map.on('popupopen',()=>$('#app').classList.add('pop-open'));map.on('popupclose',()=>$('#app').classList.remove('pop-open'));
