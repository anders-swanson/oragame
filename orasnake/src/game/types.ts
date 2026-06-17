export type Direction = "up" | "down" | "left" | "right";

export const DIRECTIONS: readonly Direction[] = ["up", "down", "left", "right"];

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface GridSize {
  readonly width: number;
  readonly height: number;
}

export interface SnakeState {
  readonly snake: readonly Point[];
  readonly segmentTopicIds: readonly (string | undefined)[];
  readonly direction: Direction;
  readonly lastMoveDirection: Direction;
  readonly growSegments: number;
  readonly alive: boolean;
  readonly score: number;
  readonly insight: number;
  readonly combo: number;
  readonly bestCombo: number;
  readonly collectedTopicIds: readonly string[];
}

export interface CollisionResult {
  readonly type: "none" | "wall" | "self" | "blocked";
  readonly point?: Point;
}

export interface PickupScoreInput {
  readonly baseScore: number;
  readonly combo: number;
  readonly insightBonus?: number;
}

export type QteMode = "sequence" | "choice" | "lane";

export type QteAdvantage = "slow-time" | "clear-obstacle" | "double-insight";
export type QtePenalty = "speed-pressure" | "obstacle" | "combo-loss";

export interface QtePromptBase {
  readonly id: string;
  readonly mode: QteMode;
  readonly question: string;
  readonly snippet: string;
  readonly sourcePath: string;
  readonly timeMs: number;
  readonly insight: number;
  readonly advantage: QteAdvantage;
  readonly penalty: QtePenalty;
}

export interface SequencePrompt extends QtePromptBase {
  readonly mode: "sequence";
  readonly sequence: readonly Direction[];
}

export interface ChoicePrompt extends QtePromptBase {
  readonly mode: "choice";
  readonly choices: readonly string[];
  readonly answerIndex: number;
}

export interface LanePrompt extends QtePromptBase {
  readonly mode: "lane";
  readonly lanes: readonly [string, string, string];
  readonly answerIndex: number;
}

export type QtePrompt = SequencePrompt | ChoicePrompt | LanePrompt;

export interface TopicFact {
  readonly id: string;
  readonly label: string;
  readonly color: number;
  readonly accentColor: string;
  readonly iconPath: string;
  readonly shortFact: string;
  readonly sourceUrl: string;
  readonly pickupStyle: "orb" | "diamond" | "chip" | "graph" | "queue" | "ticket";
  readonly prompts: readonly QtePrompt[];
}
