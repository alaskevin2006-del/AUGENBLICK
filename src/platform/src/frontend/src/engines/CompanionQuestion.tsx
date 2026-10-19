import {useEffect, useRef, useState} from 'react';
import {capture} from './companionRecording';
import {companionLocale} from './companionLocale';
import './companion.css';

type Segment = {text: string; bold?: boolean; color?: string; audio?: {path: string} | null};
type Features = {spectrum: number[][]; pitch: number[]; energy: number[]};
type Diagnostic = {acousticSimilarity: number; timingSimilarity: number; intonationSimilarity: number | null; reference: Features; learner: Features; alignment: number[][]};
type Feedback = {diagnostics?: Diagnostic; responseStatus?: string};
type Interaction = {voiceInput: boolean; pauseSeconds: number; reference?: {path: string}; referenceDurationMs: number; displayBefore: Segment[][]; displayAfter: Segment[][]};
type Props = {question: {kind: string; prompt: string; interaction?: unknown}; answer: string; onChange: (answer: string) => void; disabled: boolean; locale: string; onCommit?: (answer: string) => void; feedback?: unknown; onPractice?: (answer: string) => Promise<unknown>};

export function CompanionQuestion({question, answer, onChange, disabled, locale, onCommit, feedback, onPractice}: Props) {
  const [practiceFeedback, setPracticeFeedback] = useState<Feedback>();
  const t = companionLocale(locale), data = question.interaction as Interaction, result = practiceFeedback || feedback as Feedback | undefined;
  const [phase, setPhase] = useState('idle'), [remaining, setRemaining] = useState(3), [error, setError] = useState(false);
  const cleanup = useRef<(() => void) | null>(null), timer = useRef<number>(), audio = useRef<HTMLAudioElement>(null), generation = useRef(0);
  const stop = () => { generation.current++; cleanup.current?.(); cleanup.current = null; clearTimeout(timer.current); audio.current?.pause(); };
  useEffect(() => () => stop(), []);
  useEffect(() => { if (disabled && phase !== 'done') stop(); }, [disabled]);
  const commit = (value: string) => { setPhase('done'); onChange(value); onCommit?.(value); };
  const playReference = () => { if (audio.current) { audio.current.currentTime = 0; void audio.current.play().catch(() => setError(true)); } };
  const run = async (practice = false) => {
    stop(); setError(false); setPhase('waiting'); const token = generation.current;
    timer.current = window.setTimeout(async () => {
      if (token !== generation.current) return;
      if (!data.voiceInput) {
        if (!data.reference) { commit('{"ack":true}'); return; }
        setPhase('playing');
        try { await audio.current?.play(); } catch { setError(true); setPhase('idle'); }
        return;
      }
      try {
        setPhase('permission');
        const controller = new AbortController();
        cleanup.current = () => controller.abort();
        const cancel = await capture(data.referenceDurationMs, (n, speaking) => { setRemaining(n); setPhase(speaking ? 'recording' : 'onset'); }, value => {
          if (token !== generation.current) return;
          playReference();
          if (practice && onPractice) {
            setPhase('analysis');
            void onPractice(value).then(next => { if (token === generation.current) {setPracticeFeedback(next as Feedback); setPhase('done');} }).catch(() => {if (token === generation.current) {setError(true); setPhase('done');}});
          } else commit(value);
        }, () => { setError(true); setPhase('idle'); }, controller.signal);
        if (token !== generation.current) cancel(); else cleanup.current = cancel;
      } catch { if (token === generation.current) { setError(true); setPhase('idle'); } }
    }, data.pauseSeconds * 1000);
  };
  const completed = !!result || !!answer || phase === 'done';
  const lines = completed ? data.displayAfter : data.displayBefore;
  const active = !['idle', 'done', 'paused'].includes(phase);
  const diagnostics = result?.diagnostics;
  return <section className="companion-question" dir={locale.startsWith('ar') ? 'rtl' : undefined}>
    <p className="companion-note">{t[5]}</p>
    <div className="companion-transcript">{lines?.map((line, i) => <p key={i}>{line.map((segment, j) => <button key={j} type="button" className="companion-segment" disabled={!segment.audio} style={{fontWeight: segment.bold ? 700 : undefined, color: segment.color}} onClick={() => { if (segment.audio && audio.current) { stop(); setPhase('paused'); audio.current.src = segment.audio.path; void audio.current.play().catch(() => setError(true)); } }}>{segment.text}</button>)}</p>)}</div>
    <audio ref={audio} src={data.reference?.path} controls={!!data.reference} aria-label={t[3]} onEnded={() => { if (phase === 'playing') commit('{"ack":true}'); }} />
    {!disabled && !completed && <div className="companion-actions">
      <button type="button" disabled={active} onClick={() => { if (audio.current && data.reference) audio.current.src = data.reference.path; void run(); }}>{phase === 'paused' ? t[2] : t[0]}</button>
      <button type="button" disabled={!active} onClick={() => {stop(); setPhase('paused');}}>{t[1]}</button>
    </div>}
    {completed && data.voiceInput && onPractice && <div className="companion-actions"><button type="button" disabled={active} onClick={() => {if (audio.current && data.reference) audio.current.src = data.reference.path; void run(true);}}>{t[15]}</button><button type="button" disabled={!active} onClick={() => {stop(); setPhase('done');}}>{t[1]}</button></div>}
    {(phase === 'onset' || phase === 'recording') && <p role="status">{phase === 'onset' ? t[6] : t[7]} · {remaining.toFixed(1)} s <progress max={phase === 'onset' ? 3 : data.referenceDurationMs * .0015} value={remaining}/></p>}
    {error && <p role="alert">{t[8]}</p>}
    {result?.responseStatus === 'no-response' && <p>{t[14]}</p>}
    {completed && <p>{t[13]}</p>}
    {diagnostics && <div className="companion-diagnostics"><h3>{t[4]}</h3><dl>{[[t[9], diagnostics.acousticSimilarity], [t[10], diagnostics.timingSimilarity], [t[11], diagnostics.intonationSimilarity]].map(([label, value]) => <div key={String(label)}><dt>{label}</dt><dd>{value === null ? t[12] : `${Math.round(Number(value) * 100)}%`}</dd></div>)}</dl>
      <svg viewBox="0 0 512 160" role="img" aria-label={t[4]}>{diagnostics.reference.spectrum.map((frame, i) => frame.map((value, j) => {const aligned = diagnostics.alignment.find(pair => pair[0] === i)?.[1]; const actual = aligned === undefined ? 0 : diagnostics.learner.spectrum[aligned]?.[j] || 0; return <rect key={`${i}-${j}`} x={i * 512 / diagnostics.reference.spectrum.length} y={j * 100 / frame.length} width={512 / diagnostics.reference.spectrum.length + .1} height={100 / frame.length + .1} fill={Math.abs(value-actual) < .1 ? `rgba(121,205,169,${Math.min(1,Math.max(value,actual)*3)})` : `rgba(231,126,126,${Math.min(1,Math.max(value,actual)*3)})`}/>;}))}
        {diagnostics.alignment.map(([i, j, match], k) => <rect key={`a${k}`} x={i * 512 / diagnostics.reference.spectrum.length} y="102" width="4" height="7" fill={match > .8 ? '#79cda9' : '#e77e7e'}><title>{`${j + 1}: ${Math.round(match * 100)}%`}</title></rect>)}
        {[diagnostics.reference, diagnostics.learner].map((signal, index) => <g key={index}>{signal.pitch.map((pitch, i) => pitch > 0 && i > 0 && signal.pitch[i - 1] > 0 ? <line key={i} x1={(i - 1) * 512 / signal.pitch.length} x2={i * 512 / signal.pitch.length} y1={158 - Math.min(48, signal.pitch[i - 1] / 10)} y2={158 - Math.min(48, pitch / 10)} stroke={index ? '#79cda9' : '#dfb753'} strokeWidth={1 + Math.min(3, signal.energy[i] * 15)}/> : null)}</g>)}
        {[diagnostics.reference, diagnostics.learner].map((signal, index) => <g key={`rhythm-${index}`}>{signal.energy.map((energy,i) => energy > .01 && i > 0 && i < signal.energy.length-1 && energy > signal.energy[i-1] && energy >= signal.energy[i+1] ? <line key={i} x1={i*512/signal.energy.length} x2={i*512/signal.energy.length} y1={index ? 145 : 0} y2={index ? 160 : 15} stroke={index?'#79cda9':'#dfb753'} strokeDasharray="2 2"/> : null)}</g>)}
      </svg>
    </div>}
  </section>;
}
