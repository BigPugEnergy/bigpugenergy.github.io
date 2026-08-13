import { DATABASE } from "./data/generated/database.js";
import { STAT_TRANSLATIONS } from "./data/generated/stat-translations.js";
import { CRAFTED_MODS } from "./data/generated/crafted-mods.js";
import { loadModChunk } from "./mod-loader.js";

let currentImportTarget = null;
let importHandler = null;

const INFLUENCE_ALIASES = {
  shaper: "shaper",
  elder: "elder",
  crusader: "crusader",
  adjudicator: "crusader",
  redeemer: "redeemer",
  eyrie: "redeemer",
  hunter: "hunter",
  basilisk: "hunter",
  warlord: "warlord",
};

export function setImportHandler(handler) {
  importHandler = typeof handler === "function" ? handler : null;
}

function getModalElements() {
  return {
    modal: document.getElementById("import-modal"),
    title: document.getElementById("import-modal-title"),
    text: document.getElementById("import-modal-text"),
    cancel: document.getElementById("import-modal-cancel"),
    confirm: document.getElementById("import-modal-confirm")
  };
}

function norm(str) {
  return String(str ?? "")
    .normalize("NFKC")
    .replace(/<[^>]*>/g, "")
    .replace(/[•·]/g, " ")
    .replace(/[^\p{L}\p{N}%+\-\s.]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeForMatch(str) {
  return String(str ?? "")
    // PoE copy text appends the tier range to rolled values, e.g.
    // "+94(85-99) to maximum Life". The range is not part of the
    // displayed modifier text, so remove it before matching.
    .replace(/\s*\([-+]?\d+(?:[.,]\d+)?\s*[-–]\s*[-+]?\d+(?:[.,]\d+)?\)/g, "")
    .replace(/\b(prefix|suffix):\s*/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function resolveBase(rawBase) {
  const bases = Object.values(DATABASE.bases ?? {});
  const target = norm(rawBase);
  return bases.find(base => norm(base.name) === target) ?? null;
}

function parseItemLevel(lines) {
  const line = lines.find(value => /^item level\s*:/i.test(value));
  if (!line) return null;
  const value = Number.parseInt(line.split(":")[1]?.trim(), 10);
  return Number.isFinite(value) ? value : null;
}

function detectInfluences(lines) {
  const found = [];
  const text = lines.join(" ").toLowerCase();
  const patterns = [
    [/\bshaper\s+item\b|\bshaper\b/, "shaper"],
    [/\belder\s+item\b|\belder\b/, "elder"],
    [/\bcrusader\s+item\b|\bcrusader\b/, "crusader"],
    [/\bredeemer\s+item\b|\bredeemer\b/, "redeemer"],
    [/\bhunter\s+item\b|\bhunter\b/, "hunter"],
    [/\bwarlord\s+item\b|\bwarlord\b/, "warlord"],
  ];

  for (const [pattern, id] of patterns) {
    if (pattern.test(text) && !found.includes(id)) found.push(id);
  }

  return found.slice(0, 2);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function templateToRegex(template) {
  if (!template) return null;
  const clean = String(template)
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();

  let pattern = "";
  let cursor = 0;
  const token = /\{\d+\}/g;
  let match;

  while ((match = token.exec(clean))) {
    pattern += escapeRegExp(clean.slice(cursor, match.index));
    pattern += "([-+]?\\d+(?:[.,]\\d+)?)";
    cursor = match.index + match[0].length;
  }

  pattern += escapeRegExp(clean.slice(cursor));
  return new RegExp(`^\\s*${pattern}\\s*$`, "i");
}

function getTranslationEntries(statId) {
  return STAT_TRANSLATIONS?.[statId] ?? [];
}

function getStatLineMatches(stat) {
  const entries = getTranslationEntries(stat?.id);
  const results = [];

  for (const entry of entries) {
    const regex = templateToRegex(entry.string);
    if (regex) results.push({ regex, entry });
  }

  return results;
}

function numberFromToken(value) {
  return Number(String(value).replace(/,/g, ""));
}

function transformDisplayValue(value, handlers = []) {
  let result = value;
  for (const handler of handlers) {
    switch (handler) {
      case "divide_by_two_0dp": result = Math.round(result / 2); break;
      case "divide_by_three": result /= 3; break;
      case "divide_by_four": result /= 4; break;
      case "divide_by_five": result /= 5; break;
      case "divide_by_six": result /= 6; break;
      case "divide_by_ten_0dp": result = Math.round(result / 10); break;
      case "divide_by_ten_1dp": result = Number((result / 10).toFixed(1)); break;
      case "divide_by_twelve": result /= 12; break;
      case "divide_by_fifteen_0dp": result = Math.round(result / 15); break;
      case "divide_by_twenty": result /= 20; break;
      case "divide_by_one_hundred": result /= 100; break;
      case "divide_by_one_hundred_2dp": result = Number((result / 100).toFixed(2)); break;
      case "divide_by_one_thousand": result /= 1000; break;
      case "double": result *= 2; break;
      case "times_one_point_five": result *= 1.5; break;
      case "times_twenty": result *= 20; break;
      case "plus_two_hundred": result += 200; break;
      case "negate": result = -result; break;
      case "negate_and_double": result = -result * 2; break;
      case "per_minute_to_per_second": result /= 60; break;
      case "per_minute_to_per_second_0dp": result = Math.round(result / 60); break;
      case "per_minute_to_per_second_1dp": result = Number((result / 60).toFixed(1)); break;
      case "per_minute_to_per_second_2dp": result = Number((result / 60).toFixed(2)); break;
      case "milliseconds_to_seconds": result /= 1000; break;
      case "milliseconds_to_seconds_0dp": result = Math.round(result / 1000); break;
      case "milliseconds_to_seconds_1dp": result = Number((result / 1000).toFixed(1)); break;
      case "milliseconds_to_seconds_2dp": result = Number((result / 1000).toFixed(2)); break;
      case "deciseconds_to_seconds": result /= 10; break;
      case "locations_to_metres": result /= 100; break;
      case "30%_of_value": result *= 0.3; break;
      case "60%_of_value": result *= 0.6; break;
      default: break;
    }
  }
  return result;
}

function approximatelyEqual(a, b) {
  const tolerance = Math.max(0.05, Math.abs(a) * 0.002);
  return Math.abs(a - b) <= tolerance;
}

function candidateMatchScore(mod, lines) {
  if (!mod?.stats?.length) return 0;

  let score = 0;

  for (const stat of mod.stats) {
    const translations = getStatLineMatches(stat);
    let bestStatScore = 0;

    for (const { regex, entry } of translations) {
      for (const line of lines) {
        const match = normalizeForMatch(line).match(regex);
        if (!match) continue;

        let statScore = 1;
        const rawValue =
          match[1] == null
            ? null
            : numberFromToken(match[1]);

        if (rawValue != null && Number.isFinite(rawValue)) {
          const handlers = (entry.index_handlers ?? []).flat();
          const displayedMin =
            transformDisplayValue(Number(stat.min), handlers);
          const displayedMax =
            transformDisplayValue(Number(stat.max), handlers);

          if (
            Number.isFinite(displayedMin) &&
            Number.isFinite(displayedMax)
          ) {
            const low = Math.min(displayedMin, displayedMax);
            const high = Math.max(displayedMin, displayedMax);

            if (
              rawValue >= low - 0.001 &&
              rawValue <= high + 0.001
            ) {
              statScore = Math.max(statScore, 4);
            }
          }

          if (
            Number.isFinite(Number(stat.min)) &&
            Number.isFinite(Number(stat.max)) &&
            rawValue >= Math.min(Number(stat.min), Number(stat.max)) - 0.001 &&
            rawValue <= Math.max(Number(stat.min), Number(stat.max)) + 0.001
          ) {
            statScore = Math.max(statScore, 3);
          }
        }

        bestStatScore = Math.max(bestStatScore, statScore);
      }
    }

    // Every stat belonging to a modifier must be represented by the item text.
    if (bestStatScore === 0) return 0;
    score += bestStatScore;
  }

  return score;
}


function getGenerationInfluence(generationType) {
  const value = String(generationType ?? "").toLowerCase();
  const match = value.match(/^(?:prefix|suffix)_(.+)$/);
  return match ? (INFLUENCE_ALIASES[match[1]] ?? null) : null;
}

function normalizeModifier(mod) {
  return {
    id: mod.id,
    name: mod.name ?? mod.id,
    generationType: mod.generationType ?? null,
    domain: mod.domain ?? null,
    group: mod.group ?? null,
    domain: mod.domain ?? null,
    tags: Array.isArray(mod.tags) ? [...mod.tags] : [],
    stats: Array.isArray(mod.stats) ? structuredClone(mod.stats) : [],
    levels: Array.isArray(mod.levels) ? structuredClone(mod.levels) : [],
    weights: Array.isArray(mod.weights) ? structuredClone(mod.weights) : [],
    spawnWeights: Array.isArray(mod.spawnWeights) ? structuredClone(mod.spawnWeights) : [],
    requiredLevel: Number.isFinite(Number(mod.requiredLevel)) ? Number(mod.requiredLevel) : null
  };
}

function classifyModifier(mod) {
  const generation = String(mod?.generationType ?? "").toLowerCase();
  if (generation === "prefix" || generation.startsWith("prefix_")) return "prefix";
  if (generation === "suffix" || generation.startsWith("suffix_")) return "suffix";
  if (generation === "crafted" || generation === "master") return "crafted";
  if (generation.includes("implicit")) return "implicit";
  return null;
}

function parseExplicitModifierBlocks(lines) {
  const blocks = [];
  let current = null;

  for (const line of lines) {
    const header = line.match(/^\{\s*(Master Crafted Prefix|Master Crafted Suffix|Prefix|Suffix) Modifier\s+"([^"]+)"/i);

    if (header) {
      if (current) blocks.push(current);

      const label = header[1].toLowerCase();
      const kind = label.includes("suffix") ? "suffix" : "prefix";
      const crafted = label.startsWith("master crafted");

      current = {
        kind: crafted ? "crafted" : kind,
        generationKind: kind,
        name: header[2],
        lines: []
      };
      continue;
    }

    if (current) {
      // A new section/separator ends the current modifier block.
      if (/^\{/.test(line) || /^[-]{4,}$/.test(line) || /^(?:Searing Exarch|Eater of Worlds|Shaper|Elder|Crusader|Redeemer|Hunter|Warlord) Item$/i.test(line)) {
        blocks.push(current);
        current = null;
        continue;
      }
      current.lines.push(line);
    }
  }

  if (current) blocks.push(current);
  return blocks;
}

function normalizeModifierName(value) {
  return norm(value).replace(/^of\s+/, "of ");
}

function chooseBestExplicitMatches(blocks, refs, mods, influences) {
  const selected = [];
  const usedIds = new Set();
  const usedGroups = new Set();

  for (const block of blocks) {
    const candidates = [];

    for (const ref of refs) {
      const mod = mods?.[ref.id];
      if (!mod || usedIds.has(ref.id)) continue;

      const kind = classifyModifier(mod);
      const expectedKind = block.generationKind;
      if (kind !== expectedKind) continue;
      if (block.kind === "crafted" && String(mod.domain ?? "").toLowerCase() !== "crafted") continue;
      if (block.kind !== "crafted" && String(mod.domain ?? "item").toLowerCase() === "crafted") continue;

      if (normalizeModifierName(mod.name) !== normalizeModifierName(block.name)) continue;

      const requiredInfluence = getGenerationInfluence(ref.generationType ?? mod.generationType);
      if (requiredInfluence && !influences.includes(requiredInfluence)) continue;

      const score = candidateMatchScore(mod, block.lines);
      if (score > 0) candidates.push({ ref, mod, score });
    }

    candidates.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return Number(b.mod.requiredLevel ?? 0) - Number(a.mod.requiredLevel ?? 0);
    });

    const match = candidates[0];
    if (!match) continue;

    const kind = classifyModifier(match.mod);
    if (kind === "prefix" || kind === "suffix") {
      // RePoE groups are mutually-exclusive modifier families. Do not
      // allow different tiers of the same family to be imported together,
      // even if one is a prefix and the other is a suffix.
      const group = String(match.mod.group ?? "").trim();
      if (group) {
        if (usedGroups.has(group)) continue;
        usedGroups.add(group);
      }
    }

    usedIds.add(match.ref.id);
    selected.push(match);
  }

  return selected;
}

function chooseBestMatches(lines, refs, mods, influences) {
  const matches = [];

  for (const ref of refs) {
    const mod = mods?.[ref.id];
    if (!mod) continue;

    const score = candidateMatchScore(mod, lines);
    if (!score) continue;

    const requiredInfluence =
      getGenerationInfluence(
        ref.generationType ?? mod.generationType
      );

    if (
      requiredInfluence &&
      !influences.includes(requiredInfluence)
    ) {
      continue;
    }

    if (
      Number.isFinite(Number(ref.weight)) &&
      Number(ref.weight) <= 0
    ) {
      continue;
    }

    matches.push({
      ref,
      mod,
      score
    });
  }

  matches.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }

    const levelA = Number(a.mod.requiredLevel ?? 0);
    const levelB = Number(b.mod.requiredLevel ?? 0);

    return levelB - levelA;
  });

  const selected = [];
  const usedGroups = new Set();

  for (const match of matches) {
    const kind = classifyModifier(match.mod);
    if (!kind) continue;

    if (
      (kind === "prefix" || kind === "suffix") &&
      usedGroups.has(`${kind}:${match.mod.group}`)
    ) {
      continue;
    }

    selected.push(match);

    if (
      kind === "prefix" ||
      kind === "suffix"
    ) {
      usedGroups.add(
        `${kind}:${match.mod.group}`
      );
    }
  }

  return selected;
}


export async function parseItemText(raw) {
  const lines = String(raw ?? "")
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  if (!lines.length) return null;

  const baseLine = lines.find(line => Object.values(DATABASE.bases ?? {}).some(base => norm(base.name) === norm(line)));
  const baseEntry = resolveBase(baseLine);
  if (!baseEntry) return null;

  const baseType = baseEntry.baseType;
  const itemLevel = parseItemLevel(lines);
  const influences = detectInfluences(lines);
  const chunk = await loadModChunk(baseType);
  const normalRefs = chunk.MODS_BY_BASE?.[baseEntry.id] ?? [];
  const baseTags = new Set(baseEntry.tags ?? []);
  const craftedMods = (CRAFTED_MODS ?? []).filter(mod => {
    const tags = Array.isArray(mod.spawnWeights)
      ? mod.spawnWeights.map(entry => String(entry?.tag ?? ""))
      : [];
    return tags.some(tag => baseTags.has(tag));
  });
  const craftedRefs = craftedMods.map(mod => ({
    id: mod.id,
    generationType: mod.generationType,
    group: mod.group,
    weight: 0
  }));
  const refs = [...normalRefs, ...craftedRefs];
  const mods = {
    ...(chunk.MODS ?? {}),
    ...Object.fromEntries(craftedMods.map(mod => [mod.id, mod]))
  };

  // Only parse explicit Prefix/Suffix/Master Crafted headers.
  // Eldritch implicit lines are deliberately ignored; their text can be
  // identical to a normal explicit modifier (for example Attack Speed).
  const blocks = parseExplicitModifierBlocks(lines);
  const selected = chooseBestExplicitMatches(
    blocks,
    refs,
    mods,
    influences
  );

  const prefixes = [];
  const suffixes = [];
  const crafted = [];
  const implicits = [];

  for (const { mod } of selected) {
    const normalized = normalizeModifier(mod);
    const kind = classifyModifier(mod);

    if (kind === "prefix" && prefixes.length < 3) {
      prefixes.push(normalized);
    } else if (kind === "suffix" && suffixes.length < 3) {
      suffixes.push(normalized);
    } else if (kind === "crafted") {
      crafted.push(normalized);
    }
  }

  // The rare item name is immediately above the base name in normal PoE copy text.
  const baseIndex = lines.findIndex(line => norm(line) === norm(baseEntry.name));
  const name = baseIndex > 0 ? lines[baseIndex - 1] : "";

  return {
    name,
    base: baseEntry.name,
    baseId: baseEntry.id,
    baseType,
    itemLevel,
    influences,
    influence1: influences[0] ?? "",
    influence2: influences[1] ?? "",
    prefixes,
    suffixes,
    crafted,
    implicits
  };
}

export function openImportModal(target) {
  currentImportTarget = target;
  const { modal, title, text } = getModalElements();
  if (!modal || !title || !text) return;
  title.textContent = `Import Item ${target}`;
  text.value = "";
  modal.classList.remove("hidden");
  text.focus();
}

export function closeImportModal() {
  const { modal } = getModalElements();
  modal?.classList.add("hidden");
  currentImportTarget = null;
}

async function handleImport() {
  const { text } = getModalElements();
  const raw = text?.value.trim() ?? "";
  if (!raw) return;

  try {
    const parsed = await parseItemText(raw);

    if (!parsed) {
      alert("Could not parse item text.");
      return;
    }

    // The UI import handler can reject an otherwise valid parsed item,
    // for example when Item A and Item B have incompatible base types.
    // Keep the modal open so the user can correct the pasted item.
    const result = importHandler
      ? await importHandler(currentImportTarget, parsed)
      : true;

    if (result === false) {
      return;
    }

    closeImportModal();
  } catch (error) {
    console.error("IMPORT ERROR:", error);
    alert("Import failed. Check the console for details.");
  }
}

export function initializeImportModal() {
  const { cancel, confirm } = getModalElements();
  if (cancel) cancel.addEventListener("click", closeImportModal);
  if (confirm) confirm.addEventListener("click", handleImport);
}
