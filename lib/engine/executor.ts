import "server-only";
import { EventEmitter } from "node:events";
import { formatDeliveryMessage } from "@/lib/engine/delivery-format";
import { matchAgentForTask } from "@/lib/engine/matcher";
import * as memory from "@/lib/engine/memory";
import { advanceWorkflow, isWorkflowComplete } from "@/lib/engine/workflow";
import { logger } from "@/lib/logger";
import type { Agent, WorkflowTask } from "@/lib/types";
import {
  taskDeliverableSchema,
  taskVerificationSchema,
  type ExecutionEvent,
  type TaskDeliverable,
  type TaskVerification,
} from "@/lib/engine/types";

const MODEL_NAME = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

/** Consecutive execution failures tolerated (same agent) before self-heal
 * reassignment kicks in. Process-local — a restart mid-run simply resets
 * the count, which just means one more genuine retry, not a correctness
 * issue. */
const MAX_EXECUTION_ATTEMPTS = 2;
/** Rejected-verification regenerations tolerated (same agent) before
 * self-heal reassignment kicks in. */
const MAX_REGEN_ATTEMPTS = 2;

const DEFAULT_TICK_INTERVAL_MS = 4000;
const EVENT_CHANNEL = "event";

// ---------------------------------------------------------------------------
// Real model calls — the actual work. No mock timers, no fallback: a thrown
// error here is a genuine execution/verification failure, handled by the
// engine's retry/reassign/dispute logic below exactly like a real worker
// failing would be.
// ---------------------------------------------------------------------------

/** Only `title`/`description`/`specialization` are ever read from `task`, and
 * only `name`/`tagline`/`bio` from `agent` — narrowed (rather than the full
 * `WorkflowTask`/`Agent`) so ad-hoc, non-DB-backed fulfillment (e.g. an
 * external ASP order) can reuse this without fabricating fake DB rows. Every
 * real internal call site already passes a full `WorkflowTask`/`Agent`,
 * which satisfies this structurally — no behavior change there. */
interface ExecuteContext {
  goalTitle: string;
  task: Pick<WorkflowTask, "title" | "description" | "specialization">;
  agent: Pick<Agent, "name" | "tagline" | "bio">;
  dependencyOutputs: { taskTitle: string; deliverable: string }[];
  revisionFeedback?: string;
}

async function executeTaskWithModel(ctx: ExecuteContext): Promise<TaskDeliverable> {
  const { openai } = await import("@ai-sdk/openai");
  const { generateText, Output } = await import("ai");

  const contextBlock = ctx.dependencyOutputs.length
    ? ctx.dependencyOutputs
        .map((dep) => `Output already delivered for "${dep.taskTitle}":\n${dep.deliverable}`)
        .join("\n\n")
    : "This is a kickoff task with no prior task outputs to build on.";

  const revisionBlock = ctx.revisionFeedback
    ? `A previous attempt at this task was sent back during review with this feedback: "${ctx.revisionFeedback}". Address it directly this time.`
    : "";

  const { output } = await generateText({
    model: openai(MODEL_NAME),
    output: Output.object({ schema: taskDeliverableSchema }),
    prompt: [
      `You are ${ctx.agent.name}, an AI agent in an autonomous work marketplace.`,
      `Your persona: ${ctx.agent.tagline} — ${ctx.agent.bio}`,
      `You were assigned this task as part of the goal: "${ctx.goalTitle}".`,
      `Task: "${ctx.task.title}" — ${ctx.task.description}`,
      `Specialization: ${ctx.task.specialization}.`,
      contextBlock,
      revisionBlock,
      `Produce the actual deliverable content for this task — the real work`,
      `product this task calls for (concrete research findings, a design`,
      `brief, real copy, a real plan — whatever fits), not a description of`,
      `what you intend to do. Return a one-sentence "summary" of what you`,
      `delivered and the full "deliverable" text (aim for 150-350 words).`,
    ]
      .filter(Boolean)
      .join(" "),
  });

  return output;
}

interface VerifyContext {
  goalTitle: string;
  task: Pick<WorkflowTask, "title" | "description">;
  deliverable: string;
}

async function verifyTaskWithModel(ctx: VerifyContext): Promise<TaskVerification> {
  const { openai } = await import("@ai-sdk/openai");
  const { generateText, Output } = await import("ai");

  const { output } = await generateText({
    model: openai(MODEL_NAME),
    output: Output.object({ schema: taskVerificationSchema }),
    prompt: [
      `You are an independent quality reviewer for an autonomous agent marketplace.`,
      `Goal: "${ctx.goalTitle}".`,
      `Task: "${ctx.task.title}" — ${ctx.task.description}`,
      `The assigned agent produced this deliverable:`,
      `"""\n${ctx.deliverable}\n"""`,
      `Judge honestly whether this deliverable actually satisfies the task`,
      `description — completeness, relevance, and concrete usefulness, not`,
      `just length or confident tone. Return approved (true only if it`,
      `genuinely meets the task), a qualityScore 0-100, and brief feedback`,
      `explaining the score — specific enough to act on if it's rejected.`,
    ].join(" "),
  });

  return output;
}

export interface AdHocTaskContext {
  goalTitle: string;
  task: Pick<WorkflowTask, "title" | "description" | "specialization">;
  agent: Pick<Agent, "name" | "tagline" | "bio">;
  dependencyOutputs?: { taskTitle: string; deliverable: string }[];
  revisionFeedback?: string;
}

export interface AdHocFulfillmentResult {
  deliverable: string;
  summary: string;
  approved: boolean;
  qualityScore: number;
  feedback: string;
}

/** Runs one real execute + verify pass outside the marketplace tick loop —
 * for fulfilling work that isn't a VYRON-internal `WorkflowTask` row (e.g.
 * an external ASP order received over OKX.AI's A2A channel). Same real
 * model calls the autonomous engine uses; no DB row, no escrow — the
 * caller decides what to do with the result. No fallback: a thrown error
 * here is a genuine fulfillment failure, same as elsewhere in this file. */
export async function fulfillAdHocTask(ctx: AdHocTaskContext): Promise<AdHocFulfillmentResult> {
  const deliverableResult = await executeTaskWithModel({
    goalTitle: ctx.goalTitle,
    task: ctx.task,
    agent: ctx.agent,
    dependencyOutputs: ctx.dependencyOutputs ?? [],
    revisionFeedback: ctx.revisionFeedback,
  });

  const verdict = await verifyTaskWithModel({
    goalTitle: ctx.goalTitle,
    task: ctx.task,
    deliverable: deliverableResult.deliverable,
  });

  return {
    deliverable: deliverableResult.deliverable,
    summary: deliverableResult.summary,
    approved: verdict.approved,
    qualityScore: verdict.qualityScore,
    feedback: verdict.feedback,
  };
}

// ---------------------------------------------------------------------------
// ExecutionEngine
// ---------------------------------------------------------------------------

/** The heart of VYRON: real per-task LLM execution and verification, real
 * escrow lock/release/refund, real self-healing reassignment on genuine
 * failure — driven by a real interval loop. No mock timers; every emitted
 * event corresponds to real work that just actually completed. Singleton
 * (see `executionEngine` below) — one instance drives the whole
 * marketplace, matching the process-local assumptions already made
 * elsewhere (the Prisma client singleton, the rate limiter). */
export class ExecutionEngine extends EventEmitter {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private ticking = false;

  private readonly inFlightExecutions = new Set<string>();
  private readonly inFlightVerifications = new Set<string>();
  private readonly executionFailures = new Map<string, number>();
  private readonly regenerationAttempts = new Map<string, number>();
  private readonly pendingRevisionFeedback = new Map<string, string>();
  private readonly hasSelfHealed = new Set<string>();
  private readonly givenUp = new Set<string>();

  constructor(private readonly tickIntervalMs = DEFAULT_TICK_INTERVAL_MS) {
    super();
  }

  /** Starts the autonomous loop. Idempotent. */
  start(): void {
    if (this.intervalId) return;
    this.intervalId = setInterval(() => {
      this.executeNextTask().catch((error) => {
        logger.error("monitor_tick", {
          stage: "monitor_tick",
          outcome: "failure",
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }, this.tickIntervalMs);
  }

  /** Stops the loop without losing any in-memory retry/self-heal state —
   * `resume()` picks up exactly where it left off. */
  pause(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  resume(): void {
    this.start();
  }

  /** Stops the loop and clears all in-memory retry state — a harder reset
   * than `pause()`, for when the engine should forget what it was doing
   * (e.g. tests). Never touches persisted task/goal state. */
  cancel(): void {
    this.pause();
    this.inFlightExecutions.clear();
    this.inFlightVerifications.clear();
    this.executionFailures.clear();
    this.regenerationAttempts.clear();
    this.pendingRevisionFeedback.clear();
    this.hasSelfHealed.clear();
    this.givenUp.clear();
  }

  /** Subscribe to real, strongly-typed execution events — fired only when
   * real work (execution, verification, reassignment, settlement, goal
   * completion) has actually just happened. */
  onEvent(listener: (event: ExecutionEvent) => void): this {
    this.on(EVENT_CHANNEL, listener);
    return this;
  }

  offEvent(listener: (event: ExecutionEvent) => void): this {
    this.off(EVENT_CHANNEL, listener);
    return this;
  }

  /** One real tick: scans every task actually in flight across the whole
   * marketplace (running or in review) and, for each, either generates a
   * real deliverable or independently reviews one — nothing here advances
   * on a timer. Safe to call directly even when the interval loop isn't
   * running (e.g. to drive the engine step by step). */
  async executeNextTask(): Promise<void> {
    if (this.ticking) return; // a slow previous tick is still in flight
    this.ticking = true;
    try {
      const activeTasks = await memory.getActiveTasks();
      if (activeTasks.length === 0) return;

      const agents = await memory.getAgentRoster();
      const agentsById = new Map(agents.map((agent) => [agent.id, agent]));
      const touchedGoalIds = new Set<string>();

      await Promise.allSettled(
        activeTasks.map(async (task) => {
          const agent = task.agentId ? agentsById.get(task.agentId) : undefined;
          if (task.status === "running") {
            await this.handleRunningTask(task, agent, agents, touchedGoalIds);
          } else if (task.status === "review") {
            await this.handleReviewTask(task, agent, agents, touchedGoalIds);
          }
        }),
      );

      for (const goalId of touchedGoalIds) {
        await this.advanceAndMaybeComplete(goalId);
      }
    } finally {
      this.ticking = false;
    }
  }

  private emitEvent(event: Omit<ExecutionEvent, "timestamp">): void {
    this.emit(EVENT_CHANNEL, { ...event, timestamp: new Date().toISOString() });
  }

  /** Runs the actual execution model call for a task that's running and has
   * no delivery yet, and records the result. On failure, retries a bounded
   * number of times before handing off to self-heal reassignment — a real
   * failure signal, not a fabricated stall timer. */
  private async handleRunningTask(
    task: WorkflowTask,
    agent: Agent | undefined,
    agents: Agent[],
    touchedGoalIds: Set<string>,
  ): Promise<void> {
    if (!task.agentId || !agent) return;
    if (this.inFlightExecutions.has(task.id) || this.givenUp.has(task.id)) return;

    this.inFlightExecutions.add(task.id);
    const startedAt = Date.now();
    try {
      const record = await memory.loadExecution(task.goalId);
      if (!record) return;

      const dependencyOutputs = await memory.getDependencyOutputs(task);
      const revisionFeedback = this.pendingRevisionFeedback.get(task.id);

      this.emitEvent({
        type: "task_execution_started",
        goalId: task.goalId,
        taskId: task.id,
        agentId: task.agentId,
        message: `${agent.name} started executing "${task.title}"`,
      });

      const result = await executeTaskWithModel({
        goalTitle: record.goal.title,
        task,
        agent,
        dependencyOutputs,
        revisionFeedback,
      });

      const now = new Date().toISOString();
      await memory.updateExecution(task.id, { status: "review", reviewStartedAt: now });
      const message = formatDeliveryMessage(agent.name, task.title, result.summary, result.deliverable);
      await memory.saveEvent({
        type: "task_delivered",
        message,
        goalId: task.goalId,
        agentId: task.agentId,
      });

      logger.info("task_execution", {
        goalId: task.goalId,
        taskId: task.id,
        agentId: task.agentId,
        stage: "execution",
        model: MODEL_NAME,
        durationMs: Date.now() - startedAt,
        outcome: "success",
      });
      this.emitEvent({
        type: "task_execution_completed",
        goalId: task.goalId,
        taskId: task.id,
        agentId: task.agentId,
        message,
        data: { summary: result.summary },
      });

      this.pendingRevisionFeedback.delete(task.id);
      this.executionFailures.delete(task.id);
      touchedGoalIds.add(task.goalId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error("task_execution", {
        goalId: task.goalId,
        taskId: task.id,
        agentId: task.agentId,
        stage: "execution",
        model: MODEL_NAME,
        durationMs: Date.now() - startedAt,
        outcome: "failure",
        error: errorMessage,
      });
      this.emitEvent({
        type: "task_execution_failed",
        goalId: task.goalId,
        taskId: task.id,
        agentId: task.agentId,
        message: `Execution failed for "${task.title}": ${errorMessage}`,
      });
      await this.handleExecutionFailure(task, agent, agents);
    } finally {
      this.inFlightExecutions.delete(task.id);
    }
  }

  private async handleExecutionFailure(
    task: WorkflowTask,
    agent: Agent | undefined,
    agents: Agent[],
  ): Promise<void> {
    const failures = (this.executionFailures.get(task.id) ?? 0) + 1;
    this.executionFailures.set(task.id, failures);
    if (failures < MAX_EXECUTION_ATTEMPTS) return;

    if (!this.hasSelfHealed.has(task.id)) {
      await this.selfHealTask(
        task,
        agent,
        agents,
        `${agent?.name ?? "The assigned agent"} failed to deliver after ${MAX_EXECUTION_ATTEMPTS} attempts — VYRON reassigned it autonomously`,
      );
      this.hasSelfHealed.add(task.id);
      this.executionFailures.delete(task.id);
      return;
    }

    await this.giveUpOnTask(task, "execution kept failing even after reassignment");
  }

  /** Runs the verification model call for a task in review, and acts on the
   * real verdict: approve → settle (release escrow); reject → regenerate
   * with the reviewer's actual feedback (bounded), then reassign, then (if
   * that still doesn't help) dispute the escrow for human review. */
  private async handleReviewTask(
    task: WorkflowTask,
    agent: Agent | undefined,
    agents: Agent[],
    touchedGoalIds: Set<string>,
  ): Promise<void> {
    if (this.inFlightVerifications.has(task.id) || this.givenUp.has(task.id)) return;

    this.inFlightVerifications.add(task.id);
    const startedAt = Date.now();
    try {
      const record = await memory.loadExecution(task.goalId);
      if (!record) return;

      const delivery = await memory.getDelivery(task);
      if (!delivery) return;

      const verdict = await verifyTaskWithModel({
        goalTitle: record.goal.title,
        task,
        deliverable: delivery.deliverable,
      });
      const durationMs = Date.now() - startedAt;

      if (verdict.approved) {
        const message = `Verified "${task.title}" — quality ${verdict.qualityScore}/100, approved: ${verdict.feedback}`;
        await memory.saveEvent({ type: "task_verified", message, goalId: task.goalId, agentId: task.agentId });
        logger.info("task_verification", {
          goalId: task.goalId,
          taskId: task.id,
          agentId: task.agentId,
          stage: "verification",
          model: MODEL_NAME,
          durationMs,
          outcome: "approved",
          qualityScore: verdict.qualityScore,
        });
        this.emitEvent({
          type: "task_verification_completed",
          goalId: task.goalId,
          taskId: task.id,
          agentId: task.agentId,
          message,
          data: { approved: true, qualityScore: verdict.qualityScore },
        });

        await this.settleTask(task, agent);
        this.regenerationAttempts.delete(task.id);
        touchedGoalIds.add(task.goalId);
        return;
      }

      const message = `Review of "${task.title}" — needs revision (quality ${verdict.qualityScore}/100): ${verdict.feedback}`;
      await memory.saveEvent({ type: "task_verified", message, goalId: task.goalId, agentId: task.agentId });
      logger.info("task_verification", {
        goalId: task.goalId,
        taskId: task.id,
        agentId: task.agentId,
        stage: "verification",
        model: MODEL_NAME,
        durationMs,
        outcome: "rejected",
        qualityScore: verdict.qualityScore,
      });
      this.emitEvent({
        type: "task_verification_completed",
        goalId: task.goalId,
        taskId: task.id,
        agentId: task.agentId,
        message,
        data: { approved: false, qualityScore: verdict.qualityScore },
      });

      const attempts = (this.regenerationAttempts.get(task.id) ?? 0) + 1;
      this.regenerationAttempts.set(task.id, attempts);

      if (attempts <= MAX_REGEN_ATTEMPTS) {
        this.pendingRevisionFeedback.set(task.id, verdict.feedback);
        await memory.updateExecution(task.id, { status: "running" });
        return;
      }

      if (!this.hasSelfHealed.has(task.id)) {
        await memory.updateExecution(task.id, { status: "running" });
        await this.selfHealTask(
          task,
          agent,
          agents,
          `${agent?.name ?? "The assigned agent"}'s work didn't pass review after ${MAX_REGEN_ATTEMPTS} revisions — VYRON reassigned it autonomously`,
        );
        this.hasSelfHealed.add(task.id);
        this.regenerationAttempts.delete(task.id);
        return;
      }

      await this.giveUpOnTask(task, "repeated review rejections even after reassignment");
    } catch (error) {
      logger.error("task_verification", {
        goalId: task.goalId,
        taskId: task.id,
        agentId: task.agentId,
        stage: "verification",
        model: MODEL_NAME,
        durationMs: Date.now() - startedAt,
        outcome: "failure",
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.inFlightVerifications.delete(task.id);
    }
  }

  /** Detected from a real failure, not a click: re-runs real matching
   * (excluding the underperforming agent, honoring the goal owner's
   * memory) and reassigns — same mechanics as manually forcing an agent
   * offline. */
  private async selfHealTask(
    task: WorkflowTask,
    stalledAgent: Agent | undefined,
    agents: Agent[],
    reason: string,
  ): Promise<void> {
    const record = await memory.loadExecution(task.goalId);
    if (!record) return;

    const candidates = agents.filter((candidate) => candidate.id !== task.agentId);
    const matchMemory = await memory.getMatchMemory(record.goal.userId);
    const match = matchAgentForTask(candidates, task.specialization, undefined, matchMemory);
    if (!match.agent) return;

    await memory.reassign({
      taskId: task.id,
      goalId: task.goalId,
      newAgentId: match.agent.id,
      trustScore: match.trustScore,
      rationale: match.rationale,
      reason,
    });

    logger.warn("task_self_heal", {
      goalId: task.goalId,
      taskId: task.id,
      agentId: match.agent.id,
      stage: "self_heal",
      outcome: "success",
      previousAgentId: stalledAgent?.id ?? task.agentId,
      reason,
    });
    this.emitEvent({
      type: "task_reassigned",
      goalId: task.goalId,
      taskId: task.id,
      agentId: match.agent.id,
      message: `${task.title} reassigned to ${match.agent.name} — ${reason}`,
      data: { previousAgentId: stalledAgent?.id ?? task.agentId },
    });
  }

  /** Terminal state for a task VYRON can't move forward autonomously —
   * disputes any locked escrow (an existing, previously-unused status) and
   * stops further auto-retry, rather than silently completing or
   * endlessly re-calling a model that keeps failing. */
  private async giveUpOnTask(task: WorkflowTask, reason: string): Promise<void> {
    this.givenUp.add(task.id);
    const escrow = await memory.getLockedEscrow(task.id);
    if (escrow) await memory.disputeEscrow(escrow.id);
    logger.error("task_give_up", {
      goalId: task.goalId,
      taskId: task.id,
      agentId: task.agentId,
      stage: "give_up",
      outcome: "failure",
      reason,
    });
    this.emitEvent({
      type: "task_disputed",
      goalId: task.goalId,
      taskId: task.id,
      agentId: task.agentId,
      message: `Gave up on "${task.title}" — ${reason}`,
    });
  }

  private async settleTask(task: WorkflowTask, agent: Agent | undefined): Promise<void> {
    await memory.updateExecution(task.id, { status: "paid" });

    const escrow = task.agentId ? await memory.getLockedEscrow(task.id) : null;
    if (escrow) {
      const released = await memory.releaseEscrow(escrow.id);
      await memory.saveEvent({
        type: "escrow_released",
        message: `Escrow released to ${agent?.name ?? "agent"} for ${task.title} ($${task.price})`,
        goalId: task.goalId,
        agentId: task.agentId,
        txHash: released.txHash ?? null,
        explorerUrl: released.explorerUrl ?? null,
      });
    }
  }

  private async advanceAndMaybeComplete(goalId: string): Promise<void> {
    const record = await memory.loadExecution(goalId);
    if (!record) return;

    const { justStarted } = advanceWorkflow({ goalId, tasks: record.tasks });
    if (justStarted.length > 0) {
      await memory.saveWorkflow(goalId, justStarted);
      for (const task of justStarted) {
        this.emitEvent({
          type: "workflow_advanced",
          goalId,
          taskId: task.id,
          agentId: task.agentId,
          message: `${task.title} started`,
        });
      }
      return; // tasks that just started aren't done — the goal can't be complete yet
    }

    if (
      isWorkflowComplete({ goalId, tasks: record.tasks }) &&
      record.goal.status !== "completed"
    ) {
      await memory.markGoalDone(goalId);
      const message = `Goal completed: "${record.goal.title}"`;
      await memory.saveEvent({ type: "goal_completed", message, goalId, agentId: null });
      this.emitEvent({ type: "goal_completed", goalId, message });
    }
  }
}

/** One instance drives the whole marketplace — see the class doc comment
 * for why this is a deliberate singleton, matching the process-local
 * assumptions already made elsewhere in the app. */
export const executionEngine = new ExecutionEngine();

/** Drives one real tick before a server-rendered page reads goal/task data.
 * On Vercel, instrumentation.ts's background interval only gets CPU time
 * opportunistically while some other request happens to be in flight, and
 * the cron backstop is capped at once/day (Hobby plan) — so a page that
 * only reads the DB can show a goal stuck on "running" for hours even
 * though nothing is actually broken. `executeNextTask` already no-ops
 * cheaply (one DB query, no model calls) when nothing is active, so this is
 * safe to call unconditionally from any page that displays goal/task
 * status. Never throws — a tick failure shouldn't take down page render. */
export async function driveEngineTick(source: string): Promise<void> {
  await executionEngine.executeNextTask().catch((error) => {
    logger.error("dashboard_tick", {
      stage: source,
      outcome: "failure",
      error: error instanceof Error ? error.message : String(error),
    });
  });
}
