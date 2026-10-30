(()=>{
 const root=document.documentElement,button=document.getElementById('theme-toggle'),system=matchMedia('(prefers-color-scheme: dark)');
 let manual=false,dark=system.matches;
 const draw=()=>{root.dataset.theme=dark?'dark':'light';button.textContent='theme · '+root.dataset.theme;button.setAttribute('aria-pressed',String(manual));};
 button.addEventListener('click',()=>{manual=true;dark=!dark;draw();});
 system.addEventListener('change',()=>{if(!manual){dark=system.matches;draw();}});draw();
})();
