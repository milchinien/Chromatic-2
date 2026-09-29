// Weiche PC ↔ Handy. Das ist der einzige Mobile-Code im PC-Bundle: Handys
// (nur Touch, kurze Bildschirmseite < 600 px) laden die Hochformat-Version
// nach, alles andere (PC, Laptop mit Touch, Tablet) bleibt beim Querformat.
// Zum Testen: ?layout=mobile bzw. ?layout=desktop an die URL hängen.

export function wantsMobileLayout(): boolean {
  const forced = new URLSearchParams(location.search).get('layout');
  if (forced === 'mobile') return true;
  if (forced === 'desktop') return false;
  const touchOnly = matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches;
  return touchOnly && Math.min(screen.width, screen.height) < 600;
}
