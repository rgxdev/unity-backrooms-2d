import { parseLevel, TileKind, type LevelData } from "@/lib/schemas/level";

const WIDTH = 44;
const HEIGHT = 32;

type Rect = { x: number; y: number; w: number; h: number };

const ROOMS: Rect[] = [
  { x: 2, y: 2, w: 10, h: 8 },
  { x: 16, y: 3, w: 9, h: 6 },
  { x: 30, y: 2, w: 11, h: 9 },
  { x: 3, y: 14, w: 8, h: 10 },
  { x: 18, y: 16, w: 12, h: 8 },
  { x: 33, y: 18, w: 8, h: 11 },
];

const CORRIDORS: Rect[] = [
  { x: 11, y: 5, w: 6, h: 2 },
  { x: 24, y: 5, w: 7, h: 2 },
  { x: 6, y: 9, w: 2, h: 6 },
  { x: 20, y: 8, w: 2, h: 9 },
  { x: 10, y: 18, w: 9, h: 2 },
  { x: 29, y: 20, w: 5, h: 2 },
  { x: 35, y: 10, w: 2, h: 9 },
];

function carve(tiles: number[], rect: Rect): void {
  for (let y = rect.y; y < rect.y + rect.h; y++) {
    for (let x = rect.x; x < rect.x + rect.w; x++) {
      if (x <= 0 || y <= 0 || x >= WIDTH - 1 || y >= HEIGHT - 1) continue;
      tiles[y * WIDTH + x] = TileKind.Floor;
    }
  }
}

function build(): LevelData {
  const tiles = new Array<number>(WIDTH * HEIGHT).fill(TileKind.Wall);
  for (const room of ROOMS) carve(tiles, room);
  for (const corridor of CORRIDORS) carve(tiles, corridor);

  return parseLevel({
    id: "level-00",
    name: "The Lobby",
    tileSize: 32,
    width: WIDTH,
    height: HEIGHT,
    tiles,
    spawn: { x: 6, y: 5 },
    zones: [
      { id: "lobby", x: 2, y: 2, w: 10, h: 8, hidden: false },
      { id: "east-hall", x: 30, y: 2, w: 11, h: 9, hidden: false },
      { id: "hidden-vault", x: 33, y: 18, w: 8, h: 11, hidden: true },
    ].map(({ w, h, ...rest }) => ({ ...rest, width: w, height: h })),
    monsters: [
      {
        id: "hound-central",
        x: 23,
        y: 19,
        patrol: [
          { x: 19, y: 17 },
          { x: 28, y: 17 },
          { x: 28, y: 22 },
          { x: 19, y: 22 },
        ],
      },
      {
        id: "stalker-east",
        x: 35,
        y: 5,
        patrol: [
          { x: 32, y: 3 },
          { x: 39, y: 3 },
          { x: 39, y: 9 },
          { x: 32, y: 9 },
        ],
      },
    ],
  });
}

export const LEVEL_00: LevelData = build();
