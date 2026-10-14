/* ==========================================================================
   main.js — page behaviour that is not a chart.

   1. Data-bound story numbers. Every number quoted in the narrative is marked
      up as <span data-stat="key">fallback</span>. On load, the same CSV files
      the charts use are read and each value is recalculated here. The
      fallback text is replaced with the computed value, and any mismatch is
      reported in the console (window.__statMismatches). This keeps the prose
      consistent with the data rather than hard-coded by hand.
   2. Reading-progress bar and active chapter link.
   3. Gentle reveal-on-scroll (disabled for prefers-reduced-motion).
   ========================================================================== */
(function () {
  "use strict";

  var loader = (window.BA && window.BA.loader) || vega.loader();

  function readCSV(path) {
    return loader.load(path).then(function (text) {
      return vega.read(text, { type: "csv", parse: "auto" });
    });
  }

  function fixed(n) { return function (v) { return Number(v).toFixed(n); }; }
  var f1 = fixed(1), f2 = fixed(2), f0 = fixed(0);
  function comma(v) { return Math.round(v).toLocaleString("en-AU"); }
  function find(rows, key, val) { return rows.filter(function (r) { return r[key] === val; })[0]; }

  function computeStats(d) {
    var pop = {};
    d.timeline.forEach(function (r) { pop[r.year] = r.population; });

    var fastest = d.intervals.reduce(function (a, b) { return b.annualised_growth_percent > a.annualised_growth_percent ? b : a; });
    var mostAdded = d.intervals.reduce(function (a, b) { return b.absolute_growth > a.absolute_growth ? b : a; });

    var states2021 = d.states.reduce(function (s, r) { return s + r.population_2021; }, 0);
    var nsw = find(d.states, "state_code", "NSW").population_2021;
    var vic = find(d.states, "state_code", "VIC").population_2021;

    var age = function (year, group) {
      return find(d.age.filter(function (r) { return r.year === year; }), "age_group", group).percent_of_total;
    };
    var india = find(d.birthGrowth, "country_of_birth", "India");
    var top5 = d.birthTop.reduce(function (s, r) { return s + r.population_2021; }, 0);
    var hh = function (y) { return find(d.households, "year", y).average_people_per_household_rounded; };

    return {
      pop2021_m: f1(pop[2021] / 1e6),
      pop1911_m2: f2(pop[1911] / 1e6),
      pop1971_m: f1(pop[1971] / 1e6),
      ratio_1911_2021: f1(pop[2021] / pop[1911]),
      added_2011_2021_m: f1((pop[2021] - pop[2011]) / 1e6),
      max_added_m: f2(mostAdded.absolute_growth / 1e6),
      max_added_interval: mostAdded.start_year + " and " + mostAdded.end_year,
      fastest_rate: f2(fastest.annualised_growth_percent),
      fastest_interval: fastest.start_year + "–" + fastest.end_year,
      nsw_vic_share: f1((nsw + vic) / pop[2021] * 100),
      other_territories: comma(pop[2021] - states2021),
      age65_2011: f1(age(2011, "65+")),
      age65_2021: f1(age(2021, "65+")),
      india_growth: f1(india.growth_percent),
      india_added: comma(india.growth_persons),
      top5_total_m: f2(top5 / 1e6),
      top5_share: f1(top5 / pop[2021] * 100),
      hh_1911: f1(hh(1911)),
      hh_2021: f1(hh(2021)),
      one_person: f0(find(d.oneperson, "household_type", "One-person household").percent_rounded)
    };
  }

  function bindStats() {
    var files = {
      timeline: "data/01_historical_population_timeline.csv",
      intervals: "data/02_intercensal_growth_heatstrip.csv",
      states: "data/03_state_population_choropleth.csv",
      age: "data/08_age_group_heatmap.csv",
      birthTop: "data/09_birthplace_top_five_circles.csv",
      birthGrowth: "data/10_birthplace_growth_matrix.csv",
      households: "data/11_household_size_isotype.csv",
      oneperson: "data/12_one_person_household_waffle.csv"
    };
    var keys = Object.keys(files);
    return Promise.all(keys.map(function (k) { return readCSV(files[k]); })).then(function (results) {
      var d = {};
      keys.forEach(function (k, i) { d[k] = results[i]; });
      var stats = computeStats(d);
      var mismatches = [];
      document.querySelectorAll("[data-stat]").forEach(function (el) {
        var key = el.getAttribute("data-stat");
        if (!(key in stats)) { mismatches.push({ key: key, problem: "no computed value" }); return; }
        var fallback = el.textContent.trim();
        if (fallback !== stats[key]) mismatches.push({ key: key, fallback: fallback, computed: stats[key] });
        el.textContent = stats[key];
      });
      window.__statMismatches = mismatches;
      window.__stats = stats;
      if (mismatches.length && window.console) console.warn("Story numbers updated from data:", mismatches);
    }).catch(function (err) {
      // The fallback text already in the HTML remains visible.
      window.__statMismatches = [{ problem: "could not load data: " + err }];
    });
  }

  /* ---------- Progress bar and active chapter ---------- */
  function initNav() {
    var bar = document.querySelector(".progress");
    var links = Array.prototype.slice.call(document.querySelectorAll(".navlinks a"));
    var sections = links.map(function (a) { return document.querySelector(a.getAttribute("href")); });
    var ticking = false;
    function update() {
      ticking = false;
      var doc = document.documentElement;
      var max = doc.scrollHeight - window.innerHeight;
      if (bar) bar.style.width = (max > 0 ? (window.scrollY / max) * 100 : 0) + "%";
      var current = -1;
      sections.forEach(function (s, i) { if (s && s.getBoundingClientRect().top < window.innerHeight * 0.35) current = i; });
      links.forEach(function (a, i) {
        a.classList.toggle("active", i === current);
        if (i === current) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current");
      });
    }
    window.addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    update();
  }

  /* ---------- Reveal on scroll ---------- */
  function initReveal() {
    var items = document.querySelectorAll(".reveal");
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !("IntersectionObserver" in window)) {
      items.forEach(function (el) { el.classList.add("is-visible"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("is-visible"); io.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    items.forEach(function (el) { io.observe(el); });
  }

  function init() { bindStats(); initNav(); initReveal(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
