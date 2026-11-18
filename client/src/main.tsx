import { trpc } from "@/lib/trpc";
import { supabase } from "@/lib/supabase";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import { createApiFetch } from "@/lib/api-fetch";
import App from "./App";
import "./index.css";

const analyticsEndpoint = import.meta.env.VITE_ANALYTICS_ENDPOINT?.trim();
const analyticsWebsiteId = import.meta.env.VITE_ANALYTICS_WEBSITE_ID?.trim();
if (analyticsEndpoint && analyticsWebsiteId) {
  try {
    const endpoint = new URL(analyticsEndpoint);
    if (endpoint.protocol === "https:" || endpoint.protocol === "http:") {
      const script = document.createElement("script");
      script.defer = true;
      script.src = `${endpoint.toString().replace(/\/+$/, "")}/umami`;
      script.setAttribute("data-website-id", analyticsWebsiteId);
      document.head.appendChild(script);
    }
  } catch {
    console.warn("TrafficFlow analytics disabled: VITE_ANALYTICS_ENDPOINT is not a valid URL.");
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
    mutations: { retry: 0 },
  },
});

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") console.error("[API Query Error]", event.query.state.error);
});
queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") console.error("[API Mutation Error]", event.mutation.state.error);
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      async headers() {
        const { data } = await supabase.auth.getSession();
        return data.session?.access_token
          ? { Authorization: `Bearer ${data.session.access_token}` }
          : {};
      },
      fetch: createApiFetch((input, init) => globalThis.fetch(input, { ...(init ?? {}), credentials: "include" })),
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>,
);
