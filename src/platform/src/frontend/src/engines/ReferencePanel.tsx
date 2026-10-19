import {useState} from 'react';
import {getBackend} from '../orchestrator/api';
import {EkspertAtlas} from './EkspertQuestion';
import {engineText} from './labels';
export function ReferencePanel({id,locale}:{id:string;locale:string}){
 const [open,setOpen]=useState(false),[data,setData]=useState<any>(null),[failed,setFailed]=useState(false),[pending,setPending]=useState(false);
 const load=async()=>{setPending(true);setFailed(false);try{const b=await getBackend();if(!b.courseReference)throw Error('Unavailable');setData(await b.courseReference(id));setOpen(true);}catch{setFailed(true);}finally{setPending(false);}};
 return <div className="engine-reference"><button className="metal-button" disabled={pending} onClick={()=>open?setOpen(false):void load()}>{engineText(locale,'atlas')}</button>{failed&&<p role="alert">{engineText(locale,'error')}</p>}{open&&data&&<EkspertAtlas reference={data} locale={locale}/>}</div>;
}
