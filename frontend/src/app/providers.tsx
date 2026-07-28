"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000, // data is "fresh" for 30s — no refetch on remount within this window
            gcTime: 5 * 60_000, // cache kept in memory for 5 min even if unused
            refetchOnWindowFocus: false, // stops refetch when switching browser tabs back
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
