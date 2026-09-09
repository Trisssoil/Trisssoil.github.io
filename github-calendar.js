(() => {
  'use strict';
  const graph=document.getElementById('githubDays');
  if(!graph) return;
  const status=document.getElementById('githubStatus');
  const total=document.getElementById('githubTotal');
  const refresh=document.getElementById('githubRefresh');
  const months=document.getElementById('githubMonths');
  const scroll=document.getElementById('githubScroll');
  const detail=document.getElementById('githubDayDetail');
  const endpoints=[
    'https://gh-calendar.rschristian.dev/user/Trisssoil',
    'https://github-contributions-api.jogruber.de/v4/Trisssoil?y=last'
  ];
  const hour=60*60*1000;
  let busy=false,lastChecked=0,hasData=false,buttons=[];
  const dateLabel=new Intl.DateTimeFormat('en',{month:'long',day:'numeric',year:'numeric',timeZone:'UTC'});
  const monthLabel=new Intl.DateTimeFormat('en',{month:'short',timeZone:'UTC'});

  function normalize(payload) {
    if(!Array.isArray(payload.contributions))throw new Error('Invalid calendar');
    const source=Array.isArray(payload.contributions[0])?payload.contributions.flat():payload.contributions;
    if(source.length<1||source.length>371)throw new Error('Invalid calendar');
    const rows=source.map(row=>{
      const level=Number(row.level??row.intensity);
      if(!/^\d{4}-\d{2}-\d{2}$/.test(row.date)||!Number.isSafeInteger(row.count)||row.count<0||!Number.isInteger(level)||level<0||level>4)throw new Error('Invalid day');
      const time=Date.parse(row.date+'T00:00:00Z');
      if(!Number.isFinite(time)||new Date(time).toISOString().slice(0,10)!==row.date)throw new Error('Invalid date');
      return {...row,level,time};
    }).sort((a,b)=>a.time-b.time);
    for(let i=1;i<rows.length;i++)if(rows[i].time-rows[i-1].time!==86400000)throw new Error('Incomplete calendar');
    return rows;
  }

  function render(rows) {
    const offset=new Date(rows[0].time).getUTCDay();
    const columns=Math.ceil((offset+rows.length)/7);
    const fragment=document.createDocumentFragment(),labels=document.createDocumentFragment();
    let lastMonth=-1,lastLabelColumn=-10;
    buttons=[];
    rows.forEach((day,i)=>{
      const date=new Date(day.time),column=Math.floor((offset+i)/7)+1;
      if(date.getUTCMonth()!==lastMonth) {
        if(column-lastLabelColumn>=3 && column<=columns-2) {
          const label=document.createElement('span');label.textContent=monthLabel.format(date);label.style.gridColumn=String(column);labels.appendChild(label);lastLabelColumn=column;
        }
        lastMonth=date.getUTCMonth();
      }
      const cell=document.createElement('button');cell.type='button';cell.className='github-day';cell.dataset.level=String(day.level);
      cell.style.gridColumn=String(column);cell.style.gridRow=String((offset+i)%7+1);
      cell.tabIndex=i===rows.length-1?0:-1;
      const text=`${day.count} contribution${day.count===1?'':'s'} on ${dateLabel.format(date)}`;
      cell.title=text;cell.setAttribute('aria-label',text);
      const show=()=>{detail.textContent=text;};
      cell.addEventListener('pointerenter',show);cell.addEventListener('focus',()=>{buttons.forEach(b=>b.tabIndex=b===cell?0:-1);show();});cell.addEventListener('click',show);
      fragment.appendChild(cell);buttons.push(cell);
    });
    graph.style.setProperty('--weeks',columns);months.style.setProperty('--weeks',columns);
    graph.replaceChildren(fragment);months.replaceChildren(labels);
    const count=rows.reduce((sum,day)=>sum+day.count,0);
    total.textContent=`${count.toLocaleString()} contributions in the last year`;
    graph.setAttribute('aria-label',`${count} GitHub contributions over ${rows.length} days. Use arrow keys to explore dates.`);
    scroll.hidden=false;
    if(!hasData)scroll.scrollLeft=scroll.scrollWidth;
    hasData=true;
  }

  graph.addEventListener('keydown',event=>{
    const index=buttons.indexOf(document.activeElement);
    if(index<0)return;
    const steps={ArrowLeft:-7,ArrowRight:7,ArrowUp:-1,ArrowDown:1};
    let next;
    if(event.key in steps)next=Math.max(0,Math.min(buttons.length-1,index+steps[event.key]));
    else if(event.key==='Home')next=0;
    else if(event.key==='End')next=buttons.length-1;
    else return;
    event.preventDefault();buttons[next].focus({preventScroll:true});buttons[next].scrollIntoView({block:'nearest',inline:'nearest'});
  });

  async function load() {
    if(busy)return;
    busy=true;refresh.disabled=true;graph.setAttribute('aria-busy','true');
    status.textContent=hasData?'Checking for updates…':'Connecting to GitHub…';
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
    try {
      let rows=null;
      for(const endpoint of endpoints) {
        try {
          const response=await fetch(endpoint,{signal:controller.signal,credentials:'omit'});
          if(!response.ok)continue;
          rows=normalize(await response.json());
          break;
        } catch(error) {
          if(error.name==='AbortError')throw error;
        }
      }
      if(!rows)throw new Error('Feed unavailable');
      // Keep keyboard focus intact during background updates.
      const focusedDate=graph.contains(document.activeElement)?document.activeElement.title:null;
      render(rows);
      if(focusedDate)buttons.find(b=>b.title===focusedDate)?.focus({preventScroll:true});
      lastChecked=Date.now();
      status.textContent=`Checked ${new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})} · synced to GitHub’s visible profile total`;
    } catch {
      status.textContent=hasData?'Could not refresh. Showing the last loaded activity.':'Activity is temporarily unavailable. Try Refresh or visit my GitHub profile.';
      if(!hasData)total.textContent='A year of building, one day at a time.';
    } finally {
      clearTimeout(timeout);busy=false;refresh.disabled=false;graph.setAttribute('aria-busy','false');
    }
  }
  refresh.addEventListener('click',load);
  setInterval(()=>{if(!document.hidden)load();},hour);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&Date.now()-lastChecked>=hour)load();});
  load();
})();
