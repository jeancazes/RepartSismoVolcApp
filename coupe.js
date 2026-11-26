/* Outil « Coupe » : coupe topographique + séismes + volcans le long d'une ligne tracée sur la carte plane.
   Relief : data/relief.bin (ETOPO NOAA, grille 0,25°, int16 little-endian, 721 lignes sud→nord × 1441 colonnes −180→180).
   Bloc 3D : three.js (chargé à la demande). */
(function(){
'use strict';
var A=window.APP;if(!A||!A.CPK)return;
var K=A.CPK,S=A.S;
var $=function(s){return document.querySelector(s)};
var R=6371,D2R=Math.PI/180;
var THREE_URL='https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';

var st={on:false,mode:'idle',a:null,b:null,w:300,view:'none',maxD:700,exag:1,rel:5,uni:true,struct:'',trans:true,zoom3:1,drag:null,data:null,h:null,dirty:false};
var btn=$('#btn-cp'),menu=$('#cp-menu'),gr=$('#cp-graph'),cvg=$('#cp-cv'),wrap3=$('#cp-3dw'),tip=$('#cp-tip'),cap=$('#cp-cap');
if(!btn||!menu||!gr||!cvg)return;
var cv=K.cv;

/* ---------- relief ---------- */
var RN=721,RM=1441,relief=null,reliefP=null;
function loadRelief(){
  if(relief)return Promise.resolve(relief);
  if(reliefP)return reliefP;
  reliefP=fetch('data/relief.bin').then(function(r){if(!r.ok)throw new Error('relief');return r.arrayBuffer()}).then(function(b){
    var dv=new DataView(b),n=b.byteLength>>1,a=new Int16Array(n);for(var i=0;i<n;i++)a[i]=dv.getInt16(i*2,true);
    if(n!==RN*RM)throw new Error('relief taille');relief=a;return a}).catch(function(e){reliefP=null;throw e});
  return reliefP;
}
function elev(lon,lat){
  if(!relief)return 0;
  var x=((lon+180)%360+360)%360/0.25,y=(Math.max(-90,Math.min(90,lat))+90)/0.25;
  var x0=Math.floor(x),y0=Math.min(RN-2,Math.floor(y)),fx=x-x0,fy=y-y0,x1=(x0+1)%RM;x0=x0%RM;
  var a=relief[y0*RM+x0],b=relief[y0*RM+x1],c=relief[(y0+1)*RM+x0],d=relief[(y0+1)*RM+x1];
  return (a*(1-fx)+b*fx)*(1-fy)+(c*(1-fx)+d*fx)*fy;
}

/* ---------- structure interne : croûte, lithosphère ---------- */
var SC={crust:'#8a4b1f',um:'#5f9e3e',lm:'#2f4f3a',lith:'#2a62c4',ast:'#ff9a1f',lm2:'#8d3b5c'};
var crust=null,crustP=null;
function loadCrust(){
  if(crust)return Promise.resolve();if(crustP)return crustP;
  crustP=fetch('data/crust.bin').then(function(r){if(!r.ok)throw 0;return r.arrayBuffer()}).then(function(b){var a=new Uint8Array(b);if(a.length!==64800)throw 0;crust=a}).catch(function(){crustP=null});
  return crustP;
}
function ensureCrust(){return (st.struct&&S.level==='adv')?loadCrust():Promise.resolve()}
function mohoAdv(lon,lat){
  var x=((lon+180)%360+360)%360-.5,y=Math.max(0,Math.min(178.999,90-Math.max(-89.5,Math.min(89.5,lat))-.5));
  var x0=Math.floor(x),fx=x-x0,y0=Math.floor(y),fy=y-y0,xa=((x0%360)+360)%360,xb=(xa+1)%360;
  var a=crust[y0*360+xa],b=crust[y0*360+xb],c=crust[(y0+1)*360+xa],d=crust[(y0+1)*360+xb];
  return ((a*(1-fx)+b*fx)*(1-fy)+(c*(1-fx)+d*fx)*fy)/2;
}
function smoothArr(a,win,passes){var n=a.length,b=new Float32Array(n);win=Math.max(1,win|0);for(var p=0;p<passes;p++){for(var i=0;i<n;i++){var s=0,c=0;for(var k=-win;k<=win;k++){var j=i+k;if(j>=0&&j<n){s+=a[j];c++}}b[i]=s/c}a.set(b)}}
function sm(x){x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)}
/* e : altitude en m ; renvoie l'épaisseur de la croûte (th) et de la lithosphère (lt), en km, comptées depuis la surface */
function layersAt(lon,lat,e){
  var hs=-e/1000,moho,w,th;
  if(S.level==='adv'&&crust){moho=mohoAdv(lon,lat);th=moho-hs;w=sm((th-12)/18)}
  else{w=sm((e+2000)/1800);th=7+28*w}
  th=Math.max(3,th);
  var dd=Math.max(hs,2.6),age=Math.pow((dd-2.6)/.35,2),tO=Math.max(8,Math.min(100,10*Math.sqrt(age)));
  var lt=(1-w)*tO+w*(150-Math.min(0,hs));
  if(!(S.level==='adv'&&crust))lt=70*(1-w)+130*w;
  return {th:th,lt:Math.max(lt,th+6)};
}
/* ---------- géométrie sphérique ---------- */
function vec(lon,lat){var l=lon*D2R,p=lat*D2R,c=Math.cos(p);return [c*Math.cos(l),c*Math.sin(l),Math.sin(p)]}
function cr(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]}
function dt(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]}
function ln(a){return Math.sqrt(dt(a,a))}
function sc(a,k){return [a[0]*k,a[1]*k,a[2]*k]}
function ad(a,b){return [a[0]+b[0],a[1]+b[1],a[2]+b[2]]}
function toLL(v){var l=ln(v);return [Math.atan2(v[1],v[0])/D2R,Math.asin(Math.max(-1,Math.min(1,v[2]/l)))/D2R]}
function norm180(l){return ((l+180)%360+360)%360-180}
function frame(a,b){
  var A0=vec(a[0],a[1]),B0=vec(b[0],b[1]),c=cr(A0,B0),s=ln(c);if(s<1e-4)return null;
  var n=sc(c,1/s),t=cr(n,A0);return {A:A0,n:n,t:t,L:Math.atan2(s,dt(A0,B0))*R};
}
function pt(f,s,x){var g=s/R,d=x/R,P=ad(sc(f.A,Math.cos(g)),sc(f.t,Math.sin(g)));P=ad(sc(P,Math.cos(d)),sc(f.n,Math.sin(d)));return toLL(P)}
/* sens de lecture : ouest→est (ou sud→nord si la coupe est plutôt nord-sud) */
function ordered(){
  var a=st.a,b=st.b;if(!a||!b)return null;
  var dl=norm180(b[0]-a[0]),dla=b[1]-a[1],dx=dl*Math.cos((a[1]+b[1])/2*D2R);
  var sw=Math.abs(dx)>=Math.abs(dla)?dx<0:dla<0;
  return sw?[b,a]:[a,b];
}

/* ---------- fosses océaniques ---------- */
var TR_NAMES=[['Fosse des Mariannes',143,13],['Fosse du Japon',143.5,38],['Fosse d\'Izu-Bonin',142,28],['Fosse des Ryukyu',128,26],['Fosse des Kouriles',151,45],['Fosse des Aléoutiennes',-175,51],['Fosse d\'Alaska',-152,56],['Cascadia',-125,45],['Fosse d\'Amérique centrale',-93,13],['Fosse du Pérou-Chili',-72,-23],['Fosse du Pérou',-80,-10],['Fosse des Philippines',127,10],['Fosse de la Sonde (Java)',108,-10],['Fosse de Sumatra',96,2],['Fosse de Tonga',-174,-22],['Fosse des Kermadec',-176,-31],['Fosse du Vanuatu',167,-17],['Fosse des Salomon',157,-8],['Fosse de Nouvelle-Bretagne',153,-6],['Fosse de Porto Rico',-66,19.5],['Fosse des Petites Antilles',-60,15],['Fosse des Sandwich du Sud',-26,-58],['Fosse hellénique',23,35],['Fosse de Makran',60,25]];
var trV=null,trSrc=null;
function trLines(){
  var ls=K.trenchLines();if(trV&&trSrc===ls)return trV;
  trSrc=ls;trV=ls.map(function(l){return l.map(function(p){var v=vec(p[0],p[1]);return [v[0],v[1],v[2],p[0],p[1]]})});return trV;
}
function hav(a,b){var dl=(b[1]-a[1])*D2R,dn=(b[0]-a[0])*D2R,h=Math.sin(dl/2)*Math.sin(dl/2)+Math.cos(a[1]*D2R)*Math.cos(b[1]*D2R)*Math.sin(dn/2)*Math.sin(dn/2);return 2*R*Math.asin(Math.min(1,Math.sqrt(h)))}
function trenchCross(f){
  var out=[];
  trLines().forEach(function(l){
    for(var i=0;i<l.length-1;i++){
      var p=l[i],q=l[i+1];if(Math.abs(p[3]-q[3])>180)continue;
      var x1=p[0]*f.n[0]+p[1]*f.n[1]+p[2]*f.n[2],x2=q[0]*f.n[0]+q[1]*f.n[1]+q[2]*f.n[2];
      if(x1===x2||x1*x2>0)continue;
      var t=x1/(x1-x2),P=[p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t,p[2]+(q[2]-p[2])*t];
      var a=dt(P,f.A);if(a<=0)continue;
      var s=Math.atan2(dt(P,f.t),a)*R;if(s<0||s>f.L)continue;
      out.push({s:s,ll:toLL(P)});
    }
  });
  out.sort(function(a,b){return a.s-b.s});
  var res=[];out.forEach(function(o){if(res.length&&o.s-res[res.length-1].s<80)return;
    var best='Fosse océanique',bd=800;TR_NAMES.forEach(function(n){var d=hav(o.ll,[n[1],n[2]]);if(d<bd){bd=d;best=n[0]}});o.name=best;res.push(o)});
  return res;
}

/* ---------- calcul de la coupe ---------- */
function compute(){
  var o=ordered();if(!o){st.data=null;return}
  var f=frame(o[0],o[1]);if(!f){st.data=null;return}
  var N=Math.max(80,Math.min(720,Math.round(f.L/3))),el=new Float32Array(N+1),ll=[];
  var thA=new Float32Array(N+1),ltA=new Float32Array(N+1),simple=!(S.level==='adv'&&crust);
  for(var i=0;i<=N;i++){var p=pt(f,f.L*i/N,0);ll.push(p);el[i]=elev(p[0],p[1]);var Ls=layersAt(p[0],p[1],el[i]);thA[i]=Ls.th;ltA[i]=Ls.lt}
  if(simple){smoothArr(thA,Math.round(N/16),3);smoothArr(ltA,Math.round(N/16),3)}
  var hw=st.w/2,sinHw=Math.sin(hw/R)+1e-9,L=K.lists(),qs=[],vs=[];
  L.q.forEach(function(q){
    var P=vec(q.lon,q.lat),x=dt(P,f.n);if(Math.abs(x)>sinHw)return;
    var s=Math.atan2(dt(P,f.t),dt(P,f.A))*R;if(s<0||s>f.L)return;
    qs.push({s:s,x:Math.asin(Math.max(-1,Math.min(1,x)))*R,d:Math.max(0,q.depth||0),m:q.mag,c:K.qColor(q),q:q});
  });
  L.v.forEach(function(v){
    var P=vec(v.lon,v.lat),x=dt(P,f.n);if(Math.abs(x)>sinHw)return;
    var s=Math.atan2(dt(P,f.t),dt(P,f.A))*R;if(s<0||s>f.L)return;
    vs.push({s:s,x:Math.asin(Math.max(-1,Math.min(1,x)))*R,e:elev(v.lon,v.lat),c:K.vcol(v),v:v});
  });
  qs.sort(function(a,b){return a.m-b.m});
  var trs=trenchCross(f);
  var mx=-1e9,mn=1e9;for(i=0;i<=N;i++){if(el[i]>mx)mx=el[i];if(el[i]<mn)mn=el[i]}
  st.data={f:f,o:o,N:N,el:el,th:thA,lt:ltA,ll:ll,qs:qs,vs:vs,tr:S.layers.trench?trs:[],trAll:trs,L:f.L,mx:mx,mn:mn};
  
  updSum();
}

/* ---------- interface du menu ---------- */
function updSum(){
  var d=st.data,s=$('#cp-sum');if(!s)return;
  if(!d){s.textContent='';return}
  var lq=S.layers.quakes?'':' (couche Séismes désactivée)',lv=S.layers.volc?'':' (couche Volcans désactivée)';
  s.innerHTML='Coupe de <b>'+Math.round(d.L)+' km</b> · bande de <b>'+Math.round(st.w)+' km</b><br><b>'+d.qs.length+'</b> séisme'+(d.qs.length>1?'s':'')+lq+' · <b>'+d.vs.length+'</b> volcan'+(d.vs.length>1?'s':'')+lv;
}
function setHint(){
  var h=$('#cp-hint');
  if(st.mode==='draw')h.textContent='Zoome sur la zone, puis trace une ligne sur la carte (glisser-déposer).';
  else if(st.mode==='edit')h.textContent='Déplace A et B (orientation, longueur), la ligne (position) ou les carrés (largeur).';
  else h.textContent='';
  menu.classList.toggle('has-sel',!!(st.a&&st.b&&st.mode==='edit'));
  $('#cp-go').disabled=!(st.a&&st.b&&st.mode==='edit'&&frame(st.a,st.b));
  $('#cp-sel').classList.toggle('on',st.mode==='draw');
  [['#cp-cm',st.struct==='crust'],['#cp-la',st.struct==='lith']].forEach(function(p){var b=$(p[0]);b.classList.toggle('on',p[1]);b.setAttribute('aria-pressed',p[1]?'true':'false')});
  $('#cp-wl').hidden=!(st.a&&st.b&&st.mode==='edit');
  $('#cp-wo').textContent=Math.round(st.w)+' km';$('#cp-w').value=st.w;$('#cp-e').value=st.exag;$('#cp-r').value=st.rel;$('#cp-ro').textContent='×'+st.rel;$('#cp-tr').textContent=st.trans?'Opaque':'Transparent';
  $('#cp-eo').parentNode.hidden=(st.view==='3d');
  $('#cp-eo').textContent='×'+(+st.exag).toFixed(1).replace('.0','');
  cv.parentNode.classList.toggle('cp-draw',st.mode==='draw');
}
function open(){
  if(st.on)return;st.on=true;
  if(S.mode!=='flat'){var b=document.querySelector('#proj-seg [data-p="flat"]');if(b)b.click()}
  document.body.classList.add('cp-on');menu.hidden=false;btn.classList.add('on');btn.setAttribute('aria-pressed','true');
  var g=document.querySelector('#proj-seg [data-p="globe"]');if(g)g.disabled=true;
  loadRelief().catch(function(){});
  st.mode=st.a&&st.b?'edit':'draw';setHint();K.dirty();
}
function close(){
  if(!st.on)return;st.on=false;st.mode='idle';st.drag=null;
  stop3d();document.body.classList.remove('cp-on','cp-graph');menu.hidden=true;gr.hidden=true;st.view='none';
  btn.classList.remove('on');btn.setAttribute('aria-pressed','false');
  var g=document.querySelector('#proj-seg [data-p="globe"]');if(g)g.disabled=false;
  cv.parentNode.classList.remove('cp-draw');K.dirty();
}
btn.onclick=function(){st.on?close():open()};
$('#cp-close').onclick=close;
$('#cp-sel').onclick=function(){st.mode='draw';st.a=st.b=null;st.data=null;$('#cp-sum').textContent='';setHint();K.dirty()};
$('#cp-w').oninput=function(){st.w=+this.value;setHint();refresh(true);K.dirty()};
$('#cp-e').oninput=function(){st.exag=+this.value;setHint();redraw()};
$('#cp-r').oninput=function(){st.rel=+this.value;setHint();redraw()};
$('#cp-png').onclick=exportPng;
function setStruct(v){st.struct=(st.struct===v)?'':v;applyStruct()}
function applyStruct(){ensureCrust().then(function(){if(st.a&&st.b&&frame(st.a,st.b)){compute()}setHint();legend();if(st.view!=='none')redraw()})}
$('#cp-cm').onclick=function(){setStruct('crust')};
$('#cp-la').onclick=function(){setStruct('lith')};
function legItems(){
  var a=[];
  if(st.struct==='crust')a=[[SC.crust,'Croûte (épaisseur en km)'],[SC.um,'Manteau supérieur (jusqu\'à 660 km)'],[SC.lm,'Manteau inférieur']];
  else if(st.struct==='lith')a=[[SC.lith,'Lithosphère (rigide)'],[SC.ast,'Asthénosphère (jusqu\'à 660 km)'],[SC.lm2,'Manteau inférieur']];
  return a;
}
function legNote(){return st.struct==='lith'?'épaisseurs schématiques':(st.struct==='crust'?(S.level==='adv'&&crust?'données CRUST1.0':'modèle simplifié'):'')}
function legend(){
  var el=$('#cp-leg'),a=legItems();
  document.body.classList.toggle('cp-3d-on',st.view==='3d');
  if(!a.length||st.view==='none'){el.hidden=true;return}
  el.innerHTML=a.map(function(x){return '<div><i style="background:'+x[0]+'"></i>'+x[1]+'</div>'}).join('')+(legNote()?'<small>'+legNote()+'</small>':'');el.hidden=false;
}
$('#lv-seg').addEventListener('click',function(){setTimeout(function(){if(st.on&&st.struct)applyStruct()},30)});
$('#cp-go').onclick=function(){
  Promise.all([loadRelief(),ensureCrust()]).then(function(){showGraph('2d')}).catch(function(){$('#cp-hint').textContent='Relief indisponible (data/relief.bin).'});
};
$('#cp-3d').onclick=function(){
  if(st.view==='3d'){showGraph('2d');return}
  showGraph('3d');
};

function showGraph(v){
  st.view=v;st.scroll=0;document.body.classList.add('cp-graph');gr.hidden=false;$('#cp-opts').hidden=false;
  cvg.hidden=v!=='2d';wrap3.hidden=v!=='3d';$('#cp-sw').hidden=$('#cp-tr').hidden=$('#cp-zi').hidden=$('#cp-zo').hidden=v!=='3d';
  $('#cp-3d').textContent=v==='3d'?'Retour à la coupe 2D':'Bloc 3D';
  $('#cp-3d').classList.toggle('on',v==='3d');setHint();legend();if(v!=='3d')cap.textContent='';
  compute();
  if(v==='2d'){stop3d();requestAnimationFrame(draw2d)}else start3d();
  setTimeout(K.resize,60);
}
function refresh(live){
  if(st.view==='none'){compute();return}
  compute();redraw();
}
function redraw(){if(st.view==='2d')draw2d();else if(st.view==='3d')build3d()}
window.addEventListener('resize',function(){if(st.view==='2d')draw2d()});
if(window.ResizeObserver)new ResizeObserver(function(){if(st.view==='2d')draw2d();else if(st.view==='3d')fit3d()}).observe(gr);

/* ---------- tracé sur la carte ---------- */
var hm=[];
function unwrapPts(ps,world){
  var out=[],px=null;
  ps.forEach(function(p){var x=p[0];if(px!==null)x-=Math.round((x-px)/world)*world;px=x;out.push([x,p[1]])});
  return out;
}
function drawMap(c){
  if(!st.on||!st.a||!st.b)return;
  if(S.mode!=='flat'){close();return}
  var proj=K.proj();if(!proj)return;
  var f=frame(st.a,st.b);
  var pa=proj(st.a),pb=proj(st.b);if(!pa||!pb)return;
  var COL=K.COL(),world=2*Math.PI*proj.scale();
  c.save();
  if(f){
    var n=Math.max(8,Math.min(60,Math.round(f.L/60))),hw=st.w/2,left=[],right=[],mid=[];
    for(var i=0;i<=n;i++){var s=f.L*i/n;left.push(proj(pt(f,s,hw)));right.push(proj(pt(f,s,-hw)));mid.push(proj(pt(f,s,0)))}
    left=unwrapPts(left,world);right=unwrapPts(right,world);mid=unwrapPts(mid,world);
    // recale sur le point A projeté (le dépliage part du premier point)
    var dx=pa[0]-mid[0][0];dx=Math.round(dx/world)*world;
    function sh(a){return a.map(function(p){return [p[0]+dx,p[1]]})}
    left=sh(left);right=sh(right);mid=sh(mid);
    c.beginPath();left.forEach(function(p,k){k?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1])});
    for(var j=right.length-1;j>=0;j--)c.lineTo(right[j][0],right[j][1]);c.closePath();
    c.fillStyle=COL.accent;c.globalAlpha=.16;c.fill();c.globalAlpha=1;
    c.lineWidth=1.4;c.strokeStyle=COL.accent;c.setLineDash([5,4]);c.stroke();c.setLineDash([]);
    c.beginPath();mid.forEach(function(p,k){k?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1])});
    c.lineWidth=2.4;c.strokeStyle=COL.accent;c.stroke();
    var mi=mid[Math.floor(n/2)];
    var wl=left[Math.floor(n/2)],wr=right[Math.floor(n/2)];
    var pb2=mid[n];
    st.h={a:[mid[0][0],mid[0][1]],b:[pb2[0],pb2[1]],wl:wl,wr:wr,mid:mid};
    if(st.mode==='edit'){
      [wl,wr].forEach(function(p){c.fillStyle=COL.panel;c.strokeStyle=COL.accent;c.lineWidth=2;c.fillRect(p[0]-5,p[1]-5,10,10);c.strokeRect(p[0]-5,p[1]-5,10,10)});
    }
  }else{
    st.h={a:pa,b:pb,wl:null,wr:null,mid:[pa,pb]};
    c.beginPath();c.moveTo(pa[0],pa[1]);c.lineTo(pb[0],pb[1]);c.lineWidth=2;c.strokeStyle=COL.accent;c.stroke();
  }
  var H=st.h;
  [['A',H.a],['B',H.b]].forEach(function(e){
    var p=e[1];c.beginPath();c.arc(p[0],p[1],10,0,6.2832);c.fillStyle=COL.accent;c.fill();c.lineWidth=2;c.strokeStyle=COL.panel;c.stroke();
    c.fillStyle='#fff';c.font='700 11px Barlow,sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(e[0],p[0],p[1]+.5);
  });
  c.restore();
}

/* ---------- souris : tracer / éditer (phase de capture, avant la carte) ---------- */
function evxy(e){var r=cv.getBoundingClientRect();return [e.clientX-r.left,e.clientY-r.top]}
function inv(x,y){var p=K.proj().invert([x,y]);if(!p||!isFinite(p[0])||!isFinite(p[1]))return null;return [norm180(p[0]),Math.max(-85,Math.min(85,p[1]))]}
function near(p,q,r){return q&&Math.hypot(p[0]-q[0],p[1]-q[1])<=(r||13)}
function segDist(p,a,b){var vx=b[0]-a[0],vy=b[1]-a[1],l=vx*vx+vy*vy||1,t=Math.max(0,Math.min(1,((p[0]-a[0])*vx+(p[1]-a[1])*vy)/l));return Math.hypot(p[0]-a[0]-t*vx,p[1]-a[1]-t*vy)}
cv.addEventListener('pointerdown',function(e){
  if(!st.on||S.mode!=='flat'||e.button>0)return;
  var p=evxy(e),H=st.h;
  if(st.mode==='draw'){
    var g=inv(p[0],p[1]);if(!g)return;
    st.a=g;st.b=g.slice();st.drag={k:'b'};
  }else if(st.mode==='edit'&&H){
    if(near(p,H.a))st.drag={k:'a'};
    else if(near(p,H.b))st.drag={k:'b'};
    else if(near(p,H.wl,12)||near(p,H.wr,12))st.drag={k:'w'};
    else{
      var m=H.mid,best=1e9;for(var i=0;i<m.length-1;i++)best=Math.min(best,segDist(p,m[i],m[i+1]));
      if(best<=10)st.drag={k:'move',x0:p[0],y0:p[1],pa:H.a.slice(),pb:H.b.slice()};
    }
  }
  if(!st.drag)return;
  e.stopImmediatePropagation();e.preventDefault();
  try{cv.setPointerCapture(e.pointerId)}catch(_){}
  st.drag.id=e.pointerId;K.dirty();
},true);
cv.addEventListener('pointermove',function(e){
  var d=st.drag;if(!d||d.id!==e.pointerId)return;
  e.stopImmediatePropagation();
  var p=evxy(e),g;
  if(d.k==='a'||d.k==='b'){g=inv(p[0],p[1]);if(g)st[d.k]=g}
  else if(d.k==='move'){
    var a=inv(d.pa[0]+p[0]-d.x0,d.pa[1]+p[1]-d.y0),b=inv(d.pb[0]+p[0]-d.x0,d.pb[1]+p[1]-d.y0);if(a&&b){st.a=a;st.b=b}
  }else if(d.k==='w'){
    g=inv(p[0],p[1]);var f=frame(st.a,st.b);
    if(g&&f){var x=Math.abs(Math.asin(Math.max(-1,Math.min(1,dt(vec(g[0],g[1]),f.n))))*R);st.w=Math.max(40,Math.min(1500,Math.round(x*2/10)*10))}
  }
  schedule();
},true);
function endDrag(e){
  var d=st.drag;if(!d||d.id!==e.pointerId)return;
  e.stopImmediatePropagation();st.drag=null;
  if(st.mode==='draw'){
    var f=st.a&&st.b&&frame(st.a,st.b);
    if(!f||f.L<60){st.a=st.b=null;st.h=null}else st.mode='edit';
  }
  setHint();refresh();K.dirty();
}
cv.addEventListener('pointerup',endDrag,true);cv.addEventListener('pointercancel',endDrag,true);
var pend=false;
function schedule(){
  if(pend)return;pend=true;
  requestAnimationFrame(function(){pend=false;K.dirty();setHint();if(st.view!=='none'&&frame(st.a,st.b)){compute();redraw()}});
}

/* ---------- graphique 2D ---------- */
function niceStep(range,target){var raw=range/target,p=Math.pow(10,Math.floor(Math.log10(raw))),m=raw/p;return (m<1.5?1:m<3.5?2:m<7.5?5:10)*p}
function lerpC(a,b,t){return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t]}
function hexRGB(h){h=h.replace('#','');if(h.length===3)h=h.replace(/(.)/g,'$1$1');return [parseInt(h.substr(0,2),16),parseInt(h.substr(2,2),16),parseInt(h.substr(4,2),16)]}
function lblCoord(ll,lonMode){var v=lonMode?ll[0]:ll[1];var a=Math.abs(v);var r=a<10?a.toFixed(1):Math.round(a);return r+'°'+(lonMode?(v<0?'O':'E'):(v<0?'S':'N'))}
var G=null;
function draw2d(){
  var d=st.data;if(!d||st.view!=='2d')return;
  var wpx=cvg.parentNode.clientWidth,hpx=cvg.parentNode.clientHeight;if(wpx<50||hpx<50)return;
  var DPR=Math.min(window.devicePixelRatio||1,2);
  cvg.width=Math.round(wpx*DPR);cvg.height=Math.round(hpx*DPR);cvg.style.width=wpx+'px';cvg.style.height=hpx+'px';
  var c=cvg.getContext('2d');c.setTransform(DPR,0,0,DPR,0,0);
  var COL=K.COL(),ff='Barlow,sans-serif',z=K.size();
  var ml=62,mr=16,mt=34,mb=50,pw=wpx-ml-mr,ph=hpx-mt-mb;if(pw<40||ph<40)return;
  var ex=st.exag,xs=pw/d.L,topKm,ppk,visD,rx;
  if(st.uni){
    rx=st.rel;topKm=Math.min(300,Math.max(12,d.mx/1000*rx+4));
    ppk=ph/(topKm+st.maxD)*ex;visD=st.maxD;
  }else{
    rx=ex;topKm=Math.min(Math.max(2,d.mx/1000*ex),st.maxD*.6);
    ppk=ph/(st.maxD+topKm);visD=st.maxD;
  }
  var y0=mt+topKm*ppk,Hv=(topKm+visD)*ppk,smax=Math.max(0,Hv-ph);st.scroll=Math.max(0,Math.min(smax,st.scroll||0));st.smax=smax;var sy=st.scroll;
  function X(s){return ml+s*xs}
  function Yd(km){return y0+km*ppk}
  function Ye(m){return y0-Math.min(topKm,m/1000*rx)*ppk}
  /* séisme : la profondeur est comptée depuis la surface exagérée (valeurs fausses acceptées), l'écart se résorbe vers 120 km */
  function Yq(o){
    var qi=Math.max(0,Math.min(d.N,Math.round(o.s/d.L*d.N))),e=d.el[qi],gap=Ye(e)-(y0-e/1000*ppk),k=Math.max(0,1-Math.max(0,o.d)/120);
    var y=Yd(Math.min(o.d,visD+20))+gap*k;
    return Math.max(y,Ye(e)+1.5);
  }
  G={ml:ml,mt:mt,pw:pw,ph:ph,xs:xs,ppk:ppk,y0:y0};
  c.clearRect(0,0,wpx,hpx);c.fillStyle=COL.panel;c.fillRect(0,0,wpx,hpx);
  c.save();c.beginPath();c.rect(ml-62,mt,pw+62+mr,ph);c.clip();c.translate(0,-sy);
  // terre (sous la surface)
  c.beginPath();c.moveTo(X(0),mt+Hv);
  for(var i=0;i<=d.N;i++)c.lineTo(X(d.L*i/d.N),Ye(d.el[i]));
  c.lineTo(X(d.L),mt+Hv);c.closePath();
  c.fillStyle=COL.land;c.fill();
  var gd=c.createLinearGradient(0,y0,0,mt+Hv);gd.addColorStop(0,'rgba(0,0,0,0)');gd.addColorStop(1,'rgba(40,20,10,.38)');c.fillStyle=gd;c.fill();
  // structure interne
  if(st.struct){
    var bot=mt+Hv,y660=Math.min(bot,Yd(660));
    var surfF=function(i){return Ye(d.el[i])},moF=function(i){return Math.min(y660,surfF(i)+d.th[i]*ppk)},lbF=function(i){return Math.min(y660,surfF(i)+d.lt[i]*ppk)};
    var band=function(tf,bf,col){c.beginPath();for(var q=0;q<=d.N;q++){var qx=X(d.L*q/d.N),qy=tf(q);q?c.lineTo(qx,qy):c.moveTo(qx,qy)}for(q=d.N;q>=0;q--)c.lineTo(X(d.L*q/d.N),bf(q));c.closePath();c.fillStyle=col;c.fill()};
    var f660=function(){return y660},fbot=function(){return bot};
    if(st.struct==='crust'){band(surfF,moF,SC.crust);band(moF,f660,SC.um)}else{band(surfF,lbF,SC.lith);band(lbF,f660,SC.ast)}
    band(f660,fbot,st.struct==='crust'?SC.lm:SC.lm2);
    c.beginPath();c.moveTo(ml,y660);c.lineTo(ml+pw,y660);c.setLineDash([6,4]);c.lineWidth=1.2;c.strokeStyle='#fff';c.stroke();c.setLineDash([]);
    c.font='600 10.5px '+ff;c.textAlign='left';c.textBaseline='bottom';c.fillStyle='#fff';c.fillText('660 km · limite manteau supérieur / inférieur',ml+6,y660-3);
    if(st.struct==='crust'){
      c.textAlign='center';c.textBaseline='top';c.font='700 11px '+ff;c.lineJoin='round';
      for(var kk=1;kk<=5;kk++){var qi=Math.round(d.N*kk/6),tx=X(d.L*qi/d.N),ty=moF(qi)+3,tt=Math.round(d.th[qi])+' km';c.lineWidth=3;c.strokeStyle='rgba(0,0,0,.55)';c.strokeText(tt,tx,ty);c.fillStyle='#fff';c.fillText(tt,tx,ty)}
    }
  }
  // océan
  c.beginPath();c.moveTo(X(0),y0);
  for(i=0;i<=d.N;i++)c.lineTo(X(d.L*i/d.N),Math.max(y0,Ye(d.el[i])));
  c.lineTo(X(d.L),y0);c.closePath();
  c.fillStyle='#5ea7d8';c.globalAlpha=.85;c.fill();c.globalAlpha=1;
  // grille profondeur
  var step=visD<=60?10:visD<=120?20:visD<=300?50:100;
  c.font='500 11px '+ff;c.textAlign='right';c.textBaseline='middle';
  for(var k=step;k<=visD+.01;k+=step){var yy=Yd(k);c.beginPath();c.moveTo(ml,yy);c.lineTo(ml+pw,yy);c.lineWidth=.6;c.strokeStyle='rgba(255,255,255,.35)';c.stroke();c.fillStyle=COL.fg;c.fillText(k+' km',ml-6,yy)}
  // niveau de la mer
  c.beginPath();c.moveTo(ml,y0);c.lineTo(ml+pw,y0);c.lineWidth=1;c.setLineDash([4,3]);c.strokeStyle=COL.fg;c.stroke();c.setLineDash([]);
  c.fillStyle=COL.fg;c.fillText('0',ml-6,y0);
  // altitude (échelle exagérée)
  var ea=niceStep(topKm/rx*1000,3);
  c.fillStyle=COL.mute;
  for(var m=ea;m/1000*rx<=topKm*0.98;m+=ea){var ye=y0-m/1000*rx*ppk;if(y0-ye<16||ye<mt+8)continue;c.beginPath();c.moveTo(ml-4,ye);c.lineTo(ml,ye);c.lineWidth=1;c.strokeStyle=COL.mute;c.stroke();c.fillText('+'+(m>=1000?(m/1000)+' km':m+' m'),ml-6,ye)}
  // surface
  c.beginPath();for(i=0;i<=d.N;i++){var xx=X(d.L*i/d.N),yy2=Ye(d.el[i]);i?c.lineTo(xx,yy2):c.moveTo(xx,yy2)}
  c.lineWidth=1.8;c.strokeStyle=COL.fg;c.lineJoin='round';c.stroke();
  // séismes
  var ps=z.ps,zz=z.z;
  d.qs.forEach(function(o){
    var r=Math.max(1.5,(0.9+(o.m-3.2)*1.25))*zz*ps,x=X(o.s),y=Yq(o);
    if(o.d>visD)return;o.px=[x,y-sy,r];
    c.beginPath();c.arc(x,y,r,0,6.2832);c.globalAlpha=.78;c.fillStyle=o.c;c.fill();c.globalAlpha=.9;c.lineWidth=.7;c.strokeStyle=COL.fg;c.stroke();c.globalAlpha=1;
  });
  // volcans (sur la surface)
  d.vs.forEach(function(o){
    var s=(o.v.ill?2.8:4.6)*zz*ps,x=X(o.s),yb=Ye(o.e),yc=yb-s*.75;o.px=[x,yc-sy,s*1.2];
    c.beginPath();c.moveTo(x,yc-s);c.lineTo(x+s*.95,yc+s*.75);c.lineTo(x-s*.95,yc+s*.75);c.closePath();
    c.fillStyle=o.c;c.globalAlpha=.95;c.fill();c.lineWidth=.8;c.strokeStyle=COL.fg;c.stroke();c.globalAlpha=1;
  });
  c.restore();
  c.strokeStyle=COL.fg;c.globalAlpha=.5;c.lineWidth=1;c.strokeRect(ml,mt,pw,ph);c.globalAlpha=1;
  if(smax>0){var th=Math.max(24,ph*ph/Hv),ty=mt+(sy/smax)*(ph-th);c.fillStyle=COL.fg;c.globalAlpha=.35;c.fillRect(ml+pw-6,ty,4,th);c.globalAlpha=1}
  // fosses océaniques
  if(d.tr&&d.tr.length){
    c.font='600 11px '+ff;c.textBaseline='middle';
    d.tr.forEach(function(t,k){
      var x=X(t.s),idx=Math.min(d.N,Math.round(t.s/d.L*d.N)),ys=Ye(d.el[idx]),ly=mt+11+(k%2)*15;
      if(ys-sy<mt+2||ys-sy>mt+ph+40)return;
      c.beginPath();c.moveTo(x,ly+8);c.lineTo(x,Math.max(ly+8,Math.min(mt+ph,ys-sy)));c.setLineDash([4,3]);c.lineWidth=1.4;c.strokeStyle='#0f3b8c';c.stroke();c.setLineDash([]);
      var tw=c.measureText(t.name).width+12,bx=Math.max(ml+2,Math.min(ml+pw-tw-2,x-tw/2));
      c.fillStyle='#0f3b8c';c.globalAlpha=.92;c.fillRect(bx,ly-8,tw,16);c.globalAlpha=1;
      c.fillStyle='#fff';c.textAlign='center';c.fillText(t.name,bx+tw/2,ly);
    });
  }
  // axe horizontal : km + longitude/latitude
  var lonMode=Math.abs(norm180(d.ll[d.N][0]-d.ll[0][0])*Math.cos((d.ll[0][1]+d.ll[d.N][1])/2*D2R))>=Math.abs(d.ll[d.N][1]-d.ll[0][1]);
  var sx=niceStep(d.L,Math.max(3,pw/110));
  c.textAlign='center';c.textBaseline='top';c.font='500 11px '+ff;
  for(var s=0;s<=d.L+1e-6;s+=sx){
    var x2=X(s),idx=Math.min(d.N,Math.round(s/d.L*d.N));
    c.beginPath();c.moveTo(x2,mt+ph);c.lineTo(x2,mt+ph+5);c.lineWidth=1;c.strokeStyle=COL.fg;c.stroke();
    c.fillStyle=COL.fg;c.fillText(lblCoord(d.ll[idx],lonMode),x2,mt+ph+7);
    c.fillStyle=COL.mute;c.fillText(Math.round(s)+' km',x2,mt+ph+21);
  }
  c.fillStyle=COL.mute;c.textAlign='left';c.textBaseline='alphabetic';
  c.fillText((lonMode?'Longitude':'Latitude')+' (et distance le long de la coupe)'+(smax>0?' · molette : parcourir la profondeur':''),ml,hpx-5);
  c.textAlign='right';c.fillText('Profondeur sous le niveau de la mer · '+'étirement vertical ×'+(+ex).toFixed(1).replace('.0','')+' · relief ×'+st.rel,ml+pw,hpx-5);
  c.textAlign='left';c.fillStyle=COL.fg;c.font='600 12px '+ff;
  c.fillText(lblCoord(d.ll[0],lonMode)+'  ('+d.ll[0][1].toFixed(1)+'°, '+d.ll[0][0].toFixed(1)+'°)  →  '+lblCoord(d.ll[d.N],lonMode)+'  ('+d.ll[d.N][1].toFixed(1)+'°, '+d.ll[d.N][0].toFixed(1)+'°)',ml,mt-14);
}
cvg.addEventListener('wheel',function(e){if(st.view!=='2d'||!(st.smax>0))return;e.preventDefault();st.scroll=Math.max(0,Math.min(st.smax,(st.scroll||0)+e.deltaY*(e.deltaMode===1?30:1)));draw2d()},{passive:false});
/* infobulle */
cvg.addEventListener('pointermove',function(e){
  var d=st.data;if(!d||st.view!=='2d'){tip.hidden=true;return}
  var r=cvg.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top,best=null,bd=9;
  d.qs.forEach(function(o){if(!o.px)return;var k=Math.hypot(o.px[0]-x,o.px[1]-y)-o.px[2]*.5;if(k<bd){bd=k;best={t:'Séisme M'+o.m.toFixed(1)+' · '+Math.round(o.d)+' km de profondeur'}}});
  d.vs.forEach(function(o){if(!o.px)return;var k=Math.hypot(o.px[0]-x,o.px[1]-y)-o.px[2]*.5;if(k<bd){bd=k;best={t:'Volcan '+(o.v.name||'')}}});
  if(!best&&st.struct&&G&&x>=G.ml&&x<=G.ml+G.pw){var qi=Math.max(0,Math.min(d.N,Math.round((x-G.ml)/G.xs/d.L*d.N)));best={t:st.struct==='crust'?'Croûte : '+Math.round(d.th[qi])+' km d\'épaisseur':'Lithosphère : ≈ '+Math.round(d.lt[qi])+' km (schématique)'}}
  if(!best){tip.hidden=true;return}
  tip.textContent=best.t;tip.hidden=false;tip.style.left=Math.min(x+12,r.width-180)+'px';tip.style.top=(y+14)+'px';
});
cvg.addEventListener('pointerleave',function(){tip.hidden=true});

/* ---------- bloc 3D (three.js) ---------- */
var T=null,threeP=null,r3=null,sc3=null,cam3=null,grp3=null,raf3=0,t3=0,swing=true,off3=0,drag3=null,ty3=0,R3l=1000;
function loadThree(){
  if(window.THREE)return Promise.resolve();
  if(threeP)return threeP;
  threeP=new Promise(function(res,rej){var s=document.createElement('script');s.src=THREE_URL;s.onload=res;s.onerror=function(){threeP=null;rej(new Error('three'))};document.head.appendChild(s)});
  return threeP;
}
function start3d(){
  var msg=$('#cp-cap');msg.textContent='Chargement du bloc 3D…';
  loadThree().then(function(){
    if(st.view!=='3d')return;
    T=window.THREE;
    if(!r3){
      r3=new T.WebGLRenderer({antialias:true,alpha:true});r3.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
      wrap3.appendChild(r3.domElement);r3.domElement.style.cssText='width:100%;height:100%;display:block;cursor:grab;touch-action:none';
      r3.domElement.addEventListener('pointerdown',function(e){drag3={x:e.clientX,y:e.clientY,o:off3,t:ty3};swing=false;$('#cp-sw').textContent='▶ Balancer';try{r3.domElement.setPointerCapture(e.pointerId)}catch(_){}});
      var pts3={},pd0=0,pz0=1;
      r3.domElement.addEventListener('wheel',function(e){e.preventDefault();st.zoom3=Math.max(.3,Math.min(6,st.zoom3*Math.exp(-e.deltaY*.0015)))},{passive:false});
      r3.domElement.addEventListener('pointerdown',function(e){pts3[e.pointerId]=[e.clientX,e.clientY];var k=Object.keys(pts3);if(k.length===2){var a=pts3[k[0]],b=pts3[k[1]];pd0=Math.hypot(a[0]-b[0],a[1]-b[1]);pz0=st.zoom3}});
      r3.domElement.addEventListener('pointermove',function(e){if(pts3[e.pointerId]){pts3[e.pointerId]=[e.clientX,e.clientY];var k=Object.keys(pts3);if(k.length===2&&pd0>0){var a=pts3[k[0]],b=pts3[k[1]];st.zoom3=Math.max(.3,Math.min(6,pz0*Math.hypot(a[0]-b[0],a[1]-b[1])/pd0));return}}if(drag3){off3=drag3.o+(e.clientX-drag3.x)*.01;ty3=drag3.t+(e.clientY-drag3.y)*(2*R3l*Math.tan(19*D2R)/Math.max(100,wrap3.clientHeight))}});
      r3.domElement.addEventListener('pointercancel',function(e){delete pts3[e.pointerId]});
      r3.domElement.addEventListener('pointerup',function(e){delete pts3[e.pointerId]});
      r3.domElement.addEventListener('pointerup',function(){drag3=null});
    }
    msg.textContent='';
    build3d();fit3d();loop3();
  }).catch(function(){msg.textContent='Le bloc 3D n\'a pas pu être chargé (connexion ?).'});
}
function stop3d(){if(raf3){cancelAnimationFrame(raf3);raf3=0}}
$('#cp-tr').onclick=function(){st.trans=!st.trans;this.textContent=st.trans?'Opaque':'Transparent';build3d()};
$('#cp-zi').onclick=function(){st.zoom3=Math.min(6,st.zoom3*1.3)};$('#cp-zo').onclick=function(){st.zoom3=Math.max(.3,st.zoom3/1.3)};
$('#cp-sw').onclick=function(){swing=!swing;if(swing)off3=0;this.textContent=swing?'⏸ Pause':'▶ Balancer'};
function fit3d(){
  if(!r3||st.view!=='3d')return;
  var w=wrap3.clientWidth,h=wrap3.clientHeight;if(w<20||h<20)return;
  r3.setSize(w,h,false);if(cam3){cam3.aspect=w/h;cam3.updateProjectionMatrix()}
}
function elevRGB(e){
  if(e<0){var t=Math.min(1,-e/6000);return lerpC([112,184,226],[14,52,102],Math.pow(t,.7))}
  var stops=[[0,[96,160,84]],[600,[150,178,92]],[1800,[196,170,104]],[3500,[140,104,78]],[5500,[250,250,250]]];
  for(var i=1;i<stops.length;i++){if(e<=stops[i][0]){var a=stops[i-1],b=stops[i];return lerpC(a[1],b[1],(e-a[0])/(b[0]-a[0]))}}
  return [250,250,250];
}
function build3d(){
  var d=st.data;if(!d||!T||!r3)return;
  if(grp3){sc3.remove(grp3);grp3.traverse(function(o){if(o.geometry)o.geometry.dispose();if(o.material)o.material.dispose&&o.material.dispose()})}
  if(!sc3){
    sc3=new T.Scene();cam3=new T.PerspectiveCamera(38,1,1,60000);
    sc3.add(new T.AmbientLight(0xffffff,.62));var dl=new T.DirectionalLight(0xffffff,.75);dl.position.set(-.6,1,.8);sc3.add(dl);
  }
  grp3=new T.Group();sc3.add(grp3);
  var L=d.L,hw=st.w/2,D=st.maxD,ex=st.exag,f=d.f,dvf=1,DD=D*dvf;
  var nx=Math.max(24,Math.min(240,Math.round(L/6))),nz=Math.max(8,Math.min(60,Math.round(st.w/8)));
  // dessus : relief
  var th3=new Float32Array((nx+1)*(nz+1)),lt3=new Float32Array((nx+1)*(nz+1));
  var pos=new Float32Array((nx+1)*(nz+1)*3),col=new Float32Array((nx+1)*(nz+1)*3),hts=[];
  for(var j=0;j<=nz;j++){for(var i=0;i<=nx;i++){
    var s=L*i/nx,x=-hw+st.w*j/nz,ll=pt(f,s,x),e=elev(ll[0],ll[1]),k=(j*(nx+1)+i)*3;
    pos[k]=s-L/2;pos[k+1]=e/1000*st.rel*dvf;pos[k+2]=-x;
    var Lq=layersAt(ll[0],ll[1],e);th3[k/3]=Lq.th;lt3[k/3]=Lq.lt;
    var rgb=elevRGB(e);col[k]=rgb[0]/255;col[k+1]=rgb[1]/255;col[k+2]=rgb[2]/255;
  }}
  if(!(S.level==='adv'&&crust)){for(j=0;j<=nz;j++){var rt=th3.subarray(j*(nx+1),(j+1)*(nx+1)),rl=lt3.subarray(j*(nx+1),(j+1)*(nx+1));smoothArr(rt,Math.round(nx/16),3);smoothArr(rl,Math.round(nx/16),3)}}
  var idx=[];for(j=0;j<nz;j++)for(i=0;i<nx;i++){var a=j*(nx+1)+i,b=a+1,c2=a+nx+1,d2=c2+1;idx.push(a,c2,b,b,c2,d2)}
  var g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(pos,3));g.setAttribute('color',new T.BufferAttribute(col,3));g.setIndex(idx);g.computeVertexNormals();
  grp3.add(new T.Mesh(g,new T.MeshLambertMaterial({vertexColors:true,side:T.DoubleSide,transparent:st.trans,opacity:st.trans?.42:1,depthWrite:!st.trans})));
  // eau
  var wg=new T.PlaneGeometry(L,st.w);wg.rotateX(-Math.PI/2);
  grp3.add(new T.Mesh(wg,new T.MeshBasicMaterial({color:0x3f8fd0,transparent:true,opacity:.32,depthWrite:false})));
  // faces latérales : suivent le relief, dégradé de profondeur
  function side(getPt){
    var n=getPt.n,sp=[],sc=[],si=[],md=Math.min(660*dvf,DD),NL=st.struct?4:2;
    for(var q=0;q<=n;q++){
      var p=getPt(q),lv,cl;
      if(st.struct==='crust'){lv=[p[1],p[1]-Math.min(md,p3th(p[3])*dvf),-md,-DD];cl=[SC.crust,SC.um,SC.lm]}
      else if(st.struct==='lith'){lv=[p[1],p[1]-Math.min(md,lt3[p[3]]*dvf),-md,-DD];cl=[SC.lith,SC.ast,SC.lm2]}
      if(st.struct){
        for(var u=0;u<4;u++)sp.push(p[0],Math.min(lv[u],u?lv[u-1]:1e9),p[2]);
        for(u=0;u<4;u++){var cc=new T.Color(cl[Math.min(2,u>2?2:u)]);sc.push(cc.r,cc.g,cc.b)}
        if(q<n){var o=q*4;for(var w2=0;w2<3;w2++)si.push(o+w2,o+w2+1,o+w2+4,o+w2+4,o+w2+1,o+w2+5)}
      }else{
        sp.push(p[0],p[1],p[2],p[0],-DD,p[2]);
        sc.push(196/255,172/255,132/255,84/255,56/255,40/255);
        if(q<n){var o2=q*2;si.push(o2,o2+1,o2+2,o2+2,o2+1,o2+3)}
      }
    }
    var gg=new T.BufferGeometry();gg.setAttribute('position',new T.BufferAttribute(new Float32Array(sp),3));gg.setAttribute('color',new T.BufferAttribute(new Float32Array(sc),3));gg.setIndex(si);gg.computeVertexNormals();
    var m=new T.Mesh(gg,new T.MeshLambertMaterial({vertexColors:true,side:T.DoubleSide,transparent:st.trans,opacity:st.trans?.22:1,depthWrite:!st.trans}));grp3.add(m);
  }
  function p3th(v){return th3[v]}
  function topPos(i,j){var k=(j*(nx+1)+i)*3;return [pos[k],pos[k+1],pos[k+2],k/3]}
  var fn=function(j){var h=function(q){return topPos(q,j)};h.n=nx;return h};
  side(fn(nz));side(fn(0));
  var fe=function(i){var h=function(q){return topPos(i,q)};h.n=nz;return h};
  side(fe(0));side(fe(nx));
  // fond + arêtes
  var bm=new T.Mesh(new T.PlaneGeometry(L,st.w).rotateX(Math.PI/2),new T.MeshBasicMaterial({color:0x2a1a12,transparent:st.trans,opacity:st.trans?.35:1,depthWrite:!st.trans}));bm.position.y=-DD;grp3.add(bm);
  var ev=new T.LineSegments(new T.BufferGeometry().setFromPoints([[-L/2,-DD,-hw],[L/2,-DD,-hw],[L/2,-DD,-hw],[L/2,-DD,hw],[L/2,-DD,hw],[-L/2,-DD,hw],[-L/2,-DD,hw],[-L/2,-DD,-hw]].map(function(p){return new T.Vector3(p[0],p[1],p[2])})),new T.LineBasicMaterial({color:0x000000,transparent:true,opacity:.5}));
  grp3.add(ev);
  // séismes / volcans (même couleur et même taille relative que sur la carte)
  var z=K.size(),kpx=L/Math.max(520,wrap3.clientWidth*.7);
  var sg=new T.SphereGeometry(1,10,8);
  if(d.qs.length){
    var im=new T.InstancedMesh(sg,new T.MeshLambertMaterial(),d.qs.length),M=new T.Matrix4(),C=new T.Color();
    d.qs.forEach(function(o,q){
      var r=Math.max(1.5,(0.9+(o.m-3.2)*1.25))*z.z*z.ps*kpx*.75;
      M.makeScale(r,r,r);var qi3=Math.max(0,Math.min(d.N,Math.round(o.s/d.L*d.N))),e3=d.el[qi3]/1000,ts=e3*st.rel*dvf,gap3=(e3*st.rel-e3)*dvf*Math.max(0,1-Math.max(0,o.d)/120),yq=-Math.min(o.d,D)*dvf+gap3;
      M.setPosition(o.s-L/2,Math.min(yq,ts-.0015*L),-o.x);im.setMatrixAt(q,M);C.set(o.c);im.setColorAt(q,C);
    });
    im.instanceMatrix.needsUpdate=true;if(im.instanceColor)im.instanceColor.needsUpdate=true;grp3.add(im);
  }
  if(d.vs.length){
    var cg=new T.ConeGeometry(1,1.7,10),vm=new T.InstancedMesh(cg,new T.MeshLambertMaterial(),d.vs.length),M2=new T.Matrix4(),C2=new T.Color();
    d.vs.forEach(function(o,q){
      var r=(o.v.ill?2.8:4.6)*z.z*z.ps*kpx*1.1;
      M2.makeScale(r,r,r);M2.setPosition(o.s-L/2,o.e/1000*st.rel*dvf+r*.85,-o.x);vm.setMatrixAt(q,M2);C2.set(o.c);vm.setColorAt(q,C2);
    });
    vm.instanceMatrix.needsUpdate=true;if(vm.instanceColor)vm.instanceColor.needsUpdate=true;grp3.add(vm);
  }
  var lonMode=Math.abs(norm180(d.ll[d.N][0]-d.ll[0][0]))>=Math.abs(d.ll[d.N][1]-d.ll[0][1]);
  $('#cp-cap').textContent=lblCoord(d.ll[0],lonMode)+' ← → '+lblCoord(d.ll[d.N],lonMode)+' · bande de '+Math.round(st.w)+' km · profondeur '+D+' km · '+'relief ×'+st.rel+' · glisser vers le haut/bas pour parcourir';
  grp3.userData={L:L,w:st.w,D:DD,D0:D,top:Math.max(10,d.mx/1000*st.rel*dvf),top0:Math.max(10,d.mx/1000*st.rel)};
  fit3d();
}
function loop3(){
  stop3d();
  (function f(ts){
    raf3=requestAnimationFrame(f);
    if(st.view!=='3d'||!r3||!sc3||!grp3)return;
    var u=grp3.userData,asp=cam3.aspect||1.6,tv=Math.tan(19*D2R),th=tv*asp,R3=Math.max(u.L/.78/(2*th),(u.D0+u.top0)*1.5/(2*tv),u.w*1.4);R3=R3/1.1/st.zoom3;R3l=R3;
    var ty=Math.max(-u.D,Math.min(u.top,-u.D0*.32+ty3));ty3=ty+u.D0*.32;
    if(swing)t3=ts/1000;
    var az=(swing?Math.sin(t3*.55)*.62:0)+off3,el=.42;
    cam3.position.set(Math.sin(az)*Math.cos(el)*R3*1.1,ty+Math.sin(el)*R3*.9+u.D0*.14,Math.cos(az)*Math.cos(el)*R3*1.1);
    cam3.lookAt(0,ty,0);
    r3.render(sc3,cam3);
  })(performance.now());
}

/* ---------- export PNG ---------- */
function exportPng(){
  var d=st.data,src=null;if(!d)return;
  if(st.view==='3d'&&r3&&sc3&&cam3){r3.render(sc3,cam3);src=r3.domElement}else if(st.view==='2d')src=cvg;
  if(!src)return;
  var dpr=src.width/Math.max(1,src.clientWidth||src.width),strip=Math.round(24*dpr),o=document.createElement('canvas');
  o.width=src.width;o.height=src.height+strip;var c=o.getContext('2d'),COL=K.COL();
  c.fillStyle=COL.panel;c.fillRect(0,0,o.width,o.height);c.drawImage(src,0,0);
  c.fillStyle=COL.mute;c.font='500 '+Math.round(11*dpr)+'px Barlow,sans-serif';c.textBaseline='middle';
  c.fillText('Carte Tectonique 4e · coupe de '+Math.round(d.L)+' km, bande de '+Math.round(st.w)+' km · relief ETOPO (NOAA) · séismes USGS · volcans Smithsonian GVP'+(st.struct?' · croûte CRUST1.0':'')+(legItems().length?' · '+legItems().map(function(x){return x[1]}).join(' / '):''),Math.round(10*dpr),src.height+strip/2);
  o.toBlob(function(b){if(!b)return;var a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='coupe'+(st.view==='3d'?'-3d':'')+'.png';document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},500)},'image/png');
}

document.addEventListener('change',function(e){var t=e.target;if(st.on&&st.view!=='none'&&t&&t.dataset&&t.dataset.layer)setTimeout(function(){if(frame(st.a,st.b)){compute();redraw()}},60)});

/* ---------- coupes préparées (scénario) ---------- */
function rnd(p){return [Math.round(p[0]*1000)/1000,Math.round(p[1]*1000)/1000]}
function capture(){
  if(!st.a||!st.b||!frame(st.a,st.b))return null;
  return {a:rnd(st.a),b:rnd(st.b),w:Math.round(st.w),maxD:700,exag:st.exag,rel:st.rel,uni:true,view:st.view==='3d'?'3d':'2d',trans:!!st.trans,struct:st.struct,layers:{quakes:!!S.layers.quakes,volc:!!S.layers.volc,trench:!!S.layers.trench},map:{rot0:Math.round(S.rot[0]*100)/100,pan:Math.round(S.pan),k:Math.round(S.k*100)/100}};
}
function setLayer(k,on){
  var cb=document.querySelector('[data-layer="'+k+'"]');
  if(cb&&cb.checked!==on){cb.checked=on;cb.dispatchEvent(new Event('change',{bubbles:true}))}else S.layers[k]=on;
}
function load(c){
  if(!c||!c.a||!c.b)return;
  if(!st.on)open();
  st.a=c.a.slice();st.b=c.b.slice();st.w=+c.w||300;st.maxD=700;st.exag=Math.max(.3,Math.min(10,+c.exag||1));st.rel=Math.max(1,Math.min(40,+c.rel||5));st.uni=true;st.trans=c.trans!==false;st.struct=(c.struct==='crust'||c.struct==='lith')?c.struct:'';st.slab=false;
  if(c.layers)['quakes','volc','trench'].forEach(function(k){if(c.layers[k]!=null)setLayer(k,!!c.layers[k])});
  if(c.map&&isFinite(c.map.rot0)){S.rot[0]=c.map.rot0;S.pan=c.map.pan||0;S.k=c.map.k||1}
  st.mode='edit';setHint();K.dirty();
  Promise.all([loadRelief(),ensureCrust()]).then(function(){showGraph(c.view==='3d'?'3d':'2d')}).catch(function(){});
  $$pre();
}
function begin(c){if(c&&c.a&&c.b)load(c);else open()}
var preList=[],preCur=null;
function $$pre(){
  var box=$('#cp-prel');if(!box)return;
  box.innerHTML='';
  preList.forEach(function(c){var b=document.createElement('button');b.className='ibtn'+(preCur===c.id?' on':'');b.textContent=c.label||'Coupe';b.onclick=function(){preCur=c.id;load(c)};box.appendChild(b)});
  $('#cp-pre').hidden=!preList.length;
}
function setList(list,autoId){
  preList=(list||[]).filter(function(c){return c&&c.a&&c.b&&typeof c.a[0]==='number'&&typeof c.a[1]==='number'&&typeof c.b[0]==='number'&&typeof c.b[1]==='number'});preCur=null;$$pre();
  if(autoId){var c=preList.filter(function(x){return x.id===autoId})[0];if(c)setTimeout(function(){preCur=c.id;load(c)},450)}
}

/* ---------- API pour la carte ---------- */
window.CP={
  draw:drawMap,
  menuChanged:function(){if(btn.classList.contains('mi-h')&&st.on)close()},
  refresh:function(){if(!st.on)return;compute();if(st.view!=='none')redraw()},
  isOn:function(){return st.on},capture:capture,load:load,begin:begin,setList:setList,
  _st:st
};
})();
