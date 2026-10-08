import type { Level, QuestionType } from "./types";

// Relative weight of each question type per level; every selected type still appears at least once
// when the quiz is long enough.
const WEIGHTS: Record<Level, Record<QuestionType, number>> = {
  basico: {
    single_choice: 3,
    multiple_choice: 1,
    true_false: 2.5,
    fill_blank: 2,
    short_answer: 1,
    open_ended: 0.25,
    matching: 1.5,
    ordering: 1,
  },
  intermedio: {
    single_choice: 3,
    multiple_choice: 2,
    true_false: 1.5,
    fill_blank: 1.5,
    short_answer: 1.5,
    open_ended: 0.75,
    matching: 1,
    ordering: 1,
  },
  avanzado: {
    single_choice: 2.5,
    multiple_choice: 2,
    true_false: 1,
    fill_blank: 1,
    short_answer: 2,
    open_ended: 1.5,
    matching: 1,
    ordering: 1,
  },
  experto: {
    single_choice: 2,
    multiple_choice: 2,
    true_false: 0.75,
    fill_blank: 0.75,
    short_answer: 2,
    open_ended: 2.5,
    matching: 1,
    ordering: 1,
  },
};

function weight(level: Level, type: QuestionType): number {
  return Math.max(WEIGHTS[level][type], 0.25);
}

export function planTypeCounts(types: QuestionType[], level: Level, total: number): Record<string, number> {
  const counts: Record<string, number> = Object.fromEntries(types.map((type) => [type, 0]));
  if (total <= 0 || types.length === 0) return counts;

  let remaining = total;
  if (total >= types.length) {
    for (const type of types) counts[type] = 1;
    remaining -= types.length;
  }

  const weightSum = types.reduce((sum, type) => sum + weight(level, type), 0);
  const shares = types.map((type) => ({ type, exact: (remaining * weight(level, type)) / weightSum }));
  for (const share of shares) counts[share.type] += Math.floor(share.exact);

  let leftover = total - Object.values(counts).reduce((sum, count) => sum + count, 0);
  shares.sort(
    (a, b) => (b.exact % 1) - (a.exact % 1) || weight(level, b.type) - weight(level, a.type),
  );
  for (let index = 0; leftover > 0; index = (index + 1) % shares.length, leftover--) {
    counts[shares[index].type]++;
  }
  return counts;
}

/** How many questions of each type the next batch should contain, given what the quiz already has. */
export function batchTypeCounts(
  types: QuestionType[],
  level: Level,
  target: number,
  existing: QuestionType[],
  batchSize: number,
): Partial<Record<QuestionType, number>> {
  const plan = planTypeCounts(types, level, Math.min(target, existing.length + batchSize));
  const have: Record<string, number> = {};
  for (const type of existing) have[type] = (have[type] ?? 0) + 1;

  const need = types.map((type) => ({ type, count: Math.max(0, plan[type] - (have[type] ?? 0)) }));
  let total = need.reduce((sum, item) => sum + item.count, 0);

  while (total > batchSize) {
    const largest = need.reduce((best, item) => (item.count > best.count ? item : best));
    largest.count--;
    total--;
  }
  while (total < batchSize) {
    const neediest = need.reduce((best, item) => {
      const gap = (plan[item.type] ?? 0) - (have[item.type] ?? 0) - item.count;
      const bestGap = (plan[best.type] ?? 0) - (have[best.type] ?? 0) - best.count;
      if (gap !== bestGap) return gap > bestGap ? item : best;
      return weight(level, item.type) > weight(level, best.type) ? item : best;
    });
    neediest.count++;
    total++;
  }

  return Object.fromEntries(need.filter((item) => item.count > 0).map((item) => [item.type, item.count]));
}
