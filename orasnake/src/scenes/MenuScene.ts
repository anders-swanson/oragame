import Phaser from "phaser";
import { ORACLE_TOPICS } from "../content/oracleFacts";
import { computeLayout, type Layout } from "../game/layout";
import type { TopicFact } from "../game/types";
import { addText, addTextLink, COLORS, drawBackground, ORAGAME_HOME_URL, roundedPanel } from "./draw";

const SOURCE_REPO_URL = "https://github.com/anders-swanson/oracle-database-code-samples";
const MENU_PREVIEW_TOPIC_IDS = [
  "oracle-ai-database-free",
  "vector-search",
  "hybrid-indexing",
  "json",
  "duality-views",
  "property-graph",
  "txeventq",
  "spatial",
  "oracle-text"
] as const;

export class MenuScene extends Phaser.Scene {
  private graphics!: Phaser.GameObjects.Graphics;
  private labels: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super("MenuScene");
  }

  create(): void {
    this.graphics = this.add.graphics();
    this.input.keyboard?.on("keydown-SPACE", this.startGame, this);
    this.input.keyboard?.on("keydown-ENTER", this.startGame, this);
    this.scale.on("resize", this.render, this);
    this.events.once("shutdown", () => {
      this.input.keyboard?.off("keydown-SPACE", this.startGame, this);
      this.input.keyboard?.off("keydown-ENTER", this.startGame, this);
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
      fontStyle: "700",
      color: "#f7f0de"
    });
    addText(this, this.labels, layout.width - layout.padding, 16, "Oracle AI Database arcade", {
      fontSize: layout.font.small,
      color: COLORS.muted
    }).setOrigin(1, 0);

    const titleY = layout.isCompact ? layout.hudHeight + 18 : layout.hudHeight + 42;
    addText(this, this.labels, layout.width / 2, titleY, "Snake through database signals", {
      fontSize: layout.isCompact ? "22px" : layout.font.title,
      fontStyle: "800",
      align: "center"
    })
      .setOrigin(0.5, 0)
      .setWordWrapWidth(Math.min(layout.width - layout.padding * 2, 760));

    addText(
      this,
      this.labels,
      layout.width / 2,
      titleY + (layout.isCompact ? 66 : 56),
      "Collect topic pickups, clear quick Oracle prompts, and keep the combo alive.",
      {
        fontSize: layout.font.base,
        color: COLORS.muted,
        align: "center"
      }
    )
      .setOrigin(0.5, 0)
      .setWordWrapWidth(Math.min(layout.width - layout.padding * 2, 660));

    this.drawStartButton(layout);
    this.drawTopicPreview(layout);
    this.drawControls(layout);
    this.drawFooterLinks(layout);
  }

  private drawStartButton(layout: Layout): void {
    const width = layout.isCompact ? Math.min(260, layout.width - layout.padding * 2) : 300;
    const height = layout.isCompact ? 46 : 54;
    const x = (layout.width - width) / 2;
    const y = layout.isCompact ? layout.hudHeight + 132 : layout.hudHeight + 140;

    this.graphics.fillStyle(COLORS.oracleRed, 1);
    this.graphics.fillRoundedRect(x, y, width, height, 8);
    this.graphics.lineStyle(2, 0xffd6d6, 0.8);
    this.graphics.strokeRoundedRect(x, y, width, height, 8);

    const hit = this.add
      .zone(x, y, width, height)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true })
      .on("pointerup", this.startGame, this);
    this.labels.push(hit);

    addText(this, this.labels, x + width / 2, y + height / 2, "Start", {
      fontSize: layout.isCompact ? "18px" : "22px",
      fontStyle: "800",
      color: "#fff7ed"
    }).setOrigin(0.5);
  }

  private drawTopicPreview(layout: Layout): void {
    const startY = layout.isCompact ? layout.hudHeight + 210 : layout.hudHeight + 230;
    const columns = layout.isCompact ? 2 : 3;
    const gap = layout.isCompact ? 8 : 12;
    const availableWidth = Math.min(layout.width - layout.padding * 2, layout.isCompact ? 560 : 820);
    const cardWidth = Math.floor((availableWidth - gap * (columns - 1)) / columns);
    const cardHeight = layout.isCompact ? 72 : 92;
    const startX = Math.floor((layout.width - availableWidth) / 2);
    const footerReserve = layout.isCompact ? 100 : 94;
    const availableHeight = Math.max(0, layout.height - startY - footerReserve - layout.padding);
    const rows = Math.min(layout.isCompact ? 2 : 3, Math.floor((availableHeight + gap) / (cardHeight + gap)));
    if (rows <= 0) return;
    const previewTopics = this.previewTopics(columns * rows);

    previewTopics.forEach((topic, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const x = startX + column * (cardWidth + gap);
      const y = startY + row * (cardHeight + gap);

      roundedPanel(this.graphics, x, y, cardWidth, cardHeight, 0x11140f, 0.92);
      this.graphics.fillStyle(topic.color, 1);
      this.graphics.fillCircle(x + 20, y + 22, layout.isCompact ? 7 : 9);

      addText(this, this.labels, x + 36, y + 12, topic.label, {
        fontSize: layout.isCompact ? "11px" : "14px",
        fontStyle: "800",
        color: "#fff7ed",
        maxLines: 2
      }).setWordWrapWidth(cardWidth - 46);

      if (!layout.isCompact) {
        addText(this, this.labels, x + 14, y + 42, topic.shortFact, {
          fontSize: "12px",
          color: COLORS.muted,
          lineSpacing: 2,
          maxLines: 3
        }).setWordWrapWidth(cardWidth - 28);
      }
    });
  }

  private drawControls(layout: Layout): void {
    const text = layout.isCompact
      ? "Swipe or use WASD/arrows. Mini-game prompts: tap choices or steer."
      : "Move with arrows or WASD. Swipe on touch screens. Mini-game prompts accept keys, lanes, and taps.";
    addText(this, this.labels, layout.width / 2, layout.height - layout.padding - (layout.isCompact ? 62 : 50), text, {
      fontSize: layout.font.small,
      color: COLORS.muted,
      align: "center"
    })
      .setOrigin(0.5, 0)
      .setWordWrapWidth(layout.width - layout.padding * 2);
  }

  private drawFooterLinks(layout: Layout): void {
    const y = layout.height - layout.padding - 22;
    const gap = layout.isCompact ? 56 : 170;
    const homeText = layout.isCompact ? "Oragame" : "Oragame home";
    const sourceText = layout.isCompact ? "Samples" : "Sample repo";

    addTextLink(this, this.labels, this.graphics, layout.width / 2 - gap, y, homeText, ORAGAME_HOME_URL, {
      fontSize: layout.font.small,
      align: "center"
    }, 0.5, "same-tab");

    addTextLink(this, this.labels, this.graphics, layout.width / 2 + gap, y, sourceText, SOURCE_REPO_URL, {
      fontSize: layout.font.small,
      align: "center"
    }, 0.5);
  }

  private previewTopics(limit: number): readonly TopicFact[] {
    return MENU_PREVIEW_TOPIC_IDS.map((id) => ORACLE_TOPICS.find((topic) => topic.id === id))
      .filter((topic): topic is TopicFact => topic !== undefined)
      .slice(0, limit);
  }

  private clearLabels(): void {
    for (const label of this.labels) {
      label.destroy();
    }
    this.labels = [];
  }

  private startGame(): void {
    this.scene.start("GameScene");
  }
}
