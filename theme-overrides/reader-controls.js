// Reader appearance only; layout editing lives in the React dashboard component.
(()=>{
 const select=document.getElementById('loop-theme');if(!select)return;
 const root=document.documentElement;
 const sync=()=>{select.value=['light','dark'].includes(root.dataset.theme)?root.dataset.theme:'system'};
 try{const value=localStorage.getItem('odd:theme');if(['light','dark'].includes(value))root.dataset.theme=value}catch{}
 sync();
 select.addEventListener('change',()=>{
  const value=select.value;
  if(value==='system')delete root.dataset.theme;else root.dataset.theme=value;
  try{if(value==='system')localStorage.removeItem('odd:theme');else localStorage.setItem('odd:theme',value)}catch{}
 });
 new MutationObserver(sync).observe(root,{attributes:true,attributeFilter:['data-theme']});
 window.addEventListener('storage',event=>{if(event.key==='odd:theme'){if(['light','dark'].includes(event.newValue))root.dataset.theme=event.newValue;else delete root.dataset.theme}});
})();
