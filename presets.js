/* global window */
(function () {
  "use strict";

  /** @typedef {{ id: string, w: number, h: number, label: string }} Preset */

  /** @type {readonly Preset[]} */
  const iphone = Object.freeze([
    { id: "1320x2868", w: 1320, h: 2868, label: 'iPhone 6.9" · 1320×2868' },
    { id: "1290x2796", w: 1290, h: 2796, label: 'iPhone 6.9" · 1290×2796' },
    { id: "1260x2736", w: 1260, h: 2736, label: 'iPhone 6.9" · 1260×2736' },
    { id: "1284x2778", w: 1284, h: 2778, label: 'iPhone 6.5" · 1284×2778' },
    { id: "1242x2688", w: 1242, h: 2688, label: 'iPhone 6.5" · 1242×2688' },
    { id: "1206x2622", w: 1206, h: 2622, label: 'iPhone 6.3" · 1206×2622' },
    { id: "1179x2556", w: 1179, h: 2556, label: 'iPhone 6.3" · 1179×2556' },
    { id: "1170x2532", w: 1170, h: 2532, label: 'iPhone 6.1" · 1170×2532' },
    { id: "1125x2436", w: 1125, h: 2436, label: 'iPhone 6.1" · 1125×2436' },
    { id: "1080x2340", w: 1080, h: 2340, label: 'iPhone 6.1" · 1080×2340' },
    { id: "1242x2208", w: 1242, h: 2208, label: 'iPhone 5.5" · 1242×2208' },
    { id: "750x1334", w: 750, h: 1334, label: 'iPhone 4.7" · 750×1334' },
  ]);

  /** Dedup same dimensions */
  const iphoneDedup = iphone.filter((p, i, arr) => {
    const key = `${p.w}x${p.h}`;
    return arr.findIndex((x) => `${x.w}x${x.h}` === key) === i;
  });

  /** @type {readonly Preset[]} */
  const ipad = Object.freeze([
    { id: "2064x2752", w: 2064, h: 2752, label: 'iPad 13" · 2064×2752' },
    { id: "2048x2732", w: 2048, h: 2732, label: 'iPad 13" / 12.9" · 2048×2732' },
    { id: "1668x2420", w: 1668, h: 2420, label: 'iPad 11" · 1668×2420' },
    { id: "1668x2388", w: 1668, h: 2388, label: 'iPad 11" · 1668×2388' },
    { id: "1640x2360", w: 1640, h: 2360, label: 'iPad 11" / 10.9" · 1640×2360' },
    { id: "1488x2266", w: 1488, h: 2266, label: 'iPad 11" · 1488×2266' },
    { id: "1668x2224", w: 1668, h: 2224, label: 'iPad 10.5" · 1668×2224' },
  ]);

  /**
   * @param {number} iw
   * @param {number} ih
   * @param {readonly Preset[]} list
   * @returns {Preset}
   */
  function pickClosest(iw, ih, list) {
    const L = Math.max(iw, ih);
    const S = Math.min(iw, ih);
    const rImg = L / S;
    let best = list[0];
    let bestScore = Number.POSITIVE_INFINITY;
    for (const p of list) {
      const long = Math.max(p.w, p.h);
      const short = Math.min(p.w, p.h);
      const r = long / short;
      const score = Math.abs(Math.log(rImg) - Math.log(r));
      if (score < bestScore) {
        bestScore = score;
        best = p;
      }
    }
    return best;
  }

  window.AppStorePresets = {
    iphone: iphoneDedup,
    ipad,
    pickClosest,
  };
})();
