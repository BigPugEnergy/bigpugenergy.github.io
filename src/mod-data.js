import {
  MOD_INDEX
} from "./data/generated/mod-index.js";


const loadedChunks =
  new Map();


export async function loadModsForBaseType(
  baseType
) {

  if (!baseType) {

    return {

      mods: {},

      modsByBase: {}

    };

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


  const chunk =
    MOD_INDEX[
      baseType
    ];


  if (!chunk) {

    throw new Error(
      `No modifier data exists for base type "${baseType}".`
    );

  }


  const module =
    await import(
      `./data/generated/mod-data/${baseType}.js`
    );


  const result = {

    mods:
      module.MODS ?? {},

    modsByBase:
      module.MODS_BY_BASE ?? {}

  };


  loadedChunks.set(
    baseType,
    result
  );


  return result;

}


export async function loadModsForBase(
  baseType,
  baseId
) {

  const data =
    await loadModsForBaseType(
      baseType
    );


  const modIds =
    data.modsByBase[
      baseId
    ] ?? [];


  const mods =
    {};


  for (
    const modId of
    modIds
  ) {

    if (
      data.mods[
        modId
      ]
    ) {

      mods[
        modId
      ] =
        data.mods[
          modId
        ];

    }

  }


  return mods;

}


export function clearLoadedModData() {

  loadedChunks.clear();

}
