/* A birthday keepsake for 吴桦凤. Runs offline and on GitHub Pages. */
(() => {
  'use strict';
  const data = window.BIRTHDAY_DATA;
  if (!data) return;
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let toastTimer;
  function toast(message) {
    $('#toast').textContent = message;
    $('#toast').classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 3500);
  }
  function element(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  }
  function formatTime(seconds) {
    return Math.floor(seconds / 60) + ':' + String(Math.floor(seconds % 60)).padStart(2, '0');
  }

  // Memories: only thumbnails load on the page. A video loads after a deliberate click.
  let filteredMedia = data.media;
  let viewerMedia = data.media;
  let mediaIndex = 0;
  const mediaDialog = $('#media-dialog');
  const letterDialog = $('#letter-dialog');
  function updateScrollLock() {
    document.body.style.overflow = $$('dialog[open]').length ? 'hidden' : '';
    syncFlowAnimation();
  }
  function stopVideo() {
    const video = $('#media-viewer video');
    if (video) {
      video.pause();
      video.removeAttribute('src');
      video.load();
    }
  }
  function displayMedia() {
    stopVideo();
    const item = viewerMedia[mediaIndex];
    const viewer = $('#media-viewer');
    viewer.replaceChildren();
    if (item.type === 'video') {
      stopMusic();
      const video = document.createElement('video');
      video.controls = true;
      video.playsInline = true;
      video.preload = 'none';
      video.poster = item.poster;
      video.src = item.src;
      video.setAttribute('aria-label', item.title);
      video.addEventListener('play', stopMusic);
      video.addEventListener('error', () => toast('视频暂时无法播放，请检查网络后重新打开。'));
      viewer.append(video);
    } else {
      const img = document.createElement('img');
      img.src = item.src;
      img.alt = item.title;
      img.width = item.width;
      img.height = item.height;
      viewer.append(img);
    }
    $('#media-title').textContent = item.title;
    $('#media-counter').textContent = String(mediaIndex + 1).padStart(2, '0') + ' / ' + String(viewerMedia.length).padStart(2, '0');
    $('#media-type').textContent = item.type === 'video' ? '一段有声音的回忆 · ' + formatTime(item.duration) : '属于我们的瞬间';
  }
  function openMedia(id, collection = filteredMedia) {
    viewerMedia = collection;
    mediaIndex = viewerMedia.findIndex(x => x.id === id);
    if (mediaIndex < 0) return;
    displayMedia();
    mediaDialog.showModal();
    updateScrollLock();
  }
  function advanceMedia(delta) {
    mediaIndex = (mediaIndex + delta + viewerMedia.length) % viewerMedia.length;
    displayMedia();
  }
  // Native scroll surfaces keep every memory reachable by touch and keyboard.
  // The two lanes reverse gently at their ends; there are no duplicated cards.
  const flow = $('#memory-grid');
  let flowStates = [];
  let flowFrame = 0;
  let flowLastTime = 0;
  let flowVisible = false;
  let flowPaused = false;
  const flowResize = new ResizeObserver(() => updateFlowControls());
  function flowCanRun() {
    return flowVisible && !flowPaused && !reduced.matches && !document.hidden && !$$('dialog[open]').length;
  }
  function syncFlowAnimation() {
    if (flowCanRun() && !flowFrame) {
      flowLastTime = performance.now();
      flowFrame = requestAnimationFrame(animateFlow);
    } else if (!flowCanRun() && flowFrame) {
      cancelAnimationFrame(flowFrame);
      flowFrame = 0;
    }
  }
  function animateFlow(now) {
    flowFrame = 0;
    if (!flowCanRun()) return;
    const delta = Math.min(now - flowLastTime, 50) / 1000;
    flowLastTime = now;
    flowStates.forEach(state => {
      const lane = state.lane;
      const max = lane.scrollWidth - lane.clientWidth;
      if (max < 2 || state.hovered || state.focused || state.drag || now < state.holdUntil) return;
      if (lane.scrollLeft >= max - 1) state.direction = -1;
      else if (lane.scrollLeft <= 1) state.direction = 1;
      state.velocity += (state.direction * 27 - state.velocity) * Math.min(delta * 3, 1);
      state.remainder += state.velocity * delta;
      const move = Math.trunc(state.remainder);
      if (move) { lane.scrollLeft += move; state.remainder -= move; }
    });
    flowFrame = requestAnimationFrame(animateFlow);
  }
  function updateFlowControls() {
    $('#flow-prev').disabled = flowStates.every(s => s.lane.scrollLeft <= 1);
    $('#flow-next').disabled = flowStates.every(s => s.lane.scrollLeft >= s.lane.scrollWidth - s.lane.clientWidth - 1);
    $('#flow-toggle').textContent = reduced.matches ? '手动浏览' : flowPaused ? '继续流动' : '暂停流动';
    $('#flow-toggle').setAttribute('aria-pressed', String(flowPaused || reduced.matches));
    $('#flow-toggle').disabled = reduced.matches;
  }
  function connectLane(lane, index) {
    const state = {lane, direction:index % 2 ? -1 : 1, velocity:index % 2 ? -27 : 27, remainder:0, hovered:false, focused:false, drag:null, holdUntil:0, blockClickUntil:0};
    flowStates.push(state);
    lane.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') state.hovered = true; });
    lane.addEventListener('pointerleave', () => { state.hovered = false; });
    lane.addEventListener('focusin', e => { state.focused = e.target.matches(':focus-visible'); });
    lane.addEventListener('focusout', e => { state.focused = lane.contains(e.relatedTarget); });
    lane.addEventListener('wheel', () => { state.holdUntil = performance.now() + 3500; }, {passive:true});
    lane.addEventListener('touchstart', () => { state.holdUntil = Infinity; }, {passive:true});
    ['touchend','touchcancel'].forEach(name => lane.addEventListener(name, () => { state.holdUntil = performance.now() + 3500; }, {passive:true}));
    lane.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      state.drag = {x:e.clientX, start:lane.scrollLeft, moved:false, pointerId:e.pointerId};
    });
    lane.addEventListener('pointermove', e => {
      if (!state.drag) return;
      if (!(e.buttons & 1)) { endDrag(e); return; }
      const distance = e.clientX - state.drag.x;
      if (!state.drag.moved && Math.abs(distance) > 6) {
        state.drag.moved = true;
        lane.setPointerCapture(e.pointerId);
        lane.classList.add('dragging');
      }
      if (state.drag.moved) {
        e.preventDefault();
        lane.scrollLeft = state.drag.start - distance;
      }
    });
    function endDrag(e) {
      if (!state.drag) return;
      if (state.drag.moved) state.blockClickUntil = performance.now() + 250;
      if (lane.hasPointerCapture(e.pointerId)) lane.releasePointerCapture(e.pointerId);
      state.drag = null;
      state.holdUntil = performance.now() + 3500;
      lane.classList.remove('dragging');
    }
    state.endDrag = endDrag;
    ['pointerup','pointercancel','lostpointercapture'].forEach(name => lane.addEventListener(name,endDrag));
    lane.addEventListener('click', e => {
      if (performance.now() < state.blockClickUntil) { e.preventDefault(); e.stopImmediatePropagation(); }
    }, true);
    lane.addEventListener('keydown', e => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      state.focused = true;
      e.preventDefault();
      state.holdUntil = performance.now() + 3500;
      lane.scrollBy({left:lane.clientWidth * .65 * (e.key === 'ArrowRight' ? 1 : -1),behavior:reduced.matches?'instant':'smooth'});
    });
    lane.addEventListener('scroll', updateFlowControls, {passive:true});
    flowResize.observe(lane);
    return state;
  }
  function renderGallery(filter = 'all') {
    filteredMedia = data.media.filter(x => filter === 'all' || x.type === filter);
    flowResize.disconnect();
    flowStates = [];
    flow.replaceChildren();
    const rowCount = filteredMedia.length > 6 ? 2 : 1;
    const lanes = Array.from({length:rowCount}, (_, index) => {
      const lane = element('div', 'memory-lane');
      lane.tabIndex = 0;
      lane.setAttribute('role','region');
      lane.setAttribute('aria-label', '第' + (index + 1) + '条回忆照片带，可左右滑动');
      flow.append(lane);
      connectLane(lane,index);
      return lane;
    });
    filteredMedia.forEach((item,index) => {
      const button = element('button', 'memory-card');
      button.type = 'button';
      button.dataset.id = item.id;
      const ratio = item.width / item.height;
      button.style.setProperty('--card-width', (Math.round(230 * Math.min(2.05, Math.max(.75, ratio))) + 22) + 'px');
      if (ratio > 2) button.classList.add('panoramic');
      button.setAttribute('aria-label', (item.type === 'video' ? '播放视频：' : '查看照片：') + item.title);
      const thumb = element('div', 'memory-thumb');
      const img = document.createElement('img');
      img.src = item.thumbnail;
      img.alt = item.title;
      img.loading = 'lazy';
      img.decoding = 'async';
      img.width = item.width;
      img.height = item.height;
      img.draggable = false;
      thumb.append(img);
      if (item.type === 'video') {
        const play = element('span', 'play-badge', '▶');
        play.setAttribute('aria-hidden', 'true');
        thumb.append(play, element('span', 'video-tag', 'VIDEO · ' + formatTime(item.duration)));
      }
      const caption = element('div', 'memory-caption');
      caption.append(element('strong', '', item.title), element('span', '', String(data.media.indexOf(item) + 1).padStart(2,'0')));
      button.append(thumb, caption);
      button.addEventListener('click', () => openMedia(item.id));
      lanes[index % rowCount].append(button);
    });
    if (lanes.length > 1) lanes[1].scrollLeft = Math.min(220, lanes[1].scrollWidth - lanes[1].clientWidth);
    updateFlowControls();
    syncFlowAnimation();
  }
  renderGallery();
  ['pointerup','pointercancel'].forEach(name => window.addEventListener(name, e => {
    flowStates.forEach(state => state.endDrag(e));
  }));
  const flowObserver = new IntersectionObserver(entries => {
    flowVisible = entries[0].isIntersecting;
    syncFlowAnimation();
  }, {threshold:.05});
  flowObserver.observe(flow);
  $('#flow-toggle').addEventListener('click', () => { flowPaused = !flowPaused; updateFlowControls(); syncFlowAnimation(); });
  [['#flow-prev',-1],['#flow-next',1]].forEach(([selector,direction]) => $(selector).addEventListener('click', () => {
    flowStates.forEach(state => {
      state.holdUntil = performance.now() + 4500;
      state.lane.scrollBy({left:state.lane.clientWidth * .65 * direction,behavior:reduced.matches?'instant':'smooth'});
    });
  }));
  reduced.addEventListener('change', () => { updateFlowControls(); syncFlowAnimation(); });
  document.addEventListener('visibilitychange', syncFlowAnimation);
  $('#all-count').textContent = data.media.length;
  $('#image-count').textContent = data.media.filter(x => x.type === 'image').length;
  $('#video-count').textContent = data.media.filter(x => x.type === 'video').length;
  $$('.filter').forEach(button => button.addEventListener('click', () => {
    $$('.filter').forEach(b => { b.classList.toggle('active', b === button); b.setAttribute('aria-pressed', String(b === button)); });
    renderGallery(button.dataset.filter);
  }));
  [['back','memory-10'],['front','memory-09']].forEach(([placement,id]) => {
    const item = data.media.find(x => x.id === id);
    const img = $('#hero-image-' + placement);
    img.src = item.src;
    img.alt = item.title;
    img.width = item.width;
    img.height = item.height;
    $('#hero-caption-' + placement).textContent = item.title;
    $('#hero-photo-' + placement).setAttribute('aria-label', '查看照片：' + item.title);
    $('#hero-photo-' + placement).addEventListener('click', () => openMedia(id, data.media));
  });
  $('#media-prev').addEventListener('click', () => advanceMedia(-1));
  $('#media-next').addEventListener('click', () => advanceMedia(1));
  mediaDialog.addEventListener('keydown', event => {
    if (event.target.tagName === 'VIDEO') return;
    if (event.key === 'ArrowLeft') { event.preventDefault(); advanceMedia(-1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); advanceMedia(1); }
  });
  let touchX = null;
  $('#media-viewer').addEventListener('touchstart', event => {
    touchX = event.target.tagName === 'VIDEO' ? null : event.changedTouches[0].clientX;
  }, {passive:true});
  $('#media-viewer').addEventListener('touchend', event => {
    if (touchX === null) return;
    const delta = event.changedTouches[0].clientX - touchX;
    if (Math.abs(delta) > 70) advanceMedia(delta > 0 ? -1 : 1);
    touchX = null;
  }, {passive:true});

  // Letters preserve the supplied wording and paragraph breaks.
  data.letters.forEach((letter, index) => {
    const button = element('button', 'envelope');
    button.type = 'button';
    button.setAttribute('aria-label', '拆开' + letter.author + '的信');
    const flap = element('span', 'envelope-flap');
    const seal = element('span', 'envelope-seal', '♡');
    const stamp = element('span', 'envelope-stamp', 'WITH\nLOVE');
    [flap,seal,stamp].forEach(x => x.setAttribute('aria-hidden','true'));
    const footer = element('span', 'envelope-footer');
    footer.append(element('span', '', '来自 ' + letter.author), element('span', '', '亲手拆开 ♡'));
    button.append(flap,seal,stamp,element('span', 'envelope-recipient', 'To. 亲爱的吴桦凤'),footer);
    button.addEventListener('click', () => {
      $('#letter-eyebrow').textContent = 'LETTER ' + String(index + 1).padStart(2,'0') + ' / FROM ' + letter.author;
      $('#letter-title').textContent = letter.title;
      $('#letter-content').replaceChildren(...letter.paragraphs.map(text => element('p', '', text)));
      letterDialog.showModal();
      letterDialog.scrollTop = 0;
      updateScrollLock();
      if (!reduced.matches) $('.letter-paper').animate([{opacity:0,transform:'translateY(14px)'},{opacity:1,transform:'translateY(0)'}],{duration:480,easing:'ease-out'});
    });
    $('#letter-envelopes').append(button);
  });
  $$('dialog').forEach(dialog => {
    dialog.querySelector('.close-dialog').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    });
    dialog.addEventListener('close', () => { if (dialog === mediaDialog) stopVideo(); updateScrollLock(); });
  });

  // Three independent lanes keep the moving wishes apart, with a readable static alternative.
  const stage = $('#danmu-stage');
  const blessingQueue = [...data.blessings];
  let blessingIndex = 0;
  let paused = reduced.matches;
  let lastTick = performance.now();
  const laneFree = [0,0,0];
  data.blessings.forEach(blessing => {
    const li = element('li','',blessing.text + ' ');
    li.append(element('span','','— ' + blessing.author + (blessing.isExcerpt ? '（摘自来信）' : '')));
    $('#blessings-list').append(li);
  });
  function addDanmu(blessing, lane, initial = false) {
    const item = element('span', 'danmu-item' + (lane % 2 ? ' alt' : ''), blessing.text);
    item.append(element('small', '', blessing.author));
    item.style.top = (lane * 43) + 'px';
    stage.append(item);
    if (reduced.matches) {
      while (stage.children.length > 3) stage.firstElementChild.remove();
      return;
    }
    const speed = innerWidth < 760 ? 43 : 60;
    const travel = innerWidth + item.offsetWidth;
    item.style.setProperty('--duration', (travel / speed) + 's');
    const elapsed = initial ? innerWidth * .78 / speed : 0;
    item.style.animationDelay = -elapsed + 's';
    laneFree[lane] = performance.now() + Math.max(0, (item.offsetWidth + 36) / speed - elapsed) * 1000;
    item.addEventListener('animationend', () => item.remove(), {once:true});
  }
  function updateDanmuButton() {
    stage.classList.toggle('paused', paused || document.hidden);
    $('#danmu-toggle').textContent = paused ? '播放弹幕' : '暂停弹幕';
    $('#danmu-toggle').setAttribute('aria-pressed', String(paused));
  }
  [0,1,2].forEach(lane => addDanmu(blessingQueue[blessingIndex++],lane,true));
  updateDanmuButton();
  if (reduced.matches) { $('#danmu-toggle').hidden = true; $('.blessings-transcript').open = true; }
  setInterval(() => {
    const now = performance.now();
    if (paused || document.hidden) {
      for (let lane=0;lane<3;lane++) laneFree[lane] += now-lastTick;
    } else if (!reduced.matches) {
      for (let lane=0;lane<3;lane++) if (now >= laneFree[lane]) {
        addDanmu(blessingQueue[blessingIndex++ % blessingQueue.length],lane);
      }
    }
    lastTick=now;
  }, 250);
  $('#danmu-toggle').addEventListener('click', () => { paused=!paused; updateDanmuButton(); });
  $('#blessing-form').addEventListener('submit', event => {
    event.preventDefault();
    const text = $('#blessing-input').value.trim();
    if (!text) return;
    const blessing = {text,author:'此刻的祝福'};
    blessingQueue.splice(blessingIndex % blessingQueue.length, 0, blessing);
    const li = element('li','',text + ' ');
    li.append(element('span','','— 此刻的祝福'));
    $('#blessings-list').prepend(li);
    if (reduced.matches) addDanmu(blessing,0);
    else if (paused) { paused=false; updateDanmuButton(); }
    $('#blessing-input').value='';
    toast('祝福已经加入弹幕，马上就到你啦 ♡');
  });

  // The melody is synthesized locally and starts only after pressing the music control.
  let audioContext = null;
  let musicOn = false;
  let melodyTimer = null;
  const oscillators = new Set();
  const melody = [[67,.75],[67,.25],[69,1],[67,1],[72,1],[71,2],[67,.75],[67,.25],[69,1],[67,1],[74,1],[72,2],[67,.75],[67,.25],[79,1],[76,1],[72,1],[71,1],[69,1.5],[77,.75],[77,.25],[76,1],[72,1],[74,1],[72,2.5]];
  function musicLabel() {
    $('#sound-toggle').setAttribute('aria-pressed',String(musicOn));
    $('#sound-label').textContent=musicOn?'暂停生日旋律':'播放生日旋律';
  }
  function stopMusic() {
    musicOn=false;
    clearTimeout(melodyTimer);
    oscillators.forEach(osc => { try{osc.stop();}catch{} });
    oscillators.clear();
    musicLabel();
  }
  function playPhrase() {
    if (!musicOn || !audioContext) return;
    let time=audioContext.currentTime+.12;
    melody.forEach(([note,beats]) => {
      const oscillator=audioContext.createOscillator();
      const gain=audioContext.createGain();
      oscillator.type='sine';
      oscillator.frequency.value=440*Math.pow(2,(note-69)/12);
      const duration=beats*.39;
      gain.gain.setValueAtTime(0,time);
      gain.gain.linearRampToValueAtTime(.13,time+.02);
      gain.gain.exponentialRampToValueAtTime(.001,time+duration*.94);
      oscillator.connect(gain);gain.connect(audioContext.destination);
      oscillator.start(time);oscillator.stop(time+duration);
      oscillators.add(oscillator);
      oscillator.onended=()=>{oscillators.delete(oscillator);oscillator.disconnect();gain.disconnect();};
      time+=duration;
    });
    melodyTimer=setTimeout(playPhrase,(time-audioContext.currentTime+2)*1000);
  }
  $('#sound-toggle').addEventListener('click', async () => {
    if (musicOn) return stopMusic();
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) throw new Error('Audio unavailable');
      audioContext ||= new Audio();
      await audioContext.resume();
      musicOn=true;musicLabel();playPhrase();
    } catch {toast('这个浏览器暂时无法播放旋律，换个浏览器试试吧。');}
  });
  document.addEventListener('visibilitychange', () => {
    updateDanmuButton();
    if (document.hidden) { stopMusic(); const video=$('#media-viewer video'); if(video) video.pause(); }
  });

  // Confetti and small fireworks, with bounded work and reduced-motion support.
  const canvas=$('#celebration');
  const context=canvas.getContext('2d');
  let particles=[];
  let animationFrame=null;
  let previousFrame=0;
  const colors=['#a32542','#dca687','#f1c65c','#d786a3','#887944','#faf0dd'];
  function resizeCanvas() {
    const dpr=Math.min(devicePixelRatio||1,2);
    canvas.width=innerWidth*dpr;canvas.height=innerHeight*dpr;
    context.setTransform(dpr,0,0,dpr,0,0);
  }
  resizeCanvas();
  addEventListener('resize',resizeCanvas);
  function animateCelebration(now) {
    const dt=Math.min((now-previousFrame)/16.667,2)||1;previousFrame=now;
    context.clearRect(0,0,innerWidth,innerHeight);
    particles=particles.filter(p=>p.life>0&&p.y<innerHeight+30);
    for (const p of particles) {
      p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=p.gravity*dt;p.rotation+=p.spin*dt;p.life-=dt;
      context.save();context.translate(p.x,p.y);context.rotate(p.rotation);
      context.globalAlpha=Math.min(1,p.life/30);context.fillStyle=p.color;
      if(p.firework){context.beginPath();context.arc(0,0,p.size*.45,0,Math.PI*2);context.fill();}
      else context.fillRect(-p.size/2,-p.size/2,p.size,p.size*.55);
      context.restore();
    }
    if(particles.length) animationFrame=requestAnimationFrame(animateCelebration);
    else {animationFrame=null;context.clearRect(0,0,innerWidth,innerHeight);}
  }
  function celebrate() {
    if(reduced.matches)return;
    for(let i=0;i<145;i++) particles.push({x:innerWidth/2,y:innerHeight*.7,vx:(Math.random()-.5)*18,vy:-Math.random()*16-5,gravity:.12,size:4+Math.random()*6,rotation:Math.random()*Math.PI,spin:(Math.random()-.5)*.17,life:180+Math.random()*100,color:colors[i%colors.length]});
    [[.2,.3],[.8,.25],[.5,.18]].forEach(([x,y],index)=>setTimeout(()=>{
      for(let i=0;i<45;i++){const angle=i/45*Math.PI*2;const speed=2+Math.random()*3;particles.push({x:innerWidth*x,y:innerHeight*y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,gravity:.025,size:4,rotation:0,spin:0,life:70,color:colors[i%colors.length],firework:true});}
      if(!animationFrame){previousFrame=performance.now();animationFrame=requestAnimationFrame(animateCelebration);}
    },index*450+200));
    if(!animationFrame){previousFrame=performance.now();animationFrame=requestAnimationFrame(animateCelebration);}
  }
  $('#wish-button').addEventListener('click',()=>{
    $('#candle-flame').classList.add('out');
    $('#wish-button').hidden=true;
    $('#relight-button').hidden=false;
    $('#wish-title').replaceChildren(document.createTextNode('愿望已收藏，'),document.createElement('br'),element('em','','好事正在路上。'));
    $('#wish-message').textContent='吴桦凤，生日快乐！愿新的一岁，有热爱，有自由，有我们。';
    $('#wish-note').textContent='你的愿望，一定值得最美好的回应。';
    celebrate();
  });
  $('#relight-button').addEventListener('click',()=>{
    $('#candle-flame').classList.remove('out');
    $('#wish-button').hidden=false;$('#relight-button').hidden=true;
    $('#wish-note').textContent='蜡烛又亮起来了，再许一个愿吧。';
    $('#wish-title').replaceChildren(document.createTextNode('现在，'),document.createElement('br'),document.createTextNode('世界为你'),element('em','','安静三秒。'));
    $('#wish-message').replaceChildren(document.createTextNode('闭上眼睛，许一个只属于你的愿望。'),document.createElement('br'),document.createTextNode('不用说出来，我们陪你等它实现。'));
  });

  // A downloadable, full-resolution card without any external font or service.
  $('#download-card').addEventListener('click', async () => {
    const button=$('#download-card');
    button.disabled=true;
    $('#download-note').textContent='正在把祝福装进贺卡…';
    try {
      if(document.fonts) await document.fonts.ready;
      const card=document.createElement('canvas');card.width=1200;card.height=1600;
      const ctx=card.getContext('2d');
      ctx.fillStyle='#fbf7ee';ctx.fillRect(0,0,1200,1600);
      ctx.strokeStyle='#a32542';ctx.lineWidth=3;ctx.strokeRect(44,44,1112,1512);ctx.lineWidth=1;ctx.strokeRect(59,59,1082,1482);
      ctx.fillStyle='#a32542';
      for(let y=80;y<1520;y+=38){ctx.save();ctx.translate(26,y);ctx.rotate(Math.PI/4);ctx.fillRect(-7,-7,14,14);ctx.restore();ctx.save();ctx.translate(1174,y);ctx.rotate(Math.PI/4);ctx.fillRect(-7,-7,14,14);ctx.restore();}
      ctx.font='25px "Microsoft YaHei",sans-serif';ctx.fillText('TO: 吴桦凤',115,145);ctx.textAlign='right';ctx.fillText('09 / 19',1085,145);
      ctx.strokeStyle='#d9b9b6';ctx.beginPath();ctx.moveTo(115,180);ctx.lineTo(1085,180);ctx.stroke();
      ctx.textAlign='center';ctx.font='italic 76px Georgia,serif';ctx.fillText('Happy Birthday',600,315);
      ctx.font='115px Georgia,serif';ctx.fillText('✳',600,495);
      ctx.font='64px "Microsoft YaHei",sans-serif';
      ['愿你永远自由，','永远热烈，','永远是你。'].forEach((line,index)=>ctx.fillText(line,600,685+index*120));
      ctx.font='29px "Microsoft YaHei",sans-serif';ctx.fillText('生日快乐，吴桦凤。',600,1100);ctx.fillText('迟到的聚会，不迟到的爱。',600,1160);
      ctx.beginPath();ctx.moveTo(115,1260);ctx.lineTo(1085,1260);ctx.stroke();
      ctx.font='27px "Microsoft YaHei",sans-serif';ctx.fillText('我们都在，来日方长。',600,1340);ctx.font='25px "Microsoft YaHei",sans-serif';ctx.fillText('你的好朋友们 · WITH LOVE ♡',600,1410);
      const blob=await new Promise((resolve,reject)=>card.toBlob(value=>value?resolve(value):reject(new Error('Export failed')),'image/png'));
      const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='吴桦凤-生日快乐.png';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
      $('#download-note').textContent='贺卡已生成；若手机打开了图片，长按即可保存。';
      toast('这份心意，可以一直收藏 ♡');
    }catch{$('#download-note').textContent='保存暂时没有成功，可以截图留住这张贺卡。';}
    finally{button.disabled=false;}
  });
})();
