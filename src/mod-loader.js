/*
 * Lazy loader for the generated RePoE modifier chunks.
 *
 * Vite can statically analyze import.meta.glob(), so this avoids
 * the unsupported pattern:
 *
 *   import(`./data/generated/${file}`)
 *
 * Only the modifier chunk for the selected base type is loaded.
 */

import {
  DATABASE
} from "./data/generated/database.js";


const MOD_CHUNKS =
  import.meta.glob(
    "./data/generated/mod-data/*.js"
  );


const loadedChunks =
  new Map();


export async function loadModChunk(
  baseType
) {

  if (!baseType) {
    throw new Error(
      "Cannot load modifiers without a base type."
    );
  }


  if (
    loadedChunks.has(
      baseType
    )
  ) {

    return loadedChunks.get(
      baseType
    );

  }


  const manifest =
    DATABASE.modIndex?.[
      baseType
    ];


  if (!manifest) {
    throw new Error(
      `No modifier database entry exists for base type "${baseType}".`
    );
  }


  /*
   * database.modIndex contains paths such as:
   *
   * ./mod-data/helmet.js
   *
   * import.meta.glob() produces keys such as:
   *
   * ./data/generated/mod-data/helmet.js
   */
  const relativePath =
    String(
      manifest.file
    ).replace(
      /^\.\/?/,
      ""
    );


  const modulePath =
    `./data/generated/${relativePath}`;


  const loader =
    MOD_CHUNKS[
      modulePath
    ];


  if (!loader) {
    throw new Error(
      `Modifier chunk "${modulePath}" was not generated.`
    );
  }


  const module =
    await loader();


  if (
    !module.MODS ||
    !module.MODS_BY_BASE
  ) {

    throw new Error(
      `Modifier chunk for "${baseType}" is missing MODS or MODS_BY_BASE.`
    );
  }


  const chunk = {
    MODS:
      module.MODS,

    MODS_BY_BASE:
      module.MODS_BY_BASE
  };


  loadedChunks.set(
    baseType,
    chunk
  );


  return chunk;
}


export function getBaseModifierRefs({
  chunk,
  baseId
}) {

  return (
    chunk?.MODS_BY_BASE?.[
      baseId
    ] ??
    []
  );
}


export function getModifier({
  chunk,
  id
}) {

  return (
    chunk?.MODS?.[
      id
    ] ??
    null
  );
}
