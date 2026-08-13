import {
  BASE_TYPES,
  BASES,
  BASES_BY_TYPE
} from "./data/generated/bases.js";

import {
  createEmptyItem,
  recombine
} from "./simulator.js";

import {
  loadModChunk as loadModifierChunk
} from "./mod-loader.js";


const state = {
  itemA: createEmptyItem(),
  itemB: createEmptyItem()
};


/*
 * ---------------------------------------------------------
 * CONSTANTS
 * ---------------------------------------------------------
 */

const MAX_PREFIXES = 3;
const MAX_SUFFIXES = 3;


const INFLUENCES = [
  {
    id: "shaper",
    name: "Shaper"
  },
  {
    id: "elder",
    name: "Elder"
  },
  {
    id: "crusader",
    name: "Crusader"
  },
  {
    id: "redeemer",
    name: "Redeemer"
  },
  {
    id: "hunter",
    name: "Hunter"
  },
  {
    id: "warlord",
    name: "Warlord"
  },
];




/*
 * ---------------------------------------------------------
 * INITIALIZATION
 * ---------------------------------------------------------
 */

export function initializeUI({
  database
}) {

  populateBaseTypeSelect(
    document.querySelector(
      "#item-a-base-type"
    )
  );

  const itemBBaseType =
    document.querySelector(
      "#item-b-base-type"
    );

  populateBaseTypeSelect(
    itemBBaseType
  );

  // Item B always uses Item A's base type. It is displayed for
  // reference only and can never be changed independently.
  if (itemBBaseType) {
    itemBBaseType.disabled = true;
  }


  setupItemImport(database);
  
  setupItemATypeSelector();

  setupBaseSelectors();

  setupItemLevelInputs();

  setupInfluenceSelectors();

  setupModifierControls(
    database
  );

  setupModifierSearchControls();

  setupRunButton(
    database
  );

  renderStatus();
}


/*
 * ---------------------------------------------------------
 * BASE TYPE SELECTORS
 * ---------------------------------------------------------
 */

function populateBaseTypeSelect(
  select
) {

  if (!select) {
    return;
  }

  select.innerHTML = `
    <option value="">
      Select base type...
    </option>
  `;


  for (
    const baseType of BASE_TYPES
  ) {

    const option =
      document.createElement(
        "option"
      );

    option.value =
      baseType.id;

    option.textContent =
      baseType.name;

    select.appendChild(
      option
    );
  }
}

import {
  openImportModal,
  initializeImportModal,
  setImportHandler
} from "./import-item.js";

async function applyImportedItem(target, imported) {
  const key = target === "A" ? "itemA" : "itemB";
  const item = state[key];
  if (!item) return false;

  const importedBaseType = imported.baseType || null;

  // Item A is the source of truth for the base type. Item B may never
  // use a different base type, even when an imported item is pasted into B.
  if (target === "B") {
    if (!state.itemA.baseType) {
      alert("Item B cannot be imported until Item A has a base type. Item B must use the same base type as Item A.");
      return false;
    }

    if (importedBaseType !== state.itemA.baseType) {
      alert(
        `Item B was not imported because its base type (\"${getBaseTypeName(importedBaseType)}\") does not match Item A's base type (\"${getBaseTypeName(state.itemA.baseType)}\").`
      );
      return false;
    }
  } else if (target === "A") {
    // Normally B already mirrors A. This check also protects against a
    // stale/inconsistent state and prevents importing incompatible items.
    if (state.itemB.baseType && importedBaseType !== state.itemB.baseType) {
      alert(
        `Item A was not imported because its base type (\"${getBaseTypeName(importedBaseType)}\") does not match Item B's base type (\"${getBaseTypeName(state.itemB.baseType)}\").`
      );
      return false;
    }
  }

  item.name = imported.name || "";
  item.baseType = importedBaseType;
  item.baseId = imported.baseId || null;
  item.itemLevel = imported.itemLevel ?? null;
  item.influences = Array.isArray(imported.influences)
    ? [...imported.influences].slice(0, 2)
    : [imported.influence1, imported.influence2].filter(Boolean).slice(0, 2);
  const importedPrefixes = Array.isArray(imported.prefixes) ? imported.prefixes : [];
  const importedSuffixes = Array.isArray(imported.suffixes) ? imported.suffixes : [];
  const importedCrafted = Array.isArray(imported.crafted) ? imported.crafted : [];

  // The selector UI represents the actual three prefix/three suffix slots.
  // A Master Crafted prefix/suffix therefore belongs in the same collection
  // as ordinary explicit modifiers rather than in a separate, unused list.
  item.prefixes = [
    ...importedPrefixes,
    ...importedCrafted.filter(mod => String(mod.generationType ?? "").toLowerCase() === "prefix")
  ].slice(0, MAX_PREFIXES);

  item.suffixes = [
    ...importedSuffixes,
    ...importedCrafted.filter(mod => String(mod.generationType ?? "").toLowerCase() === "suffix")
  ].slice(0, MAX_SUFFIXES);

  item.crafted = importedCrafted;
  item.implicits = Array.isArray(imported.implicits) ? imported.implicits : [];

  // Item A owns the base-type selection. Whenever Item A is imported,
  // mirror that base type onto Item B and refresh B's base list.
  if (target === "A") {
    const previousItemBType = state.itemB.baseType;
    state.itemB.baseType = importedBaseType;

    if (previousItemBType !== importedBaseType) {
      state.itemB.baseId = null;
      state.itemB.prefixes = [];
      state.itemB.suffixes = [];
      clearModifierUI("b");
    }
  }

  const suffix = target.toLowerCase();
  const baseTypeSelect = document.querySelector(`#item-${suffix}-base-type`);
  const baseSelect = document.querySelector(`#item-${suffix}-base`);
  const levelInput = document.querySelector(`#item-${suffix}-item-level`);
  const influence1 = document.querySelector(`#item-${suffix}-influence-1`);
  const influence2 = document.querySelector(`#item-${suffix}-influence-2`);

  if (baseTypeSelect) baseTypeSelect.value = item.baseType || "";
  populateBaseSelector(baseSelect, item.baseType);
  if (baseSelect) baseSelect.value = item.baseId || "";

  // If Item A was imported, its base type is also the base type displayed
  // by Item B. B's selector is disabled, so this must be synchronized here.
  if (target === "A") {
    const itemBType = document.querySelector("#item-b-base-type");
    const itemBBase = document.querySelector("#item-b-base");

    if (itemBType) {
      itemBType.value = state.itemB.baseType || "";
      itemBType.disabled = true;
    }

    populateBaseSelector(itemBBase, state.itemB.baseType);
    if (itemBBase) itemBBase.value = state.itemB.baseId || "";
  }

  if (levelInput) levelInput.value = item.itemLevel ?? "";
  if (influence1) influence1.value = item.influences[0] || "";
  if (influence2) influence2.value = item.influences[1] || "";

  await loadModifierChunk(item.baseType);
  updateModifierSelectors(suffix);
  renderSelectedModifiers(suffix, "prefix");
  renderSelectedModifiers(suffix, "suffix");
  renderStatus();
  return true;
}

function setupItemImport(database) {
  const importA = document.querySelector("#import-item-a-button");
  const importB = document.querySelector("#import-item-b-button");

  if (importA) {
    importA.addEventListener("click", () => openImportModal("A"));
  }

  if (importB) {
    importB.addEventListener("click", () => openImportModal("B"));
  }

  initializeImportModal();
  setImportHandler(applyImportedItem);
}


function setupItemATypeSelector() {

  const select =
    document.querySelector(
      "#item-a-base-type"
    );

  if (!select) {
    return;
  }


  select.addEventListener(
    "change",
    async () => {

      const type =
        select.value;


      state.itemA.baseType =
        type || null;

      state.itemA.baseId =
        null;

      state.itemA.prefixes =
        [];

      state.itemA.suffixes =
        [];


      /*
       * Item B is always forced to use
       * the same base type.
       */

      state.itemB.baseType =
        type || null;

      state.itemB.baseId =
        null;

      state.itemB.prefixes =
        [];

      state.itemB.suffixes =
        [];


      const itemBType =
        document.querySelector(
          "#item-b-base-type"
        );


      if (itemBType) {

        itemBType.value =
          type;

        // Item B's base type is always a copy of Item A's base type.
        // Keep this control non-interactable even when Item A has no type.
        itemBType.disabled = true;

      }


      populateBaseSelector(
        document.querySelector(
          "#item-a-base"
        ),
        type
      );


      populateBaseSelector(
        document.querySelector(
          "#item-b-base"
        ),
        type
      );


      clearModifierUI(
        "a"
      );

      clearModifierUI(
        "b"
      );


      if (type) {

        await loadModifierChunk(
          type
        );

        updateModifierSelectors(
          "a"
        );

        updateModifierSelectors(
          "b"
        );

      }


      renderStatus();
    }
  );
}


/*
 * ---------------------------------------------------------
 * BASE SELECTORS
 * ---------------------------------------------------------
 */

function setupBaseSelectors() {

  const baseA =
    document.querySelector(
      "#item-a-base"
    );

  const baseB =
    document.querySelector(
      "#item-b-base"
    );


  if (baseA) {

    baseA.addEventListener(
      "change",
      async () => {

        state.itemA.baseId =
          baseA.value || null;

        state.itemA.prefixes =
          [];

        state.itemA.suffixes =
          [];


        clearModifierUI(
          "a"
        );


        if (
          state.itemA.baseType &&
          state.itemA.baseId
        ) {

          await loadModifierChunk(
            state.itemA.baseType
          );

          updateModifierSelectors(
            "a"
          );

        }


        renderStatus();
      }
    );

  }


  if (baseB) {

    baseB.addEventListener(
      "change",
      async () => {

        state.itemB.baseId =
          baseB.value || null;

        state.itemB.prefixes =
          [];

        state.itemB.suffixes =
          [];


        clearModifierUI(
          "b"
        );


        if (
          state.itemB.baseType &&
          state.itemB.baseId
        ) {

          await loadModifierChunk(
            state.itemB.baseType
          );

          updateModifierSelectors(
            "b"
          );

        }


        renderStatus();
      }
    );

  }
}


function populateBaseSelector(
  select,
  baseType
) {

  if (!select) {
    return;
  }


  select.innerHTML = `
    <option value="">
      Select base...
    </option>
  `;


  if (!baseType) {

    select.disabled =
      true;

    return;
  }


  const baseIds =
    BASES_BY_TYPE[
      baseType
    ] ?? [];


  for (
    const id of baseIds
  ) {

    const base =
      BASES[id];

    if (!base) {
      continue;
    }


    const option =
      document.createElement(
        "option"
      );

    option.value =
      base.id;

    option.textContent =
      base.name;

    select.appendChild(
      option
    );
  }


  select.disabled =
    baseIds.length === 0;
}


/*
 * ---------------------------------------------------------
 * ITEM LEVEL
 * ---------------------------------------------------------
 */

function setupItemLevelInputs() {

  const inputA =
    document.querySelector(
      "#item-a-item-level"
    );

  const inputB =
    document.querySelector(
      "#item-b-item-level"
    );


  // New items default to item level 86. Do not clamp user input here:
  // values outside 1-100 need to remain visible so the Run button can warn
  // the user and prevent the recombinator from running.
  if (inputA) {
    if (!inputA.value) {
      inputA.value = state.itemA.itemLevel ?? 86;
    }

    inputA.addEventListener(
      "input",
      () => {
        state.itemA.itemLevel = Number(inputA.value);
      }
    );
  }


  if (inputB) {
    if (!inputB.value) {
      inputB.value = state.itemB.itemLevel ?? 86;
    }

    inputB.addEventListener(
      "input",
      () => {
        state.itemB.itemLevel = Number(inputB.value);
      }
    );
  }
}


/*
 * ---------------------------------------------------------
 * INFLUENCE
 * ---------------------------------------------------------
 */

function setupInfluenceSelectors() {

  const selectA1 =
    document.querySelector(
      "#item-a-influence-1"
    );
	
	const selectA2 =
    document.querySelector(
      "#item-a-influence-2"
    );

  const selectB1 =
    document.querySelector(
      "#item-b-influence-1"
    );
	
	const selectB2 =
    document.querySelector(
      "#item-b-influence-2"
    );


  if (selectA1) {

    populateInfluenceSelect(
      selectA1
    );


    selectA1.addEventListener(
      "change",
      () => {

        state.itemA.influences = getSelectedInfluences(selectA1, selectA2);
        updateModifierSelectors("a");

      }
    );

  }
  
  if (selectA2) {

    populateInfluenceSelect(
      selectA2
    );


    selectA2.addEventListener(
      "change",
      () => {

        state.itemA.influences = getSelectedInfluences(selectA1, selectA2);
        updateModifierSelectors("a");

      }
    );

  }


  if (selectB1) {

    populateInfluenceSelect(
      selectB1
    );


    selectB1.addEventListener(
      "change",
      () => {

        state.itemB.influences = getSelectedInfluences(selectB1, selectB2);
        updateModifierSelectors("b");

      }
    );

  }
  
  if (selectB2) {

    populateInfluenceSelect(
      selectB2
    );


    selectB2.addEventListener(
      "change",
      () => {

        state.itemB.influences = getSelectedInfluences(selectB1, selectB2);
        updateModifierSelectors("b");

      }
    );

  }
}


function getSelectedInfluences(first, second) {
  return [first?.value, second?.value]
    .filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index);
}

function populateInfluenceSelect(
  select
) {

  select.innerHTML = `
    <option value="">
      None
    </option>
  `;


  for (
    const influence of INFLUENCES
  ) {

    const option =
      document.createElement(
        "option"
      );

    option.value =
      influence.id;

    option.textContent =
      influence.name;

    select.appendChild(
      option
    );
  }
}


/*
 * ---------------------------------------------------------
 * MODIFIER CONTROLS
 * ---------------------------------------------------------
 */

function setupModifierControls(
  database
) {

  setupModifierControl(
    "a",
    "prefix",
    database
  );

  setupModifierControl(
    "a",
    "suffix",
    database
  );

  setupModifierControl(
    "b",
    "prefix",
    database
  );

  setupModifierControl(
    "b",
    "suffix",
    database
  );
}


function setupModifierControl(
  itemKey,
  modifierType,
  database
) {

  const select =
    getModifierSelect(
      itemKey,
      modifierType
    );

  const button =
    getModifierAddButton(
      itemKey,
      modifierType
    );


  if (!select || !button) {
    return;
  }


  button.addEventListener(
    "click",
    async () => {

      const item =
        itemKey === "a"
          ? state.itemA
          : state.itemB;


      const maximum =
        modifierType === "prefix"
          ? MAX_PREFIXES
          : MAX_SUFFIXES;


      const collection =
        modifierType === "prefix"
          ? item.prefixes
          : item.suffixes;


      if (
        collection.length >= maximum
      ) {

        return;
      }


      const modId =
        select.value;


      if (!modId) {
        return;
      }


      /*
       * Don't allow the same exact modifier
       * to be added twice to one item.
       */

      if (
        collection.some(
          mod =>
            getModifierId(mod) ===
            modId
        )
      ) {

        return;
      }


      const chunk =
        await loadModifierChunk(
          item.baseType
        );


      if (!chunk) {
        return;
      }


      const mod =
        chunk.MODS?.[modId];


      if (!mod) {
        return;
      }


      // Protect the state as well as the dropdown. This prevents an
      // incompatible modifier from being inserted if the UI is stale or
      // a selection is triggered programmatically.
      if (modifierConflictsWithSelected(item, mod)) {
        return;
      }


      collection.push(
        normalizeSelectedModifier(
          mod
        )
      );


      select.value =
        "";


      updateModifierSelectors(
        itemKey
      );

      renderSelectedModifiers(
        itemKey,
        modifierType
      );
    }
  );
}




/*
 * ---------------------------------------------------------
 * MODIFIER SELECTOR POPULATION
 * ---------------------------------------------------------
 */

async function updateModifierSelectors(
  itemKey
) {

  const item =
    itemKey === "a"
      ? state.itemA
      : state.itemB;


  if (
    !item.baseType ||
    !item.baseId
  ) {

    clearModifierSelect(
      itemKey,
      "prefix"
    );

    clearModifierSelect(
      itemKey,
      "suffix"
    );

    renderModifierDropdown(itemKey, "prefix");
    renderModifierDropdown(itemKey, "suffix");

    renderSelectedModifiers(
      itemKey,
      "prefix"
    );

    renderSelectedModifiers(
      itemKey,
      "suffix"
    );

    return;
  }


  const chunk =
    await loadModifierChunk(
      item.baseType
    );


  if (!chunk) {
    return;
  }


  const baseMods =
    chunk.MODS_BY_BASE?.[
      item.baseId
    ] ?? [];


  populateModifierSelect(
    itemKey,
    "prefix",
    baseMods,
    chunk.MODS
  );


  populateModifierSelect(
    itemKey,
    "suffix",
    baseMods,
    chunk.MODS
  );


  renderSelectedModifiers(
    itemKey,
    "prefix"
  );

  renderSelectedModifiers(
    itemKey,
    "suffix"
  );
}


/*
 * ---------------------------------------------------------
 * INFLUENCE REQUIREMENTS
 * ---------------------------------------------------------
 *
 * RePoE uses several internal names for influenced mods.
 * Map those names to the influence IDs used by the UI.
 *
 * Examples:
 *   shaper      -> Shaper
 *   elder       -> Elder
 *   adjudicator -> Crusader
 *   eyrie       -> Redeemer
 *   basilisk    -> Hunter
 *   warlord     -> Warlord
 */
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


function getModifierInfluence(
  generationType
) {

  const value =
    String(
      generationType ?? ""
    ).toLowerCase();


  const match =
    value.match(
      /^(?:prefix|suffix)_(.+)$/
    );


  if (!match) {
    return null;
  }


  return (
    INFLUENCE_ALIASES[
      match[1]
    ] ?? null
  );
}


function modifierRequiresInfluence(
  ref,
  mod
) {

  const generationType =
    ref?.generationType ??
    mod?.generationType ??
    "";


  return Boolean(
    getModifierInfluence(
      generationType
    )
  );
}


function modifierMatchesItemInfluence(
  item,
  ref,
  mod
) {

  const requiredInfluence =
    getModifierInfluence(
      ref?.generationType ??
      mod?.generationType ??
      ""
    );


  /*
   * Normal modifiers have no influence
   * requirement and are always eligible.
   */
  if (!requiredInfluence) {
    return true;
  }


  const itemInfluences =
    Array.isArray(
      item?.influences
    )
      ? item.influences
      : [];


  return itemInfluences.includes(
    requiredInfluence
  );
}


function modifierConflictsWithSelected(item, candidate) {

  if (!candidate) {
    return false;
  }

  const candidateId = getModifierId(candidate);
  const candidateGroup = String(candidate.group ?? "").trim();

  const selected = [
    ...(Array.isArray(item?.prefixes) ? item.prefixes : []),
    ...(Array.isArray(item?.suffixes) ? item.suffixes : [])
  ];

  return selected.some(selectedMod => {
    if (!selectedMod) {
      return false;
    }

    // The exact modifier ID can never be selected twice.
    if (candidateId && getModifierId(selectedMod) === candidateId) {
      return true;
    }

    // RePoE's group identifies mutually-exclusive modifier families.
    // This is what prevents different tiers of the same mod family
    // (e.g. IncreasedLife T1 + IncreasedLife T2) from coexisting.
    const selectedGroup = String(selectedMod.group ?? "").trim();
    return Boolean(candidateGroup && selectedGroup && candidateGroup === selectedGroup);
  });
}


const modifierSearchTerms = {
  a: {
    prefix: "",
    suffix: ""
  },
  b: {
    prefix: "",
    suffix: ""
  }
};


function getModifierSearchInput(
  itemKey,
  modifierType
) {
  return document.querySelector(
    `#item-${itemKey}-${modifierType}-search`
  );
}


function getModifierSearchTerm(
  itemKey,
  modifierType
) {
  const input =
    getModifierSearchInput(
      itemKey,
      modifierType
    );

  return (
    input?.value ??
    modifierSearchTerms[itemKey]?.[modifierType] ??
    ""
  ).trim().toLowerCase();
}


function modifierMatchesSearch(
  mod,
  ref,
  searchTerm
) {
  if (!searchTerm) {
    return true;
  }

  const searchable = [
    mod?.name,
    mod?.type,
    mod?.group,
    mod?.id,
    mod?.text,
    ref?.id,
    ref?.group
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return searchable.includes(searchTerm);
}


function setupModifierSearchControls() {
  for (const itemKey of ["a", "b"]) {
    for (const modifierType of ["prefix", "suffix"]) {
      const trigger = document.querySelector(
        `#item-${itemKey}-${modifierType}-trigger`
      );

      const dropdown = document.querySelector(
        `#item-${itemKey}-${modifierType}-dropdown`
      );

      const input = getModifierSearchInput(
        itemKey,
        modifierType
      );

      if (!trigger || !dropdown || !input) {
        continue;
      }

      trigger.addEventListener("click", () => {
        if (trigger.disabled) {
          return;
        }

        const isOpen = !dropdown.hidden;
        closeAllModifierDropdowns();

        if (!isOpen) {
          dropdown.hidden = false;
          trigger.setAttribute("aria-expanded", "true");
          input.disabled = !hasBaseType(itemKey);
          input.focus();
          input.select();
        }
      });

      input.addEventListener("input", () => {
        modifierSearchTerms[itemKey][modifierType] = input.value;
        updateModifierSelectors(itemKey);
      });
    }
  }

  document.addEventListener("click", event => {
    if (event.target.closest(".mod-combobox")) {
      return;
    }

    closeAllModifierDropdowns();
  });
}

function hasBaseType(itemKey) {
  const item = itemKey === "a" ? state.itemA : state.itemB;
  return Boolean(item?.baseType);
}

function closeAllModifierDropdowns() {
  document.querySelectorAll(".mod-combobox-dropdown").forEach(dropdown => {
    dropdown.hidden = true;
  });

  document.querySelectorAll(".mod-combobox-trigger").forEach(trigger => {
    trigger.setAttribute("aria-expanded", "false");
  });
}

function renderModifierDropdown(
  itemKey,
  modifierType
) {
  const select = getModifierSelect(itemKey, modifierType);
  const trigger = document.querySelector(
    `#item-${itemKey}-${modifierType}-trigger`
  );
  const dropdown = document.querySelector(
    `#item-${itemKey}-${modifierType}-dropdown`
  );
  const input = getModifierSearchInput(itemKey, modifierType);
  const optionsContainer = document.querySelector(
    `#item-${itemKey}-${modifierType}-options`
  );

  if (!select || !trigger || !dropdown || !input || !optionsContainer) {
    return;
  }

  const item = itemKey === "a" ? state.itemA : state.itemB;
  const maximum = modifierType === "prefix" ? MAX_PREFIXES : MAX_SUFFIXES;
  const collection = modifierType === "prefix" ? item.prefixes : item.suffixes;
  const baseTypeSelected = Boolean(item.baseType);
  const atMaximum = collection.length >= maximum;

  trigger.disabled = !baseTypeSelected || atMaximum;
  input.disabled = !baseTypeSelected;

  if (!baseTypeSelected || atMaximum) {
    closeAllModifierDropdowns();
  }

  if (select.value) {
    const selectedOption = select.options[select.selectedIndex];
    trigger.textContent = selectedOption?.textContent || `Select ${modifierType}...`;
  } else {
    trigger.textContent = atMaximum
      ? `Maximum ${maximum} reached`
      : `Select ${modifierType}...`;
  }

  optionsContainer.innerHTML = "";

  const options = Array.from(select.options).filter(option => option.value);

  if (!options.length) {
    const empty = document.createElement("div");
    empty.className = "mod-combobox-empty";
    empty.textContent = baseTypeSelected
      ? "No matching modifiers"
      : `Select a base type first`;
    optionsContainer.appendChild(empty);
    return;
  }

  for (const option of options) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "mod-combobox-option";
    button.textContent = option.textContent;
    button.setAttribute("role", "option");

    button.addEventListener("click", () => {
      select.value = option.value;
      trigger.textContent = option.textContent;
      closeAllModifierDropdowns();
    });

    optionsContainer.appendChild(button);
  }
}


function populateModifierSelect(
  itemKey,
  modifierType,
  baseMods,
  mods
) {

  const select =
    getModifierSelect(
      itemKey,
      modifierType
    );


  if (!select) {
    return;
  }


  const item =
    itemKey === "a"
      ? state.itemA
      : state.itemB;


  const collection =
    modifierType === "prefix"
      ? item.prefixes
      : item.suffixes;


  const maximum =
    modifierType === "prefix"
      ? MAX_PREFIXES
      : MAX_SUFFIXES;


  select.innerHTML = `
    <option value="">
      ${
        collection.length >= maximum
          ? `Maximum ${maximum} reached`
          : `Select ${modifierType}...`
      }
    </option>
  `;


  if (
    collection.length >= maximum
  ) {

    select.disabled =
      true;

    return;
  }


  /*
   * Determine which generation types
   * belong to prefixes and suffixes.
   *
   * Examples:
   *
   * prefix
   * prefix_shaper
   * prefix_elder
   * prefix_crusader
   * prefix_redeemer
   * prefix_hunter
   * prefix_warlord
   *
   * suffix
   * suffix_shaper
   * suffix_elder
   * etc.
   */

  const candidates =
    baseMods
      .filter(
        ref => {

          if (!ref) {
            return false;
          }


          const generationType =
            String(
              ref.generationType ?? ""
            );


          const isCorrectType =
            generationType ===
              modifierType ||
            generationType.startsWith(
              `${modifierType}_`
            );


          if (!isCorrectType) {
            return false;
          }


          /*
           * Influenced modifiers are only
           * selectable when the item has the
           * corresponding influence.
           */
          const mod =
            mods?.[ref.id];


          if (
            !modifierMatchesItemInfluence(
              item,
              ref,
              mod
            )
          ) {
            return false;
          }


          /*
           * Modifiers in the same RePoE group are mutually exclusive.
           * This applies across both prefixes and suffixes, because the
           * group represents the underlying modifier family rather than
           * the affix slot. For example, IncreasedLife T1 and T2 share
           * the IncreasedLife group and therefore cannot both be selected.
           */
          if (
            modifierConflictsWithSelected(item, mod)
          ) {
            return false;
          }


          /*
           * Zero-weight modifiers are not
           * actually selectable.
           */

          const weight =
            Number(
              ref.weight
            );


          if (
            Number.isFinite(weight) &&
            weight <= 0
          ) {

            return false;
          }


          const modId =
            ref.id;


          /*
           * Don't show modifiers already
           * selected on this item.
           */

          if (
            collection.some(
              mod =>
                getModifierId(mod) ===
                modId
            )
          ) {

            return false;
          }


          return Boolean(
            mods?.[modId]
          );
        }
      )
      .filter(
        ref =>
          modifierMatchesSearch(
            mods?.[ref.id],
            ref,
            getModifierSearchTerm(
              itemKey,
              modifierType
            )
          )
      )
      .sort(
        (a, b) => {

          const nameA =
            mods[a.id]?.name ??
            a.id;

          const nameB =
            mods[b.id]?.name ??
            b.id;

          return nameA.localeCompare(
            nameB
          );
        }
      );


  for (
    const ref of candidates
  ) {

    const mod =
      mods[
        ref.id
      ];


    const option =
      document.createElement(
        "option"
      );


    option.value =
      ref.id;


    option.textContent =
      formatModifierOption(
        mod,
        ref
      );


    select.appendChild(
      option
    );
  }


  select.disabled =
    candidates.length === 0;

  renderModifierDropdown(
    itemKey,
    modifierType
  );
}


/*
 * ---------------------------------------------------------
 * MODIFIER OPTION DISPLAY
 * ---------------------------------------------------------
 */

function getModifierDisplayName(
  mod,
  ref
) {
  /*
   * RePoE's `name` is the modifier's actual display/name field.
   * Never use `text` as the primary name: `text` is the rolled stat
   * description (for example "+(120-140) to Armour"), not the modifier
   * name. Some older generated data incorrectly surfaced that text.
   */
  const name =
    typeof mod?.name === "string"
      ? mod.name.trim()
      : "";

  if (name) {
    return name;
  }

  /*
   * Special modifiers can have a blank name. Prefer their semantic
   * type/group before falling back to the internal modifier ID.
   */
  const type =
    typeof mod?.type === "string"
      ? mod.type.trim()
      : "";

  if (type) {
    return type;
  }

  const group =
    typeof mod?.group === "string"
      ? mod.group.trim()
      : "";

  if (group) {
    return group;
  }

  return (
    ref?.id ||
    "Unknown modifier"
  );
}


function formatModifierOption(
  mod,
  ref
) {

  const name =
    getModifierDisplayName(
      mod,
      ref
    );


  const tier =
    getModifierTier(
      mod,
      ref
    );


  const weight =
    Number(
      ref?.weight
    );


  const details = [];


  if (tier !== null) {

    details.push(
      `T${tier}`
    );
  }


  if (
    Number.isFinite(weight)
  ) {

    details.push(
      `weight ${weight}`
    );
  }


  if (
    ref?.group
  ) {

    details.push(
      ref.group
    );
  }


  return details.length
    ? `${name} (${details.join(" • ")})`
    : name;
}


function getModifierTier(
  mod,
  ref
) {

  /*
   * RePoE's generated modifier data doesn't
   * necessarily expose a universal "tier"
   * property, so use the available level
   * information when possible.
   */

  if (
    Number.isInteger(
      ref?.tier
    )
  ) {

    return ref.tier;
  }


  if (
    Number.isInteger(
      mod?.tier
    )
  ) {

    return mod.tier;
  }


  return null;
}


/*
 * ---------------------------------------------------------
 * SELECTED MODIFIER RENDERING
 * ---------------------------------------------------------
 */

function updateModifierCount(
  itemKey,
  modifierType
) {

  const item =
    itemKey === "a"
      ? state.itemA
      : state.itemB;


  const collection =
    modifierType === "prefix"
      ? item.prefixes
      : item.suffixes;


  const maximum =
    modifierType === "prefix"
      ? MAX_PREFIXES
      : MAX_SUFFIXES;


  const count =
    document.querySelector(
      `#item-${itemKey}-${modifierType}-count`
    );


  if (!count) {
    return;
  }


  count.textContent =
    `${collection.length} / ${maximum}`;
}


function renderSelectedModifiers(
  itemKey,
  modifierType
) {

  const item =
    itemKey === "a"
      ? state.itemA
      : state.itemB;


  const collection =
    modifierType === "prefix"
      ? item.prefixes
      : item.suffixes;


  const list =
    getModifierListElement(
      itemKey,
      modifierType
    );


  updateModifierCount(
    itemKey,
    modifierType
  );


  if (!list) {
    return;
  }


  list.innerHTML = "";


  if (
    collection.length === 0
  ) {

    list.innerHTML = `
      <div class="empty-mods">
        No ${modifierType}es selected.
      </div>
    `;

    return;
  }


  for (
    let index = 0;
    index < collection.length;
    index++
  ) {

    const mod =
      collection[index];


    const row =
      document.createElement(
        "div"
      );


    row.className =
      "selected-mod";


    const name =
      mod.name ||
      mod.id ||
      "Unknown modifier";


    const details = [];


    if (
      mod.generationType
    ) {

      details.push(
        formatGenerationType(
          mod.generationType
        )
      );
    }


    if (
      mod.group
    ) {

      details.push(
        mod.group
      );
    }


    row.innerHTML = `
      <div class="selected-mod-info">

        <strong>
          ${escapeHtml(name)}
        </strong>

        ${
          details.length
            ? `
              <small>
                ${escapeHtml(
                  details.join(" • ")
                )}
              </small>
            `
            : ""
        }

      </div>

      <button
        type="button"
        class="remove-mod-button"
        data-item="${itemKey}"
        data-type="${modifierType}"
        data-index="${index}"
      >
        Remove
      </button>
    `;


    const removeButton =
      row.querySelector(
        ".remove-mod-button"
      );


    removeButton.addEventListener(
      "click",
      () => {

        collection.splice(
          index,
          1
        );


        updateModifierSelectors(
          itemKey
        );

        renderSelectedModifiers(
          itemKey,
          modifierType
        );
      }
    );


    list.appendChild(
      row
    );
  }
}


function formatGenerationType(
  value
) {

  return String(
    value
  )
    .replaceAll(
      "_",
      " "
    )
    .replace(
      /\b\w/g,
      char =>
        char.toUpperCase()
    );
}


/*
 * ---------------------------------------------------------
 * CLEAR MODIFIER UI
 * ---------------------------------------------------------
 */

function clearModifierUI(
  itemKey
) {

  clearModifierSelect(
    itemKey,
    "prefix"
  );

  clearModifierSelect(
    itemKey,
    "suffix"
  );


  renderSelectedModifiers(
    itemKey,
    "prefix"
  );

  renderSelectedModifiers(
    itemKey,
    "suffix"
  );
}


function clearModifierSelect(
  itemKey,
  modifierType
) {

  const select =
    getModifierSelect(
      itemKey,
      modifierType
    );


  if (!select) {
    return;
  }


  select.innerHTML = `
    <option value="">
      Select ${modifierType}...
    </option>
  `;


  select.disabled =
    true;

  renderModifierDropdown(
    itemKey,
    modifierType
  );
}


/*
 * ---------------------------------------------------------
 * DOM LOOKUPS
 * ---------------------------------------------------------
 */

function getModifierSelect(
  itemKey,
  modifierType
) {

  /*
   * Primary IDs expected by the current UI:
   *
   * item-a-prefix-select
   * item-a-suffix-select
   * item-b-prefix-select
   * item-b-suffix-select
   */

  return document.querySelector(
    `#item-${itemKey}-${modifierType}-select`
  );
}


function getModifierAddButton(
  itemKey,
  modifierType
) {

  return document.querySelector(
    `#item-${itemKey}-${modifierType}-add`
  );
}


function getModifierListElement(
  itemKey,
  modifierType
) {

  /*
   * Primary expected IDs:
   *
   * item-a-prefix-list
   * item-a-suffix-list
   * item-b-prefix-list
   * item-b-suffix-list
   */

  return document.querySelector(
    `#item-${itemKey}-${modifierType}-list`
  );
}


/*
 * ---------------------------------------------------------
 * MODIFIER NORMALIZATION
 * ---------------------------------------------------------
 */

export function normalizeSelectedModifier(
  mod
) {

  return {
    id:
      mod.id,

    name:
      mod.name ??
      mod.id,

    generationType:
      mod.generationType ??
      null,

    group:
      mod.group ??
      null,

    domain:
      mod.domain ??
      null,

    tags:
      Array.isArray(mod.tags)
        ? [...mod.tags]
        : [],

    stats:
      Array.isArray(mod.stats)
        ? structuredClone(
            mod.stats
          )
        : [],

    levels:
      Array.isArray(mod.levels)
        ? structuredClone(
            mod.levels
          )
        : [],

    weights:
      Array.isArray(mod.weights)
        ? structuredClone(
            mod.weights
          )
        : [],

    spawnWeights:
      Array.isArray(
        mod.spawnWeights
      )
        ? structuredClone(
            mod.spawnWeights
          )
        : [],

    requiredLevel:
      Number.isFinite(
        Number(
          mod.requiredLevel
        )
      )
        ? Number(
            mod.requiredLevel
          )
        : null
  };
}


function getModifierId(
  mod
) {

  if (
    typeof mod === "string"
  ) {

    return mod;
  }


  return mod?.id ??
    null;
}


/*
 * ---------------------------------------------------------
 * RUN
 * ---------------------------------------------------------
 */

function setupRunButton(
  database
) {

  const button =
    document.querySelector(
      "#run-simulation"
    );


  if (!button) {
    return;
  }


  button.addEventListener(
    "click",
    () => {

      const output =
        document.querySelector(
          "#simulation-output"
        );


      try {

        const invalidItem =
          [
            ["Item A", state.itemA.itemLevel],
            ["Item B", state.itemB.itemLevel]
          ].find(
            ([, itemLevel]) =>
              !Number.isInteger(itemLevel) ||
              itemLevel < 1 ||
              itemLevel > 100
          );

        if (invalidItem) {
          const [itemName, itemLevel] = invalidItem;

          output.className =
            "simulation-output error";

          output.textContent =
            `${itemName} has an invalid item level (${itemLevel}). ` +
            "Item level must be an integer from 1 to 100. " +
            "The recombinator simulator was not run.";

          return;
        }

        const result =
          recombine({
            itemA:
              state.itemA,

            itemB:
              state.itemB,

            database
          });


        output.className =
          "simulation-output success";


        output.innerHTML = `
          <div class="result-title">
            Recombination Result
          </div>

          <div>
            <strong>Base Type:</strong>
            ${escapeHtml(
              getBaseTypeName(
                result.baseType
              )
            )}
          </div>

          <div>
            <strong>Base:</strong>
            ${escapeHtml(
              result.base
            )}
          </div>

          <div>
            <strong>Item Level:</strong>
            ${escapeHtml(
              result.itemLevel
            )}
          </div>

          <div>
            <strong>Influence:</strong>
            ${
              result.influences?.length
                ? escapeHtml(
                    result.influences.join(
                      ", "
                    )
                  )
                : "None"
            }
          </div>

          <div class="result-section">

            <strong>
              Prefixes
            </strong>

            <pre>${escapeHtml(
              JSON.stringify(
                result.prefixes,
                null,
                2
              )
            )}</pre>

          </div>

          <div class="result-section">

            <strong>
              Suffixes
            </strong>

            <pre>${escapeHtml(
              JSON.stringify(
                result.suffixes,
                null,
                2
              )
            )}</pre>

          </div>
        `;

      } catch (error) {

        output.className =
          "simulation-output error";


        output.textContent =
          error?.message ??
          String(error);
      }
    }
  );
}


/*
 * ---------------------------------------------------------
 * STATUS
 * ---------------------------------------------------------
 */

function renderStatus() {

  const status =
    document.querySelector(
      "#base-type-status"
    );


  if (!status) {
    return;
  }


  if (!state.itemA.baseType) {

    status.textContent =
      "Select a base type for Item A.";

    status.className =
      "status";

    return;
  }


  if (!state.itemA.baseId) {

    status.textContent =
      "Select a base for Item A.";

    status.className =
      "status";

    return;
  }


  if (!state.itemB.baseId) {

    status.textContent =
      "Select a base for Item B.";

    status.className =
      "status";

    return;
  }


  status.textContent =
    "Item B is restricted to the same base type.";

  status.className =
    "status locked";
}


/*
 * ---------------------------------------------------------
 * HELPERS
 * ---------------------------------------------------------
 */

function getBaseTypeName(
  id
) {

  return (
    BASE_TYPES.find(
      type =>
        type.id === id
    )?.name ??
    id
  );
}


function escapeHtml(
  value
) {

  return String(
    value
  )
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );
}


/*
 * ---------------------------------------------------------
 * PUBLIC STATE ACCESS
 * ---------------------------------------------------------
 */

export function getState() {

  return structuredClone(
    state
  );
}
