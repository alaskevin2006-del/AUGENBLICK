import { useSyncExternalStore } from "react";
import { isLocale, textDirection, type Locale } from "@znawca/core/localization";

// 壳层 i18n（契约§十）：自维护小字典，5 语言，选择存 localStorage，默认 zh-CN。
// 不引第三方 i18n 库：模块级状态 + useSyncExternalStore 订阅。
// key 用「域.名」扁平命名；值支持 {name} 插值。

export type { Locale };
export { textDirection };

const STORAGE_KEY = "augenblick.ui.locale";

const zhCN = {
  "activity.error": "操作未确认，请重试。重试不会重复提交答案。",
  "activity.finish": "提交结果",
  "activity.skip": "跳过本次学习",
  "activity.skipped": "本次学习已跳过",
  "activity.pending": "正在保存…",
  "activity.startError": "无法开始活动。已完成的测试不能重考；请返回课程列表重试。",

  "login.title": "登录 AUGENBLICK",
  "login.subtitle": "使用账号密码进入课程平台",
  "login.username": "用户名",
  "login.password": "密码",
  "login.submit": "登录",
  "login.submitting": "登录中…",
  "login.badCredentials": "用户名或密码错误",
  "login.networkError": "网络异常，请稍后再试",

  "nav.developer": "开发者",
  "nav.logout": "退出登录",
  "nav.language": "界面语言",

  "courses.eyebrow": "课程",
  "courses.heading": "选择要掌握的内容",
  "courses.empty": "暂无课程。",
  "courses.items": "{count} 个对象 / {lang}",
  "courses.continueLearning": "继续学习",
  "courses.continueTesting": "继续测试",
  "courses.learn": "学习",
  "courses.test": "测试",

  "results.eyebrow": "会话完成",
  "results.flawless": "完美成绩。",
  "results.progress": "进步值得保留。",
  "results.back": "返回课程列表",

  "error.loadFailed": "课程列表加载失败",
  "error.retry": "重试",

  "exit.title": "确定退出？",
  "exit.body": "退出后，再次进入将从该活动开头重新开始。",
  "exit.stay": "继续答题",
  "exit.confirm": "退出",

  "hostError.title": "该活动暂时不可用",
  "hostError.body": "请稍后再试，或返回课程列表选择其他课程。",

  "dev.title": "开发者",
  "dev.heading": "课程版本",
  "dev.uploadTitle": "上传课程 ZIP",
  "dev.upload": "上传",
  "dev.uploading": "上传中…",
  "dev.noFile": "请先选择 .zip 文件",
  "dev.colVersion": "课程版本",
  "dev.colTitle": "标题",
  "dev.colLang": "语言",
  "dev.colItems": "题数",
  "dev.imported": "导入结果",
  "dev.reused": "复用",
  "dev.warnings": "警告",
  "dev.failed": "上传失败",
  "dev.forbidden": "无权限访问（403）",
  "dev.forbiddenBody": "开发者页仅对开发者账号开放。",
} as const;

export type ShellKey = keyof typeof zhCN;
type ShellMessages = Record<ShellKey, string>;

const en: ShellMessages = {
  "activity.error": "The operation was not confirmed. Retry safely without submitting your answer twice.",
  "activity.finish": "Submit results",
  "activity.skip": "Skip this learning activity",
  "activity.skipped": "Learning activity skipped",
  "activity.pending": "Saving…",
  "activity.startError": "Unable to start. Completed tests cannot be retaken. Return to courses and try again.",

  "login.title": "Log in to AUGENBLICK",
  "login.subtitle": "Sign in with your account to enter the course platform",
  "login.username": "Username",
  "login.password": "Password",
  "login.submit": "Log in",
  "login.submitting": "Logging in…",
  "login.badCredentials": "Incorrect username or password",
  "login.networkError": "Network error, please try again later",

  "nav.developer": "Developer",
  "nav.logout": "Log out",
  "nav.language": "Interface language",

  "courses.eyebrow": "Courses",
  "courses.heading": "Choose what to master",
  "courses.empty": "No courses yet.",
  "courses.items": "{count} items / {lang}",
  "courses.continueLearning": "Resume learning",
  "courses.continueTesting": "Resume testing",
  "courses.learn": "Learn",
  "courses.test": "Test",

  "results.eyebrow": "Session complete",
  "results.flawless": "A flawless result.",
  "results.progress": "Progress worth keeping.",
  "results.back": "Back to courses",

  "error.loadFailed": "Failed to load the course list",
  "error.retry": "Retry",

  "exit.title": "Leave the activity?",
  "exit.body": "When you return, this activity will restart from the beginning.",
  "exit.stay": "Keep answering",
  "exit.confirm": "Exit",

  "hostError.title": "This activity is temporarily unavailable",
  "hostError.body": "Try again later, or pick another course from the list.",

  "dev.title": "Developer",
  "dev.heading": "Course versions",
  "dev.uploadTitle": "Upload course ZIP",
  "dev.upload": "Upload",
  "dev.uploading": "Uploading…",
  "dev.noFile": "Choose a .zip file first",
  "dev.colVersion": "Course version",
  "dev.colTitle": "Title",
  "dev.colLang": "Language",
  "dev.colItems": "Items",
  "dev.imported": "Import result",
  "dev.reused": "reused",
  "dev.warnings": "Warnings",
  "dev.failed": "Upload failed",
  "dev.forbidden": "Access denied (403)",
  "dev.forbiddenBody": "The developer page is only available to developer accounts.",
};

const pl: ShellMessages = {
  "activity.error": "Nie potwierdzono operacji. Ponów bez ponownego zapisywania odpowiedzi.",
  "activity.finish": "Prześlij wyniki",
  "activity.skip": "Pomiń tę naukę",
  "activity.skipped": "Nauka pominięta",
  "activity.pending": "Zapisywanie…",
  "activity.startError": "Nie można rozpocząć. Ukończonych testów nie można powtarzać. Wróć do kursów i spróbuj ponownie.",

  "login.title": "Zaloguj się do AUGENBLICK",
  "login.subtitle": "Zaloguj się kontem, aby wejść na platformę kursów",
  "login.username": "Nazwa użytkownika",
  "login.password": "Hasło",
  "login.submit": "Zaloguj",
  "login.submitting": "Logowanie…",
  "login.badCredentials": "Błędna nazwa użytkownika lub hasło",
  "login.networkError": "Błąd sieci, spróbuj ponownie później",

  "nav.developer": "Deweloper",
  "nav.logout": "Wyloguj",
  "nav.language": "Język interfejsu",

  "courses.eyebrow": "Kursy",
  "courses.heading": "Wybierz materiał do opanowania",
  "courses.empty": "Brak kursów.",
  "courses.items": "{count} obiektów / {lang}",
  "courses.continueLearning": "Kontynuuj naukę",
  "courses.continueTesting": "Kontynuuj test",
  "courses.learn": "Nauka",
  "courses.test": "Test",

  "results.eyebrow": "Sesja zakończona",
  "results.flawless": "Wynik bezbłędny.",
  "results.progress": "Postęp wart zachowania.",
  "results.back": "Wróć do listy kursów",

  "error.loadFailed": "Nie udało się wczytać listy kursów",
  "error.retry": "Spróbuj ponownie",

  "exit.title": "Na pewno wyjść?",
  "exit.body": "Po powrocie aktywność rozpocznie się od początku.",
  "exit.stay": "Odpowiadaj dalej",
  "exit.confirm": "Wyjdź",

  "hostError.title": "Ta aktywność jest chwilowo niedostępna",
  "hostError.body": "Spróbuj później albo wybierz inny kurs z listy.",

  "dev.title": "Deweloper",
  "dev.heading": "Wersje kursów",
  "dev.uploadTitle": "Prześlij ZIP kursu",
  "dev.upload": "Prześlij",
  "dev.uploading": "Przesyłanie…",
  "dev.noFile": "Najpierw wybierz plik .zip",
  "dev.colVersion": "Wersja kursu",
  "dev.colTitle": "Tytuł",
  "dev.colLang": "Język",
  "dev.colItems": "Liczba pytań",
  "dev.imported": "Wynik importu",
  "dev.reused": "ponownie użyto",
  "dev.warnings": "Ostrzeżenia",
  "dev.failed": "Przesyłanie nie powiodło się",
  "dev.forbidden": "Brak dostępu (403)",
  "dev.forbiddenBody": "Strona dewelopera jest dostępna tylko dla kont deweloperskich.",
};

const ru: ShellMessages = {
  "activity.error": "Операция не подтверждена. Повторите без повторной записи ответа.",
  "activity.finish": "Отправить результаты",
  "activity.skip": "Пропустить обучение",
  "activity.skipped": "Обучение пропущено",
  "activity.pending": "Сохранение…",
  "activity.startError": "Не удалось начать. Завершённые тесты нельзя повторять. Вернитесь к курсам.",
  "login.title": "Вход в AUGENBLICK",
  "login.subtitle": "Войдите под своей учётной записью",
  "login.username": "Имя пользователя",
  "login.password": "Пароль",
  "login.submit": "Войти",
  "login.submitting": "Вход…",
  "login.badCredentials": "Неверное имя пользователя или пароль",
  "login.networkError": "Ошибка сети, попробуйте позже",

  "nav.developer": "Разработчик",
  "nav.logout": "Выйти",
  "nav.language": "Язык интерфейса",

  "courses.eyebrow": "Курсы",
  "courses.heading": "Выберите материал",
  "courses.empty": "Курсов пока нет.",
  "courses.items": "{count} объектов / {lang}",
  "courses.continueLearning": "Продолжить обучение",
  "courses.continueTesting": "Продолжить тест",
  "courses.learn": "Обучение",
  "courses.test": "Тест",

  "results.eyebrow": "Занятие завершено",
  "results.flawless": "Безупречный результат.",
  "results.progress": "Прогресс стоит сохранить.",
  "results.back": "К списку курсов",

  "error.loadFailed": "Не удалось загрузить список курсов",
  "error.retry": "Повторить",

  "exit.title": "Выйти из занятия?",
  "exit.body": "При возвращении занятие начнётся сначала.",
  "exit.stay": "Продолжить отвечать",
  "exit.confirm": "Выйти",

  "hostError.title": "Занятие временно недоступно",
  "hostError.body": "Попробуйте позже или выберите другой курс.",

  "dev.title": "Разработчик",
  "dev.heading": "Версии курсов",
  "dev.uploadTitle": "Загрузить ZIP курса",
  "dev.upload": "Загрузить",
  "dev.uploading": "Загрузка…",
  "dev.noFile": "Сначала выберите файл .zip",
  "dev.colVersion": "Версия курса",
  "dev.colTitle": "Название",
  "dev.colLang": "Язык",
  "dev.colItems": "Вопросов",
  "dev.imported": "Результат импорта",
  "dev.reused": "повторно использован",
  "dev.warnings": "Предупреждения",
  "dev.failed": "Ошибка загрузки",
  "dev.forbidden": "Доступ запрещён (403)",
  "dev.forbiddenBody": "Страница разработчика доступна только учётным записям разработчиков.",
};

const ar: ShellMessages = {
  "activity.error": "لم يتم تأكيد العملية. أعد المحاولة دون إرسال الإجابة مرتين.",
  "activity.finish": "إرسال النتائج",
  "activity.skip": "تخطي نشاط التعلم",
  "activity.skipped": "تم تخطي نشاط التعلم",
  "activity.pending": "جارٍ الحفظ…",
  "activity.startError": "تعذر البدء. لا يمكن إعادة الاختبارات المكتملة. ارجع إلى المقررات وحاول مجددًا.",

  "login.title": "تسجيل الدخول إلى AUGENBLICK",
  "login.subtitle": "سجّل الدخول بحسابك للدخول إلى منصة الدورات",
  "login.username": "اسم المستخدم",
  "login.password": "كلمة المرور",
  "login.submit": "تسجيل الدخول",
  "login.submitting": "جارٍ تسجيل الدخول…",
  "login.badCredentials": "اسم المستخدم أو كلمة المرور غير صحيحة",
  "login.networkError": "خطأ في الشبكة، حاول لاحقًا",

  "nav.developer": "المطوّر",
  "nav.logout": "تسجيل الخروج",
  "nav.language": "لغة الواجهة",

  "courses.eyebrow": "الدورات",
  "courses.heading": "اختر ما تريد إتقانه",
  "courses.empty": "لا توجد دورات بعد.",
  "courses.items": "{count} عناصر / {lang}",
  "courses.continueLearning": "متابعة التعلم",
  "courses.continueTesting": "متابعة الاختبار",
  "courses.learn": "تعلّم",
  "courses.test": "اختبار",

  "results.eyebrow": "اكتملت الجلسة",
  "results.flawless": "نتيجة كاملة.",
  "results.progress": "تقدم يستحق الحفظ.",
  "results.back": "العودة إلى قائمة الدورات",

  "error.loadFailed": "تعذر تحميل قائمة الدورات",
  "error.retry": "إعادة المحاولة",

  "exit.title": "هل تريد الخروج؟",
  "exit.body": "عند العودة، سيبدأ هذا النشاط من البداية.",
  "exit.stay": "متابعة الإجابة",
  "exit.confirm": "خروج",

  "hostError.title": "هذا النشاط غير متاح مؤقتًا",
  "hostError.body": "حاول لاحقًا أو اختر دورة أخرى من القائمة.",

  "dev.title": "المطوّر",
  "dev.heading": "إصدارات الدورات",
  "dev.uploadTitle": "رفع ملف ZIP للدورة",
  "dev.upload": "رفع",
  "dev.uploading": "جارٍ الرفع…",
  "dev.noFile": "اختر ملف .zip أولًا",
  "dev.colVersion": "إصدار الدورة",
  "dev.colTitle": "العنوان",
  "dev.colLang": "اللغة",
  "dev.colItems": "عدد العناصر",
  "dev.imported": "نتيجة الاستيراد",
  "dev.reused": "مُعاد استخدامه",
  "dev.warnings": "تحذيرات",
  "dev.failed": "فشل الرفع",
  "dev.forbidden": "الوصول مرفوض (403)",
  "dev.forbiddenBody": "صفحة المطوّر متاحة فقط لحسابات المطوّرين.",
};

const messages: Record<Locale, ShellMessages> = { "zh-CN": zhCN, en, pl, ru, ar };

/** 语言下拉显示名（各语言自称）。 */
export const localeNames: Record<Locale, string> = {
  "zh-CN": "中文",
  en: "English",
  pl: "Polski",
  ru: "Русский",
  ar: "العربية",
};

export const shellLocales: readonly Locale[] = ["zh-CN", "en", "pl", "ru", "ar"];

function readInitialLocale(): Locale {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (isLocale(raw)) return raw;
  } catch {
    // localStorage 不可用时用默认
  }
  return "zh-CN";
}

let current: Locale = readInitialLocale();
const listeners = new Set<() => void>();

export function getLocale(): Locale {
  return current;
}

export function setLocale(locale: Locale): void {
  if (locale === current) return;
  current = locale;
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // 持久化失败不阻断切换
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** React 侧读取当前壳层语言（切换即重渲染）。 */
export function useLocale(): Locale {
  return useSyncExternalStore(subscribe, getLocale);
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

/** 非 React 场景翻译。 */
export function tShell(locale: Locale, key: ShellKey, vars?: Record<string, string | number>): string {
  return interpolate(messages[locale][key], vars);
}

/** React hook：返回绑定当前语言的 t 函数。 */
export function useT(): (key: ShellKey, vars?: Record<string, string | number>) => string {
  const locale = useLocale();
  return (key, vars) => interpolate(messages[locale][key], vars);
}
