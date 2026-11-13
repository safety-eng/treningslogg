// Lager delingsbilder (1200×630 JPEG) ved bygg: satori tegner layouten som SVG
// med teksten som vektorer, og sharp gjør den om til JPEG.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import satori from 'satori';
import sharp from 'sharp';

const B = 1200;
const H = 630;
const rot = process.cwd();

let ressurser: Promise<{ fonter: any[]; bilde: string }> | null = null;
function hentRessurser() {
  ressurser ??= (async () => {
    const f = (fil: string) => readFile(path.join(rot, 'src/assets/fonts', fil));
    const fonter = [
      { name: 'Barlow', data: await f('barlow-400.woff'), weight: 400, style: 'normal' },
      { name: 'Barlow', data: await f('barlow-500.woff'), weight: 500, style: 'normal' },
      { name: 'Barlow Condensed', data: await f('barlow-condensed-600.ttf'), weight: 600, style: 'normal' },
      { name: 'Barlow Condensed', data: await f('barlow-condensed-700.ttf'), weight: 700, style: 'normal' },
    ];
    // Utsnitt av toppbildet rundt løperen.
    const jpg = await sharp(path.join(rot, 'src/assets/hero-nidelva.png'))
      .extract({ left: 170, top: 0, width: 740, height: 887 })
      .resize(560, H, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: 78 })
      .toBuffer();
    return { fonter, bilde: `data:image/jpeg;base64,${jpg.toString('base64')}` };
  })();
  return ressurser;
}

type Node = { type: string; props: Record<string, unknown> };
const el = (type: string, style: Record<string, unknown>, ...children: (Node | string)[]): Node => ({
  type,
  props: { style, children: children.length === 1 ? children[0] : children },
});

export interface Delingsinnhold {
  overlinje: string;
  tittel: string;
  tall: { navn: string; verdi: string }[];
  bunnlinje?: string;
}

export async function lagDelingsbilde(inn: Delingsinnhold): Promise<Uint8Array> {
  const { fonter, bilde } = await hentRessurser();
  const tittelStr = inn.tittel.length > 44 ? 58 : inn.tittel.length > 28 ? 68 : 80;

  const innhold = el(
    'div',
    { position: 'absolute', left: 540, top: 56, right: 60, bottom: 52, display: 'flex', flexDirection: 'column' },
    el('div', { display: 'flex', fontFamily: 'Barlow', fontWeight: 500, fontSize: 26, color: '#bac2c6' }, inn.overlinje),
    el(
      'div',
      { display: 'flex', marginTop: 18, fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: tittelStr, lineHeight: 1.0, color: '#eef1f0', textWrap: 'balance' },
      inn.tittel,
    ),
    el(
      'div',
      { display: 'flex', marginTop: 'auto', gap: 44 },
      ...inn.tall.map((t) =>
        el(
          'div',
          { display: 'flex', flexDirection: 'column' },
          el('div', { display: 'flex', fontFamily: 'Barlow', fontWeight: 400, fontSize: 22, color: '#8d959c' }, t.navn),
          el('div', { display: 'flex', fontFamily: 'Barlow Condensed', fontWeight: 600, fontSize: 54, lineHeight: 1.05, color: '#eef1f0' }, t.verdi),
        ),
      ),
    ),
    el(
      'div',
      { display: 'flex', marginTop: 26, fontFamily: 'Barlow', fontWeight: 500, fontSize: 22, color: '#ec7a62' },
      inn.bunnlinje ?? ' ',
    ),
  );

  const rotNode = el(
    'div',
    { width: B, height: H, display: 'flex', position: 'relative', backgroundColor: '#161c22' },
    { type: 'img', props: { src: bilde, width: 560, height: H, style: { position: 'absolute', left: 0, top: 0 } } },
    el('div', {
      position: 'absolute', left: 0, top: 0, width: 600, height: H, display: 'flex',
      backgroundImage: 'linear-gradient(to right, rgba(22,28,34,0) 42%, rgba(22,28,34,1) 93%)',
    }),
    innhold,
  );

  const svg = await satori(rotNode as any, { width: B, height: H, fonts: fonter as any });
  const jpg = await sharp(Buffer.from(svg)).jpeg({ quality: 86, mozjpeg: true }).toBuffer();
  return new Uint8Array(jpg);
}
