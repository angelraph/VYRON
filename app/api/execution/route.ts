import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { runExecutionEngine } from "@/lib/execution-engine";

const inputSchema = z.object({
  title: z.string().trim().min(6, "Describe your goal in a bit more detail.").max(200),
  budget: z.coerce.number().min(0).optional(),
});

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
