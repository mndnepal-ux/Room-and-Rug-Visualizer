export type Pt = [number, number];

export interface Scene {
  id: string;
  name: string;
  room: string;
  note: string;
  src: string;
  maskSrc: string;
  /** Floor rectangle corners in 1024 × 683 photo px: far-left, far-right, near-right, near-left. */
  floor: [Pt, Pt, Pt, Pt];
  widthM: number;
  depthM: number;
  floorTone: string;
  defaultPos: { x: number; y: number };
}

const base = import.meta.env.BASE_URL;
const photo = (id: string) => `${base}api/room-photos/${id}.webp`;

export const SCENES: Scene[] = [
  {
    id: "living",
    name: "Living Room",
    room: "Living room",
    note: "Your photo · wood floor, cream sectional",
    src: photo("living"),
    maskSrc: `${base}api/room-photos/living-mask.png`,
    floor: [[270, 400], [800, 400], [1190, 683], [-160, 683]],
    widthM: 5.2,
    depthM: 4.2,
    floorTone: "#c89e6e",
    defaultPos: { x: 2.6, y: 2.7 },
  },
  {
    id: "bedroom",
    name: "Bedroom",
    room: "Bedroom",
    note: "Your bedroom photo · marble floor",
    src: photo("bedroom-2"),
    maskSrc: `${base}api/room-photos/bedroom-mask.png`,
    floor: [[148, 433], [807, 433], [1220, 683], [-220, 683]],
    widthM: 4.4,
    depthM: 3.6,
    floorTone: "#e1ceba",
    defaultPos: { x: 2.2, y: 2.3 },
  },
  {
    id: "lobby",
    name: "Lobby",
    room: "Lobby",
    note: "Your photo · lounge seating, marble floor",
    src: photo("lobby"),
    maskSrc: `${base}api/room-photos/lobby-mask.png`,
    floor: [[277, 350], [817, 350], [1280, 683], [-190, 683]],
    widthM: 6,
    depthM: 5,
    floorTone: "#d8c7b5",
    defaultPos: { x: 2.1, y: 2.8 },
  },
  {
    // Retain the previous scene IDs so saved designs and shared links still resolve.
    id: "dining",
    name: "Kitchen",
    room: "Kitchen",
    note: "Your photo · green cabinetry, dining island",
    src: photo("kitchen"),
    maskSrc: `${base}api/room-photos/dining-mask.png`,
    floor: [[240, 442], [718, 442], [1130, 683], [-170, 683]],
    widthM: 4,
    depthM: 3.8,
    floorTone: "#e2d3bf",
    defaultPos: { x: 2, y: 2.4 },
  },
  {
    id: "loft",
    name: "Office",
    room: "Office",
    note: "Your photo · executive desk, meeting table",
    src: photo("office"),
    maskSrc: `${base}api/room-photos/loft-mask.png`,
    floor: [[192, 391], [711, 391], [1160, 683], [-210, 683]],
    widthM: 5,
    depthM: 4,
    floorTone: "#d8cabc",
    defaultPos: { x: 2.4, y: 2.6 },
  },
];

export const CANVAS_W = 1024;
export const CANVAS_H = 683;
export const CROP_Y = 0;
