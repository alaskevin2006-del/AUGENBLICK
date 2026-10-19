import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import React from 'react';
import Renderer,{act} from 'react-test-renderer';
let mod,temp;
before(async()=>{temp=await mkdtemp(path.resolve('node_modules/.companion-test-'));const outfile=path.join(temp,'companion.mjs');await build({stdin:{contents:"export {CompanionQuestion} from './src/engines/CompanionQuestion'; export {pcmWav,capture} from './src/engines/companionRecording'; export {companionLocale} from './src/engines/companionLocale';",resolveDir:process.cwd(),loader:'ts'},outfile,bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react/jsx-runtime'],loader:{'.css':'empty'}});mod=await import(pathToFileURL(outfile)); globalThis.window={setTimeout,clearTimeout,setInterval,clearInterval};});
after(async()=>{await rm(temp,{recursive:true,force:true});});
const question={kind:'companion-row',prompt:'Hi',interaction:{voiceInput:true,pauseSeconds:0,referenceDurationMs:1000,displayBefore:[],displayAfter:[[{text:'Hi',bold:true}]]}};
test('readonly history has transcript and no microphone or practice action',async()=>{let view;await act(async()=>{view=Renderer.create(React.createElement(mod.CompanionQuestion,{question,answer:'[recording]',onChange:()=>{},disabled:true,locale:'en',feedback:{responseStatus:'recorded'}}));});assert.equal(view.root.findAllByType('button').filter(b=>!b.props.disabled).length,0);assert.match(JSON.stringify(view.toJSON()),/Hi/);await act(async()=>view.unmount());});
test('live resolved row offers practice without resubmitting progress',async()=>{let view;await act(async()=>{view=Renderer.create(React.createElement(mod.CompanionQuestion,{question,answer:'[recording]',onChange:()=>{throw Error('must not resubmit')},disabled:true,locale:'en',feedback:{responseStatus:'recorded'},onPractice:async()=>({responseStatus:'recorded'})}));});assert.ok(view.root.findAllByType('button').some(b=>b.children.join('')==='Practice again'&&!b.props.disabled));await act(async()=>view.unmount());});
test('PCM WAV encoder writes bounded mono 16-bit payload',()=>{const raw=Buffer.from(mod.pcmWav(new Float32Array([0,1,-1]),16000),'base64');assert.equal(raw.toString('ascii',0,4),'RIFF');assert.equal(raw.readUInt32LE(24),16000);assert.equal(raw.readUInt32LE(40),6);assert.equal(raw.readInt16LE(46),32767);});
test('all five platform languages have native recording controls',()=>{assert.match(mod.companionLocale('ru')[0],/[А-Яа-я]/);assert.match(mod.companionLocale('ar')[0],/[\u0600-\u06ff]/);assert.match(mod.companionLocale('zh-CN')[0],/开始/);});
test('recording timeout submits no-response and always releases microphone',async()=>{
  const previousPerformance=globalThis.performance, previousContext=globalThis.AudioContext, previousNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator');
  let now=0,tick,stopped=0,closed=0,answer;
  const node=()=>({connect(){},disconnect(){}}),track={stop(){stopped++},addEventListener(){}};
  globalThis.performance={now:()=>now};
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{getUserMedia:async()=>({getTracks:()=>[track],getAudioTracks:()=>[track]})}}});
  globalThis.AudioContext=class {sampleRate=16000;destination={};async resume(){}async close(){closed++}createMediaStreamSource(){return node()}createScriptProcessor(){return node()}createGain(){return {...node(),gain:{value:1}}}};
  globalThis.window={setInterval:fn=>{tick=fn;return 1},setTimeout,clearTimeout};
  try{const cancel=await mod.capture(1000,()=>{},value=>answer=value,()=>{});now=3100;tick();assert.deepEqual(JSON.parse(answer),{noResponse:true});assert.equal(stopped,1);assert.equal(closed,1);cancel();assert.equal(stopped,1);}
  finally{globalThis.performance=previousPerformance;globalThis.AudioContext=previousContext;if(previousNavigator)Object.defineProperty(globalThis,'navigator',previousNavigator);globalThis.window={setTimeout,clearTimeout,setInterval,clearInterval};}
});
test('denied microphone propagates error without opening audio context',async()=>{
 const prior=Object.getOwnPropertyDescriptor(globalThis,'navigator');let opened=0;const old=globalThis.AudioContext;
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{getUserMedia:async()=>{throw new Error('denied')}}}});globalThis.AudioContext=class{constructor(){opened++}};
 try{await assert.rejects(()=>mod.capture(1000,()=>{},()=>{},()=>{}),/denied/);assert.equal(opened,0);}finally{Object.defineProperty(globalThis,'navigator',prior);globalThis.AudioContext=old;}
});
test('cancellation before delayed permission grant releases stream without starting audio',async()=>{
 const prior=Object.getOwnPropertyDescriptor(globalThis,'navigator'),old=globalThis.AudioContext;let grant,stopped=0,opened=0;
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{getUserMedia:()=>new Promise(resolve=>grant=resolve)}}});globalThis.AudioContext=class{constructor(){opened++}};
 try{const controller=new AbortController();const result=mod.capture(1000,()=>{},()=>{},()=>{},controller.signal);controller.abort();grant({getTracks:()=>[{stop(){stopped++}}]});await assert.rejects(result,/cancel/i);assert.equal(stopped,1);assert.equal(opened,0);}finally{Object.defineProperty(globalThis,'navigator',prior);globalThis.AudioContext=old;}
});
test('cancel during suspended audio resume releases device immediately',async()=>{
 const prior=Object.getOwnPropertyDescriptor(globalThis,'navigator'),old=globalThis.AudioContext;let resume,stopped=0,closed=0;
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{getUserMedia:async()=>({getTracks:()=>[{stop(){stopped++}}]})}}});globalThis.AudioContext=class{resume(){return new Promise(resolve=>resume=resolve)}async close(){closed++}};
 try{const controller=new AbortController();const result=mod.capture(1000,()=>{},()=>{},()=>{},controller.signal);await Promise.resolve();controller.abort();const released=stopped>0&&closed>0;resume();await assert.rejects(result,/cancel/i);assert.equal(released,true);}finally{Object.defineProperty(globalThis,'navigator',prior);globalThis.AudioContext=old;}
});
