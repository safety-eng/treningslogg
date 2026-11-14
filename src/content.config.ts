import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// Varighet skrives som "mm:ss" eller "t:mm:ss".
const varighet = z.string().regex(/^(\d+:)?\d{1,2}:\d{2}$/, 'Bruk mm:ss eller t:mm:ss');
const opplevd = z.enum(['lett', 'moderat', 'hardt', 'maks']);

const lop = z.object({
  type: z.literal('lop'),
  kategori: z.enum(['rolig', 'langtur', 'terskel', 'intervall', 'tempo', 'konkurranse', 'restitusjon', 'annet']),
  distanse_km: z.number().positive(),
  varighet,
  opplevd: opplevd.optional(),
  planlagt: z.string().optional(),
  kilde: z.string().optional(),
});

const sett = z.object({
  reps: z.number().int().positive(),
  kg: z.number().nonnegative().optional(),
});

const styrke = z.object({
  type: z.literal('styrke'),
  varighet: varighet.optional(),
  opplevd: opplevd.optional(),
  planlagt: z.string().optional(),
  ovelser: z.array(z.object({ navn: z.string(), sett: z.array(sett).min(1) })).min(1),
});

const annet = z.object({
  type: z.literal('annet'),
  aktivitet: z.string(),
  distanse_km: z.number().positive().optional(),
  varighet: varighet.optional(),
  opplevd: opplevd.optional(),
  planlagt: z.string().optional(),
  kilde: z.string().optional(),
});

const okter = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/okter' }),
  schema: ({ image }) => z.object({
    tittel: z.string(),
    dato: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Bruk ÅÅÅÅ-MM-DD'),
    klokkeslett: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    plan: z.object({ navn: z.string(), uke: z.number().int().positive() }).optional(),
    okter: z.array(z.discriminatedUnion('type', [lop, styrke, annet])).min(1),
    // Bilder Fredrik vil ha med (ikke skjermbilder av loggen). Lagres i src/content/okter/bilder/ uten metadata.
    bilder: z.array(z.object({ src: image(), alt: z.string(), tekst: z.string().optional() })).optional(),
  }),
});

export const collections = { okter };
