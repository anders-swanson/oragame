import Phaser from "phaser";
import { topicById } from "../content/oracleFacts";
import { computeLayout, type Layout } from "../game/layout";
import { addText, COLORS, drawBackground, roundedPanel, underlineText } from "./draw";
import type { GameOverPayload } from "./GameScene";

const SOURCE_REPO_URL = "https://github.com/anders-swanson/oracle-database-code-samples";
const GHOST_FOOD_COUNT = 4;

export class GameOverScene extends Phaser.Scene {
  private graphics!: Phaser.GameObjects.Graphics;
  private labels: Phaser.GameObjects.GameObject[] = [];
  private payload: GameOverPayload = {
    score: 0,
    insight: 0,
    bestCombo: 1,
    collectedTopicIds: [],
    reason: "none"
  };

  constructor() {
    super("GameOverScene");
  }

  init(data: GameOverPayload): void {
    this.payload = data;
  }

  create(): void {
    this.graphics = this.add.graphics();
    this.input.keyboard?.on("keydown", this.handleKeyDown, this);
    this.scale.on("resize", this.render, this);
    this.time.addEvent({
      delay: 260,
      loop: true,
      callback: this.render,
      callbackScope: this
    });
    this.events.once("shutdown", () => {
      this.input.keyboard?.off("keydown", this.handleKeyDown, this);
      this.scale.off("resize", this.render, this);
    });
    this.render();
  }

  private render(): void {
    const layout = computeLayout(this.scale.width, this.scale.height);
    this.clearLabels();
    this.graphics.clear();
    drawBackground(this.graphics, layout);

    addText(this, this.labels, layout.padding, 14, "ORASNAKE", {
      fontSize: layout.isCompact ? "18px" : "22px",
      fontStyle: "800",
      color: "#fff7ed"
    });
    this.drawSourceLink(layout, layout.width - layout.padding, 18, layout.isCompact ? "Samples" : "Open sample repo", SOURCE_REPO_URL, 1);

    const panelWidth = Math.min(layout.width - layout.padding * 2, layout.isCompact ? 360 : 720);
    const panelHeight = Math.min(layout.height - layout.hudHeight - layout.padding * 2, layout.isCompact ? 540 : 540);
    const panelX = Math.floor((layout.width - panelWidth) / 2);
    const panelY = layout.hudHeight + layout.padding;
    roundedPanel(this.graphics, panelX, panelY, panelWidth, panelHeight, 0x12150f, 0.98);

    this.drawCrashBadge(layout, panelX, panelY, panelWidth);

    addText(this, this.labels, panelX + panelWidth / 2, panelY + 24, "Run Interrupted", {
      fontSize: layout.font.title,
      fontStyle: "900",
      align: "center"
    }).setOrigin(0.5, 0);

    const reason = this.payload.reason === "none" ? "Board cleared" : `${this.payload.reason} collision`;
    addText(this, this.labels, panelX + panelWidth / 2, panelY + (layout.isCompact ? 58 : 76), reason, {
      fontSize: layout.font.base,
      color: COLORS.muted,
      align: "center"
    }).setOrigin(0.5, 0);

    this.drawStats(layout, panelX, panelY, panelWidth);
    this.drawLearned(layout, panelX, panelY, panelWidth);
    this.drawRecoveryPrompt(layout, panelX, panelY, panelWidth, panelHeight);
    this.drawRestart(layout, panelX, panelY, panelWidth, panelHeight);
  }

  private drawStats(layout: Layout, panelX: number, panelY: number, panelWidth: number): void {
    const stats = [
      ["Score", String(this.payload.score)],
      ["Insight", String(this.payload.insight)],
      ["Best combo", `x${this.payload.bestCombo.toFixed(2)}`]
    ];
    const top = panelY + (layout.isCompact ? 98 : 126);
    const gap = layout.isCompact ? 8 : 12;
    const statWidth = Math.floor((panelWidth - 36 - gap * 2) / 3);

    stats.forEach(([label, value], index) => {
      const x = panelX + 18 + index * (statWidth + gap);
      roundedPanel(this.graphics, x, top, statWidth, layout.isCompact ? 64 : 76, 0x1c2118, 0.9);
      addText(this, this.labels, x + statWidth / 2, top + 12, label, {
        fontSize: layout.isCompact ? "10px" : "12px",
        fontStyle: "800",
        color: COLORS.muted,
        align: "center"
      }).setOrigin(0.5, 0);
      addText(this, this.labels, x + statWidth / 2, top + (layout.isCompact ? 32 : 38), value, {
        fontSize: layout.isCompact ? "18px" : "24px",
        fontStyle: "900",
        align: "center"
      }).setOrigin(0.5, 0);
    });
  }

  private drawCrashBadge(layout: Layout, panelX: number, panelY: number, panelWidth: number): void {
    if (layout.isCompact) return;

    const x = panelX + panelWidth - 116;
    const y = panelY + 22;
    const size = 74;
    this.graphics.fillStyle(0x070806, 0.78);
    this.graphics.fillRoundedRect(x, y, size, size, 8);
    this.graphics.lineStyle(1, 0x7f1d1d, 0.8);
    this.graphics.strokeRoundedRect(x, y, size, size, 8);

    const snake = [
      { x: x + 22, y: y + 50 },
      { x: x + 34, y: y + 42 },
      { x: x + 46, y: y + 34 },
      { x: x + 54, y: y + 24 }
    ];
    snake.forEach((point, index) => {
      this.graphics.fillStyle(index === snake.length - 1 ? COLORS.snakeHead : COLORS.snakeBody, index === 0 ? 0.7 : 0.92);
      this.graphics.fillCircle(point.x, point.y, index === snake.length - 1 ? 10 : 8);
    });
    this.graphics.fillStyle(0x231815, 1);
    this.graphics.fillCircle(x + 51, y + 21, 2);
    this.graphics.fillCircle(x + 57, y + 25, 2);
    this.graphics.lineStyle(2, 0xffd6d1, 0.85);
    this.graphics.lineBetween(x + 16, y + 58, x + 58, y + 16);
  }

  private drawLearned(layout: Layout, panelX: number, panelY: number, panelWidth: number): void {
    const learned = this.payload.collectedTopicIds.map(topicById);
    const top = panelY + (layout.isCompact ? 176 : 220);
    const maxTopics = layout.isCompact ? 2 : 4;

    addText(this, this.labels, panelX + 18, top, "Learned Topics", {
      fontSize: layout.font.base,
      fontStyle: "900"
    });

    if (learned.length === 0) {
      addText(this, this.labels, panelX + 18, top + 34, "No pickups collected yet.", {
        fontSize: layout.font.small,
        color: COLORS.muted
      }).setWordWrapWidth(panelWidth - 36);
      return;
    }

    if (learned.length > maxTopics) {
      addText(this, this.labels, panelX + panelWidth - 18, top + 2, `+${learned.length - maxTopics} more`, {
        fontSize: layout.isCompact ? "10px" : "12px",
        fontStyle: "800",
        color: COLORS.muted,
        align: "right"
      }).setOrigin(1, 0);
    }

    learned.slice(-maxTopics).forEach((topic, index) => {
      const columnCount = layout.isCompact ? 1 : 2;
      const column = index % columnCount;
      const row = Math.floor(index / columnCount);
      const columnWidth = layout.isCompact ? panelWidth - 60 : Math.floor((panelWidth - 72) / 2);
      const x = layout.isCompact ? panelX + 28 : panelX + 28 + column * (columnWidth + 24);
      const y = top + 36 + row * (layout.isCompact ? 34 : 32);
      this.graphics.fillStyle(topic.color, 1);
      this.graphics.fillCircle(x, y + 9, 6);
      const label = addText(this, this.labels, x + 14, y, topic.label, {
        fontSize: layout.font.small,
        fontStyle: "800",
        color: topic.accentColor,
        maxLines: 1
      }).setWordWrapWidth(columnWidth - 14);
      underlineText(this.graphics, label, topic.color, 0.9, 1);
      label.setInteractive({ useHandCursor: true }).on("pointerup", () => window.open(topic.sourceUrl, "_blank", "noopener,noreferrer"));
    });
  }

  private drawRecoveryPrompt(
    layout: Layout,
    panelX: number,
    panelY: number,
    panelWidth: number,
    panelHeight: number
  ): void {
    const top = panelY + panelHeight - (layout.isCompact ? 218 : 226);
    const hasRecovery = this.payload.recoverySnapshot !== undefined;
    const title = hasRecovery ? "Ghost Recovery" : "Run Recovery";
    const subtitle = hasRecovery ? "Continue as a ghost snake. Eat 4 foods to return to normal." : "Start a fresh run.";

    addText(this, this.labels, panelX + 18, top, title, {
      fontSize: layout.font.base,
      fontStyle: "900",
      color: hasRecovery ? "#b8e986" : "#fff7ed"
    });
    addText(this, this.labels, panelX + 18, top + 26, subtitle, {
      fontSize: layout.font.small,
      color: COLORS.muted,
      maxLines: 2
    }).setWordWrapWidth(panelWidth - 36);

    if (!hasRecovery) return;

    const tileSize = layout.isCompact ? 32 : 42;
    const gap = layout.isCompact ? 10 : 14;
    const totalWidth = GHOST_FOOD_COUNT * tileSize + (GHOST_FOOD_COUNT - 1) * gap;
    const startX = panelX + (panelWidth - totalWidth) / 2;
    const tileY = top + (layout.isCompact ? 62 : 70);

    for (let index = 0; index < GHOST_FOOD_COUNT; index += 1) {
      const x = startX + index * (tileSize + gap);

      this.graphics.fillStyle(0x254f2d, 1);
      this.graphics.fillRoundedRect(x, tileY, tileSize, tileSize, 8);
      this.graphics.lineStyle(1, 0xb8e986, 0.78);
      this.graphics.strokeRoundedRect(x, tileY, tileSize, tileSize, 8);
      addText(this, this.labels, x + tileSize / 2, tileY + tileSize / 2, String(index + 1), {
        fontSize: layout.isCompact ? "16px" : "22px",
        fontStyle: "900",
        color: "#fff7ed"
      }).setOrigin(0.5);
    }
  }

  private drawRestart(layout: Layout, panelX: number, panelY: number, panelWidth: number, panelHeight: number): void {
    const width = Math.min(260, panelWidth - 36);
    const height = layout.isCompact ? 44 : 52;
    const x = panelX + (panelWidth - width) / 2;
    const y = panelY + panelHeight - height - 22;

    this.graphics.fillStyle(COLORS.oracleRed, 1);
    this.graphics.fillRoundedRect(x, y, width, height, 8);
    this.graphics.lineStyle(2, 0xffd6d6, 0.8);
    this.graphics.strokeRoundedRect(x, y, width, height, 8);

    const hit = this.add
      .zone(x, y, width, height)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true })
      .on("pointerup", () => this.restart());
    this.labels.push(hit);

    addText(this, this.labels, x + width / 2, y + height / 2, this.restartButtonText(), {
      fontSize: layout.isCompact ? "17px" : "21px",
      fontStyle: "900",
      color: "#fff7ed"
    }).setOrigin(0.5);
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (event.key === " " || event.key === "Enter") {
      this.restart();
      event.preventDefault();
    }
  }

  private restartButtonText(): string {
    return this.payload.recoverySnapshot ? "Continue Run" : "New Run";
  }

  private clearLabels(): void {
    for (const label of this.labels) {
      label.destroy();
    }
    this.labels = [];
  }

  private restart(): void {
    if (this.payload.recoverySnapshot) {
      this.scene.start("GameScene", { recoverySnapshot: this.payload.recoverySnapshot });
      return;
    }

    this.scene.start("GameScene");
  }

  private drawSourceLink(layout: Layout, x: number, y: number, text: string, url: string, originX = 0): void {
    const label = addText(this, this.labels, x, y, text, {
      fontSize: layout.font.small,
      fontStyle: "800",
      color: "#ffd6d1",
      align: originX === 1 ? "right" : "left",
      maxLines: 1
    }).setOrigin(originX, 0);
    underlineText(this.graphics, label);
    label.setInteractive({ useHandCursor: true }).on("pointerup", () => window.open(url, "_blank", "noopener,noreferrer"));
  }
}
