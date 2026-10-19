import './anvil.css';

type Unit = {kind: 'text'; text: string; speechUrl?: string} | {kind: 'media'; media: {kind: string; path: string}};
type Option = {id: string; content: Unit};
type Segment = {text?: string; id?: string; typed?: boolean; options?: Option[]};
type Interaction = {stimulus?: Unit; question?: Unit; options?: Option[]; segments?: Segment[]; columns?: Option[][]; speechUrl?: string};
type Props = {question: {kind: string; prompt: string; interaction: any}; answer: string; onChange(value:string):void; disabled:boolean; locale:string};
const words: Record<string, {select:string; blank:string; match:string; audio:string}> = {
  zh: {select:'请选择',blank:'填空',match:'匹配',audio:'播放朗读'},
  en: {select:'Select',blank:'Blank',match:'Match',audio:'Play narration'},
  pl: {select:'Wybierz',blank:'Luka',match:'Dopasuj',audio:'Odtwórz narrację'},
  ru: {select:'Выберите',blank:'Пропуск',match:'Сопоставьте',audio:'Прослушать'},
  ar: {select:'اختر',blank:'فراغ',match:'طابق',audio:'تشغيل القراءة'},
};

export function AnvilContent({value, audioLabel='Play narration'}:{value:Unit;audioLabel?:string}) {
  if(value.kind==='text') return <span dir="auto">{value.text}{value.speechUrl && <audio controls preload="none" src={value.speechUrl} aria-label={audioLabel}/>}</span>;
  const {kind,path}=value.media;
  return kind==='image' ? <img className="anvil-media" src={path} alt=""/> : kind==='audio' ? <audio controls preload="none" src={path}/> : <video className="anvil-media" controls preload="metadata" src={path}/>;
}

function parse(value:string):Record<string,string> {
  try {const result=JSON.parse(value);return result && typeof result==='object' && !Array.isArray(result) ? result : {};} catch {return {};}
}

export function AnvilQuestion({question,answer,onChange,disabled,locale}:Props) {
  const data=question.interaction as Interaction;
  const t=words[locale.split('-')[0]]??words.en;
  const selected=parse(answer);
  const set=(key:string,value:string)=>onChange(JSON.stringify({...selected,[key]:value}));
  const choices=(options:Option[],value:string,onSelect:(v:string)=>void,label:string)=> <div className="anvil-options" role="group" aria-label={label}>{options.map((option,index)=><div className={`anvil-option ${value===option.id?'anvil-selected':''}`} key={option.id}>
    <AnvilContent value={option.content} audioLabel={t.audio}/>
    <button type="button" className="metal-button" disabled={disabled} aria-pressed={value===option.id} aria-label={`${t.select} ${index+1}${option.content.kind==='text'?`: ${option.content.text}`:''}`} onClick={()=>onSelect(option.id)}>{t.select} {index+1}</button>
  </div>)}</div>;
  return <section className="anvil-question" dir={locale.startsWith('ar')?'rtl':undefined}>
    {data.stimulus && <div className="anvil-stimulus"><AnvilContent value={data.stimulus} audioLabel={t.audio}/></div>}
    {data.question && <div className="anvil-prompt"><AnvilContent value={data.question} audioLabel={t.audio}/></div>}
    {data.speechUrl && <audio controls preload="none" src={data.speechUrl} aria-label={t.audio}/>}
    {data.options && choices(data.options,answer,onChange,t.select)}
    {data.segments && <div className="anvil-cloze">{data.segments.map((segment,index)=> segment.text!==undefined ? <span key={index} dir="auto">{segment.text}</span> : <span className="anvil-blank" key={index}>
      <label>{t.blank} {Number(segment.id)+1}{segment.typed && <input aria-label={`${t.blank} ${Number(segment.id)+1}`} type="text" autoComplete="off" disabled={disabled} value={selected[segment.id!]??''} onChange={event=>set(segment.id!,event.target.value)}/>}</label>
      {!segment.typed && choices(segment.options??[],selected[segment.id!]??'',value=>set(segment.id!,value),`${t.blank} ${Number(segment.id)+1}`)}
    </span>)}</div>}
    {data.columns && <div className="anvil-matching">{data.columns[0].map((anchor,row)=><fieldset key={anchor.id} disabled={disabled}><legend>{t.match} {row+1}</legend><AnvilContent value={anchor.content} audioLabel={t.audio}/>{data.columns!.slice(1).map((column,index)=><div key={index}>{choices(column,selected[`${anchor.id}:${index+1}`]??'',value=>set(`${anchor.id}:${index+1}`,value),`${t.match} ${row+1} / ${index+2}`)}</div>)}</fieldset>)}</div>}
  </section>;
}
