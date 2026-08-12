import fs from "node:fs/promises";

const file =
  "src/data/generated/database.js";

const source =
  await fs.readFile(
    file,
    "utf8"
  );

if (!source.includes(
  "export const DATABASE"
)) {
  throw new Error(
    "Generated database.js is invalid."
  );
}

/*
 * We can't import the generated file easily
 * without worrying about stale module caches,
 * so perform basic structural validation by
 * extracting the JSON.
 */

const json =
  source
    .replace(
      "export const DATABASE = ",
      ""
    )
    .replace(/;\s*$/, "");

const database =
  JSON.parse(json);

if (
  !Array.isArray(
    database.baseTypes
  )
) {
  throw new Error(
    "baseTypes is not an array."
  );
}

if (
  typeof database.bases !==
  "object"
) {
  throw new Error(
    "bases is not an object."
  );
}

if (
  typeof database.basesByType !==
  "object"
) {
  throw new Error(
    "basesByType is not an object."
  );
}

if (
  typeof database.mods !==
  "object"
) {
  throw new Error(
    "mods is not an object."
  );
}


/*
 * Every base must reference a valid
 * base type.
 */
for (const base of Object.values(
  database.bases
)) {
  if (
    !database.basesByType[
      base.baseType
    ]
  ) {
    throw new Error(
      `Base ${base.id} references ` +
      `unknown base type ${base.baseType}`
    );
  }
}


/*
 * Every indexed base must exist.
 */
for (
  const [type, ids] of
  Object.entries(
    database.basesByType
  )
) {

  for (const id of ids) {

    if (!database.bases[id]) {
      throw new Error(
        `Base index ${type} references ` +
        `unknown base ${id}`
      );
    }

    if (
      database.bases[id].baseType !==
      type
    ) {
      throw new Error(
        `Base ${id} is indexed under ` +
        `${type} but declares ` +
        `${database.bases[id].baseType}`
      );
    }
  }
}


console.log(
  "Generated data validation passed."
);

console.log(
  `Base types: ${database.baseTypes.length}`
);

console.log(
  `Bases: ${Object.keys(database.bases).length}`
);

console.log(
  `Mods: ${Object.keys(database.mods).length}`
);
