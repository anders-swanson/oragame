import Phaser from "phaser";
import { ORACLE_TOPICS, topicById } from "../content/oracleFacts";
import { computeLayout, GRID, type Layout } from "../game/layout";
import { applyQteResolution, randomizePromptAnswers, resolveQtePrompt, type QteInput } from "../game/qte";
import { shuffled } from "../game/random";
import {
  advanceGhostSnake,
  advanceSnake,
  awardPickup,
  chooseSpawnCell,
  createInitialSnakeState,
  integratePickup,
  learnTopic,
  pointsEqual,
  withDirection
} from "../game/snake";
import type { CollisionResult, Direction, Point, QtePrompt, SnakeState, TopicFact } from "../game/types";
import { addText, COLORS, drawBackground, roundedPanel, underlineText } from "./draw";

interface Pickup {
  readonly cell: Point;
  readonly topic: TopicFact;
}

interface ActiveQte {
  readonly topic: TopicFact;
  readonly prompt: QtePrompt;
  readonly startedAt: number;
  readonly sequenceInput: Direction[];
}

interface QteHitZone {
  readonly rect: Phaser.Geom.Rectangle;
  readonly index: number;
  readonly direction?: Direction;
}

interface QteFeedback {
  readonly success: boolean;
  readonly message: string;
  readonly detail: string;
  readonly color: number;
  readonly until: number;
}

type PromptOrderSnapshot = readonly [string, readonly string[]];

export interface RunSnapshot {
  readonly state: SnakeState;
  readonly pickup: {
    readonly cell: Point;
    readonly topicId: string;
  };
  readonly obstacles: readonly Point[];
  readonly topicOrderIds: readonly string[];
  readonly promptOrderIds: readonly PromptOrderSnapshot[];
  readonly promptCursor: readonly (readonly [string, number])[];
  readonly pickupCursor: number;
  readonly pickupsSinceQte: number;
  readonly qteCooldownMs: number;
  readonly elapsed: number;
  readonly speedPressure: number;
  readonly slowTicks: number;
}

export interface GameSceneStartPayload {
  readonly recoverySnapshot?: RunSnapshot;
}

const QTE_PICKUP_INTERVAL = 2;
const QTE_MIN_DELAY_MS = 6500;
const QTE_FEEDBACK_MS = 1050;
const GHOST_FOOD_REQUIREMENT = 4;
const SOURCE_REPO_URL = "https://github.com/anders-swanson/oracle-database-code-samples";
const PICKUP_DISPLAY_RATIO = 0.94;
const DIRECTION_VECTOR: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 }
};

export interface GameOverPayload {
  readonly score: number;
  readonly insight: number;
  readonly bestCombo: number;
  readonly collectedTopicIds: readonly string[];
  readonly reason: CollisionResult["type"];
  readonly recoverySnapshot?: RunSnapshot;
}

export class GameScene extends Phaser.Scene {
  private graphics!: Phaser.GameObjects.Graphics;
  private labels: Phaser.GameObjects.GameObject[] = [];
  private state: SnakeState = createInitialSnakeState(GRID);
  private pickup!: Pickup;
  private obstacles: Point[] = [];
  private qte?: ActiveQte;
  private qteFeedback?: QteFeedback;
  private qteHitZones: QteHitZone[] = [];
  private topicOrder: TopicFact[] = [...ORACLE_TOPICS];
  private promptOrders = new Map<string, readonly QtePrompt[]>();
  private promptCursor = new Map<string, number>();
  private pickupCursor = 0;
  private pickupsSinceQte = 0;
  private lastQteAt = Number.NEGATIVE_INFINITY;
  private elapsed = 0;
  private speedPressure = 0;
  private slowTicks = 0;
  private ghostFoodsRemaining = 0;
  private startPayload?: GameSceneStartPayload;
  private touchStart?: Point;

  constructor() {
    super("GameScene");
  }

  init(data?: GameSceneStartPayload): void {
    this.startPayload = data;
  }

  create(): void {
    this.graphics = this.add.graphics();
    if (this.startPayload?.recoverySnapshot) {
      this.restoreRun(this.startPayload.recoverySnapshot);
    } else {
      this.resetGame();
    }
    this.startPayload = undefined;

    this.input.keyboard?.on("keydown", this.handleKeyDown, this);
    this.input.on("pointerdown", this.handlePointerDown, this);
    this.input.on("pointerup", this.handlePointerUp, this);
    this.scale.on("resize", this.render, this);
    this.events.once("shutdown", () => {
      this.input.keyboard?.off("keydown", this.handleKeyDown, this);
      this.input.off("pointerdown", this.handlePointerDown, this);
      this.input.off("pointerup", this.handlePointerUp, this);
      this.scale.off("resize", this.render, this);
    });

    this.render();
  }

  update(_time: number, delta: number): void {
    if (this.qteFeedback && this.time.now >= this.qteFeedback.until) {
      this.qteFeedback = undefined;
      this.render();
    }

    if (this.qte) {
      const expired = this.time.now - this.qte.startedAt >= this.qte.prompt.timeMs;
      if (expired) {
        this.finishQte({});
      } else {
        this.render();
      }
      return;
    }

    this.elapsed += delta;
    const delay = this.moveDelay();
    if (this.elapsed >= delay) {
      this.elapsed %= delay;
      this.step();
    }
  }

  private resetGame(): void {
    this.state = createInitialSnakeState(GRID);
    this.obstacles = [];
    this.randomizeQuestionOrder();
    this.promptCursor.clear();
    this.pickupCursor = 0;
    this.pickupsSinceQte = 0;
    this.lastQteAt = Number.NEGATIVE_INFINITY;
    this.elapsed = 0;
    this.speedPressure = 0;
    this.slowTicks = 0;
    this.ghostFoodsRemaining = 0;
    this.qte = undefined;
    this.qteFeedback = undefined;
    this.spawnPickup();
  }

  private restoreRun(snapshot: RunSnapshot): void {
    this.state = cloneSnakeState(snapshot.state);
    this.obstacles = snapshot.obstacles.map(clonePoint);
    this.restoreQuestionOrder(snapshot);
    this.pickup = {
      cell: clonePoint(snapshot.pickup.cell),
      topic: topicById(snapshot.pickup.topicId)
    };
    this.promptCursor = new Map(snapshot.promptCursor.map(([key, value]) => [key, value]));
    this.pickupCursor = snapshot.pickupCursor;
    this.pickupsSinceQte = snapshot.pickupsSinceQte;
    this.elapsed = snapshot.elapsed;
    this.speedPressure = snapshot.speedPressure;
    this.slowTicks = snapshot.slowTicks;
    this.ghostFoodsRemaining = GHOST_FOOD_REQUIREMENT;
    this.qte = undefined;
    this.qteFeedback = {
      success: true,
      message: "GHOST RUN",
      detail: `Eat ${GHOST_FOOD_REQUIREMENT} foods to stabilize the run.`,
      color: 0xb8e9ff,
      until: this.time.now + QTE_FEEDBACK_MS * 2
    };

    const cooldownMs = clamp(snapshot.qteCooldownMs, 0, QTE_MIN_DELAY_MS);
    this.lastQteAt = this.time.now - (QTE_MIN_DELAY_MS - cooldownMs);
  }

  private randomizeQuestionOrder(): void {
    this.topicOrder = shuffled(ORACLE_TOPICS);
    this.promptOrders = new Map(ORACLE_TOPICS.map((topic) => [topic.id, shuffled(topic.prompts)]));
  }

  private restoreQuestionOrder(snapshot: RunSnapshot): void {
    this.topicOrder = snapshot.topicOrderIds.map(topicById);

    const promptIdsByTopic = new Map(snapshot.promptOrderIds);
    this.promptOrders = new Map(
      ORACLE_TOPICS.map((topic) => {
        const promptsById = new Map(topic.prompts.map((prompt) => [prompt.id, prompt]));
        const prompts = (promptIdsByTopic.get(topic.id) ?? []).map((promptId) => promptsById.get(promptId)).filter(isQtePrompt);

        return [topic.id, prompts.length > 0 ? prompts : topic.prompts];
      })
    );
  }

  private moveDelay(): number {
    const scorePressure = Math.min(44, Math.floor(this.state.score / 500) * 4);
    const slowBonus = this.slowTicks > 0 ? 75 : 0;
    const ghostBonus = this.isGhostActive() ? 38 : 0;
    return Math.max(72, 165 - scorePressure - this.speedPressure + slowBonus + ghostBonus);
  }

  private step(): void {
    const previousState = this.state;
    const result = this.isGhostActive() ? advanceGhostSnake(this.state, GRID) : advanceSnake(this.state, GRID, this.obstacles);
    this.state = result.state;

    if (result.collision.type !== "none") {
      this.finishGame(result.collision.type, previousState);
      return;
    }

    if (this.slowTicks > 0) {
      this.slowTicks -= 1;
    }

    const head = this.state.snake[0];
    if (pointsEqual(head, this.pickup.cell)) {
      this.collectPickup();
    }

    this.render();
  }

  private collectPickup(): void {
    const topic = this.pickup.topic;
    this.createPickupBurst(this.pickup.cell, topic);
    this.spawnPickup();

    if (this.isGhostActive()) {
      this.state = integratePickup(this.state, topic.id);
      this.ghostFoodsRemaining = Math.max(0, this.ghostFoodsRemaining - 1);
      if (!this.isGhostActive()) {
        this.createGhostRecoveredBurst();
        this.qteFeedback = {
          success: true,
          message: "RUN RESTORED",
          detail: "Normal collisions are back online.",
          color: 0xb8e986,
          until: this.time.now + QTE_FEEDBACK_MS * 1.35
        };
      }
      return;
    }

    this.pickupsSinceQte += 1;
    const startsQte = this.shouldStartQte();
    this.state = awardPickup(this.state, topic.id, 100, !startsQte);

    if (startsQte) {
      this.pickupsSinceQte = 0;
      this.startQte(topic);
    }
  }

  private shouldStartQte(): boolean {
    return !this.isGhostActive() && this.pickupsSinceQte >= QTE_PICKUP_INTERVAL && this.time.now - this.lastQteAt >= QTE_MIN_DELAY_MS;
  }

  private spawnPickup(): void {
    const firstPickupCell = this.pickupCursor === 0 ? this.firstForwardPickupCell() : undefined;
    const topic = this.topicOrder[this.pickupCursor % this.topicOrder.length];
    this.pickupCursor += 1;
    const blocked = this.pickup ? [...this.obstacles, this.pickup.cell] : this.obstacles;
    this.pickup = {
      cell: firstPickupCell ?? chooseSpawnCell(GRID, this.state.snake, blocked),
      topic
    };
  }

  private firstForwardPickupCell(): Point | undefined {
    const head = this.state.snake[0];
    const cell = {
      x: Math.min(GRID.width - 2, head.x + 5),
      y: head.y
    };
    const occupied = [...this.state.snake, ...this.obstacles];
    return occupied.some((point) => pointsEqual(point, cell)) ? undefined : cell;
  }

  private addObstacle(): void {
    if (this.obstacles.length >= 12) return;

    try {
      const cell = chooseSpawnCell(GRID, this.state.snake, [...this.obstacles, this.pickup.cell]);
      this.obstacles = [...this.obstacles, cell];
    } catch {
      // A full board should end through normal snake collision pressure, not a spawn error.
    }
  }

  private startQte(topic: TopicFact): void {
    const prompts = this.promptOrders.get(topic.id) ?? topic.prompts;
    const index = this.promptCursor.get(topic.id) ?? 0;
    this.promptCursor.set(topic.id, index + 1);
    this.qte = {
      topic,
      prompt: randomizePromptAnswers(prompts[index % prompts.length]),
      startedAt: this.time.now,
      sequenceInput: []
    };
    this.lastQteAt = this.time.now;
    this.cameras.main.flash(120, 255, 176, 0, false);
  }

  private finishQte(input: QteInput): void {
    if (!this.qte) return;

    const activeQte = this.qte;
    const resolution = resolveQtePrompt(activeQte.prompt, input, this.state.combo);
    this.state = applyQteResolution(this.state, resolution);
    let effect = "Combo broken";

    if (resolution.success) {
      this.state = learnTopic(this.state, activeQte.topic.id);

      if (resolution.advantage === "slow-time") {
        this.slowTicks += 8;
        effect = "Time dilation";
      } else if (resolution.advantage === "clear-obstacle") {
        this.obstacles = this.obstacles.slice(0, -1);
        effect = "Hazard cleared";
      } else {
        effect = "Insight doubled";
      }
    } else if (resolution.penalty === "speed-pressure") {
      this.speedPressure = Math.min(66, this.speedPressure + 10);
      effect = "Speed surge";
    } else if (resolution.penalty === "obstacle") {
      this.addObstacle();
      effect = "Hazard spawned";
    }

    this.qteFeedback = this.createQteFeedback(resolution.success, effect, resolution.scoreDelta, resolution.insightDelta);
    this.createQteResultBurst(activeQte.topic, resolution.success);
    if (resolution.success) {
      this.cameras.main.flash(140, 81, 207, 102, false);
    } else {
      this.cameras.main.shake(150, 0.006);
      this.cameras.main.flash(120, 255, 77, 79, false);
    }
    this.qte = undefined;
    this.render();
  }

  private createQteFeedback(success: boolean, effect: string, scoreDelta: number, insightDelta: number): QteFeedback {
    const scoreText = scoreDelta >= 0 ? `+${scoreDelta} score` : `${scoreDelta} score`;
    const insightText = insightDelta > 0 ? `, +${insightDelta} insight` : "";

    return {
      success,
      message: success ? "PICKUP SECURED" : "PICKUP DROPPED!",
      detail: `${scoreText}${insightText} | ${effect}`,
      color: success ? 0x51cf66 : 0xff4d4f,
      until: this.time.now + QTE_FEEDBACK_MS
    };
  }

  private finishGame(reason: CollisionResult["type"], recoveryState: SnakeState = this.state): void {
    const payload: GameOverPayload = {
      score: this.state.score,
      insight: this.state.insight,
      bestCombo: this.state.bestCombo,
      collectedTopicIds: this.state.collectedTopicIds,
      reason,
      recoverySnapshot: this.createRunSnapshot(recoveryState)
    };
    this.scene.start("GameOverScene", payload);
  }

  private createRunSnapshot(state: SnakeState): RunSnapshot {
    return {
      state: cloneSnakeState({ ...state, alive: true }),
      pickup: {
        cell: clonePoint(this.pickup.cell),
        topicId: this.pickup.topic.id
      },
      obstacles: this.obstacles.map(clonePoint),
      topicOrderIds: this.topicOrder.map((topic) => topic.id),
      promptOrderIds: Array.from(this.promptOrders.entries()).map(([topicId, prompts]) => [
        topicId,
        prompts.map((prompt) => prompt.id)
      ]),
      promptCursor: Array.from(this.promptCursor.entries()),
      pickupCursor: this.pickupCursor,
      pickupsSinceQte: this.pickupsSinceQte,
      qteCooldownMs: this.qteCooldownRemainingMs(),
      elapsed: this.elapsed,
      speedPressure: this.speedPressure,
      slowTicks: this.slowTicks
    };
  }

  private qteCooldownRemainingMs(): number {
    if (!Number.isFinite(this.lastQteAt)) return 0;

    return Math.max(0, QTE_MIN_DELAY_MS - (this.time.now - this.lastQteAt));
  }

  private isGhostActive(): boolean {
    return this.ghostFoodsRemaining > 0;
  }

  private handleKeyDown(event: KeyboardEvent): void {
    const direction = directionForKey(event.key);

    if (this.qte) {
      if (this.handleQteKey(event, direction)) {
        event.preventDefault();
      }
      return;
    }

    if (direction) {
      this.state = withDirection(this.state, direction);
      event.preventDefault();
      this.render();
    }
  }

  private handleQteKey(event: KeyboardEvent, direction?: Direction): boolean {
    if (!this.qte) return false;
    const prompt = this.qte.prompt;

    if (prompt.mode === "sequence" && direction) {
      this.appendQteSequenceDirection(direction);
      return true;
    }

    if (prompt.mode === "choice") {
      const index = numericIndexForKey(event.key);
      if (index !== undefined) {
        this.finishQte({ choiceIndex: index });
        return true;
      }
    }

    if (prompt.mode === "lane") {
      const index = laneIndexForKey(event.key, direction);
      if (index !== undefined) {
        this.finishQte({ laneIndex: index });
        return true;
      }
    }

    return false;
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    this.touchStart = { x: pointer.x, y: pointer.y };

    if (!this.qte) return;

    for (const hitZone of this.qteHitZones) {
      if (Phaser.Geom.Rectangle.Contains(hitZone.rect, pointer.x, pointer.y)) {
        if (this.qte.prompt.mode === "sequence" && hitZone.direction) {
          this.appendQteSequenceDirection(hitZone.direction);
        } else if (this.qte.prompt.mode === "choice") {
          this.finishQte({ choiceIndex: hitZone.index });
        } else {
          this.finishQte({ laneIndex: hitZone.index });
        }
        this.touchStart = undefined;
        break;
      }
    }
  }

  private appendQteSequenceDirection(direction: Direction): void {
    const activeQte = this.qte;
    if (!activeQte || activeQte.prompt.mode !== "sequence") return;

    const sequenceInput = [...activeQte.sequenceInput, direction];
    const expectedDirection = activeQte.prompt.sequence[activeQte.sequenceInput.length];

    if (direction !== expectedDirection) {
      this.finishQte({ sequence: sequenceInput });
      return;
    }

    this.qte = { ...activeQte, sequenceInput };
    if (sequenceInput.length >= activeQte.prompt.sequence.length) {
      this.finishQte({ sequence: sequenceInput });
    } else {
      this.render();
    }
  }

  private handlePointerUp(pointer: Phaser.Input.Pointer): void {
    if (!this.touchStart) return;

    const direction = directionFromSwipe(this.touchStart, { x: pointer.x, y: pointer.y });
    this.touchStart = undefined;
    if (!direction) return;

    const activeQte = this.qte;
    if (activeQte?.prompt.mode === "sequence") {
      this.appendQteSequenceDirection(direction);
      return;
    }

    if (!this.qte) {
      this.state = withDirection(this.state, direction);
      this.render();
    }
  }

  private render(): void {
    if (!this.graphics) return;

    const layout = computeLayout(this.scale.width, this.scale.height);
    this.clearLabels();
    this.qteHitZones = [];
    this.graphics.clear();

    drawBackground(this.graphics, layout);
    this.drawHud(layout);
    this.drawPlayfield(layout);
    if (!this.qte) {
      this.drawSideInfo(layout);
    }
    if (this.qte) {
      this.drawQte(layout);
    }
    if (this.qteFeedback && !this.qte) {
      this.drawQteFeedback(layout);
    }
  }

  private drawHud(layout: Layout): void {
    addText(this, this.labels, layout.padding, 13, "ORASNAKE", {
      fontSize: layout.isCompact ? "16px" : "21px",
      fontStyle: "800",
      color: "#fff7ed"
    });

    const scoreLine = `Score ${this.state.score}   Combo x${this.state.combo.toFixed(2)}   Insight ${this.state.insight}`;
    addText(this, this.labels, layout.isCompact ? layout.padding : layout.width - layout.padding, layout.isCompact ? 38 : 16, scoreLine, {
      fontSize: layout.isCompact ? "12px" : "15px",
      fontStyle: "700",
      color: COLORS.muted
    }).setOrigin(layout.isCompact ? 0 : 1, 0);

    if (!layout.isCompact) {
      addText(
        this,
        this.labels,
        layout.padding,
        42,
        this.isGhostActive()
          ? `Ghost snake: eat ${this.ghostFoodsRemaining} food${this.ghostFoodsRemaining === 1 ? "" : "s"} to stabilize.`
          : "Arrows/WASD steer. Oracle pickups trigger short mini-games.",
        {
          fontSize: "13px",
          color: this.isGhostActive() ? "#b8e9ff" : COLORS.muted
        }
      );
    } else if (this.isGhostActive()) {
      addText(this, this.labels, layout.width - layout.padding, 52, `${this.ghostFoodsRemaining} ghost foods left`, {
        fontSize: "10px",
        fontStyle: "900",
        color: "#b8e9ff",
        align: "right"
      }).setOrigin(1, 0);
    }
  }

  private drawPlayfield(layout: Layout): void {
    const x = layout.gridX;
    const y = layout.gridY;

    roundedPanel(this.graphics, x - 8, y - 8, layout.gridWidth + 16, layout.gridHeight + 16, 0x0b0d09, 0.96);
    this.graphics.fillStyle(0x10140f, 1);
    this.graphics.fillRect(x, y, layout.gridWidth, layout.gridHeight);

    for (let column = 0; column <= GRID.width; column += 1) {
      const lineX = x + column * layout.cell;
      this.graphics.lineStyle(column % 4 === 0 ? 2 : 1, column % 4 === 0 ? COLORS.gridStrong : COLORS.grid, 0.7);
      this.graphics.lineBetween(lineX, y, lineX, y + layout.gridHeight);
    }

    for (let row = 0; row <= GRID.height; row += 1) {
      const lineY = y + row * layout.cell;
      this.graphics.lineStyle(row % 3 === 0 ? 2 : 1, row % 3 === 0 ? COLORS.gridStrong : COLORS.grid, 0.7);
      this.graphics.lineBetween(x, lineY, x + layout.gridWidth, lineY);
    }

    for (const obstacle of this.obstacles) {
      this.drawObstacle(layout, obstacle);
    }

    this.drawPickup(layout);

    [...this.state.snake].reverse().forEach((cell, reverseIndex) => {
      const index = this.state.snake.length - 1 - reverseIndex;
      const isHead = index === 0;
      const topic = this.topicForSegment(index);
      if (isHead) {
        this.drawSnakeHead(layout, cell, topic);
      } else {
        this.drawSnakeBody(layout, cell, index, topic);
      }
    });
  }

  private drawCell(layout: Layout, point: Point, color: number, alpha: number, inset: number): void {
    const size = layout.cell - inset * 2;
    const radius = Math.max(3, Math.floor(layout.cell * 0.22));
    const x = layout.gridX + point.x * layout.cell + inset;
    const y = layout.gridY + point.y * layout.cell + inset;

    if (color === COLORS.snakeBody || color === COLORS.snakeHead) {
      this.graphics.fillStyle(COLORS.oracleRed, alpha * 0.24);
      this.graphics.fillRoundedRect(x - 2, y - 2, size + 4, size + 4, radius + 2);
    }

    this.graphics.fillStyle(color, alpha);
    this.graphics.fillRoundedRect(x, y, size, size, radius);

    if (color === COLORS.snakeHead) {
      this.graphics.lineStyle(2, COLORS.oracleRed, 0.95);
      this.graphics.strokeRoundedRect(x, y, size, size, radius);
    }
  }

  private drawObstacle(layout: Layout, point: Point): void {
    this.drawCell(layout, point, COLORS.obstacle, 0.95, 3);
    const x = layout.gridX + point.x * layout.cell;
    const y = layout.gridY + point.y * layout.cell;
    this.graphics.lineStyle(2, 0xffb4a2, 0.8);
    this.graphics.lineBetween(x + 6, y + 6, x + layout.cell - 6, y + layout.cell - 6);
    this.graphics.lineBetween(x + layout.cell - 6, y + 6, x + 6, y + layout.cell - 6);
  }

  private drawSnakeBody(layout: Layout, point: Point, index: number, topic?: TopicFact): void {
    const inset = Math.max(2, Math.floor(layout.cell * 0.12));
    const size = layout.cell - inset * 2;
    const radius = Math.max(4, Math.floor(layout.cell * 0.34));
    const x = layout.gridX + point.x * layout.cell + inset;
    const y = layout.gridY + point.y * layout.cell + inset;
    const pulse = index % 2 === 0;

    if (this.isGhostActive()) {
      this.drawGhostSegment(layout, x, y, size, radius, pulse ? 0.84 : 0.68);
      return;
    }

    this.graphics.fillStyle(0x4b0f0b, 0.26);
    this.graphics.fillRoundedRect(x - 2, y + 2, size + 4, size + 3, radius + 2);
    this.graphics.fillStyle(topic ? topic.color : pulse ? 0xe73527 : COLORS.snakeBody, 0.94);
    this.graphics.fillRoundedRect(x, y, size, size, radius);
    this.graphics.fillStyle(topic ? 0xffffff : 0xff8a73, topic ? 0.18 : 0.24);
    this.graphics.fillRoundedRect(x + size * 0.18, y + size * 0.15, size * 0.46, size * 0.22, radius);
    this.graphics.fillStyle(0xffd6d1, 0.12);
    this.graphics.fillCircle(x + size * 0.68, y + size * 0.68, Math.max(1.5, size * 0.08));

    if (topic) {
      this.graphics.lineStyle(2, 0xffffff, 0.72);
      this.graphics.strokeRoundedRect(x + 1, y + 1, size - 2, size - 2, radius);
      this.drawIntegratedPickup({ x: x + size / 2, y: y + size / 2 }, size * 0.7, topic);
    }
  }

  private drawSnakeHead(layout: Layout, point: Point, topic?: TopicFact): void {
    const inset = Math.max(2, Math.floor(layout.cell * 0.1));
    const size = layout.cell - inset * 2;
    const radius = Math.max(5, Math.floor(layout.cell * 0.36));
    const x = layout.gridX + point.x * layout.cell + inset;
    const y = layout.gridY + point.y * layout.cell + inset;
    const center = { x: x + size / 2, y: y + size / 2 };
    const vector = DIRECTION_VECTOR[this.state.direction];
    const perpendicular = { x: -vector.y, y: vector.x };
    const eyeForward = size * 0.18;
    const eyeSpread = size * 0.17;
    const eyeRadius = Math.max(2, size * 0.08);

    if (this.isGhostActive()) {
      this.drawGhostSegment(layout, x, y, size, radius, 0.95);
      this.graphics.lineStyle(2, 0xffffff, 0.86);
      this.graphics.strokeRoundedRect(x - 1, y - 1, size + 2, size + 2, radius + 1);
      this.graphics.fillStyle(0x07191f, 0.95);
      this.graphics.fillCircle(center.x + vector.x * eyeForward - perpendicular.x * eyeSpread, center.y + vector.y * eyeForward - perpendicular.y * eyeSpread, eyeRadius);
      this.graphics.fillCircle(center.x + vector.x * eyeForward + perpendicular.x * eyeSpread, center.y + vector.y * eyeForward + perpendicular.y * eyeSpread, eyeRadius);
      return;
    }

    this.graphics.fillStyle(0x4b0f0b, 0.32);
    this.graphics.fillRoundedRect(x - 2, y + 2, size + 4, size + 4, radius + 2);
    this.graphics.fillStyle(COLORS.snakeHead, 1);
    this.graphics.fillRoundedRect(x, y, size, size, radius);
    this.graphics.lineStyle(2, COLORS.oracleRed, 0.88);
    this.graphics.strokeRoundedRect(x, y, size, size, radius);
    this.graphics.fillStyle(0xffffff, 0.28);
    this.graphics.fillRoundedRect(x + size * 0.18, y + size * 0.13, size * 0.42, size * 0.2, radius);

    const eyes = [-1, 1].map((side) => ({
      x: center.x + vector.x * eyeForward + perpendicular.x * eyeSpread * side,
      y: center.y + vector.y * eyeForward + perpendicular.y * eyeSpread * side
    }));

    for (const eye of eyes) {
      this.graphics.fillStyle(0x231815, 1);
      this.graphics.fillCircle(eye.x, eye.y, eyeRadius);
      this.graphics.fillStyle(0xffffff, 0.9);
      this.graphics.fillCircle(eye.x - eyeRadius * 0.28, eye.y - eyeRadius * 0.28, Math.max(1, eyeRadius * 0.34));
    }

    for (const side of [-1, 1]) {
      this.graphics.fillStyle(0xff8a9a, 0.38);
      this.graphics.fillCircle(
        center.x - vector.x * size * 0.03 + perpendicular.x * size * 0.28 * side,
        center.y - vector.y * size * 0.03 + perpendicular.y * size * 0.28 * side,
        Math.max(1.8, size * 0.07)
      );
    }

    const mouthCenter = {
      x: center.x + vector.x * size * 0.32,
      y: center.y + vector.y * size * 0.32
    };
    this.graphics.lineStyle(2, 0x9b1c14, 0.82);
    this.graphics.lineBetween(
      mouthCenter.x - perpendicular.x * size * 0.06,
      mouthCenter.y - perpendicular.y * size * 0.06,
      mouthCenter.x + perpendicular.x * size * 0.06,
      mouthCenter.y + perpendicular.y * size * 0.06
    );
    this.graphics.lineStyle(2, 0xff4d6d, 0.88);
    this.graphics.lineBetween(
      mouthCenter.x,
      mouthCenter.y,
      mouthCenter.x + vector.x * size * 0.2,
      mouthCenter.y + vector.y * size * 0.2
    );

    if (topic) {
      this.drawIntegratedPickup(
        {
          x: center.x - vector.x * size * 0.24,
          y: center.y - vector.y * size * 0.24
        },
        size * 0.42,
        topic
      );
    }
  }

  private topicForSegment(index: number): TopicFact | undefined {
    const topicId = this.state.segmentTopicIds[index];
    return topicId ? topicById(topicId) : undefined;
  }

  private drawIntegratedPickup(center: Point, size: number, topic: TopicFact): void {
    const radius = Math.max(3, size * 0.24);
    const x = center.x - size / 2;
    const y = center.y - size / 2;

    this.graphics.fillStyle(topic.color, 0.28);
    this.graphics.fillRoundedRect(x - 1, y - 1, size + 2, size + 2, radius + 1);
    this.graphics.lineStyle(1, 0xffffff, 0.58);
    this.graphics.strokeRoundedRect(x, y, size, size, radius);

    const image = this.add.image(center.x, center.y, `pickup-${topic.id}`);
    image.setDisplaySize(size * 0.82, size * 0.82).setAlpha(0.94);
    this.labels.push(image);
  }

  private drawPickup(layout: Layout): void {
    const center = this.cellCenter(layout, this.pickup.cell);
    const glowSize = layout.cell * 0.86;
    const radius = Math.max(4, layout.cell * 0.16);
    const x = center.x - glowSize / 2;
    const y = center.y - glowSize / 2;
    const pickupKey = `pickup-${this.pickup.topic.id}`;

    this.graphics.fillStyle(0xffffff, 0.13);
    this.graphics.fillRoundedRect(x - 1, y - 1, glowSize + 2, glowSize + 2, radius + 1);
    this.graphics.lineStyle(1, 0xffffff, 0.62);
    this.graphics.strokeRoundedRect(x, y, glowSize, glowSize, radius);

    const image = this.add.image(center.x, center.y, pickupKey);
    image.setDisplaySize(layout.cell * PICKUP_DISPLAY_RATIO, layout.cell * PICKUP_DISPLAY_RATIO).setAlpha(1);
    this.labels.push(image);

    this.graphics.lineStyle(1, this.pickup.topic.color, 0.18);
    this.graphics.strokeCircle(center.x, center.y, layout.cell * 0.42);
  }

  private drawGhostSegment(_layout: Layout, x: number, y: number, size: number, radius: number, alpha: number): void {
    this.graphics.fillStyle(0x7bdff2, 0.18);
    this.graphics.fillRoundedRect(x - 3, y - 3, size + 6, size + 6, radius + 3);
    this.graphics.fillStyle(0xdff9ff, alpha);
    this.graphics.fillRoundedRect(x, y, size, size, radius);
    this.graphics.fillStyle(0x68d8ef, 0.28);
    this.graphics.fillRoundedRect(x + size * 0.14, y + size * 0.16, size * 0.58, size * 0.22, radius);
  }

  private drawSideInfo(layout: Layout): void {
    const currentTopic = this.pickup.topic;

    if (layout.isCompact) {
      const bottomY = layout.gridY + layout.gridHeight + 12;
      addText(this, this.labels, layout.padding, bottomY, `Next: ${currentTopic.label}`, {
        fontSize: layout.font.small,
        fontStyle: "800",
        color: currentTopic.accentColor
      }).setMaxLines(1);
      addText(this, this.labels, layout.padding, bottomY + 18, currentTopic.shortFact, {
        fontSize: "10px",
        color: COLORS.muted,
        maxLines: 2
      }).setWordWrapWidth(layout.width - layout.padding * 2);
      addText(this, this.labels, layout.padding, bottomY + 34, this.qteStatusText(), {
        fontSize: "10px",
        fontStyle: "800",
        color: "#fff7ed"
      });
      return;
    }

    roundedPanel(this.graphics, layout.sideX, layout.gridY - 8, layout.sideWidth, layout.gridHeight + 16);

    addText(this, this.labels, layout.sideX + 16, layout.gridY + 10, "Next Pickup", {
      fontSize: "13px",
      fontStyle: "800",
      color: COLORS.muted
    });
    addText(this, this.labels, layout.sideX + 16, layout.gridY + 34, currentTopic.label, {
      fontSize: "22px",
      fontStyle: "900",
      color: currentTopic.accentColor,
      maxLines: 2
    }).setWordWrapWidth(layout.sideWidth - 32);
    addText(this, this.labels, layout.sideX + 16, layout.gridY + 92, currentTopic.shortFact, {
      fontSize: "14px",
      lineSpacing: 4,
      color: "#f7f0de",
      maxLines: 4
    }).setWordWrapWidth(layout.sideWidth - 32);

    addText(this, this.labels, layout.sideX + 16, layout.gridY + 166, this.qteStatusText(), {
      fontSize: "13px",
      fontStyle: "900",
      color: "#fff7ed"
    }).setWordWrapWidth(layout.sideWidth - 32);

    const learnedY = layout.gridY + 214;
    addText(this, this.labels, layout.sideX + 16, learnedY, "Pickups", {
      fontSize: "13px",
      fontStyle: "800",
      color: COLORS.muted
    });

    const learnedTopics = this.state.collectedTopicIds.map(topicById);
    if (learnedTopics.length === 0) {
      addText(this, this.labels, layout.sideX + 16, learnedY + 26, "No topics collected yet.", {
        fontSize: "13px",
        color: COLORS.muted
      }).setWordWrapWidth(layout.sideWidth - 32);
      return;
    }

    learnedTopics.slice(-5).forEach((topic, index) => {
      const y = learnedY + 28 + index * 32;
      this.graphics.fillStyle(topic.color, 1);
      this.graphics.fillCircle(layout.sideX + 24, y + 9, 5);
      addText(this, this.labels, layout.sideX + 38, y, topic.label, {
        fontSize: "13px",
        fontStyle: "700",
        color: "#fff7ed",
        maxLines: 1
      }).setWordWrapWidth(layout.sideWidth - 52);
    });
  }

  private qteStatusText(): string {
    if (this.isGhostActive()) {
      return `Ghost recovery: eat ${this.ghostFoodsRemaining} more food${this.ghostFoodsRemaining === 1 ? "" : "s"}`;
    }

    const pickupsNeeded = Math.max(0, QTE_PICKUP_INTERVAL - this.pickupsSinceQte);
    if (pickupsNeeded > 0) {
      return `Mini-game in ${pickupsNeeded} pickup${pickupsNeeded === 1 ? "" : "s"}`;
    }

    const cooldownMs = Math.max(0, QTE_MIN_DELAY_MS - (this.time.now - this.lastQteAt));
    if (cooldownMs > 0) {
      return `Mini-game recharge ${Math.ceil(cooldownMs / 1000)}s`;
    }

    return "Mini-game ready on next pickup";
  }

  private drawQte(layout: Layout): void {
    if (!this.qte) return;

    const prompt = this.qte.prompt;
    const elapsed = this.time.now - this.qte.startedAt;
    const remaining = Math.max(0, 1 - elapsed / prompt.timeMs);
    const width = Math.min(layout.width - layout.padding * 2, layout.isCompact ? 356 : 640);
    const desiredHeight =
      prompt.mode === "sequence" ? (layout.isCompact ? 286 : 318) : prompt.mode === "choice" ? (layout.isCompact ? 382 : 420) : layout.isCompact ? 338 : 370;
    const availableHeight = layout.height - layout.hudHeight - layout.padding * 2;
    const height = Math.min(desiredHeight, Math.max(layout.isCompact ? 276 : 318, availableHeight));
    const x = Math.floor((layout.width - width) / 2);
    const y = Math.max(layout.hudHeight + 8, Math.min(Math.floor((layout.height - height) / 2), layout.height - height - layout.padding));

    this.graphics.fillStyle(0x000000, 0.68);
    this.graphics.fillRect(0, 0, layout.width, layout.height);
    roundedPanel(this.graphics, x, y, width, height, 0x151810, 0.98);

    this.graphics.fillStyle(this.qte.topic.color, 0.18);
    this.graphics.fillRoundedRect(x + 12, y + 12, width - 24, layout.isCompact ? 26 : 30, 8);
    this.graphics.lineStyle(1, this.qte.topic.color, 0.52);
    this.graphics.strokeRoundedRect(x + 12, y + 12, width - 24, layout.isCompact ? 26 : 30, 8);

    addText(this, this.labels, x + 24, y + 18, `${qteModeLabel(prompt.mode)} | ${this.qte.topic.label}`, {
      fontSize: layout.font.small,
      fontStyle: "900",
      color: this.qte.topic.accentColor
    });
    addText(this, this.labels, x + width - 24, y + 18, `${Math.ceil((prompt.timeMs - elapsed) / 1000)}s`, {
      fontSize: layout.font.small,
      fontStyle: "900",
      color: "#fff7ed",
      align: "right"
    }).setOrigin(1, 0);

    addText(this, this.labels, x + 18, y + 42, prompt.question, {
      fontSize: layout.isCompact ? "18px" : "24px",
      fontStyle: "900",
      color: "#fff7ed",
      lineSpacing: 3,
      maxLines: 2
    }).setWordWrapWidth(width - 36);

    const snippetY = y + (layout.isCompact ? 98 : 114);
    this.drawQteSnippet(layout, x + 18, snippetY, width - 36);

    const barX = x + 18;
    const barY = snippetY + (layout.isCompact ? 62 : 68);
    const barWidth = width - 36;
    this.graphics.fillStyle(0x3b3f31, 1);
    this.graphics.fillRoundedRect(barX, barY, barWidth, 8, 4);
    const dangerPulse = remaining < 0.28 ? 0.72 + Math.sin(this.time.now / 70) * 0.28 : 1;
    this.graphics.fillStyle(remaining < 0.28 ? 0xff4d4f : prompt.mode === "sequence" ? 0xffb000 : this.qte.topic.color, dangerPulse);
    this.graphics.fillRoundedRect(barX, barY, Math.max(6, barWidth * remaining), 10, 5);

    const controlTop = barY + (layout.isCompact ? 26 : 32);

    if (prompt.mode === "sequence") {
      this.drawSequenceQte(layout, x, controlTop, width);
    } else if (prompt.mode === "choice") {
      this.drawChoiceQte(layout, x, controlTop, width);
    } else {
      this.drawLaneQte(layout, x, controlTop, width);
    }
  }

  private drawQteSnippet(layout: Layout, x: number, y: number, width: number): void {
    if (!this.qte) return;

    const height = layout.isCompact ? 48 : 54;
    this.graphics.fillStyle(0x0a0d0b, 0.96);
    this.graphics.fillRoundedRect(x, y, width, height, 8);
    this.graphics.lineStyle(1, this.qte.topic.color, 0.5);
    this.graphics.strokeRoundedRect(x, y, width, height, 8);

    addText(this, this.labels, x + 12, y + 8, this.qte.prompt.snippet, {
      fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
      fontSize: layout.isCompact ? "10px" : "12px",
      color: "#fff7ed",
      lineSpacing: 2,
      maxLines: 2
    }).setWordWrapWidth(width - 24);

    const sourceLabel = addText(this, this.labels, x + 12, y + height - 17, sampleLabelForPath(this.qte.prompt.sourcePath), {
      fontSize: layout.isCompact ? "9px" : "10px",
      color: this.qte.topic.accentColor,
      maxLines: 1
    }).setWordWrapWidth(width - 24);
    underlineText(this.graphics, sourceLabel, this.qte.topic.color, 0.9, 1);
    sourceLabel
      .setInteractive({ useHandCursor: true })
      .on("pointerup", () => window.open(sampleUrlForPath(this.qte?.prompt.sourcePath ?? ""), "_blank", "noopener"));
  }

  private drawQteFeedback(layout: Layout): void {
    if (!this.qteFeedback) return;

    const width = Math.min(layout.width - layout.padding * 2, layout.isCompact ? 330 : 500);
    const height = layout.isCompact ? 92 : 112;
    const x = Math.floor((layout.width - width) / 2);
    const y = Math.max(layout.hudHeight + 12, layout.gridY + Math.floor(layout.gridHeight * 0.16));
    const remaining = Math.max(0, (this.qteFeedback.until - this.time.now) / QTE_FEEDBACK_MS);
    const alpha = Math.max(0.28, Math.min(1, remaining));

    this.graphics.fillStyle(this.qteFeedback.success ? 0x102d1b : 0x351111, 0.88 * alpha);
    this.graphics.fillRoundedRect(x, y, width, height, 8);
    this.graphics.lineStyle(3, this.qteFeedback.color, 0.95 * alpha);
    this.graphics.strokeRoundedRect(x, y, width, height, 8);
    this.graphics.fillStyle(this.qteFeedback.color, 0.12 * alpha);
    this.graphics.fillRect(x + 3, y + 3, Math.max(8, (width - 6) * remaining), height - 6);

    addText(this, this.labels, x + width / 2, y + 18, this.qteFeedback.message, {
      fontSize: layout.isCompact ? "22px" : "30px",
      fontStyle: "900",
      color: "#fff7ed",
      align: "center"
    }).setOrigin(0.5, 0);

    addText(this, this.labels, x + width / 2, y + (layout.isCompact ? 56 : 70), this.qteFeedback.detail, {
      fontSize: layout.font.small,
      fontStyle: "800",
      color: COLORS.muted,
      align: "center"
    })
      .setOrigin(0.5, 0)
      .setWordWrapWidth(width - 36);
  }

  private drawSequenceQte(layout: Layout, x: number, top: number, width: number): void {
    const activeQte = this.qte;
    if (!activeQte || activeQte.prompt.mode !== "sequence") return;

    const size = layout.isCompact ? 44 : 54;
    const gap = layout.isCompact ? 8 : 12;
    const totalWidth = activeQte.prompt.sequence.length * size + (activeQte.prompt.sequence.length - 1) * gap;
    const startX = x + (width - totalWidth) / 2;

    activeQte.prompt.sequence.forEach((direction, index) => {
      const filled = index < activeQte.sequenceInput.length;
      const current = index === activeQte.sequenceInput.length;
      const tileX = startX + index * (size + gap);
      const pulse = current ? 0.75 + Math.sin(this.time.now / 95) * 0.25 : 1;
      this.graphics.fillStyle(filled ? 0x245c31 : current ? 0x3a3320 : 0x252b20, 1);
      this.graphics.fillRoundedRect(tileX, top, size, size, 8);
      this.graphics.lineStyle(current ? 3 : 1, filled ? 0xb8e986 : current ? 0xffb000 : 0xf7f0de, current ? pulse : filled ? 0.8 : 0.35);
      this.graphics.strokeRoundedRect(tileX, top, size, size, 8);
      addText(this, this.labels, tileX + size / 2, top + size / 2, arrowForDirection(direction), {
        fontSize: layout.isCompact ? "23px" : "30px",
        fontStyle: "900",
        color: "#fff7ed"
      }).setOrigin(0.5);
    });

    const padSize = layout.isCompact ? 34 : 40;
    const padGap = layout.isCompact ? 7 : 9;
    const padCenterX = x + width / 2;
    const padTop = top + size + (layout.isCompact ? 18 : 22);
    const padPositions: readonly { direction: Direction; x: number; y: number }[] = [
      { direction: "up", x: padCenterX - padSize / 2, y: padTop },
      { direction: "left", x: padCenterX - padSize * 1.5 - padGap, y: padTop + padSize + padGap },
      { direction: "down", x: padCenterX - padSize / 2, y: padTop + padSize + padGap },
      { direction: "right", x: padCenterX + padSize / 2 + padGap, y: padTop + padSize + padGap }
    ];

    padPositions.forEach((pad, index) => {
      this.graphics.fillStyle(0x151b13, 1);
      this.graphics.fillRoundedRect(pad.x, pad.y, padSize, padSize, 8);
      this.graphics.lineStyle(1, activeQte.topic.color, 0.65);
      this.graphics.strokeRoundedRect(pad.x, pad.y, padSize, padSize, 8);
      this.qteHitZones.push({
        rect: new Phaser.Geom.Rectangle(pad.x, pad.y, padSize, padSize),
        index,
        direction: pad.direction
      });
      addText(this, this.labels, pad.x + padSize / 2, pad.y + padSize / 2, arrowForDirection(pad.direction), {
        fontSize: layout.isCompact ? "18px" : "22px",
        fontStyle: "900",
        color: "#fff7ed"
      }).setOrigin(0.5);
    });

    addText(this, this.labels, x + width / 2, padTop + padSize * 2 + padGap + 10, "Trace the pattern. A wrong step drops the signal.", {
      fontSize: layout.font.small,
      color: COLORS.muted,
      align: "center"
    }).setOrigin(0.5, 0);
  }

  private drawChoiceQte(layout: Layout, x: number, top: number, width: number): void {
    const activeQte = this.qte;
    if (!activeQte || activeQte.prompt.mode !== "choice") return;

    const prompt = activeQte.prompt;
    const buttonHeight = layout.isCompact ? 50 : 56;
    const gap = layout.isCompact ? 8 : 10;

    prompt.choices.forEach((choice, index) => {
      const buttonX = x + 18;
      const buttonY = top + index * (buttonHeight + gap);
      const buttonWidth = width - 36;
      const badgeSize = layout.isCompact ? 28 : 32;
      this.graphics.fillStyle(0x252b20, 1);
      this.graphics.fillRoundedRect(buttonX, buttonY, buttonWidth, buttonHeight, 8);
      this.graphics.lineStyle(1, activeQte.topic.color, 0.55);
      this.graphics.strokeRoundedRect(buttonX, buttonY, buttonWidth, buttonHeight, 8);
      this.graphics.fillStyle(activeQte.topic.color, 0.2);
      this.graphics.fillRoundedRect(buttonX + 10, buttonY + (buttonHeight - badgeSize) / 2, badgeSize, badgeSize, 7);
      this.graphics.lineStyle(1, activeQte.topic.color, 0.7);
      this.graphics.strokeRoundedRect(buttonX + 10, buttonY + (buttonHeight - badgeSize) / 2, badgeSize, badgeSize, 7);
      this.qteHitZones.push({
        rect: new Phaser.Geom.Rectangle(buttonX, buttonY, buttonWidth, buttonHeight),
        index
      });

      addText(this, this.labels, buttonX + 10 + badgeSize / 2, buttonY + buttonHeight / 2, String(index + 1), {
        fontSize: layout.font.small,
        fontStyle: "900",
        color: "#fff7ed",
        align: "center"
      }).setOrigin(0.5);

      addText(this, this.labels, buttonX + badgeSize + 22, buttonY + buttonHeight / 2, choice, {
        fontSize: layout.font.small,
        fontStyle: "700",
        color: "#fff7ed",
        maxLines: 2
      })
        .setOrigin(0, 0.5)
        .setWordWrapWidth(buttonWidth - badgeSize - 36);
    });
  }

  private drawLaneQte(layout: Layout, x: number, top: number, width: number): void {
    const activeQte = this.qte;
    if (!activeQte || activeQte.prompt.mode !== "lane") return;

    const prompt = activeQte.prompt;
    const gap = layout.isCompact ? 8 : 12;
    const laneWidth = Math.floor((width - 36 - gap * 2) / 3);
    const laneHeight = layout.isCompact ? 92 : 108;
    const labels: readonly [string, string, string] = ["A", "S", "D"];
    const sublabels: readonly [string, string, string] = ["Left", "Center", "Right"];

    prompt.lanes.forEach((lane, index) => {
      const laneX = x + 18 + index * (laneWidth + gap);
      this.graphics.fillStyle(0x252b20, 1);
      this.graphics.fillRoundedRect(laneX, top, laneWidth, laneHeight, 8);
      this.graphics.lineStyle(1, activeQte.topic.color, 0.55);
      this.graphics.strokeRoundedRect(laneX, top, laneWidth, laneHeight, 8);
      this.graphics.fillStyle(activeQte.topic.color, 0.18);
      this.graphics.fillRoundedRect(laneX + 10, top + 10, laneWidth - 20, layout.isCompact ? 26 : 30, 7);
      this.qteHitZones.push({
        rect: new Phaser.Geom.Rectangle(laneX, top, laneWidth, laneHeight),
        index
      });

      addText(this, this.labels, laneX + laneWidth / 2, top + 12, labels[index], {
        fontSize: layout.isCompact ? "14px" : "16px",
        fontStyle: "900",
        color: "#fff7ed",
        align: "center"
      }).setOrigin(0.5, 0);

      addText(this, this.labels, laneX + laneWidth / 2, top + (layout.isCompact ? 31 : 34), sublabels[index], {
        fontSize: layout.isCompact ? "10px" : "12px",
        fontStyle: "800",
        color: COLORS.muted,
        align: "center"
      }).setOrigin(0.5, 0);

      addText(this, this.labels, laneX + laneWidth / 2, top + laneHeight / 2 + 12, lane, {
        fontSize: layout.font.small,
        fontStyle: "800",
        color: "#fff7ed",
        align: "center",
        maxLines: 3
      })
        .setOrigin(0.5)
        .setWordWrapWidth(laneWidth - 16);
    });
  }

  private cellCenter(layout: Layout, point: Point): Point {
    return {
      x: layout.gridX + point.x * layout.cell + layout.cell / 2,
      y: layout.gridY + point.y * layout.cell + layout.cell / 2
    };
  }

  private createPickupBurst(cell: Point, topic: TopicFact): void {
    const layout = computeLayout(this.scale.width, this.scale.height);
    const center = this.cellCenter(layout, cell);
    const emitter = this.add.particles(center.x, center.y, "spark", {
      lifespan: 420,
      speed: { min: 40, max: 130 },
      scale: { start: 0.85, end: 0 },
      quantity: 1,
      tint: topic.color,
      blendMode: "ADD"
    });

    emitter.explode(18);
    this.time.delayedCall(520, () => emitter.destroy());
  }

  private createQteResultBurst(topic: TopicFact, success: boolean): void {
    const emitter = this.add.particles(this.scale.width / 2, this.scale.height / 2, "spark", {
      lifespan: success ? 560 : 420,
      speed: { min: success ? 90 : 45, max: success ? 260 : 150 },
      scale: { start: success ? 1.15 : 0.9, end: 0 },
      quantity: 1,
      tint: success ? topic.color : 0xff4d4f,
      blendMode: "ADD"
    });

    emitter.explode(success ? 42 : 24);
    this.time.delayedCall(success ? 680 : 520, () => emitter.destroy());
  }

  private createGhostRecoveredBurst(): void {
    const emitter = this.add.particles(this.scale.width / 2, this.scale.height / 2, "spark", {
      lifespan: 640,
      speed: { min: 80, max: 230 },
      scale: { start: 1.05, end: 0 },
      quantity: 1,
      tint: 0xb8e9ff,
      blendMode: "ADD"
    });

    emitter.explode(36);
    this.cameras.main.flash(170, 184, 233, 255, false);
    this.time.delayedCall(740, () => emitter.destroy());
  }

  private clearLabels(): void {
    for (const label of this.labels) {
      label.destroy();
    }
    this.labels = [];
  }
}

function isQtePrompt(prompt: QtePrompt | undefined): prompt is QtePrompt {
  return prompt !== undefined;
}

function directionForKey(key: string): Direction | undefined {
  const normalized = key.toLowerCase();
  if (normalized === "arrowup" || normalized === "w") return "up";
  if (normalized === "arrowdown" || normalized === "s") return "down";
  if (normalized === "arrowleft" || normalized === "a") return "left";
  if (normalized === "arrowright" || normalized === "d") return "right";
  return undefined;
}

function directionFromSwipe(start: Point, end: Point): Direction | undefined {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 22) return undefined;
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? "right" : "left";
  }
  return dy > 0 ? "down" : "up";
}

function numericIndexForKey(key: string): number | undefined {
  if (key === "1") return 0;
  if (key === "2") return 1;
  if (key === "3") return 2;
  return undefined;
}

function laneIndexForKey(key: string, direction?: Direction): number | undefined {
  const normalized = key.toLowerCase();
  if (normalized === "a" || direction === "left") return 0;
  if (normalized === "s" || direction === "up" || direction === "down") return 1;
  if (normalized === "d" || direction === "right") return 2;
  return undefined;
}

function qteModeLabel(mode: QtePrompt["mode"]): string {
  if (mode === "sequence") return "Trace";
  if (mode === "choice") return "Decode";
  return "Route";
}

function arrowForDirection(direction: Direction): string {
  if (direction === "up") return "^";
  if (direction === "down") return "v";
  if (direction === "left") return "<";
  return ">";
}

function clonePoint(point: Point): Point {
  return { x: point.x, y: point.y };
}

function cloneSnakeState(state: SnakeState): SnakeState {
  return {
    ...state,
    snake: state.snake.map(clonePoint),
    segmentTopicIds: state.snake.map((_, index) => state.segmentTopicIds[index]),
    collectedTopicIds: [...state.collectedTopicIds]
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function sampleUrlForPath(path: string): string {
  if (!path.trim()) return SOURCE_REPO_URL;
  if (/^https?:\/\//i.test(path)) return path;

  const route = /\.[a-z0-9]+$/i.test(path) ? "blob" : "tree";
  return `${SOURCE_REPO_URL}/${route}/main/${path}`;
}

function sampleLabelForPath(path: string): string {
  const blobPrefix = `${SOURCE_REPO_URL}/blob/main/`;
  const treePrefix = `${SOURCE_REPO_URL}/tree/main/`;

  if (path.startsWith(blobPrefix)) return path.slice(blobPrefix.length);
  if (path.startsWith(treePrefix)) return path.slice(treePrefix.length);
  return path;
}
