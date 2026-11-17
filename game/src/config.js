// VICE HARBOR — shared tuning for Port Azura.
// The whole city is one square grid: BLOCK-wide lots split by ROAD-wide
// streets, a palm boulevard through the middle, sand and sea to the south.
// Every other module reads its geometry from here so the 3D world, the
// traffic lanes, the minimap and the mission markers can never disagree.

export const BLOCK = 66;            // side of one city block lot, metres
export const ROAD = 18;             // street width between lots
export const PITCH = BLOCK + ROAD;  // 84: distance between road centrelines
export const GRID = 6;              // blocks per side
export const CITY = GRID * PITCH + ROAD; // 522 m across, kerb to kerb
export const HALF = CITY / 2;       // 261

export const BOULEVARD_Z = 0;       // the palm avenue is the middle east-west road
export const SHORE_Z = HALF + 34;   // z where the sand gives up and the sea starts
export const PIER_END_Z = HALF + 78; // far end of the marina pier

export const PALETTE = {
  skyTop: 0x274b8f,
  haze: 0xd9905f,
  sunTint: 0xffd9a3,
  tarmac: 0x333a52,
  tarmacAvenue: 0x3c435f,
  pavement: 0x9aa1b1,
  lotGround: 0x59616f,
  sand: 0xe9d09c,
  sea: 0x1b6d8c,
  lawn: 0x4c7a4e,
  palmTrunk: 0x8a6a47,
  palmFrond: 0x3d9c4c,
};

export const TRAFFIC_PAINTS = [0xc94f42, 0x3e74b8, 0xe0aa34, 0x4da564, 0xdcdcdc, 0x2c3038,
  0x8757ad, 0xd96c33, 0x35b3a4, 0xb9c0cf, 0x77502e, 0xeeeeee];

// The six cars of Port Azura. `top` is m/s, `accel` m/s^2, `grip` is the
// steering authority the arcade physics uses. index 4 is the Marina GT,
// the fastest shell in town and the star of the first job.
export const CAR_TYPES = [
  { name: 'Cielo Coupe', top: 37, accel: 15, grip: 3.4, len: 4.3, wid: 1.9 },
  { name: 'Azura Family Sedan', top: 32, accel: 12, grip: 3.0, len: 4.7, wid: 2.0 },
  { name: 'Harbour Hatch', top: 29, accel: 11, grip: 3.1, len: 3.9, wid: 1.8 },
  { name: 'Dune Runner Pickup', top: 30, accel: 12.5, grip: 2.7, len: 5.1, wid: 2.1 },
  { name: 'Marina GT', top: 45, accel: 19, grip: 3.8, len: 4.5, wid: 2.0 },
  { name: 'Palmetto Panel Van', top: 26, accel: 10, grip: 2.5, len: 5.4, wid: 2.2 },
];

export const SAVE_KEY = 'vice-harbor-azura-save-v1';
