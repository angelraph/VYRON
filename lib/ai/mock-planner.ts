import type { GoalPlan, GoalPlanTask } from "@/lib/ai/types";

type Template = GoalPlanTask;

const NFT_TEMPLATE: Template[] = [
  {
    title: "Research",
    description: "Market landscape, comparable projects, and feasibility research.",
    specialization: "Research",
    dependsOnIndexes: [],
    estimatedHours: 6,
  },
  {
    title: "Design",
    description: "Visual identity, product design, and landing page design.",
    specialization: "Product Design",
    dependsOnIndexes: [0],
    estimatedHours: 10,
  },
  {
    title: "Smart Contract",
    description: "Core contract engineering for mint, ownership, and royalties.",
    specialization: "Smart Contracts",
    dependsOnIndexes: [1],
    estimatedHours: 18,
  },
  {
    title: "Audit",
    description: "Independent security review before anything touches mainnet.",
    specialization: "Security Audit",
    dependsOnIndexes: [2],
    estimatedHours: 24,
  },
  {
    title: "Marketing",
    description: "Launch campaign across socials, community, and press.",
    specialization: "Growth Marketing",
    dependsOnIndexes: [1],
    estimatedHours: 12,
  },
  {
    title: "Deploy",
    description: "Production deployment, verification, and go-live.",
    specialization: "DevOps & Deployment",
    dependsOnIndexes: [3, 4],
    estimatedHours: 8,
  },
];

const GROWTH_TEMPLATE: Template[] = [
  {
    title: "Research",
    description: "Audience research and competitive content analysis.",
    specialization: "Research",
    dependsOnIndexes: [],
    estimatedHours: 5,
  },
  {
    title: "Content Strategy",
    description: "Editorial calendar and messaging tuned to the target audience.",
    specialization: "Content & Copy",
    dependsOnIndexes: [0],
    estimatedHours: 4,
  },
  {
    title: "Community Seeding",
    description: "Seed the initial audience across relevant communities.",
    specialization: "Community Management",
    dependsOnIndexes: [1],
    estimatedHours: 5,
  },
  {
    title: "Growth Campaign",
    description: "Paid and organic acquisition loops to hit the growth target.",
    specialization: "Growth Marketing",
    dependsOnIndexes: [1],
    estimatedHours: 12,
  },
  {
    title: "Performance Review",
    description: "Instrument and report on what's actually moving the numbers.",
    specialization: "Data Analysis",
    dependsOnIndexes: [2, 3],
    estimatedHours: 6,
  },
];

const PRODUCT_TEMPLATE: Template[] = [
  {
    title: "Research",
    description: "User and market research to validate the product direction.",
    specialization: "Research",
    dependsOnIndexes: [],
    estimatedHours: 6,
  },
  {
    title: "Design",
    description: "Product design system and core UI flows.",
    specialization: "Product Design",
    dependsOnIndexes: [0],
    estimatedHours: 12,
  },
  {
    title: "Launch Copy",
    description: "Landing page and onboarding copy.",
    specialization: "Content & Copy",
    dependsOnIndexes: [1],
    estimatedHours: 4,
  },
  {
    title: "Deployment",
    description: "Infrastructure setup and production deployment.",
    specialization: "DevOps & Deployment",
    dependsOnIndexes: [1],
    estimatedHours: 10,
  },
  {
    title: "Marketing",
    description: "Go-to-market plan and launch campaign.",
    specialization: "Growth Marketing",
    dependsOnIndexes: [2, 3],
    estimatedHours: 10,
  },
];

const GENERIC_TEMPLATE: Template[] = [
  {
    title: "Research",
    description: "Landscape research to shape the plan of attack.",
    specialization: "Research",
    dependsOnIndexes: [],
    estimatedHours: 5,
  },
  {
    title: "Design",
    description: "Design pass on the core deliverable.",
    specialization: "Product Design",
    dependsOnIndexes: [0],
    estimatedHours: 8,
  },
  {
    title: "Execution",
    description: "Build and ship the core deliverable.",
    specialization: "DevOps & Deployment",
    dependsOnIndexes: [1],
    estimatedHours: 12,
  },
  {
    title: "Marketing",
    description: "Announce and promote the result.",
    specialization: "Growth Marketing",
    dependsOnIndexes: [1],
    estimatedHours: 8,
  },
];

const KEYWORD_TEMPLATES: {
  keywords: string[];
  category: string;
  template: Template[];
}[] = [
  {
    keywords: [
      "nft",
      "token",
      "mint",
      "web3",
      "crypto",
      "collection",
      "smart contract",
      "dao",
    ],
    category: "NFT / Web3 launch",
    template: NFT_TEMPLATE,
  },
  {
    keywords: [
      "newsletter",
      "subscriber",
      "audience",
      "blog",
      "content",
      "grow my",
      "community",
    ],
    category: "audience growth",
    template: GROWTH_TEMPLATE,
  },
  {
    keywords: ["app", "saas", "product", "landing page", "startup", "mvp", "platform"],
    category: "product build",
    template: PRODUCT_TEMPLATE,
  },
];

function matchTemplate(goalTitle: string) {
  const normalized = goalTitle.toLowerCase();
  const entry = KEYWORD_TEMPLATES.find((candidate) =>
    candidate.keywords.some((keyword) => normalized.includes(keyword)),
  );
  const matchedKeywords =
    entry?.keywords.filter((keyword) => normalized.includes(keyword)) ?? [];
  return { entry, matchedKeywords };
}

/** Deterministic string hash used only to add small, goal-specific jitter to
 * heuristic confidence — keeps repeat runs of the same goal reproducible
 * while still varying naturally across different goal text. */
function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export interface IntentAnalysis {
  category: string;
  /** 0-1 — how confidently the heuristic classified this objective. */
  confidence: number;
  matchedKeywords: string[];
}

/** Heuristic intent analysis used when no AI model is configured. Confidence
 * is a real function of how many category keywords actually matched the
 * goal text, not a fixed number — a vague or off-template goal genuinely
 * scores lower than a clear match. */
export function analyzeIntent(goalTitle: string): IntentAnalysis {
  const { entry, matchedKeywords } = matchTemplate(goalTitle);
  const jitter = (hashString(goalTitle) % 7) - 3; // -3..+3, deterministic per title

  if (!entry) {
    return {
      category: "general objective",
      confidence: Math.min(0.62, Math.max(0.42, (0.5 + jitter / 100))),
      matchedKeywords: [],
    };
  }

  const base = 0.72 + Math.min(matchedKeywords.length - 1, 3) * 0.06;
  const confidence = Math.min(0.98, Math.max(0.55, base + jitter / 100));

  return { category: entry.category, confidence, matchedKeywords };
}

/** Deterministic, keyword-driven decomposition used when no AI model key is
 * configured — always produces a coherent, dependency-ordered multi-stage
 * plan so the "no chatbot UI" execution experience works fully offline. */
export function mockInterpretGoal(goalTitle: string): GoalPlan {
  const { entry } = matchTemplate(goalTitle);
  const intent = analyzeIntent(goalTitle);
  const template = entry?.template ?? GENERIC_TEMPLATE;
  return {
    intentConfidence: intent.confidence,
    category: intent.category,
    tasks: template,
  };
}
