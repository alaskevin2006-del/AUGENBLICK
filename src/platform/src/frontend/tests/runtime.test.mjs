import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import React from 'react';
import Renderer, { act } from 'react-test-renderer';

let mod, temporary;
before(async () => {
  temporary = await mkdtemp(path.resolve('node_modules/.runtime-test-'));
  const outfile = path.join(temporary, 'runtime.mjs');
  await build({ stdin: {contents: `export { ZnawcaActivity } from '../../../znawca/src/adapter/ZnawcaActivity'; export { enterCourse } from './src/orchestrator/session'; export { getBackend, resetBackend } from './src/orchestrator/api';`, resolveDir: process.cwd(), loader: 'ts'}, outfile, bundle:true, platform:'node', format:'esm', jsx:'automatic', external:['react','react/jsx-runtime'] });
  mod = await import(pathToFileURL(outfile).href);
  globalThis.localStorage = {getItem:()=>null, setItem:()=>{}, removeItem:()=>{}};
});
after(async () => { await rm(temporary, {recursive:true,force:true}); });
const question = {id:'q1',objectId:'o1',kind:'input',direction:'name-to-property',prompt:'Capital?'};
const initial = {sessionId:'s1',courseVersionId:'c1',mode:'T',status:'active',totalScore:null,question,feedback:null,progress:{total:1,completed:0,remaining:1},canFinish:false,canSkip:false,review:[]};
const feedback = {submissionId:'submission-1',score:1,fullyCorrect:true,matched:['Paris'],missed:[],extra:[],correctAnswers:['Paris']};
const labels = {error:'Connection failed',retry:'Retry',finish:'Submit results',skip:'Skip',skipped:'Skipped',pending:'Saving'};
const props = api => ({initialSnapshot:initial,courseTitle:'Geography',interfaceLang:'en',labels,api,onExit:()=>{}});
const button = (view,label) => view.root.findAllByType('button').find(b=>b.children.join('')===label);

test('learning feedback uses current question mastery independently of remaining questions', async () => {
  for (const needsAnother of [false, true]) {
    let view;
    await act(async () => { view = Renderer.create(React.createElement(mod.ZnawcaActivity, {
      ...props({}), initialSnapshot: {...initial, mode:'L', feedback:{...feedback, needsAnother}, progress:{total:15,completed:1,remaining:14}}, interfaceLang:'zh-CN'
    })); });
    const text = JSON.stringify(view.toJSON());
    assert.equal(text.includes('已正确一次，请再连续答对一次。'), needsAnother);
    assert.equal(text.includes('本题已掌握'), !needsAnother);
    view.unmount();
  }
});

test('entry starts selected mode without fetching answer-bearing payload or resuming a different mode', async () => {
  const calls=[];
  const backend={createSession:async body=>{calls.push(body);return initial;},getPayload:()=>{throw Error('must not fetch payload');},findActiveSession:()=>{throw Error('must not resume');}};
  const result=await mod.enterCourse(backend,'c1','T','Geography');
  assert.deepEqual(calls,[{courseVersionId:'c1',mode:'T'}]);
  assert.equal(result.snapshot,initial);
});

test('production backend never probes or falls back to a local mock on network failure', async () => {
  globalThis.localStorage.getItem=()=> '1';
  let calls=0;
  globalThis.fetch=async()=>{calls++;throw Error('offline');};
  mod.resetBackend();
  const backend=await mod.getBackend();
  assert.equal(calls,0);
  await assert.rejects(backend.listCourses(),/offline/);
  assert.equal(calls,1);
  globalThis.localStorage.getItem=()=>null;
});

test('double click blocked; failed answer retry preserves exact request; final result comes from server', async () => {
  let reject;
  const calls=[];
  const resolved={...initial,question:null,feedback,progress:{total:1,completed:1,remaining:0},canFinish:true};
  const api={answer:(_id,request)=>{calls.push(request); return calls.length===1 ? new Promise((_resolve,rejectPromise)=>{reject=rejectPromise;}) : Promise.resolve(resolved);},advance:async(id,action)=>{assert.equal(id,'s1');assert.equal(action,'finish');return {...resolved,status:'finished',totalScore:0.75,review:[{question,answer:'Paris',feedback}]};}};
  let view;
  await act(async()=>{view=Renderer.create(React.createElement(mod.ZnawcaActivity,props(api)));});
  assert.ok(!JSON.stringify(view.toJSON()).includes('Paris'));
  act(()=>view.root.findByType('input').props.onChange({target:{value:'Paris'}}));
  const submit=button(view,'Check answer');
  act(()=>{submit.props.onClick();submit.props.onClick();});
  assert.equal(calls.length,1);
  assert.deepEqual(Object.keys(calls[0]).sort(),['answer','questionId','submissionId']);
  assert.equal(view.root.findByType('input').props.disabled,true);
  await act(async()=>reject(Error('offline')));
  assert.ok(button(view,'Retry'));
  await act(async()=>button(view,'Retry').props.onClick());
  assert.equal(calls.length,2);
  assert.equal(calls[1],calls[0]);
  await act(async()=>button(view,'Submit results').props.onClick());
  assert.ok(view.root.findAllByType('strong').some(element => element.children.join('') === '75%'));
  await act(async()=>button(view,'Review answers').props.onClick());
  assert.ok(JSON.stringify(view.toJSON()).includes('Paris'));
  view.unmount();
});

test('each supported interface locale renders and learning skip is server controlled', async () => {
  for(const interfaceLang of ['zh-CN','en','pl','ru','ar']) {
    let view;
    await act(async()=>{view=Renderer.create(React.createElement(mod.ZnawcaActivity,{...props({answer:async()=>initial,advance:async()=>({...initial,status:'skipped'})}),initialSnapshot:{...initial,mode:'L',canSkip:true},interfaceLang}));});
    assert.ok(button(view,'Skip'));
    await act(async()=>button(view,'Skip').props.onClick());
    assert.ok(JSON.stringify(view.toJSON()).includes('Skipped'));
    view.unmount();
  }
});


test('next retries identify the same dismissed question instead of advancing newer feedback', async () => {
  const calls=[];
  const api={answer:async()=>initial,advance:async(id,action,questionId,submissionId)=>{calls.push({id,action,questionId,submissionId});if(calls.length===1)throw Error('lost response');return {...initial,question:{...question,id:'q2'},progress:{total:2,completed:1,remaining:1}};}};
  let view;
  await act(async()=>{view=Renderer.create(React.createElement(mod.ZnawcaActivity,{...props(api),initialSnapshot:{...initial,feedback,progress:{total:2,completed:1,remaining:1}}}));});
  await act(async()=>button(view,'Next question').props.onClick());
  await act(async()=>button(view,'Retry').props.onClick());
  assert.deepEqual(calls,[{id:'s1',action:'next',questionId:'q1',submissionId:'submission-1'},{id:'s1',action:'next',questionId:'q1',submissionId:'submission-1'}]);
  assert.ok(button(view,'Check answer'));
  view.unmount();
});
