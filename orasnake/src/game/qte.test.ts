import { describe, expect, it } from "vitest";
import { ORACLE_TOPICS } from "../content/oracleFacts";
import { createInitialSnakeState } from "./snake";
import { applyQteResolution, randomizePromptAnswers, resolveQtePrompt, validateFactPack } from "./qte";
import type { ChoicePrompt, GridSize, LanePrompt, SequencePrompt } from "./types";

const sequencePrompt: SequencePrompt = {
  id: "seq",
  mode: "sequence",
  question: "Trace it.",
  snippet: "sample.trace()",
  sourcePath: "sample/README.md",
  sequence: ["up", "right"],
  timeMs: 1000,
  insight: 4,
  advantage: "slow-time",
  penalty: "speed-pressure"
};

const choicePrompt: ChoicePrompt = {
  id: "choice",
  mode: "choice",
  question: "Pick one.",
  snippet: "sample.choice()",
  sourcePath: "sample/README.md",
  choices: ["wrong", "right"],
  answerIndex: 1,
  timeMs: 1000,
  insight: 5,
  advantage: "double-insight",
  penalty: "combo-loss"
};

const lanePrompt: LanePrompt = {
  id: "lane",
  mode: "lane",
  question: "Pick lane.",
  snippet: "sample.lane()",
  sourcePath: "sample/README.md",
  lanes: ["a", "b", "c"],
  answerIndex: 2,
  timeMs: 1000,
  insight: 6,
  advantage: "clear-obstacle",
  penalty: "obstacle"
};

describe("QTE resolution", () => {
  it("validates timed key sequences", () => {
    const result = resolveQtePrompt(sequencePrompt, { sequence: ["up", "right"] }, 1.5);

    expect(result.success).toBe(true);
    expect(result.scoreDelta).toBeGreaterThan(250);
    expect(result.advantage).toBe("slow-time");
  });

  it("fails incorrect multiple-choice answers and resets combo", () => {
    const result = resolveQtePrompt(choicePrompt, { choiceIndex: 0 }, 2);
    const state = applyQteResolution(
      {
        ...createInitialSnakeState({ width: 8, height: 8 } satisfies GridSize),
        combo: 2,
        bestCombo: 2
      },
      result
    );

    expect(result.success).toBe(false);
    expect(result.scoreDelta).toBeLessThan(0);
    expect(result.penalty).toBe("combo-loss");
    expect(state.combo).toBe(1);
    expect(state.score).toBe(0);
  });

  it("validates answer-lane steering", () => {
    const result = resolveQtePrompt(lanePrompt, { laneIndex: 2 }, 1);

    expect(result.success).toBe(true);
    expect(result.advantage).toBe("clear-obstacle");
  });

  it("randomizes multiple-choice options while preserving the correct answer", () => {
    const prompt = randomizePromptAnswers(choicePrompt, () => 0);

    expect(prompt.mode).toBe("choice");
    if (prompt.mode !== "choice") return;
    expect(prompt.choices).toEqual(["right", "wrong"]);
    expect(prompt.answerIndex).toBe(0);
    expect(resolveQtePrompt(prompt, { choiceIndex: prompt.answerIndex }, 1).success).toBe(true);
  });

  it("randomizes answer lanes while preserving the correct answer", () => {
    const prompt = randomizePromptAnswers(lanePrompt, () => 0);

    expect(prompt.mode).toBe("lane");
    if (prompt.mode !== "lane") return;
    expect(prompt.lanes).toEqual(["b", "c", "a"]);
    expect(prompt.answerIndex).toBe(1);
    expect(resolveQtePrompt(prompt, { laneIndex: prompt.answerIndex }, 1).success).toBe(true);
  });
});

describe("fact pack validation", () => {
  it("requires prompts, source URLs, and non-empty display copy for every topic", () => {
    expect(validateFactPack(ORACLE_TOPICS)).toEqual([]);
  });

  it("contains at least 50 unique QTE prompts", () => {
    const promptIds = ORACLE_TOPICS.flatMap((topic) => topic.prompts.map((prompt) => prompt.id));

    expect(promptIds.length).toBeGreaterThanOrEqual(50);
    expect(new Set(promptIds).size).toBe(promptIds.length);
  });

  it("links every prompt sourcePath directly to the sample repo", () => {
    for (const prompt of ORACLE_TOPICS.flatMap((topic) => topic.prompts)) {
      expect(prompt.sourcePath).toMatch(
        /^https:\/\/github\.com\/anders-swanson\/oracle-database-code-samples\/(?:blob|tree)\/main\//
      );
    }
  });

  it("covers the core sample repo feature categories", () => {
    const topicText = ORACLE_TOPICS.map((topic) => `${topic.id} ${topic.label} ${topic.shortFact}`).join(" ");
    const promptText = ORACLE_TOPICS.flatMap((topic) =>
      topic.prompts.map((prompt) => `${prompt.question} ${prompt.snippet} ${prompt.sourcePath}`)
    ).join(" ");
    const coverageText = `${topicText} ${promptText}`.toLowerCase();

    for (const feature of [
      "txeventq",
      "okafka",
      "property graph",
      "spatial",
      "ords",
      "oracle ai database free",
      "observability",
      "spring boot",
      "testcontainers"
    ]) {
      expect(coverageText).toContain(feature);
    }
  });
});
