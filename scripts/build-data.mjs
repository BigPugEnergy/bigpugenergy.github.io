import fs from "node:fs/promises";
import path from "node:path";

const RAW =
  path.resolve("raw-data/repoe");

const OUTPUT =
  path.resolve("src/data/generated");

const MOD_OUTPUT =
  path.join(
    OUTPUT,
    "mod-data"
  );

const CRAFTED_OUTPUT =
  path.join(
    OUTPUT,
    "crafted-mods.js"
  );


async function readJson(file) {

  const contents =
    await fs.readFile(
      path.join(RAW, file),
      "utf8"
    );

  return JSON.parse(contents);
}


const rawBases =
  await readJson("base_items.json");

const rawMods =
  await readJson("mods.json");

const rawModsByBase =
  await readJson("mods_by_base.json");

const rawItemClasses =
  await readJson("item_classes.json");

const rawStatTranslations =
  await readJson("stat_translations.json");


await fs.mkdir(
  OUTPUT,
  { recursive: true }
);

await fs.rm(
  MOD_OUTPUT,
  {
    recursive: true,
    force: true
  }
);

await fs.mkdir(
  MOD_OUTPUT,
  { recursive: true }
);


/*
 * ---------------------------------------------------------
 * HELPERS
 * ---------------------------------------------------------
 */

function slugify(value) {

  return String(value)
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      "_"
    )
    .replace(
      /^_+|_+$/g,
      "");
}


function getItemClass(raw) {

  if (
    !raw ||
    typeof raw !== "object"
  ) {
    return null;
  }


  const candidates = [

    raw.item_class,

    raw.itemClass,

    raw.class,

    raw.item_class_id,

    raw.itemClassId

  ];


  for (
    const candidate of
    candidates
  ) {

    if (
      typeof candidate ===
      "string"
    ) {

      return candidate;

    }

  }


  return null;
}


function getBaseName(
  raw,
  fallback
) {

  return (

    raw.name ??

    raw.base_name ??

    raw.baseName ??

    fallback

  );
}


function getTags(raw) {

  if (
    Array.isArray(
      raw.tags
    )
  ) {

    return raw.tags;

  }


  if (
    raw.tags &&
    typeof raw.tags ===
      "object"
  ) {

    return Object.keys(
      raw.tags
    );

  }


  return [];

}


/*
 * ---------------------------------------------------------
 * VALID RARE ITEM CLASSES
 * ---------------------------------------------------------
 */

const ALLOWED_CLASSES =
  new Set([

    "Helmet",

    "Body Armour",

    "Gloves",

    "Boots",

    "Shield",

    "Quiver",

    "Ring",

    "Amulet",

    "Belt",

    "Bow",

    "Claw",

    "Dagger",

    "Rune Dagger",

    "One Hand Axe",

    "Two Hand Axe",

    "One Hand Mace",

    "Two Hand Mace",

    "One Hand Sword",

    "Two Hand Sword",

    "Thrusting One Hand Sword",

    "Sceptre",

    "Staff",

    "Warstaff",

    "Wand"

  ]);


/*
 * ---------------------------------------------------------
 * BASES
 * ---------------------------------------------------------
 */

const bases = {};

const basesByType = {};


for (
  const [
    id,
    raw
  ] of Object.entries(
    rawBases
  )
) {

  const itemClass =
    getItemClass(raw);


  if (
    !itemClass ||
    !ALLOWED_CLASSES.has(
      itemClass
    )
  ) {

    continue;

  }


  const baseType =
    slugify(
      itemClass
    );


  const base = {

    id,

    name:
      getBaseName(
        raw,
        id
      ),

    baseType,

    itemClass,

    tags:
      getTags(raw),

    requirements:
      raw.requirements ??
      {},

    properties:
      raw.properties ??
      {}

  };


  bases[id] =
    base;


  if (
    !basesByType[
      baseType
    ]
  ) {

    basesByType[
      baseType
    ] = [];

  }


  basesByType[
    baseType
  ].push(id);

}


/*
 * ---------------------------------------------------------
 * SORT BASES
 * ---------------------------------------------------------
 */

for (
  const ids of
  Object.values(
    basesByType
  )
) {

  ids.sort(
    (a, b) =>
      bases[a].name.localeCompare(
        bases[b].name
      )
  );

}


/*
 * ---------------------------------------------------------
 * BASE TYPES
 * ---------------------------------------------------------
 */

const baseTypes = [];


for (
  const [
    id,
    baseIds
  ] of Object.entries(
    basesByType
  )
) {

  const firstBase =
    bases[
      baseIds[0]
    ];


  const itemClass =
    firstBase?.itemClass ??
    id;


  const classInfo =
    rawItemClasses[
      itemClass
    ];


  baseTypes.push({

    id,

    name:
      classInfo?.name ??
      itemClass,

    itemClass,

    baseCount:
      baseIds.length

  });

}


const preferredOrder = [

  "helmet",

  "body_armour",

  "gloves",

  "boots",

  "shield",

  "quiver",

  "ring",

  "amulet",

  "belt",

  "bow",

  "claw",

  "dagger",

  "rune_dagger",

  "one_hand_axe",

  "two_hand_axe",

  "one_hand_mace",

  "two_hand_mace",

  "one_hand_sword",

  "two_hand_sword",

  "thrusting_one_hand_sword",

  "sceptre",

  "staff",

  "warstaff",

  "wand"

];


baseTypes.sort(
  (a, b) => {

    const ai =
      preferredOrder.indexOf(
        a.id
      );

    const bi =
      preferredOrder.indexOf(
        b.id
      );


    if (
      ai !== -1 &&
      bi !== -1
    ) {

      return ai - bi;

    }


    if (ai !== -1) {
      return -1;
    }


    if (bi !== -1) {
      return 1;
    }


    return a.name.localeCompare(
      b.name
    );

  }
);


/*
 * ---------------------------------------------------------
 * NORMALIZE MOD
 * ---------------------------------------------------------
 *
 * Keep only the fields the simulator actually needs.
 *
 * The original RePoE mod object is intentionally NOT
 * embedded here.
 */

function normalizeMod(
  id,
  raw
) {

  return {

    id,

    name:
      raw.name ??
      raw.display_name ??
      id,

    generationType:
      raw.generation_type ??
      raw.generationType ??
      null,

    domain:
      raw.domain ??
      null,

    group:
      Array.isArray(raw.groups)
        ? raw.groups[0] ?? null
        : raw.group ?? null,

    type:
      raw.type ??
      null,

    tags:
      raw.tags ??
      [],

    stats:
      raw.stats ??
      [],

    levels:
      raw.levels ??
      [],

    weights:
      raw.weights ??
      [],

    spawnWeights:
      raw.spawn_weights ??
      raw.spawnWeights ??
      null,

    requiredLevel:
      raw.required_level ??
      raw.requiredLevel ??
      null

  };

}


/*
 * ---------------------------------------------------------
 * MOD ID EXTRACTION
 * ---------------------------------------------------------
 *
 * RePoE's mods_by_base structure can vary between
 * exports. This function accepts the common forms:
 *
 *   ["ModA", "ModB"]
 *
 * or:
 *
 *   { "ModA": {...}, "ModB": {...} }
 *
 * or nested objects where the mod ID is the key.
 */

function extractModIds(
  value
) {

  if (
    Array.isArray(value)
  ) {

    return value
      .filter(
        id =>
          typeof id ===
          "string"
      );

  }


  if (
    value &&
    typeof value ===
      "object"
  ) {

    return Object.keys(
      value
    );

  }


  return [];

}


/*
 * ---------------------------------------------------------
 * BUILD MOD INDEX
 * ---------------------------------------------------------
 *
 * The index tells us which equipment category has which
 * modifier IDs.
 *
 * Example:
 *
 * {
 *   body_armour: [
 *     "LocalIncreasedEnergyShield",
 *     ...
 *   ]
 * }
 */

/*
 * ---------------------------------------------------------
 * MOD APPLICABILITY INDEX
 * ---------------------------------------------------------
 *
 * RePoE mods_by_base.json has this structure:
 *
 *   item class
 *     -> mod group
 *       -> bases[]
 *       -> mods
 *           -> prefix
 *               -> mod group
 *                   -> tier/mod id -> weight
 *           -> suffix
 *               -> mod group
 *                   -> tier/mod id -> weight
 *
 * Our generated database preserves that information in a
 * form that is cheap for the simulator to consume.
 */

const modIdsByBaseId = {};


/*
 * Every generated base gets its own modifier collection.
 */

for (
  const baseId of
  Object.keys(bases)
) {

  modIdsByBaseId[
    baseId
  ] = new Map();

}


/*
 * Walk every RePoE item class.
 */

for (
  const [
    itemClass,
    classEntries
  ] of Object.entries(
    rawModsByBase
  )
) {

  if (
    !classEntries ||
    typeof classEntries !== "object"
  ) {

    continue;

  }


  /*
   * Each entry represents a collection of modifiers
   * that applies to one or more bases.
   */

  for (
    const [
      entryName,
      entry
    ] of Object.entries(
      classEntries
    )
  ) {

    if (
      !entry ||
      typeof entry !== "object"
    ) {

      continue;

    }


    const entryBases =
      Array.isArray(
        entry.bases
      )
        ? entry.bases
        : [];


    if (
      entryBases.length === 0
    ) {

      continue;

    }


    const entryMods =
      entry.mods &&
      typeof entry.mods === "object"
        ? entry.mods
        : {};


    /*
     * Process prefix, suffix, and any other generation
     * types present in RePoE.
     */

    for (
      const [
        generationType,
        generationGroups
      ] of Object.entries(
        entryMods
      )
    ) {

      if (
        !generationGroups ||
        typeof generationGroups !== "object"
      ) {

        continue;

      }


      /*
       * generationGroups looks like:
       *
       * {
       *   IncreasedLife: {
       *     IncreasedLife0: 1000,
       *     IncreasedLife1: 1000
       *   }
       * }
       */

      for (
        const [
          modGroup,
          tiers
        ] of Object.entries(
          generationGroups
        )
      ) {

        if (
          !tiers ||
          typeof tiers !== "object"
        ) {

          continue;

        }


        for (
          const [
            modId,
            weight
          ] of Object.entries(
            tiers
          )
        ) {

          /*
           * Only keep modifiers that actually exist in
           * the main RePoE modifier database.
           */

          if (
            !rawMods[
              modId
            ]
          ) {

            continue;

          }


          /*
           * Associate this modifier with every base
           * listed by this RePoE entry.
           */

          for (
            const baseId of
            entryBases
          ) {

            const base =
              bases[
                baseId
              ];


            /*
             * Ignore RePoE bases that aren't represented
             * in our generated base database.
             */

            if (!base) {
              continue;
            }


            const baseMods =
              modIdsByBaseId[
                baseId
              ];


            if (!baseMods) {
              continue;
            }


            /*
             * A modifier ID should only have one definition
             * for a given base, but use Map so duplicate
             * RePoE entries don't create duplicate modifiers.
             */

            if (
              !baseMods.has(
                modId
              )
            ) {

              baseMods.set(
                modId,
                {
                  id:
                    modId,

                  generationType:
                    generationType,

                  group:
                    modGroup,

                  weight:
                    Number(weight),

                  source:
                    entryName,

                  itemClass:
                    itemClass
                }
              );

            }

          }

        }

      }

    }

  }

}


/*
 * ---------------------------------------------------------
 * GENERATE CRAFTED MODIFIER INDEX
 * ---------------------------------------------------------
 *
 * Crafted modifiers are kept in a separate generated file. They are not
 * included in the normal modifier selector data because their RePoE
 * spawn weights are zero by design, but the item importer still needs
 * their definitions to recognize Master Crafted modifiers in copied item
 * text.
 */

const craftedMods = [];

for (const [modId, raw] of Object.entries(rawMods)) {
  if (raw?.domain !== "crafted") continue;

  const generationType = raw?.generation_type;
  if (generationType !== "prefix" && generationType !== "suffix") continue;

  const spawnWeights = Array.isArray(raw.spawn_weights)
    ? raw.spawn_weights
    : [];

  if (!spawnWeights.some(entry => String(entry?.tag ?? ""))) continue;

  const normalized = normalizeMod(modId, raw);

  craftedMods.push({
    ...normalized,
    generationType,
    group: Array.isArray(raw.groups)
      ? raw.groups[0] ?? null
      : raw.group ?? null
  });
}

craftedMods.sort((a, b) => String(a.id).localeCompare(String(b.id)));

await fs.writeFile(
  CRAFTED_OUTPUT,
  `// GENERATED FILE - DO NOT EDIT\n\nexport const CRAFTED_MODS = ${JSON.stringify(
    craftedMods
  )};\n`
);


/*
 * ---------------------------------------------------------
 * GENERATE MODIFIER CHUNKS
 * ---------------------------------------------------------
 */

const modIndex = {};


for (
  const baseType of
  baseTypes
) {

  const typeBaseIds =
    basesByType[
      baseType.id
    ] ?? [];


  /*
   * All modifiers applicable to any base of this type.
   */

  const typeMods =
    new Map();


  /*
   * Exact base -> applicable modifier records.
   */

  const modsByBase = {};


  for (
    const baseId of
    typeBaseIds
  ) {

    const baseMods =
      modIdsByBaseId[
        baseId
      ];


    if (!baseMods) {

      modsByBase[
        baseId
      ] = [];

      continue;

    }


    const records =
      Array.from(
        baseMods.values()
      ).sort(
        (
          a,
          b
        ) =>
          a.id.localeCompare(
            b.id
          )
      );


    modsByBase[
      baseId
    ] =
      records;


    /*
     * Add every modifier to the type-level collection.
     */

    for (
      const record of
      records
    ) {

      if (
        !typeMods.has(
          record.id
        )
      ) {

        typeMods.set(
          record.id,
          record
        );

      }

    }

  }


  /*
   * Build the actual modifier definitions.
   *
   * We keep the complete RePoE modifier record alongside
   * the applicability information.
   */

  const modData = {};


  for (
    const [
      modId,
      applicability
    ] of typeMods
  ) {

    const raw =
      rawMods[
        modId
      ];


    if (!raw) {
      continue;
    }


    /*
     * normalizeMod() should already exist in your
     * build-data.mjs. It converts the raw RePoE modifier
     * into the format used by the simulator.
     */

    const normalized =
      normalizeMod(
        modId,
        raw
      );


    modData[
      modId
    ] = {

      ...normalized,

      id:
        modId,

      generationType:
        applicability.generationType,

      group:
        applicability.group

    };

  }


  /*
   * Generate the chunk.
   */

  const fileName =
    `${baseType.id}.js`;


  const outputFile =
    path.join(
      MOD_OUTPUT,
      fileName
    );


  const source = `// GENERATED FILE - DO NOT EDIT

export const MODS = ${JSON.stringify(
    modData,
    null,
    2
  )};

export const MODS_BY_BASE = ${JSON.stringify(
    modsByBase,
    null,
    2
  )};
`;


  await fs.writeFile(
    outputFile,
    source,
    "utf8"
  );


  modIndex[
    baseType.id
  ] = {

    file:
      `./mod-data/${fileName}`,

    count:
      Object.keys(
        modData
      ).length,

    baseCount:
      Object.keys(
        modsByBase
      ).length

  };

}



/*
 * ---------------------------------------------------------
 * STAT TRANSLATIONS
 * ---------------------------------------------------------
 */

const statTranslations = {};

for (const entry of rawStatTranslations) {
  const strings = Array.isArray(entry?.English)
    ? entry.English
        .filter(value => value?.string)
        .map(value => ({
          string: value.string,
          index_handlers: value.index_handlers ?? []
        }))
    : [];

  if (!strings.length || !Array.isArray(entry?.ids)) continue;

  for (const id of entry.ids) {
    statTranslations[id] = strings;
  }
}

await fs.writeFile(
  path.join(OUTPUT, "stat-translations.js"),
  `// GENERATED FILE - DO NOT EDIT

export const STAT_TRANSLATIONS = ${JSON.stringify(
    statTranslations
  )};
`
);


/*
 * ---------------------------------------------------------
 * DATABASE
 * ---------------------------------------------------------
 *
 * IMPORTANT:
 *
 * database.js contains NO modifier data.
 */

const database = {

  version:
    "0.2.0",

  source: {

    name:
      "RePoE",

    url:
      "https://repoe-fork.github.io/",

    generatedAt:
      new Date().toISOString()

  },

  baseTypes,

  bases,

  basesByType,

  modIndex

};


/*
 * ---------------------------------------------------------
 * WRITE DATABASE
 * ---------------------------------------------------------
 */

await fs.writeFile(

  path.join(
    OUTPUT,
    "database.js"
  ),

  `// GENERATED FILE - DO NOT EDIT

export const DATABASE = ${JSON.stringify(
    database,
    null,
    2
  )};
`

);


/*
 * ---------------------------------------------------------
 * WRITE BASES
 * ---------------------------------------------------------
 */

await fs.writeFile(

  path.join(
    OUTPUT,
    "bases.js"
  ),

  `// GENERATED FILE - DO NOT EDIT

export const BASE_TYPES = ${JSON.stringify(
    baseTypes,
    null,
    2
  )};

export const BASES = ${JSON.stringify(
    bases,
    null,
    2
  )};

export const BASES_BY_TYPE = ${JSON.stringify(
    basesByType,
    null,
    2
  )};
`

);


/*
 * ---------------------------------------------------------
 * WRITE MOD INDEX
 * ---------------------------------------------------------
 */

await fs.writeFile(

  path.join(
    OUTPUT,
    "mod-index.js"
  ),

  `// GENERATED FILE - DO NOT EDIT

export const MOD_INDEX = ${JSON.stringify(
    modIndex,
    null,
    2
  )};
`

);


/*
 * ---------------------------------------------------------
 * REPORT
 * ---------------------------------------------------------
 */

console.log("");

console.log(
  "Generated RePoE data."
);

console.log("");

console.log(
  `Base types: ${baseTypes.length}`
);

console.log(
  `Bases:      ${Object.keys(bases).length}`
);

console.log(
  `Mod chunks: ${Object.keys(modIndex).length}`
);

console.log("");

for (
  const baseType of
  baseTypes
) {

  console.log(

    `  ${baseType.name}: ` +
    `${modIndex[baseType.id]?.count ?? 0} mods`

  );

}

console.log("");
