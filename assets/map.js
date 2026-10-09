/* ============================================================================
   map.js: the world-map view.

   A button switches the stage from the network to a world map. Each actor is
   placed at its country (its capital, from data/places.csv) and each seabed
   area at its own point. Relationships between places are drawn as arcs,
   bundled per pair of places. Click a country or an area to see who is there
   and how it connects to other countries and to the seabed.

   The map obeys the same Emphasis, entity, relationship and evidence filters as
   the network, so the two views always show the same selection.

   The map libraries and the world outline load only the first time the map is
   opened, so the page itself stays fast.
   ========================================================================== */
(function () {
  "use strict";

  var W = 960, H = 520;
  var REGIME = { isa: "ISA regime", dshmra: "US unilateral track", eez: "national jurisdiction" };
  var S = {
    on: false, loading: null, world: null, worldNote: "", places: [],
    sel: null, ent: null, zoomK: 1, model: null, svg: null, zoom: null
  };

  // --------------------------------------------------------------------------
  // small helpers
  // --------------------------------------------------------------------------
  function $(id) { return document.getElementById(id); }
  function appReady() { return !!window.DSM_STARTED && typeof DATA !== "undefined"; }
  function h(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function tok(name, fallback) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = function () { reject(new Error(src + " could not be loaded.")); };
      document.head.appendChild(s);
    });
  }

  function load() {
    if (S.loading) return S.loading;
    var cfg = window.DSM_CONFIG || {};
    var placesUrl = (cfg.localData && cfg.localData.places) || "data/places.csv";
    S.loading = Promise.all([
      window.d3 ? null : loadScript("assets/vendor/d3.min.js"),
      window.topojson ? null : loadScript("assets/vendor/topojson-client.min.js"),
      fetch("assets/world-110m.json").then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      }).catch(function () {
        S.worldNote = "The world outline could not be loaded, so only the markers are shown.";
        return null;
      }),
      fetch(placesUrl, { cache: "no-cache" }).then(function (r) {
        if (!r.ok) throw new Error(placesUrl + " could not be read (HTTP " + r.status + ").");
        return r.text();
      })
    ]).then(function (res) {
      S.world = res[2];
      S.places = window.DSMData.parseCSV(res[3]);
    });
    S.loading.catch(function () { S.loading = null; });   // allow a retry
    return S.loading;
  }

  // --------------------------------------------------------------------------
  // model: what is visible, where it sits, and how places connect
  // --------------------------------------------------------------------------
  function typeName(t) {
    var hit = NODE_TYPES.find(function (x) { return x[0] === t; });
    return hit ? hit[1] : t;
  }
  function relName(t) { return (EDGE_META[t] && EDGE_META[t].name) || t; }
  function relFam(t) { return (EDGE_META[t] && EDGE_META[t].family) || "structure"; }

  function buildModel() {
    var countries = {}, areas = {}, atlasToCountry = {}, problems = [];
    S.places.forEach(function (p, i) {
      var lat = parseFloat(p.lat), lon = parseFloat(p.lon);
      if (isNaN(lat) || isNaN(lon)) { problems.push("places.csv row " + (i + 2) + " has no usable position."); return; }
      if (p.kind === "country") {
        countries[p.key] = { lat: lat, lon: lon };
        atlasToCountry[p.atlas_name || p.key] = p.key;
      } else if (p.kind === "area") {
        areas[p.key] = { lat: lat, lon: lon };
      }
    });

    // the same visibility rules as the network
    var nodeOn = checked("node"), edgeOn = checked("edge");
    var floor = CONF_RANK[$("confidence").value] || 0;
    var byId = {};
    DATA.elements.forEach(function (e) { byId[e.id] = e; });
    var edges = DATA.connections.filter(function (c) {
      var a = byId[c.from], b = byId[c.to];
      return a && b && edgeOn.has(c.type) && (CONF_RANK[c.confidence] || 0) >= floor &&
             nodeOn.has(a.type) && nodeOn.has(b.type);
    });
    var visible = {};
    edges.forEach(function (c) { visible[c.from] = 1; visible[c.to] = 1; });

    // place every visible entity
    var places = {}, placeOf = {}, unplaced = [];
    function place(pid, kind, key, label, pt) {
      if (!places[pid]) places[pid] = { pid: pid, kind: kind, key: key, label: label, lat: pt.lat, lon: pt.lon, ents: [] };
      return places[pid];
    }
    Object.keys(visible).forEach(function (id) {
      var e = byId[id], p = null;
      if (e.type === "area" && areas[e.id]) {
        p = place("area:" + e.id, "area", e.id, e.label, areas[e.id]);
        p.track = e.track || "";
        p.ent = e;
      } else if (e.country && countries[e.country]) {
        p = place("country:" + e.country, "country", e.country, e.country, countries[e.country]);
      } else {
        unplaced.push({ e: e, why: e.type === "area" ? "no position in places.csv"
          : (e.country ? "country \u201C" + e.country + "\u201D has no position in places.csv" : "no country") });
        return;
      }
      p.ents.push(e);
      placeOf[id] = p.pid;
    });

    // bundle relationships by pair of places
    var pairs = {}, internal = {};
    edges.forEach(function (c) {
      var pa = placeOf[c.from], pb = placeOf[c.to];
      if (!pa || !pb) return;
      if (pa === pb) { (internal[pa] = internal[pa] || []).push(c); return; }
      var key = pa < pb ? pa + "|" + pb : pb + "|" + pa;
      var pr = pairs[key] || (pairs[key] = { key: key, a: pa < pb ? pa : pb, b: pa < pb ? pb : pa, edges: [], fams: {} });
      pr.edges.push(c);
      var f = relFam(c.type);
      pr.fams[f] = (pr.fams[f] || 0) + 1;
    });
    Object.keys(pairs).forEach(function (k) {
      var pr = pairs[k];
      pr.fam = Object.keys(pr.fams).sort(function (x, y) { return pr.fams[y] - pr.fams[x]; })[0];
    });

    unplaced.filter(function (u) { return /places\.csv/.test(u.why); }).forEach(function (u) {
      problems.push("\u201C" + u.e.label + "\u201D is not on the map: " + u.why + ".");
    });

    return {
      byId: byId, edges: edges, places: places, placeOf: placeOf, pairs: pairs, internal: internal,
      unplaced: unplaced, problems: problems, atlasToCountry: atlasToCountry, countries: countries
    };
  }

  // --------------------------------------------------------------------------
  // drawing
  // --------------------------------------------------------------------------
  function draw() {
    var d3 = window.d3, M = S.model = buildModel();
    var box = $("worldmap");
    box.innerHTML = "";

    var svg = d3.select(box).append("svg")
      .attr("viewBox", "0 0 " + W + " " + H)
      .attr("preserveAspectRatio", "xMidYMid meet")
      .attr("role", "img")
      .attr("aria-label", "World map of deep-sea mining actors, seabed areas and their relationships");
    S.svg = svg;

    // Centred on the Pacific: that is where most of this data lives, and it
    // keeps the Clarion-Clipperton Zone next to its sponsoring island states.
    var proj = d3.geoNaturalEarth1().rotate([-160, 0])
      .fitExtent([[8, 8], [W - 8, H - 8]], { type: "Sphere" });
    var path = d3.geoPath(proj);

    var layer = svg.append("g").attr("class", "map-layer");
    layer.append("path").datum({ type: "Sphere" }).attr("class", "map-ocean").attr("d", path)
      .on("click", function () { select(null); });
    layer.append("path").datum(d3.geoGraticule10()).attr("class", "map-grid").attr("d", path);

    if (S.world && window.topojson) {
      var feats = window.topojson.feature(S.world, S.world.objects.countries).features;
      layer.append("g").attr("class", "map-countries").selectAll("path").data(feats).enter().append("path")
        .attr("d", path)
        .attr("class", function (f) {
          var key = M.atlasToCountry[f.properties.name] || f.properties.name;
          return "map-land" + (M.places["country:" + key] ? " has-data" : "");
        })
        .on("click", function (ev, f) {
          ev.stopPropagation();
          var key = M.atlasToCountry[f.properties.name] || f.properties.name;
          if (M.places["country:" + key]) select("country:" + key);
          else showEmpty(key);
        })
        .append("title").text(function (f) { return f.properties.name; });
    }

    // positions, then a gentle nudge so nearby markers do not sit on top of
    // each other (Brussels, Amsterdam and Paris, for instance)
    var list = Object.keys(M.places).map(function (pid) {
      var p = M.places[pid], xy = proj([p.lon, p.lat]);
      p.ax = xy[0]; p.ay = xy[1]; p.x = xy[0]; p.y = xy[1];
      p.r = p.kind === "area" ? 6 : 3.5 + 2.1 * Math.sqrt(p.ents.length);
      return p;
    });
    for (var it = 0; it < 80; it++) {
      for (var i = 0; i < list.length; i++) {
        for (var j = i + 1; j < list.length; j++) {
          var a = list[i], b = list[j];
          var dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy) || 0.01;
          var min = a.r + b.r + 2;
          if (d < min) {
            var push = (min - d) / d * 0.5;
            a.x -= dx * push; a.y -= dy * push; b.x += dx * push; b.y += dy * push;
          }
        }
      }
      list.forEach(function (p) { p.x += (p.ax - p.x) * 0.04; p.y += (p.ay - p.y) * 0.04; });
    }

    // leader lines where a marker had to move off its true point
    layer.append("g").attr("class", "map-leaders").selectAll("line")
      .data(list.filter(function (p) { return Math.hypot(p.x - p.ax, p.y - p.ay) > 3; }))
      .enter().append("line")
      .attr("x1", function (p) { return p.ax; }).attr("y1", function (p) { return p.ay; })
      .attr("x2", function (p) { return p.x; }).attr("y2", function (p) { return p.y; });

    // links: one per pair of places, drawn along the shortest route over the
    // globe. Routes that cross the Atlantic leave one edge of the map and come
    // back in at the other, which is where the shortest way really goes.
    var pairList = Object.keys(M.pairs).map(function (k) { return M.pairs[k]; });
    layer.append("g").attr("class", "map-arcs").selectAll("path").data(pairList).enter().append("path")
      .attr("class", "map-arc")
      .attr("d", function (pr) {
        var p = M.places[pr.a], q = M.places[pr.b];
        return path({ type: "LineString", coordinates: [[p.lon, p.lat], [q.lon, q.lat]] });
      })
      .attr("stroke", function (pr) { return famColour(pr.fam); })
      .attr("stroke-width", function (pr) { return 0.9 + 1.2 * Math.log2(1 + pr.edges.length); })
      .append("title").text(function (pr) {
        var c = {};
        pr.edges.forEach(function (e) { c[relName(e.type)] = (c[relName(e.type)] || 0) + 1; });
        return M.places[pr.a].label + " \u2194 " + M.places[pr.b].label + "\n" +
          Object.keys(c).map(function (k) { return c[k] + " \u00D7 " + k; }).join("\n");
      });

    // markers
    var mk = layer.append("g").attr("class", "map-markers").selectAll("g").data(list).enter().append("g")
      .attr("class", function (p) { return "map-mk " + p.kind; })
      .attr("tabindex", 0)
      .attr("role", "button")
      .attr("aria-label", function (p) { return p.label + ", " + p.ents.length + (p.kind === "area" ? " (seabed area)" : " actors"); })
      .on("click", function (ev, p) { ev.stopPropagation(); select(p.pid); })
      .on("keydown", function (ev, p) { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); select(p.pid); } });
    mk.filter(function (p) { return p.kind === "country"; }).append("circle")
      .attr("r", function (p) { return p.r; });
    mk.filter(function (p) { return p.kind === "area"; }).append("rect")
      .attr("x", -5).attr("y", -5).attr("width", 10).attr("height", 10).attr("transform", "rotate(45)")
      .attr("fill", function (p) {
        var t = (p.track || "").split("|")[0];
        return tok("--tr-" + (t || "none"), "#6B7680");
      });
    mk.append("text").attr("class", "map-label")
      .text(function (p) { return p.label; });
    mk.append("title").text(function (p) {
      return p.kind === "area"
        ? p.label + " (seabed area" + (p.track ? ", " + p.track.split("|").map(function (t) { return REGIME[t] || t; }).join(" and ") : "") + ")"
        : p.label + ": " + p.ents.length + (p.ents.length === 1 ? " actor" : " actors");
    });

    // zoom and pan; markers and lines keep their on-screen size
    S.zoom = d3.zoom().scaleExtent([1, 12]).extent([[0, 0], [W, H]])
      .translateExtent([[-40, -40], [W + 40, H + 40]])
      .on("zoom", function (ev) {
        S.zoomK = ev.transform.k;
        S.t = ev.transform;
        layer.attr("transform", ev.transform);
        placeMarkers();
        labels();
      });
    svg.call(S.zoom).on("dblclick.zoom", null);
    S.zoomK = 1; S.t = { k: 1, x: 0, y: 0 };
    placeMarkers();
    labels();
    legend();
    readout();
    if (S.sel && !(S.sel in M.places) && S.sel.indexOf("country:") === 0) S.sel = null;
    if (S.sel) select(S.sel, true); else highlight();
  }

  function placeMarkers() {
    var k = S.zoomK || 1;
    S.svg.selectAll(".map-mk").attr("transform", function (p) {
      return "translate(" + p.x + "," + p.y + ") scale(" + (1 / k) + ")";
    });
    S.svg.selectAll(".map-leaders line").style("stroke-width", 0.8 / k);
  }

  // labels: chosen by priority, placed where they do not collide, and the rest
  // shown on hover or once you zoom in
  function labels() {
    var k = S.zoomK || 1, t = S.t || { x: 0, y: 0, k: 1 }, near = related();
    var CH = 5.9, LH = 12;                       // rough glyph width and line height, px
    var items = [];
    S.svg.selectAll(".map-mk").each(function (p) {
      var wanted = k >= 2.2 || p.kind === "area" || p.ents.length >= 2 || S.sel === p.pid || near[p.pid];
      var prio = S.sel === p.pid ? 0 : near[p.pid] ? 1 : p.kind === "area" ? 2 : 3;
      items.push({ p: p, node: this, wanted: wanted, prio: prio,
        sx: p.x * k + t.x, sy: p.y * k + t.y, w: p.label.length * CH + 4 });
    });
    items.sort(function (a, b) { return a.prio - b.prio || b.p.ents.length - a.p.ents.length; });
    var boxes = items.map(function (it) { return { x: it.sx - it.p.r, y: it.sy - it.p.r, w: it.p.r * 2, h: it.p.r * 2 }; });
    function hits(bx) {
      if (bx.x < 2 || bx.y < 2 || bx.x + bx.w > W - 2 || bx.y + bx.h > H - 2) return true;
      return boxes.some(function (o) { return bx.x < o.x + o.w && bx.x + bx.w > o.x && bx.y < o.y + o.h && bx.y + bx.h > o.y; });
    }
    items.forEach(function (it) {
      var lab = it.node.querySelector(".map-label");
      if (!lab) return;
      if (!it.wanted) { lab.style.display = "none"; return; }
      var r = it.p.r, cands = [
        { dx: r + 3, dy: 3.5, anchor: "start", box: { x: it.sx + r + 3, y: it.sy - LH / 2, w: it.w, h: LH } },
        { dx: -r - 3, dy: 3.5, anchor: "end", box: { x: it.sx - r - 3 - it.w, y: it.sy - LH / 2, w: it.w, h: LH } },
        { dx: 0, dy: -r - 4, anchor: "middle", box: { x: it.sx - it.w / 2, y: it.sy - r - 4 - LH, w: it.w, h: LH } },
        { dx: 0, dy: r + 12, anchor: "middle", box: { x: it.sx - it.w / 2, y: it.sy + r + 2, w: it.w, h: LH } }
      ];
      var pick = null;
      for (var i = 0; i < cands.length; i++) { if (!hits(cands[i].box)) { pick = cands[i]; break; } }
      if (!pick && it.prio === 0) pick = cands[0];           // the selection is always labelled
      if (!pick) { lab.style.display = "none"; return; }
      lab.style.display = "";
      lab.setAttribute("x", pick.dx); lab.setAttribute("y", pick.dy);
      lab.setAttribute("text-anchor", pick.anchor);
      boxes.push(pick.box);
    });
  }

  // places connected to the current selection
  function related() {
    var M = S.model, out = {};
    if (!M || !S.sel) return out;
    Object.keys(M.pairs).forEach(function (k) {
      var pr = M.pairs[k];
      if (S.ent) {
        if (!pr.edges.some(function (e) { return e.from === S.ent || e.to === S.ent; })) return;
      }
      if (pr.a === S.sel) out[pr.b] = 1;
      if (pr.b === S.sel) out[pr.a] = 1;
    });
    return out;
  }

  function highlight() {
    var M = S.model, near = related();
    var has = !!S.sel;
    S.svg.selectAll(".map-arc").classed("dim", function (pr) {
      if (!has) return false;
      if (pr.a !== S.sel && pr.b !== S.sel) return true;
      if (S.ent) return !pr.edges.some(function (e) { return e.from === S.ent || e.to === S.ent; });
      return false;
    }).classed("hot", function (pr) {
      if (!has || (pr.a !== S.sel && pr.b !== S.sel)) return false;
      return S.ent ? pr.edges.some(function (e) { return e.from === S.ent || e.to === S.ent; }) : true;
    });
    S.svg.selectAll(".map-mk").classed("dim", function (p) {
      return has && p.pid !== S.sel && !near[p.pid];
    }).classed("sel", function (p) { return p.pid === S.sel; });
    labels();
  }

  // --------------------------------------------------------------------------
  // the side panel
  // --------------------------------------------------------------------------
  function entLink(e) {
    return '<a href="#" data-ent="' + h(e.id) + '">' + h(e.label) + "</a>";
  }
  function placeLink(pid) {
    var p = S.model.places[pid];
    return '<a href="#" data-place="' + h(pid) + '">' + h(p ? p.label : pid) + "</a>";
  }
  function otherEnd(c, here) {
    var M = S.model;
    return M.placeOf[c.from] === here ? M.byId[c.to] : M.byId[c.from];
  }
  function relLine(c) {
    var M = S.model, a = M.byId[c.from], b = M.byId[c.to];
    return h(a.label) + ' <span class="rel">' + h(relName(c.type)) + " \u2192</span> " + h(b.label);
  }

  function openPanel(html) {
    var box = $("detail");
    box.innerHTML = '<button class="close" aria-label="Close">\u00D7</button>' + html;
    box.classList.add("open");
    box.querySelector(".close").addEventListener("click", function () { select(null); });
    box.querySelectorAll("a[data-place]").forEach(function (a) {
      a.addEventListener("click", function (ev) { ev.preventDefault(); S.ent = null; select(a.getAttribute("data-place")); });
    });
    box.querySelectorAll("a[data-ent]").forEach(function (a) {
      a.addEventListener("click", function (ev) {
        ev.preventDefault();
        var id = a.getAttribute("data-ent");
        S.ent = S.ent === id ? null : id;
        select(S.sel, true);
      });
    });
    var net = box.querySelector("[data-network]");
    if (net) net.addEventListener("click", function () { showInNetwork(net.getAttribute("data-network")); });
  }

  function select(pid, keepEnt) {
    if (!keepEnt) S.ent = null;
    S.sel = pid;
    if (!pid) { $("detail").classList.remove("open"); highlight(); return; }
    var M = S.model, p = M.places[pid];
    if (!p) { S.sel = null; highlight(); return; }
    highlight();
    if (p.kind === "area") return areaPanel(p);
    countryPanel(p);
  }

  function countryPanel(p) {
    var M = S.model, pid = p.pid;
    var html = "<h3>" + h(p.label) + "</h3>" +
      '<p class="kind">Country \u00B7 ' + p.ents.length + (p.ents.length === 1 ? " actor" : " actors") + " on the map</p>";

    if (S.ent && M.byId[S.ent]) {
      var fe = M.byId[S.ent];
      html += '<p class="blurb"><b>Showing only ' + h(fe.label) + "</b>. " +
        '<a href="#" data-ent="' + h(fe.id) + '">Show everyone again</a> \u00B7 ' +
        '<button type="button" class="linkish" data-network="' + h(fe.id) + '">Open in the network</button></p>';
    }

    // actors here, grouped by kind
    var groups = {};
    p.ents.forEach(function (e) { (groups[e.type] = groups[e.type] || []).push(e); });
    html += "<h4>Actors here</h4><ul>";
    NODE_TYPES.forEach(function (t) {
      var g = groups[t[0]];
      if (!g) return;
      html += '<li class="grp" style="--lk:' + nodeColour(t[0]) + '">' + h(t[1]) + "</li>";
      g.sort(function (a, b) { return a.label.localeCompare(b.label); }).forEach(function (e) {
        html += '<li style="--lk:' + nodeColour(t[0]) + '">' + entLink(e) + (S.ent === e.id ? " \u2190" : "") + "</li>";
      });
    });
    html += "</ul>";

    // connections to other places
    var by = {};
    Object.keys(M.pairs).forEach(function (k) {
      var pr = M.pairs[k];
      if (pr.a !== pid && pr.b !== pid) return;
      var other = pr.a === pid ? pr.b : pr.a;
      var list = pr.edges.filter(function (e) { return !S.ent || e.from === S.ent || e.to === S.ent; });
      if (list.length) by[other] = (by[other] || []).concat(list);
    });
    var others = Object.keys(by).sort(function (a, b) {
      var ka = M.places[a].kind === "area" ? 0 : 1, kb = M.places[b].kind === "area" ? 0 : 1;
      return ka - kb || by[b].length - by[a].length;
    });
    var nAreas = others.filter(function (o) { return M.places[o].kind === "area"; }).length;
    html += "<h4>Connections to seabed areas and other countries (" + others.length + ")</h4>";
    if (!others.length) html += '<p class="blurb">None with the current filters.</p>';
    else {
      html += "<ul>";
      others.forEach(function (o) {
        var q = M.places[o];
        html += '<li style="--lk:' + famColour(relFam(by[o][0].type)) + '">' +
          (q.kind === "area" ? "Seabed: " : "") + "<b>" + placeLink(o) + "</b> " +
          '<span class="rel">(' + by[o].length + ")</span>" +
          by[o].map(function (c) { return '<br><span class="small">' + relLine(c) + "</span>"; }).join("") + "</li>";
      });
      html += "</ul>";
      if (nAreas) html += '<p class="small rel">' + nAreas + (nAreas === 1 ? " seabed area" : " seabed areas") + " linked.</p>";
    }

    // inside the country
    var inside = (M.internal[pid] || []).filter(function (c) { return !S.ent || c.from === S.ent || c.to === S.ent; });
    if (inside.length) {
      html += "<details><summary>Within " + h(p.label) + " (" + inside.length + ")</summary><ul>" +
        inside.map(function (c) { return '<li class="small">' + relLine(c) + "</li>"; }).join("") + "</ul></details>";
    }
    openPanel(html);
  }

  function areaPanel(p) {
    var M = S.model, e = p.ent, pid = p.pid;
    var reg = (p.track || "").split("|").filter(Boolean).map(function (t) { return REGIME[t] || t; }).join(" and ");
    var html = "<h3>" + h(p.label) + "</h3>" +
      '<p class="kind">Seabed area' + (reg ? " \u00B7 " + h(reg) : "") + (e.country ? " \u00B7 " + h(e.country) : "") + "</p>" +
      (e.description ? '<p class="blurb">' + h(e.description) + "</p>" : "");

    var rows = M.edges.filter(function (c) { return c.from === e.id || c.to === e.id; });
    html += "<h4>Who is linked to it (" + rows.length + ")</h4>";
    if (!rows.length) html += '<p class="blurb">No one, with the current filters.</p>';
    else {
      html += "<ul>";
      rows.forEach(function (c) {
        var o = otherEnd(c, pid), opid = M.placeOf[o.id], op = opid && M.places[opid];
        html += '<li style="--lk:' + famColour(relFam(c.type)) + '">' + relLine(c) +
          (op && op.kind === "country" ? ' <span class="rel">\u00B7 ' + placeLink(opid) + "</span>" : "") + "</li>";
      });
      html += "</ul>";
    }
    var countries = {};
    rows.forEach(function (c) {
      var o = otherEnd(c, pid), opid = M.placeOf[o.id];
      if (opid && M.places[opid].kind === "country") countries[opid] = 1;
    });
    var cl = Object.keys(countries);
    if (cl.length) html += "<h4>Countries involved</h4><p class=\"blurb\">" + cl.map(placeLink).join(", ") + "</p>";
    openPanel(html);
  }

  function showEmpty(country) {
    S.sel = null; S.ent = null; highlight();
    var inData = DATA.elements.some(function (e) { return e.country === country; });
    openPanel("<h3>" + h(country) + "</h3>" + '<p class="blurb">' + (inData
      ? "There are actors recorded here, but none match the current Emphasis and filters."
      : "Nothing is recorded for this country yet.") + "</p>");
  }

  // --------------------------------------------------------------------------
  // legend, counts, switching
  // --------------------------------------------------------------------------
  function legend() {
    var M = S.model, box = $("worldmap");
    var noPlace = M.unplaced;
    var el = document.createElement("div");
    el.className = "map-legend";
    el.innerHTML =
      '<div class="lg-row"><span class="lg-dot"></span>Country (size = number of actors)</div>' +
      '<div class="lg-row"><span class="lg-dia" style="background:' + tok("--tr-isa", "#C1654B") + '"></span>' +
      '<span class="lg-dia" style="background:' + tok("--tr-dshmra", "#E09070") + '"></span>' +
      '<span class="lg-dia" style="background:' + tok("--tr-eez", "#6FA894") + '"></span>Seabed area: ISA, US track, national</div>' +
      '<div class="lg-row lg-small">Line colour = kind of relationship, as in the sidebar. Thicker = more relationships.</div>' +
      '<div class="lg-row lg-small">Positions are approximate: actors sit at their country\u2019s capital, seabed areas at a representative point.</div>' +
      (S.worldNote ? '<div class="lg-row lg-small">' + h(S.worldNote) + "</div>" : "") +
      (noPlace.length ? '<details class="lg-small"><summary>Not on the map: ' + noPlace.length + "</summary><ul>" +
        noPlace.map(function (u) { return "<li>" + h(u.e.label) + ' <span class="rel">(' + h(u.why) + ")</span></li>"; }).join("") +
        "</ul></details>" : "") +
      (M.problems.length ? '<details class="lg-small lg-warn"><summary>' + M.problems.length + " position problem" +
        (M.problems.length > 1 ? "s" : "") + "</summary><ul>" +
        M.problems.map(function (x) { return "<li>" + h(x) + "</li>"; }).join("") + "</ul></details>" : "") +
      '<button type="button" class="lg-reset">Reset view</button>';
    box.appendChild(el);
    el.querySelector(".lg-reset").addEventListener("click", function () {
      S.svg.transition().duration(350).call(S.zoom.transform, window.d3.zoomIdentity);
    });
  }

  function readout() {
    var M = S.model;
    var nEnts = Object.keys(M.placeOf).length;
    var nPlaces = Object.keys(M.places).length;
    $("n-nodes").textContent = nEnts;
    $("n-edges").textContent = M.edges.length;
    var xw = $("xing-wrap");
    if (xw) { xw.style.display = ""; xw.innerHTML = "<b>" + nPlaces + "</b> places on the map"; }
  }

  function setRailForMap(on) {
    ["layout", "roleorder", "sort", "depth"].forEach(function (id) {
      var el = $(id);
      if (el) el.disabled = on;
    });
    var note = $("map-rail-note");
    var lay = $("layout");
    if (on && !note && lay) {
      note = document.createElement("p");
      note.id = "map-rail-note";
      note.className = "hint";
      note.style.marginTop = "8px";
      note.textContent = "The world map has its own layout, so these settings are paused. Emphasis and the filters below still apply.";
      lay.parentNode.insertBefore(note, lay.nextSibling);
    }
    if (!on && note) note.remove();
  }

  function setButton() {
    var b = $("map-toggle");
    b.textContent = S.on ? "Back to the network" : "World map";
    b.setAttribute("aria-pressed", S.on ? "true" : "false");
  }

  function showMap() {
    if (!appReady()) return;
    S.on = true;
    setButton();
    $("graph").style.display = "none";
    var box = $("worldmap");
    box.hidden = false;
    setRailForMap(true);
    if (typeof closeDetail === "function") closeDetail();
    box.innerHTML = '<p class="map-msg">Loading the map\u2026</p>';
    load().then(function () {
      if (S.on) draw();
    }).catch(function (err) {
      box.innerHTML = '<p class="map-msg">The map could not load: ' + h(err.message) + "</p>";
    });
  }

  function showNetwork() {
    S.on = false;
    S.sel = null; S.ent = null;
    setButton();
    $("worldmap").hidden = true;
    $("graph").style.display = "";
    setRailForMap(false);
    $("detail").classList.remove("open");
    if (typeof cy !== "undefined") cy.resize();
    if (typeof runLayout === "function") runLayout();
  }

  function showInNetwork(id) {
    showNetwork();
    setTimeout(function () {
      if (typeof cy === "undefined") return;
      var n = cy.getElementById(id);
      if (n && !n.empty() && n.visible()) n.emit("tap");
    }, 500);
  }

  // --------------------------------------------------------------------------
  // wiring
  // --------------------------------------------------------------------------
  function wire() {
    var b = $("map-toggle");
    if (!b || b.dataset.wired) return;
    b.dataset.wired = "1";
    b.addEventListener("click", function () { if (S.on) showNetwork(); else showMap(); });
    // any filter or Emphasis change redraws the map, after the network has updated
    var rail = document.querySelector(".rail");
    if (rail) rail.addEventListener("change", function () {
      if (S.on && S.model) setTimeout(function () {
        if (typeof closeDetail === "function") closeDetail();
        draw();
      }, 0);
    });
    // follow a light/dark theme change
    if (window.matchMedia) {
      var mq = window.matchMedia("(prefers-color-scheme: dark)");
      if (mq.addEventListener) mq.addEventListener("change", function () { if (S.on && S.model) draw(); });
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wire);
  else wire();

  // exposed for testing
  window.DSMMap = { show: showMap, hide: showNetwork, state: S, select: function (pid) { select(pid); } };
})();
