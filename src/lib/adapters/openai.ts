import type { AgentNarratives, DemoState } from "@/lib/domain";
import { buildFallbackNarratives } from "@/lib/scenario";

function getMode() {
  return process.env.OPENAI_API_KEY ? "live" : "mock";
}

export function getOpenAiStatus() {
  return {
    name: "OpenAI",
    mode: getMode(),
    detail:
      getMode() === "live"
        ? "Responses API enabled for narrative generation."
        : "Using deterministic fallback narratives.",
  } as const;
}

function extractText(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const maybeText = (payload as { output_text?: string }).output_text;
  if (typeof maybeText === "string" && maybeText.trim().length > 0) {
    return maybeText;
  }

  return null;
}

export async function generateNarratives(
  state: DemoState,
): Promise<AgentNarratives> {
  const fallback = buildFallbackNarratives(state.estimate, state.flags);

  if (!process.env.OPENAI_API_KEY) {
    return fallback;
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-5-mini",
        input: [
          {
            role: "system",
            content:
              "Return strict JSON with keys controlRoom, customerSafe, csrGuidance, managerNote, crewSummary, emailDraft. Keep each value concise and operationally grounded.",
          },
          {
            role: "user",
            content: JSON.stringify({
              outage: state.outage,
              estimate: state.estimate,
              drivers: state.drivers,
              vulnerability: state.vulnerability,
              restorationPaths: state.restorationPaths,
            }),
          },
        ],
      }),
    });

    if (!response.ok) {
      return fallback;
    }

    const payload = (await response.json()) as unknown;
    const text = extractText(payload);
    if (!text) {
      return fallback;
    }

    const parsed = JSON.parse(text) as Partial<AgentNarratives>;
    if (
      !parsed.controlRoom ||
      !parsed.customerSafe ||
      !parsed.csrGuidance ||
      !parsed.managerNote ||
      !parsed.crewSummary ||
      !parsed.emailDraft
    ) {
      return fallback;
    }

    return parsed as AgentNarratives;
  } catch {
    return fallback;
  }
}
