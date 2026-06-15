import Phaser from "phaser";
import { ORACLE_TOPICS } from "../content/oracleFacts";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload(): void {
    for (const topic of ORACLE_TOPICS) {
      this.load.svg(`pickup-${topic.id}`, topic.iconPath, { width: 128, height: 128 });
    }
  }

  create(): void {
    this.input.addPointer(2);
    this.createGeneratedTextures();
    this.scene.start("MenuScene");
  }

  private createGeneratedTextures(): void {
    this.createSparkTexture();

    for (const topic of ORACLE_TOPICS) {
      const key = `pickup-${topic.id}`;
      if (this.textures.exists(key)) continue;

      const graphics = this.add.graphics();
      graphics.clear();
      graphics.fillStyle(topic.color, 1);
      graphics.lineStyle(3, 0xfaf3dd, 0.9);

      if (topic.pickupStyle === "diamond") {
        graphics.beginPath();
        graphics.moveTo(18, 2);
        graphics.lineTo(34, 18);
        graphics.lineTo(18, 34);
        graphics.lineTo(2, 18);
        graphics.closePath();
        graphics.fillPath();
        graphics.strokePath();
      } else if (topic.pickupStyle === "chip") {
        graphics.fillRoundedRect(3, 6, 30, 24, 5);
        graphics.strokeRoundedRect(3, 6, 30, 24, 5);
        graphics.lineStyle(2, 0x0b0d09, 0.55);
        graphics.lineBetween(10, 11, 26, 11);
        graphics.lineBetween(10, 18, 26, 18);
        graphics.lineBetween(10, 25, 23, 25);
      } else if (topic.pickupStyle === "graph") {
        graphics.fillCircle(9, 26, 6);
        graphics.fillCircle(18, 9, 6);
        graphics.fillCircle(28, 25, 6);
        graphics.strokeCircle(9, 26, 6);
        graphics.strokeCircle(18, 9, 6);
        graphics.strokeCircle(28, 25, 6);
        graphics.lineStyle(3, topic.color, 1);
        graphics.lineBetween(11, 22, 17, 14);
        graphics.lineBetween(21, 14, 26, 21);
      } else if (topic.pickupStyle === "queue") {
        graphics.fillRoundedRect(3, 8, 30, 20, 8);
        graphics.strokeRoundedRect(3, 8, 30, 20, 8);
        graphics.lineStyle(2, 0x0b0d09, 0.5);
        graphics.lineBetween(10, 18, 26, 18);
        graphics.lineBetween(22, 14, 27, 18);
        graphics.lineBetween(22, 22, 27, 18);
      } else if (topic.pickupStyle === "ticket") {
        graphics.fillRoundedRect(3, 5, 30, 26, 5);
        graphics.strokeRoundedRect(3, 5, 30, 26, 5);
        graphics.fillStyle(0x0b0d09, 0.35);
        graphics.fillCircle(3, 18, 4);
        graphics.fillCircle(33, 18, 4);
      } else {
        graphics.fillCircle(18, 18, 15);
        graphics.strokeCircle(18, 18, 15);
        graphics.fillStyle(0xffffff, 0.4);
        graphics.fillCircle(12, 11, 4);
      }

      graphics.generateTexture(key, 36, 36);
      graphics.destroy();
    }
  }

  private createSparkTexture(): void {
    if (this.textures.exists("spark")) return;

    const graphics = this.add.graphics();
    graphics.fillStyle(0xffffff, 1);
    graphics.fillCircle(4, 4, 4);
    graphics.generateTexture("spark", 8, 8);
    graphics.destroy();
  }
}
