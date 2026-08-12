import fs from "node:fs/promises";
import path from "node:path";

const RAW =
  path.resolve("raw-data/repoe");

const OUTPUT =
  path.resolve("src/data/generated");

async function readJson(file) {
  const contents =
    await fs.readFile(
      path.join(RAW, file),
      "utf8"
    );

  return JSON.parse(contents);
}

const [
  rawBases,
  rawMods,
  rawModsByBase,
  rawItemClasses,
  rawTags,
  rawTranslations
] = await Promise.all([
  readJson("base_items.json"),
  readJson("mods.json"),
  readJson("mods_by_base.json"),
  readJson("item_classes.json"),
  readJson("tags.json"),
  readJson("stat_translations.json")
]);

await fs.mkdir(
  OUTPUT,
  { recursive: true }
);

/*
 * ---------------------------------------------------------
 * Base types
 * ---------------------------------------------------------
 *
 * These are the actual PoE item classes that we want
 * exposed to the user.
 */

const EXCLUDED_CLASSES = new Set([
  "Currency",
  "DivinationCard",
  "QuestItem",
  "Microtransaction",
  "HiddenItem",
  "Active Skill Gem",
  "Support Skill Gem",
  "Map",
  "MapFragment",
  "AtlasUpgradeItem",
  "Incubator",
  "StackableCurrency",
  "UniqueFragment",
  "UniqueShard",
  "UniqueShardBase",
  "LabyrinthItem",
  "LabyrinthMapItem",
  "MemoryLine",
  "MetamorphosisDNA",
  "SentinelDrone",
  "PantheonSoul",
  "ArchnemesisMod",
  "FishingRod",
  "Trinket",
  "HeistBlueprint",
  "HeistContract",
  "HeistEquipmentReward",
  "HeistEquipmentTool",
  "HeistEquipmentUtility",
  "HeistEquipmentWeapon",
  "HeistObjective"
]);

const BASE_TYPE_ORDER = [
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
];

/*
 * Convert a human-facing class into a stable ID.
 */
function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/*
 * Extract an item's class from the various possible
 * RePoE representations.
 *
 * The source format can change, so keep this isolated.
 */
function getItemClass(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const candidates = [
    raw.item_class,
    raw.itemClass,
    raw.class,
    raw.type,
    raw.category
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string") {
      return candidate;
    }
  }

  return null;
}

/*
 * Extract a display name.
 */
function getBaseName(raw, fallback) {
  return (
    raw.name ??
    raw.base_name ??
    raw.baseName ??
    fallback
  );
}

/*
 * Extract tags.
 */
function getTags(raw) {
  if (Array.isArray(raw.tags)) {
    return raw.tags;
  }

  if (
    raw.tags &&
    typeof raw.tags === "object"
  ) {
    return Object.keys(raw.tags);
  }

  return [];
}


/*
 * ---------------------------------------------------------
 * BASE DATABASE
 * ---------------------------------------------------------
 */

const bases = {};
const basesByType = {};

for (const [id, raw] of Object.entries(rawBases)) {
  const itemClass =
    getItemClass(raw);

  if (!itemClass) {
    continue;
  }

  if (
    EXCLUDED_CLASSES.has(itemClass)
  ) {
    continue;
  }

  /*
   * Only expose classes that make sense for
   * rare-item recombination.
   */
  if (
    !BASE_TYPE_ORDER.includes(
      itemClass
    )
  ) {
    continue;
  }

  const baseType =
    slugify(itemClass);

  const base = {
    id,

    name:
      getBaseName(raw, id),

    baseType,

    itemClass,

    tags:
      getTags(raw),

    requirements:
      raw.requirements ??
      raw.requirements_data ??
      {},

    properties:
      raw.properties ??
      {},

    raw
  };

  bases[id] = base;

  if (!basesByType[baseType]) {
    basesByType[baseType] = [];
  }

  basesByType[baseType].push(id);
}


/*
 * Sort bases alphabetically.
 */
for (const ids of Object.values(
  basesByType
)) {
  ids.sort((a, b) =>
    bases[a].name.localeCompare(
      bases[b].name
    )
  );
}


/*
 * ---------------------------------------------------------
 * BASE TYPE DATABASE
 * ---------------------------------------------------------
 */

const baseTypes = BASE_TYPE_ORDER
  .map(itemClass => {

    const id =
      slugify(itemClass);

    return {
      id,
      name:
        rawItemClasses[itemClass]?.name ??
        itemClass,

      itemClass,

      baseCount:
        basesByType[id]?.length ?? 0
    };
  })
  .filter(type =>
    type.baseCount > 0
  );


/*
 * ---------------------------------------------------------
 * MOD DATABASE
 * ---------------------------------------------------------
 *
 * For now preserve the complete source record.
 *
 * This is intentional. We'll normalize the exact mod
 * mechanics further once the simulator's recombination
 * rules are implemented.
 */

const mods = {};

for (const [id, raw] of Object.entries(rawMods)) {

  mods[id] = {
    id,

    name:
      raw.name ??
      raw.display_name ??
      id,

    generationType:
      raw.generation_type ??
      raw.generationType ??
      null,

    group:
      raw.group ??
      null,

    domain:
      raw.domain ??
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
      null,

    raw
  };
}


/*
 * ---------------------------------------------------------
 * MODS BY BASE
 * ---------------------------------------------------------
 *
 * RePoE already exports this relationship.
 * Preserve it rather than rebuilding it heuristically.
 */

const modsByBase =
  rawModsByBase;


/*
 * ---------------------------------------------------------
 * OUTPUT
 * ---------------------------------------------------------
 */

const database = {
  version:
    "0.1.0",

  source: {
    name: "RePoE",
    url:
      "https://repoe-fork.github.io/",
    generatedAt:
      new Date().toISOString()
  },

  baseTypes,
  bases,
  basesByType,

  mods,
  modsByBase,

  tags:
    rawTags,

  statTranslations:
    rawTranslations
};


/*
 * Write one combined database.
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
 * Also expose separate files.
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

await fs.writeFile(
  path.join(
    OUTPUT,
    "mods.js"
  ),

  `// GENERATED FILE - DO NOT EDIT

export const MODS = ${JSON.stringify(
    mods,
    null,
    2
  )};

export const MODS_BY_BASE = ${JSON.stringify(
    modsByBase,
    null,
    2
  )};
`
);

console.log(
  `Generated ${Object.keys(bases).length} bases.`
);

console.log(
  `Generated ${baseTypes.length} base types.`
);

console.log(
  `Generated ${Object.keys(mods).length} mods.`
);
