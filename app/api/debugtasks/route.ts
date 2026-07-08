import { NextResponse } from "next/server";
import { getWorkflowTasksByGoal } from "@/lib/db";

export async function GET(request: Request) {
  const goalId = new URL(request.url).searchParams.get("goalId") ?? "goal-launch-nft";
  const tasks = await getWorkflowTasksByGoal(goalId);
  return NextResponse.json({ tasks });
}
