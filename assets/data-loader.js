/* ============================================================================
   data-loader.js

   Reads the three data tables, checks them, and works out the three columns the
   page needs but nobody should have to type:

     role_x        which column an entity sits in
     country_rank  how national groupings are ordered
     track         which permitting regime(s) it operates under

   Nothing here touches the page. It returns plain objects, and also works under
   Node so the derivation can be tested without a browser.
   ========================================================================== */
(function (root) {
  "use strict";

  // Entity type -> column. Capital 0 ... Seabed 5, then Knowledge, Sources.
  var ROLE_X = {
    "exchange": 0, "company": 1, "state": 2, "body": 3, "regulator": 3,
    "instrument": 4, "area": 5, "research-org": 6, "project": 6, "ngo": 6, "source": 7
  };

  // Relationship types that confer or record authorisation. A relationship of
  // one of these types inherits the regime of whichever anchor it touches.
  var AUTH = {
    "sponsors": 1, "issues-contract-to": 1, "issues-national-licence": 1, "applied-for": 1,
    "holds-exploration-contract": 1, "holds-national-licence": 1, "former-licence": 1,
    "authorised-under": 1, "enacted": 1, "organ-of": 1
  };
  var INHERIT = Object.assign({ "subsidiary-of": 1, "joint-venture-with": 1 }, AUTH);
  var TRACK_ORDER = ["isa", "dshmra", "eez"];

  // Rows that exist only to draw captions on a Kumu map. They are legitimate in a
  // sheet shared with Kumu, and meaningless here, so they are skipped quietly.
  var KUMU_CAPTIONS = { "heading": 1, "track-label": 1 };

  // ---------------------------------------------------------------------------
  // CSV. Handles quoted fields, commas and line breaks inside quotes, doubled
  // quotes, a byte-order mark, and both kinds of line ending.
  // ---------------------------------------------------------------------------
  function parseCSV(text) {
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    var rows = [], row = [], field = "", inQuotes = false, i, c;
    for (i = 0; i < text.length; i++) {
      c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
        } else { field += c; }
      } else if (c === '"') { inQuotes = true; }
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (c === "\r") { /* ignore */ }
      else { field += c; }
    }
    if (field !== "" || row.length) { row.push(field); rows.push(row); }
    if (!rows.length) return [];
    var header = rows.shift().map(function (h) { return h.trim(); });
    return rows
      .filter(function (r) { return r.some(function (v) { return v.trim() !== ""; }); })
      .map(function (r) {
        var o = {};
        header.forEach(function (h, k) { o[h] = (r[k] === undefined ? "" : r[k]).trim(); });
        return o;
      });
  }

  function looksLikeHTML(text) {
    return /^\s*(<!doctype|<html|<head|<body)/i.test(text.slice(0, 200));
  }

  function requireColumns(rows, cols, label) {
    if (!rows.length) throw new Error(label + " is empty.");
    var missing = cols.filter(function (c) { return !(c in rows[0]); });
    if (missing.length) {
      throw new Error(label + " is missing the column" + (missing.length > 1 ? "s " : " ") +
        missing.join(", ") + ". Found: " + Object.keys(rows[0]).join(", ") + ".");
    }
  }

  // ---------------------------------------------------------------------------
  // Derivation
  // ---------------------------------------------------------------------------
  function derive(elements, connections, anchors, warnings) {
    var ids = {};
    elements.forEach(function (e) { ids[e.id] = e; });

    // role_x
    elements.forEach(function (e) {
      if (Object.prototype.hasOwnProperty.call(ROLE_X, e.type)) {
        e.role_x = String(ROLE_X[e.type]);
      } else {
        e.role_x = "";
        warnings.push('"' + e.label + '" has the type "' + e.type + '", which the page does not know, so it is hidden.');
      }
    });

    // country_rank: biggest national clusters first, ties in order of appearance.
    var counts = {}, order = [];
    elements.forEach(function (e) {
      if (!e.country) return;
      if (!(e.country in counts)) { counts[e.country] = 0; order.push(e.country); }
      counts[e.country]++;
    });
    order = order
      .map(function (c, i) { return { c: c, n: counts[c], i: i }; })
      .sort(function (a, b) { return b.n - a.n || a.i - b.i; })
      .map(function (x) { return x.c; });
    var rank = {};
    order.forEach(function (c, i) { rank[c] = i; });
    elements.forEach(function (e) {
      e.country_rank = String(e.country && e.country in rank ? rank[e.country] : order.length);
    });

    // track. It is a property of the relationship, not the entity, so it is
    // derived from the relationships and never spread node-to-node: hubs like
    // the ISA touch everything and would otherwise contaminate the whole graph.
    var REGIME = {};
    anchors.forEach(function (a) {
      if (!ids[a.id]) { warnings.push('anchors: "' + a.id + '" is not an entity id, so it was ignored.'); return; }
      if (TRACK_ORDER.indexOf(a.track) === -1) { warnings.push('anchors: "' + a.track + '" is not a track (use isa, dshmra or eez).'); return; }
      (REGIME[a.id] = REGIME[a.id] || {})[a.track] = 1;
    });
    function union(target, source) { Object.keys(source || {}).forEach(function (k) { target[k] = 1; }); }

    var tracks = {};
    elements.forEach(function (e) { tracks[e.id] = {}; union(tracks[e.id], REGIME[e.id]); });

    // 1. An authorisation edge carries the regime of any anchor it touches, and
    //    hands it to the non-anchor end.
    connections.forEach(function (c) {
      if (!AUTH[c.type]) return;
      var t = {}; union(t, REGIME[c.from]); union(t, REGIME[c.to]);
      if (!Object.keys(t).length) return;
      [c.from, c.to].forEach(function (side) {
        if (tracks[side] && !REGIME[side]) union(tracks[side], t);
      });
    });
    // 2. Entities still without a regime inherit from a tracked neighbour. One
    //    direction only: untracked takes from tracked, never the reverse.
    for (var pass = 0; pass < 3; pass++) {
      connections.forEach(function (c) {
        if (!INHERIT[c.type] || !tracks[c.from] || !tracks[c.to]) return;
        var a = tracks[c.from], b = tracks[c.to];
        var an = Object.keys(a).length, bn = Object.keys(b).length;
        if (!an && bn) union(a, b);
        else if (!bn && an) union(b, a);
      });
    }
    // 3. A parent company takes the union across its subsidiaries.
    for (pass = 0; pass < 2; pass++) {
      connections.forEach(function (c) {
        if (c.type === "subsidiary-of" && tracks[c.from] && tracks[c.to]) union(tracks[c.to], tracks[c.from]);
      });
    }

    elements.forEach(function (e) {
      e.track = TRACK_ORDER.filter(function (t) { return tracks[e.id][t]; }).join("|");
    });
  }

  // ---------------------------------------------------------------------------
  // Checking. Cytoscape throws on duplicate ids and on edges that point at
  // nothing, so those rows are dropped here and reported rather than crashing.
  // ---------------------------------------------------------------------------
  function clean(elements, connections, warnings) {
    var seen = {}, goodEls = [];
    elements.forEach(function (e, i) {
      if (KUMU_CAPTIONS[e.type]) return;
      if (!e.id) { warnings.push("elements row " + (i + 2) + " has no id and was skipped."); return; }
      if (seen[e.id]) { warnings.push('Duplicate id "' + e.id + '": the second row was skipped.'); return; }
      if (!e.label) e.label = e.id;
      seen[e.id] = 1; goodEls.push(e);
    });
    var dangling = [], goodCons = connections.filter(function (c) {
      if (seen[c.from] && seen[c.to]) return true;
      dangling.push(c.from + " \u2192 " + c.to + " (" + c.type + ")");
      return false;
    });
    if (dangling.length) {
      warnings.push(dangling.length + " relationship" + (dangling.length > 1 ? "s point" : " points") +
        " at an id that does not exist and " + (dangling.length > 1 ? "were" : "was") +
        " skipped: " + dangling.slice(0, 4).join("; ") + (dangling.length > 4 ? "; \u2026" : "") + ".");
    }
    return { elements: goodEls, connections: goodCons };
  }

  function build(rawEls, rawCons, rawAnchors, warnings) {
    var cl = clean(rawEls, rawCons, warnings);
    derive(cl.elements, cl.connections, rawAnchors, warnings);
    return { elements: cl.elements, connections: cl.connections };
  }

  // ---------------------------------------------------------------------------
  // Loading (browser only)
  // ---------------------------------------------------------------------------
  function fetchText(url, isRemote) {
    var ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = ctl ? setTimeout(function () { ctl.abort(); }, 10000) : null;
    return fetch(url, { cache: isRemote ? "no-store" : "no-cache", signal: ctl ? ctl.signal : undefined })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status + " for " + url);
        return res.text();
      })
      .then(function (text) {
        if (looksLikeHTML(text)) {
          throw new Error(isRemote
            ? "the link returned a web page, not CSV. Check the sheet is published to the web as CSV"
            : url + " returned a web page, not CSV");
        }
        return text;
      })
      .finally(function () { if (timer) clearTimeout(timer); });
  }

  function fetchTables(urls, isRemote, localFallbackForAnchors) {
    var anchorsUrl = urls.anchors || localFallbackForAnchors;
    var anchorsRemote = !!urls.anchors && isRemote;
    return Promise.all([
      fetchText(urls.elements, isRemote),
      fetchText(urls.connections, isRemote),
      fetchText(anchorsUrl, anchorsRemote)
    ]).then(function (t) {
      return { elements: parseCSV(t[0]), connections: parseCSV(t[1]), anchors: parseCSV(t[2]) };
    });
  }

  function loadData(cfg) {
    var warnings = [], source = "repository";
    var sheet = cfg.sheetUrls || {}, local = cfg.localData;
    var useSheet = !!(sheet.elements && sheet.connections);

    var attempt = useSheet
      ? fetchTables(sheet, true, local.anchors).then(function (t) { source = "sheet"; return t; })
          .catch(function (err) {
            warnings.push("The live sheet could not be read (" + err.message + "). Showing the copy stored with the page instead.");
            return fetchTables(local, false, local.anchors);
          })
      : fetchTables(local, false, local.anchors);

    return attempt.then(function (t) {
      requireColumns(t.elements, ["id", "label", "type"], "elements");
      requireColumns(t.connections, ["from", "to", "type"], "connections");
      if (t.anchors.length) requireColumns(t.anchors, ["id", "track"], "anchors");
      var data = build(t.elements, t.connections, t.anchors, warnings);
      return { data: data, meta: { source: source, loadedAt: new Date(), warnings: warnings } };
    }, function (err) {
      var isFile = typeof location !== "undefined" && location.protocol === "file:";
      if (isFile) {
        throw new Error("This page was opened as a local file, and browsers will not let a local file read its data. " +
          "View it from its web address, or run a small local server (see the README).");
      }
      throw err;
    });
  }

  var api = { parseCSV: parseCSV, build: build, derive: derive, loadData: loadData, ROLE_X: ROLE_X };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.DSMData = api;
})(typeof window !== "undefined" ? window : globalThis);
