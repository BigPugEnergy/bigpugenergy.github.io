import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const GENERATED =
  path.resolve("src/data/generated");


/*
 * ---------------------------------------------------------
 * LOAD GENERATED ES MODULE
 * ---------------------------------------------------------
 */

async function loadGenerated(
  file
) {

  const absolutePath =
    path.resolve(file);

  try {

    return await import(
      pathToFileURL(
        absolutePath
      ).href
    );

  } catch (error) {

    throw new Error(
      `Could not load generated file ` +
      `${absolutePath}\n` +
      `${error.message}`
    );

  }

}


/*
 * ---------------------------------------------------------
 * LOAD GENERATED DATA
 * ---------------------------------------------------------
 */

const databaseModule =
  await loadGenerated(
    path.join(
      GENERATED,
      "database.js"
    )
  );


const basesModule =
  await loadGenerated(
    path.join(
      GENERATED,
      "bases.js"
    )
  );


const modIndexModule =
  await loadGenerated(
    path.join(
      GENERATED,
      "mod-index.js"
    )
  );


const database =
  databaseModule.DATABASE;


const baseTypes =
  basesModule.BASE_TYPES;


const bases =
  basesModule.BASES;


const basesByType =
  basesModule.BASES_BY_TYPE;


const modIndex =
  modIndexModule.MOD_INDEX;


/*
 * ---------------------------------------------------------
 * BASIC STRUCTURE
 * ---------------------------------------------------------
 */

if (
  !database ||
  typeof database !== "object"
) {

  throw new Error(
    "DATABASE is not an object."
  );

}


if (
  !Array.isArray(baseTypes)
) {

  throw new Error(
    "BASE_TYPES is not an array."
  );

}


if (
  !bases ||
  typeof bases !== "object" ||
  Array.isArray(bases)
) {

  throw new Error(
    "BASES is not an object."
  );

}


if (
  !basesByType ||
  typeof basesByType !== "object" ||
  Array.isArray(basesByType)
) {

  throw new Error(
    "BASES_BY_TYPE is not an object."
  );

}


if (
  !modIndex ||
  typeof modIndex !== "object" ||
  Array.isArray(modIndex)
) {

  throw new Error(
    "MOD_INDEX is not an object."
  );

}


/*
 * ---------------------------------------------------------
 * DATABASE STRUCTURE
 * ---------------------------------------------------------
 */

if (
  !Array.isArray(
    database.baseTypes
  )
) {

  throw new Error(
    "DATABASE.baseTypes is not an array."
  );

}


if (
  !database.bases ||
  typeof database.bases !== "object"
) {

  throw new Error(
    "DATABASE.bases is not an object."
  );

}


if (
  !database.basesByType ||
  typeof database.basesByType !== "object"
) {

  throw new Error(
    "DATABASE.basesByType is not an object."
  );

}


if (
  !database.modIndex ||
  typeof database.modIndex !== "object"
) {

  throw new Error(
    "DATABASE.modIndex is not an object."
  );

}


/*
 * `mods` should NOT exist anymore.
 *
 * Modifier data is now lazy-loaded through modIndex.
 */

if (
  database.mods !== undefined
) {

  throw new Error(
    "DATABASE.mods still exists. " +
    "The generated database should use modIndex instead."
  );

}


/*
 * ---------------------------------------------------------
 * BASE TYPE VALIDATION
 * ---------------------------------------------------------
 */

const baseTypeIds =
  new Set(
    baseTypes.map(
      type => type.id
    )
  );


if (
  baseTypeIds.size !==
  baseTypes.length
) {

  throw new Error(
    "Duplicate base type IDs detected."
  );

}


for (
  const baseType of
  baseTypes
) {

  if (
    !baseType ||
    typeof baseType !== "object"
  ) {

    throw new Error(
      "Invalid base type entry."
    );

  }


  if (
    !baseType.id
  ) {

    throw new Error(
      "Base type is missing an ID."
    );

  }


  if (
    !baseType.name
  ) {

    throw new Error(
      `Base type "${baseType.id}" ` +
      "is missing a name."
    );

  }


  if (
    typeof baseType.baseCount !==
    "number"
  ) {

    throw new Error(
      `Base type "${baseType.id}" ` +
      "has no numeric baseCount."
    );

  }

}


/*
 * ---------------------------------------------------------
 * BASE VALIDATION
 * ---------------------------------------------------------
 */

for (
  const [
    id,
    base
  ] of Object.entries(
    bases
  )
) {

  if (
    !base ||
    typeof base !== "object"
  ) {

    throw new Error(
      `Base "${id}" is not an object.`
    );

  }


  if (
    base.id !== id
  ) {

    throw new Error(
      `Base key "${id}" does not ` +
      `match base.id "${base.id}".`
    );

  }


  if (
    !base.name
  ) {

    throw new Error(
      `Base "${id}" has no name.`
    );

  }


  if (
    !base.baseType
  ) {

    throw new Error(
      `Base "${id}" has no baseType.`
    );

  }


  if (
    !baseTypeIds.has(
      base.baseType
    )
  ) {

    throw new Error(
      `Base "${id}" references ` +
      `unknown base type "${base.baseType}".`
    );

  }

}


/*
 * ---------------------------------------------------------
 * BASE INDEX VALIDATION
 * ---------------------------------------------------------
 */

for (
  const [
    type,
    ids
  ] of Object.entries(
    basesByType
  )
) {

  if (
    !baseTypeIds.has(
      type
    )
  ) {

    throw new Error(
      `BASES_BY_TYPE contains ` +
      `unknown base type "${type}".`
    );

  }


  if (
    !Array.isArray(ids)
  ) {

    throw new Error(
      `BASES_BY_TYPE.${type} is not an array.`
    );

  }


  for (
    const id of
    ids
  ) {

    const base =
      bases[id];


    if (!base) {

      throw new Error(
        `Base index "${type}" references ` +
        `unknown base "${id}".`
      );

    }


    if (
      base.baseType !== type
    ) {

      throw new Error(
        `Base "${id}" is indexed under ` +
        `"${type}" but declares ` +
        `"${base.baseType}".`
      );

    }

  }

}


/*
 * ---------------------------------------------------------
 * BASE TYPE COUNTS
 * ---------------------------------------------------------
 */

for (
  const baseType of
  baseTypes
) {

  const ids =
    basesByType[
      baseType.id
    ] ?? [];


  if (
    ids.length !==
    baseType.baseCount
  ) {

    throw new Error(
      `Base type "${baseType.id}" says ` +
      `it has ${baseType.baseCount} bases, ` +
      `but the index contains ${ids.length}.`
    );

  }

}


/*
 * ---------------------------------------------------------
 * MOD INDEX VALIDATION
 * ---------------------------------------------------------
 */

for (
  const baseType of
  baseTypes
) {

  const entry =
    modIndex[
      baseType.id
    ];


  if (!entry) {

    throw new Error(
      `MOD_INDEX has no entry for ` +
      `base type "${baseType.id}".`
    );

  }


  if (
    typeof entry.file !==
    "string"
  ) {

    throw new Error(
      `MOD_INDEX.${baseType.id}.file ` +
      "is not a string."
    );

  }


  if (
    typeof entry.count !==
    "number"
  ) {

    throw new Error(
      `MOD_INDEX.${baseType.id}.count ` +
      "is not a number."
    );

  }


  const expectedFile =
    `./mod-data/${baseType.id}.js`;


  if (
    entry.file !==
    expectedFile
  ) {

    throw new Error(
      `MOD_INDEX.${baseType.id} points to ` +
      `"${entry.file}" instead of ` +
      `"${expectedFile}".`
    );

  }


  const chunkPath =
    path.join(
      GENERATED,
      "mod-data",
      `${baseType.id}.js`
    );


  try {

    await fs.access(
      chunkPath
    );

  } catch {

    throw new Error(
      `Modifier chunk does not exist: ` +
      `${chunkPath}`
    );

  }


  /*
   * Load the actual modifier chunk.
   */

  const modModule =
    await loadGenerated(
      chunkPath
    );


  const mods =
    modModule.MODS;

  const modsByBase =
    modModule.MODS_BY_BASE;



  if (
    !mods ||
    typeof mods !== "object" ||
    Array.isArray(mods)
  ) {

    throw new Error(
      `Modifier chunk for "${baseType.id}" ` +
      "does not export an object named MODS."
    );

  }
  
  if (
    !modsByBase ||
    typeof modsByBase !== "object" ||
    Array.isArray(modsByBase)
  ) {

    throw new Error(
      `Modifier chunk for "${baseType.id}" ` +
      "does not export an object named MODS_BY_BASE."
    );

  }


  const actualCount =
    Object.keys(
      mods
    ).length;


  if (
    actualCount !==
    entry.count
  ) {

    throw new Error(
      `Modifier count mismatch for ` +
      `"${baseType.id}": index says ` +
      `${entry.count}, chunk contains ` +
      `${actualCount}.`
    );

  }


  /*
   * Validate each modifier.
   */

  for (
    const [
      modId,
      mod
    ] of Object.entries(
      mods
    )
  ) {

    if (
      !mod ||
      typeof mod !== "object"
    ) {

      throw new Error(
        `Modifier "${modId}" in ` +
        `"${baseType.id}" is not an object.`
      );

    }


    if (
      mod.id !== modId
    ) {

      throw new Error(
        `Modifier key "${modId}" does not ` +
        `match mod.id "${mod.id}".`
      );

    }


/*
 * A modifier does not necessarily have a display name.
 *
 * RePoE contains internal/implicit modifiers such as:
 *
 *   ArcaneSurgeEffectEldritchImplicit1
 *
 * which are valid modifier records but may not expose a
 * conventional `name` property.
 *
 * The modifier ID is therefore the required identity.
 */

if (
  typeof mod.id !== "string" ||
  mod.id.length === 0
) {

  throw new Error(
    `Modifier "${modId}" has an invalid id.`
  );

}


  }
  
  /*
 * Validate base-specific modifier indexes.
 */

for (
  const [
    baseId,
    modIds
  ] of Object.entries(
    modsByBase
  )
) {

  if (
    !bases[baseId]
  ) {

    throw new Error(
      `Modifier index for "${baseType.id}" ` +
      `references unknown base "${baseId}".`
    );

  }


  if (
    bases[baseId].baseType !==
    baseType.id
  ) {

    throw new Error(
      `Base "${baseId}" appears in ` +
      `"${baseType.id}" modifier data but ` +
      `belongs to "${bases[baseId].baseType}".`
    );

  }


  if (
    !Array.isArray(
      modIds
    )
  ) {

    throw new Error(
      `MODS_BY_BASE.${baseId} is not an array.`
    );

  }


  for (
  const modRef of
  modIds
) {

  /*
   * MODS_BY_BASE now stores complete applicability
   * records rather than bare modifier IDs.
   *
   * Example:
   *
   * {
   *   id: "IncreasedLife1",
   *   generationType: "prefix",
   *   group: "IncreasedLife",
   *   weight: 1000
   * }
   */

  if (
    !modRef ||
    typeof modRef !== "object"
  ) {

    throw new Error(
      `Base "${baseId}" contains an invalid modifier reference.`
    );

  }


  const modId =
    modRef.id;


  if (
    typeof modId !== "string" ||
    modId.length === 0
  ) {

    throw new Error(
      `Base "${baseId}" contains a modifier reference with no id.`
    );

  }


  if (
    !mods[modId]
  ) {

    throw new Error(
      `Base "${baseId}" references unknown modifier "${modId}".`
    );

  }


  /*
   * Validate the applicability information as well.
   */

  if (
  typeof modRef.generationType !== "string" ||
  modRef.generationType.length === 0
) {

  throw new Error(
    `Modifier "${modId}" on base "${baseId}" ` +
    `has no generation type.`
  );

}



  if (
    typeof modRef.group !== "string" ||
    modRef.group.length === 0
  ) {

    throw new Error(
      `Modifier "${modId}" on base "${baseId}" has no group.`
    );

  }


  if (
    !Number.isFinite(
      Number(modRef.weight)
    ) ||
    Number(modRef.weight) < 0
  ) {

    throw new Error(
      `Modifier "${modId}" on base "${baseId}" has invalid weight.`
    );

  }

}


}


}


/*
 * ---------------------------------------------------------
 * GENERATED FILE CONSISTENCY
 * ---------------------------------------------------------
 */

if (
  database.baseTypes.length !==
  baseTypes.length
) {

  throw new Error(
    "DATABASE.baseTypes does not match BASE_TYPES."
  );

}


if (
  Object.keys(
    database.bases
  ).length !==
  Object.keys(
    bases
  ).length
) {

  throw new Error(
    "DATABASE.bases does not match BASES."
  );

}


if (
  Object.keys(
    database.basesByType
  ).length !==
  Object.keys(
    basesByType
  ).length
) {

  throw new Error(
    "DATABASE.basesByType does not match BASES_BY_TYPE."
  );

}


if (
  Object.keys(
    database.modIndex
  ).length !==
  Object.keys(
    modIndex
  ).length
) {

  throw new Error(
    "DATABASE.modIndex does not match MOD_INDEX."
  );

}


/*
 * ---------------------------------------------------------
 * SUCCESS
 * ---------------------------------------------------------
 */

const totalMods =
  Object.values(
    modIndex
  ).reduce(
    (
      total,
      entry
    ) =>
      total +
      entry.count,
    0
  );


console.log("");

console.log(
  "Generated data validation passed."
);

console.log("");

console.log(
  `Base types: ${baseTypes.length}`
);

console.log(
  `Bases: ${Object.keys(bases).length}`
);

console.log(
  `Mod chunks: ${Object.keys(modIndex).length}`
);

console.log(
  `Indexed mods: ${totalMods}`
);

console.log("");
