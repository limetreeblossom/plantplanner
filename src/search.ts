import type { Plant } from './types';
import rawData from './data/plants-raw.json';
import enrichedData from './data/plants-enriched.json';

interface RawPlant {
  name: string;
  scientific_name: string;
  slug: string;
  family: string;
  family_common_name: string | null;
  genus: string;
  image_url: string | null;
}

interface EnrichedPlant extends RawPlant {
  flower_colors: string[] | null;
  spread_cm: number | null;
  row_spacing_cm: number | null;
  growth_habit: string | null;
}

// ── Family fallback colors ────────────────────────────────────────────────────

const FAMILY_COLORS: Record<string, string> = {
  Poaceae: '#a5d6a7',
  Rosaceae: '#f48fb1',
  Lamiaceae: '#ce93d8',
  Asteraceae: '#fff176',
  Fabaceae: '#80cbc4',
  Pinaceae: '#388e3c',
  Betulaceae: '#bcaaa4',
  Apiaceae: '#fff9c4',
  Rubiaceae: '#ffcc80',
  Viburnaceae: '#b0bec5',
  Plantaginaceae: '#c5e1a5',
  Ranunculaceae: '#b3e5fc',
  Orchidaceae: '#f8bbd9',
  Salicaceae: '#dce775',
  Ericaceae: '#ffab91',
  Caryophyllaceae: '#f3e5f5',
  Brassicaceae: '#f9fbe7',
  Polygonaceae: '#e8f5e9',
  Cyperaceae: '#c8e6c9',
  Juncaceae: '#dcedc8',
};

// ── Flower color name → hex ───────────────────────────────────────────────────

const FLOWER_COLOR_HEX: Record<string, string> = {
  purple: '#ab47bc',
  violet: '#7e57c2',
  blue: '#42a5f5',
  red: '#ef5350',
  pink: '#f48fb1',
  orange: '#ffa726',
  yellow: '#ffee58',
  cream: '#fff9c4',
  white: '#f5f5f5',
  brown: '#8d6e63',
  grey: '#90a4ae',
  silver: '#b0bec5',
  green: '#66bb6a',
  black: '#424242',
};

// Prefer vivid/distinctive colors over white/green when multiple colors present
const COLOR_PRIORITY = [
  'purple',
  'violet',
  'blue',
  'red',
  'pink',
  'orange',
  'yellow',
  'cream',
  'white',
  'brown',
  'grey',
  'silver',
  'green',
  'black',
];

export function bestFlowerColor(colors: string[]): string | null {
  if (!colors.length) return null;
  const sorted = [...colors].sort((a, b) => {
    const ai = COLOR_PRIORITY.indexOf(a);
    const bi = COLOR_PRIORITY.indexOf(b);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });
  return FLOWER_COLOR_HEX[sorted[0]] ?? null;
}

// ── Enrichment lookup (slug → enriched data) ─────────────────────────────────

const DEFAULT_SPACING = 0.3;
const DEFAULT_SPACING_TREE = 2.0;
const DEFAULT_COLOR = '#90a4ae';

const enrichedMap = new Map((enrichedData as EnrichedPlant[]).map((p) => [p.slug, p]));

// ── Conversion ────────────────────────────────────────────────────────────────

export function computeSpacing(
  spreadCm: number | null | undefined,
  rowSpacingCm: number | null | undefined,
  isTree: boolean,
): number {
  const raw = spreadCm
    ? spreadCm / 100
    : rowSpacingCm
      ? rowSpacingCm / 100
      : isTree
        ? DEFAULT_SPACING_TREE
        : DEFAULT_SPACING;
  return Math.max(0.1, Math.min(raw, 3.0));
}

export function rawToPlant(raw: RawPlant): Plant {
  const enriched = enrichedMap.get(raw.slug);

  const flowerHex = enriched?.flower_colors?.length
    ? bestFlowerColor(enriched.flower_colors)
    : null;

  const isTree = /tree|shrub/i.test(enriched?.growth_habit ?? '');
  const spacing = computeSpacing(enriched?.spread_cm, enriched?.row_spacing_cm, isTree);

  return {
    name: raw.name,
    slug: raw.slug,
    spacing,
    color: flowerHex ?? FAMILY_COLORS[raw.family] ?? DEFAULT_COLOR,
    ...(isTree && { icon: 'tree' as const }),
    ...(raw.image_url && { image_url: raw.image_url }),
    ...(raw.scientific_name && { scientific_name: raw.scientific_name }),
    ...(raw.family && { family: raw.family }),
    ...(raw.genus && { genus: raw.genus }),
    ...(enriched?.growth_habit && { growth_habit: enriched.growth_habit }),
  };
}

// ── Search ────────────────────────────────────────────────────────────────────

const ALL_PLANTS = rawData as RawPlant[];

export function searchPlants(query: string, limit = 20): Plant[] {
  if (!query.trim()) return [];
  const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(^|\\s)${escaped}`, 'i');
  return ALL_PLANTS.filter((r) => re.test(r.scientific_name))
    .slice(0, limit)
    .map(rawToPlant);
}
