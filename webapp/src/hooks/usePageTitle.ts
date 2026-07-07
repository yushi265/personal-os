import * as React from "react";

const BASE_TITLE = "Personal OS";

/** ルートごとにdocument.titleを更新する(WCAG 2.4.2)。SPAのため画面遷移でタイトルが変わらない問題への対応 */
export function usePageTitle(title: string | undefined) {
  React.useEffect(() => {
    document.title = title ? `${title} — ${BASE_TITLE}` : BASE_TITLE;
    return () => {
      document.title = BASE_TITLE;
    };
  }, [title]);
}
