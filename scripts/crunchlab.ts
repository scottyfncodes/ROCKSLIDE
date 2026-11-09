// Crunch lab: render the synthesised boot-in-snow takes (src/audio/crunch.ts) as WAV files to listen to,
// and print where their sound sits: the share of energy per band and how fast each one rises.
//
//   npx tsx scripts/crunchlab.ts [outdir]      (default: docs/audio/crunch)
import { mkdirSync, writeFileSync } from 'node:fs';
import { crunch, type Snow } from '../src/audio/crunch';

const out = process.argv[2] ?? 'docs/audio/crunch';
const SR = 44100;
mkdirSync(out, { recursive: true });

function wav(x: Float32Array): Buffer {
  const b = Buffer.alloc(44 + x.length * 2);
  b.write('RIFF', 0);
  b.writeUInt32LE(36 + x.length * 2, 4);
  b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(SR, 24);
  b.writeUInt32LE(SR * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36);
  b.writeUInt32LE(x.length * 2, 40);
  for (let i = 0; i < x.length; i++) b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, x[i])) * 32767), 44 + i * 2);
  return b;
}

/** energy per band, by a plain DFT over the take (short, so this is fine) */
export function bands(x: Float32Array, sr = SR) {
  const edges = [0, 400, 1000, 3000, 8000, sr / 2];
  const e = new Array(edges.length - 1).fill(0);
  const n = x.length;
  for (let k = 1; k < n / 2; k += 2) {
    const f = (k * sr) / n;
    let re = 0;
    let im = 0;
    for (let i = 0; i < n; i += 1) {
      const a = (2 * Math.PI * k * i) / n;
      re += x[i] * Math.cos(a);
      im -= x[i] * Math.sin(a);
    }
    const p = re * re + im * im;
    for (let b = 0; b < e.length; b++) if (f >= edges[b] && f < edges[b + 1]) e[b] += p;
  }
  const tot = e.reduce((a, b) => a + b, 0);
  return e.map((v) => +(v / tot).toFixed(2));
}

for (const snow of ['packed', 'powder'] as Snow[]) {
  const steps: Float32Array[] = [];
  for (let s = 1; s <= 4; s++) {
    const x = crunch(SR, s, snow);
    writeFileSync(`${out}/${snow}_${s}.wav`, wav(x));
    steps.push(x);
  }
  // a little walk: eight steps at a walking pace, alternating takes
  const walk = new Float32Array(Math.round(SR * 4.4));
  for (let i = 0; i < 8; i++) {
    const x = steps[i % steps.length];
    const at = Math.round(SR * (0.2 + i * 0.52));
    for (let j = 0; j < x.length && at + j < walk.length; j++) walk[at + j] += x[j] * (i % 2 ? 0.85 : 1);
  }
  writeFileSync(`${out}/${snow}_walk.wav`, wav(walk));
  const x = steps[0];
  let peakAt = 0;
  for (let i = 0; i < x.length; i++) if (Math.abs(x[i]) > Math.abs(x[peakAt])) peakAt = i;
  console.log(`${snow}: bands 0-400/400-1k/1-3k/3-8k/8k+ ${bands(x).join(' / ')}, loudest at ${((peakAt / SR) * 1000).toFixed(0)} ms`);
}
