import type { PixelGrid } from '../../art/pixel';
import type { RaceId } from '../data';

export type RoomArtworkKind = 'fork' | 'boss' | 'treasure' | 'pyre' | 'enchant' | 'shop';
export interface RoomProp { g: PixelGrid; x: number; y: number }

// Baselines measured against each generated stone slab, in game pixels.
export const TREASURE_ANCHOR: Record<RaceId, { x: number; y: number }> = {
  drifters: { x: 320, y: 232 },
  ashclan: { x: 320, y: 224 },
  wildwood: { x: 320, y: 221 },
  tidebound: { x: 320, y: 240 },
  sunlegion: { x: 320, y: 248 },
  plague: { x: 320, y: 238 },
  deepforge: { x: 320, y: 230 },
};

const propCache = new Map<string, string>();
const loaded = new Map<string, Promise<void>>();

/** Scenery is a separate image layer. Interactive objects never enter the asset. */
export function roomArtwork(race: RaceId, kind: RoomArtworkKind, props: RoomProp[] = [], variant = ''): string {
  const url = `${import.meta.env.BASE_URL}room-art/${race}-${kind}-v2.webp`;
  if (!props.length) return `url("${url}")`;
  const key = `${race}|${kind}|${variant}`;
  let foreground = propCache.get(key);
  if (!foreground) {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 360;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    for (const p of props) p.g.draw(ctx, Math.round(p.x - p.g.w / 2), Math.round(p.y - p.g.h));
    foreground = canvas.toDataURL();
    propCache.set(key, foreground);
  }
  return `url("${foreground}"), url("${url}")`;
}

/** Decode only the visible room, while the existing screen transition is closed. */
export async function waitForRoomArtwork(root: HTMLElement): Promise<void> {
  const screen = root.querySelector<HTMLElement>('.room-scr, .fork-scr');
  if (!screen) return;
  const match = screen.style.backgroundImage.match(/url\(["']?([^"')]*room-art\/[^"')]+)["']?\)/);
  const url = match?.[1];
  if (!url) return;
  let promise = loaded.get(url);
  if (!promise) {
    const img = new Image();
    img.src = url;
    promise = img.decode().catch(() => {
      // Leave the procedural fallback visible and allow a retry next visit.
      loaded.delete(url);
    });
    loaded.set(url, promise);
  }
  await promise;
}
