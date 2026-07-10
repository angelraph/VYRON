import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { runExecutionEngine } from "@/lib/execution-engine";
import { checkRateLimit } from "@/lib/rate-limit";

const inputSchema = z.object({
  title: z.string().trim().min(6, "Describe your goal in a bit more detail.").max(200),
  budget: z.coerce.number().min(0).optional(),
});

/** Goal creation fans out into several real LLM calls (interpretation, then
 * per-task execution/verification as the monitor picks it up) — cheap to
 * spam, expensive to serve. 5 goals/minute per user is generous for real
 * usage but bounds worst-case cost from a scripted client. */
const EXECUTION_RATE_LIMIT = { max: 5, windowMs: 60_000 };

/** Streams VEE pipeline events to the client as newline-delimited JSON, in
 * real time, as each stage actually completes — no client-side timers. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = inputSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  const user = await getCurrentUser();

  const rateLimit = checkRateLimit(`execution:${user.id}`, EXECUTION_RATE_LIMIT);
  if (!rateLimit.allowed) {
    return Response.json(
      { error: "Too many goals submitted — please wait a moment before trying again." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(rateLimit.retryAfterMs / 1000)) },
      },
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of runExecutionEngine({
          userId: user.id,
          title: parsed.data.title,
          budget: parsed.data.budget,
        })) {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        }
      } catch (error) {
        controller.enqueue(
          encoder.encode(
            `${JSON.stringify({
              stage: "error",
              message:
                error instanceof Error ? error.message : "Execution failed.",
              done: true,
            })}\n`,
          ),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-store",
    },
  });
}
