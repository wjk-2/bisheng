import ReactDOM from "react-dom/client";
import App from "./App";
import ContextWrapper from "./contexts";
import reportWebVitals from "./reportWebVitals";
import './i18n';
import "./style/index.css";
import "./style/applies.css";
import "./style/classes.css";
import "./style/markdown.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import GlobalErrorBoundary from "./components/GlobalErrorBoundary";

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      retry: 0
    }
  }
})
root.render(
  <GlobalErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ContextWrapper>
        <App />
      </ContextWrapper>
    </QueryClientProvider>
  </GlobalErrorBoundary>
);
reportWebVitals();
