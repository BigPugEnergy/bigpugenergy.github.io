import "./style.css";
import { DATABASE } from "./data/generated/database.js";
import { initializeUI } from "./ui.js";

document.addEventListener("DOMContentLoaded", () => {
  initializeUI({ database: DATABASE });
});
