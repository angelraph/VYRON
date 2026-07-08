"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { updateUserPreferences } from "@/lib/db";
import type { UserPreferences } from "@/lib/types";

export async function savePreferencesAction(
  patch: Partial<Omit<UserPreferences, "userId">>,
): Promise<UserPreferences> {
  const user = await getCurrentUser();
  const updated = await updateUserPreferences(user.id, patch);
  revalidatePath("/dashboard/settings");
  return updated;
}
