import { z } from "zod";

/** A syntactically valid EVM address — checks the `0x` + 40 hex chars
 * shape, not checksum casing. */
export const evmAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Not a valid wallet address.");
