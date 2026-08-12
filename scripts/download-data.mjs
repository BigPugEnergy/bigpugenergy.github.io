import fs from "node:fs/promises";
import path from "node:path";

const DATA_URL =
  "https://repoe-fork.github.io/";

const FILES = [
  "base_items.json",
  "mods.json",
  "mods_by_base.json",
  "item_classes.json",
  "tags.json",
  "stat_translations.json"
];

const outputDir =
  path.resolve("raw-data/repoe");

await fs.mkdir(outputDir, {
  recursive: true
});

console.log("Downloading RePoE data...\n");

for (const file of FILES) {
  const url =
    `${DATA_URL}${file}`;

  console.log(`  ${file}`);

  const response =
    await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Failed to download ${url}: ` +
      `${response.status} ${response.statusText}`
    );
  }

  const text =
    await response.text();

  await fs.writeFile(
    path.join(outputDir, file),
    text
  );
}

console.log("\nDownload complete.");
