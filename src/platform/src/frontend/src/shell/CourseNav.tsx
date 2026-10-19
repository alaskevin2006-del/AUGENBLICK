import {useEffect,useState,type ReactNode} from "react";
import {getBackend} from "../orchestrator/api";
import {getToken} from "../orchestrator/auth";
import type {CourseRecords} from "../orchestrator/types";
import {courseTabs,type CourseTab} from "../orchestrator/routes";
import {useT,type ShellKey} from "../i18n";
const labels:Record<CourseTab,ShellKey>={learn:"courses.learn",test:"courses.test","learning-history":"nav.learningHistory","test-history":"nav.testHistory",difficulties:"nav.difficulties"};
export function CourseNav({id,tab,onTab,onBack,children}:{id:string;tab:CourseTab;onTab:(tab:CourseTab)=>void;onBack:()=>void;children:(records:CourseRecords)=>ReactNode}){
 const t=useT();const [data,setData]=useState<CourseRecords|null>(null),[failed,setFailed]=useState(false),[retry,setRetry]=useState(0);
 useEffect(()=>{let live=true;const token=getToken();setData(null);setFailed(false);void getBackend().then(b=>b.courseRecords(id)).then(value=>{if(value.course.courseVersionId!==id)throw new Error("Course mismatch");if(live&&token===getToken())setData(value);}).catch(()=>{if(live&&token===getToken())setFailed(true);});return()=>{live=false;};},[id,tab,retry]);
 return <div className="course-workspace"><nav className="course-context-nav" aria-label={data?.course.title}><button className="metal-button" onClick={onBack}>{t("setup.back")}</button>{data&&<><h1 dir="auto">{data.course.title}</h1><div className="course-context-tabs">{courseTabs.map(value=><button key={value} className="nav-link" aria-current={tab===value?"page":undefined} disabled={!data.canStudy&&(value==="learn"||value==="test")} onClick={()=>onTab(value)}>{t(labels[value])}{value==="learning-history"&&<small>{data.learningHistoryCount}</small>}{value==="test-history"&&<small>{data.testHistoryCount}</small>}{value==="difficulties"&&<small>{data.difficultyCount}</small>}</button>)}</div></>}</nav>{failed?<div role="alert"><p>{t("records.error")}</p><button className="metal-button" onClick={()=>setRetry(n=>n+1)}>{t("error.retry")}</button></div>:data?(!data.canStudy&&(tab==="learn"||tab==="test")?<p>{t("courses.records")}</p>:children(data)):<p role="status">{t("page.loading")}</p>}</div>;
}
