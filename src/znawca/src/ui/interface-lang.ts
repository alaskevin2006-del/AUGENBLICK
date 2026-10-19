import { createContext, useContext } from "react";
import { translate, textDirection, type Locale, type MessageKey } from "../core/localization";

// 引擎 UI 界面语言（契约§十）：由宿主经 ZnawcaActivityProps.interfaceLang 注入，
// ui 组件一律走 useInterfaceT()/useInterfaceLang()，不再硬编码语言。

export const InterfaceLangContext = createContext<Locale>("zh-CN");

/** 当前界面语言的翻译函数。 */
export function useInterfaceT(): (key: MessageKey) => string {
  const locale = useContext(InterfaceLangContext);
  return (key) => translate(locale, key);
}

/** 当前界面语言（用于 dir 等）。 */
export function useInterfaceLang(): Locale {
  return useContext(InterfaceLangContext);
}

export { textDirection };
