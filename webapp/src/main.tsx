import * as React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { App } from "@/App";
import { ThemeProvider } from "@/components/theme-provider";
import { UnauthorizedScreen } from "@/components/UnauthorizedScreen";
import { setToken, setUnauthorizedHandler } from "@/api/client";
import "@/index.css";

// design-browser-ui.md §6.1: 起動時に ?token= をパースしlocalStorageへ保存後、history.replaceStateで除去する
// (ブラウザ履歴・共有スクショにトークンを残さないため)。
function consumeTokenFromUrl(): void {
  const url = new URL(window.location.href);
  const token = url.searchParams.get("token");
  if (!token) return;
  setToken(token);
  url.searchParams.delete("token");
  window.history.replaceState({}, "", url.toString());
}

consumeTokenFromUrl();

const queryClient = new QueryClient();

function Root() {
  const [unauthorized, setUnauthorized] = React.useState(false);

  React.useEffect(() => {
    setUnauthorizedHandler(() => setUnauthorized(true));
  }, []);

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        {unauthorized ? <UnauthorizedScreen /> : <App />}
        <Toaster richColors position="bottom-right" />
      </QueryClientProvider>
    </ThemeProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
