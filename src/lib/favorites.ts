import { z } from 'zod';

const year = z.string().refine(v => !v || (/^\d{4}$/.test(v) && +v >= 1000 && +v <= 2100));
export const favoritePayloadSchema = z.object({
  authors: z.array(z.object({
    id: z.string().regex(/^https:\/\/openalex.org\/A\d+$/),
    display_name: z.string().trim().min(1).max(300),
    works_count: z.number().int().nonnegative().optional(),
    orcid: z.string().max(100).nullable().optional(),
    last_known_institutions: z.array(z.object({ display_name: z.string().max(500) })).max(50).nullable().optional(),
  })).min(1).max(100).refine(a => new Set(a.map(v => v.id)).size === a.length),
  professorNames: z.record(z.string().max(300)),
  from: year,
  to: year,
  excludeArxiv: z.boolean().default(false),
  mergeLatest: z.boolean().default(true),
  publicationKind: z.enum(['all', 'journal', 'conference', 'preprint', 'unknown']).default('all'),
}).refine(v => !v.from || !v.to || +v.from <= +v.to);
export const favoriteInputSchema = z.object({ name: z.string().trim().min(1).max(80), payload: favoritePayloadSchema });
export type FavoritePayload = z.infer<typeof favoritePayloadSchema>;
export type Favorite = { id: string; name: string; payload: FavoritePayload; createdAt: number };
export const favoriteSchema = favoriteInputSchema.extend({ id: z.string().uuid(), createdAt: z.number() });
export const favoritesSchema = z.array(favoriteSchema).max(50);
