// utils/profile.ts
import type { SupabaseClient } from "@supabase/supabase-js";

export const PHONE_REGEX = /^(\+234|0)?[789][01]\d{8}$/;

export type ProfileStatus = {
  /** true when the profile has every field SparkL requires */
  complete: boolean;
  onboardingCompleted: boolean;
};

/** Safe redirect target: internal paths only. */
export function safeNext(value: string | null | undefined, fallback = "/dashboard") {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}

export async function getProfileStatus(
  supabase: SupabaseClient,
  userId: string
): Promise<ProfileStatus> {
  const { data, error } = await supabase
    .from("profiles")
    .select("full_name, phone, onboarding_completed")
    .eq("id", userId)
    .maybeSingle();

  // If the query itself fails (missing column, RLS problem), don't lock
  // everybody out. Fix the cause instead of blocking users.
  if (error) return { complete: true, onboardingCompleted: false };

  // No profile row at all -> definitely incomplete.
  if (!data) return { complete: false, onboardingCompleted: false };

  const name = (data.full_name ?? "").trim();
  const hasName = name !== "" && name.toLowerCase() !== "unnamed";
  const hasPhone = (data.phone ?? "").trim() !== "";

  return {
    complete: hasName && hasPhone,
    onboardingCompleted: !!data.onboarding_completed,
  };
}
