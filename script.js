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
    if (nativeLens && !el.matches('.avatar')) {
    const filter = document.createElementNS(ns, 'filter');
    filter.id = `lens-${index}`;
    filter.setAttribute('color-interpolation-filters', 'sRGB');
    filter.setAttribute('filterUnits','userSpaceOnUse');
    filter.setAttribute('primitiveUnits','userSpaceOnUse');
    filter.setAttribute('x','0');filter.setAttribute('y','0');
    const map = document.createElementNS(ns, 'feImage');
    map.setAttribute('result', 'normal'); map.setAttribute('preserveAspectRatio', 'none');
    const displacement = document.createElementNS(ns, 'feDisplacementMap');
    displacement.setAttribute('in', 'SourceGraphic'); displacement.setAttribute('in2', 'normal');
    // Stronger lensing stays within the rim; label backing remains undistorted.
    const lensDepth=el.matches('.navbar') ? 28 : el.matches('.links-dropdown') ? 16 : 76;
    const dispersion=el.matches('.navbar, .links-dropdown') ? 2.5 : 4;
    displacement.setAttribute('scale',String(lensDepth));
    displacement.setAttribute('xChannelSelector', 'R'); displacement.setAttribute('yChannelSelector', 'G');
    filter.append(map, displacement);
    {
      // Sample the actual backdrop at slightly different wavelengths. Uniform
      // backgrounds stay neutral; color fringes follow refracted scene details.
      displacement.setAttribute('result','greenLens');
      const channel=(name,scale,values)=>{
        const bend=document.createElementNS(ns,'feDisplacementMap');
        bend.setAttribute('in','SourceGraphic');bend.setAttribute('in2','normal');
        bend.setAttribute('scale',String(scale));bend.setAttribute('xChannelSelector','R');bend.setAttribute('yChannelSelector','G');
        bend.setAttribute('result',name+'Lens');filter.appendChild(bend);
        const color=document.createElementNS(ns,'feColorMatrix');
        color.setAttribute('in',name+'Lens');color.setAttribute('type','matrix');color.setAttribute('values',values);color.setAttribute('result',name);filter.appendChild(color);
      };
      channel('red',lensDepth-dispersion,'1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0');
      const green=document.createElementNS(ns,'feColorMatrix');green.setAttribute('in','greenLens');green.setAttribute('type','matrix');green.setAttribute('values','0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0');green.setAttribute('result','green');filter.appendChild(green);
      channel('blue',lensDepth+dispersion,'0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0');
      for(const [a,b,result] of [['red','green','rg'],['rg','blue','spectrum']]) {
        const merge=document.createElementNS(ns,'feComposite');merge.setAttribute('in',a);merge.setAttribute('in2',b);merge.setAttribute('operator','arithmetic');merge.setAttribute('k2','1');merge.setAttribute('k3','1');merge.setAttribute('result',result);filter.appendChild(merge);
      }
    }
    defs.appendChild(filter);
    el.style.setProperty('--lens-filter', `url(#${filter.id})`);
    let oldSize = '';
    const updateMap = () => {
      const w = Math.round(el.offsetWidth), h = Math.round(el.offsetHeight);
      if (!w || !h || oldSize === `${w}:${h}`) return;
      oldSize = `${w}:${h}`;
      filter.setAttribute('width',String(w));filter.setAttribute('height',String(h));
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
        const px=(x+.5)/ratio, py=(y+.5)/ratio;
        // Continuous inward field: blend all four sides instead of switching
        // nearest-edge normals at an inner rectangle. Never sample beyond edges.
        const falloff=Math.min(76,w/4,h/3);
        const left=Math.exp(-px/falloff),right=Math.exp(-(w-px)/falloff);
        const top=Math.exp(-py/falloff),bottom=Math.exp(-(h-py)/falloff);
        const nx=left-right,ny=top-bottom;
        const i=(y*canvas.width+x)*4;
        pixels.data[i]=128+nx*100;
        pixels.data[i+1]=128+ny*100;
        pixels.data[i+2]=128; pixels.data[i+3]=255;
      }
      ctx.putImageData(pixels,0,0);
      map.setAttribute('href',canvas.toDataURL());
      map.setAttribute('x','0'); map.setAttribute('y','0');
      map.setAttribute('width',String(w)); map.setAttribute('height',String(h));
    };
    new ResizeObserver(updateMap).observe(el);
    updateMap();
    if (!el.matches('.navbar, .links-dropdown')) {
      new IntersectionObserver(entries => {
        el.classList.toggle('lens-visible', entries[0].isIntersecting);
      }, {rootMargin:'40px'}).observe(el);
    }
    }
    if (el.matches('.card, .intro-text, .skills-panel, #hobbies .prose')) {
      el.classList.add('pointer-surface');
      const sheen=document.createElement('span');sheen.className='pointer-sheen';sheen.setAttribute('aria-hidden','true');el.appendChild(sheen);
      if (!motion.matches) {
        const revealObserver=new IntersectionObserver(entries=>{
          if(!entries[0].isIntersecting) return;
          revealObserver.disconnect();
          el.animate([
            {opacity:0,transform:'perspective(1000px) rotateX(8deg) translateY(26px) scale(.985)'},
            {opacity:1,transform:'perspective(1000px) rotateX(0) translateY(0) scale(1)'}
          ],{duration:680,delay:Math.min(index,6)*42,easing:'cubic-bezier(.18,.78,.22,1)'});
        },{threshold:.12});
        revealObserver.observe(el);
      }
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

  const titleLens=document.querySelector('.name');
  if (titleLens) {
    let nameFrame=null;
    titleLens.addEventListener('pointermove',event=>{
      if(!finePointer.matches || motion.matches || nameFrame!==null) return;
      nameFrame=requestAnimationFrame(()=>{
        const rect=titleLens.getBoundingClientRect();
        titleLens.style.setProperty('--name-x',`${clamp((event.clientX-rect.left)/rect.width,0,1)*100}%`);
        titleLens.style.setProperty('--name-y',`${clamp((event.clientY-rect.top)/rect.height,0,1)*100}%`);
        nameFrame=null;
      });
    });
    titleLens.addEventListener('pointerleave',()=>{titleLens.style.setProperty('--name-x','35%');titleLens.style.setProperty('--name-y','26%');});
    titleLens.addEventListener('click',()=>{
      if(motion.matches) return;
      titleLens.classList.remove('is-rippling');
      void titleLens.offsetWidth;
      titleLens.classList.add('is-rippling');
      setTimeout(()=>titleLens.classList.remove('is-rippling'),360);
    });
  }


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

  if(hand) {
    let lightFrame=null;
    hand.addEventListener('pointermove',e=>{
      if(motion.matches || hand.classList.contains('is-floating') || lightFrame!==null)return;
      lightFrame=requestAnimationFrame(()=>{
        const r=hand.getBoundingClientRect();
        hand.style.setProperty('--hand-x',`${clamp((e.clientX-r.left)/r.width,0,1)*100}%`);
        hand.style.setProperty('--hand-y',`${clamp((e.clientY-r.top)/r.height,0,1)*100}%`);
        lightFrame=null;
      });
    });
    hand.addEventListener('pointerleave',()=>{
      if(lightFrame!==null)cancelAnimationFrame(lightFrame);lightFrame=null;
      hand.style.setProperty('--hand-x','30%');hand.style.setProperty('--hand-y','25%');
    });
  }

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
    const linksSummary=linksMenu.querySelector('summary');
    linksSummary.addEventListener('pointermove',event=>{
      const rect=linksSummary.getBoundingClientRect();
      linksSummary.style.setProperty('--links-x',`${event.clientX-rect.left}px`);
      linksSummary.style.setProperty('--links-y',`${event.clientY-rect.top}px`);
    });
    // Opening motion is bound to [open] in CSS, before the first paint.
    document.addEventListener('pointerdown', e => {
      if (!linksMenu.contains(e.target)) linksMenu.open = false;
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && linksMenu.open) {
        linksMenu.open = false;
        linksSummary.focus();
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
  const toolkit={code:['code','Python · R · Unix/Bash','From a question to a script.'],discover:['discover','BMRB mining · Allostery · HSQC · Wet-lab','Looking closer. Finding connections.'],build:['build','Web Dev · Local LLMs','Ideas you can interact with.']};
  const particleCanvas=stage?.querySelector('.toolkit-particles');
  let setParticleShape=()=>{};
  if(particleCanvas) {
    const ctx=particleCanvas.getContext('2d');
    const particles=Array.from({length:92},()=>({x:0,y:0,vx:0,vy:0,tx:0,ty:0,size:1+Math.random()*1.55,phase:Math.random()*Math.PI*2}));
    let width=0,height=0,dpr=1,frame=0,visible=true,mouse=null,shape='code',last=performance.now();
    const glyph={code:'{ }',discover:'⌬',build:'↗'};
    const makeTargets=()=>{
      if(!ctx||!width||!height)return;
      const map=document.createElement('canvas');map.width=width*2;map.height=height*2;
      const pen=map.getContext('2d');pen.scale(2,2);pen.fillStyle='#000';pen.textAlign='center';pen.textBaseline='middle';pen.font=`500 ${shape==='code'?50:58}px ui-rounded, system-ui, sans-serif`;
      pen.fillText(glyph[shape],width/2,height/2+1);
      const data=pen.getImageData(0,0,map.width,map.height).data,spots=[];
      for(let y=2;y<map.height-2;y+=3)for(let x=2;x<map.width-2;x+=3)if(data[(y*map.width+x)*4+3]>140)spots.push([x/2,y/2]);
      for(let i=spots.length-1;i>0;i--){const j=(Math.random()*(i+1))|0;[spots[i],spots[j]]=[spots[j],spots[i]];}
      particles.forEach((p,i)=>{const spot=spots[i%spots.length]||[width/2,height/2];p.tx=spot[0];p.ty=spot[1];if(!p.x&&!p.y){p.x=width/2+(Math.random()-.5)*18;p.y=height/2+(Math.random()-.5)*18;}});
    };
    const resize=()=>{
      const rect=particleCanvas.getBoundingClientRect();dpr=Math.min(devicePixelRatio||1,2);width=Math.max(1,Math.round(rect.width));height=Math.max(1,Math.round(rect.height));
      particleCanvas.width=Math.round(width*dpr);particleCanvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);makeTargets();
    };
    const draw=now=>{
      if(!visible)return;
      const dt=Math.min(32,now-last)/16.67;last=now;ctx.clearRect(0,0,width,height);
      for(const p of particles){
        const dx=p.tx-p.x,dy=p.ty-p.y; p.vx+=(dx*.038)*dt;p.vy+=(dy*.038)*dt;
        if(mouse){const mx=p.x-mouse.x,my=p.y-mouse.y,dist=Math.hypot(mx,my)||1;if(dist<64){const force=(1-dist/64)*3.2;p.vx+=mx/dist*force*dt;p.vy+=my/dist*force*dt;}}
        p.vx*=.8;p.vy*=.8;p.x+=p.vx*dt;p.y+=p.vy*dt;
        const glow=.42+Math.sin(now*.003+p.phase)*.18;ctx.beginPath();ctx.fillStyle=`rgba(64,116,174,${glow})`;ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill();
      }
      frame=requestAnimationFrame(draw);
    };
    setParticleShape=next=>{shape=next;makeTargets();};
    new ResizeObserver(resize).observe(particleCanvas);resize();
    particleCanvas.addEventListener('pointermove',event=>{const rect=particleCanvas.getBoundingClientRect();mouse={x:event.clientX-rect.left,y:event.clientY-rect.top};});
    particleCanvas.addEventListener('pointerleave',()=>{mouse=null;});
    new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible&&!frame){last=performance.now();frame=requestAnimationFrame(draw);}if(!visible&&frame){cancelAnimationFrame(frame);frame=0;}}).observe(particleCanvas);
    frame=requestAnimationFrame(draw);
  }
  choices.forEach((button,index)=>button.addEventListener('click',()=>{
    if(button.getAttribute('aria-pressed')==='true') return;
    choices.forEach(other=>other.setAttribute('aria-pressed',String(other===button)));
    selector.style.setProperty('--selected',index);
    const [particleShape,items,note]=toolkit[button.dataset.toolkit];
    setParticleShape(particleShape);
    stage.querySelector('.toolkit-items').textContent=items;
    stage.querySelector('.toolkit-note').textContent=note;
    if(!motion.matches) {
      const lens=selector.querySelector('.toolkit-lens');
      lens.getAnimations().forEach(animation=>animation.cancel());
      lens.animate([
        {scale:'1'},
        {scale:'1.026 .974',offset:.32},
        {scale:'.992 1.014',offset:.64},
        {scale:'1'}
      ],{duration:440,easing:'cubic-bezier(.22,.82,.24,1)'});
      stage.animate([{opacity:.25,transform:'translateY(8px) scale(.97)'},{opacity:1,transform:'translateY(0) scale(1)'}],{duration:420,easing:'cubic-bezier(.2,.8,.2,1)'});
    }
  }));

  if(selector) {
    let scrubPointer=null;
    const selectAt=x=>{
      const r=selector.getBoundingClientRect();
      const index=clamp(Math.floor((x-r.left)/r.width*choices.length),0,choices.length-1);
      choices[index]?.click();
    };
    selector.addEventListener('pointerdown',e=>{
      if(!e.isPrimary || e.button!==0) return;
      scrubPointer=e.pointerId;selector.setPointerCapture(e.pointerId);
      selector.classList.add('is-scrubbing'); selectAt(e.clientX);
    });
    selector.addEventListener('pointermove',e=>{if(e.pointerId===scrubPointer)selectAt(e.clientX);});
    const finishScrub=()=>{scrubPointer=null;selector.classList.remove('is-scrubbing');};
    selector.addEventListener('pointerup',finishScrub);
    selector.addEventListener('pointercancel',finishScrub);
    selector.addEventListener('lostpointercapture',finishScrub);
    selector.addEventListener('keydown',e=>{
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
      e.preventDefault();
      const current=choices.findIndex(b=>b.getAttribute('aria-pressed')==='true');
      const next=e.key==='Home'?0:e.key==='End'?choices.length-1:(current+(e.key==='ArrowRight'?1:-1)+choices.length)%choices.length;
      choices[next].click();choices[next].focus();
    });
  }

  // Buttons retain their scroll transform while the inner droplet pops.
  document.querySelectorAll('.pearl-button').forEach(button=>{
    let busy=false;
    const relocate=()=>{
      const current=parseFloat(button.style.top)|| (button.classList.contains('pearl-left')?60:14);
      const direction=current>70?-1:current<22?1:(Math.random()<.5?-1:1);
      const next=clamp(current+direction*(4+Math.random()*4),18,78);
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

  // Home is still a normal anchor with JavaScript disabled or modifier-clicked.
  const homeLink=document.querySelector('.nav-home');
  const hero=document.getElementById('hero');
  const portrait=document.querySelector('.avatar');
  const name=document.querySelector('.name');
  if(homeLink && hero && portrait && name) {
    hero.setAttribute('tabindex','-1');
    let run=0, frame=null, layer=null, activeAnimations=[];
    const originalName=name.textContent;
    name.setAttribute('aria-label',originalName);
    name.textContent='';
    for(const character of originalName) {
      const letter=document.createElement('span');letter.className='home-letter';
      letter.setAttribute('aria-hidden','true');letter.textContent=character===' '?'\u00a0':character;
      name.appendChild(letter);
    }
    const clean=()=>{
      run++;
      if(frame!==null)cancelAnimationFrame(frame);
      frame=null;layer?.remove();layer=null;
      activeAnimations.forEach(animation=>animation.cancel());activeAnimations=[];
      homeLink.classList.remove('home-launching');
    };
    const animate=(el,keys,options)=>{
      const animation=el.animate(keys,options);activeAnimations.push(animation);return animation;
    };
    homeLink.addEventListener('click',event=>{
      if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||event.button>0)return;
      event.preventDefault();clean();
      const thisRun=run, keyboard=event.detail===0;
      const origin=homeLink.getBoundingClientRect();
      hero.scrollIntoView({behavior:motion.matches?'instant':'smooth',block:'start'});
      try {const url=new URL(location.href);url.hash='hero';history.replaceState(history.state,'',url);} catch {}
      if(motion.matches) {if(keyboard)hero.focus({preventScroll:true});return;}
      homeLink.classList.add('home-launching');
      animate(homeLink,[{transform:'scale(1)'},{transform:'scale(.79,1.13)',offset:.25},{transform:'scale(1.12,.91)',offset:.6},{transform:'scale(1)'}],{duration:480,easing:'ease-out'});
      layer=document.createElement('div');layer.className='home-magic';layer.setAttribute('aria-hidden','true');document.body.appendChild(layer);
      const comet=document.createElement('span');comet.className='home-comet';layer.appendChild(comet);
      const trail=Array.from({length:12},(_,i)=>{const dot=document.createElement('i');dot.className='home-trail';dot.style.setProperty('--trail-size',`${7-i*.4}px`);layer.appendChild(dot);return dot;});
      const start=performance.now(), x0=origin.left+origin.width/2,y0=origin.top+origin.height/2;
      const historyPoints=[];
      const arrival=()=>{
        homeLink.classList.remove('home-launching');comet.remove();trail.forEach(dot=>dot.remove());
        const target=portrait.getBoundingClientRect();const cx=target.left+target.width/2,cy=target.top+target.height/2;
        const ring=document.createElement('span');ring.className='home-orbit-ring';ring.style.left=`${cx}px`;ring.style.top=`${cy}px`;layer.appendChild(ring);
        const ringAnimation=animate(ring,[{transform:'translate(-50%,-50%) scale(.35)',opacity:0},{opacity:.8,offset:.18},{transform:'translate(-50%,-50%) scale(2.8)',opacity:0}],{duration:1000,easing:'ease-out',fill:'forwards'});
        ringAnimation.onfinish=()=>ring.remove();
        for(let i=0;i<18;i++) {
          const spark=document.createElement('span');spark.className='home-spark';spark.style.left=`${cx}px`;spark.style.top=`${cy}px`;spark.style.setProperty('--spark-hue',`${170+i*7}`);layer.appendChild(spark);
          const angle=i*Math.PI*2/18, radius=90+(i%3)*24;
          animate(spark,[{transform:'translate(-50%,-50%) scale(0)',opacity:0},{opacity:.9,offset:.15},{transform:`translate(calc(-50% + ${Math.cos(angle)*radius}px),calc(-50% + ${Math.sin(angle)*radius}px)) scale(.2)`,opacity:0}],{duration:850+i%3*80,easing:'cubic-bezier(.1,.6,.3,1)',fill:'forwards'});
        }
        animate(portrait,[{transform:'rotate(3deg) scale(1)'},{transform:'rotate(-6deg) scale(.94)',offset:.2},{transform:'rotate(6deg) scale(1.045)',offset:.5},{transform:'rotate(3deg) scale(1)'}],{duration:850,easing:'cubic-bezier(.2,.8,.2,1)'});
        name.querySelectorAll('.home-letter').forEach((letter,i)=>animate(letter,[{transform:'translateY(0)'},{transform:'translateY(-13px) rotate(-5deg)',offset:.4},{transform:'translateY(0)'}],{duration:540,delay:i*45,easing:'cubic-bezier(.2,.8,.2,1)'}));
        if(keyboard)hero.focus({preventScroll:true});
        setTimeout(()=>{if(run===thisRun)clean();},1400);
      };
      const fly=now=>{
        if(run!==thisRun)return;
        const t=Math.min(1,(now-start)/1050), eased=1-Math.pow(1-t,3);
        const target=portrait.getBoundingClientRect();
        const tx=target.left+target.width/2,ty=target.top+target.height/2;
        const x=x0+(tx-x0)*eased;
        const y=y0+(ty-y0)*eased-Math.sin(t*Math.PI)*Math.min(95,innerHeight*.12);
        comet.style.transform=`translate3d(${x}px,${y}px,0) scale(${1+Math.sin(t*Math.PI)*.5})`;
        historyPoints.unshift({x,y});if(historyPoints.length>48)historyPoints.pop();
        trail.forEach((dot,i)=>{const point=historyPoints[Math.min(i*3,historyPoints.length-1)];dot.style.transform=`translate3d(${point.x}px,${point.y}px,0)`;dot.style.opacity=String((1-i/12)*.5);});
        if(t<1)frame=requestAnimationFrame(fly);else {frame=null;arrival();}
      };
      frame=requestAnimationFrame(fly);
    });
    window.addEventListener('wheel',clean,{passive:true});
    window.addEventListener('touchstart',clean,{passive:true});
    window.addEventListener('keydown',e=>{if(e.key==='Escape')clean();});
    document.addEventListener('visibilitychange',()=>{if(document.hidden)clean();});
  motion.addEventListener('change',clean);
  }

  const cvButton=document.querySelector('.nav-cv');
  const cvDialog=document.getElementById('cvDialog');
  const cvClose=cvDialog?.querySelector('.cv-close');
  if(cvButton && cvDialog && cvClose) {
    cvButton.addEventListener('click',()=>cvDialog.showModal());
    cvClose.addEventListener('click',()=>cvDialog.close());
    cvDialog.addEventListener('click',event=>{ if(event.target===cvDialog)cvDialog.close(); });
  }

})();
