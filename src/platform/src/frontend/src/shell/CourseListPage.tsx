import type { CourseSummary } from "../orchestrator/types";
import { useT } from "../i18n";

/** 课程列表页：课程卡片网格（风格对齐桌面 Courses/CourseCard）。顶栏由 App 统一渲染。 */
export function CourseListPage({
  courses,
  disabled,
  onEnter,
}: {
  readonly disabled?: boolean;
  readonly courses: readonly CourseSummary[];
  readonly onEnter: (courseVersionId: string, mode: "L" | "T") => void;
}) {
  const t = useT();
  return (
    <div className="workspace">
      <section className="content content-courses">
        <div className="page-courses">
          <div className="page-heading">
            <div>
              <p className="eyebrow">{t("courses.eyebrow")}</p>
              <h1>{t("courses.heading")}</h1>
            </div>
          </div>
          <div className="courses-scrollable">
            <div className="course-grid">
              {courses.map((course) => {
                return (
                  <article className="course-card" key={course.courseVersionId}>
                    <div className="course-art"><span>{course.title.slice(0, 1).toUpperCase()}</span></div>
                    <div className="course-copy">
                      <h2 dir="auto">{course.title}</h2>
                      <p>{t("courses.items", { count: course.itemCount, lang: course.languageCode })}</p>
                      <div className="course-actions">
                        <button className="metal-button" type="button" disabled={disabled || course.engine !== "znawca"} onClick={() => onEnter(course.courseVersionId, "L")}>{t("courses.learn")}</button>
                        <button className="metal-button" type="button" disabled={disabled || course.engine !== "znawca"} onClick={() => onEnter(course.courseVersionId, "T")}>{t("courses.test")}</button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
            {courses.length === 0 && <p>{t("courses.empty")}</p>}
          </div>
        </div>
      </section>
    </div>
  );
}
