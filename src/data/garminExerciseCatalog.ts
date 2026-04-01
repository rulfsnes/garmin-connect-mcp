import catalogJson from './garminExerciseCatalog.json';

interface GarminExerciseCatalogJson {
  categories: Record<string, {
    displayNameEn?: string | null;
    displayNameNo?: string | null;
    exercises: Record<string, {
      displayNameEn?: string | null;
      displayNameNo?: string | null;
      primaryMuscles?: string[];
      secondaryMuscles?: string[];
      equipmentKeys?: string[];
    }>;
  }>;
}

export interface GarminExerciseDefinition {
  categoryKey: string;
  exerciseKey: string;
  categoryDisplayNameEn?: string;
  categoryDisplayNameNo?: string;
  exerciseDisplayNameEn?: string;
  exerciseDisplayNameNo?: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  equipmentKeys: string[];
}

export interface GarminExerciseResolution {
  match: GarminExerciseDefinition | null;
  matches: GarminExerciseDefinition[];
}

const catalog = catalogJson as GarminExerciseCatalogJson;
const exerciseIndex = new Map<string, GarminExerciseDefinition>();
const displayAliasIndex = new Map<string, GarminExerciseDefinition[]>();
const combinedKeyAliasIndex = new Map<string, GarminExerciseDefinition[]>();
const rawKeyAliasIndex = new Map<string, GarminExerciseDefinition[]>();

function normalizeLookupValue(value: string | undefined | null): string {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ');
}

function addAlias(
  index: Map<string, GarminExerciseDefinition[]>,
  alias: string | undefined | null,
  definition: GarminExerciseDefinition
): void {
  const normalized = normalizeLookupValue(alias);
  if (!normalized) {
    return;
  }

  const existing = index.get(normalized) ?? [];
  if (!existing.some(item => item.categoryKey === definition.categoryKey && item.exerciseKey === definition.exerciseKey)) {
    existing.push(definition);
    index.set(normalized, existing);
  }
}

function createDisplayName(preferred?: string, fallback?: string, raw?: string): string | undefined {
  return preferred ?? fallback ?? raw;
}

for (const [categoryKey, category] of Object.entries(catalog.categories)) {
  for (const [exerciseKey, exercise] of Object.entries(category.exercises)) {
    const definition: GarminExerciseDefinition = {
      categoryKey,
      exerciseKey,
      categoryDisplayNameEn: category.displayNameEn ?? undefined,
      categoryDisplayNameNo: category.displayNameNo ?? undefined,
      exerciseDisplayNameEn: exercise.displayNameEn ?? undefined,
      exerciseDisplayNameNo: exercise.displayNameNo ?? undefined,
      primaryMuscles: exercise.primaryMuscles ?? [],
      secondaryMuscles: exercise.secondaryMuscles ?? [],
      equipmentKeys: exercise.equipmentKeys ?? [],
    };

    exerciseIndex.set(`${categoryKey}:${exerciseKey}`, definition);
    addAlias(rawKeyAliasIndex, exerciseKey, definition);
    addAlias(combinedKeyAliasIndex, `${categoryKey}_${exerciseKey}`, definition);
    addAlias(displayAliasIndex, exercise.displayNameEn, definition);
    addAlias(displayAliasIndex, exercise.displayNameNo, definition);
    addAlias(displayAliasIndex, `${category.displayNameEn ?? categoryKey} ${exercise.displayNameEn ?? exerciseKey}`, definition);
    addAlias(displayAliasIndex, `${category.displayNameNo ?? categoryKey} ${exercise.displayNameNo ?? exerciseKey}`, definition);

    if (exerciseKey === categoryKey) {
      addAlias(rawKeyAliasIndex, categoryKey, definition);
      addAlias(displayAliasIndex, category.displayNameEn, definition);
      addAlias(displayAliasIndex, category.displayNameNo, definition);
    }
  }
}

export function getGarminExerciseByKeys(
  categoryKey: string | undefined,
  exerciseKey: string | undefined
): GarminExerciseDefinition | null {
  if (!categoryKey || !exerciseKey) {
    return null;
  }

  return exerciseIndex.get(`${categoryKey}:${exerciseKey}`) ?? null;
}

export function resolveGarminExerciseByName(name: string): GarminExerciseResolution {
  const normalized = normalizeLookupValue(name);
  if (!normalized) {
    return { match: null, matches: [] };
  }

  for (const index of [displayAliasIndex, combinedKeyAliasIndex, rawKeyAliasIndex]) {
    const matches = index.get(normalized) ?? [];
    if (matches.length === 1) {
      return { match: matches[0], matches };
    }

    if (matches.length > 1) {
      return { match: null, matches };
    }
  }

  return { match: null, matches: [] };
}

export function getGarminStrengthExerciseDisplay(
  categoryKey: string | undefined | null,
  exerciseKey: string | undefined | null
): {
  categoryDisplayName?: string;
  exerciseDisplayName?: string;
} {
  const match = getGarminExerciseByKeys(categoryKey ?? undefined, exerciseKey ?? undefined);

  return {
    categoryDisplayName: createDisplayName(
      match?.categoryDisplayNameNo,
      match?.categoryDisplayNameEn,
      categoryKey ?? undefined
    ),
    exerciseDisplayName: createDisplayName(
      match?.exerciseDisplayNameNo,
      match?.exerciseDisplayNameEn,
      exerciseKey ?? undefined
    ),
  };
}

export function formatGarminExerciseCandidates(matches: GarminExerciseDefinition[]): string {
  return matches
    .slice(0, 5)
    .map(match => {
      const categoryLabel = createDisplayName(match.categoryDisplayNameNo, match.categoryDisplayNameEn, match.categoryKey);
      const exerciseLabel = createDisplayName(match.exerciseDisplayNameNo, match.exerciseDisplayNameEn, match.exerciseKey);
      return `${categoryLabel} / ${exerciseLabel} (${match.categoryKey}:${match.exerciseKey})`;
    })
    .join('; ');
}
