(function(){
'use strict';
const IMG={
  hero: "assets/img/hero.jpg",
  wet: "assets/img/wet.jpg",
  dry: "assets/img/dry.jpg",
  inside: "assets/img/inside.jpg",
  proto: "assets/img/proto.jpg",
  main: "assets/img/main.jpg"
};
const $ = id => document.getElementById(id);
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (isTouch) document.body.classList.add('touch');
const V3=THREE.Vector3, MU=THREE.MathUtils, clamp=MU.clamp, lerp=MU.lerp;

/* ---------- renderer ---------- */
const canvas=$('c');
const renderer=new THREE.WebGLRenderer({canvas, antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.outputEncoding=THREE.sRGBEncoding;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.05;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene();
scene.fog=new THREE.Fog(0xffffff,90,260);
const camera=new THREE.PerspectiveCamera(50,1,0.1,600);
function resize(){ const w=innerWidth,h=innerHeight; renderer.setSize(w,h,false); camera.aspect=w/h; camera.updateProjectionMatrix(); }
addEventListener('resize',resize); resize();

function col(h){ return new THREE.Color(h).convertSRGBToLinear(); }
function clay(hex,o={}){ return new THREE.MeshStandardMaterial(Object.assign({color:col(hex),roughness:.6,metalness:0},o)); }
function gloss(hex,o={}){ return new THREE.MeshStandardMaterial(Object.assign({color:col(hex),roughness:.2,metalness:0},o)); }
function flat(hex,o={}){ return new THREE.MeshBasicMaterial(Object.assign({color:col(hex)},o)); }
function mesh(geo,mat,cast=true,recv=true){ const m=new THREE.Mesh(geo,mat); m.castShadow=cast; m.receiveShadow=recv; return m; }
function at(m,x,y,z){ m.position.set(x,y,z); return m; }
function rbox(w,h,d,r,seg=5){
  const g=new THREE.BoxGeometry(w,h,d,seg,seg,seg), p=g.attributes.position, n=g.attributes.normal;
  const hw=w/2-r, hh=h/2-r, hd=d/2-r, v=new V3(), c=new V3(), nn=new V3();
  for(let i=0;i<p.count;i++){ v.fromBufferAttribute(p,i); c.set(clamp(v.x,-hw,hw),clamp(v.y,-hh,hh),clamp(v.z,-hd,hd));
    nn.subVectors(v,c).normalize(); v.copy(c).addScaledVector(nn,r); p.setXYZ(i,v.x,v.y,v.z); n.setXYZ(i,nn.x,nn.y,nn.z); }
  return g;
}
function lathe(pts,segs=48){ return new THREE.LatheGeometry(pts.map(p=>new THREE.Vector2(p[0],p[1])),segs); }
function sph(r,sx,sy,sz,mat,ws=24,hs=16,cast=true){ const m=mesh(new THREE.SphereGeometry(r,ws,hs),mat,cast,true); m.scale.set(sx,sy,sz); return m; }
function cyl(rt,rb,h,mat,seg=20){ return mesh(new THREE.CylinderGeometry(rt,rb,h,seg),mat); }
function tube(points,r,mat,seg=24,closed=false){ return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new V3(p[0],p[1],p[2])),closed),seg,r,8,closed),mat); }
function ctex(w,h,draw){ const c=document.createElement('canvas'); c.width=w; c.height=h; draw(c.getContext('2d'),w,h); const t=new THREE.CanvasTexture(c); t.encoding=THREE.sRGBEncoding; return t; }
function dist2(p,q){ return Math.hypot(p.x-q.x,p.z-q.z); }
function ig(w){ const c=w.charCodeAt(w.length-1)-0xAC00; return w+((c>=0&&c%28)?'이':'가'); }
function ro(w){ const c=w.charCodeAt(w.length-1)-0xAC00, j=c>=0?c%28:0; return w+((j&&j!==8)?'으로':'로'); }
function eul(w){ const c=w.charCodeAt(w.length-1)-0xAC00; return w+((c>=0&&c%28)?'을':'를'); }
const easeIO=k=>k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2, easeOut=k=>1-Math.pow(1-k,3), easeIn=k=>k*k, lin=k=>k;
function easeOutBack(x){ const c1=1.70158,c3=c1+1; return 1+c3*Math.pow(x-1,3)+c1*Math.pow(x-1,2); }

/* ---------- lights ---------- */
const hemi=new THREE.HemisphereLight(0xffffff,0xffffff,.8); scene.add(hemi);
const sun=new THREE.DirectionalLight(0xffffff,1.1); sun.castShadow=true; sun.shadow.mapSize.set(2048,2048); sun.shadow.bias=-0.0006; sun.shadow.radius=4; scene.add(sun); scene.add(sun.target);
const fill=new THREE.DirectionalLight(0xffffff,.4); scene.add(fill);
function setLights(L){
  hemi.color=col(L.sky); hemi.groundColor=col(L.ground); hemi.intensity=L.hemi;
  sun.color=col(L.sunCol); sun.intensity=L.sun; sun.position.set(...L.sunPos); sun.target.position.set(...(L.sunAt||[0,0,0]));
  const r=L.range||40, c=sun.shadow.camera; c.left=-r; c.right=r; c.top=r; c.bottom=-r; c.near=1; c.far=260; c.updateProjectionMatrix();
  fill.color=col(L.fillCol||'#CFE2F2'); fill.intensity=L.fill==null?.4:L.fill; fill.position.set(...(L.fillPos||[-12,15,-40]));
  scene.background=col(L.bg); scene.fog.color=col(L.bg); scene.fog.near=L.fog?L.fog[0]:90; scene.fog.far=L.fog?L.fog[1]:260;
}

/* ---------- tweens ---------- */
const tweens=[];
function tween(dur,fn,ease=easeIO){ return new Promise(res=>{ tweens.push({t:0,dur,fn,ease,res}); fn(ease(0)); }); }
const wait=ms=>new Promise(r=>setTimeout(r,ms));

/* ---------- audio ---------- */
let actx=null, master=null, rainGain=null, muted=false, noiseBuf=null;
function initAudio(){ if(actx) return; try{ actx=new (window.AudioContext||window.webkitAudioContext)(); master=actx.createGain(); master.gain.value=.8; master.connect(actx.destination);
  const len=actx.sampleRate*2; noiseBuf=actx.createBuffer(1,len,actx.sampleRate); const d=noiseBuf.getChannelData(0); for(let i=0;i<len;i++) d[i]=Math.random()*2-1;
  const src=actx.createBufferSource(); src.buffer=noiseBuf; src.loop=true; const lp=actx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=900; rainGain=actx.createGain(); rainGain.gain.value=0; src.connect(lp); lp.connect(rainGain); rainGain.connect(master); src.start(); }catch(e){ actx=null; } }
function setRain(v){ if(rainGain) rainGain.gain.linearRampToValueAtTime(v,actx.currentTime+.8); }
function tone(f0,f1,dur,vol=.2,type='sine',delay=0){ if(!actx||muted) return; const t=actx.currentTime+delay, o=actx.createOscillator(), g=actx.createGain(); o.type=type; o.frequency.setValueAtTime(f0,t); o.frequency.exponentialRampToValueAtTime(Math.max(20,f1),t+dur); g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(vol,t+.015); g.gain.exponentialRampToValueAtTime(.001,t+dur); o.connect(g); g.connect(master); o.start(t); o.stop(t+dur+.05); }
function noise(dur,vol,freq,type='bandpass',delay=0){ if(!actx||muted) return; const t=actx.currentTime+delay, s=actx.createBufferSource(); s.buffer=noiseBuf; const f=actx.createBiquadFilter(); f.type=type; f.frequency.value=freq; const g=actx.createGain(); g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(.001,t+dur); s.connect(f); f.connect(g); g.connect(master); s.start(t,Math.random()); s.stop(t+dur+.05); }
const sfx={
  plop:(d=0)=>tone(900,260,.16,.18,'sine',d), pick:()=>tone(420,620,.1,.15,'triangle'), put:()=>tone(380,220,.12,.12,'triangle'),
  happy:()=>[523,659,784,1047].forEach((f,i)=>tone(f,f*1.01,.35,.13,'sine',i*.11)), nope:()=>tone(260,200,.15,.08,'square'),
  rise:()=>tone(300,900,.5,.14,'sine'), fall:()=>tone(900,300,.5,.12,'sine'), step:()=>tone(520,700,.08,.1,'triangle'),
  meow:(d=0)=>{ tone(520,880,.22,.16,'sawtooth',d); tone(880,430,.45,.14,'sawtooth',d+.2); },
  hiss:()=>{ noise(.5,.3,3500,'highpass'); tone(900,300,.4,.1,'sawtooth'); },
  chirp:(d=0)=>{ tone(2600,3600,.07,.1,'sine',d); tone(3200,2400,.08,.1,'sine',d+.09); },
  glass:()=>{ noise(.12,.7,2500,'highpass'); noise(.5,.5,6000,'highpass',.03); noise(.3,.3,1200,'bandpass',.02); tone(180,60,.2,.3,'sine');
    [2100,2800,3500,4300,3100,5200,2500,4700].forEach((f,i)=>tone(f,f*.97,.3,.08,'triangle',.06+i*.07+Math.random()*.03)); },
  crash:()=>{ tone(160,45,.25,.35,'sine'); noise(.25,.35,1800); [1568,1245,988,784,622].forEach((f,i)=>tone(f,f*.9,.22,.08,'triangle',.05+i*.06)); },
  splash:()=>{ noise(.7,.35,1400); noise(.9,.2,600,'lowpass',.1); },
  thud:()=>tone(140,50,.18,.3,'sine'), whoosh:()=>noise(.35,.15,900),
  bell:()=>[1047,1319,1568].forEach((f,i)=>tone(f,f,.6,.1,'sine',i*.15)),
  buzz:()=>tone(240,260,.25,.06,'sawtooth'),
};
$('muteBtn').addEventListener('click',()=>{ muted=!muted; if(master) master.gain.value=muted?0:.8; $('muteBtn').textContent=muted?'🔈':'🔊'; $('muteBtn').setAttribute('aria-label',muted?'소리 켜기':'소리 끄기'); });

/* ---------- UI helpers ---------- */
const st={ mode:'title', stage:0, lock:0, yaw:0, dist:11, facing:Math.PI, carrying:null, vx:0, vz:0, walkT:0, busy:false, perf:null,
  cine:true, cinePos:new V3(0,3,9), cineLook:new V3(0,1,0), camPos:new V3(0,3,9), camLook:new V3(0,1,0), focus:0, confirm:null, shove:0 };
let toastTimer=0;
function toast(t,ms=1800){ const el=$('toast'); el.textContent=t; el.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('show'),ms); }
function setGoal(t){ const el=$('goalTxt'); el.textContent=t?'할 일: '+t:''; el.style.display=t?'block':'none'; }
function fade(to,ms=900){ const f=$('fade'); f.style.transitionDuration=ms+'ms'; f.style.opacity=to; return wait(ms+60); }
function caption(text){ $('capTxt').textContent=text; $('capBtn').classList.remove('show'); $('caption').classList.add('show'); }
function captionHide(){ $('caption').classList.remove('show'); }
function captionBtn(text,label){ caption(text); const b=$('capBtn'); b.textContent=label; b.classList.add('show');
  return new Promise(res=>{ const done=()=>{ b.onclick=null; st.confirm=null; b.classList.remove('show'); res(); }; b.onclick=done; st.confirm=done; }); }
function dialog(who,text,choices){ st.lock++; $('dlgWho').textContent=who; $('dlgTxt').textContent=text; const box=$('dlgCh'); box.innerHTML=''; $('dialog').classList.add('show');
  return new Promise(res=>{ const list=choices&&choices.length?choices:['다음']; const done=i=>{ st.confirm=null; $('dialog').classList.remove('show'); st.lock--; sfx.step(); res(i); };
    list.forEach((c,i)=>{ const b=document.createElement('button'); b.textContent=c; b.onclick=()=>done(i); box.appendChild(b); }); st.confirm=list.length===1?()=>done(0):null; }); }
function mission(title,html,btn='알겠어요'){ st.lock++; $('misTitle').textContent=title; $('misBody').innerHTML=html; $('misBtn').textContent=btn; $('mission').classList.add('show');
  return new Promise(res=>{ const done=()=>{ $('misBtn').onclick=null; st.confirm=null; $('mission').classList.remove('show'); st.lock--; initAudio(); sfx.step(); res(); }; $('misBtn').onclick=done; st.confirm=done; $('misBtn').focus({preventScroll:true}); }); }
let bub=null;
function bubble(text,getPos,ms=1600){ const el=$('bubble'); el.textContent=text; el.classList.add('show'); bub={getPos,until:performance.now()+ms}; }
const _pv=new V3();
function updateBubble(){ if(!bub) return; const el=$('bubble'); if(performance.now()>bub.until){ el.classList.remove('show'); bub=null; return; }
  _pv.copy(bub.getPos()).project(camera); const x=clamp((_pv.x*.5+.5)*innerWidth,70,innerWidth-70), y=clamp((-_pv.y*.5+.5)*innerHeight,90,innerHeight-60); el.style.left=x+'px'; el.style.top=y+'px'; }

/* ---------- shared fx ---------- */
const dropGeo=lathe([[0,0],[.45,.08],[.68,.4],[.62,.75],[.38,1.1],[0,1.55]],32);
const smallDropGeo=lathe([[0,0],[.2,.04],[.3,.18],[.27,.33],[.17,.5],[0,.7]],16);
const dropMat=gloss('#4FA9EC',{roughness:.12});
const waterMat=gloss('#7EC3EE',{transparent:true,opacity:.82,roughness:.06});
const flyers=[], sparks=[], notes=[];
function flyDrop(from,to,delay,onArrive,m){ m=m||mesh(smallDropGeo,dropMat,false,false); m.visible=false; scene.add(m); flyers.push({m,from:from.clone(),to:to.clone(),t:-delay,dur:.55,onArrive}); }
function sparkle(pos,n=14){ for(let i=0;i<n;i++){ const s=new THREE.Mesh(new THREE.OctahedronGeometry(.25,0), new THREE.MeshBasicMaterial({color:col(['#FFD45C','#7EC3EE','#F4A7B9','#FFFFFF'][i%4]),transparent:true})); s.position.copy(pos); const a=Math.random()*Math.PI*2, v=3+Math.random()*4; s.userData={vx:Math.cos(a)*v,vy:4+Math.random()*5,vz:Math.sin(a)*v,life:1}; scene.add(s); sparks.push(s); } }
const noteTex=['♪','♫','♪'].map((ch,i)=>ctex(128,128,g=>{ g.font='bold 100px sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.lineWidth=12; g.strokeStyle='#FFFFFF'; g.strokeText(ch,64,68); g.fillStyle=['#3E8E5E','#4FA3E3','#E9768F'][i]; g.fillText(ch,64,68); }));
const heartTex=ctex(128,128,g=>{ g.font='100px sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillStyle='#E9768F'; g.fillText('♥',64,70); });
function floatSprite(tex,pos,scale=1.6){ const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthWrite:false})); sp.scale.setScalar(scale); sp.position.copy(pos); sp.userData={life:1,vx:(Math.random()-.5)*1.5}; scene.add(sp); notes.push(sp); }

/* ---------- player characters (from the clay renders) ---------- */
const CHARS=[
  {key:'apple', name:'삼사과', line:'머리 위에 빨간 사과를 얹고 다녀요.'},
  {key:'santa', name:'산타', line:'일 년 내내 산타 모자를 쓰는 친구예요.'},
  {key:'bread', name:'빵군이', line:'갓 구운 빵을 두 팔로 번쩍 들었어요.'},
  {key:'ribbon',name:'리봉순', line:'커다란 줄무늬 리본이 자랑이에요.'},
  {key:'books', name:'북북이', line:'책을 한가득 이고 다니는 책벌레예요.'},
];
function ribbonStrips(points,closed,colors,w=.12,th=.05,flip=false){
  const curve=new THREE.CatmullRomCurve3(points.map(p=>new V3(p[0],p[1],p[2]||0)),closed), grp=new THREE.Group();
  colors.forEach((c,i)=>{ const x0=(i-colors.length/2)*w, sh=new THREE.Shape(); if(flip){ sh.moveTo(-th/2,x0); sh.lineTo(th/2,x0); sh.lineTo(th/2,x0+w); sh.lineTo(-th/2,x0+w); } else { sh.moveTo(x0,-th/2); sh.lineTo(x0+w,-th/2); sh.lineTo(x0+w,th/2); sh.lineTo(x0,th/2); } sh.closePath();
    grp.add(mesh(new THREE.ExtrudeGeometry(sh,{steps:40,bevelEnabled:false,extrudePath:curve}),clay(c,{side:THREE.DoubleSide}))); });
  return grp;
}
function makeCharacter(key){
  const g=new THREE.Group(), rig=new THREE.Group(); g.add(rig);
  const Y=clay('#F9D25A'), dark=clay('#3E2415',{roughness:.35});
  const sit=key==='ribbon', up=(key==='bread'||key==='books');
  const w=sit?1.02:1.12, h=sit?.96:1.0, d=.92, fh=sit?.05:.2, by=fh+h/2, top=fh+h;
  const body=mesh(rbox(w,h,d,.27,7),Y); body.position.y=by; rig.add(body);
  const feet=[-1,1].map(s=>{ let f; if(sit){ f=sph(.17,1.2,.75,1.1,Y); f.position.set(s*.25,.13,d/2-.02); } else { f=mesh(rbox(.33,.32,.35,.14,4),Y); f.position.set(s*.25,.16,0); } rig.add(f); return f; });
  const arms=[-1,1].map(()=>{ const a=sph(.17,1,1.05,.95,Y); rig.add(a); return a; });
  const eyes=[-1,1].map(s=>{ const e=sph(.062,1,1.08,.5,dark,12,10,false); e.position.set(s*.185,by-.03,d/2+.004); rig.add(e); return e; });
  const happyEyes=[-1,1].map(s=>{ const e=mesh(new THREE.TorusGeometry(.075,.026,8,14,Math.PI),dark,false,false); e.position.set(s*.185,by-.04,d/2+.01); e.visible=false; rig.add(e); return e; });
  if(key==='santa') [-1,1].forEach(s=>{ const b=new THREE.Mesh(new THREE.CircleGeometry(.115,20),flat('#F6A878',{transparent:true,opacity:.85})); b.position.set(s*.33,by-.16,d/2+.006); rig.add(b); });
  if(key==='books'){ const sm=mesh(new THREE.TorusGeometry(.075,.024,8,14,Math.PI),dark,false,false); sm.rotation.z=Math.PI; sm.position.set(0,by-.1,d/2+.01); rig.add(sm); }
  const hat=new THREE.Group(); hat.position.y=top; rig.add(hat); let hatTop=.1;
  if(key==='apple'){
    hat.add(at(sph(.42,1,.88,1,gloss('#E3402E',{roughness:.38})),0,.3,0));
    hat.add(tube([[0,.6,0],[-.02,.76,0],[-.1,.9,0]],.04,clay('#7A4A2A'),8));
    const lf=sph(.2,1.15,.22,.62,clay('#6DAA45')); lf.position.set(.16,.88,0); lf.rotation.z=.5; hat.add(lf);
    const hl=sph(.07,1.7,.55,.3,flat('#FFFFFF',{transparent:true,opacity:.6}),10,8,false); hl.position.set(-.2,.5,.3); hl.rotation.z=.6; hat.add(hl); hatTop=.95;
  } else if(key==='santa'){
    const hg=new THREE.Group(); hg.rotation.z=-.1; hg.position.y=.02; hat.add(hg);
    const geo=lathe([[.62,0],[.54,.25],[.4,.55],[.24,.8],[.1,.97],[0,1.03]],32), p=geo.attributes.position;
    for(let i=0;i<p.count;i++){ const k=p.getY(i)/1.03; p.setX(i,p.getX(i)+.55*k*k); p.setY(i,p.getY(i)-.3*k*k*k); } geo.computeVertexNormals();
    hg.add(at(mesh(geo,clay('#D8372F')),0,.12,0));
    const br=mesh(new THREE.TorusGeometry(.6,.2,14,32),clay('#FFFDF8')); br.rotation.x=Math.PI/2; br.position.y=.1; hg.add(br);
    hg.add(at(sph(.2,1,1,1,clay('#FFFDF8')),.62,.78,0)); hatTop=1.0;
  } else if(key==='bread'){
    hat.add(at(sph(1,.76,.34,.45,clay('#D68A38')),0,.3,0));
    [-1,0,1].forEach(i=>{ const s=sph(.1,.95,.22,2.3,clay('#F2CF96'),12,8,false); const x=i*.37; s.position.set(x,.3+.33*Math.sqrt(1-(x/.76)*(x/.76))-.02,0); s.rotation.y=.55; hat.add(s); }); hatTop=.72;
  } else if(key==='ribbon'){
    const C=['#F3A6C0','#FBF4EE','#A9C8F0'], bow=new THREE.Group(); bow.position.set(0,.3,.05); hat.add(bow);
    [-1,1].forEach(s=>{ const lp=ribbonStrips([[0,0,0],[s*.42,.06,.3],[s*.95,.16,.26],[s*1.18,.18,0],[s*.95,.16,-.26],[s*.42,.06,-.3]],true,C,.16,.06); bow.add(lp);
      bow.add(ribbonStrips([[s*.22,-.1,.26],[s*.6,-.42,.34],[s*.86,-.82,.26],[s*1.02,-1.08,.14]],false,s>0?C:[...C].reverse(),.11,.06,true)); });
    bow.add(mesh(rbox(.36,.46,.44,.14,4),clay('#F3A6C0'))); hatTop=.75;
  } else {
    [['#8FB07A',0],['#EFE4D0',.21],['#F2A5A0',.42]].forEach(([c,y],i)=>{ const b=mesh(rbox(1.02,.2,.74,.06,3),clay(c)); b.position.set(0,.12+y,0); b.rotation.y=(i-1)*.1; hat.add(b);
      const pg=mesh(new THREE.BoxGeometry(.9,.12,.02),clay('#FFFDF6'),false,false); pg.position.set(0,.12+y,.372); pg.rotation.y=(i-1)*.1; hat.add(pg); });
    hat.add(at(mesh(new THREE.BoxGeometry(.1,.22,.02),clay('#F4C542'),false,false),.3,.2,.385)); hatTop=.66;
  }
  const anchor=new THREE.Group(); anchor.position.y=top+hatTop+.05; rig.add(anchor);
  const ch={g,rig,body,feet,arms,eyes,happyEyes,anchor,up,w,by,top,fh,hatTop,sit,
    setHappy(v){ eyes.forEach(e=>e.visible=!v); happyEyes.forEach(e=>e.visible=v); }};
  animChar(ch,0,0,0,false); return ch;
}
function animChar(ch,walk,wt,t,carrying){
  const bob=Math.abs(Math.sin(wt))*.14*walk, br=Math.sin(t*2.2)*.02*(1-walk);
  ch.rig.position.y=bob; ch.body.scale.set(1+br-bob*.25,1-br+bob*.4,1+br-bob*.25); ch.rig.rotation.z=Math.sin(wt)*.08*walk;
  ch.feet.forEach((f,i)=>{ const s=i?-1:1, base=ch.sit?.42:0; f.position.z=base+Math.sin(wt)*.18*walk*s; f.position.y=(ch.sit?.13:.16)+Math.max(0,Math.sin(wt)*s)*.1*walk; });
  ch.arms.forEach((a,i)=>{ const s=i?1:-1;
    if(ch.up||carrying){ a.position.set(s*(ch.w/2-.03),ch.top+.03,0); a.scale.set(.9,1.5,.9); }
    else { a.position.set(s*(ch.w/2+.07),ch.by-.1+Math.sin(wt+(i?Math.PI:0))*.06*walk,Math.sin(wt+(i?0:Math.PI))*.12*walk); a.scale.set(1,1.05,.95); } });
}

/* ---------- Ttami, the MooljoolDay pot ---------- */
const TS=1.15, T_SOIL=6.35*TS, T_PLANT=1.9;
function makeTtami(){
  const group=new THREE.Group(), body=new THREE.Group(); group.add(body); const S=TS;
  const cream=clay('#F4E8D6',{roughness:.5}), tan=clay('#DDA561',{roughness:.5}), dark=clay('#4A2A1A',{roughness:.4});
  body.add(mesh(lathe([[0,.55],[2.6,.6],[3.9,1.0],[4.6,1.7],[4.88,2.5]].map(p=>[p[0]*S,p[1]*S]),64),tan));
  body.add(mesh(lathe([[4.88,2.5],[5.02,3.4],[5.0,4.4],[4.75,5.4],[4.2,6.25],[3.6,6.7],[3.25,6.8],[3.0,6.95],[2.8,6.9],[2.72,6.6],[2.75,5.0],[2.6,4.7],[0,4.7]].map(p=>[p[0]*S,p[1]*S]),64),cream));
  [.42,1.05,1.75].forEach(a=>{ a*=Math.PI; const f=sph(1,1,.72,1.05,tan,20,14); f.position.set(Math.sin(a)*3.9*S,.6,Math.cos(a)*3.9*S); body.add(f); });
  const eyes=[], smiles=[], blush=[];
  [-1,1].forEach(sx=>{ const a=sx*.36, r=5.0*S, y=3.45*S, pos=new V3(Math.sin(a)*r,y,Math.cos(a)*r), out=pos.clone().multiplyScalar(2).setY(y);
    const e=sph(.3,1,1.15,.55,dark,16,12,false); e.position.copy(pos); e.lookAt(out); body.add(e); eyes.push(e);
    const s=mesh(new THREE.TorusGeometry(.36,.11,10,20,Math.PI),dark,false,false); s.position.copy(pos); s.lookAt(out); s.visible=false; body.add(s); smiles.push(s);
    const ba=sx*.6, b=new THREE.Mesh(new THREE.CircleGeometry(.55,24),flat('#F2A7A0',{transparent:true,opacity:0,depthWrite:false})); b.position.set(Math.sin(ba)*(r+.02),y-.55,Math.cos(ba)*(r+.02)); b.lookAt(b.position.clone().multiplyScalar(2).setY(y-.55)); body.add(b); blush.push(b); });
  const mouth=sph(.32,1,1.2,.5,dark,16,12,false); mouth.position.set(0,3.0*S,5.0*S); mouth.visible=false; body.add(mouth);
  body.add(at(mesh(new THREE.CylinderGeometry(2.7*S,2.6*S,.5,40),clay('#7A5236')),0,T_SOIL-.25,0));
  // little clover sprout (needed for the juggling trick)
  const plant=new THREE.Group(); plant.position.y=T_SOIL; plant.scale.setScalar(T_PLANT); body.add(plant);
  const leafM=clay('#5DB765',{roughness:.5}), stemM=clay('#4E9A55'), H=1.7;
  plant.add(at(cyl(.11,.16,H,stemM,10),0,H/2,0));
  const topG=new THREE.Group(); topG.position.y=H; plant.add(topG);
  const hs=new THREE.Shape(); hs.moveTo(0,0); hs.bezierCurveTo(-.15,.25,-.75,.45,-.62,.95); hs.bezierCurveTo(-.5,1.3,-.08,1.3,0,1.0); hs.bezierCurveTo(.08,1.3,.5,1.3,.62,.95); hs.bezierCurveTo(.75,.45,.15,.25,0,0);
  const hg=new THREE.ExtrudeGeometry(hs,{depth:.06,bevelEnabled:true,bevelThickness:.07,bevelSize:.07,bevelSegments:4,curveSegments:16}); hg.translate(0,0,-.03);
  [0,1,2].forEach(i=>{ const hgp=new THREE.Group(); hgp.rotation.y=i*Math.PI*2/3+Math.PI/3; const l=mesh(hg,leafM); l.rotation.x=-(Math.PI/2-.5); hgp.add(l); topG.add(hgp); });
  // water drop indicator that rises out of the shoulder
  const dpos=new V3(3.1*S,6.45*S,2.1*S);
  const hole=mesh(new THREE.TorusGeometry(.62,.07,8,24),clay('#E2D2BB'),false,false); hole.rotation.x=Math.PI/2; hole.position.copy(dpos).setY(6.52*S); body.add(hole);
  const drop=mesh(dropGeo,dropMat); drop.position.copy(dpos); body.add(drop);
  const T={group,body,eyes,smiles,blush,mouth,topG,drop,dropY:dpos.y,dropK:0,dropTarget:0,happy:false,thirsty:false,full:false,need:4,have:0,bounce:0,R:5.4*S,
    jugL:new V3(-1.15,H+.45,0), jugR:new V3(1.15,H+.45,0),
    get pos(){ return group.position; }, mouthPos(){ return new V3(group.position.x,7.2*S,group.position.z); } };
  return T;
}
function updateTtami(T,dt,t){
  T.dropK+=(T.dropTarget-T.dropK)*Math.min(1,dt*3.2);
  T.drop.visible=T.dropK>.03; T.drop.position.y=T.dropY-1.9*(1-T.dropK)+(T.dropTarget?Math.abs(Math.sin(t*3))*.3*T.dropK:0); T.drop.rotation.y=t;
  T.eyes.forEach(e=>e.visible=!T.happy); T.smiles.forEach(e=>e.visible=T.happy);
  T.blush.forEach(b=>b.material.opacity=clamp(b.material.opacity+(T.happy?dt*2:-dt),0,.75));
  if(!(st.perf&&W&&W.pot===T)){ T.body.rotation.z=Math.sin(t*(T.happy?4:1.6))*(T.happy?.03:.02);
    T.bounce=Math.max(0,T.bounce-dt*3); const pb=Math.sin(Math.min(1,T.bounce)*Math.PI)*.06; T.body.scale.set(1+pb,1-pb,1+pb); }
}

/* ---------- the person who owns the desk (ending) ---------- */
function makeHuman(){
  const g=new THREE.Group(), skin=clay('#F5CBA7'), knit=clay('#A8D5BA'), hair=clay('#5B3B2A'), dark=clay('#3E2415',{roughness:.35});
  g.add(at(sph(1,10,12,7,knit),0,1,28));
  g.add(at(cyl(2.6,3,3,skin,16),0,12.5,26.5));
  const head=new THREE.Group(); head.position.set(0,19.5,25); head.rotation.x=.12; g.add(head);
  head.add(sph(7,1,.98,.96,skin,32,24));
  const hr=mesh(new THREE.SphereGeometry(7.35,32,20,0,Math.PI*2,0,Math.PI*.56),hair); hr.rotation.x=.55; hr.position.set(0,.5,.4); head.add(hr);
  head.add(at(sph(2.2,1,1.2,.8,hair),5.6,-2.5,2.5)); head.add(at(sph(2.2,1,1.2,.8,hair),-5.6,-2.5,2.5));
  [-1,1].forEach(s=>{ const e=mesh(new THREE.TorusGeometry(.85,.2,8,16,Math.PI),dark,false,false); e.position.set(s*2.5,-.2,-6.6); e.rotation.y=Math.PI; head.add(e);
    const b=new THREE.Mesh(new THREE.CircleGeometry(1.1,20),flat('#F4A08E',{transparent:true,opacity:.6,side:THREE.DoubleSide})); b.position.set(s*4.0,-1.9,-5.75); b.rotation.y=Math.PI+s*-.45; head.add(b); head.add(at(sph(1.1,.5,1,.8,skin),s*6.9,-.6,0)); });
  const sm=mesh(new THREE.TorusGeometry(1.1,.2,8,16,Math.PI),dark,false,false); sm.rotation.set(0,Math.PI,Math.PI); sm.position.set(0,-2.4,-6.5); head.add(sm);
  const mkArm=()=>{ const a=new THREE.Group(), c=mesh(new THREE.CylinderGeometry(1.9,2.3,1,16),knit); a.add(c); const h=sph(2.1,1,.8,1.1,skin); a.add(h); g.add(a); return {a,c,h}; };
  const setArm=(arm,from,to)=>{ const d=to.clone().sub(from), L=d.length(); arm.c.position.copy(from).addScaledVector(d,.5); arm.c.scale.set(1,L,1); arm.c.quaternion.setFromUnitVectors(new V3(0,1,0),d.normalize()); arm.h.position.copy(to); };
  const R=mkArm(), Lf=mkArm(); setArm(Lf,new V3(-8.5,8,25),new V3(-10,1.6,10));
  return {g,head,pet(t,pot){ const hx=pot.x+3.6+Math.sin(t*3)*1.6, hz=pot.z+3.2+Math.cos(t*3)*.8; setArm(R,new V3(8.5,8,25),new V3(hx,8.9,hz)); head.rotation.z=Math.sin(t*1.5)*.05; }};
}

/* ---------- carryable things ---------- */
const CTYPES={ cap:{name:'병뚜껑',cap:3}, leaf:{name:'낙엽',cap:2}, paper:{name:'종이 쪼가리',cap:2,leak:6}, petal:{name:'꽃잎',cap:1}, tomato:{name:'방울토마토',cap:0} };
function bowl(sx,sy,sz,mat,ws=28,hs=12){ const m=mesh(new THREE.SphereGeometry(1,ws,hs,0,Math.PI*2,Math.PI/2,Math.PI/2),mat); m.material.side=THREE.DoubleSide; m.scale.set(sx,sy,sz); m.position.y=sy; return m; }
function makeItem(type){
  const g=new THREE.Group(); let waterY=[.1,.3], wsx=.8, wsz=.6;
  if(type==='cap'){ const c=['#D9544A','#3F7CC4','#4C9A66'][Math.random()*3|0];
    g.add(mesh(lathe([[0,0],[.85,0],[.92,.06],[.92,.5],[.84,.54],[.78,.5],[.78,.12],[0,.12]],32),clay(c)));
    for(let i=0;i<22;i++){ const r=mesh(new THREE.BoxGeometry(.06,.36,.08),clay(c),false,false), a=i/22*Math.PI*2; r.position.set(Math.cos(a)*.93,.28,Math.sin(a)*.93); r.rotation.y=-a; g.add(r); }
    waterY=[.14,.48]; wsx=wsz=.76;
  } else if(type==='leaf'){ g.add(bowl(1.5,.32,.68,clay('#C98A3C')));
    const rib=cyl(.04,.06,3,clay('#8E5A22'),6); rib.rotation.z=Math.PI/2; rib.position.y=.06; g.add(rib);
    const s2=cyl(.06,.06,.7,clay('#8E5A22'),6); s2.rotation.z=Math.PI/2; s2.position.set(1.75,.3,0); g.add(s2); waterY=[.12,.28]; wsx=1.3; wsz=.58;
  } else if(type==='petal'){ g.add(bowl(1.0,.3,.75,clay('#F4A7B9'))); waterY=[.12,.26]; wsx=.85; wsz=.62;
  } else if(type==='paper'){ const b=bowl(1.15,.34,.9,clay('#F7F1E4',{flatShading:true}),7,4); b.rotation.y=.4; g.add(b); waterY=[.12,.28]; wsx=.9; wsz=.7;
  } else { g.add(at(sph(.62,1,.95,1,gloss('#E5392E',{roughness:.3})),0,.6,0));
    for(let i=0;i<5;i++){ const s=sph(.2,1.3,.2,.45,clay('#4E9A55'),8,6,false), a=i/5*Math.PI*2; s.position.set(Math.cos(a)*.2,1.17,Math.sin(a)*.2); s.rotation.y=-a; g.add(s); } }
  const w=new THREE.Mesh(new THREE.CircleGeometry(1,28),waterMat); w.rotation.x=-Math.PI/2; w.visible=false; g.add(w);
  return {type,group:g,water:0,def:CTYPES[type],wmesh:w,waterY,wsx,wsz,leakT:0,carried:false};
}
function updateWater(c){ if(!c.def.cap) return; const f=c.water/c.def.cap; c.wmesh.visible=c.water>0; c.wmesh.position.y=lerp(c.waterY[0],c.waterY[1],f); const k=.55+.45*f; c.wmesh.scale.set(c.wsx*k,c.wsz*k,1); }

/* ---------- NPC models ---------- */
function makeSanta(){
  const g=new THREE.Group(), red=clay('#D63A32'), white=clay('#FFFDF8'), skin=clay('#F5C9A8'), black=clay('#2B2422');
  g.add(at(sph(1.5,1,1.15,.95,red),0,2.6,0));
  const belt=mesh(new THREE.TorusGeometry(1.48,.2,10,28),black); belt.rotation.x=Math.PI/2; belt.position.y=2.3; g.add(belt);
  g.add(at(mesh(rbox(.5,.5,.2,.08,2),clay('#F4C542')),0,2.3,1.55));
  const hem=mesh(new THREE.TorusGeometry(1.35,.24,10,28),white); hem.rotation.x=Math.PI/2; hem.position.y=1.35; g.add(hem);
  [-1,1].forEach(s=>{ g.add(at(sph(.5,1,.8,1.3,black),s*.6,.4,.15)); g.add(at(cyl(.42,.42,.8,red,12),s*.6,1.0,0));
    const arm=sph(.45,1,1.6,1,red); arm.position.set(s*1.55,2.9,0); arm.rotation.z=s*.5; g.add(arm); g.add(at(sph(.42,1,1,1,black),s*1.95,2.25,0)); g.add(at(sph(.46,1,.5,1,white),s*1.82,2.5,0)); });
  g.add(at(sph(1.0,1,1,1,skin),0,4.5,0));
  g.add(at(sph(1.05,1,.95,.8,white),0,3.95,.45));
  g.add(at(sph(.18,1,1,1,clay('#E9967A')),0,4.5,.98));
  [-1,1].forEach(s=>{ g.add(at(sph(.1,1,1.1,.5,black,10,8,false),s*.36,4.75,.9)); g.add(at(sph(.3,1.5,.6,.6,white),s*.3,4.25,.95)); });
  const hat=mesh(new THREE.ConeGeometry(.95,1.7,24),red); hat.position.set(.15,5.9,0); hat.rotation.z=-.25; g.add(hat);
  const br=mesh(new THREE.TorusGeometry(.95,.26,10,28),white); br.rotation.x=Math.PI/2; br.position.y=5.2; g.add(br);
  g.add(at(sph(.3,1,1,1,white),.55,6.7,0));
  g.add(at(sph(1.1,1,1.2,1,clay('#B98A5A')),-1.3,3.1,-1.1));
  return g;
}
function makeCat(){
  const g=new THREE.Group(), fur=clay('#F0B274'), wh=clay('#FFF7EA'), dk=clay('#3A2A22',{roughness:.3}), pink=clay('#F2A0A8');
  const body=sph(1,2.5,2.4,4.3,fur); body.position.set(0,4.4,0); g.add(body);
  g.add(at(sph(1,1.9,1.5,2.6,wh),0,3.6,.9));
  [[-1,2.2],[0,.6],[1,-1]].forEach(([i,z])=>{ const s=mesh(new THREE.TorusGeometry(2.3,.22,6,24,Math.PI),clay('#D98E4C'),false,false); s.position.set(0,4.5,z-1); s.scale.set(1,1,1); g.add(s); });
  const head=new THREE.Group(); head.position.set(0,7.0,4.2); g.add(head);
  head.add(sph(2.4,1.08,.95,1,fur));
  head.add(at(sph(1.1,1.2,.8,.8,wh),0,-.7,1.7));
  [-1,1].forEach(s=>{ const e=mesh(new THREE.ConeGeometry(.95,1.7,4),fur); e.position.set(s*1.45,2.0,0); e.rotation.z=-s*.3; e.rotation.y=Math.PI/4; head.add(e);
    const ie=mesh(new THREE.ConeGeometry(.5,1.0,4),pink,false,false); ie.position.set(s*1.42,1.95,.28); ie.rotation.z=-s*.3; ie.rotation.y=Math.PI/4; head.add(ie);
    head.add(at(sph(.34,1,1.25,.5,dk,12,10,false),s*.95,.25,2.15));
    head.add(at(sph(.1,1,1,.5,flat('#FFFFFF'),8,6,false),s*.86,.42,2.33));
    for(let k=-1;k<=1;k++){ const wk=cyl(.03,.03,2.2,wh,4); wk.rotation.z=Math.PI/2+k*.18*s; wk.position.set(s*2.0,-.7+k*.22,1.7); head.add(wk); } });
  head.add(at(sph(.24,1.2,.8,.8,pink,10,8,false),0,-.35,2.42));
  const legs=[[-1.4,2.6],[1.4,2.6],[-1.4,-2.6],[1.4,-2.6]].map(([x,z])=>{ const l=new THREE.Group(); l.position.set(x,3.2,z); const c=cyl(.75,.7,3.0,fur,12); c.position.y=-1.5; l.add(c); l.add(at(sph(.85,1,.6,1.15,wh),0,-3.0,.2)); g.add(l); return l; });
  const tail=tube([[0,4.8,-4],[0,6.5,-5.6],[.6,9,-5.8],[1.4,10.6,-4.8]],.5,fur,16); g.add(tail);
  g.userData={head,legs,tail};
  return g;
}
function makeSparrow(){
  const g=new THREE.Group(), br=clay('#9A6A44'), cr=clay('#EFE2CC'), dk=clay('#2E2420',{roughness:.3});
  g.add(at(sph(1,1.7,1.5,2.2,br),0,2.6,0));
  g.add(at(sph(1,1.45,1.25,1.8,cr),0,2.25,.35));
  const head=new THREE.Group(); head.position.set(0,4.1,1.5); g.add(head);
  head.add(sph(1.2,1,.95,1,br)); head.add(at(sph(.7,.5,.8,.9,cr),.85,-.2,.3)); head.add(at(sph(.7,.5,.8,.9,cr),-.85,-.2,.3));
  [-1,1].forEach(s=>{ head.add(at(sph(.16,1,1,.6,dk,10,8,false),s*.62,.2,.95)); head.add(at(sph(.3,.4,.5,.6,dk,10,8,false),s*.95,-.25,.45)); });
  const beak=mesh(new THREE.ConeGeometry(.3,.75,8),clay('#5A4630')); beak.rotation.x=Math.PI/2; beak.position.set(0,-.05,1.4); head.add(beak);
  const wings=[-1,1].map(s=>{ const wg=new THREE.Group(); wg.position.set(s*1.5,3.0,-.1); const m=sph(1,.3,1.0,1.7,clay('#7C5234')); m.position.set(s*.15,-.4,-.3); wg.add(m); g.add(wg); return wg; });
  const tail=mesh(rbox(1.2,.25,2.2,.1,2),clay('#7C5234')); tail.position.set(0,2.6,-2.8); tail.rotation.x=.35; g.add(tail);
  [-1,1].forEach(s=>g.add(at(cyl(.08,.08,1.2,clay('#C9976B'),6),s*.5,.6,0)));
  g.userData={head,wings};
  return g;
}
function makeLadybug(){
  const g=new THREE.Group(), red=gloss('#E0362C',{roughness:.3}), bk=clay('#231C1A',{roughness:.3});
  const shell=mesh(new THREE.SphereGeometry(.6,18,12,0,Math.PI*2,0,Math.PI/2),red); shell.scale.set(1,.85,1.15); g.add(shell);
  [[.25,.38,.2],[-.25,.38,.2],[.3,.3,-.3],[-.3,.3,-.3],[0,.48,-.05]].forEach(p=>g.add(at(sph(.1,1,.5,1,bk,8,6,false),p[0],p[1],p[2])));
  g.add(at(sph(.3,1,.8,.8,bk,12,8),0,.2,.65));
  const line=mesh(new THREE.BoxGeometry(.03,.02,1.2),bk,false,false); line.position.y=.51; g.add(line);
  const wings=[-1,1].map(s=>{ const w=new THREE.Mesh(new THREE.CircleGeometry(.6,12),flat('#FFFFFF',{transparent:true,opacity:.55,side:THREE.DoubleSide,depthWrite:false})); w.scale.set(1.4,.6,1); w.position.set(s*.5,.55,-.1); w.rotation.x=-Math.PI/2; w.visible=false; g.add(w); return w; });
  g.userData={wings}; g.scale.setScalar(1.7);
  return g;
}

/* ---------- worlds ---------- */
let W=null;
function newWorld(){ return {group:new THREE.Group(), circles:[], boxes:[], bounds:{x0:-31,x1:31,z0:-19.2,z1:15.6}, items:[], sources:[], pot:null}; }
function addPuddle(g,x,z,sx,sz,rot=0){ const m=new THREE.Mesh(new THREE.CircleGeometry(1,40),waterMat); m.rotation.x=-Math.PI/2; m.rotation.z=rot; m.scale.set(sx,sz,1); m.position.set(x,.04,z); m.receiveShadow=true; g.add(m); return m; }
function placePot(Wd,x,z,need){ const T=makeTtami(); T.group.position.set(x,0,z); Wd.group.add(T.group); Wd.pot=T; T.need=need; Wd.circles.push({x,z,r:T.R}); return T; }
function placeItem(Wd,type,x,z){ const c=makeItem(type); c.group.position.set(x,0,z); c.group.rotation.y=Math.random()*6; Wd.group.add(c.group); Wd.items.push(c); updateWater(c); return c; }
const woodTex=(hex,rx,ry)=>{ const t=ctex(512,512,(g)=>{ g.fillStyle=hex; g.fillRect(0,0,512,512);
  for(let i=0;i<70;i++){ const y=Math.random()*512; g.strokeStyle=`rgba(110,65,25,${.06+Math.random()*.1})`; g.lineWidth=2+Math.random()*6; g.beginPath(); g.moveTo(0,y); for(let x=0;x<=512;x+=32) g.lineTo(x,y+Math.sin(x*.02+i)*4); g.stroke(); } }); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(rx,ry); return t; };
function potShape(r,h,hex){ const gg=new THREE.Group(); gg.add(mesh(lathe([[0,0],[r*.72,0],[r*.8,.4],[r,h-.8],[r*1.05,h-.4],[r*1.05,h],[r*.9,h],[r*.88,h-.9],[0,h-.9]],40),clay(hex))); gg.add(at(mesh(new THREE.CylinderGeometry(r*.88,r*.88,.3,32),clay('#6B4A33')),0,h-.8,0)); return gg; }

/* ===== stage 1 : the desk ===== */
function buildDesk(mode){
  const Wd=newWorld(), g=Wd.group; Wd.name='1단계 책상 위'; Wd.need=4;
  Wd.light={bg:'#E9D9C3',sky:'#FFF4E4',ground:'#B48A5E',hemi:.75,sunCol:'#FFE9C9',sun:1.15,sunPos:[-20,40,18],range:44,fog:[90,200]};
  g.add(at(mesh(rbox(66,3,38,.8,4),new THREE.MeshStandardMaterial({map:woodTex('#C98F55',2,1.2),roughness:.65}),false,true),0,-1.5,-2));
  const wallMat=clay('#EAD7BC'), WZ=-20.5;
  [[-43,15,34,60],[18,15,44,60],[-15,-12.25,22,29.5],[-15,33.5,22,23]].forEach(a=>g.add(at(mesh(new THREE.BoxGeometry(a[2],a[3],1),wallMat,false,true),a[0],a[1],WZ)));
  g.add(at(mesh(new THREE.BoxGeometry(1,60,90),wallMat,false,true),-34,15,10));
  { const fl0=mesh(new THREE.PlaneGeometry(400,400),clay('#B9936B'),false,true); fl0.rotation.x=-Math.PI/2; fl0.position.y=-40; g.add(fl0); }
  const skyTex=ctex(256,256,(c)=>{ const gr=c.createLinearGradient(0,0,0,256); gr.addColorStop(0,'#9FB3C4'); gr.addColorStop(1,'#C9D5DC'); c.fillStyle=gr; c.fillRect(0,0,256,256);
    c.fillStyle='rgba(120,138,152,.55)'; [[10,120,50,140],[70,150,40,110],[120,100,55,160],[190,140,60,120]].forEach(r=>c.fillRect(...r));
    c.fillStyle='rgba(205,215,222,.6)'; for(let i=0;i<40;i++) c.fillRect(14+(i%10)*24,130+((i/10)|0)*22,8,10); });
  g.add(at(new THREE.Mesh(new THREE.PlaneGeometry(40,30),new THREE.MeshBasicMaterial({map:skyTex,fog:false})),-15,13,-26));
  const rainTex=ctex(256,512,(c)=>{ for(let i=0;i<140;i++){ const x=Math.random()*256,y=Math.random()*512,l=8+Math.random()*30; c.strokeStyle=`rgba(235,245,255,${.25+Math.random()*.4})`; c.lineWidth=1+Math.random()*1.5; c.beginPath(); c.moveTo(x,y); c.lineTo(x-1,y+l); c.stroke(); }
    for(let i=0;i<60;i++){ c.fillStyle='rgba(240,248,255,.55)'; c.beginPath(); c.arc(Math.random()*256,Math.random()*512,1.5+Math.random()*2.5,0,7); c.fill(); } });
  rainTex.wrapS=rainTex.wrapT=THREE.RepeatWrapping; rainTex.repeat.set(2,1.5);
  g.add(at(new THREE.Mesh(new THREE.PlaneGeometry(22,19.5),new THREE.MeshBasicMaterial({map:rainTex,transparent:true,opacity:.9,depthWrite:false})),-15,12.25,-20.4));
  const frameMat=clay('#F6EEE2');
  [[-15,2.2,23,1.2,2.4],[-15,22.3,23,1.2,1.4],[-26.3,12.25,1,20,1.4],[-3.7,12.25,1,20,1.4],[-15,12.25,.8,20,1],[-15,12.25,22,.8,1]].forEach(a=>g.add(at(mesh(rbox(a[2],a[3],a[4],.3,3),frameMat),a[0],a[1],-20)));
  addPuddle(g,-15,-18.2,9,1.6); addPuddle(g,-9,-16.8,2.2,1.1,.4); addPuddle(g,-20,-17,1.6,.9,-.3);
  const drips=[]; for(let i=0;i<5;i++){ const d=mesh(new THREE.SphereGeometry(.22,12,10),waterMat,false,false); d.userData={x:-24+Math.random()*18,t:Math.random()*2}; g.add(d); drips.push(d); }
  // mug
  const MUG={x:-15,z:-1}, mug=new THREE.Group(); mug.position.set(MUG.x,0,MUG.z); mug.rotation.y=.6; g.add(mug);
  mug.add(mesh(lathe([[0,0],[3.1,0],[3.3,.3],[3.3,7.2],[3.05,7.4],[2.85,7.2],[2.85,.6],[0,.6]],56),clay('#F3EBDD')));
  mug.add(mesh(lathe([[3.32,3.2],[3.36,3.3],[3.36,4.6],[3.32,4.7]],56),clay('#E07A45')));
  const handle=mesh(new THREE.TorusGeometry(1.6,.45,16,32,Math.PI*1.2),clay('#F3EBDD')); handle.position.set(3.3,4,0); handle.rotation.z=-Math.PI*.6; mug.add(handle);
  const mw=new THREE.Mesh(new THREE.CircleGeometry(2.85,40),waterMat); mw.rotation.x=-Math.PI/2; mw.position.y=4.6; mug.add(mw);
  Wd.circles.push({x:MUG.x,z:MUG.z,r:3.6},{x:MUG.x+2.6,z:MUG.z-2.2,r:1.2}); addPuddle(g,MUG.x+3.2,MUG.z+2.6,1.3,.8,.6);
  // vase
  const VASE={x:16,z:-8}, vase=new THREE.Group(); vase.position.set(VASE.x,0,VASE.z); g.add(vase);
  vase.add(new THREE.Mesh(lathe([[0,0],[2.4,0],[3.1,1.5],[3.2,4],[2.6,7],[1.4,9.5],[1.3,11],[1.7,11.6],[1.5,11.7],[1.15,11],[1.2,9.5],[2.4,7],[2.95,4],[2.85,1.6],[2.2,.3],[0,.3]],48),new THREE.MeshStandardMaterial({color:col('#BFE3F2'),roughness:.08,transparent:true,opacity:.42,depthWrite:false})));
  vase.add(mesh(lathe([[0,.3],[2.15,.35],[2.8,1.6],[2.9,4],[2.6,5.5],[0,5.5]],40),gloss('#8CCBEF',{transparent:true,opacity:.55}),false,false));
  const flower=(px,pz,h,petal,tilt)=>{ const f=new THREE.Group(); f.add(at(cyl(.18,.22,h,clay('#5E9B4E'),8),0,h/2,0));
    const head=new THREE.Group(); head.position.y=h; for(let i=0;i<6;i++){ const p=sph(1,1.1,.35,.6,clay(petal),16,12), a=i/6*Math.PI*2; p.position.set(Math.cos(a)*1.1,0,Math.sin(a)*1.1); p.rotation.y=-a; head.add(p); }
    head.add(sph(.65,1,.6,1,clay('#F2C64E'),16,12)); head.rotation.x=.5; f.add(head);
    const lf=sph(1,1.3,.18,.5,clay('#6FA85B'),14,10); lf.position.set(.8,h*.55,0); lf.rotation.z=.5; f.add(lf); f.position.set(px,2,pz); f.rotation.z=tilt; f.rotation.x=tilt*.5; return f; };
  vase.add(flower(0,0,15,'#F4A7B9',.1),flower(.4,.3,13,'#F7D0DA',-.25),flower(-.3,-.2,12,'#F4A7B9',.32));
  Wd.circles.push({x:VASE.x,z:VASE.z,r:3.4}); addPuddle(g,VASE.x-1.5,VASE.z+3.8,2.6,1.4,.3);
  // monitor, keyboard, books, pencils, papers
  const darkMat=clay('#3D3A3A'), mon=new THREE.Group(); mon.position.set(13,0,-15.5); g.add(mon);
  mon.add(at(mesh(rbox(6,.5,4.2,.25,3),darkMat),0,.25,0)); mon.add(at(mesh(rbox(1.2,8,.9,.3,3),darkMat),0,4,-.8)); mon.add(at(mesh(rbox(20,12,.9,.4,3),darkMat),0,13,-1));
  mon.add(at(new THREE.Mesh(new THREE.PlaneGeometry(18.6,10.6),new THREE.MeshBasicMaterial({map:ctex(256,148,(c)=>{ c.fillStyle='#DDE6EE'; c.fillRect(0,0,256,148); c.fillStyle='#B4C2CF'; for(let i=0;i<9;i++) c.fillRect(30,18+i*13,120+Math.random()*80,5); })})),0,13,-.53));
  Wd.boxes.push({x0:9.8,z0:-17.8,x1:16.2,z1:-13.2});
  const kb=new THREE.Group(); kb.position.set(9,0,4); kb.rotation.y=-.08; g.add(kb);
  kb.add(at(mesh(rbox(13,.8,4.6,.3,3),clay('#EDEBE6')),0,.4,0)); const keyGeo=rbox(.85,.35,.8,.12,2), keyMat=clay('#FFFFFF');
  for(let r=0;r<4;r++) for(let k=0;k<13;k++) kb.add(at(mesh(keyGeo,keyMat,false,true),-5.7+k*.95,.9,-1.5+r));
  Wd.boxes.push({x0:2.2,z0:1.4,x1:15.8,z1:6.6});
  const books=new THREE.Group(); books.position.set(-25,0,-9); g.add(books);
  [['#E0844F',1.6,.05],['#7FA46A',1.4,-.07],['#E9D6B4',1.5,.12]].reduce((y,[c,h,r])=>{ const b=mesh(rbox(9,h,6.4,.25,3),clay(c)); b.position.y=y+h/2; b.rotation.y=r; books.add(b); return y+h; },0);
  Wd.boxes.push({x0:-30,z0:-12.8,x1:-20,z1:-5.2});
  const pencil=(x,z,ry,c)=>{ const pg=new THREE.Group(); pg.position.set(x,.38,z); pg.rotation.y=ry; g.add(pg);
    const b=cyl(.38,.38,9,clay(c),6); b.rotation.z=Math.PI/2; pg.add(b); const t=mesh(new THREE.ConeGeometry(.38,1.4,6),clay('#E8C9A0')); t.rotation.z=-Math.PI/2; t.position.x=5.2; pg.add(t);
    const l=mesh(new THREE.ConeGeometry(.14,.5,6),darkMat); l.rotation.z=-Math.PI/2; l.position.x=6.0; pg.add(l);
    for(let i=-4;i<=5;i+=1.5) Wd.circles.push({x:x+Math.cos(ry)*i,z:z-Math.sin(ry)*i,r:.55}); };
  pencil(-10,3.5,.5,'#2F4F88'); pencil(18,9,-.15,'#E0A93E');
  [[-12,8,.15,7,9],[23,6,-.3,8,6]].forEach(a=>{ const p=mesh(new THREE.BoxGeometry(a[3],.06,a[4]),clay('#F7F3EA'),false,true); p.position.set(a[0],.03,a[1]); p.rotation.y=a[2]; g.add(p); });
  placePot(Wd,0,-6,4);
  Wd.start={x:0,z:12,yaw:0}; Wd.intro={from:new V3(6,26,40),look:new V3(0,5,-4)}; Wd.goal='그릇을 주워 물을 떠다 땀땀이에게 주기';
  if(mode==='play'){
    [['cap',5,8],['cap',-21,3],['paper',-6,6],['paper',22,1],['petal',13,-3],['petal',19,-2.5],['leaf',-9,-12],['leaf',25,-7]].forEach(a=>placeItem(Wd,a[0],a[1],a[2]));
    Wd.sources=[
      {name:'창가 물웅덩이',test:p=>Math.abs(p.x+15)<10.5&&p.z<-15.2,from:()=>new V3(clamp(player.position.x,-23,-7),.2,-18.2)},
      {name:'머그컵',test:p=>dist2(p,MUG)<6.0,from:()=>new V3(MUG.x,7.4,MUG.z)},
      {name:'꽃병 아래 물',test:p=>dist2(p,{x:VASE.x-1.5,z:VASE.z+3.8})<4.2,from:()=>new V3(VASE.x-1.5,.2,VASE.z+3.8)} ];
    Wd.mission=['꿈속의 책상 위',`<p>눈을 떠 보니 책상 위예요. 그런데 내가 지우개만큼 작아졌어요! 땀땀이가 또 물방울을 올리고 있네요.</p>
      <p>책상 위 물건을 그릇 삼아 물을 떠다가 땀땀이에게 <b>4방울</b>을 채워 주세요.</p>
      <div class="tags"><span>창가 물웅덩이</span><span>마시다 만 머그컵</span><span>꽃병 아래 고인 물</span></div>
      <div class="tags"><span>병뚜껑 3방울</span><span>낙엽 2방울</span><span>종이 쪼가리 2방울 (새요)</span><span>꽃잎 1방울</span></div>
      <div class="ctrl"><span class="only-desk"><kbd>WASD / 방향키</kbd><span>걸어 다니기</span><kbd>스페이스 / F</kbd><span>줍기, 물 뜨기, 물 주기, 말 걸기</span><kbd>Q</kbd><span>내려놓기</span><kbd>마우스 드래그</kbd><span>시점 돌리기</span></span>
      <span class="only-touch"><kbd>왼쪽 원</kbd><span>끌어서 걸어 다니기</span><kbd>초록 버튼</kbd><span>줍기, 물 뜨기, 물 주기, 말 걸기</span><kbd>화면 드래그</kbd><span>시점 돌리기</span></span></div>`];
  }
  if(mode==='prologue'){ const gl=new THREE.Group(); gl.position.set(10.5,0,-2.5); g.add(gl);
    gl.add(new THREE.Mesh(lathe([[0,0],[2.2,0],[2.5,.2],[2.7,8.6],[2.55,8.6],[2.35,.5],[0,.5]],40),new THREE.MeshStandardMaterial({color:col('#DCEFF7'),roughness:.05,transparent:true,opacity:.38,depthWrite:false})));
    const gw=mesh(new THREE.CylinderGeometry(2.45,2.3,5.6,32),gloss('#8CCBEF',{transparent:true,opacity:.7}),false,false); gw.position.y=3.4; gl.add(gw);
    const stream=mesh(new THREE.CylinderGeometry(.35,.25,1,10),gloss('#7EC3EE',{transparent:true,opacity:.85}),false,false); stream.visible=false; g.add(stream);
    Wd.glass={g:gl,water:gw,stream}; }
  if(mode==='ending'){ const wood=clay('#C7A27C');
    g.add(at(mesh(rbox(24,3,22,1,3),wood),0,-12,31)); g.add(at(mesh(rbox(24,30,3,1,3),wood),0,2,43));
    const hu=makeHuman(); g.add(hu.g); Wd.human=hu; }
  Wd.update=(dt,t)=>{ rainTex.offset.y-=dt*.35; drips.forEach(d=>{ d.userData.t+=dt; const k=(d.userData.t%1.8)/1.8; d.position.set(d.userData.x,2.1-k*k*2.1,-19.3); d.scale.set(1,1+k,1); if(k<.02) d.userData.x=-24+Math.random()*18; });
    if(Wd.human) Wd.human.pet(t,Wd.pot.pos); };
  return Wd;
}

/* ===== stage 2 : the living-room dresser ===== */
function buildDresser(){
  const Wd=newWorld(), g=Wd.group; Wd.name='2단계 거실 서랍장'; Wd.bounds={x0:-34,x1:34,z0:-13,z1:13}; Wd.knock=[];
  Wd.light={bg:'#E8D6C0',sky:'#FFF1DC',ground:'#A9825C',hemi:.8,sunCol:'#FFE2B8',sun:1.0,sunPos:[25,48,32],range:52,fill:.25,fillCol:'#FFD9A8',fillPos:[-30,20,30],fog:[120,330]};
  g.add(at(mesh(rbox(72,3,30,.8,4),new THREE.MeshStandardMaterial({map:woodTex('#DDB98C',2,1),roughness:.6}),false,true),0,-1.5,0));
  g.add(at(mesh(new THREE.BoxGeometry(69,40,27),clay('#C9A377')),0,-23,0));
  for(let r=0;r<2;r++) for(let c=0;c<3;c++){ g.add(at(mesh(rbox(21,17,.6,.3,2),clay('#D4B085')),-23+c*23,-13-r*19,13.7)); g.add(at(sph(.9,1,1,1,clay('#F4E8D6')),-23+c*23,-13-r*19,14.6)); }
  const fl=mesh(new THREE.PlaneGeometry(500,400),clay('#B98D62'),false,true); fl.rotation.x=-Math.PI/2; fl.position.y=-43; g.add(fl);
  const rug=mesh(new THREE.CircleGeometry(60,48),clay('#E9C9C0'),false,true); rug.rotation.x=-Math.PI/2; rug.position.set(10,-42.8,70); g.add(rug);
  g.add(at(mesh(new THREE.BoxGeometry(500,300,1),clay('#EFE2CF'),false,true),0,80,-15.6)); g.add(at(mesh(new THREE.BoxGeometry(500,6,.8),clay('#FBF6EC')),0,-40,-15));
  g.add(at(mesh(rbox(74,22,26,1,3),clay('#8C6A4C')),-80,-32,-1)); g.add(at(mesh(rbox(70,40,2,.8,3),clay('#2B2A2C',{roughness:.4})),-80,4,-9));
  g.add(at(new THREE.Mesh(new THREE.PlaneGeometry(66,36),new THREE.MeshStandardMaterial({color:col('#1D2630'),roughness:.15})),-80,4,-7.9));
  const knock=(obj,x,z,r,name)=>{ obj.position.x=x; obj.position.z=z; g.add(obj); const k={g:obj,x,z,r,name,fall:null,col:{x,z,r}}; Wd.circles.push(k.col); Wd.knock.push(k); return k; };
  // alarm clock
  const clock=new THREE.Group(); { const b=cyl(3.4,3.4,2.2,clay('#9FD5C2'),36); b.rotation.x=Math.PI/2; b.position.y=4.3; clock.add(b);
    const face=new THREE.Mesh(new THREE.CircleGeometry(2.9,36),new THREE.MeshStandardMaterial({map:ctex(128,128,(c)=>{ c.fillStyle='#FFFDF6'; c.fillRect(0,0,128,128); c.fillStyle='#4A3826'; for(let i=0;i<12;i++){ const a=i/12*Math.PI*2; c.beginPath(); c.arc(64+Math.sin(a)*50,64-Math.cos(a)*50,3,0,7); c.fill(); } c.lineCap='round'; c.strokeStyle='#4A3826'; c.lineWidth=6; c.beginPath(); c.moveTo(64,64); c.lineTo(64,28); c.stroke(); c.lineWidth=7; c.beginPath(); c.moveTo(64,64); c.lineTo(88,74); c.stroke(); }),roughness:.5})); face.position.set(0,4.3,1.12); clock.add(face);
    [-1,1].forEach(s=>{ clock.add(at(sph(1,1,.8,1,clay('#F2C64E'),16,12),s*1.9,7.6,0)); const l=cyl(.3,.3,1.6,clay('#7BB8A4'),8); l.position.set(s*2,.7,0); l.rotation.z=s*.4; clock.add(l); }); clock.add(at(cyl(.2,.2,1.2,clay('#7BB8A4'),8),0,8.2,0)); }
  knock(clock,-27,-8,3.6,'시계');
  // music box
  const mb=new THREE.Group(); { const pk=clay('#F3B6C6'); mb.add(at(mesh(rbox(8,3.4,5.6,.4,3),pk),0,1.7,0)); const lid=mesh(rbox(8,.6,5.6,.25,3),pk); lid.position.set(0,5.6,-3.1); lid.rotation.x=-1.2; mb.add(lid);
    const fig=new THREE.Group(); fig.position.set(0,3.4,0); fig.add(at(mesh(new THREE.ConeGeometry(.9,1.6,16),clay('#FFFDF8')),0,.8,0)); fig.add(at(sph(.5,1,1,1,clay('#F5C9A8')),0,1.9,0)); fig.add(at(sph(.25,1,1,1,clay('#7A4A2A')),0,2.4,0)); mb.add(fig);
    const cr=cyl(.2,.2,1.4,clay('#F2C64E'),8); cr.rotation.z=Math.PI/2; cr.position.set(4.6,1.8,0); mb.add(cr); mb.add(at(sph(.45,1,1,1,clay('#F2C64E')),5.3,2.4,0)); mb.userData.fig=fig; }
  const MB=knock(mb,-3,-6,4.6,'오르골');
  // hair tie, pill bottle, succulent, family photo
  const tie=new THREE.Group(); { const geo=new THREE.TorusGeometry(1.7,.6,12,36), p=geo.attributes.position; for(let i=0;i<p.count;i++){ const a=Math.atan2(p.getY(i),p.getX(i)), k=1+Math.sin(a*9)*.09; p.setX(i,p.getX(i)*k); p.setY(i,p.getY(i)*k); } geo.computeVertexNormals(); const m=mesh(geo,clay('#E88FB0')); m.rotation.x=Math.PI/2; m.position.y=.6; tie.add(m); }
  knock(tie,1,7,2.2,'머리끈');
  const pill=new THREE.Group(); pill.add(at(mesh(new THREE.CylinderGeometry(1.5,1.5,3.6,24),new THREE.MeshStandardMaterial({color:col('#F2A04A'),roughness:.2,transparent:true,opacity:.78})),0,1.8,0)); pill.add(at(cyl(1.62,1.62,1,clay('#FFFDF8'),24),0,4.1,0)); pill.add(at(cyl(1.53,1.53,1.6,clay('#FFFDF8'),24),0,1.7,0));
  knock(pill,-11,6,1.8,'약통');
  const suc=new THREE.Group(); suc.add(mesh(lathe([[0,0],[1.9,0],[2.5,2.8],[2.6,3],[2.3,3],[0,2.9]],28),clay('#BFD9EE')));
  for(let ring=0;ring<3;ring++){ const n=[8,6,4][ring]; for(let i=0;i<n;i++){ const a=i/n*Math.PI*2+ring*.4, l=sph(1,.6,.28,1.15-ring*.2,clay(['#7FBF9B','#8CCBA6','#A7DDB9'][ring]),12,8); l.position.set(Math.sin(a)*(1.6-ring*.5),3.2+ring*.5,Math.cos(a)*(1.6-ring*.5)); l.rotation.y=a; l.rotation.x=-.3-ring*.35; suc.add(l); } }
  knock(suc,-22,6,2.8,'다육이');
  const frame=new THREE.Group(); { const inner=new THREE.Group(); inner.rotation.x=-.16; inner.add(at(mesh(rbox(9.4,11.8,.7,.25,3),clay('#FBF6EC')),0,5.9,0));
    inner.add(at(new THREE.Mesh(new THREE.PlaneGeometry(7.8,10),new THREE.MeshStandardMaterial({map:ctex(156,200,(c)=>{ c.fillStyle='#CFE6F2'; c.fillRect(0,0,156,200); c.fillStyle='#BFDDA8'; c.fillRect(0,140,156,60);
      [[45,95,26,'#F5C9A8','#6B8FCB'],[108,90,28,'#F5C9A8','#E58FA6'],[78,128,19,'#F9D7BC','#F2C64E']].forEach(([x,y,r,sk,cl])=>{ c.fillStyle=cl; c.beginPath(); c.ellipse(x,y+r*1.9,r*1.1,r*1.3,0,0,7); c.fill(); c.fillStyle=sk; c.beginPath(); c.arc(x,y,r,0,7); c.fill(); c.fillStyle='#4A3826'; c.beginPath(); c.arc(x-r*.35,y,2.5,0,7); c.arc(x+r*.35,y,2.5,0,7); c.fill(); });
      c.fillStyle='#F0B274'; c.beginPath(); c.arc(128,168,13,0,7); c.fill(); c.beginPath(); c.moveTo(117,160); c.lineTo(119,148); c.lineTo(127,157); c.fill(); c.beginPath(); c.moveTo(139,160); c.lineTo(137,148); c.lineTo(129,157); c.fill(); }),roughness:.5})),0,5.9,.37)); frame.add(inner); }
  knock(frame,-13,-11.6,3.6,'가족사진');
  // snow globe lantern with Santa inside
  const GL={x:11,z:-6}, globe=new THREE.Group(); globe.position.set(GL.x,0,GL.z); g.add(globe);
  { const bz=clay('#3A2E28',{roughness:.45}); globe.add(at(mesh(rbox(7.4,1.6,7.4,.3,3),bz),0,.8,0)); globe.add(at(mesh(rbox(6.4,.8,6.4,.2,3),bz),0,1.9,0));
    [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([a,b])=>globe.add(at(mesh(new THREE.BoxGeometry(.5,10,.5),bz),a*2.85,7.2,b*2.85)));
    globe.add(at(mesh(rbox(6.8,.8,6.8,.2,3),bz),0,12.5,0)); const roof=mesh(new THREE.ConeGeometry(4.9,2.8,4),bz); roof.rotation.y=Math.PI/4; roof.position.y=14.3; globe.add(roof);
    const ringH=mesh(new THREE.TorusGeometry(.9,.18,8,20),bz); ringH.position.y=16.4; globe.add(ringH);
    globe.add(at(sph(2.7,1,.3,1,clay('#FFFFFF')),0,2.5,0));
    const tree=new THREE.Group(); [[1.5,2.2,0],[1.2,1.9,1.3],[.85,1.6,2.5]].forEach(([r,h,y])=>tree.add(at(mesh(new THREE.ConeGeometry(r,h,12),clay('#3E9B57')),0,y+h/2,0))); tree.position.set(-1.4,2.6,-.3); globe.add(tree); }
  const glassBox=new THREE.Mesh(new THREE.BoxGeometry(5.6,10,5.6),new THREE.MeshStandardMaterial({color:col('#CFE8F5'),roughness:.05,transparent:true,opacity:.22,depthWrite:false})); glassBox.position.y=7.3; globe.add(glassBox);
  const mini=makeSanta(); mini.scale.setScalar(.6); mini.position.set(.9,2.7,.3); globe.add(mini);
  const GN=110, gpos=new Float32Array(GN*3), gcol=new Float32Array(GN*3); for(let i=0;i<GN;i++){ gpos[i*3]=(Math.random()-.5)*5; gpos[i*3+1]=2.6+Math.random()*9; gpos[i*3+2]=(Math.random()-.5)*5; const c=col(['#FFFFFF','#F7D9E3','#CFE6F8','#FBEBA8','#C9F0D4'][i%5]); gcol[i*3]=c.r; gcol[i*3+1]=c.g; gcol[i*3+2]=c.b; }
  const glitGeo=new THREE.BufferGeometry(); glitGeo.setAttribute('position',new THREE.BufferAttribute(gpos,3)); glitGeo.setAttribute('color',new THREE.BufferAttribute(gcol,3));
  const glitter=new THREE.Points(glitGeo,new THREE.PointsMaterial({size:.32,vertexColors:true,transparent:true,opacity:.95})); globe.add(glitter);
  const G={broken:false,col:{x:GL.x,z:GL.z,r:4.4}}; Wd.globe=G; Wd.circles.push(G.col);
  placePot(Wd,27,-4,3);
  Wd.start={x:17,z:5,yaw:0}; Wd.hold=1300; Wd.goal='서랍장을 둘러보기';
  Wd.intro=()=>{ const d=clamp(46/(Math.tan(MU.degToRad(25))*camera.aspect),78,210); return {from:new V3(0,d*.32,d),look:new V3(0,-3,0)}; };
  Wd.mission=['거실 서랍장 위',`<p>이번엔 거실 TV 옆 서랍장 위예요. 땀땀이는 서랍장 오른쪽 끝에서 <b>3방울</b>을 기다리고 있어요.</p>
    <p>그런데 여기엔 물이 <b>스노우볼</b> 안에만 있어요. 단단한 스노우볼을 어떻게 열 수 있을까요? 우선 서랍장 위를 둘러보세요.</p>`];
  const cat=makeCat(); cat.visible=false; cat.rotation.order='YXZ'; g.add(cat); const C={x:-28,z:5,state:'hidden',pause:0,walk:0,rot:Math.PI/2,queue:[]}; Wd.cat=C;
  const me=()=>CHARS.find(c=>c.key===st.charKey).name;
  let PC=null, santa=null, mbPlay=0, mbT=0, mbFree=0, santaCall=0;
  Wd.onStart=async()=>{ await wait(500); sfx.meow(); bubble('야~옹',()=>new V3(-33,4,8),1800); await wait(1500); if(W!==Wd) return;
    await dialog(me(),'이게 무슨 소리지? 서랍장 왼쪽 끝에서 들린 것 같은데…'); setGoal('서랍장 왼쪽 끝으로 가 보기'); C.state='wait'; };
  Wd.camHint=()=>{ if(C.intro) return {look:new V3(C.x+3,5,C.z),pos:new V3(C.x+12,11,C.z+22)};
    if(C.state==='startled'||C.state==='atMB'||C.state==='toGlobe'||C.state==='paw'||C.state==='flee'){ const cx=lerp(C.x,GL.x,.35); return {look:new V3(cx,4,-2),pos:new V3(cx,25,37)}; } return null; };
  const catAppear=async()=>{ C.state='jump'; C.intro=true; const p=player.position; C.x=clamp(p.x-6.5,-31,31); C.z=clamp(p.z,-9,9); C.rot=Math.PI/2; cat.visible=true; sfx.whoosh(); st.lock++;
    await tween(.6,k=>{ cat.position.set(lerp(C.x-8,C.x,k),lerp(-40,0,k)+Math.sin(k*Math.PI)*16,lerp(C.z+26,C.z,k)); cat.rotation.y=C.rot; },lin);
    sfx.thud(); sfx.meow(); shove(1,0,4); bubble('야옹!',()=>new V3(C.x,11,C.z),1400); st.lock--; await wait(1300); if(W!==Wd) return;
    await dialog(me(),'으악, 깜짝이야! 고양이잖아. …오르골 태엽을 감아 고양이를 유인해 볼까?'); setGoal('오르골 태엽을 감아 고양이 유인하기'); C.intro=false; C.pause=.8; C.state='chase'; };
  const knockIt=(k)=>{ let kx=k.g.position.x-C.x, kz=Math.abs(k.g.position.z-C.z)+4; const kd=Math.hypot(kx,kz); k.fall={vx:kx/kd*11,vz:kz/kd*11+3,vy:0,sx:Math.random()*5-2.5,sz:Math.random()*5-2.5}; k.col.r=-10; sfx.thud(); toast(`${ig(k.name)} 떨어졌어요!`,1200); };
  const moveCat=(tx,tz,spd,dt,avoidGlobe)=>{ let dx=tx-C.x, dz=tz-C.z; const d=Math.hypot(dx,dz)||1; dx/=d; dz/=d; C.x+=dx*spd*dt; C.z+=dz*spd*dt; C.walk+=dt*spd*1.9;
    const T=Wd.pot, pd=dist2(C,T.pos), R=T.R+4.2; if(pd<R){ C.x=T.pos.x+(C.x-T.pos.x)/pd*R; C.z=T.pos.z+(C.z-T.pos.z)/pd*R; }
    if(avoidGlobe&&!G.broken){ const gd=dist2(C,GL), GR=4.4+3.8; if(gd<GR){ C.x=GL.x+(C.x-GL.x)/gd*GR; C.z=GL.z+(C.z-GL.z)/gd*GR+dt*3; } }
    C.x=clamp(C.x,-31,31); C.z=clamp(C.z,-10,10); let dr=Math.atan2(dx,dz)-C.rot; dr=Math.atan2(Math.sin(dr),Math.cos(dr)); C.rot+=dr*Math.min(1,dt*7); return {dx,dz}; };
  const knockNear=()=>{ const H={x:C.x+Math.sin(C.rot)*3,z:C.z+Math.cos(C.rot)*3}; for(const k of Wd.knock){ if(k===MB||k.fall||k.gone) continue; if(dist2(H,k)<k.r+3.2||dist2(C,k)<k.r+2.8) knockIt(k); } return H; };
  const topple=()=>{ G.broken=true; G.col.r=-10; C.state='flee'; cat.rotation.x=0; cat.scale.set(1,1,1); const sx=-1; sfx.thud();
    const E=new V3(GL.x+sx*3.7,0,GL.z), pivot=new THREE.Group(); pivot.position.copy(E); g.add(pivot); g.remove(globe); globe.position.set(-sx*3.7,0,0); pivot.add(globe); const axis=new V3(0,0,-sx);
    tween(.55,k=>pivot.quaternion.setFromAxisAngle(axis,k*Math.PI/2),easeIn).then(async()=>{
      sfx.glass(); sfx.splash(); glassBox.visible=false; glitter.visible=false; mini.visible=false;
      PC=new V3(GL.x+sx*10,0,GL.z+1.5); const pud=addPuddle(g,PC.x,PC.z,.1,.1,.2); tween(1.2,k=>pud.scale.set(7.5*k+.1,5*k+.1,1),easeOut);
      for(let i=0;i<26;i++){ const s=new THREE.Mesh(new THREE.CircleGeometry(.16,6),flat(['#FFFFFF','#F7D9E3','#CFE6F8','#FBEBA8'][i%4])); s.rotation.x=-Math.PI/2; s.position.set(PC.x+(Math.random()-.5)*13,.06,PC.z+(Math.random()-.5)*8); g.add(s); }
      for(let i=0;i<10;i++){ const sh=new THREE.Mesh(new THREE.CircleGeometry(.5,3),new THREE.MeshStandardMaterial({color:col('#DDF0F8'),transparent:true,opacity:.6,roughness:.05,side:THREE.DoubleSide})); sh.position.set(PC.x+(Math.random()-.5)*9,.08,PC.z+(Math.random()-.5)*7); sh.rotation.set(-Math.PI/2+(Math.random()-.5)*.3,0,Math.random()*6); g.add(sh); }
      sparkle(new V3(PC.x,3,PC.z),18);
      Wd.sources.push({name:'쏟아진 스노우볼 물',test:p=>dist2(p,PC)<7.2,from:()=>new V3(PC.x,.2,PC.z)});
      santa=makeSanta(); santa.scale.setScalar(.85); g.add(santa); const S=new V3(clamp(GL.x+sx*7,-30,30),0,GL.z+12), S0=new V3(GL.x+sx*8,1,GL.z);
      tween(.8,k=>{ santa.position.lerpVectors(S0,S,k); santa.position.y+=Math.sin(k*Math.PI)*4; },lin).then(()=>{ Wd.santa=santa; Wd.circles.push({x:S.x,z:S.z,r:1.8}); sfx.bell(); bubble('호호호!',()=>new V3(S.x,7,S.z),1600); });
      await wait(500); sfx.hiss(); bubble('냐아앙!!',()=>new V3(C.x,10,C.z),1500); const x0=C.x,z0=C.z;
      await tween(1.0,k=>{ cat.position.set(lerp(x0,x0-8,k),lerp(0,-40,k*k)+Math.sin(k*Math.PI)*8,lerp(z0,30,k)); cat.rotation.y=0; },lin);
      cat.visible=false; C.state='gone'; setGoal('산타에게 말 걸어 그릇 얻기'); toast('물을 싫어하는 고양이가 도망갔어요. 산타에게 말을 걸어 보세요',3000); }); };
  const atMB=async()=>{ await wait(400); if(W!==Wd) return; santaCall=2.4; sfx.bell(); bubble('여기야! 여기!',()=>new V3(GL.x,17,GL.z),2100); await wait(1600); if(W!==Wd) return;
    mbPlay=0; knockIt(MB); sfx.crash(); await wait(1000); if(W!==Wd) return; bubble('냥?',()=>new V3(C.x,11,C.z),900); await wait(700); setGoal('고양이가 스노우볼로 가는지 지켜보기'); C.wp=[[GL.x-3,7],[GL.x+7.2,GL.z+3]]; C.state='toGlobe'; };
  const pawGlobe=async()=>{ await wait(650); if(W!==Wd||G.broken) return; sfx.meow(); topple(); };
  const startHop=(tx,tz,h,dur)=>{ let dx=tx-C.x, dz=tz-C.z; const d=Math.hypot(dx,dz), Ln=Math.min(d,10); if(d>.3) C.rotT=Math.atan2(dx,dz);
    C.hop={x0:C.x,z0:C.z,x1:clamp(d>1e-3?C.x+dx/d*Ln:C.x,-31,31),z1:clamp(d>1e-3?C.z+dz/d*Ln:C.z,-10,10),t:0,dur:dur||(.3+Ln*.022),h:h||(2.6+Ln*.32)}; C.air=0; sfx.whoosh(); };
  const tune=()=>[784,659,784,880,784,659,523,587,659,587,523].forEach((f,i)=>tone(f,f,.5,.09,'sine',i*.42));
  const windMB=()=>{ if(mbPlay>0) return; mbPlay=1; mbT=0; mbFree=5; sfx.step();
    if(C.state==='chase'){ C.state='startled'; C.rotT=C.rot; startHop(C.x,C.z,8,.55); sfx.meow(); bubble('냐앗?!',()=>new V3(C.x,14,C.z),1300); setGoal('깜짝 놀란 고양이 지켜보기'); toast('오르골 소리에 고양이가 깜짝 놀라 폴짝폴짝 뛰어요!',2600); } };
  const talkSanta=async()=>{ const a=await dialog('스노우볼 산타','호호호, 유리 밖으로 나온 건 정말 오랜만이구나! 작은 친구야, 무엇을 도와줄까?',['땀땀이에게 줄 물을 담을 그릇이 필요해요','그냥 인사하러 왔어요']);
    if(a===1){ await dialog('스노우볼 산타','메리 크리스마스! 필요한 게 생기면 언제든 다시 오렴.'); return; }
    const b=await dialog('스노우볼 산타','그렇다면 내 선물 자루를 열어 보마. 마음에 드는 걸 하나 골라 보렴.',['병뚜껑 (3방울)','낙엽 (2방울)','종이 쪼가리 (2방울, 새요)','꽃잎 (1방울)']);
    const it=makeItem(['cap','leaf','paper','petal'][b]); Wd.items.push(it); if(st.carrying) putDown(true); attach(it); sfx.bell(); sparkle(carryWorldPos(),8); setGoal('쏟아진 물을 떠서 땀땀이에게 주기');
    await dialog('스노우볼 산타',`${eul(it.def.name)} 주마. 쏟아진 물을 떠다가 화분 친구에게 가져다주렴. 호호호!`); };
  Wd.actions=(p,c)=>{
    if(Wd.santa&&dist2(p,Wd.santa.position)<5&&!(c&&c.def.cap&&c.water<c.def.cap&&PC&&dist2(p,PC)<7.2)) return {label:'산타에게 말 걸기',key:'talk',btn:'말 걸기',run:talkSanta,ring:Wd.santa.position};
    if(!MB.fall&&!MB.gone&&dist2(p,MB)<7.4&&mbPlay<=0) return {label:C.state==='chase'?'오르골 태엽을 감아 고양이 유인하기':'오르골 태엽 감기',key:'mb',btn:'태엽 감기',run:windMB};
    if(!G.broken&&dist2(p,GL)<8) return {label:'단단한 스노우볼이에요. 안에서 산타가 손을 흔들어요'};
    return null; };
  Wd.update=(dt,t)=>{
    const p=player.position, active=st.mode==='play'&&!st.lock;
    if(glitter.visible){ const a=glitGeo.attributes.position; for(let i=0;i<GN;i++){ let y=a.getY(i)-dt*(.6+(i%5)*.25); if(y<2.6) y=11.6; a.setY(i,y); a.setX(i,a.getX(i)+Math.sin(t*2+i)*dt*.4); } a.needsUpdate=true; }
    if(mini.visible){ santaCall=Math.max(0,santaCall-dt); mini.position.y=2.7+(santaCall>0?Math.abs(Math.sin(t*11))*.9:0); mini.rotation.z=santaCall>0?Math.sin(t*14)*.2:Math.sin(t*2)*.05; }
    if(mbPlay>0){ mbT-=dt; if(mbT<=0){ tune(); mbT=4.8; } mb.userData.fig.rotation.y+=dt*3; if(Math.random()<dt*2.5) floatSprite(noteTex[Math.random()*3|0],new V3(MB.g.position.x,7,MB.g.position.z+2),1.5);
      if(C.state!=='startled'&&C.state!=='atMB'){ mbFree-=dt; if(mbFree<=0) mbPlay=0; } }
    if(santa&&Wd.santa){ santa.position.y=Math.abs(Math.sin(t*2.4))*.25; santa.rotation.y=Math.atan2(p.x-santa.position.x,p.z-santa.position.z); }
    for(const k of Wd.knock){ if(!k.fall) continue; const f=k.fall, gp=k.g.position; gp.x+=f.vx*dt; gp.z+=f.vz*dt;
      if(gp.z>15.6||Math.abs(gp.x)>36.6){ f.vy-=70*dt; gp.y+=f.vy*dt; k.g.rotation.x+=f.sx*dt; k.g.rotation.z+=f.sz*dt; }
      if(gp.y<-44){ k.g.visible=false; k.fall=null; k.gone=true; if(k===MB) sfx.crash(); else sfx.thud(); } }
    if(C.state==='wait'&&active&&p.x<-19) catAppear();
    if(C.state==='chase'){ C.pause=Math.max(0,C.pause-dt);
      if(C.pause<=0&&active){ const m=moveCat(p.x,p.z,4.3,dt,true), H=knockNear(); if(dist2(H,p)<3.4){ shove(m.dx,m.dz,7); C.pause=1.4; sfx.meow(); toast('냥펀치! 고양이에게 밀려났어요',1500); } } }
    if(C.hop){ const h=C.hop; h.t+=dt; const k=Math.min(1,h.t/h.dur); C.x=lerp(h.x0,h.x1,k); C.z=lerp(h.z0,h.z1,k); C.y=Math.sin(k*Math.PI)*h.h; C.pitch=-Math.cos(k*Math.PI)*.38; C.air=k;
      let dr=C.rotT-C.rot; dr=Math.atan2(Math.sin(dr),Math.cos(dr)); C.rot+=dr*Math.min(1,dt*16);
      if(k>=1){ C.hop=null; C.y=0; C.pitch=0; C.land=.2; sfx.thud(); if(C.state==='startled') knockNear(); } }
    else if(active){ C.land=Math.max(0,(C.land||0)-dt);
      if(C.land<=0&&C.state==='startled'){ let best=null,bd=1e9; for(const k of Wd.knock){ if(k===MB||k.fall||k.gone) continue; const d=dist2(C,k); if(d<bd){bd=d;best=k;} }
        if(best) startHop(best.x,best.z);
        else if(dist2(C,MB)<MB.r+5){ C.state='atMB'; C.rotT=Math.atan2(MB.x-C.x,MB.z-C.z); atMB(); }
        else startHop(MB.x+(C.x>MB.x?1:-1)*(MB.r+3.4),MB.z+3); }
      if(C.land<=0&&C.state==='toGlobe'){ const wp=C.wp[0]; if(dist2(C,{x:wp[0],z:wp[1]})<1.2){ C.wp.shift(); if(!C.wp.length){ C.state='paw'; C.rotT=-Math.PI/2; pawGlobe(); } } else startHop(wp[0],wp[1]); } }
    if(C.state==='atMB'||C.state==='paw'){ let dr=C.rotT-C.rot; dr=Math.atan2(Math.sin(dr),Math.cos(dr)); C.rot+=dr*Math.min(1,dt*8); }
    const onTop=C.state==='chase'||C.state==='startled'||C.state==='toGlobe'||C.state==='atMB'||C.state==='paw', walking=C.state==='chase'&&C.pause<=0&&active;
    if(onTop){ const sq=C.land>0?1-Math.sin(C.land/.2*Math.PI)*.16:1; cat.position.set(C.x,(C.y||0)+(walking?Math.abs(Math.sin(C.walk))*.5:0),C.z); cat.rotation.set(C.pitch||0,C.rot,walking?Math.sin(C.walk)*.05:0); cat.scale.set(2-sq,sq,2-sq); }
    if(cat.visible){ const u=cat.userData;
      u.legs.forEach((l,i)=>{ const front=i<2; if(C.hop) l.rotation.x=(front?-1:1)*(.9-C.air*.5); else if(walking) l.rotation.x=Math.sin(C.walk+(i%3?Math.PI:0))*.55; else l.rotation.x*=.8; });
      if(C.state==='chase'&&C.pause>.9) u.legs[1].rotation.x=-1.5; if(C.state==='paw') u.legs[0].rotation.x=-1.2-Math.sin(t*18)*.3;
      u.tail.rotation.x=C.hop?-.5:Math.sin(t*2)*.08; u.tail.rotation.z=Math.sin(t*(C.state==='startled'?9:2.5))*(C.state==='startled'?.3:.15);
      u.head.rotation.z=Math.sin(t*1.7)*.06; u.head.rotation.x=walking?Math.sin(C.walk*2)*.05:(C.state==='atMB'?Math.sin(t*3)*.12:0); }
  };
  return Wd;
}

/* ===== stage 3 : the apartment veranda ===== */
function buildVeranda(){
  const Wd=newWorld(), g=Wd.group; Wd.name='3단계 베란다'; Wd.bounds={x0:-17.5,x1:17.5,z0:-49,z1:47};
  Wd.light={bg:'#D6E8F4',sky:'#FFFFFF',ground:'#B9B2A6',hemi:.85,sunCol:'#FFF3D6',sun:1.25,sunPos:[45,75,20],range:64,fill:.3,fillCol:'#DCEBFA',fillPos:[-30,40,20],fog:[220,580]};
  const tile=ctex(128,128,(c)=>{ c.fillStyle='#CFC9BE'; c.fillRect(0,0,128,128); c.fillStyle='#D8D3C9'; c.fillRect(3,3,122,122); }); tile.wrapS=tile.wrapT=THREE.RepeatWrapping; tile.repeat.set(5,14);
  const fl=mesh(new THREE.PlaneGeometry(42,112),new THREE.MeshStandardMaterial({map:tile,roughness:.55}),false,true); fl.rotation.x=-Math.PI/2; g.add(fl);
  const wm=clay('#F4F1EA'), al=clay('#D9DDE0',{roughness:.4});
  g.add(at(mesh(new THREE.BoxGeometry(1,140,112),wm,false,true),-20.5,70,0));
  g.add(at(mesh(rbox(.8,56,36,.3,2),clay('#FBFAF6')),-19.9,62,20)); g.add(at(mesh(new THREE.BoxGeometry(.3,50,30),gloss('#7FB8B4',{roughness:.15})),-19.6,62,20));
  g.add(at(mesh(new THREE.BoxGeometry(42,140,1),wm,false,true),0,70,-55.5)); g.add(at(mesh(rbox(24,76,.8,.4,2),clay('#FBFAF6')),0,38,-54.8)); g.add(at(sph(.9,1,1,1,al),8.5,36,-54.2));
  g.add(at(mesh(new THREE.BoxGeometry(42,140,1),wm,false,true),0,70,56)); g.add(at(mesh(rbox(30,84,.8,.4,2),clay('#E9E4DA')),0,42,55.2)); g.add(at(mesh(new THREE.BoxGeometry(26,78,.3),gloss('#BFDDEA',{transparent:true,opacity:.5})),0,42,54.7));
  g.add(at(mesh(new THREE.BoxGeometry(1.5,14,112),clay('#EDEAE3')),20.7,7,0)); g.add(at(mesh(rbox(3,1,112,.3,2),al),20,14.5,0)); g.add(at(mesh(new THREE.BoxGeometry(1.2,2,112),al),20.5,126,0));
  [-55,-20,10,40,55].forEach(z=>g.add(at(mesh(new THREE.BoxGeometry(1.2,112,1.6),al),20.5,70,z)));
  const gm=new THREE.MeshStandardMaterial({color:col('#CFE6F2'),roughness:.05,transparent:true,opacity:.2,depthWrite:false});
  g.add(at(new THREE.Mesh(new THREE.BoxGeometry(.2,110,34),gm),20.5,70,-37.5)); g.add(at(new THREE.Mesh(new THREE.BoxGeometry(.2,110,14),gm),20.5,70,47.5));
  g.add(at(new THREE.Mesh(new THREE.BoxGeometry(.2,110,30),gm),20.5,70,25)); g.add(at(new THREE.Mesh(new THREE.BoxGeometry(.2,110,30),gm),19.6,70,25)); g.add(at(mesh(new THREE.BoxGeometry(1,112,1.4),al),19.6,70,10.4));
  for(let z=-52;z<=52;z+=5) g.add(at(cyl(.35,.35,40,clay('#C7CCD1'),8),24.5,34,z)); g.add(at(mesh(new THREE.BoxGeometry(.9,.9,112),clay('#C7CCD1')),24.5,54,0));
  const out=new THREE.Mesh(new THREE.PlaneGeometry(700,360),new THREE.MeshBasicMaterial({fog:false,map:ctex(512,256,(c)=>{ const gr=c.createLinearGradient(0,0,0,256); gr.addColorStop(0,'#8EC5EE'); gr.addColorStop(.7,'#D9EEF9'); c.fillStyle=gr; c.fillRect(0,0,512,256);
    c.fillStyle='#FFFFFF'; [[90,50,40],[130,60,30],[360,40,36],[400,52,28]].forEach(([x,y,r])=>{ c.beginPath(); c.arc(x,y,r,0,7); c.fill(); });
    [[20,110,70],[110,80,60],[190,125,80],[290,95,64],[370,130,60],[440,100,72]].forEach(([x,y,w],i)=>{ c.fillStyle=['#D8D2C8','#E4DED4','#CFCAC0'][i%3]; c.fillRect(x,y,w,256-y); c.fillStyle='rgba(120,150,175,.55)'; for(let yy=y+8;yy<250;yy+=14) for(let xx=x+6;xx<x+w-8;xx+=12) c.fillRect(xx,yy,7,8); });
    c.fillStyle='#8DBB7C'; c.fillRect(0,236,512,20); })})); out.rotation.y=-Math.PI/2; out.position.set(200,70,0); g.add(out);
  const roll=cyl(2.6,2.6,104,clay('#F1EBDD'),20); roll.rotation.x=Math.PI/2; roll.position.set(18.4,121,0); g.add(roll); g.add(at(cyl(.12,.12,28,clay('#F1EBDD'),6),18.4,105,34)); g.add(at(sph(.7,1,1.4,1,clay('#F1EBDD')),18.4,91,34));
  g.add(at(mesh(new THREE.BoxGeometry(42,1,112),wm,false,true),0,132.5,0));
  [-7,7].forEach(x=>{ const b=cyl(.5,.5,78,clay('#E6E8EA'),10); b.rotation.x=Math.PI/2; b.position.set(x,110,0); g.add(b); [-30,30].forEach(z=>g.add(at(cyl(.3,.3,22,clay('#E6E8EA'),6),x,121,z))); });
  [[-7,-26,'#F2A5A0',15],[-7,-10,'#FFFDF8',19],[-7,8,'#A9C8F0',15],[-7,24,'#F4D76A',12],[7,-20,'#BFE6C9',19],[7,-2,'#FFFDF8',15],[7,16,'#E9B7D4',15],[7,30,'#9FC3E8',19]].forEach(([x,z,c,h])=>{ const m=mesh(rbox(12,h,1.2,.5,3),clay(c)); m.position.set(x,109-h/2,z); m.rotation.y=(Math.random()-.5)*.2; g.add(m); });
  // orchid
  const orch=potShape(5.5,8,'#F7F4EE'); orch.position.set(10,0,30); g.add(orch); Wd.circles.push({x:10,z:30,r:6});
  for(let i=0;i<6;i++){ const a=i/6*Math.PI*2+.3, lg=new THREE.Group(); lg.rotation.y=a; lg.position.y=7.5; const l=sph(1,1.5,.28,7,clay('#4E9457'),14,10); l.position.set(0,4.5,5); l.rotation.x=-.75; lg.add(l); orch.add(lg); }
  orch.add(tube([[0,7.5,0],[.5,18,.5],[2.5,27,1.5],[6,31,2.5]],.28,clay('#6FA85B'),20));
  [[2.6,27,1.5],[4.2,29.5,2.1],[6,31,2.6]].forEach(([x,y,z])=>{ const f=new THREE.Group(); f.position.set(x,y,z+.8); for(let i=0;i<5;i++){ const a=i/5*Math.PI*2, p=sph(1,1.1,.7,.25,clay('#FBF3F7'),12,10); p.position.set(Math.cos(a)*.9,Math.sin(a)*.9,0); p.rotation.z=a; f.add(p); } f.add(at(sph(.4,1,1,1,clay('#D9589A'),10,8),0,0,.25)); orch.add(f); });
  // lettuce planter
  g.add(at(mesh(rbox(18,7,8,.8,3),clay('#A9744B')),-9,3.5,13)); g.add(at(mesh(new THREE.BoxGeometry(16.6,.4,6.6),clay('#6B4A33')),-9,6.9,13)); Wd.boxes.push({x0:-18,z0:9,x1:0,z1:17});
  [-14.5,-9,-3.5].forEach(x=>{ const hgp=new THREE.Group(); hgp.position.set(x,7,13); for(let ring=0;ring<2;ring++){ const n=ring?5:8; for(let i=0;i<n;i++){ const a=i/n*Math.PI*2+ring*.5, l=sph(1,1.5-ring*.4,.3,2-ring*.5,clay(ring?'#B9E086':'#9ED36A'),12,8); l.position.set(Math.sin(a)*(1.5-ring*.8),1+ring*.8,Math.cos(a)*(1.5-ring*.8)); l.rotation.y=a; l.rotation.x=-.5-ring*.5; hgp.add(l); } } g.add(hgp); });
  // tomato
  const tom=potShape(6,9,'#EDE6DA'); tom.position.set(9,0,-6); g.add(tom); Wd.circles.push({x:9,z:-6,r:6.5});
  tom.add(at(cyl(.3,.3,36,clay('#B98A5A'),8),.6,26,0)); tom.add(tube([[0,8.5,0],[-.8,16,.6],[.9,24,-.5],[-.3,32,.4],[.5,40,0]],.4,clay('#5C9C4E'),30));
  for(let i=0;i<12;i++){ const a=i*2.4, y=13+i*2.3, l=sph(1,2.4,.25,1.2,clay('#4F8F4A'),12,8); l.position.set(Math.cos(a)*2.6,y,Math.sin(a)*2.6); l.rotation.y=-a; l.rotation.z=.3; tom.add(l); }
  [[2.8,17,1.5],[3.4,15.5,.4],[2.2,15.2,2.2],[-2.8,22,-1],[-3.2,20.4,.2],[1.5,28,-2.6],[2.4,26.6,-2],[-1.8,31,2.2]].forEach(([x,y,z],i)=>tom.add(at(sph(.95,1,.95,1,gloss(i===6?'#9CC356':'#E5392E',{roughness:.3})),x,y,z)));
  // carnation
  const car=potShape(5,8,'#F2D5DA'); car.position.set(-9,0,-24); g.add(car); Wd.circles.push({x:-9,z:-24,r:5.5});
  [[0,0,22,'#E2485A'],[2,1,18,'#F29BB0'],[-2,1.2,19.5,'#E2485A'],[1,-2,16,'#F7C3D0'],[-1.6,-1.6,17,'#F29BB0']].forEach(([x,z,h,c])=>{ car.add(tube([[x*.4,7.5,z*.4],[x*.8,7.5+(h-7.5)*.5,z*.8],[x,h,z]],.2,clay('#6FA85B'),10));
    for(let k=0;k<3;k++){ const m=mesh(new THREE.IcosahedronGeometry(1.5-k*.3,1),clay(c,{flatShading:true})); m.scale.y=.55; m.position.set(x,h+k*.45,z); m.rotation.y=k; car.add(m); }
    const l=sph(1,.3,.12,2.4,clay('#7FB58A'),8,6); l.position.set(x*.6+.6,7.5+(h-7.5)*.45,z*.6); l.rotation.set(.9,Math.random()*6,0); car.add(l); });
  placePot(Wd,0,-44,5);
  // faucet + hose
  const fa=new THREE.Group(); fa.position.set(-19.9,8.6,-4); g.add(fa); const metal=new THREE.MeshStandardMaterial({color:col('#C9CED3'),roughness:.3,metalness:.6});
  { const b=cyl(.8,.8,3.4,metal,16); b.rotation.z=Math.PI/2; b.position.x=1.7; fa.add(b); fa.add(at(cyl(.6,.6,2.2,metal,14),3.0,-1.0,0)); fa.add(at(cyl(.3,.3,1.6,metal,10),1.7,1.3,0)); }
  const hd=new THREE.Group(); hd.position.set(1.7,2.2,0); hd.add(mesh(rbox(3.2,.6,1,.28,3),clay('#4F8FD0'))); hd.add(mesh(rbox(1,.6,3.2,.28,3),clay('#4F8FD0'))); fa.add(hd);
  const FA={x:-18.2,z:-4,count:0,slots:[new V3(-18.9,11.75,-4),new V3(-17.5,11.75,-4)],toms:[]};
  const base=[[-16.9,6.4,-4],[-16.6,2.4,-4.1],[-14.5,.5,-2.5],[-9,.5,1],[-3,.5,0],[1.6,1.6,-3],[4.4,9.7,-5.5],[3.3,9.5,-9.5],[.5,2,-14],[-2.5,.6,-18]].map(p=>new V3(...p));
  const hoseMat=clay('#5FAE6E',{roughness:.45}); let hoseMesh=null; const HO={state:'idle',ck:0,end:new V3(),dir:new V3(0,1,0),fillT:0};
  const TARGET=new V3(0,7.2*TS+4.5,-44), CTRL=new V3(3,30,-26), _a=new V3(), _b=new V3(), _c=new V3();
  const hosePts=(t)=>{ const n=base.length, out=[]; for(let i=0;i<n;i++){ const p=base[i].clone(), u=Math.max(0,(i-4)/(n-5));
      if(HO.state==='flail'&&i>6){ const amp=(i-6)/(n-7)*(1-HO.ck)*5.5; p.x+=Math.sin(t*7+i*1.3)*amp; p.y+=Math.abs(Math.sin(t*5.3+i))*amp*1.3; p.z+=Math.cos(t*6.1+i*.7)*amp; }
      if(HO.ck>0&&i>4){ _a.lerpVectors(base[4],CTRL,u); _b.lerpVectors(CTRL,TARGET,u); _a.lerp(_b,u); p.lerp(_a,HO.ck); }
      out.push(p); } return out; };
  const rebuild=(t)=>{ const pts=hosePts(t); if(hoseMesh){ g.remove(hoseMesh); hoseMesh.geometry.dispose(); } hoseMesh=mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),70,.36,8),hoseMat); g.add(hoseMesh);
    HO.end.copy(pts[pts.length-1]); HO.dir.subVectors(pts[pts.length-1],pts[pts.length-2]).normalize(); };
  rebuild(0);
  const spray=[]; for(let i=0;i<110;i++){ const m=mesh(new THREE.SphereGeometry(.42,8,6),dropMat,false,false); m.visible=false; g.add(m); spray.push({m,v:new V3(),life:0}); }
  const emit=(pos,vel)=>{ const s=spray.find(s=>s.life<=0); if(!s) return; s.m.position.copy(pos); s.v.copy(vel); s.life=1.6; s.m.visible=true; };
  // fallen cherry tomatoes
  [[5,3],[12,5],[2,8],[14,-2],[-4,6]].forEach(([x,z])=>placeItem(Wd,'tomato',x,z));
  // sparrow
  const sp=makeSparrow(); g.add(sp); const S={state:'peck',busy:false,x:7,z:2,hopT:1}; sp.position.set(S.x,0,S.z);
  // ladybugs
  const bugs=[new V3(-9,9.4,13.5),new V3(11.2,22.5,-4),new V3(-9,15.5,-22.5)].map(h=>{ const b=makeLadybug(); b.position.copy(h); g.add(b); return {g:b,home:h,fly:false}; });
  const LB={state:'hidden'};
  Wd.start={x:0,z:43,yaw:0}; Wd.intro=()=>{ const k=camera.aspect<.8?1.25:1; return {from:new V3(-7,84*k,53),look:new V3(1,0,-12)}; }; Wd.hold=1600; Wd.dist=18; Wd.camH=.72; Wd.camClamp={x0:-18,x1:18,z0:-52,z1:53}; Wd.goal='방울토마토 두 개를 수도꼭지 위로 던지기';
  Wd.camHint=(p)=>{ if(!(st.carrying&&st.carrying.type==='tomato'&&S.state==='peck'&&dist2(p,FA)<17)) return null; let dx=p.x-FA.x, dz=p.z-FA.z; const d=Math.hypot(dx,dz)||1; return {look:new V3(-15,8,-4),pos:new V3(p.x+dx/d*13,10,p.z+dz/d*13)}; };
  Wd.mission=['햇살 드는 베란다',`<p>마지막은 아파트 베란다예요. 땀땀이는 난, 상추, 토마토, 카네이션 화분을 모두 지나 저 끝에 있어요.</p>
    <p>그런데 열린 창문으로 <b>참새</b>가 들어와 토마토를 쪼아 먹으며 길을 막고 있어요. 바닥에 떨어진 <b>방울토마토</b>를 주워 벽에 달린 <b>수도꼭지 위로 두 개</b> 던져 보세요. 참새가 수도꼭지에 내려앉으면 재미있는 일이 생길 거예요.</p>
    <p>잎사귀 사이에는 무당벌레 친구들이 숨어 있어요.</p>`];
  const throwTomato=()=>{ const c=st.carrying; if(!c||st.busy) return; st.busy=true; const from=carryWorldPos(), slot=FA.slots[FA.count]; st.anchor.remove(c.group); st.carrying=null; renderCarry();
    Wd.items.splice(Wd.items.indexOf(c),1); g.add(c.group); c.carried=true; sfx.whoosh();
    tween(.7,k=>{ c.group.position.lerpVectors(from,slot,k); c.group.position.y+=Math.sin(k*Math.PI)*7-.6*k; c.group.rotation.x=k*8; },lin).then(()=>{ c.group.position.copy(slot).y-=.6; c.group.rotation.set(0,0,0); FA.toms.push(c.group); FA.count++; st.busy=false; sfx.plop();
      if(FA.count>=2) sparrowToFaucet(); else toast('하나 더 올려 보세요',1500); }); };
  const flyTo=(obj,to,dur,arc)=>{ const from=obj.position.clone(); return tween(dur,k=>{ obj.position.lerpVectors(from,to,k); obj.position.y+=Math.sin(k*Math.PI)*arc; obj.rotation.y=Math.atan2(to.x-from.x,to.z-from.z); },easeIO); };
  const sparrowToFaucet=async()=>{ S.state='fly'; st.mode='cut'; setGoal(''); st.cinePos.copy(camera.position); st.cineLook.copy(st.camLook); st.cine=true; cineTo(new V3(4,36,24),new V3(-6,4,-3),1.0);
    sfx.chirp(); bubble('짹?',()=>sp.position.clone().setY(8),1100); await wait(1000); if(W!==Wd) return;
    cineTo(new V3(-2,15,10),new V3(-16,10,-4),1.3); await flyTo(sp,new V3(-18.2,11.2,-4),1.3,10); sp.rotation.y=Math.PI/2; S.state='eat';
    for(let i=0;i<2;i++){ await wait(650); sfx.chirp(); FA.toms[i].visible=false; }
    toast('참새가 수도꼭지 손잡이를 밟았어요!',1800); await tween(.9,k=>{ hd.rotation.y=k*Math.PI*1.5; sp.rotation.y=Math.PI/2+k*1.2; },easeIO);
    HO.state='flail'; Wd.waterOn=true; sfx.splash(); toast('호스에서 물이 쏟아져요!',2000); cineTo(new V3(-8,32,12),new V3(-5,4,-12),.9); await wait(1300); sfx.splash(); await wait(1300); sfx.chirp(); sfx.chirp(.2); bubble('짹짹짹!!',()=>sp.position.clone().setY(16),1300);
    S.state='fly'; await cineTo(new V3(-14,24,18),new V3(-16,12,-4),.7); const fl=flyTo(sp,new V3(74,50,6),2.6,6); tween(2.6,()=>{ st.cineLook.lerp(sp.position,.3); },lin); await fl; sp.visible=false; S.state='gone'; toast('참새가 창밖으로 달아났어요!',1800); await wait(900); if(W!==Wd) return;
    ladybugFlow(); };
  const ladybugFlow=async()=>{ LB.state='come'; sfx.buzz(); const p=player.position; st.mode='cut'; st.cine=true; cineTo(new V3(p.x*.5,40,p.z+26),new V3(p.x*.5-2,6,p.z-8),1.2);
    await Promise.all(bugs.map((b,i)=>{ b.fly=true; const a=i/3*Math.PI*2; return flyTo(b.g,new V3(p.x+Math.cos(a)*2.4,2.4,p.z+Math.sin(a)*2.4-1),2.2,7); }));
    cineTo(new V3(p.x,19,p.z+8),new V3(p.x,2,p.z-.5),1.0);
    LB.state='joy'; LB.t0=time; bubble('야호! 참새가 갔다! 고마워!',()=>player.position.clone().setY(6.5),2600); [0,.18,.36,.6,.78].forEach((d,i)=>tone(1200+i*180,1500+i*180,.12,.08,'sine',d)); await wait(2800); if(W!==Wd) return;
    LB.state='talk'; await dialog('무당벌레들','정말 고마워! 참새가 무서워서 잎사귀 사이에 꼭꼭 숨어 있었어. 우리가 도와줄 일 없을까?',['저 끝의 땀땀이에게 물을 줘야 해요']);
    await dialog('무당벌레들','그 귀여운 화분 말이지? 좋아, 우리 셋이 호스 끝을 붙잡고 날아갈게. 물길을 만들어 줄 테니 따라와!'); if(W!==Wd) return;
    sfx.buzz(); await Promise.all(bugs.map((b,i)=>flyTo(b.g,HO.end.clone().add(new V3((i-1)*.9,1.2,0)),1.4,5)));
    LB.state='carry'; HO.state='carry'; toast('무당벌레들이 호스를 옮겨요',2200); await tween(4.6,k=>{ HO.ck=k; st.cineLook.lerp(HO.end,.1); st.cinePos.lerp(_c.set(HO.end.x+8,HO.end.y*.4+28,HO.end.z+24),.06); },easeIO); HO.state='pour';
    const T=Wd.pot; while(!T.full&&W===Wd) await wait(200); if(W!==Wd) return; await wait(900); st.focus=1; const f=calcFollow(); await cineTo(f.pos,f.look,1.4); st.cine=false; st.mode='play'; renderPot(); };
  Wd.actions=(p,c)=>{
    if(c&&c.type==='tomato'){ if(FA.count<2&&S.state==='peck'){ if(dist2(p,FA)<13) return {label:'수도꼭지 위로 방울토마토 던지기',key:'throw',btn:'던지기',run:throwTomato}; return {label:'왼쪽 벽의 수도꼭지 가까이 가서 던져요'}; } return {label:'방울토마토를 들고 있어요'}; }
    return null; };
  Wd.update=(dt,t)=>{
    const p=player.position;
    // sparrow
    if(sp.visible){ const u=sp.userData;
      if(S.state==='peck'&&!S.busy){ S.hopT-=dt; if(S.hopT<=0){ S.hopT=1.2+Math.random()*1.5; const to=new V3(3+Math.random()*9,0,-1+Math.random()*6); S.busy=true; flyTo(sp,to,.4,1.6).then(()=>{ S.x=to.x; S.z=to.z; S.busy=false; }); }
        u.head.rotation.x=Math.max(0,Math.sin(t*9))*.7; u.wings.forEach(w=>w.rotation.z=0);
        if(p.z<-6.5&&st.mode==='play'&&!st.lock){ S.busy=true; sfx.chirp(); sfx.chirp(.15); flyTo(sp,new V3(p.x,0,p.z-3.5),.35,3).then(()=>{ sp.rotation.y=0; bubble('짹짹!',()=>sp.position.clone().setY(8),1200); shove(0,1,11); toast('참새가 길을 막았어요. 먼저 참새를 쫓아야 해요',2400); S.hopT=1.6; S.x=sp.position.x; S.z=sp.position.z; S.busy=false; }); } }
      else if(S.state==='eat'){ u.head.rotation.x=Math.max(0,Math.sin(t*12))*.8; }
      if(S.state==='fly'||S.busy){ u.wings.forEach((w,i)=>w.rotation.z=(i?1:-1)*(.6+Math.sin(t*40)*.8)); u.head.rotation.x=0; } }
    // ladybugs
    bugs.forEach((b,i)=>{ b.g.userData.wings.forEach((w,j)=>{ w.visible=b.fly; w.rotation.y=(j?1:-1)*Math.sin(t*60)*.5; });
      if(LB.state==='talk') b.g.position.y=2.4+Math.sin(t*4+i)*.3;
      if(LB.state==='joy'){ const a=(t-LB.t0)*5+i*Math.PI*2/3, pp=player.position; b.g.position.set(pp.x+Math.cos(a)*2.8,2.6+Math.abs(Math.sin(t*7+i))*1.6,pp.z+Math.sin(a)*2.8); b.g.rotation.y=-a; if(Math.random()<dt*2.2) floatSprite(heartTex,b.g.position.clone().setY(b.g.position.y+1),1.1); }
      if(LB.state==='carry'||HO.state==='pour'){ b.g.position.set(HO.end.x+(i-1)*.9,HO.end.y+1.1+Math.sin(t*5+i)*.15,HO.end.z); }
      else if(!b.fly) b.g.rotation.y=Math.sin(t*.8+i)*.6; });
    // hose + water
    if(HO.state!=='idle'){ rebuild(t);
      if(HO.state==='flail'||HO.state==='carry'){ for(let k=0;k<3;k++) emit(HO.end,_a.copy(HO.dir).multiplyScalar(11).add(new V3((Math.random()-.5)*9,9+Math.random()*8,(Math.random()-.5)*9)).multiplyScalar(1-HO.ck*.7)); }
      if(HO.state==='pour'){ emit(HO.end,new V3((Math.random()-.5)*.8,-9,(Math.random()-.5)*.8)); const T=Wd.pot; if(T.thirsty){ HO.fillT+=dt; if(HO.fillT>.55){ HO.fillT=0; T.have++; T.bounce=1; sfx.plop(); renderPot(); if(T.have>=T.need) potFull(); } } else if(HO.state==='pour'&&T.full&&!HO.stopT){ HO.stopT=1; setTimeout(()=>{ if(W===Wd) HO.state='done'; },1500); } } }
    for(const s of spray){ if(s.life<=0) continue; s.life-=dt; s.v.y-=30*dt; s.m.position.addScaledVector(s.v,dt); if(s.m.position.y<.1||s.life<=0){ s.life=0; s.m.visible=false; } }
  };
  return Wd;
}

/* ---------- player ---------- */
const player=new THREE.Group(); player.visible=false; scene.add(player);
let PCh=null;
function setPlayerChar(key){ if(PCh) player.remove(PCh.g); PCh=makeCharacter(key); player.add(PCh.g); st.charKey=key; st.anchor=PCh.anchor; $('myName').textContent=CHARS.find(c=>c.key===key).name; }
const ring=new THREE.Mesh(new THREE.RingGeometry(.9,1.15,40),flat('#4FA9EC',{transparent:true,opacity:0,depthWrite:false})); ring.rotation.x=-Math.PI/2; ring.position.y=.07; scene.add(ring);

function setWorld(Wd){
  if(st.carrying){ st.anchor.remove(st.carrying.group); st.carrying=null; }
  flyers.forEach(f=>scene.remove(f.m)); flyers.length=0; notes.forEach(n=>scene.remove(n)); notes.length=0; sparks.forEach(s=>scene.remove(s)); sparks.length=0;
  st.busy=false; st.perf=null; jugDrops.length=0; st.hint=null; st.hintK=0;
  if(W) scene.remove(W.group); W=Wd; scene.add(W.group); setLights(W.light);
}

/* ---------- HUD ---------- */
function renderPot(){ const T=W&&W.pot; if(!T) return; const d=$('potDrops'); d.innerHTML='';
  if(T.full) $('potTxt').textContent=st.perf?{dance:'땀땀이가 춤추는 중',sing:'땀땀이가 노래하는 중',juggle:'땀땀이가 저글링하는 중'}[st.perf.type]:'땀땀이가 활짝 웃어요';
  else { $('potTxt').textContent='땀땀이가 목말라요'; for(let i=0;i<T.need;i++){ const s=document.createElement('span'); s.className='dropi'+(i<T.have?' on':''); d.appendChild(s); } }
  $('fullPanel').classList.toggle('show',!!T.full&&st.mode==='play'); $('nextBtn').textContent=st.stage<3?'다음 스테이지로':'꿈에서 깨기'; }
function renderCarry(){ const c=st.carrying; $('carryTxt').textContent=c?(c.def.cap?`${c.def.name}, 물 ${c.water}/${c.def.cap}방울`:`${c.def.name} 들고 있음`):'빈손이에요'; $('dropBtn').classList.toggle('on',!!c); }

/* ---------- input ---------- */
const keys={}; const canPlay=()=>st.mode==='play'&&!st.lock;
addEventListener('keydown',e=>{ const k=e.key.toLowerCase(); if(k===' '||k==='f'||k==='ㄹ'||k==='enter'){ if(st.confirm){ e.preventDefault(); st.confirm(); return; } }
  if(!canPlay()) return; keys[k]=true; if(k==='f'||k==='ㄹ'||k===' '){ e.preventDefault(); doAction(); } if(k==='q'||k==='ㅂ') putDown(); if(k==='1') perform('dance'); if(k==='2') perform('sing'); if(k==='3') perform('juggle'); });
addEventListener('keyup',e=>{ keys[e.key.toLowerCase()]=false; });
let joy={x:0,y:0,id:null}; const joyEl=$('joy'), knob=$('joyKnob');
function moveJoy(e){ const r=joyEl.getBoundingClientRect(); let dx=e.clientX-(r.left+r.width/2), dy=e.clientY-(r.top+r.height/2); const m=Math.hypot(dx,dy), R=r.width/2-14; if(m>R){dx*=R/m;dy*=R/m;} knob.style.transform=`translate(${dx}px,${dy}px)`; joy.x=dx/R; joy.y=-dy/R; }
joyEl.addEventListener('pointerdown',e=>{ joy.id=e.pointerId; joyEl.setPointerCapture(e.pointerId); moveJoy(e); });
joyEl.addEventListener('pointermove',e=>{ if(e.pointerId===joy.id) moveJoy(e); });
const endJoy=e=>{ if(e.pointerId===joy.id){ joy={x:0,y:0,id:null}; knob.style.transform=''; } };
joyEl.addEventListener('pointerup',endJoy); joyEl.addEventListener('pointercancel',endJoy);
$('actBtn').addEventListener('pointerdown',e=>{ e.preventDefault(); if(canPlay()) doAction(); });
$('dropBtn').addEventListener('pointerdown',e=>{ e.preventDefault(); if(canPlay()) putDown(); });
document.querySelectorAll('#perf button').forEach(b=>b.addEventListener('pointerdown',e=>{ e.preventDefault(); if(canPlay()) perform(b.dataset.p); }));
let drag=null;
canvas.addEventListener('pointerdown',e=>{ drag={id:e.pointerId,x:e.clientX}; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove',e=>{ if(!drag||drag.id!==e.pointerId||st.cine) return; st.yaw-=(e.clientX-drag.x)*.006; drag.x=e.clientX; });
const endDrag=e=>{ if(drag&&drag.id===e.pointerId) drag=null; };
canvas.addEventListener('pointerup',endDrag); canvas.addEventListener('pointercancel',endDrag);
canvas.addEventListener('wheel',e=>{ e.preventDefault(); st.dist=clamp(st.dist+e.deltaY*.01,6,22); },{passive:false});

/* ---------- actions ---------- */
function nearPot(){ const T=W.pot; return !!T&&dist2(player.position,T.pos)<T.R+2.8; }
function nearestItem(){ let best=null,bd=2.5; for(const c of W.items){ if(c.carried) continue; const d=dist2(player.position,c.group.position); if(d<bd){bd=d;best=c;} } return best; }
function carryWorldPos(){ const v=new V3(); st.anchor.getWorldPosition(v); v.y+=.35; return v; }
function attach(c){ c.carried=true; if(c.group.parent) c.group.parent.remove(c.group); st.anchor.add(c.group); c.group.position.set(0,0,0); c.group.rotation.set(0,0,0); st.carrying=c; renderCarry(); }
function putDown(silent){ const c=st.carrying; if(!c||st.busy) return; st.anchor.remove(c.group); W.group.add(c.group); const f=st.facing;
  c.group.position.set(clamp(player.position.x+Math.sin(f)*1.4,W.bounds.x0,W.bounds.x1),0,clamp(player.position.z+Math.cos(f)*1.4,W.bounds.z0,W.bounds.z1)); c.group.rotation.set(0,Math.random()*6,0); c.carried=false; st.carrying=null; if(!silent) sfx.put(); renderCarry(); }
function doFill(src){ const c=st.carrying, n=c.def.cap-c.water; st.busy=true; const from=src.from(); c.leakT=0;
  for(let i=0;i<n;i++) flyDrop(from,carryWorldPos(),i*.16,()=>{ c.water++; updateWater(c); renderCarry(); sfx.plop(); if(c.water>=c.def.cap) st.busy=false; }); }
function doPour(){ const c=st.carrying, T=W.pot, n=Math.min(c.water,T.need-T.have); st.busy=true;
  for(let i=0;i<n;i++) flyDrop(carryWorldPos(),T.mouthPos(),i*.18,()=>{ T.have++; c.water--; updateWater(c); renderCarry(); renderPot(); sfx.plop(); T.bounce=1; if(i===n-1){ st.busy=false; if(T.have>=T.need) potFull(); } }); }
function potFull(){ const T=W.pot; T.thirsty=false; T.full=true; T.dropTarget=0; T.happy=true; T.bounce=1.6; sfx.fall(); sfx.happy(); sparkle(T.mouthPos().setY(9),22); toast('땀땀이가 물방울을 내리고 활짝 웃어요!',2400); renderPot(); }
function currentAction(){
  const c=st.carrying, p=player.position, T=W.pot;
  if(W.actions){ const a=W.actions(p,c); if(a) return a; }
  const np=nearPot();
  if(np&&T.full) return {label:st.perf?'땀땀이가 공연 중이에요':'배부른 땀땀이에게 춤, 노래, 저글링을 부탁해 보세요'};
  if(c&&c.def.cap&&np&&T.thirsty){ if(c.water>0) return {label:'땀땀이에게 물 주기',key:'pour',btn:'물 주기',run:doPour,big:T.pos}; return {label:`${ig(c.def.name)} 비었어요. 물을 떠 오세요`}; }
  if(c&&c.def.cap){ for(const s of W.sources) if(s.test(p)){ if(c.water<c.def.cap) return {label:`${s.name}에서 물 뜨기`,key:'fill',btn:'물 뜨기',run:()=>doFill(s)}; return {label:`${ig(c.def.name)} 가득 찼어요`}; } }
  const it=nearestItem(); if(it) return {label:c?`${ro(it.def.name)} 바꿔 들기`:`${it.def.name} 줍기`,key:'pick',btn:'줍기',run:()=>{ if(st.carrying) putDown(true); attach(it); sfx.pick(); },ring:it.group.position};
  if(!c){ for(const s of W.sources) if(s.test(p)) return {label:'물을 담을 그릇이 필요해요'}; if(np&&T.thirsty) return {label:'땀땀이가 목말라 해요. 물을 구해 오세요'}; }
  return null;
}
function doAction(){ if(st.busy) return; const a=currentAction(); if(!a) return; if(!a.key){ sfx.nope(); return; } a.run(); }
function shove(dx,dz,d){ const p=player.position, x0=p.x, z0=p.z, x1=clamp(p.x+dx*d,W.bounds.x0,W.bounds.x1), z1=clamp(p.z+dz*d,W.bounds.z0,W.bounds.z1); st.shove=.4; st.vx=st.vz=0;
  tween(.35,k=>{ p.x=lerp(x0,x1,k); p.z=lerp(z0,z1,k); PCh.g.position.y=Math.sin(k*Math.PI)*1.2; },easeOut).then(()=>{ PCh.g.position.y=0; }); }

/* ---------- Ttami's little shows ---------- */
const PERF_DUR={dance:4.2,sing:5,juggle:5.6}, jugDrops=[];
function perform(type){ const T=W.pot; if(!T||!T.full||st.perf) return; st.perf={type,t:0,dur:PERF_DUR[type],next:0}; renderPot();
  if(type==='dance'){ for(let i=0;i<8;i++){ tone(150,50,.18,.35,'sine',i*.5); tone(1200,900,.05,.06,'square',i*.5+.25); } [659,784,880,784,659,587,659,784].forEach((f,i)=>tone(f,f,.22,.1,'triangle',i*.5+.25)); }
  if(type==='sing'){ [523,587,659,523,659,698,784,784,880,784,698,659,587,523].forEach((f,i)=>{ tone(f,f*1.003,.34,.15,'triangle',i*.34); tone(f*2,f*2,.3,.03,'sine',i*.34); }); }
  if(type==='juggle'){ for(let i=0;i<3;i++){ const d=mesh(smallDropGeo,dropMat,false,false); d.scale.setScalar(1.5); T.body.add(d); jugDrops.push(d); } } }
function endPerf(){ const T=W.pot; st.perf=null; T.body.position.y=0; T.body.rotation.y=0; T.mouth.visible=false; T.topG.rotation.set(0,0,0); while(jugDrops.length) T.body.remove(jugDrops.pop()); renderPot(); sparkle(T.mouthPos().setY(10),10); }
function updatePerf(dt){ const P=st.perf, T=W.pot, k=P.t; P.t+=dt;
  if(P.type==='dance'){ T.body.position.y=Math.abs(Math.sin(k*Math.PI*2))*1.1; T.body.rotation.z=Math.sin(k*Math.PI*2)*.14; T.body.rotation.y=(k>2.5&&k<3.5)?(k-2.5)*Math.PI*2:Math.sin(k*Math.PI)*.5;
    const sq=Math.max(0,-Math.cos(k*Math.PI*4))*.1; T.body.scale.set(1+sq,1-sq,1+sq); T.topG.rotation.z=Math.sin(k*Math.PI*2)*.35; }
  if(P.type==='sing'){ T.body.rotation.z=Math.sin(k*2.6)*.08; T.mouth.visible=true; T.mouth.scale.set(1,1.2*(.6+.5*Math.abs(Math.sin(k*9.2))),.5); T.topG.rotation.z=Math.sin(k*2.6)*.2;
    if(k>P.next){ P.next=k+.42; const dir=new V3(camera.position.x-T.pos.x,0,camera.position.z-T.pos.z).normalize(); floatSprite(noteTex[Math.random()*3|0],new V3(T.pos.x+dir.x*6+(Math.random()-.5)*4,9,T.pos.z+dir.z*6+(Math.random()-.5)*4)); } }
  if(P.type==='juggle'){ T.body.rotation.z=Math.sin(k*5.2)*.03; const TT=.55, H=3.6; T.topG.rotation.z=Math.sin(k*Math.PI/TT)*.22;
    jugDrops.forEach((d,i)=>{ let u=(k/TT+i*2/3)%2; const lr=u<1, a=lr?T.jugL:T.jugR, b=lr?T.jugR:T.jugL; u=u%1;
      d.position.set(lerp(a.x,b.x,u)*T_PLANT,T_SOIL+lerp(a.y,b.y,u)*T_PLANT+Math.sin(u*Math.PI)*H,.6+.4*Math.sin(u*Math.PI)); d.rotation.z=(lr?-1:1)*u*1.2; d.visible=k>i*TT*.66; });
    if(k>P.next){ P.next=k+TT; tone(700+Math.random()*200,300,.1,.08,'sine'); } }
  if(P.t>=P.dur) endPerf(); }

/* ---------- camera ---------- */
function calcFollow(){ const p=player.position, T=W.pot, s=Math.sin(st.yaw), c=Math.cos(st.yaw);
  const pos=new V3(p.x+s*st.dist,2.2+st.dist*(W.camH||.36),p.z+c*st.dist), look=new V3(p.x-s*3,2.2,p.z-c*3);
  if(T&&st.focus>.001){ const m=T.full?1:.6, mx=lerp(p.x,T.pos.x,m), mz=lerp(p.z,T.pos.z,m); const fd=camera.aspect<.8?44:27; pos.lerp(new V3(mx+s*fd,15*fd/27,mz+c*fd),st.focus); look.lerp(new V3(mx,camera.aspect<.8?1.5:7,mz),st.focus); }
  if(st.hint&&st.hintK>.001){ pos.lerp(st.hint.pos,st.hintK); look.lerp(st.hint.look,st.hintK); }
  const cc=W.camClamp; if(cc){ pos.x=clamp(pos.x,cc.x0,cc.x1); pos.z=clamp(pos.z,cc.z0,cc.z1); }
  return {pos,look}; }
function cineTo(pos,look,dur,bob){ const p0=st.cinePos.clone(), l0=st.cineLook.clone(); return tween(dur,k=>{ st.cinePos.lerpVectors(p0,pos,k); if(bob) st.cinePos.y+=Math.abs(Math.sin(k*Math.PI*5))*.5*Math.sin(k*Math.PI); st.cineLook.lerpVectors(l0,look,k); }); }
function updateCamera(dt){
  if(st.cine){ st.camPos.copy(st.cinePos); st.camLook.copy(st.cineLook); }
  else { st.focus=lerp(st.focus,(W.pot&&st.mode==='play'&&(W.pot.full||nearPot()))?1:0,Math.min(1,dt*2.5)); const h=(W.camHint&&st.mode==='play')?W.camHint(player.position):null; if(h) st.hint=h; st.hintK=lerp(st.hintK||0,h?1:0,Math.min(1,dt*3));
    const f=calcFollow(); st.camPos.lerp(f.pos,Math.min(1,dt*6)); st.camLook.lerp(f.look,Math.min(1,dt*8)); }
  camera.position.copy(st.camPos); camera.lookAt(st.camLook); }

/* ---------- story flow ---------- */
function buildTitle(){
  const Wd=newWorld(), g=Wd.group; Wd.light={bg:'#F4E6D2',sky:'#FFF6E8',ground:'#D9BFA0',hemi:.85,sunCol:'#FFF0D8',sun:1.0,sunPos:[-6,12,10],range:12,fill:.25,fog:[40,110]};
  const fl=mesh(new THREE.CircleGeometry(40,48),clay('#F1DFC8'),false,true); fl.rotation.x=-Math.PI/2; g.add(fl);
  const chars=CHARS.map((c,i)=>{ const ch=makeCharacter(c.key); ch.g.position.set((i-2)*1.95,0,0); g.add(ch.g); return ch; });
  const T=makeTtami(); T.group.scale.setScalar(.3); T.group.position.set(0,0,-3.2); T.dropTarget=1; g.add(T.group); Wd.tt=T;
  Wd.update=(dt,t)=>{ updateTtami(T,dt,t); chars.forEach((ch,i)=>{ const sel=i===st.sel; ch.g.position.y=sel?Math.abs(Math.sin(t*4))*.3:0; ch.g.rotation.y=sel?Math.sin(t*2)*.5:0; ch.g.scale.setScalar(lerp(ch.g.scale.x,sel?1.25:.95,.15)); animChar(ch,0,0,t,false); });
    const z=clamp(5.2/(Math.tan(MU.degToRad(25))*camera.aspect),8.6,26); st.cinePos.set(0,2.2+z*.05,z); st.cineLook.set(0,.35-.75*(z-8.6)/8.6,0); };
  return Wd;
}
function showTitle(){ st.mode='title'; st.cine=true; st.sel=0; setWorld(buildTitle()); const box=$('charBtns'); box.innerHTML='';
  const pick=i=>{ st.sel=i; [...box.children].forEach((b,j)=>b.setAttribute('aria-pressed',j===i)); $('charLine').textContent=CHARS[i].line; sfx.step(); };
  CHARS.forEach((c,i)=>{ const b=document.createElement('button'); b.textContent=c.name; b.onclick=()=>{ initAudio(); pick(i); }; box.appendChild(b); }); pick(Math.random()*CHARS.length|0);
  $('title').classList.add('show'); fade(0,700); }
$('startBtn').onclick=async()=>{ if(st.mode!=='title') return; st.mode='cut'; initAudio(); sfx.happy(); setPlayerChar(CHARS[st.sel].key); await fade(1,700); $('title').classList.remove('show'); prologue(); };

async function prologue(){
  player.visible=false; setWorld(buildDesk('prologue')); const T=W.pot, G=W.glass; T.thirsty=false; T.dropTarget=0; T.dropK=0;
  st.cine=true; st.cinePos.set(2,27,56); st.cineLook.set(0,7,-6); setRain(.045);
  await fade(0,1200);
  caption('비 오는 오후. 책상 위에는 내가 키우는 화분, 땀땀이가 있어요.');
  await cineTo(new V3(0,19,25),new V3(0,6.5,-6),3.6,true); await wait(500);
  T.thirsty=true; T.dropTarget=1; sfx.rise(); caption('어? 땀땀이가 머리 위로 물방울을 쏙 올렸어요. 목이 마르다는 신호예요.'); await wait(2600);
  await captionBtn('마침 옆에 물컵이 있어요.','물컵 들어 물 주기');
  caption('쪼르르…'); sfx.pick(); const g0=G.g.position.clone(), g1=new V3(10.9,12.2,-3.8);
  await tween(1.1,k=>{ G.g.position.lerpVectors(g0,g1,k); G.g.rotation.z=k*1.3; });
  G.g.updateMatrixWorld(true); const A=W.group.worldToLocal(G.g.localToWorld(new V3(-2.62,8.6,0))), B=new V3(A.x-1.2,T_SOIL+.05,A.z);
  G.stream.geometry.dispose(); G.stream.geometry=new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(A,new V3(A.x-1.0,A.y-.1,A.z),B),24,.27,10); G.stream.visible=true; sfx.splash();
  const ripple=addPuddle(W.group,B.x,B.z,.1,.1); ripple.position.y=T_SOIL+.06;
  await tween(1.7,k=>{ G.water.scale.y=1-k*.75; G.water.position.y=3.4-k*2.0; T.bounce=.5; const rs=.5+Math.abs(Math.sin(k*20))*.5; ripple.scale.set(rs,rs,1); if(Math.random()<.2) sfx.plop(); },lin);
  G.stream.visible=false; ripple.visible=false; await tween(.9,k=>{ G.g.position.lerpVectors(g1,g0,k); G.g.rotation.z=(1-k)*1.3; });
  T.thirsty=false; T.dropTarget=0; T.happy=true; T.bounce=1.6; sfx.fall(); sfx.happy(); sparkle(T.mouthPos().setY(9),18);
  caption('물방울이 스르륵 내려가고, 땀땀이가 다시 활짝 웃어요.'); await wait(3000);
  caption('의자에 앉아 땀땀이를 바라보다가…'); await cineTo(new V3(0,12.5,23.5),new V3(0,6,-6),2.4);
  const L=$('lids'); L.className='half'; await wait(950); L.className=''; await wait(750); caption('스르륵… 잠이 들었어요.'); L.className='half'; await wait(900); L.className='shut'; await wait(1000);
  await fade(1,500); captionHide(); startStage(1);
}
async function startStage(n){
  st.mode='cut'; st.stage=n; captionHide();
  setWorld(n===1?buildDesk('play'):n===2?buildDresser():buildVeranda());
  const T=W.pot; T.thirsty=true; T.dropTarget=1; T.have=0;
  player.visible=true; player.position.set(W.start.x,0,W.start.z); st.yaw=W.start.yaw; st.facing=Math.PI+st.yaw; st.vx=st.vz=0; st.focus=0; st.dist=W.dist||11;
  setRain(n===1?.045:0); $('hud').classList.add('show'); $('stageTxt').textContent=W.name; renderPot(); renderCarry();
  const I=typeof W.intro==='function'?W.intro():W.intro; st.cine=true; st.cinePos.copy(I.from); st.cineLook.copy(I.look); $('lids').className=''; setGoal('');
  await fade(0,900); if(W.hold) await wait(W.hold);
  const f=calcFollow(); await cineTo(f.pos,f.look,W.hold?3.6:2.6); st.cine=false;
  await mission(W.mission[0],W.mission[1]);
  st.mode='play'; renderPot(); setGoal(W.goal||''); if(W.onStart) W.onStart();
}
$('nextBtn').onclick=async()=>{ if(st.mode!=='play'||st.lock) return; if(st.perf) endPerf(); st.mode='cut'; $('fullPanel').classList.remove('show'); sfx.step(); await fade(1,700); if(st.stage<3) startStage(st.stage+1); else ending(); };
async function ending(){
  $('hud').classList.remove('show'); setWorld(buildDesk('ending')); player.visible=false; const T=W.pot; T.happy=true; T.thirsty=false; T.dropTarget=0; T.dropK=0;
  setRain(.03); st.cine=true; st.cinePos.set(52,24,-4); st.cineLook.set(0,9,12);
  const L=$('lids'); L.className='shut'; await fade(0,400); await wait(500); L.className='half'; await wait(900); L.className='';
  caption('…눈을 떠 보니, 땀땀이가 나를 보며 웃고 있었어요. 나도 모르게 땀땀이를 쓰다듬었어요.'); sfx.happy();
  const hearts=setInterval(()=>floatSprite(heartTex,new V3((Math.random()-.5)*8,13,2+(Math.random()-.5)*8),2.6),650);
  await cineTo(new V3(47,25,2),new V3(0,9,12),4.5);
  caption('꿈이었지만, 오늘도 물 줄 때를 놓치지 않았네요.'); await cineTo(new V3(42,27,8),new V3(0,9,12),3.6);
  clearInterval(hearts); await fade(1,1800); captionHide(); st.mode='end';
  $('imgHero').src=IMG.main; $('imgSensor').src=IMG.hero; $('imgWet').src=IMG.wet; $('imgDry').src=IMG.dry; $('imgInside').src=IMG.inside; $('imgProto').src=IMG.proto;
  $('about').classList.add('show'); $('about').scrollTop=0;
}
$('againBtn').onclick=()=>{ $('about').classList.remove('show'); setRain(0); showTitle(); };

/* ---------- main loop ---------- */
const clock=new THREE.Clock(); let time=0;
function updatePlayer(dt,t){
  let ix=0,iy=0;
  if(canPlay()&&st.shove<=0){ if(keys['a']||keys['ㅁ']||keys['arrowleft']) ix-=1; if(keys['d']||keys['ㅇ']||keys['arrowright']) ix+=1; if(keys['w']||keys['ㅈ']||keys['arrowup']) iy+=1; if(keys['s']||keys['ㄴ']||keys['arrowdown']) iy-=1; ix+=joy.x; iy+=joy.y; }
  st.shove=Math.max(0,st.shove-dt);
  const m=Math.hypot(ix,iy); if(m>1){ix/=m;iy/=m;}
  const fx=-Math.sin(st.yaw), fz=-Math.cos(st.yaw), rx=Math.cos(st.yaw), rz=-Math.sin(st.yaw), speed=st.carrying?6.4:7.4;
  st.vx+=((fx*iy+rx*ix)*speed-st.vx)*Math.min(1,dt*10); st.vz+=((fz*iy+rz*ix)*speed-st.vz)*Math.min(1,dt*10);
  const p=player.position; p.x+=st.vx*dt; p.z+=st.vz*dt; const PR=.6;
  for(const c of W.circles){ if(c.r<0) continue; const dx=p.x-c.x, dz=p.z-c.z, d=Math.hypot(dx,dz), R=c.r+PR; if(d<R&&d>1e-4){ p.x=c.x+dx/d*R; p.z=c.z+dz/d*R; } }
  for(const b of W.boxes){ const cx=clamp(p.x,b.x0,b.x1), cz=clamp(p.z,b.z0,b.z1), dx=p.x-cx, dz=p.z-cz, d=Math.hypot(dx,dz);
    if(d<PR){ if(d>1e-4){ p.x=cx+dx/d*PR; p.z=cz+dz/d*PR; } else { const l=p.x-b.x0,r=b.x1-p.x,u=p.z-b.z0,w=b.z1-p.z,mn=Math.min(l,r,u,w); if(mn===l)p.x=b.x0-PR; else if(mn===r)p.x=b.x1+PR; else if(mn===u)p.z=b.z0-PR; else p.z=b.z1+PR; } } }
  p.x=clamp(p.x,W.bounds.x0,W.bounds.x1); p.z=clamp(p.z,W.bounds.z0,W.bounds.z1);
  const sp=Math.hypot(st.vx,st.vz);
  if(sp>.4){ let d=Math.atan2(st.vx,st.vz)-st.facing; d=Math.atan2(Math.sin(d),Math.cos(d)); st.facing+=d*Math.min(1,dt*12); }
  player.rotation.y=st.facing; const walk=Math.min(1,sp/6); st.walkT+=dt*sp*2.2;
  animChar(PCh,walk,st.walkT,t,!!st.carrying);
  const c=st.carrying; if(c&&c.def.leak&&c.water>0&&!st.busy&&canPlay()){ c.leakT+=dt; if(c.leakT>c.def.leak){ c.leakT=0; c.water--; updateWater(c); renderCarry(); const w=carryWorldPos(); flyDrop(w,new V3(w.x+(Math.random()-.5),0,w.z+(Math.random()-.5)),0,()=>{}); toast('종이가 젖어서 물이 새요',1200); } }
}
function updateHints(t){
  const a=(canPlay()&&W.pot)?currentAction():null, hint=$('hint'), act=$('actBtn');
  if(a&&a.key){ ring.material.opacity=.55+Math.sin(t*6)*.2; const rp=a.big||a.ring||player.position; ring.position.x=rp.x; ring.position.z=rp.z; ring.scale.setScalar(a.big?6.8:(a.ring?1.6:1.2)); } else ring.material.opacity=0;
  if(a){ hint.innerHTML=(a.key?'<kbd>F</kbd>':'')+a.label; hint.classList.add('show'); } else hint.classList.remove('show');
  act.disabled=!(a&&a.key); act.textContent=a&&a.key?a.btn:'…';
  const ps=$('potStatus'); if(innerWidth<=620){ ps.style.top=($('me').getBoundingClientRect().bottom+8)+'px'; ps.style.left='14px'; ps.style.transform='none'; } else { ps.style.top=ps.style.left=ps.style.transform=''; }
}
function loop(){
  const raw=Math.min(.25,clock.getDelta()), dt=Math.min(.05,raw)*(st.speed||1); time+=raw; const t=time;
  for(let i=tweens.length-1;i>=0;i--){ const tw=tweens[i]; tw.t+=raw; const k=Math.min(1,tw.t/tw.dur); tw.fn(tw.ease(k)); if(k>=1){ tweens.splice(i,1); tw.res(); } }
  if(W){ if(W.update) W.update(dt,t); if(W.pot) updateTtami(W.pot,dt,t);
    if(player.visible&&PCh) updatePlayer(dt,t);
    if(st.perf) updatePerf(dt);
    updateCamera(dt); updateHints(t); }
  for(let i=flyers.length-1;i>=0;i--){ const f=flyers[i]; f.t+=dt; if(f.t<0) continue; f.m.visible=true; const k=Math.min(1,f.t/f.dur); f.m.position.lerpVectors(f.from,f.to,k); f.m.position.y+=Math.sin(k*Math.PI)*2.5; f.m.scale.setScalar(1-.3*k); if(k>=1){ scene.remove(f.m); flyers.splice(i,1); f.onArrive&&f.onArrive(); } }
  for(let i=sparks.length-1;i>=0;i--){ const s=sparks[i], u=s.userData; u.vy-=12*dt; s.position.x+=u.vx*dt; s.position.y+=u.vy*dt; s.position.z+=u.vz*dt; s.rotation.y+=dt*6; u.life-=dt*.9; s.material.opacity=Math.max(0,u.life); if(u.life<=0){ scene.remove(s); sparks.splice(i,1); } }
  for(let i=notes.length-1;i>=0;i--){ const n=notes[i], u=n.userData; u.life-=dt*.5; n.position.y+=dt*2.4; n.position.x+=u.vx*dt; n.material.opacity=Math.min(1,u.life*2); if(u.life<=0){ scene.remove(n); notes.splice(i,1); } }
  updateBubble(); renderer.render(scene,camera); requestAnimationFrame(loop);
}
showTitle(); loop();

})();
