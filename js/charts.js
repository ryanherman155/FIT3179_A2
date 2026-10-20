/* ==========================================================================
   charts.js — loads the 12 Vega / Vega-Lite specifications from vis/*.json
   and embeds them with vega-embed.

   The specifications themselves hold all marks, encodings, transforms and
   data URLs. This file only:
     1. applies the shared visual theme (fonts, colours, axes),
     2. sizes each chart to the width of its container (true responsive
        sizing - the spec is re-embedded at the new width, never clipped),
     3. strips the UTF-8 byte-order mark from the supplied CSV files so the
        first column name parses correctly (the CSVs themselves are unchanged),
     4. shows loading and error states.
   ========================================================================== */
(function () {
  "use strict";

  /* ---------- Shared theme (mirrors the CSS tokens in css/styles.css) ---------- */
  var FONT = "DM Sans, Helvetica Neue, Arial, sans-serif";
  var THEME = {
    background: null,
    font: FONT,
    padding: 4,
    view: { stroke: null },
    title: { font: FONT, color: "#19302e", fontSize: 13, fontWeight: 600, anchor: "start", offset: 10 },
    axis: {
      labelFont: FONT, labelFontSize: 12, labelColor: "#5d6a64",
      titleFont: FONT, titleFontSize: 12, titleFontWeight: 500, titleColor: "#5d6a64",
      domainColor: "#c9ccc2", tickColor: "#c9ccc2", gridColor: "#ecebe3", gridDash: [],
      labelPadding: 6
    },
    legend: {
      labelFont: FONT, labelFontSize: 12, labelColor: "#3f524d",
      titleFont: FONT, titleFontSize: 12, titleFontWeight: 600, titleColor: "#19302e",
      symbolStrokeWidth: 0, gradientThickness: 10, gradientLength: 180, titlePadding: 6
    },
    header: { labelFont: FONT, titleFont: FONT, labelColor: "#3f524d", labelFontSize: 13 },
    text: { font: FONT, color: "#19302e" },
    range: { category: ["#1d7a68", "#d9703f", "#7a5aa8", "#a87f22", "#2f86b8"] }
  };

  /* Number formats use d3-format defaults (comma thousands separator, point decimal),
     which match Australian conventions. */

  /* ---------- Loader: strip the BOM from CSV text ---------- */
  var baseLoader = vega.loader();
  var loader = Object.create(baseLoader);
  loader.load = function (uri, options) {
    return baseLoader.load.call(loader, uri, options).then(function (text) {
      return typeof text === "string" ? text.replace(/^﻿/, "") : text;
    });
  };

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function setParam(spec, name, value) {
    (spec.params || []).forEach(function (p) { if (p.name === name) p.value = value; });
  }

  /* ---------- Per-chart sizing --------------------------------------------
     Each entry receives the container width (px) and the parsed spec, and
     returns the spec with width/height (and any layout switches) adjusted.
     Widths leave room for axis labels; any remaining overflow is removed
     by the measure-and-refit step in render().
  ------------------------------------------------------------------------- */
  var SIZERS = {
    "01": function (w, s) {
      s.width = w - 44; s.height = clamp(w * 0.46, 260, 400);
      setParam(s, "compact", w < 620);
      return s;
    },
    "02": function (w, s) {
      var compact = w < 620;
      setParam(s, "compact", compact);
      // Leave room for the vertical colour legends on the right.
      s.vconcat.forEach(function (v) {
        v.width = w - 96;
        if (compact) { v.title = { text: v.title.text, subtitle: null }; }
      });
      return s;
    },
    "03": function (w, s) {
      var stacked = w < 700;
      if (stacked && s.hconcat) { s.vconcat = s.hconcat; delete s.hconcat; }
      var each = stacked ? w - 8 : (w - 48) / 2;
      (s.hconcat || s.vconcat).forEach(function (v) { v.width = each; v.height = each * 0.84; });
      // Dot-density dots keep the same size relative to the map at every width.
      (s.hconcat || s.vconcat)[0].layer.forEach(function (l) {
        if (l.mark && l.mark.type === "circle") l.mark.size = Math.max(5, 13 * Math.pow(each / 520, 2));
      });
      setParam(s, "compact", each < 420);
      return s;
    },
    "04": function (w, s) {
      var compact = w < 460;
      s.width = w - 8; s.height = (w - 8) * 0.82;
      // Symbol area scales with map size so circles keep the same proportion
      // to the map at every width (the legend is drawn from the same scale).
      var maxArea = Math.pow((w - 8) / (compact ? 7.5 : 6.2), 2);
      s.layer.forEach(function (l) {
        (l.layer || []).forEach(function (m) {
          var size = m.encoding && m.encoding.size;
          if (size && size.scale) {
            size.scale.range = [0, maxArea];
            if (compact) size.legend.values = [100000, 500000];
          }
        });
      });
      setParam(s, "compact", compact);
      if (compact) s.config = Object.assign({}, s.config, { legend: { layout: { bottom: { anchor: "start", direction: "vertical", margin: 6 } } } });
      return s;
    },
    "05": function (w, s) {
      s.width = clamp(w - 8, 240, 460); s.height = s.width * 0.98;
      setParam(s, "compact", w < 380);
      return s;
    },
    "06": function (w, s) {
      s.width = w - (w < 620 ? 52 : 190); s.height = clamp(w * 0.42, 300, 360);
      setParam(s, "compact", w < 620);
      return s;
    },
    "07": function (w, s) {
      s.width = w - 40; s.height = clamp(w * 0.72, 280, 380);
      return s;
    },
    "08": function (w, s) {
      var labelW = 64, gap = 18;
      var avail = w - labelW - gap - 12;
      s.hconcat[0].width = avail * 0.66;
      s.hconcat[1].width = avail * 0.34;
      if (w < 480) {
        // Shorter legends so they never set the width of a narrow column.
        s.hconcat[0].layer[0].encoding.color.legend.gradientLength = Math.min(160, avail * 0.6);
        s.hconcat[1].layer[0].encoding.color.legend.gradientLength = Math.min(110, avail * 0.3);
        s.hconcat[1].layer[0].encoding.color.legend.title = "Change";
      }
      return s;
    },
    "09": function (w, s) {
      s.width = w - 8; s.height = clamp(w * 0.86, 300, 520);
      return s;
    },
    "10": function (w, s) {
      var compact = w < 560;
      setParam(s, "compact", compact);
      if (compact) {
        // On narrow screens the counts column is dropped (counts stay in the tooltips).
        s.hconcat.splice(1, 1);
        s.hconcat[0].encoding.x.scale.padding = 2.1;
        s.hconcat[0].layer[2].mark.fontSize = 11;
        s.hconcat[0].layer[3].mark.fontSize = 11;
        s.hconcat[1].layer[0].encoding.color.legend.gradientLength = 80;
        s.hconcat[0].width = (w - 30) * 0.58;
        s.hconcat[1].width = (w - 30) * 0.42;
      } else {
        var avail = w - 60;
        s.hconcat[0].width = avail * 0.38;
        s.hconcat[1].width = avail * 0.34;
        s.hconcat[2].width = avail * 0.28;
      }
      return s;
    },
    "11": function (w, s) {
      s.width = w - 8;
      return s;
    },
    "12": function (w, s) {
      s.width = clamp(w - 8, 260, 520);
      setParam(s, "compact", w < 440);
      return s;
    }
  };

  /* ---------- Embedding ---------- */
  var registry = {};
  window.__chartStatus = {};

  function showError(el, id, err) {
    el.removeAttribute("data-state");
    el.innerHTML =
      '<div class="chart-error" role="alert"><strong>This chart could not be displayed.</strong> ' +
      'The specification is still available at <a href="vis/' + id + '.json">vis/' + id + ".json</a>.</div>";
    window.__chartStatus[id] = "error: " + (err && err.message ? err.message : err);
    if (window.console) console.error("Chart " + id + " failed:", err);
  }

  /* Render at the container width. Legends, axis labels and concatenated
     views can make the finished SVG a little wider than the size budget, so
     after rendering the natural SVG width is measured; if it overflows, the
     chart is re-rendered with a smaller budget (at most three passes). The
     chart is therefore always laid out by Vega at a width that fits, rather
     than being shrunk by CSS. */
  function render(entry, refit) {
    var el = entry.el;
    var width = Math.floor(el.clientWidth);
    if (!width) return Promise.resolve();
    if (!refit) {
      if (Math.abs(width - entry.lastWidth) < 6) return Promise.resolve();
      entry.lastWidth = width;
      entry.shrink = 0;
      entry.fitPass = 0;
    }
    var spec = JSON.parse(JSON.stringify(entry.spec));
    spec = (SIZERS[entry.id] || function (w, s) { return s; })(width - entry.shrink, spec);
    if (entry.view) { entry.view.finalize(); entry.view = null; }
    return vegaEmbed(el, spec, {
      renderer: "svg",
      actions: false,
      loader: loader,
      config: THEME,
      tooltip: { theme: "custom" },
      ast: false
    }).then(function (res) {
      entry.view = res.view;
      el.removeAttribute("data-state");
      if (el.querySelector(".vega-bindings")) el.classList.add("has-controls-top");
      var svg = el.querySelector("svg");
      var natural = svg ? +svg.getAttribute("width") : 0;
      if (natural > width + 1 && entry.fitPass < 4 && entry.shrink < width * 0.4) {
        entry.shrink += natural - width + 4;
        entry.fitPass += 1;
        return render(entry, true);
      }
      if (svg && entry.label) { svg.setAttribute("aria-label", entry.label); svg.setAttribute("role", "img"); }
      window.__chartStatus[entry.id] = "ok";
    }).catch(function (err) { showError(el, entry.id, err); });
  }

  function debounce(fn, ms) {
    var t; return function () { clearTimeout(t); t = setTimeout(fn, ms); };
  }

  function init() {
    var nodes = document.querySelectorAll("[data-vis]");
    var jobs = [];
    Array.prototype.forEach.call(nodes, function (el) {
      var id = el.getAttribute("data-vis");
      el.setAttribute("data-state", "loading");
      window.__chartStatus[id] = "loading";
      var entry = { id: id, el: el, spec: null, view: null, lastWidth: -100, shrink: 0, fitPass: 0, label: el.getAttribute("aria-label") };
      registry[id] = entry;
      jobs.push(
        fetch("vis/" + id + ".json")
          .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status + " for vis/" + id + ".json"); return r.json(); })
          .then(function (spec) {
            entry.spec = spec;
            var ro = new ResizeObserver(debounce(function () { render(entry); }, 160));
            ro.observe(el);
            return render(entry);
          })
          .catch(function (err) { showError(el, id, err); })
      );
    });
    Promise.all(jobs).then(function () { window.__chartsReady = true; document.documentElement.classList.add("charts-ready"); });
  }

  window.BA = window.BA || {};
  window.BA.loader = loader;
  window.BA.charts = registry;

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
