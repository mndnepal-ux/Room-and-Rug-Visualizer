export type Pt = [number, number];

export interface Scene {
  id: string;
  name: string;
  room: string;
  note: string;
  src: string;
  /** Floor rectangle corners in source-image px (1024 space): far-left, far-right, near-right, near-left */
  floor: [Pt, Pt, Pt, Pt];
  widthM: number;
  depthM: number;
  floorTone: string;
  defaultPos: { x: number; y: number };
}

const base = import.meta.env.BASE_URL;

export const SCENES: Scene[] = [
  {
    id: "living",
    name: "Olive Light",
    room: "Living room",
    note: "Limewash, linen sofa, white oak",
    src: `${base}rooms/living.jpg`,
    floor: [[150, 600], [980, 630], [1500, 1250], [-420, 1180]],
    widthM: 5.2,
    depthM: 4.2,
    floorTone: "#c89e6e",
    defaultPos: { x: 2.5, y: 2.1 },
  },
  {
    id: "bedroom",
    name: "Sage Morning",
    room: "Bedroom",
    note: "Walnut bed, polished concrete",
    src: `${base}rooms/bedroom.jpg`,
    floor: [[230, 690], [900, 690], [1350, 1200], [-220, 1200]],
    widthM: 4.4,
    depthM: 3.6,
    floorTone: "#b9c0c2",
    defaultPos: { x: 2.2, y: 1.75 },
  },
  {
    id: "dining",
    name: "Ochre Supper",
    room: "Dining room",
    note: "Travertine table, walnut herringbone",
    src: `${base}rooms/dining.jpg`,
    floor: [[160, 790], [1000, 790], [1500, 1250], [-450, 1250]],
    widthM: 4.8,
    depthM: 2.6,
    floorTone: "#5a3a26",
    defaultPos: { x: 2.4, y: 1.35 },
  },
  {
    id: "loft",
    name: "North Window",
    room: "Reading loft",
    note: "Whitewashed brick, pale ash",
    src: `${base}rooms/loft.jpg`,
    floor: [[80, 640], [900, 640], [1450, 1250], [-400, 1250]],
    widthM: 5,
    depthM: 4,
    floorTone: "#d8c4a8",
    defaultPos: { x: 2.5, y: 2.0 },
  },
];

export const CANVAS_W = 1024;
export const CANVAS_H = 884;
export const CROP_Y = 140;
