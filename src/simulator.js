
export function createEmptyItem() {
  return {
    baseType: null,
    baseId: null,

    itemLevel: 1,

    influences: [],

    prefixes: [],
    suffixes: []
  };
}


/*
 * ---------------------------------------------------------
 * VALIDATION
 * ---------------------------------------------------------
 */

export function validateInputItems(
  itemA,
  itemB,
  database
) {
  if (!itemA) {
    throw new Error(
      "Item A is missing."
    );
  }

  if (!itemB) {
    throw new Error(
      "Item B is missing."
    );
  }


  if (!itemA.baseType) {
    throw new Error(
      "Item A has no base type."
    );
  }

  if (!itemB.baseType) {
    throw new Error(
      "Item B has no base type."
    );
  }


  /*
   * Critical recombinator restriction.
   */
  if (
    itemA.baseType !==
    itemB.baseType
  ) {
    throw new Error(
      "Item A and Item B must use the same base type."
    );
  }


  const baseA =
    database.bases[
      itemA.baseId
    ];

  const baseB =
    database.bases[
      itemB.baseId
    ];


  if (!baseA) {
    throw new Error(
      `Unknown Item A base: ${itemA.baseId}`
    );
  }

  if (!baseB) {
    throw new Error(
      `Unknown Item B base: ${itemB.baseId}`
    );
  }


  /*
   * Make sure the base itself agrees
   * with the selected category.
   */
  if (
    baseA.baseType !==
    itemA.baseType
  ) {
    throw new Error(
      "Item A base does not match its selected base type."
    );
  }

  if (
    baseB.baseType !==
    itemB.baseType
  ) {
    throw new Error(
      "Item B base does not match its selected base type."
    );
  }


  if (
    !Number.isInteger(
      itemA.itemLevel
    ) ||
    itemA.itemLevel < 1
  ) {
    throw new Error(
      "Item A has an invalid item level."
    );
  }

  if (
    !Number.isInteger(
      itemB.itemLevel
    ) ||
    itemB.itemLevel < 1
  ) {
    throw new Error(
      "Item B has an invalid item level."
    );
  }


  return {
    baseA,
    baseB
  };
}


/*
 * ---------------------------------------------------------
 * RECOMBINATION
 * ---------------------------------------------------------
 *
 * This is intentionally the engine boundary.
 *
 * The UI passes complete item descriptions here.
 *
 * The exact PoE recombination probability rules can
 * subsequently replace the placeholder selection below.
 */

export function recombine({
  itemA,
  itemB,
  database,
  random = Math.random
}) {

  const {
    baseA,
    baseB
  } =
    validateInputItems(
      itemA,
      itemB,
      database
    );


  /*
   * For the first working version, choose one
   * of the two bases with equal probability.
   *
   * This should NOT yet be treated as the final
   * PoE recombinator base-selection algorithm.
   */
  const outputBase =
    random() < 0.5
      ? baseA
      : baseB;


  /*
   * Placeholder mod merging.
   *
   * The next simulator layer will implement:
   *
   * - prefix/suffix selection
   * - mod groups
   * - weights
   * - tiers
   * - fractured mods
   * - influenced mods
   * - exclusive mods
   * - impossible combinations
   */
  const prefixes = [
    ...itemA.prefixes,
    ...itemB.prefixes
  ];

  const suffixes = [
    ...itemA.suffixes,
    ...itemB.suffixes
  ];


  return {
    baseType:
      outputBase.baseType,

    baseId:
      outputBase.id,

    base:
      outputBase.name,

    itemLevel:
      Math.max(
        itemA.itemLevel,
        itemB.itemLevel
      ),

    influences:
      [
        ...new Set([
          ...itemA.influences,
          ...itemB.influences
        ])
      ],

    prefixes,

    suffixes
  };
}


/*
 * Run many simulations.
 */
export function simulate({
  itemA,
  itemB,
  database,
  iterations = 10000,
  random = Math.random
}) {

  validateInputItems(
    itemA,
    itemB,
    database
  );

  const results = [];

  for (
    let i = 0;
    i < iterations;
    i++
  ) {
    results.push(
      recombine({
        itemA,
        itemB,
        database,
        random
      })
    );
  }

  return results;
}
