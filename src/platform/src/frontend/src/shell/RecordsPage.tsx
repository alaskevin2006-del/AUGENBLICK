import {useEffect, useState, useRef} from "react";
import {getBackend} from "../orchestrator/api";
import {getToken} from "../orchestrator/auth";
import type {HistoryEntry, DifficultyGroup} from "../orchestrator/types";
import type {RuntimeSnapshot} from "@znawca/adapter/runtime";
import {AnswerValues, QuestionMedia} from "@znawca/ui/Session";
import {InterfaceLangContext} from "@znawca/ui";
import {useLocale, useT} from "../i18n";

export function RecordsPage({kind, courseId, isDeveloper, onPractice, onBack}: {kind:"history"|"difficulties";courseId?:string;isDeveloper:boolean;onPractice:(id:string)=>void;onBack:()=>void}) {
 const t=useT(), locale=useLocale();
 const mounted=useRef(true);useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const [history,setHistory]=useState<readonly HistoryEntry[]>([]), [groups,setGroups]=useState<readonly DifficultyGroup[]>([]);
 const [detail,setDetail]=useState<RuntimeSnapshot|null>(null), [selected,setSelected]=useState<HistoryEntry|null>(null);
 const [page,setPage]=useState(1), [next,setNext]=useState<number|null>(null), [loading,setLoading]=useState(true), [failed,setFailed]=useState(false), [retry,setRetry]=useState(0);
 useEffect(()=>{let live=true;const token=getToken();setLoading(true);setFailed(false);
 void getBackend().then(async b=> {
  if(selected) {const data=await b.historyDetail(selected.sessionId);if(live && token===getToken())setDetail(data);}
  else if(kind==='history'){const data=await b.history(courseId,page);if(live && token===getToken()){setHistory(old=>page===1?data.results:[...old.filter(x=>!data.results.some(y=>x.sessionId===y.sessionId)),...data.results]);setNext(data.nextPage);}}
  else {const data=await b.difficulties(courseId);if(live && token===getToken())setGroups(data);}
 }).catch(()=>{if(live && token===getToken())setFailed(true);}).finally(()=>{if(live && token===getToken())setLoading(false);});return()=>{live=false;};
 },[kind,courseId,page,selected,retry]);
 const date=(value:string)=>new Date(value).toLocaleString(locale);
 const info=(entry:HistoryEntry)=><p>{date(entry.createdAt)} · {t(entry.mode==='L'?'courses.learn':'courses.test')} · {t(`history.${entry.status}`)} · {t('history.progress',entry.progress)}{entry.totalScore!==null && <> · {t('history.score',{score:Math.round(entry.totalScore*100)})}</>}</p>;
 const rejoin=async(id:string)=>{const token=getToken();const current=()=>mounted.current&&token===getToken();setLoading(true);setFailed(false);try{const b=await getBackend();if(!current())return;await b.enrollCourse(id);if(current())onPractice(id);}catch{if(current())setFailed(true);}finally{if(current())setLoading(false);}};
 return <div className="workspace"><section className="content records-page"><button className="metal-button" onClick={()=>selected?(setSelected(null),setDetail(null)):onBack()}>{t('setup.back')}</button><h1>{t(kind==='history'?'nav.history':'nav.difficulties')}</h1>
 {loading && <p role="status">{t('page.loading')}</p>}{failed && <div role="alert"><p>{t('records.error')}</p><button className="metal-button" onClick={()=>setRetry(v=>v+1)}>{t('error.retry')}</button></div>}
 {selected ? <><h2 dir="auto">{selected.title}</h2>{info(selected)}{detail && <InterfaceLangContext.Provider value={locale}><div className="answer-review">{detail.review.map((entry,index)=>{const q=entry.question;const option=q.options?.find(o=>o.value===entry.answer);const answer=option?.media?.path??option?.label??entry.answer;const mediaKind=q.direction==='name-to-image'?'image':q.direction==='name-to-audio'?'audio':q.direction==='name-to-video'?'video':undefined;return <article key={index}><strong dir="auto">{q.prompt}</strong>{q.media&&<QuestionMedia media={q.media}/>}<span>{t('history.submitted')}: {answer?<AnswerValues values={[answer]} mediaKind={mediaKind} options={q.options} plain/>:t('history.noAnswer')}</span><span>{t('history.correct')}: <AnswerValues values={entry.feedback.correctAnswers} mediaKind={mediaKind} options={q.options} plain/></span></article>;})}</div></InterfaceLangContext.Provider>}</> : kind==='history' ? <>
 {history.map(entry=><article className="record-card" key={entry.sessionId}><h2 dir="auto">{entry.title}</h2>{info(entry)}<button className="metal-button" disabled={loading} onClick={()=>{setDetail(null);setSelected(entry);}}>{t('history.details')}</button></article>)}
 {!loading&&!failed&&!history.length&&<p>{t('history.empty')}</p>}{next && <button className="metal-button" disabled={loading} onClick={()=>setPage(next)}>{t('history.more')}</button>}
 </> : <><p>{t('difficulties.rule')}</p>{groups.map(group=><article className="record-card" key={group.course.courseVersionId}><h2 dir="auto">{group.course.title}</h2><ul>{group.items.map(item=><li key={item.objectId} dir="auto">{item.name}</li>)}</ul>{(isDeveloper||group.course.status==='published') ? <button className="metal-button" disabled={loading} onClick={()=>isDeveloper||group.course.isEnrolled?onPractice(group.course.courseVersionId):void rejoin(group.course.courseVersionId)}>{t(isDeveloper||group.course.isEnrolled?'difficulties.practice':'difficulties.rejoin')}</button>:<p>{t('difficulties.unpublished')}</p>}</article>)}{!loading&&!failed&&!groups.length&&<p>{t('difficulties.empty')}</p>}</>}
 </section></div>;
}
