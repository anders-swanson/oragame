import type { GridSize } from "./types";

export const GRID: GridSize = {
  width: 30,
  height: 22
};

export interface Layout {
  readonly width: number;
  readonly height: number;
  readonly isCompact: boolean;
  readonly padding: number;
  readonly hudHeight: number;
  readonly infoHeight: number;
  readonly gridX: number;
  readonly gridY: number;
  readonly cell: number;
  readonly gridWidth: number;
  readonly gridHeight: number;
  readonly sideX: number;
  readonly sideWidth: number;
  readonly font: {
    readonly tiny: string;
    readonly small: string;
    readonly base: string;
    readonly title: string;
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function computeLayout(width: number, height: number): Layout {
  const isCompact = width < 720 || height < 560;
  const padding = isCompact ? 12 : 24;
  const hudHeight = isCompact ? 66 : 72;
  const infoHeight = isCompact ? 104 : 0;
  const sideWidth = isCompact ? 0 : clamp(Math.floor(width * 0.22), 190, 250);
  const maxGridWidth = width - padding * (isCompact ? 2 : 3) - sideWidth;
  const maxGridHeight = height - hudHeight - padding * 2 - infoHeight;
  const cell = Math.max(8, Math.floor(Math.min(maxGridWidth / GRID.width, maxGridHeight / GRID.height)));
  const gridWidth = cell * GRID.width;
  const gridHeight = cell * GRID.height;
  const gridX = isCompact ? Math.floor((width - gridWidth) / 2) : padding;
  const gridY = hudHeight + padding;

  return {
    width,
    height,
    isCompact,
    padding,
    hudHeight,
    infoHeight,
    gridX,
    gridY,
    cell,
    gridWidth,
    gridHeight,
    sideX: gridX + gridWidth + padding,
    sideWidth,
    font: {
      tiny: `${isCompact ? 10 : 12}px`,
      small: `${isCompact ? 12 : 14}px`,
      base: `${isCompact ? 14 : 17}px`,
      title: `${isCompact ? 24 : 36}px`
    }
  };
}
