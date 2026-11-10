/* app.js — the UI of Endpoints. Thin on purpose: every decision that can be
 * tested lives in endpoints.js, and this file only wires inputs to it.
 *
 * PolyForm Noncommercial 1.0.0. (c) 2026 Dr Sohil Momin. */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var out = $("out"), statusEl = $("status");

  var engine;
  try {
    engine = Endpoints.create(window.ENDPOINTS_DATA, { Search: window.Search });
  } catch (e) {
    statusEl.className = "bad";
    statusEl.textContent = "This page could not read its own directory (" + (e && e.message ? e.message : "unknown error") + "). Nothing was changed.";
    return;
  }

  var st = engine.stats();
  $("prov").textContent = st.count.toLocaleString() + " APIs across " + st.categories +
    " categories · source: " + st.source + " · licence: " + st.licence + " · fetched " + st.fetched +
    " · " + st.byAuth.none + " need no key, " + st.noKeyNoCorsProblem + " need no key and allow CORS.";

  // The selects are built FROM the engine's vocabulary, so an option the engine
  // would refuse cannot be offered in the first place.
  engine.vocab.auth.forEach(function (v) {
    var o = document.createElement("option"); o.value = v;
    o.textContent = v === "none" ? "No key" : v === "apiKey" ? "API key" : v === "OAuth" ? "OAuth" : "Other";
    $("auth").appendChild(o);
  });
  engine.vocab.cors.forEach(function (v) {
    var o = document.createElement("option"); o.value = v; o.textContent = "CORS " + v; $("cors").appendChild(o);
  });
  engine.vocab.https.forEach(function (v) {
    var o = document.createElement("option"); o.value = v; o.textContent = v === "yes" ? "HTTPS only" : "HTTP only"; $("https").appendChild(o);
  });
  engine.categories.forEach(function (c) {
    var o = document.createElement("option"); o.value = c.name; o.textContent = c.name + " (" + c.count + ")"; $("cat").appendChild(o);
  });

  var pins = [];
  var loaded = Endpoints.loadPins(window.localStorage);
  pins = loaded.pins.slice();
  var pinsOnly = false;

  function say(msg, cls) { statusEl.className = cls || ""; statusEl.textContent = msg; }

  if (!loaded.ok) {
    // A corrupt pin file is REPORTED, never rendered as "you have no pins".
    say(loaded.message + (loaded.raw ? " Excerpt: " + loaded.raw.slice(0, 80) + "…" : "") +
      " Use Reset to clear it, or Export to keep a copy.", "bad");
  }

  function currentQuery() {
    return {
      q: $("q").value,
      auth: $("auth").value,
      cors: $("cors").value,
      https: $("https").value,
      cat: $("cat").value,
      limit: 60
    };
  }

  function chip(kind, text) {
    var s = document.createElement("span");
    s.className = "chip " + kind; s.textContent = text; return s;
  }

  function render() {
    var res;
    try {
      res = engine.search(currentQuery());
    } catch (e) {
      // A bad filter is refused WITH what it accepts; the previous list stays.
      say(e.name === "QueryError"
        ? "That filter is not one this directory uses — " + e.field + " accepts: " + e.allowed.slice(0, 8).join(", ") + (e.allowed.length > 8 ? ", …" : "") + ". The list below is unchanged."
        : "Search failed: " + (e && e.message ? e.message : "unknown error"), "bad");
      return;
    }

    var list = res.results;
    if (pinsOnly) {
      list = list.filter(function (r) { return pins.indexOf(r.api.id) !== -1; });
    }

    var head = res.total.toLocaleString() + (res.total === 1 ? " API" : " APIs") +
      (res.filters.length ? " · " + res.filters.join(" · ") : "") +
      (res.shown < res.total ? " · showing " + res.shown : "");
    if (pinsOnly) head = list.length + " pinned in this view";

    if (!list.length) {
      say(res.note || (pinsOnly ? "No pinned entry matches this view. Clear a filter, or pin something." : "Nothing here."), "warn");
    } else {
      say(head + " · ranked, then filtered");
    }

    out.textContent = "";
    list.forEach(function (r) {
      var a = r.api;
      var card = document.createElement("div"); card.className = "card";
      var h = document.createElement("h3");
      var link = document.createElement("a");
      link.href = a.url; link.textContent = a.name; link.rel = "noopener noreferrer"; link.target = "_blank";
      h.appendChild(link);
      var meta = document.createElement("div"); meta.className = "row";
      meta.appendChild(chip(a.auth, a.auth === "none" ? "no key" : a.auth));
      meta.appendChild(chip(a.cors, "CORS " + a.cors));
      meta.appendChild(chip(a.https, a.https === "yes" ? "HTTPS" : "HTTP only"));
      meta.appendChild(chip("", a.cat));
      var p = document.createElement("p"); p.textContent = a.desc;
      var foot = document.createElement("div"); foot.className = "row";
      var host = document.createElement("span"); host.className = "mut small"; host.textContent = a.host;
      var pin = document.createElement("button");
      var on = pins.indexOf(a.id) !== -1;
      pin.textContent = on ? "Unpin" : "Pin";
      pin.onclick = function () { togglePin(a.id); };
      foot.appendChild(host); foot.appendChild(pin);
      card.appendChild(h); card.appendChild(meta); card.appendChild(p); card.appendChild(foot);
      out.appendChild(card);
    });
    $("pincount").textContent = pins.length;
  }

  function togglePin(id) {
    var i = pins.indexOf(id);
    if (i === -1) pins.push(id); else pins.splice(i, 1);
    var saved = Endpoints.savePins(pins, window.localStorage);
    if (!saved.ok) {
      // Reported as NOT kept, with the reason. The pin still works this session.
      say(saved.message, "warn");
    }
    render();
  }

  function reset() {
    $("q").value = ""; $("auth").value = ""; $("cors").value = ""; $("https").value = ""; $("cat").value = "";
    pinsOnly = false; render();
  }

  $("q").addEventListener("input", render);
  ["auth", "cors", "https", "cat"].forEach(function (id) { $(id).addEventListener("change", render); });
  $("reset").onclick = reset;
  $("nokey").onclick = function () {
    reset(); $("auth").value = "none"; $("cors").value = "yes"; render();
  };
  $("pins").onclick = function () { pinsOnly = !pinsOnly; render(); };
  $("exp").onclick = function () {
    var res;
    try { res = engine.search(currentQuery()); } catch (e) { say("Export needs a valid filter set. " + e.message, "bad"); return; }
    var rows = res.results.map(function (r) { return r.api; });
    if (!rows.length) { say("There is nothing in this view to export.", "warn"); return; }
    var csv = "name,host,auth,cors,https,category,url,description\n" + rows.map(function (a) {
      var f = [a.name, a.host, a.auth, a.cors, a.https, a.cat, a.url, a.desc];
      return f.map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(",");
    }).join("\n") + "\n";
    if (window.Export && window.Export.csv) {
      window.Export.csv("endpoints.csv", csv);
      say("Exported " + rows.length + " entries as CSV.");
    } else {
      say("The export kit did not load, so nothing was written.", "bad");
    }
  };

  render();
})();
