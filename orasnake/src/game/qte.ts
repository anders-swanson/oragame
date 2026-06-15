import type { Direction, QtePrompt, QteAdvantage, QtePenalty, SnakeState, TopicFact } from "./types";
import { shuffled } from "./random";

const SAMPLE_REPO_PATTERN = /^https:\/\/github\.com\/anders-swanson\/oracle-database-code-samples(?:\/(?:blob|tree)\/main\/.+)?$/;

export interface QteInput {
  readonly sequence?: readonly Direction[];
  readonly choiceIndex?: number;
  readonly laneIndex?: number;
}

export interface QteResolution {
  readonly success: boolean;
  readonly insightDelta: number;
  readonly scoreDelta: number;
  readonly comboDelta: number;
  readonly advantage?: QteAdvantage;
  readonly penalty?: QtePenalty;
}

function sequenceMatches(a: readonly Direction[], b: readonly Direction[]): boolean {
  return a.length === b.length && a.every((direction, index) => direction === b[index]);
}

export function randomizePromptAnswers(prompt: QtePrompt, random: () => number = Math.random): QtePrompt {
  if (prompt.mode === "sequence") {
    return prompt;
  }

  if (prompt.mode === "choice") {
    const choices = shuffled(withOriginalIndex(prompt.choices), random);

    return {
      ...prompt,
      choices: choices.map((choice) => choice.value),
      answerIndex: choices.findIndex((choice) => choice.originalIndex === prompt.answerIndex)
    };
  }

  const lanes = shuffled(withOriginalIndex(prompt.lanes), random);

  return {
    ...prompt,
    lanes: [lanes[0].value, lanes[1].value, lanes[2].value],
    answerIndex: lanes.findIndex((lane) => lane.originalIndex === prompt.answerIndex)
  };
}

export function resolveQtePrompt(prompt: QtePrompt, input: QteInput, combo: number): QteResolution {
  const success =
    prompt.mode === "sequence"
      ? sequenceMatches(prompt.sequence, input.sequence ?? [])
      : prompt.mode === "choice"
        ? prompt.answerIndex === input.choiceIndex
        : prompt.answerIndex === input.laneIndex;

  if (!success) {
    const scorePenalty = Math.round(100 + Math.min(320, Math.max(1, combo) * 85));

    return {
      success: false,
      insightDelta: 0,
      scoreDelta: -scorePenalty,
      comboDelta: -combo + 1,
      penalty: prompt.penalty
    };
  }

  const insightDelta = prompt.advantage === "double-insight" ? prompt.insight * 2 : prompt.insight;

  return {
    success: true,
    insightDelta,
    scoreDelta: Math.round(250 * Math.max(1, combo) + insightDelta * 8),
    comboDelta: 0.25,
    advantage: prompt.advantage
  };
}

export function applyQteResolution(state: SnakeState, resolution: QteResolution): SnakeState {
  const combo = resolution.success
    ? Math.min(4, Number((state.combo + resolution.comboDelta).toFixed(2)))
    : Math.max(1, Number((state.combo + resolution.comboDelta).toFixed(2)));

  return {
    ...state,
    score: Math.max(0, state.score + resolution.scoreDelta),
    insight: state.insight + resolution.insightDelta,
    combo,
    bestCombo: Math.max(state.bestCombo, combo)
  };
}

export function validatePrompt(prompt: QtePrompt): string[] {
  const errors: string[] = [];

  if (!prompt.id.trim()) errors.push("prompt id is required");
  if (!prompt.question.trim()) errors.push(`${prompt.id}: question is required`);
  if (!prompt.snippet.trim()) errors.push(`${prompt.id}: snippet is required`);
  if (!prompt.sourcePath.trim()) errors.push(`${prompt.id}: sourcePath is required`);
  if (prompt.sourcePath.trim() && !SAMPLE_REPO_PATTERN.test(prompt.sourcePath)) {
    errors.push(`${prompt.id}: sourcePath must point at the Oracle sample repo`);
  }
  if (prompt.timeMs <= 0) errors.push(`${prompt.id}: timeMs must be positive`);
  if (prompt.insight <= 0) errors.push(`${prompt.id}: insight must be positive`);

  if (prompt.mode === "sequence" && prompt.sequence.length === 0) {
    errors.push(`${prompt.id}: sequence prompts need at least one direction`);
  }

  if (prompt.mode === "choice") {
    if (prompt.choices.length < 2) errors.push(`${prompt.id}: choice prompts need at least two choices`);
    if (prompt.answerIndex < 0 || prompt.answerIndex >= prompt.choices.length) {
      errors.push(`${prompt.id}: answerIndex is outside choices`);
    }
  }

  if (prompt.mode === "lane" && (prompt.answerIndex < 0 || prompt.answerIndex >= prompt.lanes.length)) {
    errors.push(`${prompt.id}: answerIndex is outside lanes`);
  }

  return errors;
}

function withOriginalIndex<T>(items: readonly T[]): readonly { readonly value: T; readonly originalIndex: number }[] {
  return items.map((value, originalIndex) => ({ value, originalIndex }));
}

export function validateFactPack(topics: readonly TopicFact[]): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  const promptIds = new Set<string>();

  for (const topic of topics) {
    if (!topic.id.trim()) errors.push("topic id is required");
    if (ids.has(topic.id)) errors.push(`${topic.id}: duplicate topic id`);
    ids.add(topic.id);

    if (!topic.label.trim()) errors.push(`${topic.id}: label is required`);
    if (!topic.iconPath.trim()) errors.push(`${topic.id}: iconPath is required`);
    if (!topic.shortFact.trim()) errors.push(`${topic.id}: shortFact is required`);
    if (!SAMPLE_REPO_PATTERN.test(topic.sourceUrl)) {
      errors.push(`${topic.id}: sourceUrl must point at the Oracle sample repo`);
    }
    if (topic.prompts.length === 0) errors.push(`${topic.id}: at least one prompt is required`);

    for (const prompt of topic.prompts) {
      if (promptIds.has(prompt.id)) errors.push(`${topic.id}: ${prompt.id}: duplicate prompt id`);
      promptIds.add(prompt.id);
      errors.push(...validatePrompt(prompt).map((error) => `${topic.id}: ${error}`));
    }
  }

  return errors;
}
