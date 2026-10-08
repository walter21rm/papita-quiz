function hashString(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic permutation of 0..size-1 for a given seed, never the identity when size > 1. */
export function shuffledIndices(size: number, seed: string): number[] {
  const random = mulberry32(hashString(seed));
  const indices = Array.from({ length: size }, (_, index) => index);
  for (let i = size - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  if (size > 1 && indices.every((value, index) => value === index)) indices.push(indices.shift()!);
  return indices;
}
