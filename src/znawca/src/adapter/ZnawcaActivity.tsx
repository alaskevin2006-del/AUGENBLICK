import { useRef, useState } from "react";
import { translate, type Locale } from "../core/localization";
import { InterfaceLangContext, SessionView, ResultsView } from "../ui";
import type { AnswerRequest, RuntimeApi, RuntimeSnapshot } from "./runtime";

// Retained only for legacy telemetry types; runtime never emits client-scored events.
export interface EngineEvent { readonly eventId: string; readonly seq: number; readonly ts: number; readonly type: string; readonly payload: unknown; }
export interface ZnawcaActivityProps {
  readonly initialSnapshot: RuntimeSnapshot;
  readonly courseTitle: string;
  readonly api: RuntimeApi;
  readonly interfaceLang: Locale;
  readonly labels: {error: string; retry: string; finish: string; skip: string; skipped: string; pending: string};
  readonly onExit: () => void;
}
export function ZnawcaActivity(props: ZnawcaActivityProps) {
  return <InterfaceLangContext.Provider value={props.interfaceLang}><Activity {...props} /></InterfaceLangContext.Provider>;
}
function Activity(props: ZnawcaActivityProps) {
  const [snapshot, setSnapshot] = useState(props.initialSnapshot);
  const [answer, setAnswer] = useState("");
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  // Preserve the exact command across uncertain network failures. Retry uses the same idempotency key.
  const command = useRef<null | (() => Promise<RuntimeSnapshot>)>(null);
  const busy = useRef(false);
  const run = async (operation: () => Promise<RuntimeSnapshot>) => {
    if (busy.current) return;
    busy.current = true;
    command.current = operation;
    setPending(true);
    setFailed(false);
    try {
      const updated = await operation();
      setSnapshot(updated);
      if (!updated.feedback) setAnswer("");
      command.current = null;
    } catch { setFailed(true); }
    finally { busy.current = false; setPending(false); }
  };
  const advance = (action: "next" | "finish" | "skip") => {
    if (command.current) return;
    void run(() => props.api.advance(snapshot.sessionId, action, snapshot.question?.id, snapshot.feedback?.submissionId));
  };
  const submit = () => {
    if (!snapshot.question || snapshot.feedback || command.current) return;
    const request: AnswerRequest = {submissionId: crypto.randomUUID(), questionId: snapshot.question.id, answer};
    void run(() => props.api.answer(snapshot.sessionId, request));
  };
  const completed = snapshot.status === "finished";
  if (completed) {
    const correct = snapshot.review.filter(entry => entry.feedback.fullyCorrect).length;
    return <ResultsView totalScore={snapshot.totalScore ?? 0} answered={snapshot.review.length}
      fullyCorrect={correct} incorrect={snapshot.review.length - correct} mode={snapshot.mode}
      review={snapshot.review.map(entry => ({questionId: entry.question.id, prompt: entry.question.prompt,
        direction: entry.question.direction, submittedAnswers: entry.answer ? [entry.question.options?.find(option => option.value === entry.answer)?.media?.path ?? entry.question.options?.find(option => option.value === entry.answer)?.label ?? entry.answer] : [],
        acceptedAnswers: entry.feedback.correctAnswers, options: entry.question.options}))} onExit={props.onExit} />;
  }
  if (snapshot.status === "skipped") return <div className="results-page"><h1>{props.labels.skipped}</h1>
    <button className="gold-button" onClick={props.onExit}>{translate(props.interfaceLang, "back")}</button></div>;
  return <>
    {pending && <p role="status">{props.labels.pending}</p>}
    {failed && <div className="host-error" role="alert"><p>{props.labels.error}</p>
      <button className="gold-button" disabled={pending} onClick={() => command.current && void run(command.current)}>{props.labels.retry}</button></div>}
    {snapshot.question && <SessionView key={snapshot.question.id} question={{...snapshot.question, acceptedAnswers: snapshot.feedback?.correctAnswers ?? []}}
      courseTitle={props.courseTitle} mode={snapshot.mode} position={Math.min(snapshot.progress.completed + 1, snapshot.progress.total)}
      total={snapshot.progress.total} units={snapshot.progress} answer={answer} setAnswer={setAnswer}
      feedback={snapshot.feedback ?? undefined} needsAnother={snapshot.feedback?.needsAnother === true}
      disabled={pending || failed} onSubmit={submit} onNext={() => advance(snapshot.canFinish ? "finish" : "next")}
      nextLabel={snapshot.canFinish ? props.labels.finish : undefined} />}
    {!snapshot.question && snapshot.canFinish && <button className="gold-button" disabled={pending || failed} onClick={() => advance("finish")}>{props.labels.finish}</button>}
    {!snapshot.question && !snapshot.canFinish && <p>{translate(props.interfaceLang, "noQuestionsAvailable")}</p>}
    {snapshot.canSkip && <button className="metal-button" disabled={pending || failed} onClick={() => advance("skip")}>{props.labels.skip}</button>}
  </>;
}
