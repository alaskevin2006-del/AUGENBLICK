import {useRef,useState} from 'react';
import {ZnawcaActivity,type ZnawcaActivityProps} from '@znawca/adapter/ZnawcaActivity';
import type {RuntimeSnapshot} from '@znawca/adapter/runtime';
import {AnvilQuestion} from './AnvilQuestion';
import {EkspertQuestion} from './EkspertQuestion';
import {SokoleQuestion} from './SokoleQuestion';
import {CompanionQuestion} from './CompanionQuestion';
import {engineText} from './labels';
import './engines.css';

function Question(props:any){const kind=String(props.question.kind);if(kind.startsWith('anvil-'))return <AnvilQuestion {...props}/>;if(kind.startsWith('ekspert-'))return <EkspertQuestion {...props}/>;if(kind.startsWith('sokole-'))return <SokoleQuestion {...props}/>;if(kind==='companion-row')return <CompanionQuestion {...props}/>;return <p role="alert">{engineText(props.locale,'error')}</p>;}

function Feedback({feedback,locale,companion=false}:{feedback:any;locale:string;companion?:boolean}){
 if(companion)return <p>{engineText(locale,'completion')}</p>;
 return <section className="engine-feedback" aria-live="polite"><strong>{engineText(locale,feedback.fullyCorrect?'correct':'incorrect')} · {Math.round(feedback.score*100)}%</strong>
 {feedback.dimensions?.length>0&&<ul>{feedback.dimensions.map((d:any)=><li key={d.id}>{d.label??d.id}: {Math.round(d.score*100)}%</li>)}</ul>}
 {feedback.correctAnswers?.length>0&&<p>{engineText(locale,'expected')}: {feedback.correctAnswers.join(' · ')}</p>}</section>;
}

export function EngineReplay({entry,locale}:{entry:any;locale:string}){return <div className="engine-replay"><h3 dir="auto">{entry.question.prompt}</h3><Question question={entry.question} answer={entry.answer} onChange={()=>{}} disabled locale={locale} feedback={entry.feedback}/><p>{engineText(locale,'answer')}: {(entry.feedback.submittedLabels??[entry.answer]).join(' · ')}</p><Feedback feedback={entry.feedback} locale={locale} companion={entry.question.kind==='companion-row'}/></div>;}

export function EngineActivity(props:ZnawcaActivityProps){return !props.initialSnapshot.engine||props.initialSnapshot.engine==='znawca'?<ZnawcaActivity {...props}/>:<RegisteredActivity {...props}/>;}

function RegisteredActivity(props:ZnawcaActivityProps){
 const [snapshot,setSnapshot]=useState(props.initialSnapshot),[answer,setAnswer]=useState(''),[pending,setPending]=useState(false),[failed,setFailed]=useState(false);
 const [rejected,setRejected]=useState(false),[revision,setRevision]=useState(0);
 const busy=useRef(false),command=useRef<null|(()=>Promise<RuntimeSnapshot>)>(null);
 const t=(key:Parameters<typeof engineText>[1])=>engineText(props.interfaceLang,key);
 const run=async(operation:()=>Promise<RuntimeSnapshot>)=>{if(busy.current)return;busy.current=true;command.current=operation;setPending(true);setFailed(false);setRejected(false);try{const updated=await operation();setSnapshot(updated);if(!updated.feedback)setAnswer('');command.current=null;}catch(error){if((error as {status?:number})?.status===400||(error as {status?:number})?.status===422){command.current=null;setAnswer('');setRejected(true);setRevision(v=>v+1);}else setFailed(true);}finally{busy.current=false;setPending(false);}};
 const submit=(value=answer)=>{if(!snapshot.question||snapshot.feedback||command.current)return;const request={questionId:snapshot.question.id,answer:value,submissionId:crypto.randomUUID()};void run(()=>props.api.answer(snapshot.sessionId,request));};
 const advance=(action:'next'|'finish'|'skip')=>{if(command.current)return;void run(()=>props.api.advance(snapshot.sessionId,action,snapshot.question?.id,snapshot.feedback?.submissionId));};
 if(snapshot.status==='finished'||snapshot.status==='skipped')return <section className="engine-activity"><h1>{snapshot.status==='finished'?t('complete'):props.labels.skipped}</h1>{snapshot.engine!=='companion'&&snapshot.totalScore!==null&&<p>{Math.round(snapshot.totalScore*100)}%</p>}<button className="gold-button" onClick={props.onExit}>{t('back')}</button></section>;
 const q=snapshot.question;const companion=snapshot.engine==='companion';
 return <section className="engine-activity" dir={props.interfaceLang==='ar'?'rtl':'ltr'}>
 <p>{snapshot.progress.completed} / {snapshot.progress.total}</p>
 {pending&&<p role="status">{props.labels.pending}</p>}
 {rejected&&<p role="alert">{props.labels.error}</p>}
 {failed&&<div role="alert"><p>{props.labels.error}</p><button className="gold-button" disabled={pending} onClick={()=>command.current&&void run(command.current)}>{props.labels.retry}</button></div>}
 {q&&<>{!companion&&<h2 dir="auto">{q.prompt}</h2>}<Question key={`${q.id}:${revision}`} question={q} answer={answer} onChange={setAnswer} onCommit={submit} disabled={pending||failed||!!snapshot.feedback} locale={props.interfaceLang} feedback={snapshot.feedback??snapshot.interactionFeedback} onPractice={companion&&props.api.practice?(value:string)=>props.api.practice!(snapshot.sessionId,q.id,value):undefined}/>
 {snapshot.feedback?<><Feedback feedback={snapshot.feedback} locale={props.interfaceLang} companion={companion}/><button className="gold-button" disabled={pending||failed} onClick={()=>advance(snapshot.canFinish?'finish':'next')}>{snapshot.canFinish?props.labels.finish:t('next')}</button></>:
 !['sokole-oko','companion'].includes(snapshot.engine??'')&&<button className="gold-button" disabled={pending||failed||!answer} onClick={()=>submit()}>{t('submit')}</button>}</>}
 {!q&&snapshot.canFinish&&<button className="gold-button" disabled={pending||failed} onClick={()=>advance('finish')}>{props.labels.finish}</button>}
 {snapshot.canSkip&&<button className="metal-button" disabled={pending||failed} onClick={()=>advance('skip')}>{props.labels.skip}</button>}
 </section>;
}
