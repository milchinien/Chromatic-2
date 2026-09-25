# Room backgrounds v2

42 standalone environment assets generated with the built-in `image_gen.imagegen` tool:
seven worlds, each with fork, treasure, pyre, enchant, shop and boss approach.

The shipped files are in `public/room-art/{world}-{room}-v2.webp`. The complete
prompts and original generation filenames are recorded in `room-art-v2-prompts.json`.
The existing screenshot established the style; the new Drifters fork served as
the common reference for the other environments.

## Art direction

Crisp adventure-game pixel art, limited world-specific colour families, layered
environmental silhouettes and deliberate material detail. No interface, panels,
text, icons, frame or characters are baked into the backgrounds. World identities:

- Drifters: sepia oak woodland and old road ruins.
- Ashclan: crimson volcanic basalt, ash and broken fortifications.
- Wildwood: green ancient forest, roots and overgrown temples.
- Tidebound: blue coastal ruins, tidal rocks and moonlit sea.
- Sunlegion: golden sandstone courtyards and imperial sun temples.
- Plague: violet marsh graveyards, dead willows and mausoleums.
- Deepforge: charcoal dwarven halls, masonry, chains and iron mechanisms.

The generated pictures use tonal variations within these colour families; they
are not mathematically restricted to the five original palette entries.

## Integration

`roomArtwork.ts` supplies independent CSS image layers for foreground sprites and
environment art. `scenes.ts` keeps the procedural scenery underneath as a loading
failure fallback. The 640x360 game surface and pixelated image rendering remain.
Only the visible room asset is decoded during a screen transition.

Chest sprite baselines, click targets and reward particles use the same per-world
anchor table. Chest opening replaces only the sprite layer. Panels, shop cards,
enchantment choices, the merchant, mage and world-specific Pyre props remain live
game elements. The boss approach has one route and one choice card.

PNG generation outputs were encoded as lossless WebP without resizing,
recolouring or compositing. Decoded RGBA buffers were compared byte-for-byte.
Original PNGs remain in the image generator's output directory.

## Review artifacts

`output/room-art/` contains in-game review screenshots and `verification.json`.
Those screenshots intentionally show the live UI; the shipped background assets
themselves contain none. The preview is not used as a game asset.
