/* Seed goals, demo videos, and default rules. */

import { uid } from "./format.js";

export const seedGoals = [
  {
    id: uid(),
    name: "History and edge cases of AI governance",
    description:
      "The history and evolution of AI governance, difficult edge cases, contested definitions, assurance limits, accountability gaps and practical failures. Historical and practitioner depth over hype.",
    keywords: "history of AI governance, AI governance edge cases",
    endDate: "2026-09-30",
    weeklyMinutes: 120,
  },
  {
    id: uid(),
    name: "Postmodern philosophy",
    description:
      "Postmodern philosophy, its major thinkers, intellectual history, strongest arguments, serious critiques and applications to knowledge, language, institutions and power. Primary ideas over culture-war summaries.",
    keywords: "postmodern philosophy lecture, postmodernism intellectual history",
    endDate: "2026-09-30",
    weeklyMinutes: 60,
  },
  {
    id: uid(),
    name: "System dynamics",
    description:
      "System dynamics, feedback loops, stocks and flows, delays, leverage points, causal loop diagrams and applications to organizations and public policy. Rigorous explanation with practical examples.",
    keywords: "system dynamics feedback loops, system dynamics lecture",
    endDate: "2026-09-30",
    weeklyMinutes: 90,
  },
];

export const seedDemoVideos = [
  {
    id: "demo-ai-controls",
    title: "From AI principles to controls that can be tested",
    channel: "Demo catalogue",
    description: "A practical walkthrough of AI governance controls and assurance evidence.",
    duration: 1422,
    goalId: seedGoals[0].id,
    score: 94,
    why: "practical governance and assurance depth",
    status: "fresh",
    demoLabel: "AI GOVERNANCE",
  },
  {
    id: "demo-agent-oversight",
    title: "Designing oversight for autonomous AI agents",
    channel: "Demo catalogue",
    description: "Human oversight, escalation paths, and evidence for agentic systems.",
    duration: 1098,
    goalId: seedGoals[0].id,
    score: 89,
    why: "directly addresses agent oversight",
    status: "fresh",
    demoLabel: "AI ASSURANCE",
  },
  {
    id: "demo-postmodernism",
    title: "Postmodernism: the strongest case before the critique",
    channel: "Demo catalogue",
    description: "An intellectual history of postmodern thought and its strongest arguments.",
    duration: 1260,
    goalId: seedGoals[1].id,
    score: 91,
    why: "serious historical and philosophical treatment",
    status: "fresh",
    demoLabel: "POSTMODERN PHILOSOPHY",
  },
  {
    id: "demo-system-dynamics",
    title: "Feedback loops, delays and unintended consequences",
    channel: "Demo catalogue",
    description: "A practical introduction to system dynamics using causal loop diagrams.",
    duration: 876,
    goalId: seedGoals[2].id,
    score: 86,
    why: "clear system dynamics foundations",
    status: "fresh",
    demoLabel: "SYSTEM DYNAMICS",
  },
];

export const defaultSettings = {
  minLengthMin: 8,
  blockShorts: true,
  feedCap: 12,
  refreshTimes: ["07:00", "17:00"],
  lookbackDays: 90,
};
