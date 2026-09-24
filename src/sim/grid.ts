// Räumliches Raster (Spatial Hash) per Counting-Sort: jedes Tick neu gebaut,
// damit Zielsuche & Kollision nur Nachbarzellen prüfen statt alle Einheiten.

export class Grid {
  readonly cols: number;
  readonly rows: number;
  readonly cellStart: Int32Array;
  readonly items: Int32Array;
  private readonly cellOf: Int32Array;
  private readonly fill: Int32Array;

  constructor(
    readonly width: number,
    readonly height: number,
    readonly cs: number,
    capacity: number,
  ) {
    this.cols = Math.ceil(width / cs);
    this.rows = Math.ceil(height / cs);
    const cells = this.cols * this.rows;
    this.cellStart = new Int32Array(cells + 1);
    this.fill = new Int32Array(cells);
    this.items = new Int32Array(capacity);
    this.cellOf = new Int32Array(capacity);
  }

  cellX(x: number): number {
    const c = Math.floor(x / this.cs);
    return c < 0 ? 0 : c >= this.cols ? this.cols - 1 : c;
  }

  cellY(y: number): number {
    const c = Math.floor(y / this.cs);
    return c < 0 ? 0 : c >= this.rows ? this.rows - 1 : c;
  }

  /** ids[0..n) in das Raster einsortieren. */
  build(ids: Int32Array, n: number, xs: Float32Array, ys: Float32Array): void {
    const cs = this.cellStart;
    cs.fill(0);
    for (let k = 0; k < n; k++) {
      const i = ids[k]!;
      const c = this.cellY(ys[i]!) * this.cols + this.cellX(xs[i]!);
      this.cellOf[k] = c;
      cs[c + 1]!++;
    }
    for (let c = 0; c < this.cols * this.rows; c++) cs[c + 1]! += cs[c]!;
    this.fill.set(cs.subarray(0, this.cols * this.rows));
    for (let k = 0; k < n; k++) {
      const c = this.cellOf[k]!;
      this.items[this.fill[c]!++] = ids[k]!;
    }
  }
}
