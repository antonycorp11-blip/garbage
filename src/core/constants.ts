export const TILE = 32;
export const CHUNK = 8;
export const WORLD_TILES = 192;
export const CHUNKS = WORLD_TILES / CHUNK;
export const WORLD_PX = WORLD_TILES * TILE;
export const TOTAL_GARBAGE = 1_000_000;
export const CENTER = WORLD_TILES / 2;
export const SAVE_KEY = 'garbage-kingdom-save';
export const SAVE_VERSION = 1;
/** Tiles of garbage around a chunk that can visually overflow into it. */
export const CHUNK_MARGIN = 2;

export const DX = [1, 0, -1, 0];
export const DY = [0, 1, 0, -1];

export const tileIndex = (tx: number, ty: number) => ty * WORLD_TILES + tx;
export const inWorld = (tx: number, ty: number) => tx >= 0 && ty >= 0 && tx < WORLD_TILES && ty < WORLD_TILES;
