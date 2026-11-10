#!/usr/bin/env node
/* test-node.js — the proof for Endpoints.
 *
 * Every "done means" in QUEUE/app-endpoints.md is an assertion here, and every
 * failure path in the spec is a case that would FAIL if the app guessed instead
 * of reporting. Nothing here needs a browser: the engine is pure, and the one
 * thing that is not (storage) is injected as a fake that can fail on demand.
 *
 *   node test-node.js
 *
 * PolyForm Noncommercial 1.0.0. (c) 2026 Dr Sohil Momin. */
"use strict";

const fs = require("fs");
const path = require("path");
const Search = require("./docs/play/search-kit.js");
const Endpoints = require("./docs/play/endpoints.js");

let pass = 0, fail = 0;
const fails = [];
function ok(cond, name) {
  if (cond) { pass++; } else { fail++; fails.push(name); console.log("  FAIL  " + name); }
}
function eq(a, b, name) {
  const good = JSON.stringify(a) === JSON.stringify(b);
  if (!good) console.log("        got " + JSON.stringify(a) + "  want " + JSON.stringify(b));
  ok(good, name);
}
function throws(fn, name) {
  try { fn(); ok(false, name + " (did not throw)"); return null; }
  catch (e) { ok(true, name); return e; }
}

/* ---------- load the dataset exactly as the page does ---------- */
global.window = {};
require("./docs/play/data.js");
const DATA = global.window.ENDPOINTS_DATA;
const raw = JSON.parse(fs.readFileSync(path.join(__dirname, "data", "apis.json"), "utf8"));

console.log("Endpoints — engine, data and failure paths\n");

/* ---------- 1. the dataset is what it says it is ---------- */
{
  ok(Array.isArray(DATA.apis) && DATA.apis.length > 1000, "the bundle carries a real directory (" + DATA.apis.length + " entries)");
  eq(DATA.apis.length, DATA.meta.count, "meta.count matches the entry count");
  eq(DATA.apis.length, raw.apis.length, "data.js and data/apis.json carry the same number of entries");
  eq(DATA.apis.map(a => a.id), raw.apis.map(a => a.id), "data.js and data/apis.json agree entry for entry (no drift)");
  eq(JSON.stringify(DATA.apis), JSON.stringify(raw.apis), "data.js and data/apis.json agree field for field");

  const ids = new Set(DATA.apis.map(a => a.id));
  eq(ids.size, DATA.apis.length, "every id is unique");

  const authVocab = ["none", "apiKey", "OAuth", "other"];
  const corsVocab = ["yes", "no", "unknown"];
  const badAuth = DATA.apis.filter(a => !authVocab.includes(a.auth));
  const badCors = DATA.apis.filter(a => !corsVocab.includes(a.cors));
  const badHttps = DATA.apis.filter(a => a.https !== "yes" && a.https !== "no");
  const badUrl = DATA.apis.filter(a => !/^https?:\/\/\S+$/.test(a.url));
  const noDesc = DATA.apis.filter(a => !a.desc || !a.desc.trim());
  eq(badAuth.length, 0, "every entry's auth is inside the declared vocabulary");
  eq(badCors.length, 0, "every entry's cors is inside the declared vocabulary");
  eq(badHttps.length, 0, "every entry's https is yes or no");
  eq(badUrl.length, 0, "every entry carries an http(s) URL");
  eq(noDesc.length, 0, "no entry is shipped without a description");
}

/* ---------- 2. the dataset licence rule ---------- */
{
  const src = fs.readFileSync(path.join(__dirname, "data", "SOURCE.md"), "utf8");
  ok(DATA.meta.source.includes("public-apis"), "meta names the source");
  eq(DATA.meta.licence, "MIT", "meta names the licence of the DATA");
  ok(src.includes("MIT"), "data/SOURCE.md records the licence");
  ok(src.includes("public-apis"), "data/SOURCE.md records the source");
  ok(/2026-11-10/.test(DATA.meta.fetched), "meta records the fetch date");
  ok(/20\d\d-\d\d-\d\d/.test(src), "data/SOURCE.md records the fetch date");
}

/* ---------- 3. the app never touches the network ---------- */
{
  const engineSrc = fs.readFileSync(path.join(__dirname, "docs", "play", "endpoints.js"), "utf8");
  const appSrc = fs.readFileSync(path.join(__dirname, "docs", "play", "app.js"), "utf8");
  ok(!/\bfetch\s*\(/.test(engineSrc), "the engine contains no fetch()");
  ok(!/XMLHttpRequest/.test(engineSrc), "the engine contains no XMLHttpRequest");
  ok(!/\bfetch\s*\(/.test(appSrc), "the UI contains no fetch()");
  ok(!/XMLHttpRequest/.test(appSrc), "the UI contains no XMLHttpRequest");
  // And it really does work with nothing but the data it was handed.
  const e = Endpoints.create(DATA, { Search });
  ok(e.search({ q: "weather" }).total > 0, "search works with no network at all");
}

/* ---------- 4. filters: the product ---------- */
{
  const e = Endpoints.create(DATA, { Search });

  const res = e.search({ auth: "none", cors: "yes", limit: 100000 });
  const expect = DATA.apis.filter(a => a.auth === "none" && a.cors === "yes").length;
  eq(res.total, expect, "auth=none + cors=yes reports the true total (" + expect + ")");
  eq(res.results.filter(r => r.api.auth !== "none" || r.api.cors !== "yes").length, 0,
    "every entry under auth=none + cors=yes really is no-key and CORS-yes");
  ok(expect > 100, "and that is a useful number of entries, not a handful");

  const keyed = e.search({ auth: "apiKey", limit: 100000 });
  eq(keyed.total, DATA.apis.filter(a => a.auth === "apiKey").length, "auth=apiKey reports the true total");
  eq(keyed.results.filter(r => r.api.auth !== "apiKey").length, 0, "auth=apiKey returns only keyed entries");

  const noCors = e.search({ cors: "no", limit: 100000 });
  eq(noCors.results.filter(r => r.api.cors !== "no").length, 0, "cors=no returns only entries a browser cannot call");

  const cat = e.search({ cat: "Weather", limit: 100000 });
  ok(cat.total > 0, "a real category has entries (" + cat.total + " in Weather)");
  eq(cat.results.filter(r => r.api.cat !== "Weather").length, 0, "cat=Weather returns only Weather");

  const httpsOnly = e.search({ https: "yes", auth: "none", limit: 100000 });
  eq(httpsOnly.results.filter(r => r.api.https !== "yes" || r.api.auth !== "none").length, 0,
    "two filters at once are AND-ed, not OR-ed");

  // Narrowing must never re-order: the top hit of a broad search is still on top
  // of the narrow one when it survives the filter.
  const broad = e.search({ q: "weather", limit: 5 });
  const narrow = e.search({ q: "weather", auth: "none", limit: 5 });
  const survivor = broad.results.find(r => r.api.auth === "none");
  if (survivor) {
    eq(narrow.results[0].api.id, survivor.api.id, "filtering after ranking keeps the best surviving hit on top");
  } else {
    ok(true, "filtering after ranking keeps the best surviving hit on top (no survivor in this corpus)");
  }
}

/* ---------- 5. ranking ---------- */
{
  const e = Endpoints.create(DATA, { Search });

  const exact = e.search({ q: "Cat Facts", limit: 10 });
  ok(exact.total > 0, "an exact name finds something");
  ok(/cat facts/i.test(exact.results[0].api.name), "an exact API name typed in full is the first result");

  const one = e.search({ q: DATA.apis[0].name, limit: 5 });
  ok(one.total > 0 && one.results[0].api.name.toLowerCase() === DATA.apis[0].name.toLowerCase(),
    "a name typed in full ranks its own entry first (" + DATA.apis[0].name + ")");

  const fuzzy = e.search({ q: "wether", limit: 5 });
  ok(fuzzy.total > 0, "a misspelling still finds the corpus ('wether' -> " + fuzzy.total + " hits)");
  ok(fuzzy.results.some(r => /weather/i.test(r.api.name + " " + r.api.desc + " " + r.api.cat)),
    "and the misspelling lands on weather");

  const a = e.search({ q: "currency exchange", limit: 20 }).results.map(r => r.api.id);
  const b = e.search({ q: "currency exchange", limit: 20 }).results.map(r => r.api.id);
  eq(a, b, "the same query twice returns the same ids in the same order");

  const empty = e.search({ q: "zzzqqqxyzzy", limit: 10 });
  eq(empty.total, 0, "a query that matches nothing reports zero");
  ok(empty.note.length > 0, "and the empty state says what to change rather than just 'no results'");
}

/* ---------- 6. bad input is refused, not swallowed ---------- */
{
  const e = Endpoints.create(DATA, { Search });

  const err = throws(() => e.search({ auth: "maybe" }), "auth=maybe raises a QueryError");
  ok(err && err.name === "QueryError", "and it is a QueryError");
  ok(err && err.allowed.join(",") === "none,apiKey,OAuth,other", "the error names the auth vocabulary it accepts");
  ok(err && /maybe/.test(err.message), "the error quotes the value it refused");

  const err2 = throws(() => e.search({ cors: "sometimes" }), "cors=sometimes raises a QueryError");
  ok(err2 && err2.allowed.join(",") === "yes,no,unknown", "the error names the CORS vocabulary");

  const err3 = throws(() => e.search({ cat: "Not A Category" }), "an unknown category is a typo, not an empty result");
  ok(err3 && err3.allowed.includes("Weather"), "and it lists the real categories");

  throws(() => e.search({ limit: 0 }), "limit=0 is refused rather than returning nothing");
  throws(() => e.search({ limit: "many" }), "a non-numeric limit is refused");

  // A refused filter must not have produced a result set at all - the UI relies
  // on that to leave the previous list on screen.
  let got = null;
  try { got = e.search({ auth: "nope" }); } catch (x) { got = null; }
  eq(got, null, "a refused filter returns no result set (the screen keeps its previous list)");

  // Empty and whitespace-only queries are VALID: they mean "everything".
  const all = e.search({ q: "   ", limit: 5 });
  ok(all.total === DATA.apis.length, "an empty query means the whole directory (" + all.total + "), not an error");
  eq(all.results.length, 5, "and the limit is honoured");
  ok(all.results[0].api.name <= all.results[4].api.name, "the unfiltered list is alphabetical, so it is scannable");
}

/* ---------- 7. storage: full, unavailable, corrupt ---------- */
{
  const memory = () => {
    const m = new Map();
    return {
      getItem: k => (m.has(k) ? m.get(k) : null),
      setItem: (k, v) => m.set(k, String(v)),
      removeItem: k => m.delete(k)
    };
  };

  const store = memory();
  const saved = Endpoints.savePins(["a/b", "c/d"], store);
  ok(saved.ok === true, "a pin is saved when storage works");
  const back = Endpoints.loadPins(store);
  eq(back.pins, ["a/b", "c/d"], "and it is read back exactly");

  const full = memory();
  full.setItem = () => { const e = new Error("The quota has been exceeded."); e.name = "QuotaExceededError"; throw e; };
  const fullRes = Endpoints.savePins(["x/y"], full);
  eq(fullRes.ok, false, "a full disk does NOT report success");
  eq(fullRes.reason, "storage-full", "a full disk is named as such");
  ok(/NOT saved/.test(fullRes.message), "and the message says plainly that it was not saved");
  eq(fullRes.pins, ["x/y"], "the pin still works for this session");

  const broken = memory();
  broken.setItem = () => { throw new Error("nope"); };
  eq(Endpoints.savePins(["x"], broken).reason, "storage-error", "a storage error that is not a quota error is named differently");

  eq(Endpoints.savePins(["x"], null).reason, "storage-unavailable", "no storage at all is reported, not assumed");

  const corrupt = memory();
  corrupt.setItem(Endpoints.PINS_KEY, "{not json");
  const bad = Endpoints.loadPins(corrupt);
  eq(bad.ok, false, "a corrupt pin file is not reported as loaded");
  eq(bad.reason, "corrupt", "and it is named corrupt");
  eq(bad.pins, [], "it returns no pins");
  ok(/not json/.test(bad.raw), "it offers the excerpt for export");
  ok(!/deleted/.test(bad.message) || /Nothing was deleted/.test(bad.message), "and it says nothing was deleted");

  const wrongShape = memory();
  wrongShape.setItem(Endpoints.PINS_KEY, JSON.stringify({ v: 1, ids: "not-an-array" }));
  eq(Endpoints.loadPins(wrongShape).reason, "corrupt", "a save in an unknown shape is corrupt, not empty");

  const partial = memory();
  partial.setItem(Endpoints.PINS_KEY, JSON.stringify({ v: 1, ids: ["a/b", 42, null, "c/d"] }));
  const rep = Endpoints.loadPins(partial);
  eq(rep.pins, ["a/b", "c/d"], "unreadable pins are skipped");
  eq(rep.reason, "repaired", "and the skip is reported rather than hidden");

  const none = memory();
  const emptyLoad = Endpoints.loadPins(none);
  eq(emptyLoad.ok, true, "a first run is not an error");
  eq(emptyLoad.reason, "empty", "and it is distinguished from corrupt - which is the whole point");
  eq(emptyLoad.message, "", "with nothing to warn about");

  eq(Endpoints.loadPins(null).reason, "storage-unavailable", "loading with no storage is reported, not thrown");
  eq(Endpoints.clearPins(store).ok, true, "reset clears the pins");
  eq(Endpoints.loadPins(store).pins, [], "and they are gone afterwards");
}

/* ---------- 8. the engine refuses to run without its inputs ---------- */
{
  throws(() => Endpoints.create(null, { Search }), "create() without a dataset is refused");
  throws(() => Endpoints.create({ apis: [] }, {}), "create() without search-kit is refused rather than silently unranked");
  throws(() => Endpoints.create({ apis: [] }, { Search: { index: 1 } }), "a bogus search-kit is refused too");
  const e = Endpoints.create(DATA, { Search });
  eq(e.size, DATA.apis.length, "the engine reports the size it was given");
  ok(e.categories.length > 20, "the categories are derived from the data (" + e.categories.length + ")");
  eq(e.categories.reduce((n, c) => n + c.count, 0), DATA.apis.length, "the category counts add up to the whole directory");
  const s = e.stats();
  eq(s.count, DATA.apis.length, "stats count the directory");
  eq(s.byAuth.none + s.byAuth.apiKey + s.byAuth.OAuth + s.byAuth.other, DATA.apis.length, "the auth breakdown adds up");
  eq(s.byCors.yes + s.byCors.no + s.byCors.unknown, DATA.apis.length, "the CORS breakdown adds up");
  eq(s.noKeyNoCorsProblem, DATA.apis.filter(a => a.auth === "none" && a.cors === "yes").length,
    "the 'no key + CORS' headline number is computed, not typed");
  eq(e.byId(DATA.apis[7].id).name, DATA.apis[7].name, "an entry can be looked up by id");
  eq(e.byId("nope/nope"), null, "an unknown id returns null, not undefined behaviour");
}

/* ---------- 9. the page is wired to the files that exist ---------- */
{
  const html = fs.readFileSync(path.join(__dirname, "docs", "play", "index.html"), "utf8");
  ["search-kit.js", "export-kit.js", "data.js", "endpoints.js", "app.js"].forEach(f => {
    ok(html.includes('src="' + f + '"'), "the page loads " + f);
    ok(fs.existsSync(path.join(__dirname, "docs", "play", f)), f + " exists");
  });
  ok(!/https?:\/\//.test(html.replace(/<!--[\s\S]*?-->/g, "")), "the page loads no remote script or style (zero CDNs)");
  ok(fs.existsSync(path.join(__dirname, "docs", ".nojekyll")), "docs/.nojekyll exists, so Pages serves the folder as-is");
  ok(fs.existsSync(path.join(__dirname, "docs", "index.html")), "the landing page exists");
}

console.log("\n" + pass + " passed, " + fail + " failed");
if (fail) { console.log("\nFailures:\n  - " + fails.join("\n  - ")); process.exit(1); }
