/**
 * WoD5e Actor Item Creator
 * Script 2/2: actor-creator.js — SPC Actor Creator
 *
 * i18n: alle Texte über LSP() / LW() / L(). Namespace WODIC.SPC.*
 * API-Export: game.modules.get("wod5e-actor-item-creator").api.WodSpcCreator
 */

// Modul-lokale Helfer (ES-Module-Scope — kein Konflikt mit item-creator.js)
const L   = (key) => game.i18n.localize(key);
const LW  = (key) => game.i18n.localize(`WODIC.${key}`);
const LSP = (key) => game.i18n.localize(`WODIC.SPC.${key}`);

// ═══════════════════════════════════════════════════════════════════════════
// WodSpcCreator — SPC Actor Creator
// ═══════════════════════════════════════════════════════════════════════════
class WodSpcCreator {

  // ── Inline-CSS für SPC-Dialoge ────────────────────────────────────────────
  static get CSS() {
    return `<style>
      .wf label         { display:block; margin-top:7px; font-weight:bold;
                          font-size:0.82em; color:var(--color-text-dark-secondary,#555); }
      .wf input,.wf select,.wf textarea
                        { width:100%; box-sizing:border-box; margin-top:2px; }
      .wf textarea      { resize:vertical; }
      .wf h3            { border-bottom:1px solid var(--color-border-light-primary,#aaa);
                          margin:14px 0 4px; font-size:0.95em; }
      .wf .g2           { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
      .wf .g3           { display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; }
      .wf .g4           { display:grid; grid-template-columns:1fr 1fr 1fr 1fr; gap:6px; }
      .wf .cb-row       { display:flex; align-items:center; gap:6px; margin-top:8px; }
      .wf .cb-row input { width:auto; margin:0; }
      .wf .cb-row label { font-weight:normal; margin:0; }
      .wf .hint         { font-size:0.82em; color:var(--color-text-dark-secondary,#666);
                          margin-bottom:4px; line-height:1.5; }
      .wf code          { background:var(--color-bg-option,#eee); padding:1px 4px;
                          border-radius:3px; font-size:0.9em; }
    </style>`;
  }

  // ── HTML-Escape für Nutzereingaben in innerHTML ───────────────────────────
  static esc(v) {
    return String(v ?? "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // ── Stat-Block Text → strukturiertes Objekt ───────────────────────────────
  static parseStatBlock(raw) {
    const result = {
      name: "", spcType: "mortal", concept: "", group: "",
      chronicle: "", ambition: "", desire: "",
      notes: "", privatenotes: "", appearance: "",
      description: "", equipment: "", history: "",
      trueage: "", apparent: "", birth: "", death: "",
      locked: true,
      healthMax: 3, healthSup: 0, healthAgg: 0,
      wpMax: 3,     wpSup: 0,    wpAgg: 0,
      physical: 1, social: 1, mental: 1,
      diffStrongest: 2, diffNormal: 1,
      xpTotal: 0, xpRemaining: 0,
      potency: 0, generation: "", hunger: 1,
      humanity: 7, stains: 0, sire: "", domitor: "",
      rage: 1, activeForm: "homid", crinosMax: 4,
      glory: 0, honor: 0, wisdom: 0, harano: 0, hauglosk: 0,
      despair: 0, desperation: 0, cellname: "", creedfields: "",
      skills: {},
    };

    if (!raw.trim()) return result;

    const lines = raw.split("\n").map(l => l.trim()).filter(Boolean);
    const toInt = (s, fb = 0) => parseInt((s || "").replace(/[^\d]/g, "")) || fb;

    // Skill-Schlüssel (interne Systemnamen, kein i18n)
    const skillMap = {
      leadership:"leadership", subterfuge:"subterfuge", performance:"performance",
      larceny:"larceny", intimidation:"intimidation", insight:"insight",
      investigation:"investigation", etiquette:"etiquette", drive:"drive",
      finance:"finance", academics:"academics", brawl:"brawl",
      craft:"craft", crafts:"craft", stealth:"stealth", medicine:"medicine",
      melee:"melee", science:"science", occult:"occult", politics:"politics",
      firearms:"firearms", athletics:"athletics", streetwise:"streetwise",
      technology:"technology", animalken:"animalken", "animal ken":"animalken",
      survival:"survival", persuasion:"persuasion", awareness:"awareness",
    };

    // Typ-Erkennung EN + DE
    const typeMap = {
      mortal:"mortal", human:"mortal", sterblich:"mortal",
      vampire:"vampire", vampir:"vampire",
      ghoul:"ghoul", ghul:"ghoul",
      werewolf:"werewolf", werwolf:"werewolf",
      hunter:"hunter", jäger:"hunter",
    };

    const isFieldLine = (line) =>
      /^(general diff|standard dice|secondary attr|exceptional dice|notes\b|other traits\b|health\s*[:=]|willpower\s*[:=]|hunger\s*[:=]|humanity\s*[:=]|rage\s*[:=]|blood potency\s*[:=]|generation\s*[:=]|sire\s*[:=])/i
      .test(line);

    let nameIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (!isFieldLine(lines[i])) {
        result.name = lines[i].replace(/^[-–—*#]+\s*/, "").trim();
        nameIdx = i;
        break;
      }
    }

    const nl = result.name.toLowerCase();
    for (const [k, v] of Object.entries(typeMap)) {
      if (nl.includes(k)) { result.spcType = v; break; }
    }

    const introLines = [];
    const introIdxSet = new Set();
    if (nameIdx >= 0) {
      for (let i = nameIdx + 1; i < lines.length; i++) {
        if (isFieldLine(lines[i])) break;
        introLines.push(lines[i]);
        introIdxSet.add(i);
      }
    }

    const notesLines = [];
    let inNotes = false;

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx];
      if (lineIdx === nameIdx) continue;
      if (introIdxSet.has(lineIdx) && !isFieldLine(line)) continue;

      const lo = line.toLowerCase();

      if (/general diff/i.test(lo)) {
        inNotes = false;
        const m = line.match(/(\d+)\s*[\/,]\s*(\d+)/);
        if (m) { result.diffStrongest = toInt(m[1], 2); result.diffNormal = toInt(m[2], 1); }
        else { const s2 = line.match(/:\s*(\d+)/); if (s2) result.diffStrongest = toInt(s2[1], 2); }
        continue;
      }
      if (/standard dice/i.test(lo)) {
        inNotes = false;
        const ph = line.match(/physical\s+(\d+)/i);
        const so = line.match(/social\s+(\d+)/i);
        const me = line.match(/mental\s+(\d+)/i);
        if (ph) result.physical = toInt(ph[1], 1);
        if (so) result.social   = toInt(so[1], 1);
        if (me) result.mental   = toInt(me[1], 1);
        continue;
      }
      if (/secondary attr/i.test(lo)) {
        inNotes = false;
        const h = line.match(/health\s+(\d+)/i);
        const w = line.match(/willpower\s+(\d+)/i);
        if (h) result.healthMax = toInt(h[1], 3);
        if (w) result.wpMax     = toInt(w[1], 3);
        continue;
      }
      if (/^health\s*[:=]/i.test(line))    { inNotes=false; const m=line.match(/(\d+)/); if(m) result.healthMax=toInt(m[1],3); continue; }
      if (/^willpower\s*[:=]/i.test(line)) { inNotes=false; const m=line.match(/(\d+)/); if(m) result.wpMax=toInt(m[1],3);     continue; }
      if (/exceptional dice/i.test(lo)) {
        inNotes = false;
        WodSpcCreator._parseExceptional(line.replace(/^[^:]+:\s*/i, ""), skillMap, result);
        continue;
      }
      if (/^hunger\s*[:=]/i.test(line))       { inNotes=false; const m=line.match(/(\d+)/); if(m) result.hunger    =toInt(m[1],1); continue; }
      if (/^humanity\s*[:=]/i.test(line))      { inNotes=false; const m=line.match(/(\d+)/); if(m) result.humanity  =toInt(m[1],7); continue; }
      if (/^blood potency\s*[:=]/i.test(line)) { inNotes=false; const m=line.match(/(\d+)/); if(m) result.potency   =toInt(m[1],0); continue; }
      if (/^generation\s*[:=]/i.test(line))    { inNotes=false; result.generation=line.replace(/^generation\s*[:=]\s*/i,"").trim(); continue; }
      if (/^sire\s*[:=]/i.test(line))          { inNotes=false; result.sire=line.replace(/^sire\s*[:=]\s*/i,"").trim();             continue; }
      if (/^rage\s*[:=]/i.test(line))          { inNotes=false; const m=line.match(/(\d+)/); if(m) result.rage      =toInt(m[1],1); continue; }
      if (/^notes\b|^other traits\b/i.test(line)) {
        inNotes = true;
        const rest = line.replace(/^[^:]+:\s*/i, "").trim();
        if (rest) notesLines.push(rest);
        continue;
      }
      if (inNotes) { notesLines.push(line); continue; }
    }

    const privateParas = [];
    if (introLines.length) {
      const t = introLines.join(" ").replace(/- /g, "").replace(/\s{2,}/g, " ").trim();
      if (t) privateParas.push(`<p>${t}</p>`);
    }
    if (notesLines.length) {
      const t = WodSpcCreator._formatNotesAsHtml(notesLines);
      if (t) privateParas.push(t);
    }
    result.privatenotes = privateParas.join("\n");
    result.notes        = "";
    return result;
  }

  static _parseExceptional(segment, skillMap, result) {
    const pat = /([A-Za-z\s]+?)(?:\s*\([^)]*\))?\s+(\d+)(?=[,\s]|$)/g;
    let m;
    while ((m = pat.exec(segment)) !== null) {
      const rs  = m[1].trim().toLowerCase();
      const val = parseInt(m[2]) || 0;
      const key = Object.keys(skillMap)
        .filter(k => rs.includes(k))
        .sort((a, b) => b.length - a.length)[0];
      if (key) result.skills[skillMap[key]] = val;
    }
  }

  static _formatNotesAsHtml(lines) {
    if (!lines.length) return "";
    const paras = []; let current = [];
    const flush = () => {
      if (!current.length) return;
      const t = current.join(" ").replace(/- /g, "").replace(/\s{2,}/g, " ").trim();
      if (t) paras.push(`<p>${t}</p>`);
      current = [];
    };
    for (const line of lines) {
      if (/^[A-ZÄÖÜ][^:]{1,40}:\s+\S/.test(line)) { flush(); current.push(line); }
      else { current.push(line); }
    }
    flush();
    return paras.join("\n");
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // run() — Haupt-Einstiegspunkt
  // ═══════════════════════════════════════════════════════════════════════════
  static async run() {
    const AppV2 = foundry.applications.api.ApplicationV2;

    const state = {
      mode: "text", rawText: "",
      p:  WodSpcCreator.parseStatBlock(""),
      d1: null, d2: null, d3: null, d4skills: null, d5: null,
    };

    // ── Dialog-Engine ──────────────────────────────────────────────────────
    function showStep(title, bodyHtml, { showBack = false, nextLabel } = {}) {
      nextLabel ??= LW("Btn.Next");
      return new Promise((resolve) => {
        class StepDialog extends AppV2 {
          static DEFAULT_OPTIONS = {
            id: `wod-spc-step-${Date.now()}`,
            tag: "div",
            window: { title, resizable: true },
            position: { width: 580 },
          };

          async _renderHTML(_ctx, _opt) {
            const wrap = document.createElement("div");
            wrap.innerHTML = `
              ${WodSpcCreator.CSS}
              <div class="wf" style="padding:0 2px;">${bodyHtml}</div>
              <div style="display:flex;justify-content:space-between;align-items:center;
                          gap:8px;margin-top:14px;padding-top:10px;
                          border-top:1px solid var(--color-border-light-primary,#aaa);">
                <div>
                  ${showBack ? `<button type="button" id="wod-btn-back" style="min-width:90px;">${LW("Btn.Back")}</button>` : ""}
                </div>
                <div style="display:flex;gap:8px;">
                  <button type="button" id="wod-btn-cancel" style="min-width:90px;">${LW("Btn.Cancel")}</button>
                  <button type="button" id="wod-btn-next" style="min-width:130px;font-weight:bold;">${nextLabel}</button>
                </div>
              </div>`;
            return wrap;
          }

          _replaceHTML(result, content, _opt) {
            content.replaceChildren(result);
            content.querySelector("#wod-btn-next")?.addEventListener("click", () => {
              const snap = $(this.element); this.close({ animate: false }); resolve({ html: snap, action: "next" });
            });
            content.querySelector("#wod-btn-back")?.addEventListener("click", () => {
              this.close({ animate: false }); resolve({ html: null, action: "back" });
            });
            content.querySelector("#wod-btn-cancel")?.addEventListener("click", () => {
              this.close({ animate: false }); resolve({ html: null, action: "cancel" });
            });
          }

          _onClose(_opt) { resolve({ html: null, action: "cancel" }); }
        }
        new StepDialog().render(true);
      });
    }

    // ── Schritt-Definitionen ───────────────────────────────────────────────
    const STEPS = [

      // 0: Eingabemodus
      {
        title: LSP("Step.ModeTitle"),
        html: (s) => `
          <h3>${LSP("Step.ModeTitle")}</h3>
          <div class="cb-row" style="margin-top:12px;">
            <input type="radio" name="mode" id="spc-mode-text" value="text" ${s.mode === "text" ? "checked" : ""} />
            <label for="spc-mode-text"><strong>${LSP("Mode.Text")}</strong> — ${LSP("Mode.TextHint")}</label>
          </div>
          <div class="cb-row" style="margin-top:6px;">
            <input type="radio" name="mode" id="spc-mode-manual" value="manual" ${s.mode === "manual" ? "checked" : ""} />
            <label for="spc-mode-manual"><strong>${LSP("Mode.Manual")}</strong> — ${LSP("Mode.ManualHint")}</label>
          </div>`,
        collect: (html, s) => { s.mode = html.find('[name="mode"]:checked').val() || "text"; },
      },

      // 1: Textblock
      {
        title: LSP("Step.TextTitle"),
        nextLabel: LW("Btn.Submit"),
        skip: (s) => s.mode !== "text",
        html: (s) => `
          <p class="hint">${LSP("TextHint.Intro")}</p>
          <p class="hint">
            ${LSP("TextHint.Fields")}<br>
            <code>General Difficulty: 3 / 2</code><br>
            <code>Standard Dice Pools: Physical 3, Social 4, Mental 4</code><br>
            <code>Secondary Attributes: Health 5, Willpower 5</code><br>
            <code>Exceptional Dice Pools: Persuasion 6, Brawl 4</code><br>
            <code>Notes / Other Traits: …</code>
          </p>
          <label>${LSP("TextHint.Intro")}</label>
          <textarea name="rawtext" rows="14"
            style="font-family:monospace;font-size:0.82em;"
            placeholder="${LSP("TextHint.Placeholder")}">${s.rawText}</textarea>`,
        collect: (html, s) => {
          s.rawText = html.find('[name="rawtext"]').val() || "";
          if (!s.rawText.trim()) { ui.notifications.error(LSP("Notify.NoText")); return false; }
          s.p = WodSpcCreator.parseStatBlock(s.rawText);
        },
      },

      // 2: Grunddaten 1/4
      {
        title: LSP("Step.BasicsTitle"),
        html: (s) => {
          const d = s.d1 || s.p;
          return `
            <h3>${LSP("Section.Identity")}</h3>
            <label>${LSP("Field.Name")} *</label>
            <input type="text" name="name" value="${d.name || ""}" />
            <div class="g2">
              <div>
                <label>${LSP("Field.Type")}</label>
                <select name="spcType">
                  <option value="mortal"   ${d.spcType === "mortal"   ? "selected" : ""}>${LSP("Type.Mortal")}</option>
                  <option value="vampire"  ${d.spcType === "vampire"  ? "selected" : ""}>${LSP("Type.Vampire")}</option>
                  <option value="ghoul"    ${d.spcType === "ghoul"    ? "selected" : ""}>${LSP("Type.Ghoul")}</option>
                  <option value="werewolf" ${d.spcType === "werewolf" ? "selected" : ""}>${LSP("Type.Werewolf")}</option>
                  <option value="hunter"   ${d.spcType === "hunter"   ? "selected" : ""}>${LSP("Type.Hunter")}</option>
                </select>
              </div>
              <div>
                <label>${LSP("Field.Group")}</label>
                <input type="text" name="group" value="${d.group || ""}" />
              </div>
            </div>
            <div class="g2">
              <div><label>${LSP("Field.Concept")}</label>   <input type="text" name="concept"   value="${d.concept || ""}"   /></div>
              <div><label>${LSP("Field.Chronicle")}</label> <input type="text" name="chronicle" value="${d.chronicle || ""}" /></div>
              <div><label>${LSP("Field.Ambition")}</label>  <input type="text" name="ambition"  value="${d.ambition || ""}"  /></div>
              <div><label>${LSP("Field.Desire")}</label>    <input type="text" name="desire"    value="${d.desire || ""}"    /></div>
            </div>
            <h3>${LSP("Section.Options")}</h3>
            <div class="cb-row">
              <input type="checkbox" name="locked" id="cb_locked"
                ${(d.locked !== undefined ? d.locked : true) ? "checked" : ""} />
              <label for="cb_locked">${LSP("Field.Locked")}</label>
            </div>`;
        },
        collect: (html, s) => {
          const name = html.find('[name="name"]').val().trim();
          if (!name) { ui.notifications.error(LSP("Notify.NoName")); return false; }
          s.d1 = {
            name,
            spcType:   html.find('[name="spcType"]').val(),
            group:     html.find('[name="group"]').val().trim(),
            concept:   html.find('[name="concept"]').val().trim(),
            chronicle: html.find('[name="chronicle"]').val().trim(),
            ambition:  html.find('[name="ambition"]').val().trim(),
            desire:    html.find('[name="desire"]').val().trim(),
            locked:    html.find('[name="locked"]').is(":checked"),
          };
        },
      },

      // 3: Hintergrund & Texte 2/4
      {
        title: LSP("Step.BackgroundTitle"),
        html: (s) => {
          const d = s.d2 || s.p;
          return `
            <h3>${LSP("Section.Biography")}</h3>
            <div class="g2">
              <div><label>${LSP("Field.TrueAge")}</label>    <input type="text" name="trueage"  value="${d.trueage || ""}"  /></div>
              <div><label>${LSP("Field.ApparentAge")}</label> <input type="text" name="apparent" value="${d.apparent || ""}" /></div>
              <div><label>${LSP("Field.Birth")}</label>      <input type="text" name="birth"    value="${d.birth || ""}"    /></div>
              <div><label>${LSP("Field.Death")}</label>      <input type="text" name="death"    value="${d.death || ""}"    /></div>
            </div>
            <label>${LSP("Field.History")}</label>
            <textarea name="history" rows="3">${d.history || ""}</textarea>
            <h3>${LSP("Section.Presentation")}</h3>
            <label>${LSP("Field.Appearance")}</label>
            <textarea name="appearance"   rows="2">${d.appearance || ""}</textarea>
            <label>${LSP("Field.Description")}</label>
            <textarea name="description"  rows="2">${d.description || ""}</textarea>
            <label>${LSP("Field.Equipment")}</label>
            <textarea name="equipment"    rows="2">${d.equipment || ""}</textarea>
            <h3>${LSP("Section.Notes")}</h3>
            <label>${LSP("Field.Notes")}</label>
            <textarea name="notes"        rows="2">${d.notes || ""}</textarea>
            <label>${LSP("Field.PrivateNotes")}</label>
            <textarea name="privatenotes" rows="5">${d.privatenotes || ""}</textarea>`;
        },
        collect: (html, s) => {
          s.d2 = {
            trueage:      html.find('[name="trueage"]').val().trim(),
            apparent:     html.find('[name="apparent"]').val().trim(),
            birth:        html.find('[name="birth"]').val().trim(),
            death:        html.find('[name="death"]').val().trim(),
            history:      html.find('[name="history"]').val().trim(),
            appearance:   html.find('[name="appearance"]').val().trim(),
            description:  html.find('[name="description"]').val().trim(),
            equipment:    html.find('[name="equipment"]').val().trim(),
            notes:        html.find('[name="notes"]').val().trim(),
            privatenotes: html.find('[name="privatenotes"]').val().trim(),
          };
        },
      },

      // 4: Ressourcen & Würfelpools 3/4
      {
        title: LSP("Step.ResourcesTitle"),
        html: (s) => {
          const d = s.d3 || s.p;
          return `
            <h3>${LSP("Section.Health")}</h3>
            <div class="g3">
              <div><label>${LSP("Field.HealthMax")}</label> <input type="number" name="healthMax" value="${d.healthMax ?? 3}" min="1" max="20" /></div>
              <div><label>${LSP("Field.HealthSup")}</label> <input type="number" name="healthSup" value="${d.healthSup ?? 0}" min="0" max="20" /></div>
              <div><label>${LSP("Field.HealthAgg")}</label> <input type="number" name="healthAgg" value="${d.healthAgg ?? 0}" min="0" max="20" /></div>
            </div>
            <h3>${LSP("Section.Willpower")}</h3>
            <div class="g3">
              <div><label>${LSP("Field.WpMax")}</label> <input type="number" name="wpMax" value="${d.wpMax ?? 3}" min="1" max="20" /></div>
              <div><label>${LSP("Field.WpSup")}</label> <input type="number" name="wpSup" value="${d.wpSup ?? 0}" min="0" max="20" /></div>
              <div><label>${LSP("Field.WpAgg")}</label> <input type="number" name="wpAgg" value="${d.wpAgg ?? 0}" min="0" max="20" /></div>
            </div>
            <h3>${LSP("Section.StandardPools")}</h3>
            <div class="g3">
              <div><label>${LSP("Field.Physical")}</label> <input type="number" name="physical" value="${d.physical ?? 1}" min="0" max="20" /></div>
              <div><label>${LSP("Field.Social")}</label>   <input type="number" name="social"   value="${d.social ?? 1}"   min="0" max="20" /></div>
              <div><label>${LSP("Field.Mental")}</label>   <input type="number" name="mental"   value="${d.mental ?? 1}"   min="0" max="20" /></div>
            </div>
            <h3>${LSP("Section.Difficulty")}</h3>
            <div class="g2">
              <div><label>${LSP("Field.DiffStrongest")}</label>
                <input type="number" name="diffStrongest" value="${d.diffStrongest ?? 2}" min="0" max="10" /></div>
              <div><label>${LSP("Field.DiffNormal")}</label>
                <input type="number" name="diffNormal"    value="${d.diffNormal ?? 1}"    min="0" max="10" /></div>
            </div>
            <h3>${LSP("Section.XP")}</h3>
            <div class="g2">
              <div><label>${LSP("Field.XpTotal")}</label>     <input type="number" name="xpTotal"     value="${d.xpTotal ?? 0}"     min="0" /></div>
              <div><label>${LSP("Field.XpRemaining")}</label> <input type="number" name="xpRemaining" value="${d.xpRemaining ?? 0}" min="0" /></div>
            </div>`;
        },
        collect: (html, s) => {
          s.d3 = {
            healthMax:     parseInt(html.find('[name="healthMax"]').val())     || 3,
            healthSup:     parseInt(html.find('[name="healthSup"]').val())     || 0,
            healthAgg:     parseInt(html.find('[name="healthAgg"]').val())     || 0,
            wpMax:         parseInt(html.find('[name="wpMax"]').val())         || 3,
            wpSup:         parseInt(html.find('[name="wpSup"]').val())         || 0,
            wpAgg:         parseInt(html.find('[name="wpAgg"]').val())         || 0,
            physical:      parseInt(html.find('[name="physical"]').val())      || 1,
            social:        parseInt(html.find('[name="social"]').val())        || 1,
            mental:        parseInt(html.find('[name="mental"]').val())        || 1,
            diffStrongest: parseInt(html.find('[name="diffStrongest"]').val()) || 2,
            diffNormal:    parseInt(html.find('[name="diffNormal"]').val())    || 1,
            xpTotal:       parseInt(html.find('[name="xpTotal"]').val())       || 0,
            xpRemaining:   parseInt(html.find('[name="xpRemaining"]').val())   || 0,
          };
        },
      },

      // 5: Exceptional Dice Pools 4/4
      {
        title: LSP("Step.ExceptionalTitle"),
        html: (s) => {
          const groups = [
            { label: LSP("Section.Physical"), skills: ["athletics","brawl","craft","drive","firearms","larceny","melee","stealth","survival"] },
            { label: LSP("Section.Social"),   skills: ["animalken","etiquette","insight","intimidation","leadership","performance","persuasion","streetwise","subterfuge"] },
            { label: LSP("Section.Mental"),   skills: ["academics","awareness","finance","investigation","medicine","occult","politics","science","technology"] },
          ];
          const saved = s.d4skills || {};
          // Skill-Label via WOD5E-System (Fallback: kapitaliserter Key)
          const skillLabel = (sk) => {
            try {
              const list = WOD5E.Skills.getList({});
              const entry = list[sk];
              return entry?.displayName ?? entry?.label ?? sk;
            } catch { return sk.charAt(0).toUpperCase() + sk.slice(1); }
          };
          let html = `<p class="hint">${LSP("Hint.ExceptionalDot")} <span style="color:#5a9;font-weight:bold;">●</span> = ${LSP("Hint.ExceptionalDetected")}</p>`;
          for (const { label, skills } of groups) {
            html += `<h3>${label}</h3><div class="g4">`;
            for (const sk of skills) {
              const preVal = saved[sk] ?? s.p.skills[sk] ?? 0;
              html += `<div>
                <label>${skillLabel(sk)}${preVal > 0 ? ' <span style="color:#5a9;font-weight:bold;">●</span>' : ""}</label>
                <input type="number" name="skill_${sk}" value="${preVal}" min="0" max="20" />
              </div>`;
            }
            html += `</div>`;
          }
          return html;
        },
        collect: (html, s) => {
          const all = [
            "athletics","brawl","craft","drive","firearms","larceny","melee","stealth","survival",
            "animalken","etiquette","insight","intimidation","leadership","performance","persuasion","streetwise","subterfuge",
            "academics","awareness","finance","investigation","medicine","occult","politics","science","technology",
          ];
          s.d4skills = {};
          for (const sk of all) s.d4skills[sk] = parseInt(html.find(`[name="skill_${sk}"]`).val()) || 0;
        },
      },

      // 6: Typ-spezifisch & Bestätigung
      {
        title: LSP("Step.TypeSpecificTitle"),
        nextLabel: LSP("Btn.Create"),
        html: (s) => {
          const spcType = s.d1?.spcType || "mortal";
          const isV = ["vampire","ghoul"].includes(spcType);
          const isW = spcType === "werewolf";
          const isH = spcType === "hunter";
          // Fix: s.d5 für bereits eingegebene Werte (Back-Navigation), s.p als Fallback
          const p   = { ...s.p, ...s.d5 };
          const d3  = s.d3;

          const vHtml = isV ? `
            <h3>${LSP("Section.Vampire")}</h3>
            <div class="g2">
              <div><label>${LSP("Field.Potency")}</label>    <input type="number" name="potency"    value="${p.potency}"    min="0" max="10" /></div>
              <div><label>${LSP("Field.Generation")}</label> <input type="text"   name="generation" value="${p.generation}"               /></div>
              <div><label>${LSP("Field.Hunger")}</label>     <input type="number" name="hunger"     value="${p.hunger}"     min="0" max="5"  /></div>
              <div><label>${LSP("Field.Humanity")}</label>   <input type="number" name="humanity"   value="${p.humanity}"   min="0" max="10" /></div>
              <div><label>${LSP("Field.Stains")}</label>     <input type="number" name="stains"     value="${p.stains}"     min="0" max="10" /></div>
              <div><label>${LSP("Field.Sire")}</label>       <input type="text"   name="sire"       value="${p.sire}"                      /></div>
              ${spcType === "ghoul" ? `<div><label>${LSP("Field.Domitor")}</label><input type="text" name="domitor" value="${p.domitor}" /></div>` : ""}
            </div>` : "";

          const wHtml = isW ? `
            <h3>${LSP("Section.Werewolf")}</h3>
            <div class="g2">
              <div><label>${LSP("Field.Rage")}</label>
                <input type="number" name="rage" value="${p.rage}" min="0" max="5" />
              </div>
              <div>
                <label>${LSP("Field.ActiveForm")}</label>
                <select name="activeForm">
                  <option value="homid"  ${p.activeForm === "homid"  ? "selected" : ""}>${LSP("Form.Homid")}</option>
                  <option value="glabro" ${p.activeForm === "glabro" ? "selected" : ""}>${LSP("Form.Glabro")}</option>
                  <option value="crinos" ${p.activeForm === "crinos" ? "selected" : ""}>${LSP("Form.Crinos")}</option>
                  <option value="hispo"  ${p.activeForm === "hispo"  ? "selected" : ""}>${LSP("Form.Hispo")}</option>
                  <option value="lupus"  ${p.activeForm === "lupus"  ? "selected" : ""}>${LSP("Form.Lupus")}</option>
                </select>
              </div>
              <div><label>${LSP("Field.CrinosMax")}</label>
                <input type="number" name="crinosMax" value="${p.crinosMax}" min="1" max="20" />
              </div>
            </div>
            <h3>${LSP("Section.Renown")}</h3>
            <div class="g3">
              <div><label>${LSP("Field.Glory")}</label>  <input type="number" name="glory"  value="${p.glory}"  min="0" max="5" /></div>
              <div><label>${LSP("Field.Honor")}</label>  <input type="number" name="honor"  value="${p.honor}"  min="0" max="5" /></div>
              <div><label>${LSP("Field.Wisdom")}</label> <input type="number" name="wisdom" value="${p.wisdom}" min="0" max="5" /></div>
            </div>
            <h3>${LSP("Section.Balance")}</h3>
            <div class="g2">
              <div><label>${LSP("Field.Harano")}</label>   <input type="number" name="harano"   value="${p.harano}"   min="0" max="5" /></div>
              <div><label>${LSP("Field.Hauglosk")}</label> <input type="number" name="hauglosk" value="${p.hauglosk}" min="0" max="5" /></div>
            </div>` : "";

          const hHtml = isH ? `
            <h3>${LSP("Section.Hunter")}</h3>
            <div class="g2">
              <div><label>${LSP("Field.Despair")}</label>     <input type="number" name="despair"     value="${p.despair}"     min="0" max="5" /></div>
              <div><label>${LSP("Field.Desperation")}</label> <input type="number" name="desperation" value="${p.desperation}" min="0" max="5" /></div>
              <div><label>${LSP("Field.Cellname")}</label>    <input type="text"   name="cellname"    value="${p.cellname}"                   /></div>
              <div><label>${LSP("Field.Creedfields")}</label> <input type="text"   name="creedfields" value="${p.creedfields}"                /></div>
            </div>` : "";

          const noExtra = (!isV && !isW && !isH)
            ? `<p class="hint" style="color:var(--color-text-dark-secondary,#666);font-style:italic;">${LSP("Type.Mortal")} — ${LSP("Section.Summary")}</p>` : "";

          return `
            ${noExtra}${vHtml}${wHtml}${hHtml}
            <h3 style="margin-top:18px;">${LSP("Section.Summary")}</h3>
            <table style="width:100%;font-size:0.85em;border-collapse:collapse;">
              <tr><td style="font-weight:bold;padding:2px 6px;">${LSP("Summary.Name")}</td>
                  <td>${WodSpcCreator.esc(s.d1?.name || "–")}</td></tr>
              <tr><td style="font-weight:bold;padding:2px 6px;">${LSP("Summary.Type")}</td>
                  <td>${spcType}</td></tr>
              <tr><td style="font-weight:bold;padding:2px 6px;">${LSP("Summary.Health")}</td>
                  <td>${LSP("Field.HealthMax")} ${d3?.healthMax ?? 3}</td></tr>
              <tr><td style="font-weight:bold;padding:2px 6px;">${LSP("Summary.Willpower")}</td>
                  <td>${LSP("Field.WpMax")} ${d3?.wpMax ?? 3}</td></tr>
              <tr><td style="font-weight:bold;padding:2px 6px;">${LSP("Summary.Pools")}</td>
                  <td>${LSP("Field.Physical")} ${d3?.physical ?? 1} / ${LSP("Field.Social")} ${d3?.social ?? 1} / ${LSP("Field.Mental")} ${d3?.mental ?? 1}</td></tr>
              <tr><td style="font-weight:bold;padding:2px 6px;">${LSP("Summary.Difficulty")}</td>
                  <td>${d3?.diffStrongest ?? 2} / ${d3?.diffNormal ?? 1}</td></tr>
              <tr><td style="font-weight:bold;padding:2px 6px;">${LSP("Summary.Locked")}</td>
                  <td>${s.d1?.locked ? "✔" : "✘"}</td></tr>
            </table>`;
        },
        collect: (html, s) => {
          s.d5 = {
            potency:     parseInt(html.find('[name="potency"]').val())     || 0,
            generation:  html.find('[name="generation"]').val()?.trim()   || "",
            hunger:      parseInt(html.find('[name="hunger"]').val())      || 1,
            humanity:    parseInt(html.find('[name="humanity"]').val())    || 7,
            stains:      parseInt(html.find('[name="stains"]').val())      || 0,
            sire:        html.find('[name="sire"]').val()?.trim()          || "",
            domitor:     html.find('[name="domitor"]').val()?.trim()       || "",
            rage:        parseInt(html.find('[name="rage"]').val())        || 1,
            activeForm:  html.find('[name="activeForm"]').val()            || "homid",
            crinosMax:   parseInt(html.find('[name="crinosMax"]').val())   || 4,
            glory:       parseInt(html.find('[name="glory"]').val())       || 0,
            honor:       parseInt(html.find('[name="honor"]').val())       || 0,
            wisdom:      parseInt(html.find('[name="wisdom"]').val())      || 0,
            harano:      parseInt(html.find('[name="harano"]').val())      || 0,
            hauglosk:    parseInt(html.find('[name="hauglosk"]').val())    || 0,
            despair:     parseInt(html.find('[name="despair"]').val())     || 0,
            desperation: parseInt(html.find('[name="desperation"]').val()) || 0,
            cellname:    html.find('[name="cellname"]').val()?.trim()      || "",
            creedfields: html.find('[name="creedfields"]').val()?.trim()   || "",
          };
        },
      },

    ]; // Ende STEPS

    // ── Schritt-Schleife ───────────────────────────────────────────────────
    let stepIdx = 0;
    while (stepIdx < STEPS.length) {
      const step = STEPS[stepIdx];
      if (step.skip && step.skip(state)) { stepIdx++; continue; }
      const result = await showStep(
        step.title, step.html(state),
        { showBack: stepIdx > 0, nextLabel: step.nextLabel }
      );
      if (result.action === "cancel") { ui.notifications.warn(LSP("Notify.Cancelled")); return; }
      if (result.action === "back") {
        stepIdx--;
        while (stepIdx > 0 && STEPS[stepIdx].skip && STEPS[stepIdx].skip(state)) stepIdx--;
        continue;
      }
      if (step.collect(result.html, state) === false) continue;
      stepIdx++;
    }

    // ── Actor anlegen ──────────────────────────────────────────────────────
    const { d1, d2, d3, d4skills, d5 } = state;
    const isVampire  = ["vampire","ghoul"].includes(d1.spcType);
    const isWerewolf = d1.spcType === "werewolf";
    const isHunter   = d1.spcType === "hunter";

    const exceptionaldicepools = {};
    for (const [sk, val] of Object.entries(d4skills)) {
      exceptionaldicepools[sk] = { active: val > 0, value: val, description: "", macroid: "", bonuses: [] };
    }

    const actorData = {
      name: d1.name, type: "spc",
      system: {
        locked: d1.locked, group: d1.group, spcType: d1.spcType,
        bio: {
          age:    { trueage: d2.trueage, apparent: d2.apparent },
          dateof: { birth: d2.birth, death: d2.death },
          history: d2.history,
        },
        headers: {
          concept: d1.concept, chronicle: d1.chronicle,
          ambition: d1.ambition, desire: d1.desire,
          touchstones: "", tenets: "",
          sire: d5.sire, generation: d5.generation,
          domitor: d5.domitor, creedfields: d5.creedfields, cellname: d5.cellname,
        },
        derivedXP:    { totalXP: d3.xpTotal, remainingXP: d3.xpRemaining },
        health:       { max: d3.healthMax, value: d3.healthMax, superficial: d3.healthSup, aggravated: d3.healthAgg },
        willpower:    { max: d3.wpMax,     value: d3.wpMax,     superficial: d3.wpSup,     aggravated: d3.wpAgg },
        description:  d2.description,
        appearance:   d2.appearance,
        notes:        d2.notes,
        privatenotes: d2.privatenotes,
        biography:    d2.history,
        equipment:    d2.equipment,
        standarddicepools: {
          physical: { value: d3.physical },
          social:   { value: d3.social },
          mental:   { value: d3.mental },
        },
        generaldifficulty: { normal: d3.diffNormal, strongest: d3.diffStrongest },
        exceptionaldicepools,
        settings: {
          generalDifficultyEnabled: true, skillAttributeInputs: false,
          enableDisciplines: isVampire, enableGifts: isWerewolf, enableEdges: isHunter,
          limited: { biography: true, appearance: true, touchstones: false, tenets: false },
        },
        hunger:       { value: isVampire  ? d5.hunger    : 1, max: 5 },
        humanity:     { value: isVampire  ? d5.humanity   : 7, stains: isVampire ? d5.stains : 0 },
        blood:        { potency: isVampire ? d5.potency   : 0, generation: isVampire ? d5.generation : "" },
        rage:         { value: isWerewolf ? d5.rage       : 1, max: 5 },
        activeForm:   isWerewolf ? d5.activeForm : "homid",
        crinosHealth: { max: isWerewolf ? d5.crinosMax : 4, value: isWerewolf ? d5.crinosMax : 4, superficial: 0, aggravated: 0 },
        renown: {
          glory:  { value: isWerewolf ? d5.glory  : 0 },
          honor:  { value: isWerewolf ? d5.honor  : 0 },
          wisdom: { value: isWerewolf ? d5.wisdom : 0 },
        },
        balance: {
          harano:   { value: isWerewolf ? d5.harano   : 0 },
          hauglosk: { value: isWerewolf ? d5.hauglosk : 0 },
        },
        frenzyActive: false, lostTheWolf: false,
        despair:      { value: isHunter ? d5.despair     : 0 },
        desperation:  { value: isHunter ? d5.desperation : 0 },
      },
      flags: { wod5e: { manualDefaultOwnership: true } },
    };

    try {
      const actor = await Actor.create(actorData);
      ui.notifications.info(`✅ "${actor.name}" ${LSP("Notify.Created")}`);
      setTimeout(() => { game.actors.get(actor.id)?.sheet.render(true); }, 300);
    } catch (err) {
      console.error("[wod5e-actor-item-creator] actor-creator:", err);
      ui.notifications.error(`${LSP("Notify.Error")} ${err.message}`);
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
    mod.api.WodSpcCreator       = WodSpcCreator;
    mod.api.openActorCreator    = () => WodSpcCreator.run();
  }
  console.log("[wod5e-actor-item-creator] actor-creator.js bereit.");
});

// Button im Actor-Directory (Sidebar)
Hooks.on("renderActorDirectory", (app, html) => {
  if (game.system.id !== "wod5e") return;
  if (!game.user.isGM && !game.user.hasPermission("ACTOR_CREATE")) return;
  const container = html instanceof HTMLElement ? html : html[0];
  if (container.querySelector("#wod-spc-dir-btn")) return;
  const btn = document.createElement("button");
  btn.id = "wod-spc-dir-btn"; btn.type = "button"; btn.className = "create-entry";
  btn.innerHTML = `<i class="fas fa-user-plus"></i> <span>${LW("OpenActorCreator")}</span>`;
  btn.addEventListener("click", (ev) => { ev.preventDefault(); WodSpcCreator.run(); });
  const headerActions = container.querySelector(".header-actions.action-buttons");
  if (headerActions) headerActions.appendChild(btn);
});

// Button im Actor-Sheet-Header (nur SPC, nur GM)
Hooks.on("renderActorSheet", (app, html) => {
  if (game.system.id !== "wod5e") return;
  if (app.actor?.type !== "spc") return;
  if (!game.user.isGM) return;
  const container = html instanceof HTMLElement ? html : html[0];
  if (container.querySelector("#wod-spc-sheet-btn")) return;
  const btn = document.createElement("button");
  btn.id = "wod-spc-sheet-btn"; btn.type = "button";
  btn.style.cssText = "margin:4px 0;width:100%;";
  btn.innerHTML = `<i class="fas fa-user-plus"></i> ${LW("OpenActorCreator")}`;
  btn.addEventListener("click", (ev) => { ev.preventDefault(); WodSpcCreator.run(); });
  const header = container.querySelector(".sheet-header");
  if (header) header.insertAdjacentElement("afterend", btn);
});
