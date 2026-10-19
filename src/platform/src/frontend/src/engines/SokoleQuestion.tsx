import {useState} from "react";
import {visualLabels,type VisualQuestionProps} from "./visualLabels";
import "./visualEngines.css";

export function SokoleQuestion({question,onChange,disabled,locale,onCommit,feedback}:VisualQuestionProps) {
  const t=visualLabels(locale), ui=question.interaction;
  const [cursor,setCursor]=useState({x:.5,y:.5});
  const [keyboard,setKeyboard]=useState(false);
  const choose=(point:{x:number;y:number})=>{
    if(disabled)return;
    setCursor(point);
    const encoded=JSON.stringify(point);onChange(encoded);onCommit?.(encoded);
  };
  return <section className="visual-question sokole-question">
    <p aria-live="polite">{t.target}: {feedback?.foundCount||0} / {ui.targetCount}</p>
    <div className={`sokole-canvas${feedback?.imageError?" sokole-error":""}`} style={{aspectRatio:`${ui.width}/${ui.height}`}}
      role="button" aria-label={`${question.prompt}. ${t.keyboard}`} aria-disabled={disabled} tabIndex={0}
      onClick={e=>{const rect=e.currentTarget.getBoundingClientRect();setKeyboard(false);choose({x:Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width)),y:Math.max(0,Math.min(1,(e.clientY-rect.top)/rect.height))});}}
      onKeyDown={e=>{
        if(disabled)return;
        const step=e.shiftKey?.05:.005;
        if(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(e.key)){
          e.preventDefault();setKeyboard(true);
          setCursor(p=>({x:Math.max(0,Math.min(1,p.x+(e.key==="ArrowLeft"?-step:e.key==="ArrowRight"?step:0))),y:Math.max(0,Math.min(1,p.y+(e.key==="ArrowUp"?-step:e.key==="ArrowDown"?step:0)))}));
        }else if(e.key==="Enter"||e.key===" "){e.preventDefault();setKeyboard(true);choose(cursor);}
      }}>
      <img className="sokole-source" src={ui.media.path} alt="" draggable={false}/>
      {(feedback?.overlays||[]).map((overlay:any)=><img key={overlay.id} className="sokole-overlay" src={overlay.path} alt="" draggable={false}/>)}
      {(feedback?.points||[]).map((p:any,index:number)=><span key={index} className={`sokole-point ${p.hit?"hit":"miss"}`} style={{left:`${p.x*100}%`,top:`${p.y*100}%`}} aria-hidden="true"/>)}
      {keyboard&&!disabled&&<span className="sokole-cursor" style={{left:`${cursor.x*100}%`,top:`${cursor.y*100}%`}} aria-hidden="true">+</span>}
    </div>
    <small>{t.keyboard}</small>
  </section>;
}
