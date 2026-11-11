// Transit style: washed base + vector rail lines/stations from 国土数値情報 (bundled in data/), coloured per line/company.
const T={on:false,ready:false,loading:false,lines:[],lo:[],idx:{},tiles:{},loadingT:{}};
const tRender=L.canvas({pane:'rail',padding:.4});
const tLines=L.layerGroup(),tStations=L.layerGroup();
const ATTR='鉄道: 国土数値情報（国土交通省）';
const LC={
 '東京地下鉄':{'銀座線':'#F39700','丸ノ内線':'#E60012','日比谷線':'#9CAEB7','東西線':'#00A7DB','千代田線':'#00BB85','有楽町線':'#C1A470','半蔵門線':'#8F76D6','南北線':'#00ADA9','副都心線':'#9C5E31'},
 '東京都':{'浅草線':'#E85298','三田線':'#0079C2','新宿線':'#6CBB5A','大江戸線':'#B6007A','荒川線':'#EE86A6','日暮里':'#C9147A'},
 '大阪市高速電気軌道':{'御堂筋線':'#E5171F','谷町線':'#522886','四つ橋線':'#0078BA','中央線':'#019A66','千日前線':'#E44D93','堺筋線':'#814721','長堀鶴見緑地線':'#A9CC51','今里筋線':'#EE7B1A','南港':'#00B2E5'},
 '名古屋市':{'東山線':'#FCC70D','名城線':'#7E318E','名港線':'#7E318E','鶴舞線':'#00A0DE','桜通線':'#D0104C','上飯田線':'#EE86A6'},
 '札幌市':{'南北線':'#008000','東西線':'#FF8000','東豊線':'#0080FF'},
 '福岡市':{'空港線':'#F48120','箱崎線':'#0072BC','七隈線':'#22AB5E'},
 '京都市':{'烏丸線':'#3CB371','東西線':'#E95C2A'},
 '神戸市':{'西神':'#2E8B57','山手':'#2E8B57','海岸線':'#0E8ECF'},
 '横浜市':{'1号線':'#0070C0','3号線':'#0070C0','4号線':'#00A040'},
 '仙台市':{'南北線':'#009B63','東西線':'#00A3D9'},
 '東日本旅客鉄道':{'山手線':'#80C241','中央線':'#F15A22','総武線':'#E6B800','京葉線':'#C9242F','武蔵野線':'#F15A22','南武線':'#E6B800','横浜線':'#80C241','常磐線':'#00B261','根岸線':'#00B2E5'},
 '西日本旅客鉄道':{'大阪環状線':'#E8341C','東西線':'#E26EA0','桜島線':'#00A0DE'}
};
const CO={'東日本旅客鉄道':'#3A9A55','東海旅客鉄道':'#F08300','西日本旅客鉄道':'#1E78C2','北海道旅客鉄道':'#4CB848','九州旅客鉄道':'#D7001B','四国旅客鉄道':'#00A3D9',
 '東急電鉄':'#DA0442','小田急電鉄':'#2288CC','京王電鉄':'#DD0077','西武鉄道':'#0A5BAA','東武鉄道':'#1E3D8F','京成電鉄':'#1A4C9C','京浜急行電鉄':'#E8334A','相模鉄道':'#1D2088',
 '阪急電鉄':'#7A1F2B','阪神電気鉄道':'#F39800','京阪電気鉄道':'#1B7F45','近畿日本鉄道':'#C8102E','南海電気鉄道':'#F07800','名古屋鉄道':'#E60012','西日本鉄道':'#D5007F',
 '山陽電気鉄道':'#B4141F','神戸電鉄':'#E2007A','北総鉄道':'#0068B7','首都圏新都市鉄道':'#C1272D','東京臨海高速鉄道':'#00418E','ゆりかもめ':'#1D73B8','東京モノレール':'#005BAC',
 '横浜高速鉄道':'#0C3A87','埼玉高速鉄道':'#0F6CB5','東葉高速鉄道':'#3BB54A','大阪高速鉄道':'#0068B7','北大阪急行電鉄':'#E5171F','泉北高速鉄道':'#0077C0','叡山電鉄':'#2F8F5B','京福電気鉄道':'#7B2C3B','広島電鉄':'#2C9F48','江ノ島電鉄':'#2D8E4E'};
const FB=['#5B7FA6','#8A6BB0','#3E8E7E','#B5793A','#A0566A','#6A8F3A','#4C7FBF','#9A5C3A'];
const SUBWAY=new Set(['東京地下鉄','東京都','大阪市高速電気軌道','名古屋市','札幌市','福岡市','京都市','神戸市','横浜市','仙台市']);
function colorOf(o,n,t){if(t===1)return'#2B4A8A';const m=LC[o];if(m)for(const k in m)if(n.includes(k))return m[k];if(CO[o])return CO[o];let h=0;for(const c of o)h=(h*31+c.charCodeAt(0))|0;return FB[Math.abs(h)%FB.length]}
const rank=l=>l.sub?3:l.t===1?2:l.t===2?0:1;
// 路線データは「全国の概略（rail-lo.json, 約120KB）」と「1度区画ごとの詳細（data/rail/区画.json）」に分けてあり、
// 縮尺11以上では画面に入っている区画だけを読み込む。
const LO_MAXZ=11,TS=1; // TS: 区画の大きさ（度）
const tLo=L.layerGroup();
const dec=a=>{const out=[];let la=0,lg=0;for(let j=0;j<a.length;j+=2){la+=a[j];lg+=a[j+1];out.push([la/1e5,lg/1e5])}return out};
function mkLines(byLine){const ls=[];for(const i in byLine){const l=T.lines[i];if(!l)continue;ls.push([l,byLine[i].map(dec)])}
  ls.sort((a,b)=>rank(a[0])-rank(b[0]));const out=[];
  ls.forEach(([l,segs])=>out.push([L.polyline(segs,{renderer:tRender,color:'#fff',opacity:1,interactive:false,lineCap:'round',lineJoin:'round'}),L.polyline(segs,{renderer:tRender,color:l.c,opacity:1,interactive:false,lineCap:'round',lineJoin:'round'}),l]));
  return out}
function grp(layers){const g=L.layerGroup();layers.forEach(([c])=>c.addTo(g));layers.forEach(([,c])=>c.addTo(g));return g}
async function tInit(){if(T.ready||T.loading)return;T.loading=true;tHint('路線図を読み込み中…');
  try{const[ls,lo,idx]=await Promise.all(['data/rail-lines.json','data/rail-lo.json','data/rail/index.json'].map(u=>fetch(u).then(r=>r.json())));
    T.lines=ls.map(([o,n,t,k])=>({o,n,t,k,c:colorOf(o,n,t),sub:SUBWAY.has(o)&&!/荒川線|上野懸垂/.test(n)}));T.idx=idx;
    const by={};lo.forEach((segs,i)=>{if(segs.length)by[i]=segs});T.lo=mkLines(by);grp(T.lo).addTo(tLo);
    T.ready=true;tHint('');tUpdate()}catch(e){tHint('路線図を読み込めませんでした')}
  T.loading=false}
function tKeys(){const b=map.getBounds().pad(.15),ks=[];for(let a=Math.floor(b.getSouth()/TS);a<=Math.floor(b.getNorth()/TS);a++)for(let o=Math.floor(b.getWest()/TS);o<=Math.floor(b.getEast()/TS);o++){const k=a+'_'+o;if(T.idx[k])ks.push(k)}return ks}
async function tLoad(k){if(T.tiles[k]||T.loadingT[k])return;T.loadingT[k]=true;
  try{const d=await (await fetch('data/rail/'+k+'.json')).json();const st=(d.s||[]).map(([n,la,lg,...l])=>({n,lat:la/1e5,lng:lg/1e5,l}));delete d.s;
    const layers=mkLines(d);T.tiles[k]={layers,g:grp(layers),st};tStyleSet(layers);tUpdate()}catch(e){}
  T.loadingT[k]=false}
function tUpdate(){if(!T.on||!T.ready)return;const z=map.getZoom();
  if(z<LO_MAXZ){tLo.addTo(map);for(const k in T.tiles)tLines.removeLayer(T.tiles[k].g);tStations.clearLayers();return}
  map.removeLayer(tLo);const ks=tKeys(),want=new Set(ks);
  for(const k in T.tiles){const g=T.tiles[k].g;if(want.has(k)){if(!tLines.hasLayer(g))tLines.addLayer(g)}else tLines.removeLayer(g)}
  if(ks.length>12)return; // 縮尺11付近で広域を見ているときは読み込みすぎない
  ks.forEach(k=>{if(!T.tiles[k])tLoad(k)});tDraw()}
function tW(){const z=map.getZoom();return z<10?1.6:z<12?2.6:z<14?3.6:z<16?5:7}
function tStyleSet(layers){const z=map.getZoom(),w=tW();layers.forEach(([cas,col,l])=>{const ww=l.t===1?w+.6:l.sub?w+.4:w;cas.setStyle({weight:ww+(z<11?1.5:3)});col.setStyle({weight:ww})})}
function tStyle(){tStyleSet(T.lo);for(const k in T.tiles)tStyleSet(T.tiles[k].layers)}
function tDraw(){tStations.clearLayers();if(!T.ready)return;const z=map.getZoom();if(z<13)return;
  const b=map.getBounds().pad(.1);let n=0;
  for(const k of tKeys()){const t=T.tiles[k];if(!t)continue;for(const s of t.st){if(!b.contains([s.lat,s.lng]))continue;const big=s.l.length>1;
    const m=L.circleMarker([s.lat,s.lng],{renderer:tRender,radius:big?(z>=15?6:4.5):(z>=15?4.5:3.2),color:'#22272b',weight:big?2.2:1.6,fillColor:'#fff',fillOpacity:1,interactive:false});
    if(z>=15&&n<160&&s.n){m.bindTooltip(s.n,{permanent:true,direction:'right',offset:[7,0],className:'st-label'});n++}
    else if(z>=14&&big&&n<160&&s.n){m.bindTooltip(s.n,{permanent:true,direction:'right',offset:[6,0],className:'st-label'});n++}
    m.addTo(tStations)}}}
let hintEl;function tHint(t){if(!hintEl){hintEl=document.createElement('div');hintEl.className='t-hint';$('#app').appendChild(hintEl)}hintEl.textContent=t;hintEl.style.opacity=t?1:0}
function transitOn(on){T.on=on;map.removeLayer(rail);
  if(on){tLines.addTo(map);tStations.addTo(map);map.attributionControl.addAttribution(ATTR);if(!T.ready)tInit();else{tStyle();tUpdate()}}
  else{map.removeLayer(tLines);map.removeLayer(tStations);map.removeLayer(tLo);map.attributionControl.removeAttribution(ATTR);tHint('')}}
map.on('zoomend',()=>{if(T.on&&T.ready)tStyle()});
map.on('moveend',()=>{if(T.on)tUpdate()});
if(st.mode==='transit')transitOn(true);
