import Phaser from "phaser";
import type { Layout } from "../game/layout";

export const COLORS = {
  background: 0x070806,
  panel: 0x141711,
  panelSoft: 0x1d2118,
  grid: 0x2b3025,
  gridStrong: 0x4a533f,
  text: "#f7f0de",
  muted: "#c9c0a7",
  oracleRed: 0xc62828,
  obstacle: 0x7f1d1d,
  snakeHead: 0xffd6d1,
  snakeBody: 0xda291c
};

export const ORAGAME_HOME_URL = "https://anders-swanson.github.io/oragame/";

type LinkTarget = "same-tab" | "new-tab";

export function drawBackground(graphics: Phaser.GameObjects.Graphics, layout: Layout): void {
  graphics.fillStyle(COLORS.background, 1);
  graphics.fillRect(0, 0, layout.width, layout.height);

  graphics.lineStyle(1, 0x171a14, 1);
  const spacing = layout.isCompact ? 28 : 36;
  for (let x = 0; x < layout.width; x += spacing) {
    graphics.lineBetween(x, 0, x, layout.height);
  }
  for (let y = 0; y < layout.height; y += spacing) {
    graphics.lineBetween(0, y, layout.width, y);
  }

  graphics.fillStyle(0x0c0e0a, 0.82);
  graphics.fillRect(0, 0, layout.width, layout.hudHeight);
  graphics.lineStyle(2, COLORS.oracleRed, 0.75);
  graphics.lineBetween(0, layout.hudHeight, layout.width, layout.hudHeight);
}

export function addText(
  scene: Phaser.Scene,
  labels: Phaser.GameObjects.GameObject[],
  x: number,
  y: number,
  text: string,
  style: Phaser.Types.GameObjects.Text.TextStyle
): Phaser.GameObjects.Text {
  const label = scene.add.text(x, y, text, {
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    color: COLORS.text,
    letterSpacing: 0,
    ...style
  });
  labels.push(label);
  return label;
}

export function addTextLink(
  scene: Phaser.Scene,
  labels: Phaser.GameObjects.GameObject[],
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  text: string,
  url: string,
  style: Phaser.Types.GameObjects.Text.TextStyle,
  originX = 0,
  target: LinkTarget = "new-tab"
): Phaser.GameObjects.Text {
  const label = addText(scene, labels, x, y, text, {
    fontStyle: "800",
    color: "#ffd6d1",
    ...style
  }).setOrigin(originX, 0);

  underlineText(graphics, label);
  label.setInteractive({ useHandCursor: true }).on("pointerup", () => {
    if (target === "same-tab") {
      window.location.assign(url);
      return;
    }

    window.open(url, "_blank", "noopener,noreferrer");
  });

  return label;
}

export function underlineText(
  graphics: Phaser.GameObjects.Graphics,
  label: Phaser.GameObjects.Text,
  color = 0xffd6d1,
  alpha = 0.95,
  thickness = 2
): void {
  const bounds = label.getBounds();
  graphics.lineStyle(thickness, color, alpha);
  graphics.lineBetween(bounds.left, bounds.bottom + 2, bounds.right, bounds.bottom + 2);
}

export function roundedPanel(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  fill = COLORS.panel,
  alpha = 0.94
): void {
  graphics.fillStyle(fill, alpha);
  graphics.fillRoundedRect(x, y, width, height, 8);
  graphics.lineStyle(1, 0x3a402e, 0.85);
  graphics.strokeRoundedRect(x, y, width, height, 8);
}
