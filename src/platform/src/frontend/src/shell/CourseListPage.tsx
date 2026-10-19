import type { CourseSummary } from "../orchestrator/types";
import { useT } from "../i18n";
export function CourseListPage({
  courses,
  disabled,
  view,
  onEnter,
  onEnroll,
}: {
  readonly courses: readonly CourseSummary[];
  readonly disabled?: boolean;
  readonly view: "courses" | "my-courses";
  readonly onEnter: (id: string, mode: "L" | "T") => void;
  readonly onEnroll: (id: string) => void;
}) {
  const t = useT();
  return (
    <div className="workspace">
      <section className="content">
        <div className="page-courses">
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
                      <>
                        <button
                          className="metal-button"
                          disabled={disabled || course.engine !== "znawca"}
                          onClick={() => onEnter(course.courseVersionId, "L")}
                        >
                          {t("courses.learn")}
                        </button>
                        <button
                          className="metal-button"
                          disabled={disabled || course.engine !== "znawca"}
                          onClick={() => onEnter(course.courseVersionId, "T")}
                        >
                          {t("courses.test")}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
          {courses.length === 0 && <p>{t("courses.empty")}</p>}
        </div>
      </section>
    </div>
  );
}
