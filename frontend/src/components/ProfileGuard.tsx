// components/ProfileGuard.tsx
"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { getProfileStatus } from "@/utils/profile";

/**
 * Wrap your dashboard layout's children with this.
 * Anyone who is logged in but has an incomplete profile (for example, the
 * existing "Unnamed" accounts) is sent to the completion form.
 */
export default function ProfileGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Not logged in: let your existing auth protection handle it.
      if (!user) {
        if (!cancelled) setReady(true);
        return;
      }

      const status = await getProfileStatus(supabase, user.id);
      if (cancelled) return;

      if (!status.complete) {
        router.replace(
          `/auth/complete-profile?next=${encodeURIComponent(pathname || "/dashboard")}`
        );
        return;
      }

      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
    // Only check once per mount of the dashboard shell.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ready) return null;
  return <>{children}</>;
}
