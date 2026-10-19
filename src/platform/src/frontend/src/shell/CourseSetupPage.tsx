import { useEffect, useState } from "react";
import { getBackend } from "../orchestrator/api";
import { getToken } from "../orchestrator/auth";
import type { CourseSetup, SetupConfig, CreateSessionRequest } from "../orchestrator/types";
import { translate, type MessageKey } from "@znawca/core/localization";
import { useLocale, useT } from "../i18n";

export interface SetupPreferences { config: SetupConfig; mode: "L" | "T"; all: boolean; quantity: string }
export function CourseSetupPage({id, disabled, onStart, onBack, initial, onPreferences, onRecords, embedded, forcedMode}: {
  embedded?:boolean; forcedMode?:"L"|"T"; id: string; disabled?: boolean; initial?: SetupPreferences; onPreferences?: (value: SetupPreferences) => void;
  onStart: (mode: "L" | "T", title: string, config: Omit<CreateSessionRequest, "courseVersionId" | "mode" | "preview">) => void;
  onBack: () => void; onRecords?: (page:"history"|"difficulties") => void;
}) {
  const t = useT();
  const locale = useLocale();
  const directionKeys: Record<string, MessageKey> = {"name-to-property":"nameToProperty", "property-to-name":"propertyToName", "image-to-name":"imageToName", "name-to-image":"nameToImage", "audio-to-name":"audioToName", "name-to-audio":"nameToAudio", "video-to-name":"videoToName", "name-to-video":"nameToVideo"};
  const [config, setConfig] = useState<SetupConfig>(initial?.config ?? {});
  const [metadata, setMetadata] = useState<CourseSetup | null>(null);
  const [choices, setChoices] = useState<CourseSetup | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [mode, setMode] = useState<"L" | "T">(forcedMode ?? initial?.mode ?? "L");
  useEffect(()=>{if(forcedMode)setMode(forcedMode);},[forcedMode]);
  const [all, setAll] = useState(initial?.all ?? false);
  const [quantity, setQuantity] = useState(initial?.quantity ?? "10");
  useEffect(() => { onPreferences?.({config, mode, all, quantity}); }, [config, mode, all, quantity]);
  useEffect(() => {
    let live = true;
    const token = getToken();
    void getBackend().then(b => b.courseSetup(id, {})).then(data => {
      if (live && token === getToken()) setChoices(data);
    }).catch(() => { if (live && token === getToken()) setFailed(true); });
    return () => { live = false; };
  }, [id, retry]);
  useEffect(() => {
    let live = true;
    const token = getToken();
    setLoading(true); setFailed(false);
    void getBackend().then(b => b.courseSetup(id, config)).then(data => {
      if (!live || token !== getToken()) return;
      setMetadata(data);
      setQuantity(old => String(Math.min(Number(old) || 10, 1000, Math.max(1, data.availableQuestionCount))));
    }).catch(() => { if (live && token === getToken()) setFailed(true); })
      .finally(() => { if (live && token === getToken()) setLoading(false); });
    return () => { live = false; };
  }, [id, config, retry]);
  const toggle = (values: readonly string[], value: string) => values.includes(value) ? values.filter(v => v !== value) : [...values, value];
  const max = metadata?.availableQuestionCount ?? 0;
  const limit = Math.min(max, 1000);
  const valid = all || (Number.isInteger(Number(quantity)) && Number(quantity) >= 1 && Number(quantity) <= limit);
  return <div className="workspace"><section className="content course-setup">
    {!embedded&&<button className="metal-button" onClick={onBack}>{t("setup.back")}</button>}
    {onRecords && <div className="course-actions"><button className="metal-button" onClick={()=>onRecords("history")}>{t("nav.history")}</button><button className="metal-button" onClick={()=>onRecords("difficulties")}>{t("nav.difficulties")}</button></div>}
    {!embedded && metadata && <h1 dir="auto">{metadata.course.title}</h1>}
    {loading && <p role="status">{t("page.loading")}</p>}
    {failed && <div role="alert"><p>{t("error.loadFailed")}</p><button className="metal-button" onClick={() => setRetry(n => n + 1)}>{t("error.retry")}</button></div>}
    {choices && <>
      {!embedded&&<fieldset disabled={disabled || loading}><legend>{t("setup.mode")}</legend>
        {(["L", "T"] as const).map(value => <label key={value}><input type="radio" name="mode" checked={mode === value} onChange={() => setMode(value)}/>{t(value === "L" ? "courses.learn" : "courses.test")}</label>)}
      </fieldset>}
      <fieldset disabled={disabled || loading}><legend>{t("setup.scope")}</legend>
        <label><input type="radio" name="scope" checked={!all} onChange={() => setAll(false)}/>{t("setup.sample")}</label>
        <label><input type="radio" name="scope" checked={all} onChange={() => setAll(true)}/>{t("setup.all")}</label>
        {!all && <label>{t("setup.quantity")}<input type="number" min={1} max={limit} step={1} value={quantity} onChange={e => setQuantity(e.target.value)}/></label>}
      </fieldset>
      <label className="difficulty-toggle"><input type="checkbox" name="difficultOnly" disabled={disabled || loading} checked={config.difficultOnly ?? false} onChange={e=>setConfig(c=>({...c,difficultOnly:e.target.checked}))}/>{t("difficulties.only")}</label>
      <details><summary>{t("setup.advanced")}</summary>
        <fieldset disabled={disabled || loading}><legend>{t("setup.kinds")}</legend>{choices.kinds.map(k => <label key={k.value}><input type="checkbox" checked={(config.kinds ?? choices.kinds.map(v => v.value)).includes(k.value)} onChange={() => setConfig(c => ({...c, kinds: toggle(c.kinds ?? choices.kinds.map(v => v.value), k.value)}))}/>{t(k.value === "input" ? "setup.input" : "setup.choice")}</label>)}</fieldset>
        {choices.directions.length > 0 && <fieldset disabled={disabled || loading}><legend>{t("setup.directions")}</legend>{choices.directions.map(d => <label key={d.value} dir="auto"><input type="checkbox" checked={(config.directions ?? choices.directions.map(v => v.value)).includes(d.value)} onChange={() => setConfig(c => ({...c, directions: toggle(c.directions ?? choices.directions.map(v => v.value), d.value)}))}/>{directionKeys[d.value] ? translate(locale, directionKeys[d.value]) : d.value}</label>)}</fieldset>}
        {choices.filters.length > 0 && <fieldset disabled={disabled || loading}><legend>{t("setup.filters")}</legend>{choices.filters.map(f => <div key={f.field}><h3 dir="auto">{f.field}</h3>{f.values.map(value => <label key={value} dir="auto"><input type="checkbox" checked={(config.filters?.find(v => v.field === f.field)?.values ?? f.values).includes(value)} onChange={() => setConfig(c => ({...c, filters: [...(c.filters ?? []).filter(v => v.field !== f.field), {field: f.field, values: toggle(c.filters?.find(v => v.field === f.field)?.values ?? f.values, value)}]}))}/>{value}</label>)}</div>)}</fieldset>}
      </details>
      {!loading && !failed && <p role="status">{t("setup.available", {objects: metadata!.availableObjectCount, questions: max})}</p>}
      {!loading && !failed && max === 0 && <p role="alert">{t("setup.empty")}</p>}
      {!loading && !failed && max > 0 && !valid && <p role="alert">{t("setup.range", {max: limit})}</p>}
      {mode === "T" && metadata?.testSubmitted && <p role="status">{t("activity.submitted")}</p>}
      <button className="gold-button" disabled={disabled || loading || failed || !valid || max === 0 || (mode === "T" && metadata?.testSubmitted)} onClick={() => onStart(mode, metadata!.course.title, {...config, itemCount: all ? null : Number(quantity)})}>{t("setup.start")}</button>
    </>}
  </section></div>;
}
