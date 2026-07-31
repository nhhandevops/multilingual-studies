/** unbzip2-stream ships no types: it is a single factory returning a through-stream. */
declare module 'unbzip2-stream' {
  import type { Duplex } from 'node:stream';
  export default function unbzip2Stream(): Duplex;
}
