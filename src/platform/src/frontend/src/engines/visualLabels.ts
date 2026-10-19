const words = {
  en: {choose:"Choose", classify:"Classify the object", reference:"Reference", all:"All", yes:"Yes", no:"No", target:"Found", keyboard:"Arrow keys move the cursor; Enter selects. Shift moves faster.", select:"Select point", axes:"Attributes", features:"Features"},
  zh: {choose:"请选择", classify:"判断图中对象的属性", reference:"图鉴", all:"全部", yes:"是", no:"否", target:"已找到", keyboard:"方向键移动光标，回车选择；按住 Shift 可加快移动。", select:"选择位置", axes:"属性", features:"特征"},
  pl: {choose:"Wybierz", classify:"Sklasyfikuj obiekt", reference:"Atlas", all:"Wszystkie", yes:"Tak", no:"Nie", target:"Znaleziono", keyboard:"Strzałki przesuwają kursor; Enter wybiera. Shift przyspiesza.", select:"Wybierz punkt", axes:"Cechy", features:"Opis"},
  ru: {choose:"Выберите", classify:"Определите свойства объекта", reference:"Атлас", all:"Все", yes:"Да", no:"Нет", target:"Найдено", keyboard:"Стрелки перемещают курсор; Enter выбирает. Shift ускоряет.", select:"Выбрать точку", axes:"Свойства", features:"Описание"},
  ar: {choose:"اختر", classify:"صنّف العنصر", reference:"الأطلس", all:"الكل", yes:"نعم", no:"لا", target:"تم العثور", keyboard:"حرّك المؤشر بالأسهم واختر بمفتاح Enter. اضغط Shift للتحرك أسرع.", select:"اختر نقطة", axes:"الخصائص", features:"السمات"},
};
export function visualLabels(locale:string) { return words[locale.split('-')[0] as keyof typeof words] || words.en; }
export interface VisualQuestionProps {
  question:{id?:string;kind:string;prompt:string;interaction:any};
  answer:string;onChange:(value:string)=>void;disabled:boolean;locale:string;
  onCommit?:(value:string)=>void;feedback?:any;
}
