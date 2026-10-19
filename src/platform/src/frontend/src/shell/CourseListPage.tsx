import {useState} from "react";
import type { CourseSummary } from "../orchestrator/types";
import { useT } from "../i18n";
export function CourseListPage({
  courses, archives=[], onRecords,
  disabled,
  view,
  onEnter,
  onEnroll,
  onUnenroll,
}: {
  readonly archives?: readonly CourseSummary[];
  readonly onRecords?:(id:string)=>void;
  readonly courses: readonly CourseSummary[];
  readonly disabled?: boolean;
  readonly view: "courses" | "my-courses";
  readonly onEnter: (id: string) => void;
  readonly onUnenroll?: (id:string) => void;
  readonly onEnroll: (id: string) => void;
}) {
  const t = useT();
  const [withdraw, setWithdraw] = useState<CourseSummary|null>(null);
  return (
    <div className="workspace">
      <section className="content">
        <div className="page-courses">
          {withdraw && <div className="dialog-backdrop"><section className="host-dialog" role="dialog" aria-modal="true" aria-labelledby="withdraw-title"><h2 id="withdraw-title" dir="auto">{withdraw.title}</h2><p>{t("courses.withdrawConfirm")}</p><div className="course-actions"><button className="metal-button" onClick={()=>setWithdraw(null)}>{t("setup.cancel")}</button><button className="gold-button" disabled={disabled} onClick={()=>{onUnenroll?.(withdraw.courseVersionId);setWithdraw(null);}}>{t("courses.withdraw")}</button></div></section></div>}
          <h1>{t(view === "courses" ? "nav.select" : "nav.mine")}</h1>
          <div className="course-grid">
            {courses.map((course) => (
              <article className="course-card" key={course.courseVersionId}>
                <div className="course-copy">
                  <h2 dir="auto">{course.title}</h2>
                  <p>
                    {t("courses.items", {
                      count: course.itemCount,
                      lang: course.languageCode,
                    })}
                  </p>
                  <div className="course-actions">
                    {view === "courses" ? (
                      <button
                        className="gold-button"
                        disabled={disabled || course.isEnrolled}
                        onClick={() => onEnroll(course.courseVersionId)}
                      >
                        {t(
                          course.isEnrolled ? "courses.joined" : "courses.join",
                        )}
                      </button>
                    ) : (
                      <button className="metal-button" disabled={disabled || course.engine !== "znawca"} onClick={() => onEnter(course.courseVersionId)}>{t("courses.enter")}</button>
                    )}
                    {view === "my-courses" && onUnenroll && <button className="metal-button" disabled={disabled} onClick={()=>setWithdraw(course)}>{t("courses.withdraw")}</button>}
                  </div>
                </div>
              </article>
            ))}
          </div>
          {view === "my-courses" && archives.length>0 && <><h2>{t("courses.past")}</h2><div className="course-grid">{archives.map(course=><article className="course-card" key={course.courseVersionId}><div className="course-copy"><h3 dir="auto">{course.title}</h3><button className="metal-button" disabled={disabled} onClick={()=>onRecords?.(course.courseVersionId)}>{t("courses.records")}</button></div></article>)}</div></>}
          {courses.length === 0 && archives.length === 0 && <p>{t("courses.empty")}</p>}
        </div>
      </section>
    </div>
  );
}
