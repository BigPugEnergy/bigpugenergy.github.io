import {
  BASE_TYPES,
  BASES,
  BASES_BY_TYPE
} from "./data/generated/bases.js";

import {
  createEmptyItem,
  recombine
} from "./simulator.js";


const state = {
  itemA:
    createEmptyItem(),

  itemB:
    createEmptyItem()
};


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

  populateBaseTypeSelect(
    document.querySelector(
      "#item-b-base-type"
    )
  );


  setupItemATypeSelector();

  setupBaseSelectors();

  setupItemLevelInputs();

  setupInfluenceSelectors();

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

  select.innerHTML = `
    <option value="">
      Select base type...
    </option>
  `;

  for (
    const baseType of
    BASE_TYPES
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


function setupItemATypeSelector() {

  const select =
    document.querySelector(
      "#item-a-base-type"
    );

  select.addEventListener(
    "change",
    () => {

      const type =
        select.value;

      state.itemA.baseType =
        type || null;

      state.itemA.baseId =
        null;

      state.itemB.baseType =
        type || null;

      state.itemB.baseId =
        null;


      /*
       * Item B category is now controlled
       * by Item A.
       */
      const itemBType =
        document.querySelector(
          "#item-b-base-type"
        );

      itemBType.value =
        type;

      itemBType.disabled =
        Boolean(type);


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


  baseA.addEventListener(
    "change",
    () => {

      state.itemA.baseId =
        baseA.value || null;

      renderStatus();
    }
  );


  baseB.addEventListener(
    "change",
    () => {

      state.itemB.baseId =
        baseB.value || null;

      renderStatus();
    }
  );
}


function populateBaseSelector(
  select,
  baseType
) {

  select.innerHTML = `
    <option value="">
      Select base...
    </option>
  `;


  if (!baseType) {
    select.disabled = true;
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


  inputA.addEventListener(
    "input",
    () => {

      state.itemA.itemLevel =
        clampItemLevel(
          inputA.value
        );
    }
  );


  inputB.addEventListener(
    "input",
    () => {

      state.itemB.itemLevel =
        clampItemLevel(
          inputB.value
        );
    }
  );
}


function clampItemLevel(
  value
) {

  const number =
    Number(value);

  if (!Number.isFinite(number)) {
    return 1;
  }

  return Math.max(
    1,
    Math.min(
      100,
      Math.floor(number)
    )
  );
}


/*
 * ---------------------------------------------------------
 * INFLUENCE
 * ---------------------------------------------------------
 */

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
  }
];


function setupInfluenceSelectors() {

  const selectA =
    document.querySelector(
      "#item-a-influence"
    );

  const selectB =
    document.querySelector(
      "#item-b-influence"
    );


  populateInfluenceSelect(
    selectA
  );

  populateInfluenceSelect(
    selectB
  );


  selectA.addEventListener(
    "change",
    () => {

      state.itemA.influences =
        selectA.value
          ? [selectA.value]
          : [];
    }
  );


  selectB.addEventListener(
    "change",
    () => {

      state.itemB.influences =
        selectB.value
          ? [selectB.value]
          : [];
    }
  );
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
    const influence of
    INFLUENCES
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

  button.addEventListener(
    "click",
    () => {

      const output =
        document.querySelector(
          "#simulation-output"
        );

      try {

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
            ${result.itemLevel}
          </div>

          <div>
            <strong>Influence:</strong>
            ${
              result.influences.length
                ? result.influences.join(", ")
                : "None"
            }
          </div>

          <div class="result-section">
            <strong>Prefixes</strong>
            <pre>${escapeHtml(
              JSON.stringify(
                result.prefixes,
                null,
                2
              )
            )}</pre>
          </div>

          <div class="result-section">
            <strong>Suffixes</strong>
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
          error.message;
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

  if (!state.itemA.baseType) {

    status.textContent =
      "Select a base type for Item A.";

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
      type => type.id === id
    )?.name ??
    id
  );
}


function escapeHtml(
  value
) {

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


export function getState() {
  return structuredClone(state);
}
