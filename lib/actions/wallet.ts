"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { updateUserPreferences } from "@/lib/db";
import { evmAddressSchema } from "@/lib/validation";

const addressSchema = evmAddressSchema.nullable();

/** Called from the client whenever wagmi's connection state changes —
 * keeps the last-known wallet address on the user's profile in sync with
 * whatever's actually connected in the browser. */
export async function saveWalletAddressAction(address: string | null): Promise<void> {
  const validated = addressSchema.parse(address);
  const user = await getCurrentUser();
  await updateUserPreferences(user.id, { walletAddress: validated });
  revalidatePath("/dashboard/settings");
}
