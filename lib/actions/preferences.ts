"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { updateUserPreferences } from "@/lib/db";
import { evmAddressSchema } from "@/lib/validation";
import type { UserPreferences } from "@/lib/types";

const preferencesPatchSchema = z.object({
  budget: z.number().min(0).max(1_000_000).nullable().optional(),
  timezone: z.string().min(1).max(100).nullable().optional(),
  preferredStack: z.string().max(200).nullable().optional(),
  favoriteAgentIds: z.array(z.string().min(1).max(100)).max(50).optional(),
  walletAddress: evmAddressSchema.nullable().optional(),
});

export async function savePreferencesAction(
  patch: Partial<Omit<UserPreferences, "userId">>,
): Promise<UserPreferences> {
  const validated = preferencesPatchSchema.parse(patch);
  const user = await getCurrentUser();
  const updated = await updateUserPreferences(user.id, validated);
  revalidatePath("/dashboard/settings");
  return updated;
}
