// Real store data from OpenStreetMap (Overpass API). Loaded after app.html's main script; shares its globals.
const ENDPOINTS=['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter','https://maps.mail.ru/osm/tools/overpass/api/interpreter','https://overpass.private.coffee/api/interpreter'];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function fetchOverpass(){let last;
  for(let i=0;i<ENDPOINTS.length;i++){
    setSrc(`OpenStreetMapから取得中… (${i+1}/${ENDPOINTS.length})`,'busy');
    const ac=new AbortController(),to=setTimeout(()=>ac.abort(),60000);
    try{const r=await fetch(ENDPOINTS[i],{method:'POST',body:'data='+encodeURIComponent(OQ),signal:ac.signal});clearTimeout(to);
      if(!r.ok)throw new Error('HTTP '+r.status);const j=await r.json();if(!j.elements||!j.elements.length)throw new Error('empty');return j}
    catch(e){clearTimeout(to);last=e;if(i<ENDPOINTS.length-1)await sleep(800*2**i)}}
  throw last}
const OQ='[out:json][timeout:90];area["ISO3166-1"="JP"][admin_level=2]->.jp;nwr["brand:wikidata"="Q37158"](area.jp);out center tags;';
const CACHE='meguri-osm-cache-v1',TTL=6*3600e3;
const CITIES=PREFS.flatMap(p=>p.cities.map(c=>({...c,p})));
function nearest(lat,lng){let b=null,bd=1e9;const k=Math.cos(lat*Math.PI/180);for(const c of CITIES){const d=(c.lat-lat)**2+((c.lng-lng)*k)**2;if(d<bd){bd=d;b=c}}return b}
function parseOH(oh){if(!oh)return null;if(/24\/7/.test(oh))return['0:00','24:00'];const m=oh.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);return m?[m[1],m[2]]:null}
function fromOSM(e){const t=e.tags||{},lat=e.lat??e.center?.lat,lng=e.lon??e.center?.lon;if(lat==null)return null;
  const c=nearest(lat,lng),pv=(t['addr:province']||'').replace(/[都府県]$/,'');const p=PREFS.find(x=>x.n===pv)||c.p;
  let nm=t['branch:ja']||t.branch||(t['name:ja']||t.name||'').replace(/スターバックス\s*コーヒー|スターバックス|Starbucks\s*Coffee|Starbucks/gi,'').trim();
  nm=nm?(/店$/.test(nm)?nm:nm+'店'):'店舗名未登録';const h=parseOH(t.opening_hours);
  const ad=t['addr:full']||['addr:province','addr:city','addr:suburb','addr:quarter','addr:neighbourhood','addr:block_number','addr:housenumber'].map(k=>t[k]||'').join('');
  return{id:'o'+e.type[0]+e.id,name:nm,pref:p.n,region:p.r,city:t['addr:city']||c.n,lat,lng,addr:ad||'住所情報なし（OSM未登録）',open:h&&h[0],close:h&&h[1],hoursRaw:t.opening_hours||''}}
function setSrc(txt,cls){$('#src').textContent=txt;$('#srcbar').className='src '+(cls||'');const b=$('#reload');if(b)b.disabled=cls==='busy'}
async function loadReal(force){
  setSrc('OpenStreetMapから取得中…','busy');let d=null;
  try{const c=JSON.parse(localStorage.getItem(CACHE)||'null');if(!force&&c&&Date.now()-c.t<TTL)d=c}catch(e){}
  if(!d){try{const j=await fetchOverpass();d={t:Date.now(),list:j.elements.map(fromOSM).filter(Boolean)};try{localStorage.setItem(CACHE,JSON.stringify(d))}catch(e){}}
    catch(e){const real=STORES[0]&&STORES[0].id[0]!=='s';setSrc(real?'取得失敗 · 前回のデータを表示中':'公開サーバー混雑中 · ダミー表示（自動で再試行）');
      toast('公開データのサーバーが混雑中です。2分後に自動で再試行します（ファイル読込も可）');
      if(retries++<3){clearTimeout(retryT);retryT=setTimeout(()=>loadReal(true),120000)}return}}
  applyList(d.list,'osm',d.t);if(force)toast(`最新データ ${TOTAL.toLocaleString()}店を読み込みました`);
}
let retries=0,retryT;
function applyList(list,src,t){
  if(list.length<1){toast('店舗データが見つかりませんでした');return}
  layer.clearLayers();STORES.length=0;Object.keys(BY).forEach(k=>delete BY[k]);Object.keys(PC).forEach(k=>delete PC[k]);
  list.forEach(s=>{s.m=L.circleMarker([s.lat,s.lng]).on('click',()=>onMarker(s));STORES.push(s);BY[s.id]=s;PC[s.pref]=(PC[s.pref]||0)+1});
  TOTAL=STORES.length;PF.forEach(s=>{STORES.push(s);BY[s.id]=s});
  KEY=src==='osm'?'meguri-visited-osm':src==='bundled'?'meguri-visited-official':'meguri-visited-file';try{visited=JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch(e){visited={}}
  Object.keys(visited).forEach(id=>{if(id[0]==='p')delete visited[id]});Object.assign(visited,loadPFV());
  Object.keys(visited).forEach(id=>{if(!BY[id])delete visited[id]});
  calcDist();closeDetail();fillPref();applyFilter(!!st.pref);if(st.tab==='book')renderBook();
  const tm=new Date(t),ts=`${tm.getMonth()+1}/${tm.getDate()} ${tm.getHours()}:${String(tm.getMinutes()).padStart(2,'0')}`;
  setSrc(src==='osm'?`© OpenStreetMap contributors · ${TOTAL.toLocaleString()}店 · ${ts}取得`:src==='bundled'?`店舗 ${TOTAL.toLocaleString()}店（同梱CSV ${ts}更新）· ポケふた ${PF.length}枚`:`ファイル「${src}」· ${TOTAL.toLocaleString()}店 · ${ts}読込`,'live');
}
async function loadBundled(manual){try{setSrc('店舗データを読み込み中…','busy');const r=await fetch('data/stores.csv',{cache:'no-cache'});if(!r.ok)throw 0;
  const t=Date.parse(r.headers.get('last-modified')||'')||Date.now(),l=parseCSV(await r.text()).map(fromRow).filter(Boolean);if(l.length<10)throw 0;
  clearTimeout(retryT);applyList(l,'bundled',t);if(manual)toast(`店舗データ ${l.length.toLocaleString()}店を読み込みました`);return true}catch(e){return false}}
$('#reload').onclick=()=>loadBundled(true).then(ok=>{if(!ok)loadReal(true)});
loadBundled().then(ok=>{if(!ok)loadReal(false)});

// ---------- file import (CSV / JSON / GeoJSON) ----------
const pick=(o,ks)=>{for(const k of ks){const f=Object.keys(o).find(x=>x.trim().toLowerCase()===k);if(f&&o[f]!==''&&o[f]!=null)return o[f]}};
function parseCSV(t){const rows=[];let r=[],f='',q=false;t=t.replace(/^\ufeff/,'');
  for(let i=0;i<t.length;i++){const c=t[i];if(q){if(c==='"'){if(t[i+1]==='"'){f+='"';i++}else q=false}else f+=c}
    else if(c==='"')q=true;else if(c===','){r.push(f);f=''}else if(c==='\n'||c==='\r'){if(c==='\r'&&t[i+1]==='\n')i++;r.push(f);rows.push(r);r=[];f=''}else f+=c}
  if(f||r.length){r.push(f);rows.push(r)}const hd=rows.shift()||[];return rows.filter(x=>x.length>1).map(x=>Object.fromEntries(hd.map((k,i)=>[k,x[i]])))}
const DW='日月火水木金土';
function dayset(lb){lb=lb.replace(/\s/g,'');const d=new Set();if(/平日/.test(lb))[1,2,3,4,5].forEach(x=>d.add(x));if(/土日/.test(lb)){d.add(0);d.add(6)}
  lb.replace(/([日月火水木金土])[～~\-]([日月火水木金土])/g,(m,a,b)=>{let i=DW.indexOf(a);const e=DW.indexOf(b);for(let k=0;k<7;k++){d.add(i);if(i===e)break;i=(i+1)%7}return ''}).replace(/[日月火水木金土]/g,c=>{d.add(DW.indexOf(c));return ''});return d}
function parseJP(str,date){if(!str)return null;const z=String(str).replace(/[０-９：]/g,c=>String.fromCharCode(c.charCodeAt(0)-0xFEE0)).replace(/翌\s*(\d{1,2}):/g,(m,h)=>(+h+24)+':');
  const re=/(?:([^\d：:]*?)[：:]\s*)?(\d{1,2}:\d{2})\s*[～~〜\-－]\s*(\d{1,2}:\d{2})/g;const segs=[];let m;while((m=re.exec(z)))segs.push({lb:(m[1]||'').trim(),o:m[2],c:m[3]});
  if(!segs.length)return null;const wd=(date||new Date()).getDay();const hit=segs.find(x=>x.lb&&dayset(x.lb).has(wd));const g=hit||segs.find(x=>!x.lb)||segs[0];
  const c=g.c.split(':');return[g.o,(+c[0]%24)+':'+c[1]]}
var fmtHours=h=>String(h||'').replace(/\s*([月火水木金土日平祝][^\d：:]{0,6}[：:])/g,'\n$1').trim();
function fromRow(o,i){const lat=+pick(o,['lat','latitude','緯度','y']),lng=+pick(o,['lng','lon','long','longitude','経度','x']);if(!isFinite(lat)||!isFinite(lng)||!lat)return null;
  const c=nearest(lat,lng),pv=String(pick(o,['pref','prefecture','都道府県'])||(String(pick(o,['address','addr','住所'])||'').match(/^(東京都|北海道|京都府|大阪府|.{2,3}?県)/)||[''])[0]).replace(/[都府県]$/,'');const p=PREFS.find(x=>x.n===pv)||c.p;
  let nm=String(pick(o,['name','store','店舗名','名称','店名'])||'店舗'+(i+1)).replace(/スターバックス\s*コーヒー|スターバックス|Starbucks\s*Coffee|Starbucks/gi,'').trim();if(!/店$/.test(nm))nm+='店';
  const hr=String(pick(o,['opening_hours','hours','営業時間'])||'');let op=pick(o,['open','開店']),cl=pick(o,['close','閉店']);if(!op){const h=parseJP(hr)||parseOH(hr);if(h){op=h[0];cl=h[1]}}
  const flag=k=>{const v=pick(o,[k]);return v===undefined?null:String(v).trim()==='1'};
  const sid=pick(o,['id','store_number','店舗番号']),ad0=String(pick(o,['address','addr','住所'])||''),cm=ad0.replace(/^(東京都|北海道|京都府|大阪府|.{2,3}?県)/,'').match(/^(.+?[市区町村])/);
  return{no:sid!=null?String(sid):'',dt:flag('drive_thru'),url:String(pick(o,['url','公式url'])||(sid!=null&&/^\d+$/.test(String(sid))?`https://store.starbucks.co.jp/detail-${sid}/`:'')),id:sid!=null?'b'+sid:'f'+i,name:nm,pref:p.n,region:p.r,city:String(pick(o,['city','市区町村'])||(cm&&cm[1])||c.n),lat,lng,addr:String(pick(o,['address','addr','住所'])||'住所情報なし'),open:op||null,close:cl||null,hoursRaw:hr}}
async function importFile(file){try{const txt=await file.text();let rows;
  if(/\.csv$/i.test(file.name))rows=parseCSV(txt);else{const j=JSON.parse(txt);rows=j.type==='FeatureCollection'?j.features.map(f=>({...f.properties,lng:f.geometry.coordinates[0],lat:f.geometry.coordinates[1]})):Array.isArray(j)?j:(j.stores||j.elements||[]);
    if(rows[0]&&rows[0].tags){const l=rows.map(fromOSM).filter(Boolean);clearTimeout(retryT);applyList(l,file.name,Date.now());toast(`${l.length.toLocaleString()}店を読み込みました`);return}}
  const l=rows.map(fromRow).filter(Boolean);if(!l.length)throw new Error('no rows');clearTimeout(retryT);applyList(l,file.name,Date.now());toast(`${l.length.toLocaleString()}店を読み込みました`)}
  catch(e){toast('読み込めませんでした。緯度・経度・店舗名の列があるCSV/JSONを選んでください')}}
const fin=document.createElement('input');fin.type='file';fin.accept='.csv,.json,.geojson';fin.style.display='none';document.body.appendChild(fin);
fin.onchange=()=>{if(fin.files[0])importFile(fin.files[0]);fin.value=''};
const fb=document.createElement('button');fb.textContent='ファイル読込';fb.onclick=()=>fin.click();
const wrap=document.createElement('span');wrap.style.cssText='display:flex;gap:12px;flex:none';const rb=$('#reload');rb.replaceWith(wrap);wrap.append(fb,rb);
