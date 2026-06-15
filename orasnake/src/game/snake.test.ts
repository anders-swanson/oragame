import { describe, expect, it } from "vitest";
import {
  advanceGhostSnake,
  advanceSnake,
  awardPickup,
  chooseSpawnCell,
  createInitialSnakeState,
  learnTopic,
  listFreeCells,
  pointsEqual,
  withDirection
} from "./snake";
import type { GridSize, SnakeState } from "./types";

const grid: GridSize = { width: 8, height: 8 };

describe("snake movement", () => {
  it("moves the head in the current direction and trims the tail", () => {
    const state = createInitialSnakeState(grid);
    const result = advanceSnake(state, grid);

    expect(result.collision.type).toBe("none");
    expect(result.state.snake[0]).toEqual({ x: 5, y: 4 });
    expect(result.state.snake).toHaveLength(state.snake.length);
  });

  it("blocks direct reversal while the snake has a body", () => {
    const state = createInitialSnakeState(grid);
    const next = withDirection(state, "left");

    expect(next.direction).toBe("right");
  });

  it("grows after a pickup", () => {
    const state = awardPickup(createInitialSnakeState(grid), "vector-search");
    const first = advanceSnake(state, grid).state;
    const second = advanceSnake(first, grid).state;

    expect(first.snake).toHaveLength(5);
    expect(second.snake).toHaveLength(6);
    expect(second.score).toBeGreaterThan(0);
  });

  it("carries an eaten pickup into the snake body", () => {
    const state = awardPickup(createInitialSnakeState(grid), "vector-search");
    const first = advanceSnake(state, grid).state;

    expect(state.segmentTopicIds[0]).toBe("vector-search");
    expect(first.segmentTopicIds).toHaveLength(first.snake.length);
    expect(first.segmentTopicIds[1]).toBe("vector-search");
  });

  it("detects wall collisions", () => {
    const state: SnakeState = {
      ...createInitialSnakeState(grid),
      snake: [{ x: 7, y: 4 }, { x: 6, y: 4 }],
      direction: "right"
    };

    const result = advanceSnake(state, grid);

    expect(result.collision.type).toBe("wall");
    expect(result.state.alive).toBe(false);
  });

  it("detects self collisions", () => {
    const state: SnakeState = {
      ...createInitialSnakeState(grid),
      snake: [
        { x: 3, y: 3 },
        { x: 3, y: 4 },
        { x: 2, y: 4 },
        { x: 2, y: 3 }
      ],
      direction: "down",
      growSegments: 1
    };

    const result = advanceSnake(state, grid);

    expect(result.collision.type).toBe("self");
    expect(result.state.alive).toBe(false);
  });

  it("wraps through walls as a ghost snake", () => {
    const state: SnakeState = {
      ...createInitialSnakeState(grid),
      snake: [{ x: 7, y: 4 }, { x: 6, y: 4 }],
      direction: "right"
    };

    const result = advanceGhostSnake(state, grid);

    expect(result.collision.type).toBe("none");
    expect(result.state.alive).toBe(true);
    expect(result.state.snake[0]).toEqual({ x: 0, y: 4 });
  });

  it("ignores self collisions and clears pending growth as a ghost snake", () => {
    const state: SnakeState = {
      ...createInitialSnakeState(grid),
      snake: [
        { x: 3, y: 3 },
        { x: 3, y: 4 },
        { x: 2, y: 4 },
        { x: 2, y: 3 }
      ],
      direction: "down",
      growSegments: 1
    };

    const result = advanceGhostSnake(state, grid);

    expect(result.collision.type).toBe("none");
    expect(result.state.alive).toBe(true);
    expect(result.state.snake[0]).toEqual({ x: 3, y: 4 });
    expect(result.state.snake).toHaveLength(4);
    expect(result.state.growSegments).toBe(0);
  });
});

describe("pickup awards", () => {
  it("can award pickup score and growth without learning the topic", () => {
    const state = awardPickup(createInitialSnakeState(grid), "vector-search", 100, false);

    expect(state.score).toBeGreaterThan(0);
    expect(state.growSegments).toBe(2);
    expect(state.segmentTopicIds[0]).toBe("vector-search");
    expect(state.collectedTopicIds).toEqual([]);
  });

  it("learns topics idempotently", () => {
    const state = createInitialSnakeState(grid);
    const once = learnTopic(state, "vector-search");
    const twice = learnTopic(once, "vector-search");

    expect(twice.collectedTopicIds).toEqual(["vector-search"]);
  });
});

describe("pickup spawning", () => {
  it("does not spawn on the snake or blocked cells", () => {
    const snake = [
      { x: 0, y: 0 },
      { x: 1, y: 0 }
    ];
    const blocked = [{ x: 2, y: 0 }];
    const cell = chooseSpawnCell({ width: 4, height: 1 }, snake, blocked, () => 0);

    expect(cell).toEqual({ x: 3, y: 0 });
    expect([...snake, ...blocked].some((point) => pointsEqual(point, cell))).toBe(false);
  });

  it("lists every available cell once", () => {
    const cells = listFreeCells(
      { width: 3, height: 2 },
      [{ x: 1, y: 0 }],
      [{ x: 2, y: 1 }]
    );

    expect(cells).toEqual([
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 }
    ]);
  });
});
