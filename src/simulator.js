const MAX_PREFIXES = 3;
const MAX_SUFFIXES = 3;


/*
 * ---------------------------------------------------------
 * ITEM
 * ---------------------------------------------------------
 */

export function createEmptyItem() {

  return {

    baseType: null,

    baseId: null,

    itemLevel: 86,

    influences: [],

    prefixes: [],

    suffixes: []

  };

}


/*
 * ---------------------------------------------------------
 * MODIFIER HELPERS
 * ---------------------------------------------------------
 */

function normalizeModifier(
  modifier
) {

  if (
    typeof modifier ===
    "string"
  ) {

    return {
      id: modifier,
      fractured: false
    };

  }


  if (
    modifier &&
    typeof modifier ===
    "object"
  ) {

    return {

      id:
        modifier.id,

      fractured:
        Boolean(
          modifier.fractured
        )

    };

  }


  return null;

}


function getModifierId(
  modifier
) {

  return normalizeModifier(
    modifier
  )?.id ?? null;

}


function getSelectedModifierIds(
  item
) {

  return [

    ...item.prefixes
      .map(getModifierId)
      .filter(Boolean),

    ...item.suffixes
      .map(getModifierId)
      .filter(Boolean)

  ];

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
    itemA.itemLevel < 1 ||
    itemA.itemLevel > 100
  ) {

    throw new Error(
      "Item A has an invalid item level."
    );

  }


  if (
    !Number.isInteger(
      itemB.itemLevel
    ) ||
    itemB.itemLevel < 1 ||
    itemB.itemLevel > 100
  ) {

    throw new Error(
      "Item B has an invalid item level."
    );

  }


  validateModifierList(
    itemA,
    "Item A"
  );


  validateModifierList(
    itemB,
    "Item B"
  );


  return {
    baseA,
    baseB
  };

}


/*
 * ---------------------------------------------------------
 * MODIFIER VALIDATION
 * ---------------------------------------------------------
 */

function validateModifierList(
  item,
  itemName
) {

  if (
    !Array.isArray(
      item.prefixes
    )
  ) {

    throw new Error(
      `${itemName} prefixes must be an array.`
    );

  }


  if (
    !Array.isArray(
      item.suffixes
    )
  ) {

    throw new Error(
      `${itemName} suffixes must be an array.`
    );

  }


  if (
    item.prefixes.length >
    MAX_PREFIXES
  ) {

    throw new Error(
      `${itemName} cannot have more than ${MAX_PREFIXES} prefixes.`
    );

  }


  if (
    item.suffixes.length >
    MAX_SUFFIXES
  ) {

    throw new Error(
      `${itemName} cannot have more than ${MAX_SUFFIXES} suffixes.`
    );

  }


  const allModifiers = [

    ...item.prefixes,

    ...item.suffixes

  ];


  const ids = new Set();


  for (
    const rawModifier of
    allModifiers
  ) {

    const modifier =
      normalizeModifier(
        rawModifier
      );


    if (
      !modifier ||
      !modifier.id
    ) {

      throw new Error(
        `${itemName} contains an invalid modifier.`
      );

    }


    if (
      ids.has(
        modifier.id
      )
    ) {

      throw new Error(
        `${itemName} contains duplicate modifier "${modifier.id}".`
      );

    }


    ids.add(
      modifier.id
    );

  }

}


/*
 * ---------------------------------------------------------
 * RECOMBINATION
 * ---------------------------------------------------------
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
  } = validateInputItems(
    itemA,
    itemB,
    database
  );


  /*
   * -------------------------------------------------------
   * BASE
   * -------------------------------------------------------
   *
   * Choose one of the two bases with equal probability.
   */
  const outputBase =
    random() < 0.5
      ? baseA
      : baseB;


  /*
   * -------------------------------------------------------
   * MODIFIERS
   * -------------------------------------------------------
   *
   * The recombinated item can have at most:
   *
   *   3 prefixes
   *   3 suffixes
   *
   * Combine the modifiers from both input items, then
   * randomly select up to the allowed maximum.
   */


  const allPrefixes = [
    ...itemA.prefixes,
    ...itemB.prefixes
  ];

  const allSuffixes = [
    ...itemA.suffixes,
    ...itemB.suffixes
  ];


  /*
   * Calculate the number of prefixes and suffixes that will
   * be present on the recombinated item. Odds taken from
   * poewiki.net/wiki/Recombinator
   */
  function determineModCount(array) {
    const roll = random();

    switch (array.length) {
        case 1:
            return roll < 0.41 ? 0 : 1;

        case 2:
            return roll < 0.667 ? 1 : 2;

        case 3:
            if (roll < 0.40) return 1;
            if (roll < 0.90) return 2;
            return 3;

        case 4:
            if (roll < 0.10) return 1;
            if (roll < 0.70) return 2;
            return 3;

        case 5:
            return roll < 0.43 ? 2 : 3;

        case 6:
            return roll < 0.30 ? 2 : 3;

        default:
            return 0;
    }
  }


  /*
   * Randomly shuffle an array using the supplied RNG.
   *
   * Using the injected `random` function means simulations
   * remain deterministic when a seeded RNG is supplied.
   */
  function shuffle(array) {

    const result = [
      ...array
    ];

    for (
      let i = result.length - 1;
      i > 0;
      i--
    ) {

      const j =
        Math.floor(
          random() * (i + 1)
        );

      [
        result[i],
        result[j]
      ] = [
        result[j],
        result[i]
      ];
    }

    return result;
  }


  /*
   * Slice the prefix array to ensure the resulting item has
   * the correct number of prefixes.
   */
  const prefixes =
    shuffle(
      allPrefixes
    ).slice(
      0,
      determineModCount(allPrefixes)
    );


  /*
   * Slice the suffix array to ensure the resulting item has
   * the correct number of suffixes.
   */
  const suffixes =
    shuffle(
      allSuffixes
    ).slice(
      0,
      determineModCount(allSuffixes)
    );


  /*
   * -------------------------------------------------------
   * OUTPUT
   * -------------------------------------------------------
   */

  return {

    baseType:
      outputBase.baseType,

    baseId:
      outputBase.id,

    base:
      outputBase.name,

    /*
     * Recombinated item level is derived from the two input
	 * item levels. Equation taken from 
	 * poewiki.net/wiki/Recombinator.
     */
    itemLevel:
	  Math.min(
	    Math.floor(((itemA.itemLevel + itemB.itemLevel)/2)+2),
		Math.max(
		  itemA.itemLevel,
		  itemB.itemLevel
		)
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
 * ---------------------------------------------------------
 * SIMULATION
 * ---------------------------------------------------------
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


export {
  MAX_PREFIXES,
  MAX_SUFFIXES
};
