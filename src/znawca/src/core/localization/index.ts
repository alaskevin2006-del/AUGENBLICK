export const supportedLocales = ["en", "pl", "zh-CN", "ar", "ru"] as const;
export type Locale = (typeof supportedLocales)[number];

export const isLocale = (value: unknown): value is Locale =>
  typeof value === "string" && supportedLocales.includes(value as Locale);

export const textDirection = (locale: Locale): "ltr" | "rtl" => locale === "ar" ? "rtl" : "ltr";

const en = {
  courses: "Courses", learning: "Learning", testing: "Testing", guidedDemo: "Guided demo",
  settings: "Settings", interfaceLanguage: "Interface language", close: "Close",
  chooseMaster: "Choose what to master", addCourse: "Add course or library", refreshLibrary: "Refresh library", sessionSetup: "Session setup",
  shapeSession: "Shape this session", mode: "Mode", questionTypes: "Question types",
  teachingStyle: "Teaching style", strict: "Strict", lenient: "Lenient", scopeFilters: "Scope and filters",
  timer: "Timer per question", begin: "Begin", yourAnswer: "Your answer", checkAnswer: "Check answer",
  nextQuestion: "Next question", sessionComplete: "Session complete", correct: "Correct",
  notQuite: "Not quite", correctAnswer: "Correct answer", mastered: "Mastered for now",
  correctAgain: "Correct once. Answer it correctly once more.", saveExit: "Save and exit",
  offline: "Offline", question: "Question", of: "of", objects: "objects",
  promptMedia: "Identify the object from this media.", promptForward: "Give the requested property.",
  promptReverse: "Identify the object from this property.", library: "Library", progress: "Progress",
  scoreHistory: "Score history", difficultItems: "Difficult items", previewMode: "Preview mode",
  privacy: "Your library stays private.",
  privacyDetail: "Courses, progress and scores remain on this Windows computer.",
  demoCourse: "Demo course", openCourse: "Open course", createCourse: "Create your course",
  createCourseDetail: "Add one XLSX file and object media folders.", resumeLearning: "Resume learning",
  unfinishedSession: "Unfinished learning session saved", courseNeedsAttention: "Course needs attention",
  courseWarnings: "Course opened with warnings", dismissWarning: "Dismiss", dismissedWarnings: "Dismissed",
  restoreDismissed: "Restore", showDetails: "Show details", hideDetails: "Hide details", masterEvery: "Master every question",
  eachOnce: "Each question once", textInput: "Text input", multipleChoice: "Multiple choice",
  nameToProperty: "Name to property", propertyToName: "Property to name", imageToName: "Image to name",
  nameToImage: "Name to image", audioToName: "Audio to name", nameToAudio: "Name to audio",
  videoToName: "Video to name", nameToVideo: "Name to video", strictHelp: "Incorrect answers similar to correct answers",
  lenientHelp: "Incorrect answers clearly different from correct answers", questions: "Questions", noFilters: "No filter fields.",
  availableQuestions: "available questions", degraded: "degraded to input", skipped: "skipped",
  off: "Off", difficultFirst: "Prioritize difficult content",
  difficultFirstHelp: "Increase its chance without excluding ordinary questions.",
  clearCourse: "Clear course data", clearAllDifficulty: "Clear all difficulty",
  clearConfirm: "Clear the selected local records?", emptyDifficulty: "No difficult content recorded.",
  difficultyWeight: "Weight", noHistory: "No test history yet.", points: "points",
  correctCount: "Correct", incorrectCount: "Incorrect", partialCount: "Partial",
  masteredCount: "mastered", flawless: "A flawless result.", progressWorth: "Progress worth keeping.",
  reviewAnswers: "Review answers", submittedAnswer: "Your answer", noAnswer: "No answer",
  selectMedia: "Select media option", identifyObject: "Identify this object",
  playNarration: "Play narration",
  unitsLabel: "units", unitsRemaining: "remaining",
  matchedAnswers: "Matched", extraAnswers: "Your incorrect answer was",
  inputAvailable: "input", choiceAvailable: "choice", unavailableReason: "Unavailable for this course or filter",
  skippedFieldsLabel: "Skipped identical fields", mediaUnavailable: "This media could not be played.",
  localData: "Local data", clearLearning: "Clear learning progress", clearTests: "Clear test history",
  clearAllData: "Clear all local data", dataCleared: "Local data cleared.", removeCourse: "Remove course",
  removeCourseConfirm: "Remove this course from Znawca? Files on disk will not be deleted.",
  courseLibrary: "Course library", file: "File", sheet: "Sheet", row: "Row", column: "Column",
  demoIntro: "Follow the real workflow without changing your scores or difficulty records.",
  demoLibrary: "Choose a course and review its local-only status.",
  demoValidation: "Import reports identify the exact file, sheet, row and column.",
  demoSetup: "Choose mode, question types, filters, difficulty priority and timer.",
  demoQuestion: "Try text and multimedia questions on the real session page.",
  demoFeedback: "Incorrect answers show the expected answer and return in Learning.",
  demoResume: "Learning sessions can be saved here and resumed later.",
  demoTesting: "Testing shows every selected question once with an optional countdown.",
  demoResults: "Review scores, answers and history.",
  back: "Back", next: "Next", finish: "Finish", mockLabel: "Guided mock — not recorded",
  noQuestionsAvailable: "No questions can be generated for this course.",
} as const;

export type MessageKey = keyof typeof en;
type Messages = Record<MessageKey, string>;

const pl: Messages = {
  courses:"Kursy",learning:"Nauka",testing:"Test",guidedDemo:"Samouczek",settings:"Ustawienia",interfaceLanguage:"Język interfejsu",close:"Zamknij",
  chooseMaster:"Wybierz materiał do opanowania",addCourse:"Dodaj kurs lub bibliotekę",refreshLibrary:"Odśwież bibliotekę",sessionSetup:"Ustawienia sesji",shapeSession:"Skonfiguruj sesję",mode:"Tryb",questionTypes:"Typy pytań",
  teachingStyle:"Styl nauczania",strict:"Wymagający",lenient:"Łagodny",scopeFilters:"Zakres i filtry",timer:"Czas na pytanie",begin:"Rozpocznij",yourAnswer:"Twoja odpowiedź",checkAnswer:"Sprawdź",
  nextQuestion:"Następne pytanie",sessionComplete:"Sesja zakończona",correct:"Poprawnie",notQuite:"Niezupełnie",correctAnswer:"Poprawna odpowiedź",mastered:"Opanowane",
  correctAgain:"Dobrze raz. Odpowiedz poprawnie jeszcze raz.",saveExit:"Zapisz i wyjdź",offline:"Offline",question:"Pytanie",of:"z",objects:"obiektów",
  promptMedia:"Rozpoznaj obiekt na podstawie medium.",promptForward:"Podaj wskazaną właściwość.",promptReverse:"Rozpoznaj obiekt na podstawie właściwości.",library:"Biblioteka",progress:"Postępy",
  scoreHistory:"Historia wyników",difficultItems:"Napotkane trudności",previewMode:"Tryb podglądu",privacy:"Twoja biblioteka jest prywatna.",
  privacyDetail:"Kursy, postępy i wyniki pozostają na tym komputerze.",demoCourse:"Kurs demonstracyjny",openCourse:"Otwórz kurs",createCourse:"Utwórz kurs",createCourseDetail:"Dodaj plik XLSX i foldery multimediów.",
  resumeLearning:"Wznów naukę",unfinishedSession:"Zapisana niedokończona sesja",courseNeedsAttention:"Kurs wymaga poprawy",courseWarnings:"Kurs otwarto z ostrzeżeniami",dismissWarning:"Zignoruj",dismissedWarnings:"Zignorowane",restoreDismissed:"Przywróć",showDetails:"Pokaż szczegóły",hideDetails:"Ukryj szczegóły",masterEvery:"Opanuj każde pytanie",
  eachOnce:"Każde pytanie jeden raz",textInput:"Wpisywanie tekstu",multipleChoice:"Wybór odpowiedzi",nameToProperty:"Nazwa → właściwość",propertyToName:"Właściwość → nazwa",imageToName:"Obraz → nazwa",
  nameToImage:"Nazwa → obraz",audioToName:"Dźwięk → nazwa",nameToAudio:"Nazwa → dźwięk",videoToName:"Wideo → nazwa",nameToVideo:"Nazwa → wideo",strictHelp:"Odpowiedzi nieprawidłowe podobne do prawidłowych",
  lenientHelp:"Silniejszy kontrast między odpowiedziami prawidłowymi i nieprawidłowymi",questions:"Pytania",noFilters:"Brak pól filtrowania.",availableQuestions:"dostępnych pytań",degraded:"zmieniono na wpisywanie",skipped:"pominięto",off:"Wył.",
  difficultFirst:"Priorytet dla trudnych treści",difficultFirstHelp:"Zwiększa szansę bez wykluczania zwykłych pytań.",clearCourse:"Wyczyść dane kursu",clearAllDifficulty:"Wyczyść wszystkie trudności",
  clearConfirm:"Wyczyścić wybrane dane lokalne?",emptyDifficulty:"Brak zapisanych trudnych treści.",difficultyWeight:"Waga",noHistory:"Brak historii testów.",points:"punkty",correctCount:"Poprawne",
  incorrectCount:"Błędne",partialCount:"Częściowe",masteredCount:"opanowano",flawless:"Wynik bezbłędny.",progressWorth:"Postęp wart zachowania.",reviewAnswers:"Przejrzyj odpowiedzi",
  submittedAnswer:"Twoja odpowiedź",noAnswer:"Brak odpowiedzi",selectMedia:"Wybierz opcję multimedialną",identifyObject:"Rozpoznaj ten obiekt",playNarration:"Odtwórz nagranie",unitsLabel:"jednostek",unitsRemaining:"pozostało",courseLibrary:"Biblioteka kursów",file:"Plik",sheet:"Arkusz",row:"Wiersz",column:"Kolumna",
  matchedAnswers:"Trafione",extraAnswers:"Twoja błędna odpowiedź",inputAvailable:"wpisywanie",choiceAvailable:"wybór",unavailableReason:"Niedostępne dla tego kursu lub filtra",skippedFieldsLabel:"Pominięte identyczne pola",mediaUnavailable:"Nie można odtworzyć tego medium.",localData:"Dane lokalne",clearLearning:"Wyczyść postępy nauki",clearTests:"Wyczyść historię testów",clearAllData:"Wyczyść wszystkie dane lokalne",dataCleared:"Dane lokalne wyczyszczono.",removeCourse:"Usuń kurs",removeCourseConfirm:"Usunąć ten kurs ze Znawca? Pliki na dysku nie zostaną usunięte.",
  demoIntro:"Przejdź prawdziwy proces bez zmiany wyników i trudności.",demoLibrary:"Wybierz kurs i sprawdź lokalny charakter danych.",demoValidation:"Raport importu wskazuje plik, arkusz, wiersz i kolumnę.",
  demoSetup:"Wybierz tryb, pytania, filtry, trudne treści i czas.",demoQuestion:"Wypróbuj pytania tekstowe i multimedialne.",demoFeedback:"Błędna odpowiedź pokazuje poprawną i wraca w trybie nauki.",
  demoResume:"Sesję nauki można zapisać i wznowić.",demoTesting:"Test pokazuje każde pytanie raz i może mieć odliczanie.",  demoResults:"Przejrzyj wynik, odpowiedzi i historię.",back:"Wstecz",next:"Dalej",finish:"Zakończ",mockLabel:"Demo — bez zapisu",
  noQuestionsAvailable:"Nie można wygenerować pytań dla tego kursu.",
};

const zh: Messages = {
  courses:"课程",learning:"学习",testing:"测试",guidedDemo:"新手演示",settings:"设置",interfaceLanguage:"界面语言",close:"关闭",chooseMaster:"选择要掌握的内容",addCourse:"添加课程或课程库",refreshLibrary:"刷新课程库",
  sessionSetup:"会话设置",shapeSession:"设置本次会话",mode:"模式",questionTypes:"题型",teachingStyle:"教学方式",strict:"严格",lenient:"宽松",scopeFilters:"范围和筛选",timer:"每题计时",
  begin:"开始",yourAnswer:"你的答案",checkAnswer:"检查答案",nextQuestion:"下一题",sessionComplete:"会话完成",correct:"正确",notQuite:"还不对",correctAnswer:"正确答案",mastered:"本题已掌握",
  correctAgain:"已正确一次，请再连续答对一次。",saveExit:"保存并退出",offline:"离线",question:"第",of:"题，共",objects:"个对象",promptMedia:"根据媒体识别对象。",promptForward:"填写要求的属性。",
  promptReverse:"根据属性识别对象。",library:"课程库",progress:"学习记录",scoreHistory:"成绩历史",difficultItems:"困难内容",previewMode:"预览模式",
  privacy:"你的课程库保持私密。",privacyDetail:"课程、进度和成绩仅保存在这台 Windows 电脑上。",demoCourse:"演示课程",openCourse:"打开课程",createCourse:"创建课程",
  createCourseDetail:"添加一个 XLSX 文件和对象媒体目录。",resumeLearning:"继续学习",unfinishedSession:"未完成会话保存于",courseNeedsAttention:"课程需要修正",courseWarnings:"课程已打开，但存在警告",dismissWarning:"忽略",dismissedWarnings:"已忽略",restoreDismissed:"恢复",showDetails:"展开",hideDetails:"收起",
  masterEvery:"掌握每一道题",eachOnce:"每题仅出现一次",textInput:"文字输入",multipleChoice:"选择题",nameToProperty:"名称 → 属性",propertyToName:"属性 → 名称",imageToName:"图片 → 名称",
  nameToImage:"名称 → 图片",audioToName:"音频 → 名称",nameToAudio:"名称 → 音频",videoToName:"视频 → 名称",nameToVideo:"名称 → 视频",strictHelp:"干扰项来自当前筛选范围",
  lenientHelp:"干扰项来自整门课程",questions:"题量",noFilters:"没有可筛选字段。",availableQuestions:"道可用题",degraded:"道已降级为输入题",skipped:"道已跳过",off:"关闭",
  difficultFirst:"困难内容优先",difficultFirstHelp:"提高困难内容出现概率，但不会排除普通题。",clearCourse:"清除此课程数据",clearAllDifficulty:"清空全部困难记录",clearConfirm:"确定清除所选本地记录吗？",
  emptyDifficulty:"暂无困难内容记录。",difficultyWeight:"权重",noHistory:"暂无测试历史。",points:"分",correctCount:"正确",incorrectCount:"错误",partialCount:"部分正确",
  masteredCount:"道已掌握",flawless:"完美成绩。",progressWorth:"进步值得保留。",reviewAnswers:"查看答案",submittedAnswer:"你的答案",noAnswer:"未作答",selectMedia:"选择媒体选项",playNarration:"播放朗读",unitsLabel:"个单元",unitsRemaining:"剩余",
  identifyObject:"识别这个对象",courseLibrary:"课程库",file:"文件",sheet:"工作表",row:"行",column:"列",demoIntro:"在不写入成绩和困难记录的情况下体验真实流程。",
  matchedAnswers:"已匹配",extraAnswers:"多答",inputAvailable:"输入题",choiceAvailable:"选择题",unavailableReason:"当前课程或筛选条件下不可用",skippedFieldsLabel:"已跳过答案相同的字段",mediaUnavailable:"此媒体无法播放。",localData:"本地数据",clearLearning:"清除学习进度",clearTests:"清除测试历史",clearAllData:"清除全部本地数据",dataCleared:"本地数据已清除。",removeCourse:"删除课程",removeCourseConfirm:"从 Znawca 中删除此课程吗？磁盘上的课程文件不会被删除。",
  demoLibrary:"选择课程，并确认所有数据只保存在本机。",demoValidation:"导入报告会精确指出文件、工作表、行和列。",demoSetup:"选择模式、题型、筛选、困难优先和计时。",
  demoQuestion:"在真实答题页面体验文字和多媒体题。",demoFeedback:"答错会显示正确答案，并在学习模式重新出现。",demoResume:"学习会话可以保存，之后继续。",
  demoTesting:"测试中每道题只出现一次，并可启用倒计时。",demoResults:"查看成绩、答案和历史。",back:"上一步",next:"下一步",finish:"完成",mockLabel:"引导演示，不计入记录",
  noQuestionsAvailable:"本课程暂无可出题目",
};

const ar: Messages = {
  courses:"الدورات",learning:"التعلم",testing:"الاختبار",guidedDemo:"الجولة الإرشادية",settings:"الإعدادات",interfaceLanguage:"لغة الواجهة",close:"إغلاق",chooseMaster:"اختر ما تريد إتقانه",addCourse:"إضافة دورة أو مكتبة دورات",refreshLibrary:"تحديث المكتبة",
  sessionSetup:"إعداد الجلسة",shapeSession:"إعداد هذه الجلسة",mode:"الوضع",questionTypes:"أنواع الأسئلة",teachingStyle:"أسلوب التعلم",strict:"صارم",lenient:"مرن",scopeFilters:"النطاق والمرشحات",
  timer:"وقت كل سؤال",begin:"ابدأ",yourAnswer:"إجابتك",checkAnswer:"تحقق من الإجابة",nextQuestion:"السؤال التالي",sessionComplete:"اكتملت الجلسة",correct:"صحيح",notQuite:"ليس تمامًا",
  correctAnswer:"الإجابة الصحيحة",mastered:"تم إتقانه",correctAgain:"إجابة صحيحة مرة. أجب بشكل صحيح مرة أخرى.",saveExit:"حفظ وخروج",offline:"دون اتصال",question:"السؤال",of:"من",objects:"عناصر",
  promptMedia:"تعرّف على العنصر من الوسائط.",promptForward:"اذكر الخاصية المطلوبة.",promptReverse:"تعرّف على العنصر من الخاصية.",library:"المكتبة",progress:"التقدم",scoreHistory:"سجل النتائج",
  difficultItems:"العناصر الصعبة",previewMode:"وضع المعاينة",privacy:"مكتبتك خاصة.",privacyDetail:"تبقى الدورات والتقدم والنتائج على هذا الكمبيوتر.",
  demoCourse:"دورة تجريبية",openCourse:"فتح الدورة",createCourse:"إنشاء دورة",createCourseDetail:"أضف ملف XLSX ومجلدات الوسائط.",resumeLearning:"متابعة التعلم",unfinishedSession:"تم حفظ جلسة غير مكتملة",
  courseNeedsAttention:"تحتاج الدورة إلى تصحيح",courseWarnings:"فُتحت الدورة مع تحذيرات",dismissWarning:"تجاهل",dismissedWarnings:"تم تجاهلها",restoreDismissed:"استعادة",showDetails:"إظهار التفاصيل",hideDetails:"إخفاء التفاصيل",masterEvery:"إتقان كل سؤال",eachOnce:"كل سؤال مرة واحدة",textInput:"إدخال نص",multipleChoice:"اختيار متعدد",
  nameToProperty:"الاسم ← الخاصية",propertyToName:"الخاصية ← الاسم",imageToName:"الصورة ← الاسم",nameToImage:"الاسم ← الصورة",audioToName:"الصوت ← الاسم",nameToAudio:"الاسم ← الصوت",
  videoToName:"الفيديو ← الاسم",nameToVideo:"الاسم ← الفيديو",strictHelp:"خيارات من النطاق المصفّى",lenientHelp:"خيارات من الدورة كاملة",questions:"عدد الأسئلة",noFilters:"لا توجد حقول تصفية.",
  availableQuestions:"سؤالًا متاحًا",degraded:"حُوّل إلى إدخال",skipped:"تم تخطيه",off:"إيقاف",difficultFirst:"أولوية للمحتوى الصعب",difficultFirstHelp:"يزيد الاحتمال دون استبعاد الأسئلة العادية.",
  clearCourse:"مسح بيانات الدورة",clearAllDifficulty:"مسح كل الصعوبات",clearConfirm:"هل تريد مسح السجلات المحلية المحددة؟",emptyDifficulty:"لا يوجد محتوى صعب مسجل.",difficultyWeight:"الوزن",
  noHistory:"لا يوجد سجل اختبارات بعد.",points:"نقاط",correctCount:"صحيح",incorrectCount:"خطأ",partialCount:"جزئي",masteredCount:"تم إتقانه",flawless:"نتيجة كاملة.",progressWorth:"تقدم يستحق الحفظ.",
  reviewAnswers:"مراجعة الإجابات",submittedAnswer:"إجابتك",noAnswer:"لا إجابة",selectMedia:"اختر خيار وسائط",identifyObject:"تعرّف على هذا العنصر",playNarration:"تشغيل القراءة",unitsLabel:"وحدة",unitsRemaining:"متبقٍ",courseLibrary:"مكتبة الدورات",
  matchedAnswers:"المطابق",extraAnswers:"الزائد",inputAvailable:"إدخال",choiceAvailable:"اختيار",unavailableReason:"غير متاح لهذه الدورة أو التصفية",skippedFieldsLabel:"حقول متطابقة تم تخطيها",mediaUnavailable:"تعذر تشغيل هذا الوسيط.",localData:"البيانات المحلية",clearLearning:"مسح تقدم التعلم",clearTests:"مسح سجل الاختبارات",clearAllData:"مسح كل البيانات المحلية",dataCleared:"تم مسح البيانات المحلية.",removeCourse:"إزالة الدورة",removeCourseConfirm:"إزالة هذه الدورة من Znawca؟ لن تُحذف الملفات الموجودة على القرص.",
  file:"الملف",sheet:"ورقة العمل",row:"الصف",column:"العمود",demoIntro:"اتبع سير العمل الحقيقي دون تغيير النتائج أو سجلات الصعوبة.",demoLibrary:"اختر دورة وتحقق من بقاء البيانات محلية.",
  demoValidation:"يحدد تقرير الاستيراد الملف والورقة والصف والعمود.",demoSetup:"اختر الوضع والأسئلة والمرشحات والأولوية والمؤقت.",demoQuestion:"جرّب أسئلة النص والوسائط في صفحة الجلسة.",
  demoFeedback:"تُظهر الإجابة الخاطئة الحل وتعود في وضع التعلم.",demoResume:"يمكن حفظ جلسة التعلم ومتابعتها لاحقًا.",demoTesting:"يعرض الاختبار كل سؤال مرة واحدة مع مؤقت اختياري.",
  demoResults:"راجع النتيجة والإجابات والسجل.",back:"السابق",next:"التالي",finish:"إنهاء",mockLabel:"عرض إرشادي — لا يتم تسجيله",
  noQuestionsAvailable:"لا يمكن توليد أسئلة لهذه الدورة.",
};

const ru: Messages = {
  courses:"Курсы",learning:"Обучение",testing:"Тестирование",guidedDemo:"Обучающий тур",settings:"Настройки",interfaceLanguage:"Язык интерфейса",close:"Закрыть",chooseMaster:"Выберите материал",addCourse:"Добавить курс или библиотеку",refreshLibrary:"Обновить библиотеку",
  sessionSetup:"Настройка занятия",shapeSession:"Настройте занятие",mode:"Режим",questionTypes:"Типы вопросов",teachingStyle:"Стиль обучения",strict:"Строгий",lenient:"Свободный",scopeFilters:"Область и фильтры",
  timer:"Время на вопрос",begin:"Начать",yourAnswer:"Ваш ответ",checkAnswer:"Проверить",nextQuestion:"Следующий вопрос",sessionComplete:"Занятие завершено",correct:"Верно",notQuite:"Не совсем",
  correctAnswer:"Правильный ответ",mastered:"Освоено",correctAgain:"Один верный ответ. Ответьте верно ещё раз.",saveExit:"Сохранить и выйти",offline:"Офлайн",question:"Вопрос",of:"из",objects:"объектов",
  promptMedia:"Определите объект по медиа.",promptForward:"Укажите требуемое свойство.",promptReverse:"Определите объект по свойству.",library:"Библиотека",progress:"Прогресс",scoreHistory:"История результатов",
  difficultItems:"Трудные элементы",previewMode:"Режим просмотра",privacy:"Ваша библиотека остаётся приватной.",privacyDetail:"Курсы, прогресс и результаты хранятся на этом компьютере.",
  demoCourse:"Демо-курс",openCourse:"Открыть курс",createCourse:"Создать курс",createCourseDetail:"Добавьте XLSX и папки с медиа.",resumeLearning:"Продолжить обучение",unfinishedSession:"Сохранено незавершённое занятие",
  courseNeedsAttention:"Курс требует исправления",courseWarnings:"Курс открыт с предупреждениями",dismissWarning:"Игнорировать",dismissedWarnings:"Игнорируемые",restoreDismissed:"Восстановить",showDetails:"Показать подробности",hideDetails:"Скрыть подробности",masterEvery:"Освоить каждый вопрос",eachOnce:"Каждый вопрос один раз",textInput:"Ввод текста",multipleChoice:"Выбор ответа",
  nameToProperty:"Название → свойство",propertyToName:"Свойство → название",imageToName:"Изображение → название",nameToImage:"Название → изображение",audioToName:"Аудио → название",nameToAudio:"Название → аудио",
  videoToName:"Видео → название",nameToVideo:"Название → видео",strictHelp:"Варианты из текущего фильтра",lenientHelp:"Варианты из всего курса",questions:"Количество вопросов",noFilters:"Нет полей фильтрации.",
  availableQuestions:"доступных вопросов",degraded:"переведено во ввод",skipped:"пропущено",off:"Выкл.",difficultFirst:"Приоритет трудного материала",difficultFirstHelp:"Повышает вероятность, не исключая обычные вопросы.",
  clearCourse:"Очистить данные курса",clearAllDifficulty:"Очистить все трудности",clearConfirm:"Очистить выбранные локальные записи?",emptyDifficulty:"Трудных элементов пока нет.",difficultyWeight:"Вес",
  noHistory:"Истории тестов пока нет.",points:"баллов",correctCount:"Верно",incorrectCount:"Неверно",partialCount:"Частично",masteredCount:"освоено",flawless:"Безупречный результат.",progressWorth:"Прогресс стоит сохранить.",
  reviewAnswers:"Просмотреть ответы",submittedAnswer:"Ваш ответ",noAnswer:"Нет ответа",selectMedia:"Выберите медиа",identifyObject:"Определите этот объект",playNarration:"Воспроизвести озвучивание",unitsLabel:"единиц",unitsRemaining:"осталось",courseLibrary:"Библиотека курсов",
  matchedAnswers:"Совпало",extraAnswers:"Лишнее",inputAvailable:"ввод",choiceAvailable:"выбор",unavailableReason:"Недоступно для этого курса или фильтра",skippedFieldsLabel:"Пропущены одинаковые поля",mediaUnavailable:"Не удалось воспроизвести медиа.",localData:"Локальные данные",clearLearning:"Очистить прогресс обучения",clearTests:"Очистить историю тестов",clearAllData:"Очистить все локальные данные",dataCleared:"Локальные данные очищены.",removeCourse:"Удалить курс",removeCourseConfirm:"Удалить этот курс из Znawca? Файлы на диске удалены не будут.",
  file:"Файл",sheet:"Лист",row:"Строка",column:"Столбец",demoIntro:"Пройдите реальный процесс без изменения результатов и трудностей.",demoLibrary:"Выберите курс и проверьте локальное хранение данных.",
  demoValidation:"Отчёт импорта указывает файл, лист, строку и столбец.",demoSetup:"Выберите режим, вопросы, фильтры, приоритет и таймер.",demoQuestion:"Попробуйте текстовые и мультимедийные вопросы.",
  demoFeedback:"Ошибка показывает ответ и возвращает вопрос в обучении.",demoResume:"Занятие можно сохранить и продолжить позже.",demoTesting:"В тесте каждый вопрос показывается один раз; доступен таймер.",
  demoResults:"Просмотрите баллы, ответы и историю.",back:"Назад",next:"Далее",finish:"Завершить",mockLabel:"Учебный пример — не записывается",
  noQuestionsAvailable:"Для этого курса невозможно сформировать вопросы.",
};

const messages: Record<Locale, Messages> = { en, pl, "zh-CN": zh, ar, ru };

export const translate = (locale: Locale, key: MessageKey): string => messages[locale][key];

// ITEM_NAME_EMPTY 导入报错的本地化文案（row=行号，columns=该行有内容的列字母数组）。
// core 层只生成英文 fallback + 结构化参数，UI 层按界面语言渲染对应文案。
const itemNameEmptyCopy: Record<Locale, {
  readonly message: (row: number) => string;
  readonly suggestion: (row: number, columns: readonly string[]) => string;
}> = {
  en: {
    message: (row) => `Row ${row}, column A (item name) is empty.`,
    suggestion: (row, columns) => columns.length > 0
      ? `Column ${columns.join(", ")} has content, but column A is empty. Fill column A in row ${row} or delete this row.`
      : `Fill column A in row ${row} or delete this row.`,
  },
  pl: {
    message: (row) => `Wiersz ${row}, kolumna A (nazwa pozycji) jest pusta.`,
    suggestion: (row, columns) => columns.length > 0
      ? `Kolumna ${columns.join(", ")} ma treść, ale kolumna A jest pusta. Uzupełnij kolumnę A w wierszu ${row} lub usuń ten wiersz.`
      : `Uzupełnij kolumnę A w wierszu ${row} lub usuń ten wiersz.`,
  },
  "zh-CN": {
    message: (row) => `第 ${row} 行 A 列（条目名）为空。`,
    suggestion: (row, columns) => columns.length > 0
      ? `第 ${columns.join("、")} 列有内容，但 A 列为空。请填写第 ${row} 行 A 列，或删除该行。`
      : `请填写第 ${row} 行 A 列，或删除该行。`,
  },
  ar: {
    message: (row) => `الصف ${row}، العمود A (اسم العنصر) فارغ.`,
    suggestion: (row, columns) => columns.length > 0
      ? `العمود ${columns.join("، ")} يحتوي على محتوى، لكن العمود A فارغ. املأ العمود A في الصف ${row} أو احذف هذا الصف.`
      : `املأ العمود A في الصف ${row} أو احذف هذا الصف.`,
  },
  ru: {
    message: (row) => `Строка ${row}, столбец A (название элемента) пуст.`,
    suggestion: (row, columns) => columns.length > 0
      ? `Столбец ${columns.join(", ")} содержит данные, но столбец A пуст. Заполните столбец A в строке ${row} или удалите эту строку.`
      : `Заполните столбец A в строке ${row} или удалите эту строку.`,
  },
};

export const formatItemNameEmpty = (
  locale: Locale,
  row: number,
  filledColumns: readonly string[],
): { readonly message: string; readonly suggestion: string } => {
  const copy = itemNameEmptyCopy[locale] ?? itemNameEmptyCopy.en;
  return { message: copy.message(row), suggestion: copy.suggestion(row, filledColumns) };
};
