"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function VerifyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Verifying your payment...");

  useEffect(() => {
    async function verify() {
      const reference = searchParams.get("reference");
      const ourReference = sessionStorage.getItem("pv_reference");
      const accessToken = sessionStorage.getItem("pv_access_token");
      const plan = sessionStorage.getItem("pv_plan");

      if (!reference || !accessToken) {
        router.push("/dashboard/subscribe?error=missing_data");
        return;
      }

      try {
        const res = await fetch("/api/payments/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reference,
            our_reference: ourReference ?? reference,
            access_token: accessToken,
          }),
        });

        if (res.ok) {
          sessionStorage.removeItem("pv_reference");
          sessionStorage.removeItem("pv_plan");
          sessionStorage.removeItem("pv_access_token");
          router.push("/dashboard/subscribe?subscribed=true");
        } else {
          const err = await res.json();
          setMessage(err.detail ?? "Verification failed. Please contact support.");
          setTimeout(() => router.push("/dashboard/subscribe"), 3000);
        }
      } catch {
        setMessage("Network error. Please contact support.");
        setTimeout(() => router.push("/dashboard/subscribe"), 3000);
      }
    }

    verify();
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#07091A]">
      <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
      <p className="text-sm text-slate-400">{message}</p>
    </div>
  );
}