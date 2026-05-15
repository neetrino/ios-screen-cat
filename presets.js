/* global window */
(function () {
  "use strict";

  /** @typedef {{ id: string, w: number, h: number, label: string }} Preset */

  /**
   * App Store Connect — скриншоты iPhone 6.5" (только эти размеры).
   * @see https://developer.apple.com/help/app-store-connect/reference/screenshots/
   */
  /** @type {readonly Preset[]} */
  const iphone = Object.freeze([
    {
      id: "1242x2688",
      w: 1242,
      h: 2688,
      label: "iPhone · 1242×2688 или 2688×1242 (Connect)",
    },
    {
      id: "1284x2778",
      w: 1284,
      h: 2778,
      label: "iPhone · 1284×2778 или 2778×1284 (Connect)",
    },
  ]);

  /**
   * App Store Connect — iPad 12.9" / 13" (только эти размеры).
   */
  /** @type {readonly Preset[]} */
  const ipad = Object.freeze([
    {
      id: "2064x2752",
      w: 2064,
      h: 2752,
      label: "iPad 12.9\" / 13\" · 2064×2752 или 2752×2064 (Connect)",
    },
    {
      id: "2048x2732",
      w: 2048,
      h: 2732,
      label: "iPad 12.9\" / 13\" · 2048×2732 или 2732×2048 (Connect)",
    },
  ]);

  /**
   * @param {number} iw
   * @param {number} ih
   * @param {Preset} preset
   */
  function outputDimsForImage(iw, ih, preset) {
    const portrait = iw <= ih;
    const pw = Math.min(preset.w, preset.h);
    const ph = Math.max(preset.w, preset.h);
    return portrait ? { ow: pw, oh: ph } : { ow: ph, oh: pw };
  }

  /**
   * Ближайший допустимый размер из списка: минимизируем квадратичную ошибку
   * в лог-масштабе по ширине и высоте выхода относительно исходника.
   *
   * @param {number} iw
   * @param {number} ih
   * @param {readonly Preset[]} list
   * @returns {Preset}
   */
  function pickClosest(iw, ih, list) {
    let best = list[0];
    let bestScore = Number.POSITIVE_INFINITY;
    for (const p of list) {
      const { ow, oh } = outputDimsForImage(iw, ih, p);
      const lx = Math.log(ow) - Math.log(iw);
      const ly = Math.log(oh) - Math.log(ih);
      const score = lx * lx + ly * ly;
      if (score < bestScore) {
        bestScore = score;
        best = p;
      }
    }
    return best;
  }

  window.AppStorePresets = {
    iphone,
    ipad,
    pickClosest,
  };
})();
