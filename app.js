import {
  MODS,
  DEFAULT_ITEMS,
  MAX_PREFIXES,
  MAX_SUFFIXES,
  getMod,
  runSimulation,
  serializeConfig
} from "./simulator.js";


/* -------------------------------------------------------------
 * State
 * ------------------------------------------------------------- */

const state = {
  itemA: structuredClone(DEFAULT_ITEMS.a),
  itemB: structuredClone(DEFAULT_ITEMS.b),
  targetIds: []
};


/* -------------------------------------------------------------
 * DOM helpers
 * ------------------------------------------------------------- */

const $ = selector => document.querySelector(selector);

const $$ = selector =>
  [...document.querySelectorAll(selector)];


function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


/* -------------------------------------------------------------
 * Rendering items
 * ------------------------------------------------------------- */

function renderItem(side) {
  const item = state[`item${side.toUpperCase()}`];

  $(`#base-${side}`).value = item.base;
  $(`#item-${side}-name`).textContent = item.base;

  renderMods(side, "prefix");
  renderMods(side, "suffix");

  $(`#prefix-count-${side}`).textContent =
    `${item.prefixes.length} / ${MAX_PREFIXES}`;

  $(`#suffix-count-${side}`).textContent =
    `${item.suffixes.length} / ${MAX_SUFFIXES}`;
}


function renderMods(side, type) {
  const item = state[`item${side.toUpperCase()}`];
  const ids = type === "prefix"
    ? item.prefixes
    : item.suffixes;

  const container = $(`#${type}s-${side}`);

  if (ids.length === 0) {
    container.innerHTML = `
      <div class="no-mods">
        No ${type}s selected
      </div>
    `;

    return;
  }

  container.innerHTML = ids.map((id, index) => {
    const mod = getMod(id);

    if (!mod) {
      return "";
    }

    return `
      <div class="mod-row">
        <div class="mod-icon">${type === "prefix" ? "◆" : "◇"}</div>

        <select
          class="mod-select"
          data-side="${side}"
          data-type="${type}"
          data-index="${index}"
        >
          ${MODS
            .filter(candidate => candidate.type === type)
            .map(candidate => `
              <option
                value="${escapeHtml(candidate.id)}"
                ${candidate.id === id ? "selected" : ""}
              >
                ${escapeHtml(candidate.name)}
              </option>
            `)
            .join("")}
        </select>

        <button
          class="remove-mod"
          data-remove-mod="true"
          data-side="${side}"
          data-type="${type}"
          data-index="${index}"
          title="Remove modifier"
        >
          ×
        </button>
      </div>
    `;
  }).join("");
}


/* -------------------------------------------------------------
 * Event handlers
 * ------------------------------------------------------------- */

document.addEventListener("change", event => {
  const target = event.target;

  if (target.matches(".mod-select")) {
    const side = target.dataset.side;
    const type = target.dataset.type;
    const index = Number(target.dataset.index);

    const item = state[`item${side.toUpperCase()}`];
    const key = type === "prefix" ? "prefixes" : "suffixes";

    item[key][index] = target.value;

    renderItem(side);
    updateConfigPreview();
  }

  if (target.id === "base-a") {
    state.itemA.base = target.value;
    $("#item-a-name").textContent = target.value;
    updateConfigPreview();
  }

  if (target.id === "base-b") {
    state.itemB.base = target.value;
    $("#item-b-name").textContent = target.value;
    updateConfigPreview();
  }

  if (target.id === "target") {
    state.targetIds = target.value
      ? [target.value]
      : [];

    updateConfigPreview();
  }
});


document.addEventListener("click", event => {
  const addButton = event.target.closest("[data-add-mod]");

  if (addButton) {
    const side = addButton.dataset.addMod;
    const type = addButton.dataset.type;

    addModifier(side, type);

    return;
  }

  const removeButton = event.target.closest("[data-remove-mod]");

  if (removeButton) {
    const side = removeButton.dataset.side;
    const type = removeButton.dataset.type;
    const index = Number(removeButton.dataset.index);

    removeModifier(side, type, index);

    return;
  }

  const resetButton = event.target.closest("[data-reset-item]");

  if (resetButton) {
    resetItem(resetButton.dataset.resetItem);
  }
});


function addModifier(side, type) {
  const item = state[`item${side.toUpperCase()}`];

  const key = type === "prefix"
    ? "prefixes"
    : "suffixes";

  const maximum = type === "prefix"
    ? MAX_PREFIXES
    : MAX_SUFFIXES;

  if (item[key].length >= maximum) {
    return;
  }

  const used = new Set([
    ...item.prefixes,
    ...item.suffixes
  ]);

  const available = MODS.filter(
    mod => mod.type === type && !used.has(mod.id)
  );

  if (!available.length) {
    return;
  }

  item[key].push(available[0].id);

  renderItem(side);
  updateConfigPreview();
}


function removeModifier(side, type, index) {
  const item = state[`item${side.toUpperCase()}`];

  const key = type === "prefix"
    ? "prefixes"
    : "suffixes";

  item[key].splice(index, 1);

  renderItem(side);
  updateConfigPreview();
}


function resetItem(side) {
  state[`item${side.toUpperCase()}`] =
    structuredClone(DEFAULT_ITEMS[side]);

  renderItem(side);
  updateConfigPreview();
}


/* -------------------------------------------------------------
 * Target selector
 * ------------------------------------------------------------- */

function renderTargetOptions() {
  const target = $("#target");

  target.innerHTML = `
    <option value="">No target</option>

    <optgroup label="Prefixes">
      ${MODS
        .filter(mod => mod.type === "prefix")
        .map(mod => `
          <option value="${escapeHtml(mod.id)}">
            ${escapeHtml(mod.name)}
          </option>
        `)
        .join("")}
    </optgroup>

    <optgroup label="Suffixes">
      ${MODS
        .filter(mod => mod.type === "suffix")
        .map(mod => `
          <option value="${escapeHtml(mod.id)}">
            ${escapeHtml(mod.name)}
          </option>
        `)
        .join("")}
    </optgroup>
  `;
}


/* -------------------------------------------------------------
 * Simulation
 * ------------------------------------------------------------- */

$("#run-button").addEventListener("click", run);

function run() {
  const button = $("#run-button");

  const iterations = Number($("#iterations").value);

  let seed = Number($("#seed").value);

  if (!Number.isFinite(seed) || seed <= 0) {
    seed = randomSeed();
    $("#seed").value = seed;
  }

  button.disabled = true;
  button.innerHTML = `
    <span class="spinner"></span>
    RUNNING...
  `;

  /*
   * Give the browser a chance to paint the button state before
   * doing the CPU-heavy simulation.
   */
  setTimeout(() => {
    try {
      const result = runSimulation({
        itemA: state.itemA,
        itemB: state.itemB,
        iterations,
        seed,
        targetIds: state.targetIds
      });

      renderResults(result);
    } catch (error) {
      console.error(error);
      alert(`Simulation failed: ${error.message}`);
    } finally {
      button.disabled = false;
      button.innerHTML = `
        <span>▶</span>
        RUN SIMULATION
      `;
    }
  }, 30);
}


function randomSeed() {
  if (window.crypto?.getRandomValues) {
    const buffer = new Uint32Array(1);

    window.crypto.getRandomValues(buffer);

    return buffer[0] || 1;
  }

  return Math.floor(Math.random() * 0xFFFFFFFF) || 1;
}


/* -------------------------------------------------------------
 * Results
 * ------------------------------------------------------------- */

function renderResults(result) {
  $("#stat-simulations").textContent =
    result.iterations.toLocaleString();

  $("#stat-hits").textContent =
    result.targetProbability === null
      ? "—"
      : result.targetHits.toLocaleString();

  $("#stat-chance").textContent =
    result.targetProbability === null
      ? "—"
      : formatPercent(result.targetProbability);

  $("#stat-average").textContent =
    result.averageMods.toFixed(2);

  $("#result-seed").textContent =
    `SEED ${result.seed}`;

  renderDistribution(result);
  renderSurvival(result);
  renderExamples(result);

  $("#results-section").scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}


function formatPercent(value) {
  const percentage = value * 100;

  if (percentage === 0) {
    return "0%";
  }

  if (percentage < 0.01) {
    return "<0.01%";
  }

  if (percentage < 1) {
    return `${percentage.toFixed(2)}%`;
  }

  return `${percentage.toFixed(1)}%`;
}


function renderDistribution(result) {
  const container = $("#mod-distribution");

  const values = result.modCountDistribution;

  if (!values.length) {
    container.innerHTML =
      `<div class="empty-state">No results.</div>`;

    return;
  }

  const maximum = Math.max(
    ...values.map(([, count]) => count)
  );

  container.innerHTML = values.map(([mods, count]) => {
    const width = (count / maximum) * 100;

    return `
      <div class="bar-row">
        <div class="bar-label">${mods} mods</div>

        <div class="bar-track">
          <div
            class="bar-fill"
            style="width: ${width}%"
          ></div>
        </div>

        <div class="bar-value">
          ${formatPercent(count / result.iterations)}
        </div>
      </div>
    `;
  }).join("");
}


function renderSurvival(result) {
  const container = $("#mod-survival");

  if (!result.survival.length) {
    container.innerHTML =
      `<div class="empty-state">No modifiers.</div>`;

    return;
  }

  container.innerHTML = result.survival.map(stat => {
    const mod = getMod(stat.id);

    if (!mod) {
      return "";
    }

    return `
      <div class="survival-row">
        <div class="survival-name">
          <span class="${mod.type}">
            ${mod.type === "prefix" ? "◆" : "◇"}
          </span>
          ${escapeHtml(mod.name)}
        </div>

        <div class="survival-track">
          <div
            class="survival-fill ${mod.type}"
            style="width: ${stat.probability * 100}%"
          ></div>
        </div>

        <div class="survival-value">
          ${formatPercent(stat.probability)}
        </div>
      </div>
    `;
  }).join("");
}


function renderExamples(result) {
  const tbody = $("#example-results");

  tbody.innerHTML = result.examples.map(example => {
    const prefixes = example.result.prefixes
      .map(id => getMod(id)?.name)
      .filter(Boolean);

    const suffixes = example.result.suffixes
      .map(id => getMod(id)?.name)
      .filter(Boolean);

    const all = [
      ...prefixes,
      ...suffixes
    ];

    return `
      <tr>
        <td class="number-cell">
          ${example.index.toLocaleString()}
        </td>

        <td>
          ${renderModPills(prefixes, "prefix")}
        </td>

        <td>
          ${renderModPills(suffixes, "suffix")}
        </td>

        <td>
          ${all.length}
          <span class="muted">mod${all.length === 1 ? "" : "s"}</span>
        </td>

        <td>
          ${
            example.targetHit
              ? '<span class="hit">✓ HIT</span>'
              : '<span class="miss">—</span>'
          }
        </td>
      </tr>
    `;
  }).join("");
}


function renderModPills(mods, type) {
  if (!mods.length) {
    return `<span class="muted">—</span>`;
  }

  return mods.map(name => `
    <span class="mod-pill ${type}">
      ${escapeHtml(name)}
    </span>
  `).join("");
}


/* -------------------------------------------------------------
 * Config sharing
 * ------------------------------------------------------------- */

function getCurrentConfig() {
  return {
    itemA: state.itemA,
    itemB: state.itemB,
    iterations: Number($("#iterations").value),
    seed: Number($("#seed").value) || null,
    targetIds: state.targetIds
  };
}


function updateConfigPreview() {
  $("#config-output").value =
    serializeConfig(getCurrentConfig());
}


$("#copy-config").addEventListener("click", async () => {
  const text = serializeConfig(getCurrentConfig());

  try {
    await navigator.clipboard.writeText(text);

    const button = $("#copy-config");
    const original = button.textContent;

    button.textContent = "COPIED!";

    setTimeout(() => {
      button.textContent = original;
    }, 1200);
  } catch {
    $("#config-output").focus();
    $("#config-output").select();

    alert(
      "Your browser blocked clipboard access. " +
      "The configuration has been selected so you can copy it manually."
    );
  }
});


/* -------------------------------------------------------------
 * Load example
 * ------------------------------------------------------------- */

$("#load-example").addEventListener("click", () => {
  state.itemA = structuredClone(DEFAULT_ITEMS.a);
  state.itemB = structuredClone(DEFAULT_ITEMS.b);

  state.targetIds = ["gem_levels"];

  $("#target").value = "gem_levels";
  $("#iterations").value = "10000";
  $("#seed").value = "123456789";

  renderItem("a");
  renderItem("b");
  updateConfigPreview();
});


/* -------------------------------------------------------------
 * Keyboard shortcut
 * ------------------------------------------------------------- */

document.addEventListener("keydown", event => {
  if (
    event.ctrlKey &&
    event.key === "Enter"
  ) {
    run();
  }
});


/* -------------------------------------------------------------
 * Initial render
 * ------------------------------------------------------------- */

renderTargetOptions();

renderItem("a");
renderItem("b");

updateConfigPreview();
