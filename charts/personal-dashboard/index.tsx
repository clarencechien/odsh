import {Children,Fragment,isValidElement,cloneElement,useMemo,useState,useRef,useEffect,type ReactNode,type ReactElement,type CSSProperties} from 'react'
import {Dashboard as NativeDashboard,Filters,Row,Section} from '@open-dashboard/core'

type Props={id:string;children:ReactNode}
type Panel={id:string;node:ReactElement<any>;title:string;group:string;span:number;height?:number}
type Choice={span:number;height?:number;hidden:boolean}
type Layout={version:1;order:string[];widgets:Record<string,Choice>}
const elements=(children:ReactNode):ReactElement<any>[]=>Children.toArray(children).flatMap(n=>isValidElement(n)?n.type===Fragment?elements((n.props as any).children):[n as ReactElement<any>]:[])
function catalog(children:ReactNode,group='',rowHeight?:number,rowSpan=12):Panel[]{
 return elements(children).flatMap(node=>{
  if(node.type===Filters)return []
  if(node.type===Section)return catalog(node.props.children,node.props.title)
  if(node.type===Row)return catalog(node.props.children,group,node.props.height,Math.max(1,Math.floor(12/elements(node.props.children).length)))
  if(typeof node.props.title!=='string')return []
  return [{id:JSON.stringify([node.props.query||'',node.props.title]),title:node.props.title,node,group,span:node.props.span??rowSpan,height:node.props.height??rowHeight}]
 })
}
function normalize(raw:unknown,panels:Panel[]):Layout|null{
 if(!raw||typeof raw!=='object'||(raw as any).version!==1)return null
 const value=raw as Layout;if(!Array.isArray(value.order)||!value.widgets||typeof value.widgets!=='object')return null
 const ids=panels.map(p=>p.id),order=[...new Set(value.order.filter(id=>ids.includes(id))),...ids.filter(id=>!value.order.includes(id))]
 const widgets:Record<string,Choice>={}
 for(const p of panels){const w=value.widgets[p.id];widgets[p.id]={span:Number.isInteger(w?.span)&&w.span>=3&&w.span<=12?w.span:p.span,height:Number.isFinite(w?.height)&&w.height!>=100&&w.height!<=700?w.height:p.height,hidden:w?.hidden===true}}
 return {version:1,order,widgets}
}
function Editor({id,children}:Props){
 const panels=useMemo(()=>catalog(children),[children]),key=`atled:layout:v1:${id}`
 const defaults=():Layout=>({version:1,order:panels.map(p=>p.id),widgets:Object.fromEntries(panels.map(p=>[p.id,{span:p.span,height:p.height,hidden:false}]))})
 const [layout,setLayout]=useState<Layout|null>(()=>{try{return normalize(JSON.parse(localStorage.getItem(key)||'null'),panels)}catch{return null}})
 const [editing,setEditing]=useState(false),[status,setStatus]=useState(''),[drag,setDrag]=useState<string|null>(null)
 const current=layout||defaults(),byId=new Map(panels.map(p=>[p.id,p]))
 function save(next:Layout|null){setLayout(next);try{if(next)localStorage.setItem(key,JSON.stringify(next));else localStorage.removeItem(key);setStatus(next?'已儲存在此瀏覽器':'已還原預設版面')}catch{setStatus('瀏覽器無法儲存；變更僅保留在本次頁面')}}
 function change(pid:string,patch:Partial<Choice>){save({...current,widgets:{...current.widgets,[pid]:{...current.widgets[pid],...patch}}})}
 function move(pid:string,target:string){if(pid===target)return;const order=current.order.filter(p=>p!==pid);order.splice(order.indexOf(target),0,pid);save({...current,order})}
 const dragging=useRef<{id:string;y:number;frame:number}|null>(null)
 useEffect(()=>()=>{if(dragging.current)cancelAnimationFrame(dragging.current.frame)},[])
 function startDrag(e:React.PointerEvent<HTMLButtonElement>,pid:string){
  if(e.button!==0)return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);setDrag(pid)
  const active={id:pid,y:e.clientY,frame:0};dragging.current=active
  const scroll=()=>{if(dragging.current!==active)return;if(active.y<85)window.scrollBy(0,-14);else if(active.y>innerHeight-85)window.scrollBy(0,14);active.frame=requestAnimationFrame(scroll)};active.frame=requestAnimationFrame(scroll)
 }
 function stopDrag(e:React.PointerEvent<HTMLButtonElement>,cancel=false){
  const active=dragging.current;if(!active)return;cancelAnimationFrame(active.frame);dragging.current=null
  const target=document.elementFromPoint(e.clientX,e.clientY)?.closest<HTMLElement>('.loop-personal-widget')?.dataset.widgetId
  if(!cancel&&target)move(active.id,target);setDrag(null)
  if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId)
 }
 function shift(pid:string,delta:number){const order=[...current.order],i=order.indexOf(pid),j=i+delta;if(j<0||j>=order.length)return;[order[i],order[j]]=[order[j],order[i]];save({...current,order})}
 const filterNodes=elements(children).filter(n=>n.type===Filters)
 return <><div className="loop-layout-toolbar">
  <div><strong>{layout?'個人版面':'客戶預設版面'}</strong><small>僅儲存在此瀏覽器 · 每個案場獨立 · 不影響週報</small></div>
  <button type="button" aria-pressed={editing} onClick={()=>{if(!layout)save(defaults());setEditing(!editing)}}>{editing?'完成編輯':'編輯版面'}</button>
  <button type="button" onClick={()=>{save(null);setEditing(false)}} disabled={!layout}>還原預設</button>
  <span className="loop-layout-status" role="status">{status}</span>
 </div>
 {editing&&<details className="loop-widget-library" open><summary>顯示／隱藏 widget</summary><p>拖曳卡片把手調整順序，或使用前移／後移按鈕。寬度與高度可分別設定。</p><div>{panels.map(p=><label key={p.id}><input type="checkbox" checked={!current.widgets[p.id].hidden} onChange={e=>change(p.id,{hidden:!e.target.checked})}/>{p.title}</label>)}</div></details>}
 <NativeDashboard>{layout?<>{filterNodes}{current.order.map(pid=>{
  const p=byId.get(pid),w=current.widgets[pid];if(!p||!w||w.hidden)return null
  return <div key={pid} className="loop-personal-widget" data-widget-id={pid} data-widget-title={p.title} data-dragging={drag===pid||undefined} style={{'--loop-span':w.span} as CSSProperties}>
   {editing&&<div className="loop-widget-controls">
    <button type="button" className="loop-drag-handle" onPointerDown={e=>startDrag(e,pid)} onPointerMove={e=>{if(dragging.current)dragging.current.y=e.clientY}} onPointerUp={e=>stopDrag(e)} onPointerCancel={e=>stopDrag(e,true)} aria-label={`拖曳 ${p.title}`}>⠿ 拖曳</button>
    <button type="button" onClick={()=>shift(pid,-1)} disabled={current.order.indexOf(pid)===0} aria-label={`前移 ${p.title}`}>↑</button>
    <button type="button" onClick={()=>shift(pid,1)} disabled={current.order.indexOf(pid)===current.order.length-1} aria-label={`後移 ${p.title}`}>↓</button>
    <label>寬度<select aria-label={`${p.title} 寬度`} value={w.span} onChange={e=>change(pid,{span:Number(e.target.value)})}>{[...new Set([3,4,6,8,12,w.span])].sort((a,b)=>a-b).map(n=><option key={n} value={n}>{n===12?'整列':`${n} / 12`}</option>)}</select></label>
    <label>高度<input type="number" aria-label={`${p.title} 高度`} min={100} max={700} step={10} value={w.height??180} onChange={e=>{const height=Number(e.target.value);if(height>=100&&height<=700)change(pid,{height})}}/></label>
    <button type="button" aria-label={`隱藏 ${p.title}`} onClick={()=>change(pid,{hidden:true})}>隱藏</button>
   </div>}
   <div className="loop-widget-content">{cloneElement(p.node,{span:12,...(w.height!==undefined?{height:w.height}:{})})}</div>
  </div>
 })}{current.order.every(pid=>current.widgets[pid]?.hidden)&&<p className="loop-layout-empty">目前沒有顯示的 widget。請開啟「編輯版面」選回需要的項目，或還原預設。</p>}</>:children}</NativeDashboard>
 </>
}
export default function PersonalDashboard(props:Props){return <Editor key={props.id} {...props}/>}
