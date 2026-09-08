(() => {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const nativeLens = /Chrome|Chromium|Edg\//.test(navigator.userAgent) && CSS.supports('backdrop-filter', 'url("#lens-0")');
  document.documentElement.classList.toggle('light-glass', !nativeLens);
  // Use a lightweight clear material in engines without SVG backdrop support.
  if (/Chrome|Chromium|Edg\//.test(navigator.userAgent) && CSS.supports('backdrop-filter', 'url("#lens-0")')) {
    document.documentElement.classList.add('svg-backdrop');
  }
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const hand = document.getElementById('dragHand');
  const hills = document.getElementById('hills');
  const bubbleLayer = document.getElementById('bubbleLayer');
  const hint = document.querySelector('.hint');

  // A rounded-rectangle normal map bends the scene at the rim, leaving the
  // center optically clear. The ordinary SVG filter also works without
  // browser support for SVG backdrop filters.
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('width', '0'); svg.setAttribute('height', '0');
  svg.style.position = 'absolute';
  const defs = document.createElementNS(ns, 'defs');
  svg.appendChild(defs); document.body.prepend(svg);
  const surfaces = document.querySelectorAll('.navbar, .links-dropdown, .intro-text, .skills-panel, .card, #hobbies .prose, .avatar');
  surfaces.forEach((el, index) => {
    el.classList.add('liquid-glass');
    if (nativeLens && el.matches('.navbar, .links-dropdown')) {
    const filter = document.createElementNS(ns, 'filter');
    filter.id = `lens-${index}`;
    filter.setAttribute('color-interpolation-filters', 'sRGB');
    filter.setAttribute('x', '-10%'); filter.setAttribute('y', '-10%');
    filter.setAttribute('width', '120%'); filter.setAttribute('height', '120%');
    const map = document.createElementNS(ns, 'feImage');
    map.setAttribute('result', 'normal'); map.setAttribute('preserveAspectRatio', 'none');
    const displacement = document.createElementNS(ns, 'feDisplacementMap');
    displacement.setAttribute('in', 'SourceGraphic'); displacement.setAttribute('in2', 'normal');
    displacement.setAttribute('scale', '6');
    displacement.setAttribute('xChannelSelector', 'R'); displacement.setAttribute('yChannelSelector', 'G');
    filter.append(map, displacement); defs.appendChild(filter);
    el.style.setProperty('--lens-filter', `url(#${filter.id})`);
    let oldSize = '';
    const updateMap = () => {
      const w = Math.round(el.offsetWidth), h = Math.round(el.offsetHeight);
      if (!w || !h || oldSize === `${w}:${h}`) return;
      oldSize = `${w}:${h}`;
      const canvas = document.createElement('canvas');
      // Cap map resolution; this is built only when geometry changes.
      const ratio = Math.min(1, 600 / w);
      canvas.width = Math.max(1, Math.round(w * ratio));
      canvas.height = Math.max(1, Math.round(h * ratio));
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const pixels = ctx.createImageData(canvas.width, canvas.height);
      const radius = Math.min(parseFloat(getComputedStyle(el).borderTopLeftRadius) || 28, w/2, h/2);
      for (let y=0; y<canvas.height; y++) for (let x=0; x<canvas.width; x++) {
        const px=(x+.5)/ratio-w/2, py=(y+.5)/ratio-h/2;
        const qx=Math.abs(px)-(w/2-radius), qy=Math.abs(py)-(h/2-radius);
        const ax=Math.max(qx,0), ay=Math.max(qy,0), length=Math.hypot(ax,ay);
        const distance=length+Math.min(Math.max(qx,qy),0)-radius;
        const strength=Math.sin(clamp(-distance/12,0,1)*Math.PI);
        let nx=0, ny=0;
        if (length>0) { nx=ax/length*Math.sign(px); ny=ay/length*Math.sign(py); }
        else if (qx>qy) nx=Math.sign(px); else ny=Math.sign(py);
        const i=(y*canvas.width+x)*4;
        pixels.data[i]=128+nx*strength*110;
        pixels.data[i+1]=128+ny*strength*110;
        pixels.data[i+2]=128; pixels.data[i+3]=255;
      }
      ctx.putImageData(pixels,0,0);
      map.setAttribute('href',canvas.toDataURL());
      map.setAttribute('x','0'); map.setAttribute('y','0');
      map.setAttribute('width',String(w)); map.setAttribute('height',String(h));
    };
    new ResizeObserver(updateMap).observe(el);
    updateMap();
    }
    if (el.matches('.card, .intro-text, .skills-panel, #hobbies .prose')) {
      el.classList.add('pointer-surface');
      const sheen=document.createElement('span');sheen.className='pointer-sheen';sheen.setAttribute('aria-hidden','true');el.appendChild(sheen);
    }
    let hoverFrame = null;
    el.addEventListener('pointermove', e => {
      if (!finePointer.matches || motion.matches || hoverFrame !== null) return;
      hoverFrame = requestAnimationFrame(() => {
        const r=el.getBoundingClientRect();
        const x=clamp((e.clientX-r.left)/r.width,0,1), y=clamp((e.clientY-r.top)/r.height,0,1);
        el.style.setProperty('--sheen-x', `${e.clientX-r.left}px`);
        el.style.setProperty('--sheen-y', `${e.clientY-r.top}px`);
        el.style.setProperty('--pull-x', `${(x-.5)*5}px`);
        el.style.setProperty('--pull-y', `${(y-.5)*4}px`);
        el.style.setProperty('--light-x', `${x*100}%`);
        el.style.setProperty('--light-y', `${y*100}%`);
        el.style.setProperty('--tilt-x', `${(0.5-y)*2}deg`);
        el.style.setProperty('--tilt-y', `${(x-0.5)*2}deg`);
        hoverFrame=null;
      });
    });
    el.addEventListener('pointerleave', () => {
      if (hoverFrame !== null) cancelAnimationFrame(hoverFrame);
      hoverFrame=null;
      el.style.setProperty('--pull-x','0px');el.style.setProperty('--pull-y','0px');
      el.style.setProperty('--tilt-x','0deg'); el.style.setProperty('--tilt-y','0deg');
      el.style.setProperty('--light-x','20%'); el.style.setProperty('--light-y','0%');
    });
  });


  // A short-lived spring simulation: only blades near the contact point get force.
  const meadowSvg = hills?.querySelector('.hills-svg');
  const blades = [...(hills?.querySelectorAll('.grass-blade') || [])].map((el,i) => ({
    el, x:Number(el.dataset.root), y:Number(el.dataset.base), h:Number(el.dataset.height),
    angle:0, velocity:0, stiffness:0.045+(i%9)*0.003
  }));
  let grassFrame=null, grassTime=0;
  function stepGrass(now) {
    const dt=Math.min(2,(now-grassTime)/16.667 || 1); grassTime=now;
    let moving=false;
    for (const b of blades) {
      if (b.angle===0 && b.velocity===0) continue;
      b.velocity+=(-b.angle*b.stiffness)*dt;
      b.velocity*=Math.pow(.84,dt);
      b.angle=clamp(b.angle+b.velocity*dt,-38,38);
      if(Math.abs(b.angle)+Math.abs(b.velocity)>.035) moving=true;
      else {b.angle=0;b.velocity=0;}
      b.el.style.transform=`rotate(${b.angle}deg)`;
    }
    grassFrame=moving?requestAnimationFrame(stepGrass):null;
  }
  function brushGrass(clientX,clientY,dx=0) {
    if(motion.matches || !meadowSvg || !blades.length) return;
    const matrix=meadowSvg.getScreenCTM();
    if(!matrix) return;
    const point=new DOMPoint(clientX,clientY).matrixTransform(matrix.inverse());
    const radius=70;
    for(const b of blades) {
      const distance=Math.abs(b.x-point.x);
      if(distance>radius || point.y<b.y-b.h-22 || point.y>b.y+15) continue;
      const weight=Math.pow(1-distance/radius,2);
      b.velocity+=weight*clamp(dx*.4+(b.x<point.x?-2:2),-6,6);
    }
    if(grassFrame===null) {grassTime=performance.now();grassFrame=requestAnimationFrame(stepGrass);}
  }
  let previousGrassX=null;
  hills?.addEventListener('pointermove', e=>{
    brushGrass(e.clientX,e.clientY,previousGrassX===null?0:e.clientX-previousGrassX);
    previousGrassX=e.clientX;
  });
  hills?.addEventListener('pointerleave',()=>{previousGrassX=null;});
  const settleGrass=()=>{
    if(grassFrame!==null) cancelAnimationFrame(grassFrame);
    grassFrame=null;
    blades.forEach(b=>{b.angle=b.velocity=0;b.el.style.transform='';});
  };
  motion.addEventListener('change',settleGrass);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)settleGrass();});

  if (hand && hills && bubbleLayer) {
    const home = hand.parentElement;
    const placeholder = document.createElement('span');
    placeholder.className='hand-placeholder';
    let pointer=null, lastX=0, lastY=0, downX=0, downY=0, grabX=0, grabY=0;
    let moved=false, touched=false, lastEmit=0, returning=null, resetHint=null;
    const say = text => { hint.textContent=text; };
    const onGrass = (x,y) => document.elementsFromPoint(x,y).some(el => el.classList.contains('hill-layer'));
    const celebrate = (x,y) => {
      touched=true; say('Grass touched. Feeling better.');
      hills.classList.add('is-touched');
      brushGrass(x, y, 7);
      if (motion.matches) return;
      const r=hills.getBoundingClientRect();
      for (let i=0;i<3;i++) {
        const particle=document.createElement('span');
        particle.className='grass-particle'; particle.textContent=['🌱','✨','💚'][i];
        particle.style.left=`${x-r.left}px`; particle.style.top=`${y-r.top}px`;
        particle.style.setProperty('--drift',`${(i-1)*38}px`);
        particle.style.setProperty('--delay',`${i*45}ms`);
        bubbleLayer.appendChild(particle);
        setTimeout(()=>particle.remove(),1200);
      }
    };
    const restore = () => {
      if (returning) { returning.cancel(); returning=null; }
      if (placeholder.parentNode) placeholder.replaceWith(hand);
      hand.classList.remove('is-floating','is-over-grass');
      hand.style.transform='';
      document.body.classList.remove('dragging-hand');
    };
    const finish = (cancelled=false) => {
      if (pointer===null) return;
      const id=pointer; pointer=null;
      if (hand.hasPointerCapture(id)) hand.releasePointerCapture(id);
      hills.classList.remove('is-ready','is-touching');

      hand.classList.remove('is-over-grass');
      document.body.classList.remove('dragging-hand');
      if (!cancelled && !moved) {
        const r=hills.getBoundingClientRect(); celebrate(r.left+r.width/2,r.bottom-55);
      }
      if (cancelled) say('Drag me to the grass');
      else if (!touched) say('A little further — onto the green');
      const r=placeholder.getBoundingClientRect();
      if (motion.matches) restore();
      else {
        returning=hand.animate([
          {transform:hand.style.transform},
          {transform:`translate3d(${r.left}px,${r.top}px,0) scale(1)`}
        ],{duration:440,easing:'cubic-bezier(.22,1.2,.36,1)',fill:'forwards'});
        returning.onfinish=restore;
      }
      clearTimeout(resetHint);
      resetHint=setTimeout(()=>{say('Drag me to the grass');hills.classList.remove('is-touched');},2600);
    };
    hand.addEventListener('pointerdown',e=>{
      if (pointer!==null || !e.isPrimary || e.button!==0) return;
      e.preventDefault(); restore(); clearTimeout(resetHint);
      hand.focus({preventScroll:true});
      const r=hand.getBoundingClientRect();
      grabX=e.clientX-r.left; grabY=e.clientY-r.top;
      downX=lastX=e.clientX; downY=lastY=e.clientY;
      moved=touched=false; lastEmit=0; pointer=e.pointerId;
      home.insertBefore(placeholder,hand); document.body.appendChild(hand);
      hand.classList.add('is-floating'); document.body.classList.add('dragging-hand');
      hand.style.transform=`translate3d(${r.left}px,${r.top}px,0) scale(1)`;
      hand.setPointerCapture(pointer);
      hills.classList.add('is-ready'); say('Take me to the green ↓');
    });
    hand.addEventListener('pointermove',e=>{
      if (e.pointerId!==pointer) return;
      moved ||= Math.hypot(e.clientX-downX,e.clientY-downY)>5;
      const dx=e.clientX-lastX;
      lastX=e.clientX; lastY=e.clientY;
      const x=clamp(e.clientX-grabX,0,innerWidth-48),y=clamp(e.clientY-grabY,0,innerHeight-48);
      hand.style.transform=`translate3d(${x}px,${y}px,0) scale(1)`;
      const hit=onGrass(e.clientX,e.clientY);
      hand.classList.toggle('is-over-grass',hit); hills.classList.toggle('is-touching',hit);
      brushGrass(e.clientX, e.clientY, dx);
      if(hit && performance.now()-lastEmit>180) { celebrate(e.clientX,e.clientY);lastEmit=performance.now(); }
    });
    hand.addEventListener('pointerup',e=>{if(e.pointerId===pointer)finish();});
    hand.addEventListener('pointercancel',e=>{if(e.pointerId===pointer)finish(true);});
    hand.addEventListener('lostpointercapture',()=>{if(pointer!==null)finish(true);});
    window.addEventListener('blur',()=>finish(true));
    window.addEventListener('keydown',e=>{if(e.key==='Escape')finish(true);});
    hand.addEventListener('click',e=>{
      // Pointer activation is handled above; native keyboard activation has detail 0.
      if(e.detail!==0 || pointer!==null) return;
      const r=hills.getBoundingClientRect(); celebrate(r.left+r.width/2,r.bottom-55);
      clearTimeout(resetHint);
      resetHint=setTimeout(()=>{say('Drag me to the grass');hills.classList.remove('is-touched');},2600);
    });
  }

  // Native disclosure stays keyboard accessible and dismisses predictably.
  const linksMenu = document.querySelector('.links-menu');
  if (linksMenu) {
    const trigger=linksMenu.querySelector('summary');
    const dropdown=linksMenu.querySelector('.links-dropdown');
    linksMenu.addEventListener('toggle',()=>{
      if(!linksMenu.open || motion.matches) return;
      trigger.animate([{transform:'scale(1)'},{transform:'scale(1.12,.86)'},{transform:'scale(.96,1.06)'},{transform:'scale(1)'}],{duration:520,easing:'cubic-bezier(.2,.8,.2,1)'});
      dropdown.animate([
        {opacity:0,transform:'translateY(-20px) scale(.45,.18)',borderRadius:'60px'},
        {opacity:1,transform:'translateY(3px) scale(1.04,.96)',borderRadius:'28px',offset:.7},
        {opacity:1,transform:'translateY(0) scale(1)',borderRadius:'22px'}
      ],{duration:560,easing:'cubic-bezier(.2,.85,.2,1)'});
    });
    document.addEventListener('pointerdown', e => {
      if (!linksMenu.contains(e.target)) linksMenu.open = false;
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && linksMenu.open) {
        linksMenu.open = false;
        linksMenu.querySelector('summary').focus();
      }
    });
    linksMenu.addEventListener('focusout', e => {
      if (!linksMenu.contains(e.relatedTarget)) linksMenu.open = false;
    });
    linksMenu.querySelectorAll('a').forEach(link => link.addEventListener('click', () => { linksMenu.open = false; }));
  }

  const choices=[...document.querySelectorAll('.toolkit-choice')];
  const selector=document.querySelector('.toolkit-selector');
  const stage=document.querySelector('.toolkit-stage');
  const toolkit={code:['{ }','Python · R · Unix/Bash','From a question to a script.'],discover:['⌬','BMRB mining · Allostery · HSQC · Wet-lab','Looking closer. Finding connections.'],build:['↗','Web Dev · Local LLMs','Ideas you can interact with.']};
  choices.forEach((button,index)=>button.addEventListener('click',()=>{
    if(button.getAttribute('aria-pressed')==='true') return;
    choices.forEach(other=>other.setAttribute('aria-pressed',String(other===button)));
    selector.style.setProperty('--selected',index);
    const [symbol,items,note]=toolkit[button.dataset.toolkit];
    stage.querySelector('.toolkit-symbol').textContent=symbol;
    stage.querySelector('.toolkit-items').textContent=items;
    stage.querySelector('.toolkit-note').textContent=note;
    if(!motion.matches) {
      selector.querySelector('.toolkit-lens').animate([{scale:'1'},{scale:'1.16 .85'},{scale:'.97 1.06'},{scale:'1'}],{duration:550,easing:'ease-out'});
      stage.animate([{opacity:.25,transform:'translateY(8px) scale(.97)'},{opacity:1,transform:'translateY(0) scale(1)'}],{duration:420,easing:'cubic-bezier(.2,.8,.2,1)'});
    }
  }));

  // Buttons retain their scroll transform while the inner droplet pops.
  document.querySelectorAll('.pearl-button').forEach(button=>{
    let busy=false;
    const relocate=()=>{
      const current=parseFloat(button.style.top)|| (button.classList.contains('pearl-left')?60:14);
      const next=current<45?58+Math.random()*14:17+Math.random()*15;
      button.style.top=`${next}%`;
      button.style.setProperty('--bubble-size',`${25+Math.random()*10}px`);
    };
    button.addEventListener('click',()=>{
      if(busy) return;
      busy=true;
      const bubble=button.querySelector('.pearl-core');
      button.classList.add('is-popped');
      if(motion.matches) {
        setTimeout(()=>{relocate();button.classList.remove('is-popped');busy=false;},450);
        return;
      }
      setTimeout(relocate,480);
      bubble.animate([
        {transform:'scale(1)',opacity:1},
        {transform:'scale(1.35,.8)',opacity:1,offset:.15},
        {transform:'scale(1.7)',opacity:0,offset:.35},
        {transform:'scale(0)',opacity:0,offset:.65},
        {transform:'scale(1.12)',opacity:1,offset:.9},
        {transform:'scale(1)',opacity:1}
      ],{duration:1050,easing:'ease-out'});
      for(let i=0;i<6;i++) {
        const drop=document.createElement('span');drop.className='pearl-splash';
        button.appendChild(drop);
        const angle=i*Math.PI/3;
        const animation=drop.animate([{transform:'translate(-50%,-50%) scale(1)',opacity:.9},{transform:`translate(calc(-50% + ${Math.cos(angle)*35}px),calc(-50% + ${Math.sin(angle)*35}px)) scale(.2)`,opacity:0}],{duration:550,easing:'ease-out'});
        animation.onfinish=()=>drop.remove();
      }
      setTimeout(()=>{button.classList.remove('is-popped');busy=false;},1100);
    });
  });

  // Scroll-linked motion only: no perpetual animation loop.
  const sidePlay = document.querySelector('.side-play');
  if (sidePlay) {
    let scrollFrame = null;
    const renderScroll = () => {
      scrollFrame = null;
      const progress = clamp(window.scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight), 0, 1);
      sidePlay.style.setProperty('--orbit-turn', `${motion.matches ? 0 : progress * 200}deg`);
      sidePlay.style.setProperty('--pearl-travel', `${motion.matches ? 0 : progress * 180}px`);
    };
    window.addEventListener('scroll', () => {
      if (scrollFrame === null) scrollFrame = requestAnimationFrame(renderScroll);
    }, {passive:true});
    window.addEventListener('resize', renderScroll);
    motion.addEventListener('change', renderScroll);
    renderScroll();
  }
})();
