/**
 * WoD5e Actor Item Creator
 * init.js — Gemeinsame Helfer, API-Export, ready-Hook
 *
 * Dieses Script wird VOR item-creator.js und actor-creator.js geladen
 * (Reihenfolge in module.json: ["init.js", "item-creator.js", "actor-creator.js"]).
 */

// ── Globale i18n-Helfer (einmalig definiert, von beiden Scripts genutzt) ──
globalThis.L   = (key)       => game.i18n.localize(key);
globalThis.LW  = (key)       => game.i18n.localize(`WODIC.${key}`);
globalThis.LSP = (key)       => game.i18n.localize(`WODIC.SPC.${key}`);

// ── ready-Hook: API exportieren, Systemprüfung ────────────────────────────
Hooks.once("ready", () => {
  if (game.system.id !== "wod5e") {
    console.warn("[wod5e-actor-item-creator] Falsches System – Modul inaktiv.");
    return;
  }

  const mod = game.modules.get("wod5e-actor-item-creator");
  if (!mod) {
    console.error("[wod5e-actor-item-creator] Modul nicht gefunden – API-Export übersprungen.");
    return;
  }

  // Check if classes are available (with retry logic for timing issues)
  if (typeof globalThis.WodItemCreator === "undefined" || typeof globalThis.WodSpcCreator === "undefined") {
    // Give classes a moment to be available if there's any loading lag
    setTimeout(() => {
      if (typeof globalThis.WodItemCreator === "undefined" || typeof globalThis.WodSpcCreator === "undefined") {
        console.error("[wod5e-actor-item-creator] Classes not yet defined after delay. Check if item-creator.js and actor-creator.js are loading.");
        return;
      }
      exportAPI();
    }, 100);
  } else {
    exportAPI();
  }

  function exportAPI() {
    mod.api = {
      WodItemCreator: globalThis.WodItemCreator,
      WodSpcCreator: globalThis.WodSpcCreator,
      openItemCreator:  () => globalThis.WodItemCreator?.run?.(),
      openActorCreator: () => globalThis.WodSpcCreator?.run?.(),
    };

    console.log(`[wod5e-actor-item-creator] v${mod.version} bereit. API: game.modules.get("wod5e-actor-item-creator").api`);
  }
});
