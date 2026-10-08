export function stripAccents(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

const LEADING_ARTICLES = /^(el|la|los|las|lo|un|una|unos|unas|the|a|an)\s+/;

export function normalizeAnswer(text: string): string {
  return stripAccents(text.toLowerCase())
    .replace(/[^\p{L}\p{N}\s.,]/gu, " ")
    .replace(/(\d)[.,](\d)/g, "$1.$2")
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(LEADING_ARTICLES, "");
}

/** Edit distance where swapping two adjacent letters counts as a single typo. */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const rows = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
      }
    }
  }
  return rows[a.length][b.length];
}

/** Lenient comparison for written answers: ignores case, accents, articles and small typos. */
export function answersMatch(given: string, expected: string): boolean {
  const a = normalizeAnswer(given);
  const b = normalizeAnswer(expected);
  if (!a || !b) return false;
  if (a === b) return true;
  const digitsA = a.replace(/\D/g, "");
  const digitsB = b.replace(/\D/g, "");
  if (digitsA || digitsB) {
    if (digitsA !== digitsB) return false;
    const lettersA = a.replace(/[\d\s]/g, "");
    const lettersB = b.replace(/[\d\s]/g, "");
    return editDistance(lettersA, lettersB) <= (lettersB.length >= 5 ? 1 : 0);
  }
  const allowed = b.length >= 12 ? 2 : b.length >= 5 ? 1 : 0;
  return editDistance(a, b) <= allowed;
}
