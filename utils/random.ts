/**
 * Seeded random number generator for consistent pseudo-random selection
 * Uses a simple LCG (Linear Congruential Generator) algorithm
 */

export class SeededRandom {
  private seed: number;

  constructor(seed: string | number) {
    this.seed = typeof seed === 'string' ? this.hashString(seed) : seed;
  }

  /**
   * Simple string hash function
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Generate next pseudo-random number between 0 and 1
   */
  next(): number {
    // LCG parameters
    const a = 1664525;
    const c = 1013904223;
    const m = Math.pow(2, 32);

    this.seed = (a * this.seed + c) % m;
    return this.seed / m;
  }

  /**
   * Generate random integer between min (inclusive) and max (exclusive)
   */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min)) + min;
  }

  /**
   * Shuffle array in place using Fisher-Yates algorithm
   */
  shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i + 1);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  /**
   * Pick N unique random items from array
   */
  pick<T>(array: T[], count: number): T[] {
    if (count >= array.length) return [...array];
    const shuffled = this.shuffle(array);
    return shuffled.slice(0, count);
  }
}

/**
 * Create a seeded random generator from a string
 */
export function createSeededRandom(seed: string): SeededRandom {
  return new SeededRandom(seed);
}
