import {useState} from "react";
import {visualLabels, type VisualQuestionProps} from "./visualLabels";
import "./visualEngines.css";

export function EkspertQuestion({question,answer,onChange,disabled,locale}:VisualQuestionProps) {
  const t=visualLabels(locale), ui=question.interaction;
  let selected:Record<string,unknown>={};
  try {selected=JSON.parse(answer).axes||{};} catch { /* Unanswered */ }
  const change=(id:string,value:unknown)=>onChange(JSON.stringify({axes:{...selected,[id]:value}}));
  return <section className="visual-question">
    {!question.prompt && <p>{t.classify}</p>}
    {ui.media && <img className="ekspert-object" src={ui.media.path} alt=""/>}
    <div className="ekspert-axes">{ui.axes.map((axis:any)=><label key={axis.id}>
      <span>{axis.name}</span>
      {axis.type==="numeric" ? <input type="number" disabled={disabled} value={selected[axis.id]===undefined?"":String(selected[axis.id])} onChange={e=>change(axis.id,e.target.value===""?undefined:Number(e.target.value))}/>
      : <select disabled={disabled} value={selected[axis.id]===undefined?"":JSON.stringify(selected[axis.id])} onChange={e=>change(axis.id,e.target.value===""?undefined:JSON.parse(e.target.value))}>
        <option value="">{t.choose}</option>{axis.values.map((v:any)=><option key={JSON.stringify(v)} value={JSON.stringify(v)}>{typeof v==="boolean"?(v?t.yes:t.no):String(v)}</option>)}
      </select>}
    </label>)}</div>
  </section>;
}

export function EkspertAtlas({reference,locale}:{reference:any;locale:string}) {
  const t=visualLabels(locale);
  const [filters,setFilters]=useState<Record<string,string>>({});
  const [open,setOpen]=useState<string|null>(null);
  const items=reference.items.filter((item:any)=>Object.entries(filters).every(([key,value])=>!value||String(item.axes[key])===value));
  return <section className="ekspert-atlas">
    <div className="ekspert-axes">{reference.axes.map((axis:any)=><label key={axis.id}><span>{axis.name||axis.id}</span>
      <select value={filters[axis.id]||""} onChange={e=>setFilters({...filters,[axis.id]:e.target.value})}>
        <option value="">{t.all}</option>{Array.from(new Set(reference.items.map((item:any)=>String(item.axes[axis.id]??"")))).map(value=><option key={String(value)} value={String(value)}>{String(value)}</option>)}
      </select></label>)}</div>
    <div className="ekspert-atlas-grid">{items.map((item:any)=><article key={item.id}>
      <button type="button" className="metal-button" aria-expanded={open===item.id} onClick={()=>setOpen(open===item.id?null:item.id)}>{item.name}</button>
      {item.media && <img className="ekspert-object" src={item.media.path} alt=""/>}
      {open===item.id && <><dl>{Object.entries(item.axes).map(([key,value])=><div key={key}><dt>{reference.axes.find((a:any)=>a.id===key)?.name||key}</dt><dd>{String(value)}</dd></div>)}</dl>
        <dl>{Object.entries(item.features).map(([key,value])=><div key={key}><dt>{key}</dt><dd>{Array.isArray(value)?value.join(", "):typeof value==="object"?JSON.stringify(value):String(value)}</dd></div>)}</dl></>}
    </article>)}</div>
  </section>;
}
