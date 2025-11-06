/* =========================================================
   Art of Noise — Exclusive Mic/File, Play/Pause/Stop,
   Pause freezes visuals, custom dropdown driver,
   + active button visual states (.is-active)
========================================================= */

/* ---------- DOM ---------- */
const canvas   = document.getElementById('gl');
const startBtn = document.getElementById('startBtn');
const stopBtn  = document.getElementById('stopBtn');

const fileEl   = document.getElementById('file');
const fileNameEl = document.getElementById('fileName');
const playBtn  = document.getElementById('playBtn');
const pauseBtn = document.getElementById('pauseBtn');
const stopPlaybackBtn = document.getElementById('stopPlaybackBtn');

const resetBtn = document.getElementById('resetBtn');

const audioSensitivity = document.getElementById('audioSensitivity'); // 0..100
const ripplesResponse  = document.getElementById('ripplesResponse');  // 0..100
const ripplesQuantity  = document.getElementById('ripplesQuantity');  // 0..100

const audioBadge = document.getElementById('audioBadge');
const respBadge  = document.getElementById('respBadge');
const qtyBadge   = document.getElementById('qtyBadge');

const bgBlackBtn = document.getElementById('bgBlack');
const bgBlueBtn  = document.getElementById('bgBlue');

const panel      = document.getElementById('panel');
const menuToggle = document.getElementById('menuToggle');
const layout     = document.getElementById('layout');
const stage      = document.querySelector('.stage');

// Dropdown (native) for choosing which SVG to animate
const contentSelect = document.getElementById('contentSelect');
let currentLogoPath = contentSelect?.value || 'Art of Noise.svg';

/* ---------- Active button helper ---------- */
function setActive(btn, on){
  if(!btn) return;
  if(on) btn.classList.add('is-active');
  else   btn.classList.remove('is-active');
}

/* ---------- Panel toggle ---------- */
let needResize = true;
function setMenu(open){
  if(open){
    panel.classList.remove('panel--closed');
    layout.classList.remove('layout--panel-closed');
    menuToggle.dataset.state = 'open';
    menuToggle.textContent = '✕';
    menuToggle.setAttribute('aria-label','Close menu');
  }else{
    panel.classList.add('panel--closed');
    layout.classList.add('layout--panel-closed');
    menuToggle.dataset.state = 'closed';
    menuToggle.textContent = '☰';
    menuToggle.setAttribute('aria-label','Open menu');
  }
  needResize = true;
}
menuToggle.addEventListener('click', ()=>{
  const isOpen = menuToggle.dataset.state !== 'closed';
  setMenu(!isOpen);
});
setMenu(true);

/* ---------- Background ---------- */
function activateBg(which){
  if(which==='blue'){
    document.documentElement.style.setProperty('--app-bg', '#005A8C');
    bgBlueBtn.classList.add('is-active');  bgBlackBtn.classList.remove('is-active');
  }else{
    document.documentElement.style.setProperty('--app-bg', '#000000');
    bgBlackBtn.classList.add('is-active'); bgBlueBtn.classList.remove('is-active');
  }
}
bgBlackBtn.addEventListener('click', ()=>activateBg('black'));
bgBlueBtn .addEventListener('click', ()=>activateBg('blue'));
activateBg('black');

/* =========================
   WEBGL + AUDIO
========================= */
const gl = canvas.getContext('webgl', { premultipliedAlpha:true, alpha:true, antialias:true });
if(!gl) alert('WebGL not supported');

gl.clearColor(0,0,0,0);
gl.enable(gl.BLEND);
gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

const VS = `
attribute vec2 a_pos;
attribute vec2 a_uv;
uniform vec4  u_ndcRect;
varying vec2 v_uv;
void main(){
  vec2 t = a_pos * 0.5 + 0.5;
  vec2 pos = mix(u_ndcRect.xy, u_ndcRect.zw, t);
  gl_Position = vec4(pos, 0.0, 1.0);
  v_uv = a_uv;
}
`;

const FS = `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_tex;

uniform float u_level, u_sigma, u_strength, u_flutes, u_front, u_width, u_phase, u_hardness;
uniform vec4  u_tint;

float triWave(float x){ float f=fract(x); return 2.0*abs(f-0.5)-1.0; }
float radial(vec2 uv){ return abs(uv.x - 0.5); }

void main(){
  vec2 uv = v_uv;

  float tri = triWave(uv.x * u_flutes + u_phase);
  float edge = mix(0.06, 0.005, u_hardness);
  float sq   = smoothstep(-edge, edge, tri) * 2.0 - 1.0;
  float ribs = mix(tri, sq, u_hardness);

  float r = radial(uv);
  float center = exp(-(r*r)/(2.0*u_sigma*u_sigma));
  float dist = abs(r - u_front);
  float pulse = exp(-(dist*dist)/(2.0*u_width*u_width));
  float amp = max(0.0, u_level) * u_strength * center * pulse;

  float side = sign(uv.x - 0.5);
  float dx = side * amp * ribs;

  vec2 suv = clamp(uv + vec2(dx,0.0), vec2(0.001), vec2(0.999));
  vec4 s = texture2D(u_tex, suv);
  if (s.a < 0.001) discard;

  vec3 rgb = u_tint.rgb * s.a;
  gl_FragColor = vec4(rgb, s.a * u_tint.a);
}
`;

/* Compile/link */
function sh(t,src){ const s=gl.createShader(t); gl.shaderSource(s,src); gl.compileShader(s);
  if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
function prog(vs,fs){ const p=gl.createProgram(); gl.attachShader(p,sh(gl.VERTEX_SHADER,vs));
  gl.attachShader(p,sh(gl.FRAGMENT_SHADER,fs)); gl.linkProgram(p);
  if(!gl.getProgramParameter(p,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); return p; }
const program = prog(VS,FS); gl.useProgram(program);

/* Quad */
const quad = new Float32Array([ -1,-1,0,0, 1,-1,1,0, -1,1,0,1, 1,1,1,1 ]);
const vbo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);
const STRIDE = 16;
const a_pos = gl.getAttribLocation(program,'a_pos');
const a_uv  = gl.getAttribLocation(program,'a_uv');
gl.enableVertexAttribArray(a_pos); gl.vertexAttribPointer(a_pos,2,gl.FLOAT,false,STRIDE,0);
gl.enableVertexAttribArray(a_uv ); gl.vertexAttribPointer(a_uv ,2,gl.FLOAT,false,STRIDE,8);

/* Uniforms */
const u_tex      = gl.getUniformLocation(program,'u_tex');
const u_ndcRect  = gl.getUniformLocation(program,'u_ndcRect');
const u_level    = gl.getUniformLocation(program,'u_level');
const u_sigma    = gl.getUniformLocation(program,'u_sigma');
const u_strength = gl.getUniformLocation(program,'u_strength');
const u_flutes   = gl.getUniformLocation(program,'u_flutes');
const u_front    = gl.getUniformLocation(program,'u_front');
const u_width    = gl.getUniformLocation(program,'u_width');
const u_phase    = gl.getUniformLocation(program,'u_phase');
const u_tint     = gl.getUniformLocation(program,'u_tint');
const u_hardness = gl.getUniformLocation(program,'u_hardness');

gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);
gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);

/* SVG → textures */
const LETTER_GAP_JOIN=6, DPI_SCALE=2.0, PAD_FRAC=0.30;
let texReady=false, letterTextures=[], logoViewBox=[0,0,1000,400];

const offscreen = document.createElement('canvas');
const offCtx = offscreen.getContext('2d');
const measureRoot = (()=>{
  const s=document.createElementNS('http://www.w3.org/2000/svg','svg');
  s.setAttribute('style','position:absolute;left:-99999px;top:-99999px;width:0;height:0;');
  document.body.appendChild(s);
  return s;
})();

async function loadPerLetterTextures(svgPath = currentLogoPath){
  const resp = await fetch(svgPath);
  if(!resp.ok) throw new Error(`${svgPath} not found`);
  const svgText = await resp.text();
  const doc = new DOMParser().parseFromString(svgText,'image/svg+xml');
  const root = doc.querySelector('svg');
  const vb = root.getAttribute('viewBox');
  if (vb){ const n = vb.trim().split(/\s+/).map(parseFloat); if(n.length===4) logoViewBox=n; }
  else { const w=parseFloat(root.getAttribute('width'))||1000; const h=parseFloat(root.getAttribute('height'))||400; logoViewBox=[0,0,w,h]; }

  const leaves = Array.from(root.querySelectorAll('path,polygon,polyline,rect,circle,ellipse'));
  if(leaves.length===0) throw new Error('No drawable shapes in SVG');

  function measureBBox(node){
    measureRoot.innerHTML = '';
    const g=document.createElementNS('http://www.w3.org/2000/svg','g');
    measureRoot.setAttribute('viewBox', logoViewBox.join(' '));
    measureRoot.appendChild(g);
    g.appendChild(node.cloneNode(true));
    let bb = {x:0,y:0,width:0,height:0};
    try{ bb = g.firstChild.getBBox(); }catch(e){}
    return bb;
  }

  const items = leaves.map((node)=>{ const bb=measureBBox(node); return {node,x:bb.x,y:bb.y,w:bb.width,h:bb.height}; }).filter(b=>b.w>0 && b.h>0);

  const groups = (function clusterRects(items,gap){
    const n=items.length, parent=Array.from({length:n},(_,i)=>i);
    const find=i=>parent[i]===i?i:(parent[i]=find(parent[i]));
    const unite=(a,b)=>{a=find(a); b=find(b); if(a!==b) parent[a]=b;};
    function near(a,b){ const ax2=a.x+a.w, ay2=a.y+a.h, bx2=b.x+b.w, by2=b.y+b.h; return !(ax2+gap<b.x || bx2+gap<a.x || ay2+gap<b.y || by2+gap<a.y); }
    for(let i=0;i<n;i++) for(let j=i+1;j<n;j++) if(near(items[i],items[j])) unite(i,j);
    const groups=new Map(); for(let i=0;i<n;i++){ const r=find(i); if(!groups.has(r)) groups.set(r,[]); groups.get(r).push(items[i]); }
    return [...groups.values()].sort((a,b)=>a[0].x-b[0].x);
  })(items, LETTER_GAP_JOIN);

  letterTextures = [];
  for(const group of groups){
    const gx=Math.min(...group.map(b=>b.x)), gy=Math.min(...group.map(b=>b.y));
    const gw=Math.max(...group.map(b=>b.x+b.w))-gx, gh=Math.max(...group.map(b=>b.y+b.h))-gy;
    const pad=Math.max(gw,gh)*PAD_FRAC, gwPad=gw+2*pad, ghPad=gh+2*pad;
    const W=Math.max(2,Math.round(gwPad*DPI_SCALE)), H=Math.max(2,Math.round(ghPad*DPI_SCALE));

    const frag=document.createElementNS('http://www.w3.org/2000/svg','svg');
    frag.setAttribute('xmlns','http://www.w3.org/2000/svg'); frag.setAttribute('viewBox',`0 0 ${gwPad} ${ghPad}`);
    const g=document.createElementNS('http://www.w3.org/2000/svg','g'); g.setAttribute('transform',`translate(${-gx+pad},${-gy+pad})`); frag.appendChild(g);
    for(const it of group) g.appendChild(it.node.cloneNode(true));

    const ser=new XMLSerializer().serializeToString(frag);
    const blob=new Blob([ser],{type:'image/svg+xml'});
    const url=URL.createObjectURL(blob);

    const tex=await new Promise((resolve,reject)=>{
      const img=new Image(); img.onload=()=>{
        offscreen.width=W; offscreen.height=H;
        offCtx.clearRect(0,0,W,H); offCtx.drawImage(img,0,0,W,H);
        const t=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,t);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,offscreen);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
        resolve(t);
      }; img.onerror=reject; img.src=url;
    });
    URL.revokeObjectURL(url);

    letterTextures.push({ tex, w:W, h:H, viewRect:[gx-pad, gy-pad, gwPad, ghPad] });
  }
  texReady=true;
}

/* ---------- Audio management (exclusive Mic/File) ---------- */
let audioCtx, analyser, mediaStream, micNode = null, fileNode = null;
let timeWave=null, freq=null, envelope=0;
let currentAudioEl=null;
let freezeVisuals=false, frozen={level:0, front:0};
let activeSource = null; // 'mic' | 'file' | null

const NOISE_GATE=0.018;

async function ensureAnalyser(){
  if (!audioCtx){
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended'){
    try { await audioCtx.resume(); } catch {}
  }
  if (!analyser){
    analyser = audioCtx.createAnalyser();
    analyser.fftSize=2048;
    analyser.minDecibels=-90;
    analyser.maxDecibels=-10;
    analyser.smoothingTimeConstant=0.5;
  }
  if (!timeWave) timeWave = new Uint8Array(analyser.fftSize);
  if (!freq)     freq     = new Uint8Array(analyser.frequencyBinCount);
}

/* ---------- File transport helpers ---------- */
function updateFileButtons(){
  if (!currentAudioEl){
    playBtn.disabled = true;
    pauseBtn.disabled = true;
    stopPlaybackBtn.disabled = true;

    setActive(playBtn, false);
    setActive(pauseBtn, false);
    setActive(stopPlaybackBtn, false);
    return;
  }
  const playing = !currentAudioEl.paused && !currentAudioEl.ended;
  const atStart = currentAudioEl.currentTime === 0 || currentAudioEl.ended;

  // Enable/disable
  playBtn.disabled  = playing;
  pauseBtn.disabled = !playing;

  // Stop available when file is the active source
  stopPlaybackBtn.disabled = !(activeSource === 'file');

  // Visual active states
  if (activeSource !== 'file'){
    setActive(playBtn,  false);
    setActive(pauseBtn, false);
    setActive(stopPlaybackBtn, false);
    return;
  }
  if (playing){
    setActive(playBtn,  true);
    setActive(pauseBtn, false);
    setActive(stopPlaybackBtn, false);
  } else if (!atStart){
    // paused mid-track
    setActive(playBtn,  false);
    setActive(pauseBtn, true);
    setActive(stopPlaybackBtn, false);
  } else {
    // stopped / at beginning
    setActive(playBtn,  false);
    setActive(pauseBtn, false);
    setActive(stopPlaybackBtn, true);
  }
}

function attachFileNode(){
  if (!currentAudioEl) return;
  if (!fileNode){
    fileNode = audioCtx.createMediaElementSource(currentAudioEl);
    fileNode.connect(analyser);
    analyser.connect(audioCtx.destination);
  }
}

async function playFile(){
  if (!currentAudioEl) return;
  // Exclusivity: stop mic if needed
  await stopMic(true);

  await ensureAnalyser();
  attachFileNode();
  try { await currentAudioEl.play(); } catch {}

  activeSource   = 'file';
  freezeVisuals  = false;
  setActive(playBtn,  true);
  setActive(pauseBtn, false);
  setActive(stopPlaybackBtn, false);
  updateFileButtons();

  if(!texReady){ await loadPerLetterTextures(currentLogoPath); }
  startLoop();
}
function pauseFile(){
  if (!currentAudioEl) return;
  try { currentAudioEl.pause(); } catch {}
  freezeVisuals = true; // hold the current visual frame
  setActive(playBtn,  false);
  setActive(pauseBtn, true);
  setActive(stopPlaybackBtn, false);
  updateFileButtons();
}
function stopFile(){
  if (!currentAudioEl) return;
  try { currentAudioEl.pause(); } catch {}
  try { currentAudioEl.currentTime = 0; } catch {}
  freezeVisuals = false; // allow effect to fade out
  if (activeSource === 'file') activeSource = null;
  setActive(playBtn,  false);
  setActive(pauseBtn, false);
  setActive(stopPlaybackBtn, true);
  updateFileButtons();
}

/* ---------- Mic helpers ---------- */
async function startMic(){
  try{
    // Exclusivity: stop file transport
    stopFile();

    await ensureAnalyser();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    // Clean old mic
    if (micNode){ try{ micNode.disconnect(); }catch{} micNode=null; }
    if (mediaStream){ try{ mediaStream.getTracks().forEach(t=>t.stop()); } catch{} }

    mediaStream = stream;
    micNode = audioCtx.createMediaStreamSource(mediaStream);
    micNode.connect(analyser);

    startBtn.disabled = true;
    stopBtn.disabled  = false;

    activeSource  = 'mic';
    freezeVisuals = false;

    // file buttons lose active
    setActive(playBtn,  false);
    setActive(pauseBtn, false);
    setActive(stopPlaybackBtn, false);

    // mic buttons: Start active while mic is on
    setActive(startBtn, true);
    setActive(stopBtn,  false);

    updateFileButtons();

    if(!texReady){ await loadPerLetterTextures(currentLogoPath); }
    startLoop();
  }catch(e){
    alert('Mic access failed: ' + e.message);
  }
}
async function stopMic(silent=false){
  try{
    if (mediaStream){
      mediaStream.getTracks().forEach(t=>t.stop());
      mediaStream=null;
    }
    if (micNode){ try{ micNode.disconnect(); }catch{} micNode=null; }
  }catch(e){
    if (!silent) console.warn('stopMic:', e);
  }finally{
    startBtn.disabled=false;
    stopBtn.disabled=true;
    if (activeSource === 'mic') activeSource = null;

    // Mic stopped: mark Stop Mic active
    setActive(startBtn, false);
    setActive(stopBtn,  true);

    updateFileButtons();
  }
}

/* ---------- File selection + transport wiring ---------- */
fileEl?.addEventListener('change', async (e)=>{
  const f=e.target.files?.[0];
  fileNameEl.textContent = f ? f.name : 'No file...';
  if(!f){
    if (currentAudioEl){ try{ currentAudioEl.pause(); }catch{} }
    currentAudioEl = null;
    if (fileNode){ try{ fileNode.disconnect(); }catch{} fileNode=null; }
    updateFileButtons();
    return;
  }

  // Dispose previous
  if (currentAudioEl){ try{ currentAudioEl.pause(); }catch{} }
  if (fileNode){ try{ fileNode.disconnect(); }catch{} fileNode=null; }

  currentAudioEl = new Audio(URL.createObjectURL(f));
  currentAudioEl.loop = true;
  currentAudioEl.addEventListener('ended', updateFileButtons);
  currentAudioEl.addEventListener('pause', updateFileButtons);
  currentAudioEl.addEventListener('play',  updateFileButtons);

  // Auto-play on choose (kept behavior)
  await playFile();
});

playBtn.addEventListener('click',  playFile);
pauseBtn.addEventListener('click', pauseFile);
stopPlaybackBtn.addEventListener('click', stopFile);

/* ---------- Mapping helpers ---------- */
function mapPercent(p,min,max){ return min + (p/100)*(max-min); }
function responseOldPct(p){ return p<=50 ? (p/50)*80 : 80 + ((p-50)/50)*40; }
function mapRespGain(oldPct,min0,max100,max120){
  const c=Math.max(0,Math.min(120,oldPct));
  if(c<=100) return mapPercent(c,min0,max100);
  const t=(c-100)/20; return max100 + t*(max120-max100);
}
function mapFlutesNew(p){ if(p<=50){ const t=p/50; return Math.round(5 + t*(22-5)); } const t=(p-50)/50; return Math.round(22 + t*(30-22)); }
function mapHardnessFromFlutes(fl){ const t=Math.max(0,Math.min(1),(fl-5)/(30-5)); return 0.95 + (0.08-0.95)*t; }

/* ---------- Resize handling ---------- */
let lastRect=null;
window.addEventListener('resize', ()=>{ needResize=true; });
function resizeGL(rect){
  const dpr=Math.min(2,window.devicePixelRatio||1);
  const W=Math.floor(rect.width*dpr), H=Math.floor(rect.height*dpr);
  if(canvas.width!==W||canvas.height!==H){ canvas.width=W; canvas.height=H; gl.viewport(0,0,W,H); }
}

/* ---------- Loop ---------- */
let lastT=0, front=0, isRunning=false;
function startLoop(){
  if(isRunning) return;
  isRunning=true;
  requestAnimationFrame(loop);
}

function rectViewToNDC(viewRect, rect){
  const [vx,vy,vw,vh]=logoViewBox;
  const cw=rect.width, ch=rect.height, va=vw/vh, ca=cw/ch;
  let s, padX=0, padY=0;
  if(ca>=va){ s=ch/vh; padX=(cw-vw*s)*.5; } else { s=cw/vw; padY=(ch-vh*s)*.5; }
  const [lx,ly,lw,lh]=viewRect;
  const px0=padX+(lx-vx)*s, px1=padX+(lx+lw-vx)*s, py0=padY+(ly-vy)*s, py1=padY+(ly+lh-vy)*s;
  const nx0=(px0/cw)*2-1, nx1=(px1/cw)*2-1, ny0=1-(py0/ch)*2, ny1=1-(py1/ch)*2;
  return [nx0, ny1, nx1, ny0];
}

function loop(t){
  if(!texReady){ requestAnimationFrame(loop); return; }

  if(needResize || !lastRect){
    lastRect = canvas.getBoundingClientRect();
    resizeGL(lastRect);
    needResize=false;
  }

  gl.clear(gl.COLOR_BUFFER_BIT);
  const dt=lastT?(t-lastT)/1000:0; lastT=t;

  const sensPct = +audioSensitivity.value;
  const respPct = +ripplesResponse.value;
  const qtyPct  = +ripplesQuantity.value;

  let level=frozen.level, localFront=freezeVisuals?frozen.front:front;

  if(!freezeVisuals){
    let rms=0, mid=0;

    if(analyser){
      analyser.getByteTimeDomainData(timeWave);
      analyser.getByteFrequencyData(freq);

      // RMS
      let sum=0; for(let i=0;i<timeWave.length;i++){ const v=(timeWave[i]-128)/128; sum+=v*v; }
      rms=Math.sqrt(sum/timeWave.length);

      // Envelope (attack/decay)
      envelope = (rms>envelope) ? envelope*(1-0.7)+rms*0.7 : envelope*(1-0.08)+rms*0.08;

      // Mid band average
      const a=Math.floor(freq.length*.10), b=Math.floor(freq.length*.55);
      for(let i=a;i<b;i++) mid+=freq[i]; mid /= ((b-a)*255);
    }else{
      envelope*=0.98;
    }

    const isSilent = analyser ? (Math.abs(envelope) < NOISE_GATE) : true;

    const sens = 1.0 + mapPercent(sensPct, 0, 19);
    const base = envelope * (0.6 + 1.0*(mid||0)) * sens;

    const respOld   = responseOldPct(respPct);
    const respGain  = mapRespGain(respOld, 0.6, 2.4, 2.88);
    const widthScale= mapRespGain(respOld, 0.8, 2.6, 3.12);
    const strength  = isSilent ? 0.0 : mapRespGain(respOld, 0.12, 0.60, 0.72);

    const levelRaw = base * respGain;
    level = isSilent ? 0.0 : Math.min(1, Math.pow(levelRaw, 0.80));

    if(level > 0.012){
      front += dt * 0.85 * (0.35 + 1.0*level);
      if(front > 1.25) front = 0.0;
      localFront = front;
    }
    frozen.level=level; frozen.front=localFront;
    loop._width    = 0.26 * (isSilent ? 1.0 : widthScale);
    loop._strength = strength;
  }

  const flutes   = mapFlutesNew(qtyPct);
  const hardness = mapHardnessFromFlutes(flutes);
  const sigma=0.34;
  const width    = freezeVisuals?(loop._width??0.26):(loop._width??0.26);
  const strength = freezeVisuals?(loop._strength??0.0):(loop._strength??0.0);
  const tint = [1,1,1,1];

  gl.useProgram(program);
  gl.activeTexture(gl.TEXTURE0);
  gl.uniform1i(u_tex,0);
  gl.uniform1f(u_level,level);
  gl.uniform1f(u_sigma,sigma);
  gl.uniform1f(u_strength,strength);
  gl.uniform1f(u_flutes,flutes);
  gl.uniform1f(u_width,width);
  gl.uniform1f(u_hardness,hardness);
  gl.uniform4f(u_tint,tint[0],tint[1],tint[2],tint[3]);

  for(const [i,L] of letterTextures.entries()){
    gl.bindTexture(gl.TEXTURE_2D, L.tex);
    const ndc=rectViewToNDC(L.viewRect, { width: canvas.width, height: canvas.height });
    gl.uniform4f(u_ndcRect, ndc[0], ndc[1], ndc[2], ndc[3]);
    const phase=(t/2200)+i*0.07, letterFront=Math.min(1.2, Math.max(0.0, localFront + i*0.02));
    gl.uniform1f(u_phase,phase);
    gl.uniform1f(u_front,letterFront);
    gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
  }

  requestAnimationFrame(loop);
}

/* ---------- UI badges + reset state ---------- */
function updateResetState(){
  const isDefault =
    audioSensitivity.value === '0' &&
    ripplesResponse.value  === '50' &&
    ripplesQuantity.value  === '50';
  resetBtn.disabled = isDefault;
}
function updateBadges(){
  audioBadge.textContent = `${+audioSensitivity.value}%`;
  respBadge .textContent = `${+ripplesResponse.value}%`;
  qtyBadge  .textContent = `${+ripplesQuantity.value}%`;
  updateResetState();
}
[audioSensitivity, ripplesResponse, ripplesQuantity].forEach(el=>{
  el.addEventListener('input', updateBadges);
});
resetBtn.addEventListener('click', ()=>{
  audioSensitivity.value = '0';
  ripplesResponse.value  = '50';
  ripplesQuantity.value  = '50';
  updateBadges();
});

/* ---------- Native select -> custom dropdown enhancer ---------- */
(function enhanceContentSelect(){
  const sel = contentSelect;
  if (!sel || sel.dataset.enhanced === '1') return;

  // Wrap
  const wrap = document.createElement('div');
  wrap.className = 'select-wrap';
  sel.parentNode.insertBefore(wrap, sel);
  wrap.appendChild(sel);

  // Hide native select but keep it for events
  sel.classList.add('select--hidden');
  sel.dataset.enhanced = '1';

  // Trigger
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'select-trigger';
  const labelSpan = document.createElement('span');
  labelSpan.textContent = sel.options[sel.selectedIndex]?.text || 'Select';
  const caret = document.createElement('span');
  caret.className = 'select-caret';
  trigger.appendChild(labelSpan);
  trigger.appendChild(caret);
  wrap.appendChild(trigger);

  // Menu
  const menu = document.createElement('div');
  menu.className = 'select-menu';
  wrap.appendChild(menu);

  function rebuildMenu(){
    menu.innerHTML = '';
    Array.from(sel.options).forEach((opt, idx) => {
      const item = document.createElement('div');
      item.className = 'select-option';
      item.setAttribute('role','option');
      item.setAttribute('data-value', opt.value);
      item.setAttribute('aria-selected', String(idx === sel.selectedIndex));
      item.textContent = opt.textContent;
      item.addEventListener('click', () => {
        sel.value = opt.value;
        labelSpan.textContent = opt.textContent;
        Array.from(menu.children).forEach(n => n.setAttribute('aria-selected','false'));
        item.setAttribute('aria-selected','true');
        closeMenu();
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      });
      menu.appendChild(item);
    });
  }

  function openMenu(){
    rebuildMenu();
    menu.classList.add('is-open');
    document.addEventListener('click', outsideClose);
    document.addEventListener('keydown', keyHandler);
  }
  function closeMenu(){
    menu.classList.remove('is-open');
    document.removeEventListener('click', outsideClose);
    document.removeEventListener('keydown', keyHandler);
  }
  function outsideClose(e){
    if (!wrap.contains(e.target)) closeMenu();
  }
  function keyHandler(e){
    if (e.key === 'Escape') closeMenu();
  }

  trigger.addEventListener('click', () => {
    if (menu.classList.contains('is-open')) closeMenu();
    else openMenu();
  });

  // Keep label synced if value changes externally
  sel.addEventListener('change', () => {
    const opt = sel.options[sel.selectedIndex];
    if (opt) labelSpan.textContent = opt.textContent;
  });
})();

/* ---------- Content dropdown change handler (existing behavior) ---------- */
if (contentSelect){
  contentSelect.disabled = false;
  contentSelect.addEventListener('change', async ()=>{
    try{
      currentLogoPath = contentSelect.value;
      texReady=false;
      letterTextures.length = 0;
      await loadPerLetterTextures(currentLogoPath);
      needResize = true;
      startLoop();
    }catch(e){
      alert(e.message);
    }
  });
}

/* ---------- Init ---------- */
fileNameEl.textContent = 'No file...';
updateBadges();
updateFileButtons();
loadPerLetterTextures(currentLogoPath).then(startLoop).catch(e=>alert(e.message));

/* ---------- Mic buttons ---------- */
startBtn.addEventListener('click', startMic);
stopBtn .addEventListener('click', ()=> stopMic(false));

/* ---------- File transport buttons ---------- */
playBtn.addEventListener('click',  playFile);
pauseBtn.addEventListener('click', pauseFile);
stopPlaybackBtn.addEventListener('click', stopFile);

