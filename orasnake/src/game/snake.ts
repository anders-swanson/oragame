import type { CollisionResult, Direction, GridSize, PickupScoreInput, Point, SnakeState } from "./types";

const OPPOSITES: Record<Direction, Direction> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left"
};

const DELTAS: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 }
};

export function pointsEqual(a: Point, b: Point): boolean {
  return a.x === b.x && a.y === b.y;
}

export function pointKey(point: Point): string {
  return `${point.x},${point.y}`;
}

export function isOppositeDirection(a: Direction, b: Direction): boolean {
  return OPPOSITES[a] === b;
}

export function createInitialSnakeState(grid: GridSize): SnakeState {
  const center = {
    x: Math.floor(grid.width / 2),
    y: Math.floor(grid.height / 2)
  };
  const snake = [
    center,
    { x: center.x - 1, y: center.y },
    { x: center.x - 2, y: center.y },
    { x: center.x - 3, y: center.y }
  ];

  return {
    snake,
    segmentTopicIds: snake.map(() => undefined),
    direction: "right",
    growSegments: 0,
    alive: true,
    score: 0,
    insight: 0,
    combo: 1,
    bestCombo: 1,
    collectedTopicIds: []
  };
}

function segmentTopicIdsFor(state: SnakeState): readonly (string | undefined)[] {
  return state.snake.map((_, index) => state.segmentTopicIds[index]);
}

export function withDirection(state: SnakeState, nextDirection: Direction): SnakeState {
  if (state.snake.length > 1 && isOppositeDirection(state.direction, nextDirection)) {
    return state;
  }

  return {
    ...state,
    direction: nextDirection
  };
}

export function nextPoint(head: Point, direction: Direction): Point {
  const delta = DELTAS[direction];
  return {
    x: head.x + delta.x,
    y: head.y + delta.y
  };
}

export function detectCollision(
  point: Point,
  grid: GridSize,
  snakeBody: readonly Point[],
  blockedCells: readonly Point[] = []
): CollisionResult {
  if (point.x < 0 || point.y < 0 || point.x >= grid.width || point.y >= grid.height) {
    return { type: "wall", point };
  }

  if (snakeBody.some((bodyPoint) => pointsEqual(bodyPoint, point))) {
    return { type: "self", point };
  }

  if (blockedCells.some((blocked) => pointsEqual(blocked, point))) {
    return { type: "blocked", point };
  }

  return { type: "none" };
}

export function advanceSnake(
  state: SnakeState,
  grid: GridSize,
  blockedCells: readonly Point[] = []
): { state: SnakeState; collision: CollisionResult } {
  if (!state.alive) {
    return { state, collision: { type: "none" } };
  }

  const head = state.snake[0];
  const nextHead = wrapPoint(nextPoint(head, state.direction), grid);
  const grows = state.growSegments > 0;
  const bodyForCollision = grows ? state.snake : state.snake.slice(0, -1);
  const segmentTopicIds = segmentTopicIdsFor(state);
  const bodySegmentTopicIds = grows ? segmentTopicIds : segmentTopicIds.slice(0, -1);
  const collision = detectCollision(nextHead, grid, bodyForCollision, blockedCells);

  if (collision.type !== "none") {
    return {
      state: {
        ...state,
        snake: [nextHead, ...bodyForCollision],
        segmentTopicIds: [undefined, ...bodySegmentTopicIds],
        alive: false
      },
      collision
    };
  }

  const body = grows ? state.snake : state.snake.slice(0, -1);
  return {
    state: {
      ...state,
      snake: [nextHead, ...body],
      segmentTopicIds: [undefined, ...bodySegmentTopicIds],
      growSegments: grows ? state.growSegments - 1 : 0
    },
    collision
  };
}

function wrapPoint(point: Point, grid: GridSize): Point {
  return {
    x: (point.x + grid.width) % grid.width,
    y: (point.y + grid.height) % grid.height
  };
}

export function advanceGhostSnake(state: SnakeState, grid: GridSize): { state: SnakeState; collision: CollisionResult } {
  if (!state.alive) {
    return { state, collision: { type: "none" } };
  }

  const head = state.snake[0];
  const nextHead = wrapPoint(nextPoint(head, state.direction), grid);
  const body = state.snake.slice(0, -1);
  const bodySegmentTopicIds = segmentTopicIdsFor(state).slice(0, -1);

  return {
    state: {
      ...state,
      snake: [nextHead, ...body],
      segmentTopicIds: [undefined, ...bodySegmentTopicIds],
      growSegments: 0,
      alive: true
    },
    collision: { type: "none" }
  };
}

export function integratePickup(state: SnakeState, topicId: string): SnakeState {
  const segmentTopicIds = segmentTopicIdsFor(state);

  return {
    ...state,
    segmentTopicIds: [topicId, ...segmentTopicIds.slice(1)]
  };
}

export function addGrowth(state: SnakeState, segments: number): SnakeState {
  return {
    ...state,
    growSegments: state.growSegments + Math.max(0, segments)
  };
}

export function calculatePickupScore({ baseScore, combo, insightBonus = 0 }: PickupScoreInput): number {
  return Math.round(baseScore * Math.max(1, combo) + insightBonus);
}

export function learnTopic(state: SnakeState, topicId: string): SnakeState {
  const collectedTopicIds = state.collectedTopicIds.includes(topicId)
    ? state.collectedTopicIds
    : [...state.collectedTopicIds, topicId];

  return {
    ...state,
    collectedTopicIds
  };
}

export function awardPickup(state: SnakeState, topicId: string, baseScore = 100, learn = true): SnakeState {
  const nextState = learn ? learnTopic(state, topicId) : state;

  return addGrowth(
    integratePickup(
      {
        ...nextState,
        score: nextState.score + calculatePickupScore({ baseScore, combo: nextState.combo })
      },
      topicId
    ),
    2
  );
}

export function listFreeCells(
  grid: GridSize,
  snake: readonly Point[],
  blockedCells: readonly Point[] = []
): Point[] {
  const occupied = new Set([...snake, ...blockedCells].map(pointKey));
  const cells: Point[] = [];

  for (let y = 0; y < grid.height; y += 1) {
    for (let x = 0; x < grid.width; x += 1) {
      const cell = { x, y };
      if (!occupied.has(pointKey(cell))) {
        cells.push(cell);
      }
    }
  }

  return cells;
}

export function chooseSpawnCell(
  grid: GridSize,
  snake: readonly Point[],
  blockedCells: readonly Point[] = [],
  random: () => number = Math.random
): Point {
  const freeCells = listFreeCells(grid, snake, blockedCells);

  if (freeCells.length === 0) {
    throw new Error("No free cells available for spawn");
  }

  const index = Math.min(freeCells.length - 1, Math.floor(random() * freeCells.length));
  return freeCells[index];
}
