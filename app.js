/* global JSZip, AppStorePresets */
(function () {
  "use strict";

  /** @typedef {{ id: string, w: number, h: number, label: string }} Preset */
  /** @typedef {{ id: string, file: File, w: number, h: number, url: string }} Queued */

  /** Макс. скриншотов на слот (App Store Connect). */
  const MAX_SCREENSHOTS_PER_SLOT = 10;

  /** @type {{ iphone: Queued[], ipad: Queued[] }} */
  const queues = { iphone: [], ipad: [] };

  const btnZip = document.getElementById("btn-zip");
  const statusNote = document.getElementById("status-note");
  const iphoneSelect = document.querySelector('[data-role="iphone-preset"]');
  const ipadSelect = document.querySelector('[data-role="ipad-preset"]');

  if (
    !btnZip ||
    !statusNote ||
    !(iphoneSelect instanceof HTMLSelectElement) ||
    !(ipadSelect instanceof HTMLSelectElement) ||
    !window.AppStorePresets
  ) {
    return;
  }

  const iphonePresets = window.AppStorePresets.iphone;
  const ipadPresets = window.AppStorePresets.ipad;
  const pickClosest = window.AppStorePresets.pickClosest;

  /**
   * @param {HTMLSelectElement} el
   * @param {readonly Preset[]} presets
   */
  function fillSelect(el, presets) {
    el.innerHTML = "";
    const auto = document.createElement("option");
    auto.value = "auto";
    auto.textContent = "Авто — ближайший размер из списка Connect";
    el.appendChild(auto);
    for (const p of presets) {
      const o = document.createElement("option");
      o.value = p.id;
      o.textContent = p.label;
      el.appendChild(o);
    }
  }

  /** @param {Queued} q */
  function revokeQueued(q) {
    URL.revokeObjectURL(q.url);
  }

  function uid() {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  /** @param {File} file */
  function isAcceptedImage(file) {
    const ok = file.type === "image/png" || file.type === "image/jpeg" || file.type === "image/jpg";
    return ok && file.size > 0;
  }

  /**
   * @param {"iphone"|"ipad"} slot
   * @param {File[]} files
   */
  function addFiles(slot, files) {
    statusNote.textContent = "";
    statusNote.classList.remove("is-error");
    const list = files.filter(isAcceptedImage);
    if (list.length === 0 && files.length > 0) {
      statusNote.textContent = "Поддерживаются только PNG и JPEG.";
      statusNote.classList.add("is-error");
      return;
    }
    const room = MAX_SCREENSHOTS_PER_SLOT - queues[slot].length;
    if (room <= 0) {
      statusNote.textContent = `Не больше ${MAX_SCREENSHOTS_PER_SLOT} скриншотов на ${slot === "iphone" ? "iPhone" : "iPad"}.`;
      statusNote.classList.add("is-error");
      return;
    }
    const toAdd = list.slice(0, room);
    if (toAdd.length < list.length) {
      statusNote.textContent = `Добавлено ${toAdd.length} из ${list.length} (лимит ${MAX_SCREENSHOTS_PER_SLOT} скриншотов на слот).`;
    }
    for (const file of toAdd) {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        queues[slot].push({
          id: uid(),
          file,
          w: img.naturalWidth,
          h: img.naturalHeight,
          url,
        });
        renderList(slot);
        syncButton();
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        statusNote.textContent = "Не удалось прочитать изображение.";
        statusNote.classList.add("is-error");
      };
      img.src = url;
    }
  }

  /**
   * @param {number} iw
   * @param {number} ih
   * @param {Preset} preset
   */
  function outputDims(iw, ih, preset) {
    const portrait = iw <= ih;
    const pw = Math.min(preset.w, preset.h);
    const ph = Math.max(preset.w, preset.h);
    return portrait ? { ow: pw, oh: ph } : { ow: ph, oh: pw };
  }

  /**
   * @param {"iphone"|"ipad"} slot
   * @param {number} iw
   * @param {number} ih
   * @returns {Preset}
   */
  function resolvePreset(slot, iw, ih) {
    const sel = slot === "iphone" ? iphoneSelect : ipadSelect;
    const list = slot === "iphone" ? iphonePresets : ipadPresets;
    if (sel.value === "auto") return pickClosest(iw, ih, list);
    const found = list.find((p) => p.id === sel.value);
    return found ?? pickClosest(iw, ih, list);
  }

  /** JPEG quality for App Store exports (0…1). */
  const JPEG_QUALITY = 0.92;

  /**
   * @param {HTMLImageElement | HTMLCanvasElement} source
   * @param {number} iw
   * @param {number} ih
   * @param {number} ow
   * @param {number} oh
   * @returns {Promise<Blob>}
   */
  function renderCoverJpeg(source, iw, ih, ow, oh) {
    const canvas = document.createElement("canvas");
    canvas.width = ow;
    canvas.height = oh;
    const ctx = canvas.getContext("2d");
    if (!ctx) return Promise.reject(new Error("Canvas unsupported"));
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, ow, oh);
    const scale = Math.max(ow / iw, oh / ih);
    const sw = ow / scale;
    const sh = oh / scale;
    const sx = (iw - sw) / 2;
    const sy = (ih - sh) / 2;
    ctx.drawImage(source, sx, sy, sw, sh, 0, 0, ow, oh);
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("toBlob failed"));
        },
        "image/jpeg",
        JPEG_QUALITY
      );
    });
  }

  /** @param {string} name */
  function safeZipName(name) {
    const base = name.replace(/[^\w\-. ()\[\]]+/g, "_").replace(/\s+/g, " ").trim();
    return base.length ? base : "image.jpg";
  }

  /** @param {Set<string>} used */
  function allocateName(used, baseName) {
    let name = baseName;
    let i = 1;
    while (used.has(name)) {
      const dot = baseName.lastIndexOf(".");
      const stem = dot === -1 ? baseName : baseName.slice(0, dot);
      const ext = dot === -1 ? "" : baseName.slice(dot);
      name = `${stem}-${i}${ext}`;
      i += 1;
    }
    used.add(name);
    return name;
  }

  /** @param {"iphone"|"ipad"} slot */
  function renderList(slot) {
    const ul = document.querySelector(`[data-list="${slot}"]`);
    if (!ul) return;
    ul.innerHTML = "";
    const sel = slot === "iphone" ? iphoneSelect : ipadSelect;
    for (const q of queues[slot]) {
      const applied = resolvePreset(slot, q.w, q.h);
      const { ow, oh } = outputDims(q.w, q.h, applied);
      const mode = sel.value === "auto" ? "авто" : "вручную";
      const li = document.createElement("li");
      li.className = "file-row";
      const left = document.createElement("div");
      const title = document.createElement("div");
      title.textContent = q.file.name;
      const meta = document.createElement("div");
      meta.className = "file-meta";
      meta.textContent = `${q.w}×${q.h} → ${ow}×${oh} · ${applied.label} (${mode})`;
      left.appendChild(title);
      left.appendChild(meta);
      const rm = document.createElement("button");
      rm.type = "button";
      rm.className = "file-remove";
      rm.textContent = "Удалить";
      rm.addEventListener("click", () => {
        queues[slot] = queues[slot].filter((x) => x.id !== q.id);
        revokeQueued(q);
        renderList(slot);
        syncButton();
      });
      li.appendChild(left);
      li.appendChild(rm);
      ul.appendChild(li);
    }
  }

  function syncButton() {
    const n = queues.iphone.length + queues.ipad.length;
    btnZip.disabled = n === 0;
  }

  /** @param {"iphone"|"ipad"} slot */
  function wireDropzone(slot) {
    const panel = document.querySelector(`section[data-device="${slot}"]`);
    if (!panel) return;
    const zone = panel.querySelector(".dropzone");
    const input = panel.querySelector(".file-input");
    if (!zone || !input || !(input instanceof HTMLInputElement)) return;

    zone.addEventListener("click", () => input.click());
    zone.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        input.click();
      }
    });
    input.addEventListener("change", () => {
      if (input.files) addFiles(slot, Array.from(input.files));
      input.value = "";
    });
    ["dragenter", "dragover"].forEach((ev) => {
      zone.addEventListener(ev, (e) => {
        e.preventDefault();
        zone.classList.add("is-drag");
      });
    });
    ["dragleave", "drop"].forEach((ev) => {
      zone.addEventListener(ev, (e) => {
        e.preventDefault();
        zone.classList.remove("is-drag");
      });
    });
    zone.addEventListener("drop", (e) => {
      const dt = e.dataTransfer;
      if (!dt || !dt.files) return;
      addFiles(slot, Array.from(dt.files));
    });
  }

  function onPresetChange() {
    renderList("iphone");
    renderList("ipad");
  }

  async function buildZip() {
    if (typeof JSZip === "undefined") throw new Error("JSZip не загрузился (проверьте сеть).");
    const zip = new JSZip();
    const folderIphone = zip.folder("iphone");
    const folderIpad = zip.folder("ipad");
    if (!folderIphone || !folderIpad) throw new Error("ZIP folders");

    const usedIphone = new Set();
    const usedIpad = new Set();

    for (const q of queues.iphone) {
      const preset = resolvePreset("iphone", q.w, q.h);
      const { ow, oh } = outputDims(q.w, q.h, preset);
      const img = new Image();
      await new Promise((res, rej) => {
        img.onload = () => res(undefined);
        img.onerror = () => rej(new Error("Не удалось загрузить изображение."));
        img.src = q.url;
      });
      const blob = await renderCoverJpeg(img, q.w, q.h, ow, oh);
      const base = safeZipName(q.file.name.replace(/\.[^.]+$/, ".jpg"));
      const name = allocateName(usedIphone, base);
      folderIphone.file(name, blob);
    }
    for (const q of queues.ipad) {
      const preset = resolvePreset("ipad", q.w, q.h);
      const { ow, oh } = outputDims(q.w, q.h, preset);
      const img = new Image();
      await new Promise((res, rej) => {
        img.onload = () => res(undefined);
        img.onerror = () => rej(new Error("Не удалось загрузить изображение."));
        img.src = q.url;
      });
      const blob = await renderCoverJpeg(img, q.w, q.h, ow, oh);
      const base = safeZipName(q.file.name.replace(/\.[^.]+$/, ".jpg"));
      const name = allocateName(usedIpad, base);
      folderIpad.file(name, blob);
    }

    const bytes = await zip.generateAsync({ type: "blob" });
    const a = document.createElement("a");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    a.href = URL.createObjectURL(bytes);
    a.download = `app-store-screenshots-${stamp}.zip`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  btnZip.addEventListener("click", async () => {
    statusNote.textContent = "Собираем ZIP…";
    statusNote.classList.remove("is-error");
    btnZip.disabled = true;
    try {
      await buildZip();
      statusNote.textContent =
        "Готово. В архиве JPEG-файлы в папках iphone/ и ipad/.";
    } catch (e) {
      statusNote.textContent = e instanceof Error ? e.message : "Ошибка при сборке ZIP.";
      statusNote.classList.add("is-error");
    } finally {
      syncButton();
    }
  });

  fillSelect(iphoneSelect, iphonePresets);
  fillSelect(ipadSelect, ipadPresets);
  iphoneSelect.addEventListener("change", onPresetChange);
  ipadSelect.addEventListener("change", onPresetChange);
  wireDropzone("iphone");
  wireDropzone("ipad");
  syncButton();
})();
