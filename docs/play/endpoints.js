/* endpoints.js — the engine of Endpoints: validate, filter, rank, pin.
 *
 * The whole app is here, and it is pure: it is handed a dataset and it returns
 * result objects. It makes no request, touches no DOM and needs no server, which
 * is what makes it testable and what makes "works offline" a fact rather than a
 * claim.
 *
 * The dependency is search-kit, INJECTED (deps.Search). The browser passes
 * window.Search, the test passes require("./search-kit.js"). One code path, two
 * hosts — never a "test scorer" and a "real scorer" that can drift apart.
 *
 * PolyForm Noncommercial 1.0.0. (c) 2026 Dr Sohil Momin.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Endpoints = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var VERSION = "1.0.0";
  var AUTH = ["none", "apiKey", "OAuth", "other"];
  var CORS = ["yes", "no", "unknown"];
  var HTTPS = ["yes", "no"];
  var PINS_KEY = "endpoints.pins.v1";
  var DEFAULT_LIMIT = 60;

  /* A bad filter is an ERROR, not a silently empty list. An empty list is
   * indistinguishable from "nothing matches", which is the bug this app is
   * built to avoid: the user cannot tell whether they typed something wrong or
   * the directory has nothing. So it carries what it accepts. */
  function QueryError(field, value, allowed) {
    this.name = "QueryError";
    this.field = field;
    this.value = value;
    this.allowed = allowed.slice();
    this.message = field + ": " + JSON.stringify(value) + " is not one of " + allowed.join(", ");
  }
  QueryError.prototype = Object.create(Error.prototype);
  QueryError.prototype.constructor = QueryError;

  function oneOf(list, value, field) {
    if (value === undefined || value === null || value === "") return null;
    var v = String(value);
    if (list.indexOf(v) === -1) throw new QueryError(field, value, list);
    return v;
  }

  function create(data, deps) {
    if (!data || !Array.isArray(data.apis)) throw new TypeError("Endpoints.create: a dataset with an apis array is required");
    deps = deps || {};
    var Search = deps.Search;
    if (!Search || typeof Search.index !== "function") throw new TypeError("Endpoints.create: deps.Search (search-kit) is required");

    var meta = data.meta || {};
    var apis = data.apis;

    // Built ONCE. The corpus is fixed at load, so rebuilding it per keystroke
    // would be work with no possible change in the answer.
    var index = Search.index(apis, { keys: ["name", "desc", "host", "cat"] });

    var cats = {};
    apis.forEach(function (a) { cats[a.cat] = (cats[a.cat] || 0) + 1; });
    var categories = Object.keys(cats).sort(function (a, b) { return a.toLowerCase() < b.toLowerCase() ? -1 : 1; })
      .map(function (c) { return { name: c, count: cats[c] }; });

    /* Every filter the user can set, validated in one place. An unknown
     * category is a typo, not a filter that happens to match nothing. */
    function validate(q) {
      q = q || {};
      var out = {
        q: q.q == null ? "" : String(q.q).trim(),
        auth: oneOf(AUTH, q.auth, "auth"),
        cors: oneOf(CORS, q.cors, "cors"),
        https: oneOf(HTTPS, q.https, "https"),
        cat: null,
        limit: 0
      };
      if (q.cat !== undefined && q.cat !== null && q.cat !== "") {
        if (categories.map(function (c) { return c.name; }).indexOf(String(q.cat)) === -1) {
          throw new QueryError("cat", q.cat, categories.map(function (c) { return c.name; }));
        }
        out.cat = String(q.cat);
      }
      var lim = q.limit === undefined ? DEFAULT_LIMIT : Number(q.limit);
      if (!isFinite(lim) || lim < 1) throw new QueryError("limit", q.limit, ["a positive number"]);
      out.limit = Math.floor(lim);
      return out;
    }

    function matches(api, f) {
      if (f.auth && api.auth !== f.auth) return false;
      if (f.cors && api.cors !== f.cors) return false;
      if (f.https && api.https !== f.https) return false;
      if (f.cat && api.cat !== f.cat) return false;
      return true;
    }

    function activeFilters(f) {
      var a = [];
      if (f.auth) a.push("auth=" + f.auth);
      if (f.cors) a.push("cors=" + f.cors);
      if (f.https) a.push("https=" + f.https);
      if (f.cat) a.push("cat=" + f.cat);
      return a;
    }

    /* Rank first, filter after. Filtering the ranked list keeps the ranking
     * intact; filtering first and ranking the survivors would let a narrow
     * filter quietly promote a weak hit to the top. */
    function search(q) {
      var f = validate(q);
      var hits, total;

      if (!f.q) {
        hits = apis.filter(function (a) { return matches(a, f); })
          .slice()
          .sort(function (a, b) {
            var an = a.name.toLowerCase(), bn = b.name.toLowerCase();
            return an < bn ? -1 : an > bn ? 1 : (a.host < b.host ? -1 : 1);
          });
        total = hits.length;
        hits = hits.slice(0, f.limit).map(function (a) { return { api: a, score: 0 }; });
      } else {
        var ranked = index.query(f.q, { fuzzy: true });
        var kept = ranked.filter(function (r) { return matches(r.item, f); });
        total = kept.length;
        hits = kept.slice(0, f.limit).map(function (r) {
          return { api: r.item, score: Math.round(r.score * 1000) / 1000 };
        });
      }

      var filters = activeFilters(f);
      return {
        total: total,
        shown: hits.length,
        results: hits,
        query: { q: f.q, auth: f.auth, cors: f.cors, https: f.https, cat: f.cat, limit: f.limit },
        filters: filters,
        // The empty state names what emptied it. "No results" alone is a dead end.
        note: total === 0
          ? (f.q
            ? "Nothing matches \u201c" + f.q + "\u201d" + (filters.length ? " with " + filters.join(", ") : "") + "."
            : "Nothing matches " + filters.join(", ") + ".")
          : ""
      };
    }

    function stats() {
      var byAuth = {}, byCors = {};
      AUTH.forEach(function (k) { byAuth[k] = 0; });
      CORS.forEach(function (k) { byCors[k] = 0; });
      apis.forEach(function (a) { byAuth[a.auth] += 1; byCors[a.cors] += 1; });
      return {
        count: apis.length,
        categories: categories.length,
        byAuth: byAuth,
        byCors: byCors,
        noKeyNoCorsProblem: apis.filter(function (a) { return a.auth === "none" && a.cors === "yes"; }).length,
        source: meta.source || "",
        licence: meta.licence || "",
        fetched: meta.fetched || ""
      };
    }

    function byId(id) {
      for (var i = 0; i < apis.length; i++) if (apis[i].id === id) return apis[i];
      return null;
    }

    return {
      version: VERSION,
      size: apis.length,
      meta: meta,
      categories: categories,
      vocab: { auth: AUTH.slice(), cors: CORS.slice(), https: HTTPS.slice() },
      validate: validate,
      search: search,
      stats: stats,
      byId: byId
    };
  }

  /* ---- pins: the one piece of state the app keeps -------------------------
   * Both directions report what happened. A save that fails is never silent,
   * and a load that fails never returns [] as if that were the truth: an empty
   * pin list and an unreadable one mean opposite things to the user. */

  function savePins(ids, storage) {
    var list = (ids || []).filter(function (x) { return typeof x === "string"; });
    if (!storage || typeof storage.setItem !== "function") {
      return { ok: false, reason: "storage-unavailable", pins: list, message: "This browser gives the app no storage, so the pins are kept for this session only." };
    }
    try {
      storage.setItem(PINS_KEY, JSON.stringify({ v: 1, ids: list }));
      return { ok: true, reason: null, pins: list, message: "Pinned " + list.length + "." };
    } catch (e) {
      var full = e && (e.name === "QuotaExceededError" || e.code === 22 || /quota/i.test(String(e.message || "")));
      return {
        ok: false,
        reason: full ? "storage-full" : "storage-error",
        pins: list,
        message: full
          ? "Storage is full, so the pins are NOT saved. They still work until you close the page."
          : "The pins could not be saved (" + (e && e.name ? e.name : "unknown error") + "). They still work until you close the page."
      };
    }
  }

  function loadPins(storage) {
    if (!storage || typeof storage.getItem !== "function") {
      return { ok: false, reason: "storage-unavailable", pins: [], raw: null, message: "No storage here, so there are no saved pins to read." };
    }
    var raw;
    try { raw = storage.getItem(PINS_KEY); }
    catch (e) { return { ok: false, reason: "storage-error", pins: [], raw: null, message: "Storage could not be read (" + (e && e.name ? e.name : "error") + ")." }; }
    if (raw === null || raw === undefined || raw === "") {
      return { ok: true, reason: "empty", pins: [], raw: null, message: "" };
    }
    var parsed;
    try { parsed = JSON.parse(raw); }
    catch (e) { return { ok: false, reason: "corrupt", pins: [], raw: String(raw).slice(0, 200), message: "The saved pins could not be read. Nothing was deleted." }; }
    if (!parsed || !Array.isArray(parsed.ids)) {
      return { ok: false, reason: "corrupt", pins: [], raw: String(raw).slice(0, 200), message: "The saved pins are not in a shape this version understands. Nothing was deleted." };
    }
    var ids = parsed.ids.filter(function (x) { return typeof x === "string"; });
    return {
      ok: true,
      reason: ids.length === parsed.ids.length ? null : "repaired",
      pins: ids,
      raw: null,
      message: ids.length === parsed.ids.length ? "" : (parsed.ids.length - ids.length) + " unreadable pin(s) were skipped."
    };
  }

  function clearPins(storage) {
    if (!storage || typeof storage.removeItem !== "function") return { ok: false, reason: "storage-unavailable" };
    try { storage.removeItem(PINS_KEY); return { ok: true, reason: null }; }
    catch (e) { return { ok: false, reason: "storage-error" }; }
  }

  return {
    version: VERSION,
    PINS_KEY: PINS_KEY,
    DEFAULT_LIMIT: DEFAULT_LIMIT,
    VOCAB: { auth: AUTH.slice(), cors: CORS.slice(), https: HTTPS.slice() },
    QueryError: QueryError,
    create: create,
    savePins: savePins,
    loadPins: loadPins,
    clearPins: clearPins
  };
});
