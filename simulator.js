/*
 * Recombinator Lab
 *
 * IMPORTANT:
 * This first implementation is a configurable PoE-inspired model.
 * It is NOT intended to claim exact reproduction of every historical
 * or current Path of Exile recombinator mechanic.
 *
 * The engine is intentionally isolated from the UI so that the
 * recombination rules can later be replaced with exact league/version
 * mechanics without rewriting the frontend.
 */

export const MAX_PREFIXES = 3;
export const MAX_SUFFIXES = 3;


/* -------------------------------------------------------------
 * Seeded random number generator
 * ------------------------------------------------------------- */

export class RNG {
  constructor(seed = Date.now()) {
    this.seed = normalizeSeed(seed);
    this.state = this.seed;
  }

  next() {
    // Mulberry32
    let t = this.state += 0x6D2B79F5;

    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  integer(min, max) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  chance(probability) {
    return this.next() < probability;
  }

  pick(array) {
    if (!array.length) {
      return undefined;
    }

    return array[this.integer(0, array.length - 1)];
  }

  weightedPick(items, weightFn) {
    if (!items.length) {
      return undefined;
    }

    let total = 0;

    for (const item of items) {
      total += Math.max(0, weightFn(item));
    }

    if (total <= 0) {
      return this.pick(items);
    }

    let roll = this.next() * total;

    for (const item of items) {
      roll -= Math.max(0, weightFn(item));

      if (roll <= 0) {
        return item;
      }
    }

    return items[items.length - 1];
  }
}

function normalizeSeed(seed) {
  let n = Number(seed);

  if (!Number.isFinite(n)) {
    n = Date.now();
  }

  n = Math.floor(Math.abs(n)) >>> 0;

  if (n === 0) {
    n = 1;
  }

  return n;
}


/* -------------------------------------------------------------
 * Modifiers
 * ------------------------------------------------------------- */

export const MODS = [
  {
    id: "life",
    name: "+# to maximum Life",
    type: "prefix",
    group: "life",
    weight: 100
  },
  {
    id: "energy_shield",
    name: "+# to maximum Energy Shield",
    type: "prefix",
    group: "energy_shield",
    weight: 100
  },
  {
    id: "spell_damage",
    name: "#% increased Spell Damage",
    type: "prefix",
    group: "spell_damage",
    weight: 100
  },
  {
    id: "gem_levels",
    name: "+1 to Level of all Spell Skill Gems",
    type: "prefix",
    group: "gem_levels",
    weight: 50
  },
  {
    id: "mana",
    name: "+# to maximum Mana",
    type: "prefix",
    group: "mana",
    weight: 100
  },
  {
    id: "armour",
    name: "#% increased Armour",
    type: "prefix",
    group: "armour",
    weight: 100
  },

  {
    id: "fire_res",
    name: "+#% to Fire Resistance",
    type: "suffix",
    group: "fire_res",
    weight: 100
  },
  {
    id: "cold_res",
    name: "+#% to Cold Resistance",
    type: "suffix",
    group: "cold_res",
    weight: 100
  },
  {
    id: "lightning_res",
    name: "+#% to Lightning Resistance",
    type: "suffix",
    group: "lightning_res",
    weight: 100
  },
  {
    id: "chaos_res",
    name: "+#% to Chaos Resistance",
    type: "suffix",
    group: "chaos_res",
    weight: 100
  },
  {
    id: "dexterity",
    name: "+# to Dexterity",
    type: "suffix",
    group: "dexterity",
    weight: 100
  },
  {
    id: "intelligence",
    name: "+# to Intelligence",
    type: "suffix",
    group: "intelligence",
    weight: 100
  },
  {
    id: "cast_speed",
    name: "#% increased Cast Speed",
    type: "suffix",
    group: "cast_speed",
    weight: 100
  },
  {
    id: "attributes",
    name: "# to Strength and Dexterity",
    type: "suffix",
    group: "attributes",
    weight: 75
  }
];


export function getMod(id) {
  return MODS.find(mod => mod.id === id);
}


/* -------------------------------------------------------------
 * Example items
 * ------------------------------------------------------------- */

export const DEFAULT_ITEMS = {
  a: {
    base: "Vaal Regalia",
    prefixes: [
      "life",
      "energy_shield"
    ],
    suffixes: [
      "fire_res",
      "chaos_res"
    ]
  },

  b: {
    base: "Vaal Regalia",
    prefixes: [
      "gem_levels",
      "spell_damage"
    ],
    suffixes: [
      "cold_res",
      "cast_speed"
    ]
  }
};


/* -------------------------------------------------------------
 * Utility functions
 * ------------------------------------------------------------- */

function cloneItem(item) {
  return {
    base: item.base,
    prefixes: [...item.prefixes],
    suffixes: [...item.suffixes]
  };
}

function unique(array) {
  return [...new Set(array)];
}

function getAllMods(item) {
  return [
    ...item.prefixes.map(id => getMod(id)).filter(Boolean),
    ...item.suffixes.map(id => getMod(id)).filter(Boolean)
  ];
}

function shuffle(array, rng) {
  const result = [...array];

  for (let i = result.length - 1; i > 0; i--) {
    const j = rng.integer(0, i);

    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}


/* -------------------------------------------------------------
 * Core recombination model
 * ------------------------------------------------------------- */

/*
 * The model has four broad stages:
 *
 * 1. Create a modifier pool from both parents.
 * 2. Give each modifier a chance to survive.
 * 3. Resolve duplicate modifier groups.
 * 4. Enforce the 3-prefix / 3-suffix item limits.
 *
 * Parent-specific "heritage" is retained so that a modifier appearing
 * on both parents gets a stronger survival chance.
 */

export function recombine(itemA, itemB, rng) {
  const modsA = getAllMods(itemA);
  const modsB = getAllMods(itemB);

  const byId = new Map();

  for (const mod of modsA) {
    byId.set(mod.id, {
      mod,
      fromA: true,
      fromB: false
    });
  }

  for (const mod of modsB) {
    if (byId.has(mod.id)) {
      byId.get(mod.id).fromB = true;
    } else {
      byId.set(mod.id, {
        mod,
        fromA: false,
        fromB: true
      });
    }
  }

  let candidates = [...byId.values()];

  /*
   * Approximate survival weighting:
   *
   * - present on both parents: strong
   * - present on one parent: normal
   *
   * These numbers are deliberately centralized.
   */
  const selected = [];

  for (const candidate of candidates) {
    const heritageBonus =
      candidate.fromA && candidate.fromB
        ? 0.22
        : 0;

    const baseChance = 0.58 + heritageBonus;

    if (rng.chance(baseChance)) {
      selected.push(candidate);
    }
  }

  /*
   * Avoid an empty item. Select one random candidate if everything
   * was lost.
   */
  if (selected.length === 0 && candidates.length > 0) {
    selected.push(
      rng.weightedPick(
        candidates,
        candidate => candidate.mod.weight
      )
    );
  }

  /*
   * Resolve modifier groups.
   *
   * In this starter model, two modifiers with the same group cannot
   * coexist.
   */
  const groups = new Set();
  const resolved = [];

  for (const candidate of shuffle(selected, rng)) {
    const group = candidate.mod.group;

    if (groups.has(group)) {
      continue;
    }

    groups.add(group);
    resolved.push(candidate);
  }

  /*
   * Split prefixes and suffixes.
   */
  let prefixes = resolved
    .filter(x => x.mod.type === "prefix")
    .map(x => x.mod.id);

  let suffixes = resolved
    .filter(x => x.mod.type === "suffix")
    .map(x => x.mod.id);

  /*
   * Enforce maximum modifier counts.
   *
   * Higher-weight mods are slightly favored when truncation is
   * necessary.
   */
  if (prefixes.length > MAX_PREFIXES) {
    const prefixObjects = prefixes.map(id => getMod(id));

    prefixes = selectLimitedWeighted(
      prefixObjects,
      MAX_PREFIXES,
      rng
    ).map(mod => mod.id);
  }

  if (suffixes.length > MAX_SUFFIXES) {
    const suffixObjects = suffixes.map(id => getMod(id));

    suffixes = selectLimitedWeighted(
      suffixObjects,
      MAX_SUFFIXES,
      rng
    ).map(mod => mod.id);
  }

  return {
    base: rng.chance(0.5) ? itemA.base : itemB.base,
    prefixes,
    suffixes
  };
}


function selectLimitedWeighted(items, count, rng) {
  const available = [...items];
  const selected = [];

  while (available.length > 0 && selected.length < count) {
    const chosen = rng.weightedPick(
      available,
      item => item.weight
    );

    selected.push(chosen);

    const index = available.indexOf(chosen);

    if (index >= 0) {
      available.splice(index, 1);
    }
  }

  return selected;
}


/* -------------------------------------------------------------
 * Target matching
 * ------------------------------------------------------------- */

export function resultContainsTarget(result, targetIds) {
  if (!targetIds || targetIds.length === 0) {
    return false;
  }

  const resultIds = new Set([
    ...result.prefixes,
    ...result.suffixes
  ]);

  return targetIds.every(id => resultIds.has(id));
}


/* -------------------------------------------------------------
 * Full simulation
 * ------------------------------------------------------------- */

export function runSimulation({
  itemA,
  itemB,
  iterations = 10000,
  seed,
  targetIds = []
}) {
  const rng = new RNG(seed);

  const modCountDistribution = new Map();
  const modSurvival = new Map();

  const examples = [];

  let targetHits = 0;
  let totalMods = 0;

  const allParentMods = unique([
    ...itemA.prefixes,
    ...itemA.suffixes,
    ...itemB.prefixes,
    ...itemB.suffixes
  ]);

  for (const id of allParentMods) {
    modSurvival.set(id, {
      id,
      attempts: iterations,
      hits: 0
    });
  }

  for (let i = 0; i < iterations; i++) {
    const result = recombine(itemA, itemB, rng);

    const prefixCount = result.prefixes.length;
    const suffixCount = result.suffixes.length;
    const modCount = prefixCount + suffixCount;

    totalMods += modCount;

    modCountDistribution.set(
      modCount,
      (modCountDistribution.get(modCount) || 0) + 1
    );

    for (const id of result.prefixes) {
      const stat = modSurvival.get(id);

      if (stat) {
        stat.hits++;
      }
    }

    for (const id of result.suffixes) {
      const stat = modSurvival.get(id);

      if (stat) {
        stat.hits++;
      }
    }

    if (resultContainsTarget(result, targetIds)) {
      targetHits++;
    }

    /*
     * Keep only a small number of examples.
     */
    if (examples.length < 30) {
      examples.push({
        index: i + 1,
        result,
        targetHit: resultContainsTarget(result, targetIds)
      });
    } else {
      /*
       * Reservoir sampling lets examples remain representative.
       */
      const replacement = rng.integer(0, i);

      if (replacement < examples.length) {
        examples[replacement] = {
          index: i + 1,
          result,
          targetHit: resultContainsTarget(result, targetIds)
        };
      }
    }
  }

  const survival = [...modSurvival.values()]
    .map(stat => ({
      ...stat,
      probability: stat.hits / stat.attempts
    }))
    .sort((a, b) => b.probability - a.probability);

  return {
    seed: rng.seed,
    iterations,
    targetHits,
    targetProbability:
      targetIds.length > 0
        ? targetHits / iterations
        : null,
    averageMods: totalMods / iterations,
    modCountDistribution:
      [...modCountDistribution.entries()]
        .sort((a, b) => a[0] - b[0]),
    survival,
    examples: examples.sort((a, b) => a.index - b.index)
  };
}


/* -------------------------------------------------------------
 * Serialization
 * ------------------------------------------------------------- */

export function serializeConfig({
  itemA,
  itemB,
  iterations,
  seed,
  targetIds
}) {
  return JSON.stringify({
    version: 1,
    itemA: cloneItem(itemA),
    itemB: cloneItem(itemB),
    iterations,
    seed,
    targetIds
  }, null, 2);
}


export function parseConfig(json) {
  const parsed = JSON.parse(json);

  if (!parsed.itemA || !parsed.itemB) {
    throw new Error("Invalid configuration.");
  }

  return {
    itemA: {
      base: String(parsed.itemA.base || "Unknown"),
      prefixes: Array.isArray(parsed.itemA.prefixes)
        ? parsed.itemA.prefixes
        : [],
      suffixes: Array.isArray(parsed.itemA.suffixes)
        ? parsed.itemA.suffixes
        : []
    },

    itemB: {
      base: String(parsed.itemB.base || "Unknown"),
      prefixes: Array.isArray(parsed.itemB.prefixes)
        ? parsed.itemB.prefixes
        : [],
      suffixes: Array.isArray(parsed.itemB.suffixes)
        ? parsed.itemB.suffixes
        : []
    },

    iterations: Number(parsed.iterations) || 10000,
    seed: parsed.seed,
    targetIds: Array.isArray(parsed.targetIds)
      ? parsed.targetIds
      : []
  };
}
