/**
 * WoD5e Actor Item Creator
 * Script 1/2: item-creator.js — Gift & Rite Item Creator
 *
 * i18n: alle Texte über L() / LW(). Schlüssel ohne Punkt-Kollisionen.
 * API-Export: game.modules.get("wod5e-actor-item-creator").api.WodItemCreator
 */

// Modul-lokale Helfer (kein Namenskonflikt mit actor-creator.js,
// da ES-Module eigene Scopes haben)
const L  = (key) => game.i18n.localize(key);
const LW = (key) => game.i18n.localize(`WODIC.${key}`);

// ═══════════════════════════════════════════════════════════════════════════
// WodItemCreator — Gift & Rite Item Creator
// ═══════════════════════════════════════════════════════════════════════════
class WodItemCreator {

  // ── WOD5E-Listen ──────────────────────────────────────────────────────────
  static displayTypes() {
    return [
      { value: "gift", label: L("WOD5E.WTA.Gift") },
      { value: "rite", label: L("WOD5E.WTA.Rite") },
    ];
  }

  static giftTypes() {
    const raw = WOD5E.Gifts.getList({});
    return Object.entries(raw)
      .filter(([k, v]) => k !== "rite" && !v.hidden)
      .map(([k, v]) => ({ value: k, label: v.displayName ?? v.label ?? k }));
  }

  static riteTypes() {
    const raw  = WOD5E.Gifts.getList({});
    const rite = raw["rite"];
    return [{ value: "rite", label: rite?.displayName ?? rite?.label ?? L("WOD5E.WTA.Rite") }];
  }

  static renownTypes() {
    const raw = WOD5E.Renown.getList({});
    return Object.entries(raw)
      .filter(([, v]) => !v.hidden)
      .map(([k, v]) => ({ value: k, label: v.displayName ?? v.label ?? k }));
  }

  // ── Würfelpool-Optionen ───────────────────────────────────────────────────
  static poolOptions() {
    const opts         = [];
    const renownPrefix = L("WOD5E.WTA.Renown");

    try {
      const attrs = WOD5E.Attributes.getList({ useValuePaths: true });
      for (const [, v] of Object.entries(attrs)) {
        if (v.hidden) continue;
        opts.push({ value: v.path, label: v.displayName ?? v.label ?? v.path });
      }
    } catch {}

    try {
      const renowns = WOD5E.Renown.getList({});
      for (const [, v] of Object.entries(renowns)) {
        if (v.hidden) continue;
        const path = v.path.replace(/^system\./, "").replace(/\.value$/, "");
        opts.push({ value: path, label: `${renownPrefix}: ${v.displayName ?? v.label}` });
      }
    } catch {
      for (const [k, lbl] of [
        ["renown.glory",  L("WOD5E.WTA.Glory")],
        ["renown.honor",  L("WOD5E.WTA.Honor")],
        ["renown.wisdom", L("WOD5E.WTA.Wisdom")],
      ]) opts.push({ value: k, label: `${renownPrefix}: ${lbl}` });
    }

    try {
      const skills = WOD5E.Skills.getList({ useValuePaths: true });
      for (const [, v] of Object.entries(skills)) {
        if (v.hidden) continue;
        opts.push({ value: v.path, label: v.displayName ?? v.label ?? v.path });
      }
    } catch {}

    return opts;
  }

  // ── Attribut-Map: lokalisierter Begriff → Systempfad ─────────────────────
  static buildAttrMap() {
    const map = {};

    try {
      const renowns = WOD5E.Renown.getList({});
      for (const [k, v] of Object.entries(renowns)) {
        const path = v.path.replace(/^system\./, "").replace(/\.value$/, "");
        map[k.toLowerCase()] = path;
        if (v.label)       map[v.label.toLowerCase()]       = path;
        if (v.displayName) map[v.displayName.toLowerCase()] = path;
      }
    } catch {
      Object.assign(map, { glory:"renown.glory", honor:"renown.honor", wisdom:"renown.wisdom" });
    }
    map["ruhm"]     ??= "renown.glory";
    map["ehre"]     ??= "renown.honor";
    map["weisheit"] ??= "renown.wisdom";

    try {
      const attrs = WOD5E.Attributes.getList({ useValuePaths: true });
      for (const [k, v] of Object.entries(attrs)) {
        if (v.hidden) continue;
        map[k.toLowerCase()] = v.path;
        if (v.label)       map[v.label.toLowerCase()]       = v.path;
        if (v.displayName) map[v.displayName.toLowerCase()] = v.path;
      }
    } catch {
      Object.assign(map, {
        strength:"attributes.strength", dexterity:"attributes.dexterity",
        stamina:"attributes.stamina",   charisma:"attributes.charisma",
        manipulation:"attributes.manipulation", composure:"attributes.composure",
        intelligence:"attributes.intelligence", wits:"attributes.wits",
        resolve:"attributes.resolve",
      });
    }

    try {
      const skills = WOD5E.Skills.getList({ useValuePaths: true });
      for (const [k, v] of Object.entries(skills)) {
        if (v.hidden) continue;
        map[k.toLowerCase()] = v.path;
        if (v.label)       map[v.label.toLowerCase()]       = v.path;
        if (v.displayName) map[v.displayName.toLowerCase()] = v.path;
        if (k === "animalken") map["animal ken"] = v.path;
        if (k === "craft")     map["crafts"]     = v.path;
      }
    } catch {
      Object.assign(map, {
        athletics:"skills.athletics", brawl:"skills.brawl", craft:"skills.craft",
        crafts:"skills.craft", drive:"skills.drive", firearms:"skills.firearms",
        melee:"skills.melee", stealth:"skills.stealth", survival:"skills.survival",
        animalken:"skills.animalken", "animal ken":"skills.animalken",
        etiquette:"skills.etiquette", insight:"skills.insight",
        intimidation:"skills.intimidation", leadership:"skills.leadership",
        performance:"skills.performance", persuasion:"skills.persuasion",
        streetwise:"skills.streetwise", subterfuge:"skills.subterfuge",
        academics:"skills.academics", awareness:"skills.awareness",
        finance:"skills.finance", investigation:"skills.investigation",
        medicine:"skills.medicine", occult:"skills.occult", politics:"skills.politics",
        science:"skills.science", technology:"skills.technology", larceny:"skills.larceny",
      });
    }

    return map;
  }

  // ── Pool-String → Pfad-Array ──────────────────────────────────────────────
  static parsePoolString(raw, attrMap) {
    if (!raw) return [];
    const left  = raw.split(/\s+vs\.?\s+/i)[0];
    const parts = left.split(/\s*\+\s*/);
    const out   = [];
    for (const part of parts) {
      const key   = part.trim().toLowerCase().replace(/\s+/g, " ");
      const match = Object.keys(attrMap)
        .filter(k => key === k || key.startsWith(k))
        .sort((a, b) => b.length - a.length)[0];
      if (match) out.push({ path: attrMap[match] });
    }
    return out;
  }

  // ── Gift/Rite Textblock → strukturiertes Objekt ───────────────────────────
  static parseBlock(raw, attrMap) {
    const result = {
      itemName: "", giftType: "native", renown: "glory",
      level: 1, cost: 0, willpowercost: 0,
      sourceBook: "", sourcePage: "", pool: [], description: "",
      isRite: false, poolExplicit: false,
    };
    if (!raw.trim()) return result;

    const lines    = raw.split("\n").map(l => l.trim()).filter(Boolean);
    const fieldPfx = /^(renown|ruf|cost|kosten|action|aktion|pool|würfelvorrat|wuerfelvorrat|system|duration|dauer|source|quelle|page|seite)\s*[:：]/i;

    for (const line of lines) {
      if (!fieldPfx.test(line)) {
        result.itemName = line.replace(/^[-–—*#]+\s*/, "").trim();
        break;
      }
    }

    // Renown-Map dynamisch aus System + Fallbacks
    const renownMap = { glory:"glory", honor:"honor", wisdom:"wisdom", ruhm:"glory", ehre:"honor", weisheit:"wisdom" };
    try {
      for (const [k, v] of Object.entries(WOD5E.Renown.getList({}))) {
        if (v.label)       renownMap[v.label.toLowerCase()]       = k;
        if (v.displayName) renownMap[v.displayName.toLowerCase()] = k;
      }
    } catch {}

    // Lokalisierte Label-Strings für Beschreibungsfelder
    const lRenown   = LW("Parse.Renown");
    const lCost     = LW("Parse.Cost");
    const lPool     = LW("Parse.Pool");
    const lAction   = LW("Parse.Action");
    const lDuration = LW("Parse.Duration");
    const lSystem   = LW("Parse.System");
    const lSource   = LW("Parse.Source");
    const lPage     = LW("Parse.Page");

    const descLines    = [];
    let   systemSection = false;

    for (const line of lines) {
      if (line === result.itemName) continue;

      if (/^(renown|ruf)\s*[:：]/i.test(line)) {
        const v2    = line.replace(/^(?:renown|ruf)\s*[:：]\s*/i, "").trim().toLowerCase();
        const found = Object.keys(renownMap).find(k => v2.startsWith(k) || v2.includes(k));
        result.renown = found ? renownMap[found] : "glory";
        descLines.push(`<strong>${lRenown}:</strong> ${line.replace(/^(?:renown|ruf)\s*[:：]\s*/i, "").trim()}`);
        systemSection = false; continue;
      }
      if (/^(cost|kosten)\s*[:：]/i.test(line)) {
        const val = line.replace(/^(?:cost|kosten)\s*[:：]\s*/i, "").trim();
        const num = parseInt((val.match(/(\d+)/) || [])[1]) || 1;
        if (/willpower|willenskraft/i.test(val)) { result.willpowercost = num; result.cost = 0; }
        else                                      { result.cost = num; result.willpowercost = 0; }
        descLines.push(`<strong>${lCost}:</strong> ${val}`);
        systemSection = false; continue;
      }
      if (/^(pool|würfelvorrat|wuerfelvorrat)\s*[:：]/i.test(line)) {
        result.poolExplicit = true;
        const pv = line.replace(/^(?:pool|würfelvorrat|wuerfelvorrat)\s*[:：]\s*/i, "").trim();
        if (!/^[-–—]+$/.test(pv) && pv !== "") result.pool = WodItemCreator.parsePoolString(pv, attrMap);
        descLines.push(`<strong>${lPool}:</strong> ${pv || "—"}`);
        systemSection = false; continue;
      }
      if (/^(action|aktion)\s*[:：]/i.test(line)) {
        descLines.push(`<strong>${lAction}:</strong> ${line.replace(/^(?:action|aktion)\s*[:：]\s*/i, "").trim()}`);
        systemSection = false; continue;
      }
      if (/^(duration|dauer)\s*[:：]/i.test(line)) {
        descLines.push(`<strong>${lDuration}:</strong> ${line.replace(/^(?:duration|dauer)\s*[:：]\s*/i, "").trim()}`);
        systemSection = false; continue;
      }
      if (/^system\s*[:：]/i.test(line)) {
        systemSection = true;
        const rest = line.replace(/^system\s*[:：]\s*/i, "").trim();
        if (rest) descLines.push(`<strong>${lSystem}:</strong> ${rest}`);
        continue;
      }
      if (systemSection) { descLines.push(line); continue; }
      if (/^(source|quelle)\s*[:：]/i.test(line)) {
        result.sourceBook = line.replace(/^(?:source|quelle)\s*[:：]\s*/i, "").trim();
        descLines.push(`<strong>${lSource}:</strong> ${result.sourceBook}`);
        systemSection = false; continue;
      }
      if (/^(page|seite)\s*[:：]/i.test(line)) {
        result.sourcePage = line.replace(/^(?:page|seite)\s*[:：]\s*/i, "").trim();
        descLines.push(`<strong>${lPage}:</strong> ${result.sourcePage}`);
        systemSection = false; continue;
      }
      if (/^\(.*p\.\s*\d+/i.test(line)) {
        const m = line.match(/p\.\s*(\d+)/i);
        if (m && !result.sourcePage) result.sourcePage = m[1];
        descLines.push(line); continue;
      }
      descLines.push(line);
    }

    if (descLines.length) result.description = descLines.map(l => `<p>${l}</p>`).join("");
    if (!result.poolExplicit && !result.pool.length) result.pool = [
      { path: "attributes.strength" }, { path: "renown.glory" },
    ];
    return result;
  }

  // ── HTML-Escape für Nutzereingaben in innerHTML ───────────────────────────
  static esc(v) {
    return String(v ?? "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // ── HTML-Hilfsmethoden ─────────────────────────────────────────────────────
  static optHtml(arr, selectedVal) {
    return arr.map(o =>
      `<option value="${o.value}" ${o.value === selectedVal ? "selected" : ""}>${o.label}</option>`
    ).join("");
  }

  static poolOptHtml(selectedVal) {
    return WodItemCreator.poolOptions().map(o =>
      `<option value="${o.value}" ${o.value === selectedVal ? "selected" : ""}>${o.label}</option>`
    ).join("");
  }

  static poolEntryLabel(idx) { return `${LW("Pool.Entry")} ${idx + 1}`; }

  static buildPoolRowHTML(idx, pathValue) {
    return `
      <div class="pool-row" data-pool-row="${idx}">
        <div>
          <label>${WodItemCreator.poolEntryLabel(idx)}</label>
          <select name="pool_path_${idx}">${WodItemCreator.poolOptHtml(pathValue)}</select>
        </div>
        <div style="display:flex;align-items:flex-end;">
          <button type="button" data-remove-row="${idx}" style="margin-top:20px;width:100%;">✕</button>
        </div>
      </div>`;
  }

  static renderPoolRows(pool) {
    return pool.map((e, i) => WodItemCreator.buildPoolRowHTML(i, e.path)).join("");
  }

  static renumberPoolRows(containerEl) {
    containerEl.querySelectorAll("[data-pool-row]").forEach((row, i) => {
      row.setAttribute("data-pool-row", i);
      const sel = row.querySelector("select"); if (sel) sel.name = `pool_path_${i}`;
      const lbl = row.querySelector("label");  if (lbl) lbl.textContent = WodItemCreator.poolEntryLabel(i);
      const btn = row.querySelector("[data-remove-row]");
      if (btn) btn.setAttribute("data-remove-row", i);
    });
  }

  static attachPoolListeners(containerEl) {
    containerEl.addEventListener("click", (ev) => {
      const btn = ev.target.closest("[data-remove-row]");
      if (!btn) return;
      btn.closest("[data-pool-row]")?.remove();
      WodItemCreator.renumberPoolRows(containerEl);
    });
    containerEl.parentElement?.querySelector("#wod-ic-add-pool")
      ?.addEventListener("click", () => {
        const idx       = containerEl.querySelectorAll("[data-pool-row]").length;
        const firstPath = (() => {
          try { return Object.values(WOD5E.Attributes.getList({ useValuePaths: true })).find(v => !v.hidden)?.path ?? "attributes.strength"; }
          catch { return "attributes.strength"; }
        })();
        const div = document.createElement("div");
        div.innerHTML = WodItemCreator.buildPoolRowHTML(idx, firstPath);
        containerEl.appendChild(div.firstElementChild);
      });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // run() — Haupt-Einstiegspunkt
  // ═══════════════════════════════════════════════════════════════════════════
  static async run() {
    const AppV2    = foundry.applications.api.ApplicationV2;
    const ATTR_MAP = WodItemCreator.buildAttrMap();

    const state = {
      mode: "text", rawText: "",
      parsed: WodItemCreator.parseBlock("", ATTR_MAP),
      d1: null, d2: null, d3: null,
    };

    function showStep(step, idx) {
      return new Promise((resolve) => {
        const showBack  = idx > 0;
        const nextLabel = step.nextLabel ?? LW("Btn.Next");
        const bodyHtml  = step.html(state);

        class StepDialog extends AppV2 {
          static DEFAULT_OPTIONS = {
            id: `wod-ic-step-${Date.now()}`,
            tag: "div",
            window: { title: step.title, resizable: true },
            position: { width: 640 },
          };

          async _renderHTML(_ctx, _opt) {
            const wrap = document.createElement("div");
            wrap.innerHTML = `
              <div class="wod-ic" style="padding:0 2px;">${bodyHtml}</div>
              <div class="wod-ic footer">
                <div>
                  ${showBack ? `<button type="button" id="wod-ic-back" style="min-width:90px;">${LW("Btn.Back")}</button>` : ""}
                </div>
                <div style="display:flex;gap:8px;">
                  <button type="button" id="wod-ic-cancel" style="min-width:90px;">${LW("Btn.Cancel")}</button>
                  <button type="button" id="wod-ic-next" style="min-width:140px;font-weight:bold;">${nextLabel}</button>
                </div>
              </div>`;
            return wrap;
          }

          _replaceHTML(result, content, _opt) {
            content.replaceChildren(result);
            if (step.postRender) step.postRender(content);
            content.querySelector("#wod-ic-next")?.addEventListener("click", () => {
              const snap = $(this.element); this.close({ animate: false }); resolve({ html: snap, action: "next" });
            });
            content.querySelector("#wod-ic-back")?.addEventListener("click", () => {
              this.close({ animate: false }); resolve({ html: null, action: "back" });
            });
            content.querySelector("#wod-ic-cancel")?.addEventListener("click", () => {
              this.close({ animate: false }); resolve({ html: null, action: "cancel" });
            });
          }

          _onClose(_opt) { resolve({ html: null, action: "cancel" }); }
        }

        new StepDialog().render(true);
      });
    }

    const STEPS = [

      // 0: Eingabemodus
      {
        title: `${L("WOD5E.WTA.GiftsandRites")} — ${LW("Step.ModeTitle")}`,
        html: (s) => `
          <h3>${LW("Step.ModeTitle")}</h3>
          <div class="wod-ic cb-row" style="margin-top:12px;">
            <input type="radio" name="mode" id="wod-ic-mode-text" value="text" ${s.mode === "text" ? "checked" : ""} />
            <label for="wod-ic-mode-text"><strong>${LW("Mode.Text")}</strong> — ${LW("Mode.TextHint")}</label>
          </div>
          <div class="wod-ic cb-row" style="margin-top:6px;">
            <input type="radio" name="mode" id="wod-ic-mode-manual" value="manual" ${s.mode === "manual" ? "checked" : ""} />
            <label for="wod-ic-mode-manual"><strong>${LW("Mode.Manual")}</strong> — ${LW("Mode.ManualHint")}</label>
          </div>`,
        collect: (html, s) => { s.mode = html.find('[name="mode"]:checked').val() || "text"; },
        postRender: null,
      },

      // 1: Textblock
      {
        title: `${L("WOD5E.WTA.GiftsandRites")} — ${LW("Step.TextTitle")}`,
        nextLabel: LW("Btn.Submit"),
        skip: (s) => s.mode !== "text",
        html: (s) => `
          <p class="wod-ic hint">${LW("TextHint.Intro")}</p>
          <p class="wod-ic hint">
            ${LW("TextHint.Fields")}<br>
            <code>Renown / ${LW("Parse.Renown")}: Honor / ${L("WOD5E.WTA.Honor")}</code><br>
            <code>${LW("Parse.Cost")}: 1</code> &nbsp;·&nbsp;
            <code>${LW("Parse.Cost")}: 1 Willpower / Willenskraft</code><br>
            <code>Pool / ${LW("Parse.Pool")}: Composure + Honor</code><br>
            <code>Pool / ${LW("Parse.Pool")}: Strength + Glory vs Resolve + Insight</code><br>
            <code>Pool / ${LW("Parse.Pool")}: —</code> ${LW("TextHint.PoolDash")}<br>
            <code>${LW("Parse.System")}: …</code> &nbsp;·&nbsp;
            <code>Duration / ${LW("Parse.Duration")}: …</code>
          </p>
          <label class="wod-ic">${L("WOD5E.WTA.GiftsandRites")}</label>
          <textarea class="wod-ic" name="rawtext" rows="14"
            style="font-family:monospace;font-size:0.82em;"
            placeholder="${LW("TextHint.Placeholder")}">${s.rawText}</textarea>`,
        collect: (html, s) => {
          s.rawText = html.find('[name="rawtext"]').val() || "";
          if (!s.rawText.trim()) { ui.notifications.error(LW("Notify.NoText")); return false; }
          s.parsed = WodItemCreator.parseBlock(s.rawText, ATTR_MAP);
        },
        postRender: null,
      },

      // 2: Grunddaten 1/3
      {
        title: `${L("WOD5E.WTA.GiftsandRites")} — ${LW("Step.BasicsTitle")}`,
        html: (s) => {
          const p = s.parsed, d = s.d1 ?? {};
          const displayType   = d.displayType   ?? (p.isRite ? "rite" : "gift");
          const itemName      = d.itemName      ?? p.itemName      ?? "";
          const giftType      = d.giftType      ?? p.giftType      ?? "native";
          const riteGiftType  = (d.isRite ? d.giftType : null)     ?? "rite";
          const renown        = d.renown        ?? p.renown        ?? "glory";
          const level         = d.level         ?? p.level         ?? 1;
          const cost          = d.cost          ?? p.cost          ?? 0;
          const willpowercost = d.willpowercost ?? p.willpowercost ?? 0;
          const sourceBook    = d.sourceBook    ?? p.sourceBook    ?? "";
          const sourcePage    = d.sourcePage    ?? p.sourcePage    ?? "";

          return `
            <h3 class="wod-ic">${LW("Field.TypeAndName")}</h3>
            <div class="wod-ic g2">
              <div>
                <label>${LW("Field.Type")}</label>
                <select name="displayType" id="wod-ic-displaytype">
                  ${WodItemCreator.optHtml(WodItemCreator.displayTypes(), displayType)}
                </select>
              </div>
              <div>
                <label>${LW("Field.Name")}</label>
                <input type="text" name="itemName" value="${itemName}"
                  placeholder="${L("WOD5E.WTA.NewGift")}" />
              </div>
            </div>
            <input type="hidden" name="giftType_hidden"     value="${giftType}" />
            <input type="hidden" name="renown_hidden"       value="${renown}" />
            <input type="hidden" name="riteGiftType_hidden" value="${riteGiftType}" />
            <input type="hidden" name="riteRenown_hidden"   value="${renown}" />
            <div id="wod-ic-gift-section">
              <h3 class="wod-ic">${LW("Field.GiftSection")}</h3>
              <div class="wod-ic g3">
                <div><label>${LW("Field.GiftType")}</label>
                  <select id="wod-ic-giftType" name="giftType">
                    ${WodItemCreator.optHtml(WodItemCreator.giftTypes(), giftType)}
                  </select>
                </div>
                <div><label>${LW("Field.Renown")}</label>
                  <select id="wod-ic-renown" name="renown">
                    ${WodItemCreator.optHtml(WodItemCreator.renownTypes(), renown)}
                  </select>
                </div>
                <div><label>${LW("Field.Level")}</label>
                  <input type="number" name="level" value="${level}" min="1" max="5" />
                </div>
              </div>
            </div>
            <div id="wod-ic-rite-section" style="display:none;">
              <h3 class="wod-ic">${LW("Field.RiteSection")}</h3>
              <div class="wod-ic g2">
                <div><label>${LW("Field.RiteType")}</label>
                  <select id="wod-ic-riteGiftType" name="riteGiftType">
                    ${WodItemCreator.optHtml(WodItemCreator.riteTypes(), riteGiftType)}
                  </select>
                </div>
                <div><label>${LW("Field.Renown")}</label>
                  <select id="wod-ic-riteRenown" name="riteRenown">
                    ${WodItemCreator.optHtml(WodItemCreator.renownTypes(), renown)}
                  </select>
                </div>
              </div>
            </div>
            <h3 class="wod-ic">${LW("Field.Cost")}</h3>
            <div class="wod-ic g2">
              <div><label>${LW("Field.RageCost")}</label>
                <input type="number" name="cost" value="${cost}" min="0" max="5" />
              </div>
              <div><label>${LW("Field.WillpowerCost")}</label>
                <input type="number" name="willpowercost" value="${willpowercost}" min="0" max="5" />
              </div>
            </div>
            <h3 class="wod-ic">${LW("Field.Source")}</h3>
            <div class="wod-ic g2">
              <div><label>${LW("Field.Book")}</label>
                <input type="text" name="sourceBook" value="${sourceBook}"
                  placeholder="${LW("Field.BookPlaceholder")}" />
              </div>
              <div><label>${LW("Field.Page")}</label>
                <input type="text" name="sourcePage" value="${sourcePage}"
                  placeholder="${LW("Field.PagePlaceholder")}" />
              </div>
            </div>`;
        },
        postRender: (el) => {
          const selType       = el.querySelector("#wod-ic-displaytype");
          const giftS         = el.querySelector("#wod-ic-gift-section");
          const riteS         = el.querySelector("#wod-ic-rite-section");
          const selGiftType   = el.querySelector("#wod-ic-giftType");
          const selRenown     = el.querySelector("#wod-ic-renown");
          const selRiteGT     = el.querySelector("#wod-ic-riteGiftType");
          const selRiteRenown = el.querySelector("#wod-ic-riteRenown");
          const hidGiftType   = el.querySelector('[name="giftType_hidden"]');
          const hidRenown     = el.querySelector('[name="renown_hidden"]');
          const hidRiteGT     = el.querySelector('[name="riteGiftType_hidden"]');
          const hidRiteRenown = el.querySelector('[name="riteRenown_hidden"]');
          selGiftType?.addEventListener("change",   () => { hidGiftType.value   = selGiftType.value; });
          selRenown?.addEventListener("change",     () => { hidRenown.value     = selRenown.value; });
          selRiteGT?.addEventListener("change",     () => { hidRiteGT.value     = selRiteGT.value; });
          selRiteRenown?.addEventListener("change", () => { hidRiteRenown.value = selRiteRenown.value; });
          const toggle = () => {
            const r = selType.value === "rite";
            giftS.style.display = r ? "none" : "";
            riteS.style.display = r ? "" : "none";
          };
          selType?.addEventListener("change", toggle); toggle();
        },
        collect: (html, s) => {
          const name = html.find('[name="itemName"]').val()?.trim();
          if (!name) { ui.notifications.warn(LW("Notify.NoName")); return false; }
          const displayType = html.find('[name="displayType"]').val() || "gift";
          const isRite      = displayType === "rite";
          s.d1 = {
            displayType, isRite, itemName: name,
            giftType:      isRite ? html.find('[name="riteGiftType_hidden"]').val() || "rite"
                                  : html.find('[name="giftType_hidden"]').val()     || "native",
            renown:        isRite ? html.find('[name="riteRenown_hidden"]').val()   || "wisdom"
                                  : html.find('[name="renown_hidden"]').val()       || "glory",
            level:         isRite ? null : (parseInt(html.find('[name="level"]').val()) || 1),
            cost:          parseInt(html.find('[name="cost"]').val())          || 0,
            willpowercost: parseInt(html.find('[name="willpowercost"]').val()) || 0,
            sourceBook:    html.find('[name="sourceBook"]').val()?.trim()      || "",
            sourcePage:    html.find('[name="sourcePage"]').val()?.trim()      || "",
          };
        },
      },

      // 3: Würfelvorrat 2/3
      {
        title: `${L("WOD5E.WTA.GiftsandRites")} — ${LW("Step.PoolTitle")}`,
        html: (s) => {
          const pool = s.d2?.pool ?? s.parsed?.pool ?? [];
          return `
            <h3 class="wod-ic">${LW("Step.PoolTitle")}</h3>
            <p class="wod-ic hint">${LW("Pool.Hint")}</p>
            <p class="wod-ic hint">${LW("Pool.ContestHint")}</p>
            <div id="wod-ic-pool-container">${WodItemCreator.renderPoolRows(pool)}</div>
            <button type="button" id="wod-ic-add-pool" style="margin-top:8px;width:100%;">
              ${LW("Pool.Add")}
            </button>`;
        },
        postRender: (el) => {
          const c = el.querySelector("#wod-ic-pool-container");
          if (c) WodItemCreator.attachPoolListeners(c);
        },
        collect: (html, s) => {
          const pool = []; let i = 0;
          while (true) {
            const sel = html.find(`[name="pool_path_${i}"]`);
            if (!sel.length) break;
            const v = sel.val(); if (v) pool.push({ path: v }); i++;
          }
          s.d2 = { pool };
        },
      },

      // 4: Beschreibung & Bestätigung 3/3
      {
        title: `${L("WOD5E.WTA.GiftsandRites")} — ${LW("Step.DescriptionTitle")}`,
        nextLabel: LW("Btn.Create"),
        html: (s) => {
          const isRite      = s.d1?.isRite ?? false;
          const giftTypes   = isRite ? WodItemCreator.riteTypes() : WodItemCreator.giftTypes();
          const typeLabel   = giftTypes.find(t => t.value === s.d1?.giftType)?.label   ?? s.d1?.giftType;
          const renownLabel = WodItemCreator.renownTypes().find(r => r.value === s.d1?.renown)?.label ?? s.d1?.renown;
          const poolOpts    = WodItemCreator.poolOptions();
          const poolSummary = (s.d2?.pool ?? [])
            .map(e => poolOpts.find(o => o.value === e.path)?.label ?? e.path)
            .join(" + ") || "–";
          const desc = s.d3?.description ?? s.parsed?.description ?? "";
          return `
            <h3 class="wod-ic">${L("WOD5E.Tabs.Description")}</h3>
            <p class="wod-ic hint">${LW("Desc.HtmlHint")}</p>
            <textarea class="wod-ic" name="description" rows="9">${desc}</textarea>
            <h3 class="wod-ic" style="margin-top:18px;">${LW("Summary.Title")}</h3>
            <table class="wod-ic">
              <tr><td style="font-weight:bold;">${LW("Field.Name")}</td>
                  <td>${WodItemCreator.esc(s.d1?.itemName ?? "–")}</td></tr>
              <tr><td style="font-weight:bold;">${LW("Summary.Type")}</td>
                  <td>${isRite ? L("WOD5E.WTA.Rite") : L("WOD5E.WTA.Gift")}</td></tr>
              <tr><td style="font-weight:bold;">${LW("Summary.Subtype")}</td>
                  <td>${typeLabel}</td></tr>
              <tr><td style="font-weight:bold;">${LW("Field.Renown")}</td>
                  <td>${renownLabel}</td></tr>
              ${!isRite
                ? `<tr><td style="font-weight:bold;">${LW("Field.Level")}</td>
                       <td>${s.d1?.level ?? "–"}</td></tr>`
                : ""}
              <tr><td style="font-weight:bold;">${LW("Field.RageCost")}</td>
                  <td>${s.d1?.cost ?? 0}</td></tr>
              <tr><td style="font-weight:bold;">${LW("Field.WillpowerCost")}</td>
                  <td>${s.d1?.willpowercost ?? 0}</td></tr>
              <tr><td style="font-weight:bold;">${LW("Summary.Pool")}</td>
                  <td>${poolSummary}</td></tr>
              <tr><td style="font-weight:bold;">${LW("Summary.Source")}</td>
                  <td>${s.d1?.sourceBook
                    ? `${WodItemCreator.esc(s.d1.sourceBook)}, ${LW("Field.Page")} ${WodItemCreator.esc(s.d1.sourcePage)}`
                    : "–"}</td></tr>
            </table>`;
        },
        postRender: null,
        collect: (html, s) => {
          s.d3 = { description: html.find('[name="description"]').val()?.trim() || "" };
        },
      },

    ]; // Ende STEPS

    let stepIdx = 0;
    while (stepIdx < STEPS.length) {
      const step = STEPS[stepIdx];
      if (step.skip && step.skip(state)) { stepIdx++; continue; }
      const result = await showStep(step, stepIdx);
      if (result.action === "cancel") { ui.notifications.warn(LW("Notify.Cancelled")); return; }
      if (result.action === "back") {
        stepIdx--;
        while (stepIdx > 0 && STEPS[stepIdx].skip && STEPS[stepIdx].skip(state)) stepIdx--;
        continue;
      }
      if (step.collect(result.html, state) === false) continue;
      stepIdx++;
    }

    const { d1, d2, d3 } = state;
    const dicepool = {};
    for (const entry of (d2.pool ?? [])) dicepool[foundry.utils.randomID(16)] = { path: entry.path };

    const itemData = {
      name: d1.itemName, type: "gift",
      img: "systems/wod5e/assets/icons/items/gift.png",
      system: {
        description:   d3.description, bonuses: [],
        source:        { book: d1.sourceBook, page: d1.sourcePage },
        giftType:      d1.giftType, renown: d1.renown, level: d1.level,
        cost:          d1.cost, willpowercost: d1.willpowercost,
        dicepool, macroid: "", dataItemId: "", selected: false,
      },
      effects: [], folder: null, flags: {},
    };

    try {
      const item = await Item.create(itemData);
      await item.update({});
      ui.notifications.info(
        `✅ "${item.name}" (${L(item.system.giftType === "rite" ? "WOD5E.WTA.Rite" : "WOD5E.WTA.Gift")}) ${LW("Notify.Created")}`
      );
      setTimeout(() => { game.items.get(item.id)?.sheet.render(true); }, 300);
    } catch (err) {
      console.error("[wod5e-actor-item-creator] item-creator:", err);
      ui.notifications.error(`${LW("Notify.Error")} ${err.message}`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Hooks
// ═══════════════════════════════════════════════════════════════════════════

// API-Export
Hooks.once("ready", () => {
  if (game.system.id !== "wod5e") return;
  const mod = game.modules.get("wod5e-actor-item-creator");
  if (mod) {
    mod.api ??= {};
    mod.api.WodItemCreator      = WodItemCreator;
    mod.api.openItemCreator     = () => WodItemCreator.run();
  }
  console.log("[wod5e-actor-item-creator] item-creator.js bereit.");
});

// Button im Item-Directory (Sidebar)
Hooks.on("renderItemDirectory", (app, html) => {
  if (game.system.id !== "wod5e") return;
  if (!game.user.isGM && !game.user.hasPermission("ITEM_CREATE")) return;
  const container = html instanceof HTMLElement ? html : html[0];
  if (container.querySelector("#wod-ic-sidebar-btn")) return;
  const btn = document.createElement("button");
  btn.id = "wod-ic-sidebar-btn"; btn.type = "button"; btn.className = "create-entry";
  btn.innerHTML = `<i class="fas fa-scroll"></i> <span>${LW("OpenItemCreator")}</span>`;
  btn.addEventListener("click", (ev) => { ev.preventDefault(); WodItemCreator.run(); });
  const headerActions = container.querySelector(".header-actions.action-buttons");
  if (headerActions) headerActions.appendChild(btn);
});
