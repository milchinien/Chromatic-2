// Berechnet Klänge abseits des Haupt-Threads, damit das Spiel nicht ruckelt.
// Anfrage: Klang-ID. Antwort: { id, out } mit allen Varianten (Mono oder Stereo).

import { rng } from './dsp';
import { RECIPES, type Out } from './sounds';

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

self.onmessage = (e: MessageEvent<string>) => {
  const id = e.data;
  const rec = RECIPES[id];
  const out: Out[] = [];
  if (rec) for (let v = 0; v < rec.n; v++) out.push(rec.gen(rng(hash(id) + v * 7919), v));
  const transfer = out.flatMap((o) => (o instanceof Float32Array ? [o.buffer] : [o[0].buffer, o[1].buffer]));
  (self as unknown as Worker).postMessage({ id, out }, transfer as Transferable[]);
};
