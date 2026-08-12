/*
 * Recombinator Lab — rules engine
 *
 * Model target: Path of Exile 3.26-style Recombinator.
 *
 * Data model:
 *   Item
 *     base
 *     itemLevel
 *     influence[]
 *     prefixes[]
 *     suffixes[]
 *
 *   Modifier instance
 *     modId
 *     tier
 *     fractured
 *     influenced
 *
 * Modifier definition:
 *     id
 *     name
 *     type
 *     group
 *     influence
 *     tiers[]
 *
 * IMPORTANT:
 * The modifier database is intentionally separate from the engine.
 * Replace data/mods.js with a complete league/version dataset.
 */

export const MAX_PREFIXES = 3;
export const MAX_SUFFIXES = 3;


/* ============================================================
 * RNG
 * ============================================================ */

export class RNG {
  constructor(seed = Date.now()) {
    this.seed = normalizeSeed(seed);
    this.state = this.seed;
  }

  next() {
    let t = this.state += 0x6D2B79F5;

    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  integer(min, max) {
    return Math.floor(
      this.next() * (max - min + 1)
    ) + min;
  }

  chance(probability) {
    return this.next() < probability;
  }

  pick(array) {
    return array[
      this.integer(0, array.length - 1)
    ];
  }
}


function normalizeSeed(seed) {
  let n = Number(seed);

  if (!Number.isFinite(n)) {
    n = Date.now();
  }

  n = Math.abs(Math.floor(n)) >>> 0;

  return n || 1;
}


/* ============================================================
 * RECOMBINATOR MOD COUNT TABLE
 *
 * Current documented selection distribution:
 *
 * pool size  | 1     2     3     4     5     6
 * ------------------------------------------------
 * max        | 1     2     3     3     3     3
 *
 * Exact probabilities:
 *
 * 1:
 *   0 = 1/3
 *   1 = 2/3
 *
 * 2:
 *   1 = 2/3
 *   2 = 1/3
 *
 * 3:
 *   1 = 3/10
 *   2 = 1/2
 *   3 = 1/5
 *
 * 4:
 *   1 = 1/10
 *   2 = 55/100
 *   3 = 35/100
 *
 * 5:
 *   2 = 1/2
 *   3 = 1/2
 *
 * 6:
 *   2 = 3/10
 *   3 = 7/10
 *
 * Source: PoEDB's current Recombinator documentation.
 * ============================================================ */

const MOD_COUNT_TABLE = {
  0: [
    [0, 1]
  ],

  1: [
    [0, 1 / 3],
    [1, 2 / 3]
  ],

  2: [
    [1, 2 / 3],
    [2, 1 / 3]
  ],

  3: [
    [1, 3 / 10],
    [2, 1 / 2],
    [3, 1 / 5]
  ],

  4: [
    [1, 1 / 10],
    [2, 55 / 100],
    [3, 35 / 100]
  ],

  5: [
    [2, 1 / 2],
    [3, 1 / 2]
  ],

  6: [
    [2, 3 / 10],
    [3, 7 / 10]
  ]
};


function weightedDiscretePick(table, rng) {
  const roll = rng.next();

  let accumulated = 0;

  for (const [value, probability] of table) {
    accumulated += probability;

    if (roll < accumulated) {
      return value;
    }
  }

  return table[table.length - 1][0];
}


function chooseModifierCount(poolSize, rng) {
  const capped = Math.min(poolSize, 6);

  return weightedDiscretePick(
    MOD_COUNT_TABLE[capped],
    rng
  );
}


/* ============================================================
 * ITEM LEVEL
 * ============================================================ */

export function resultingItemLevel(itemA, itemB) {
  return Math.round(
    (itemA.itemLevel + itemB.itemLevel) / 2
  );
}


/* ============================================================
 * MODIFIER DATABASE API
 * ============================================================ */

export function getModifierDefinition(database, modId) {
  return database.modifiers[modId] ?? null;
}


export function getModifierTier(
  database,
  modId,
  tierNumber
) {
  const definition =
    getModifierDefinition(database, modId);

  if (!definition) {
    return null;
  }

  return definition.tiers.find(
    tier => tier.tier === tierNumber
  ) ?? null;
}


export function getHighestAvailableTier(
  database,
  modId,
  itemLevel
) {
  const definition =
    getModifierDefinition(database, modId);

  if (!definition) {
    return null;
  }

  const available = definition.tiers
    .filter(tier => tier.requiredItemLevel <= itemLevel)
    .sort((a, b) => a.tier - b.tier);

  return available[0] ?? null;
}


/* ============================================================
 * MODIFIER INSTANCES
 * ============================================================ */

function normalizeModifier(
  database,
  instance,
  itemLevel
) {
  const definition =
    getModifierDefinition(database, instance.modId);

  if (!definition) {
    throw new Error(
      `Unknown modifier: ${instance.modId}`
    );
  }

  const tier =
    getModifierTier(
      database,
      instance.modId,
      instance.tier
    );

  if (!tier) {
    throw new Error(
      `Unknown tier ${instance.tier} for ${instance.modId}`
    );
  }

  return {
    ...instance,

    name: definition.name,

    type: definition.type,

    group: definition.group,

    influence:
      instance.influenced ??
      definition.influence ??
      null,

    /*
     * This does not change the existing mod tier merely because
     * the output item has a different ilvl. It is the availability
     * of the modifier on the output item that is important.
     */
    availableAtOutputLevel:
      tier.requiredItemLevel <= itemLevel
  };
}


/* ============================================================
 * MOD GROUPS
 * ============================================================ */

function groupsConflict(a, b) {
  if (!a.group || !b.group) {
    return false;
  }

  return a.group === b.group;
}


function removeConflictingModifiers(
  database,
  modifiers,
  rng
) {
  const result = [];
  const occupiedGroups = new Set();

  /*
   * Fractured modifiers are special: they are retained with
   * their fractured base and should not be treated like ordinary
   * randomly selected modifiers.
   */

  for (const candidate of modifiers) {
    if (candidate.fractured) {
      result.push(candidate);

      if (candidate.group) {
        occupiedGroups.add(candidate.group);
      }

      continue;
    }

    if (
      candidate.group &&
      occupiedGroups.has(candidate.group)
    ) {
      continue;
    }

    result.push(candidate);

    if (candidate.group) {
      occupiedGroups.add(candidate.group);
    }
  }

  return result;
}


/* ============================================================
 * FRACTURED MODIFIERS
 * ============================================================ */

function getFracturedMods(item) {
  return [
    ...item.prefixes,
    ...item.suffixes
  ].filter(mod => mod.fractured);
}


function fracturedModsForOutputBase(
  outputItem
) {
  return getFracturedMods(outputItem)
    .map(mod => ({
      ...mod,
      fractured: true
    }));
}


/* ============================================================
 * INFLUENCE
 * ============================================================ */

function getOutputInfluence(itemA, itemB, rng) {
  /*
   * The Recombinator chooses one input as the output base.
   * Base-tied properties follow that chosen base.
   *
   * Therefore the caller should first select the output base,
   * then use that item's influence.
   */
  return rng.chance(0.5)
    ? [...itemA.influence]
    : [...itemB.influence];
}


/* ============================================================
 * BASE SELECTION
 * ============================================================ */

function selectOutputBase(itemA, itemB, rng) {
  /*
   * First implementation of base choice.
   *
   * The later weight-transfer model should replace this with
   * the exact per-base success calculation for the complete
   * modifier dataset.
   */
  return rng.chance(0.5)
    ? itemA
    : itemB;
}


/* ============================================================
 * ELIGIBLE MODIFIER POOLS
 * ============================================================ */

function createPool(
  database,
  itemA,
  itemB,
  type,
  outputItemLevel,
  outputInfluence
) {
  const pool = [];

  const items = [
    { item: itemA, source: "A" },
    { item: itemB, source: "B" }
  ];

  for (const { item, source } of items) {
    const sourceMods =
      type === "prefix"
        ? item.prefixes
        : item.suffixes;

    for (const instance of sourceMods) {
      /*
       * Fractured mods are retained through the fractured base
       * mechanism rather than entering the random selection pool.
       */
      if (instance.fractured) {
        continue;
      }

      const normalized =
        normalizeModifier(
          database,
          instance,
          outputItemLevel
        );

      /*
       * A modifier must be legal on the output base.
       *
       * This is where base tags / mod tags should ultimately be
       * evaluated from the complete mod database.
       */
      if (!normalized.availableAtOutputLevel) {
        continue;
      }

      /*
       * Influence-specific modifiers require the appropriate
       * influence to exist on the output base.
       */
      if (
        normalized.influence &&
        !outputInfluence.includes(
          normalized.influence
        )
      ) {
        continue;
      }

      pool.push({
        ...normalized,
        source
      });
    }
  }

  /*
   * The same explicit modifier can appear on both inputs.
   * Keep it as one logical pool entry while remembering both
   * sources.
   */
  const merged = new Map();

  for (const candidate of pool) {
    if (!merged.has(candidate.modId)) {
      merged.set(candidate.modId, {
        ...candidate,
        sources: [candidate.source]
      });

      continue;
    }

    const existing = merged.get(candidate.modId);

    if (!existing.sources.includes(candidate.source)) {
      existing.sources.push(candidate.source);
    }
  }

  return [...merged.values()];
}


/* ============================================================
 * MODIFIER SELECTION
 * ============================================================ */

/*
 * Select exactly N modifiers from the pool.
 *
 * This is deliberately uniform at this stage because the
 * documented Recombinator mechanic first determines how many
 * modifiers are selected from the prefix/suffix pool.
 *
 * The weight-aware transfer calculation belongs to the
 * base-selection / transfer-success layer, not a naive
 * "roll all input mods by their weight" implementation.
 */

function selectModifiers(
  pool,
  count,
  rng
) {
  const candidates = [...pool];
  const selected = [];

  while (
    selected.length < count &&
    candidates.length > 0
  ) {
    const index =
      rng.integer(0, candidates.length - 1);

    selected.push(
      candidates[index]
    );

    candidates.splice(index, 1);
  }

  return selected;
}


/* ============================================================
 * EXCLUSIVE MODIFIERS
 * ============================================================ */

function resolveExclusiveMods(
  selected,
  rng
) {
  const result = [];
  const occupiedGroups = new Set();

  /*
   * We randomize the order before resolving conflicts.
   *
   * Later this should become the game's exact conflict resolution
   * ordering for every special exclusive family.
   */
  const shuffled = [...selected];

  for (
    let i = shuffled.length - 1;
    i > 0;
    i--
  ) {
    const j = rng.integer(0, i);

    [
      shuffled[i],
      shuffled[j]
    ] = [
      shuffled[j],
      shuffled[i]
    ];
  }

  for (const mod of shuffled) {
    if (
      mod.group &&
      occupiedGroups.has(mod.group)
    ) {
      continue;
    }

    result.push(mod);

    if (mod.group) {
      occupiedGroups.add(mod.group);
    }
  }

  return result;
}


/* ============================================================
 * COMPLETE RECOMBINATION
 * ============================================================ */

export function recombine({
  database,
  itemA,
  itemB,
  rng
}) {
  /*
   * 1. Select output base.
   */
  const outputBase =
    selectOutputBase(
      itemA,
      itemB,
      rng
    );

  /*
   * 2. Output item level is average + round.
   */
  const outputItemLevel =
    resultingItemLevel(
      itemA,
      itemB
    );

  /*
   * 3. Base-tied influence follows output base.
   */
  const outputInfluence =
    [...outputBase.influence];

  /*
   * 4. Build independent prefix/suffix pools.
   */
  const prefixPool =
    createPool(
      database,
      itemA,
      itemB,
      "prefix",
      outputItemLevel,
      outputInfluence
    );

  const suffixPool =
    createPool(
      database,
      itemA,
      itemB,
      "suffix",
      outputItemLevel,
      outputInfluence
    );

  /*
   * 5. Determine how many prefixes/suffixes survive.
   */
  const prefixCount =
    chooseModifierCount(
      prefixPool.length,
      rng
    );

  const suffixCount =
    chooseModifierCount(
      suffixPool.length,
      rng
    );

  /*
   * 6. Select modifiers.
   */
  let prefixes =
    selectModifiers(
      prefixPool,
      prefixCount,
      rng
    );

  let suffixes =
    selectModifiers(
      suffixPool,
      suffixCount,
      rng
    );

  /*
   * 7. Resolve exclusive groups.
   */
  prefixes =
    resolveExclusiveMods(
      prefixes,
      rng
    );

  suffixes =
    resolveExclusiveMods(
      suffixes,
      rng
    );

  /*
   * 8. Retain fractured modifiers from the selected fractured
   * base. They are not part of the random mod pool.
   */
  const fractured =
    fracturedModsForOutputBase(
      outputBase
    );

  for (const mod of fractured) {
    if (mod.type === "prefix") {
      prefixes.push(mod);
    } else {
      suffixes.push(mod);
    }
  }

  /*
   * 9. Enforce maximum affixes.
   *
   * Fractured mods occupy real affix slots.
   */
  prefixes = prefixes.slice(
    0,
    MAX_PREFIXES
  );

  suffixes = suffixes.slice(
    0,
    MAX_SUFFIXES
  );

  /*
   * 10. Return a complete result.
   */
  return {
    base: outputBase.base,

    itemLevel: outputItemLevel,

    influence: outputInfluence,

    prefixes,

    suffixes,

    fracturedPrefixes:
      prefixes.filter(
        mod => mod.fractured
      ),

    fracturedSuffixes:
      suffixes.filter(
        mod => mod.fractured
      )
  };
}


/* ============================================================
 * TARGET MATCHING
 * ============================================================ */

export function containsTarget(
  result,
  targetIds
) {
  const resultIds = new Set([
    ...result.prefixes.map(x => x.modId),
    ...result.suffixes.map(x => x.modId)
  ]);

  return targetIds.every(
    id => resultIds.has(id)
  );
}


/* ============================================================
 * FULL SIMULATION
 * ============================================================ */

export function runSimulation({
  database,
  itemA,
  itemB,
  iterations = 10000,
  seed,
  targetIds = []
}) {
  const rng =
    new RNG(seed);

  let targetHits = 0;
  let totalMods = 0;

  const modStats =
    new Map();

  const modDistribution =
    new Map();

  const examples = [];

  const parentMods = [
    ...itemA.prefixes,
    ...itemA.suffixes,
    ...itemB.prefixes,
    ...itemB.suffixes
  ];

  for (const instance of parentMods) {
    if (!modStats.has(instance.modId)) {
      modStats.set(instance.modId, {
        id: instance.modId,
        hits: 0,
        attempts: iterations
      });
    }
  }

  for (let i = 0; i < iterations; i++) {
    const result =
      recombine({
        database,
        itemA,
        itemB,
        rng
      });

    const allMods = [
      ...result.prefixes,
      ...result.suffixes
    ];

    totalMods += allMods.length;

    const count =
      allMods.length;

    modDistribution.set(
      count,
      (modDistribution.get(count) || 0) + 1
    );

    for (const mod of allMods) {
      const stat =
        modStats.get(mod.modId);

      if (stat) {
        stat.hits++;
      }
    }

    const hit =
      containsTarget(
        result,
        targetIds
      );

    if (hit) {
      targetHits++;
    }

    /*
     * Reservoir sample.
     */
    const example = {
      index: i + 1,
      result,
      targetHit: hit
    };

    if (examples.length < 50) {
      examples.push(example);
    } else {
      const replacement =
        rng.integer(0, i);

      if (replacement < examples.length) {
        examples[replacement] =
          example;
      }
    }
  }

  return {
    seed: rng.seed,

    iterations,

    targetHits,

    targetProbability:
      targetIds.length
        ? targetHits / iterations
        : null,

    averageMods:
      totalMods / iterations,

    itemLevel:
      resultingItemLevel(
        itemA,
        itemB
      ),

    modDistribution:
      [...modDistribution.entries()]
        .sort(
          (a, b) => a[0] - b[0]
        ),

    survival:
      [...modStats.values()]
        .map(stat => ({
          ...stat,

          probability:
            stat.hits / stat.attempts
        }))
        .sort(
          (a, b) =>
            b.probability -
            a.probability
        ),

    examples:
      examples.sort(
        (a, b) =>
          a.index - b.index
      )
  };
}
