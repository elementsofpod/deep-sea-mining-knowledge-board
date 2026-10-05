/* ============================================================================
   app.js: the interface. Draws the map and wires the controls.
   Loaded by boot.js once the data is ready, so DSM_DATA already exists.
   ========================================================================== */
const DATA = window.DSM_DATA;
const DATA_META = window.DSM_META || { source: "repository", warnings: [] };

const NODE_TYPES = [
  ["company", "Companies", "ellipse"],
  ["state", "States", "round-rectangle"],
  ["regulator", "National regulators", "hexagon"],
  ["body", "International bodies", "hexagon"],
  ["instrument", "Legal instruments", "rectangle"],
  ["area", "Areas and licence zones", "diamond"],
  ["research-org", "Research organisations", "ellipse"],
  ["project", "Research projects", "ellipse"],
  ["ngo", "NGOs", "ellipse"],
  ["exchange", "Stock exchanges", "round-rectangle"],
  ["source", "Data sources", "tag"]
];
const SHAPE = Object.fromEntries(NODE_TYPES.map(t => [t[0], t[2]]));

const FAMILIES = [
  ["authorisation", "Authorisation to operate", [
    ["sponsors", "Sponsors (UNCLOS Art. 153)", "solid"],
    ["issues-contract-to", "ISA issues contract to", "dashed"],
    ["issues-national-licence", "National licence issued to", "dotted"],
    ["applied-for", "Applied for rights", "long"]
  ]],
  ["legal", "Legal basis", [
    ["authorised-under", "Authorised under", "solid"],
    ["enacted", "Enacted by", "dashed"]
  ]],
  ["ownership", "Ownership and capital", [
    ["subsidiary-of", "Subsidiary of", "solid"],
    ["joint-venture-with", "Joint venture or merger", "dashed"],
    ["listed-on", "Listed on", "dotted"],
    ["incorporated-in", "Incorporated in", "long"]
  ]],
  ["access", "Resource access", [
    ["holds-exploration-contract", "Holds ISA exploration contract", "solid"],
    ["holds-national-licence", "Holds national licence", "dashed"],
    ["former-licence", "Former or lapsed rights", "dotted"]
  ]],
  ["cooperation", "Cooperation", [
    ["mou-with", "Memorandum of understanding", "solid"],
    ["partner-in", "Partner in project", "dashed"],
    ["supplies-technology-to", "Supplies technology to", "dotted"],
    ["funds", "Funds", "long"]
  ]],
  ["knowledge", "Knowledge and oversight", [
    ["monitors", "Monitors", "solid"],
    ["studies", "Studies", "dashed"]
  ]],
  ["position", "Position and contestation", [
    ["opposes", "Opposes", "solid"],
    ["advocates-to", "Advocates to", "dashed"],
    ["supports-moratorium", "Supports moratorium or pause", "dotted"]
  ]],
  ["structure", "Institutional structure", [
    ["organ-of", "Organ of", "solid"],
    ["member-of", "Member of", "dashed"]
  ]],
  ["information", "Where the data comes from", [
    ["publishes", "Publishes", "solid"],
    ["documents", "Documents", "dashed"],
    ["derives-from", "Derived from another source", "dotted"],
    ["withholds", "Withholds", "long"]
  ]]
];

const EDGE_META = {};
FAMILIES.forEach(([fam, , members]) => members.forEach(([type, name, pattern]) => {
  EDGE_META[type] = { family: fam, name: name, pattern: pattern };
}));

const PATTERN = {
  solid:  { "line-style": "solid" },
  dashed: { "line-style": "dashed", "line-dash-pattern": [6, 3] },
  dotted: { "line-style": "dotted" },
  long:   { "line-style": "dashed", "line-dash-pattern": [14, 5] }
};
const SVG_DASH = { solid: "", dashed: "6 3", dotted: "1.6 3", long: "13 5" };

const EMPHASIS = {
  "Everything": { nodes: null, edges: null },
  "Three permitting tracks": {
    band: "track",
    nodes: ["company", "state", "regulator", "body", "instrument", "area", "exchange"],
    edges: ["sponsors", "issues-contract-to", "issues-national-licence", "applied-for",
            "holds-exploration-contract", "holds-national-licence", "former-licence",
            "authorised-under", "enacted", "subsidiary-of", "listed-on"]
  },
  "National jurisdictions": {
    band: "track",
    nodes: ["company", "regulator", "area", "instrument", "state"],
    edges: ["issues-national-licence", "holds-national-licence", "applied-for",
            "former-licence", "enacted", "authorised-under"]
  },
  "Legal architecture": {
    nodes: ["instrument", "body", "regulator", "state"],
    edges: ["authorised-under", "enacted", "organ-of", "member-of"]
  },
  "Corporate structure": {
    nodes: ["company", "exchange", "state"],
    edges: ["subsidiary-of", "joint-venture-with", "listed-on", "incorporated-in"]
  },
  "Jurisdiction split": {
    band: "track",
    nodes: ["company", "state", "exchange", "area", "regulator"],
    edges: ["sponsors", "holds-exploration-contract", "holds-national-licence",
            "incorporated-in", "listed-on", "subsidiary-of"]
  },
  "Science network": {
    nodes: ["research-org", "project", "body", "company", "area"],
    edges: ["partner-in", "funds", "monitors", "studies"]
  },
  "Positions and contestation": {
    nodes: ["state", "ngo", "body", "company", "regulator"],
    edges: ["supports-moratorium", "opposes", "advocates-to", "mou-with"]
  },
  "Where the data comes from": {
    nodes: ["source", "body", "regulator", "company", "area", "instrument", "ngo", "research-org", "project"],
    edges: ["publishes", "documents", "derives-from", "withholds"]
  }
};

const css = () => getComputedStyle(document.documentElement);
const nodeColour = t => css().getPropertyValue("--t-" + t).trim() || "#888888";
const famColour  = f => css().getPropertyValue("--f-" + f).trim() || "#888888";

const CONF_RANK = { confirmed: 3, reported: 2, inferred: 1 };
const CONF_OPACITY = { confirmed: 0.85, reported: 0.55, inferred: 0.28 };

const patternSelectors = Object.keys(PATTERN).map(function (name) {
  const types = FAMILIES.reduce(function (acc, f) { return acc.concat(f[2]); }, [])
    .filter(function (m) { return m[2] === name; })
    .map(function (m) { return 'edge[type = "' + m[0] + '"]'; });
  return { selector: types.length ? types.join(", ") : "edge.__none", style: PATTERN[name] };
});

const cy = cytoscape({
  container: document.getElementById("graph"),
  elements: {
    nodes: DATA.elements.map(function (e) {
      return { data: { id: e.id, label: e.label, type: e.type, raw: e } };
    }),
    edges: DATA.connections.map(function (c, i) {
      return { data: {
        id: "e" + i, source: c.from, target: c.to, type: c.type,
        conf: c.confidence,
        fam: (EDGE_META[c.type] || {}).family || "structure",
        raw: c
      }};
    })
  },
  minZoom: 0.15, maxZoom: 3,
  style: [
    { selector: "node", style: {
      "background-color": function (e) { return nodeColour(e.data("type")); },
      "shape": function (e) { return SHAPE[e.data("type")] || "ellipse"; },
      "label": "data(label)",
      "font-family": "IBM Plex Sans, sans-serif",
      "font-size": 8.5,
      "color": function () { return css().getPropertyValue("--ink").trim(); },
      "text-valign": "bottom", "text-margin-y": 3,
      "text-max-width": 92, "text-wrap": "ellipsis",
      "width": "mapData(deg, 0, 12, 10, 32)",
      "height": "mapData(deg, 0, 12, 10, 32)",
      "border-width": 0
    }},
    { selector: "edge", style: {
      "width": 1.2,
      "line-color": function (e) { return famColour(e.data("fam")); },
      "target-arrow-color": function (e) { return famColour(e.data("fam")); },
      "opacity": function (e) { return CONF_OPACITY[e.data("conf")] || 0.5; },
      "curve-style": "bezier",
      "target-arrow-shape": "triangle",
      "arrow-scale": 0.5
    }}
  ].concat(patternSelectors).concat([
    { selector: "node[?header]", style: {
      "background-opacity": 0,
      "label": "data(label)",
      "font-family": "Spectral, Georgia, serif",
      "font-size": 13,
      "font-weight": 600,
      "color": function () { return css().getPropertyValue("--ink-soft").trim(); },
      "text-valign": "center", "text-margin-y": 0,
      "text-max-width": 150, "text-wrap": "wrap",
      "width": 1, "height": 1,
      "events": "no"
    }},
    { selector: "node[?blob]", style: {
      "background-color": "data(col)", "background-opacity": 0.085,
      "border-width": 1, "border-color": "data(col)", "border-opacity": 0.3,
      "border-style": "data(bstyle)",
      "shape": "ellipse", "label": "", "events": "no", "z-index": 0,
      "width": "data(d)", "height": "data(d)"
    }},
    { selector: "node.packed", style: {
      "font-size": 7.5, "text-valign": "center", "text-halign": "right",
      "text-margin-x": 4, "text-max-width": 96, "z-index": 10,
      "text-background-color": function () { return css().getPropertyValue("--field").trim(); },
      "text-background-opacity": 0.72, "text-background-padding": 1.5
    }},
    { selector: ".muted", style: { "opacity": 0.2 } },
    { selector: "node.muted", style: { "text-opacity": 0.45 } },
    { selector: ".dim", style: { "opacity": 0.07 } },
    { selector: "node.sel", style: {
      "border-width": 2.5,
      "border-color": function () { return css().getPropertyValue("--focus").trim(); }
    }},
    { selector: "node.dim", style: { "text-opacity": 0 } },
    { selector: "edge.lit", style: { "opacity": 1, "width": 2.4, "z-index": 15,
      "target-arrow-shape": "triangle", "arrow-scale": 0.75 } },
    { selector: "node.lit", style: { "opacity": 1, "text-opacity": 1, "z-index": 20 } },
    { selector: "node.sel", style: { "z-index": 30, "text-opacity": 1 } }
  ])
});
cy.nodes().forEach(function (n) { n.data("deg", n.connectedEdges().length); });

// Column headers are real nodes so they track pan and zoom for free.
const HEADER_SLOTS = 12;
for (var h = 0; h < HEADER_SLOTS; h++) {
  cy.add({ group: "nodes", data: { id: "__hdr" + h, label: "", header: true } });
}
const headers = cy.nodes("[?header]");

const COL_GAP = 250;
const ROW_GAP = 36;

// ===========================================================================
// Layout. Three independent choices:
//   emphasis   — which entities and relationships are in play
//   banding    — whether rows mean something (set by the emphasis)
//   arrangement — columns, clusters, or free
// ===========================================================================
const ROLE_NAMES = ["Capital", "Companies", "States", "Authorities",
                    "Legal basis", "Seabed", "Knowledge & advocacy", "Sources"];
const COL_W = 250, ROW_H = 30;

const BAND_ORDER = ["isa", "isa|dshmra", "dshmra", "dshmra|eez", "eez",
                    "isa|eez", "isa|dshmra|eez", "none"];
const BAND_NAME = {
  "isa": "ISA regime (UNCLOS Part XI)",
  "isa|dshmra": "Both ISA and US tracks",
  "dshmra": "US unilateral track (DSHMRA / NOAA)",
  "dshmra|eez": "Both US track and national",
  "eez": "National jurisdiction (EEZ and shelf)",
  "isa|eez": "Both ISA and national",
  "isa|dshmra|eez": "All three tracks",
  "none": "Outside all three"
};
function bandIndex(k) {
  const i = BAND_ORDER.indexOf(k);
  return i === -1 ? BAND_ORDER.length - 1 : i;
}
function bandMode() {
  const e = EMPHASIS[document.getElementById("emphasis").value];
  return (e && e.band) || null;
}
function bandOf(n) {
  if (bandMode() !== "track") return 0;
  return bandIndex(n.data("raw").track || "none");
}

// --- column order is a display choice, not a property of the data ---
function currentRoleOrder() {
  const v = document.getElementById("roleorder").value;
  if (v !== "auto") {
    const o = v.split(",").map(Number);
    return o.length === ROLE_NAMES.length ? o : ROLE_NAMES.map(function (_, i) { return i; });
  }
  return bestRoleOrder();
}
function spanCost(order) {
  const slot = {};
  order.forEach(function (r, i) { slot[r] = i; });
  var cost = 0;
  cy.edges(":visible").forEach(function (e) {
    const a = e.source().data("raw"), b = e.target().data("raw");
    if (!a || !b || a.role_x === "" || b.role_x === "") return;
    const d = Math.abs(slot[parseInt(a.role_x, 10)] - slot[parseInt(b.role_x, 10)]);
    if (d > 1) cost += d - 1;
  });
  return cost;
}
function bestRoleOrder() {
  // 8! is too many to enumerate, so improve by pairwise swaps until settled.
  var order = ROLE_NAMES.map(function (_, i) { return i; });
  var best = spanCost(order), improved = true, guard = 0;
  while (improved && guard++ < 40) {
    improved = false;
    for (var i = 0; i < order.length; i++) {
      for (var j = i + 1; j < order.length; j++) {
        const t = order.slice();
        t[i] = order[j]; t[j] = order[i];
        const c = spanCost(t);
        if (c < best) { best = c; order = t; improved = true; }
      }
    }
  }
  return order;
}
function roleSlotMap() {
  const order = currentRoleOrder();
  const slot = {};
  order.forEach(function (r, i) { slot[r] = i; });
  return { slot: slot, order: order };
}

// --- filtering, shared by every arrangement ---
function filterPass(pool) {
  const nodeOn = checked("node");
  const edgeOn = checked("edge");
  const floor = CONF_RANK[document.getElementById("confidence").value] || 0;
  pool.forEach(function (n) {
    const raw = n.data("raw");
    const ok = raw && raw.role_x !== "" && raw.role_x !== undefined && nodeOn.has(n.data("type"));
    n.style("display", ok ? "element" : "none");
  });
  cy.edges().forEach(function (e) {
    const ok = edgeOn.has(e.data("type"))
      && (CONF_RANK[e.data("conf")] || 0) >= floor
      && e.source().visible() && e.target().visible();
    e.style("display", ok ? "element" : "none");
  });
  pool.forEach(function (n) {
    if (n.visible() && n.connectedEdges(":visible").length === 0) n.style("display", "none");
  });
  cy.edges().forEach(function (e) {
    if (e.visible() && !(e.source().visible() && e.target().visible())) e.style("display", "none");
  });
}

// Background discs for the cluster arrangement.
const BLOB_SLOTS = 40;
for (var bi = 0; bi < BLOB_SLOTS; bi++) {
  cy.add({ group: "nodes", data: { id: "__blob" + bi, blob: true, col: "#888", d: 10, bstyle: "solid" } });
}
const blobs = cy.nodes("[?blob]");
blobs.style("display", "none");

function buildGroups(pool, RS) {
  const groups = {};
  pool.filter(":visible").forEach(function (n) {
    const slot = RS.slot[parseInt(n.data("raw").role_x, 10)];
    const b = bandOf(n);
    n.toggleClass("muted", bandMode() === "track" && !(n.data("raw").track));
    const key = slot + "::" + b;
    (groups[key] = groups[key] || []).push(n);
  });
  return groups;
}

function countrySort(list) {
  return list.slice().sort(function (a, b) {
    const ra = parseInt(a.data("raw").country_rank, 10);
    const rb = parseInt(b.data("raw").country_rank, 10);
    const va = isNaN(ra) ? 999 : ra, vb = isNaN(rb) ? 999 : rb;
    if (va !== vb) return va - vb;
    return a.data("label").localeCompare(b.data("label"));
  });
}

// ---------------------------------------------------------------------------
// Columns. Within each group, either country bands or barycentre sweeps that
// pull each element level with the elements it connects to.
// ---------------------------------------------------------------------------
function columnsArrangement(pool, RS) {
  const groups = buildGroups(pool, RS);
  const keys = Object.keys(groups);
  const rowMax = {};
  keys.forEach(function (k) {
    const b = parseInt(k.split("::")[1], 10);
    rowMax[b] = Math.max(rowMax[b] || 0, groups[k].length);
  });
  const rows = Object.keys(rowMax).map(Number).sort(function (a, b) { return a - b; });
  const rowY = {}; var acc = 0;
  rows.forEach(function (r, i) {
    if (i > 0) acc += (rowMax[rows[i - 1]] / 2 + rowMax[r] / 2) * ROW_H + 96;
    rowY[r] = acc;
  });

  const pos = {};
  keys.forEach(function (k) {
    const parts = k.split("::");
    const list = countrySort(groups[k]);
    groups[k] = list;
    const x = parseInt(parts[0], 10) * COL_W;
    const cy0 = rowY[parseInt(parts[1], 10)];
    list.forEach(function (n, i) {
      pos[n.id()] = { x: x, y: cy0 + (i - (list.length - 1) / 2) * ROW_H };
    });
  });

  if (document.getElementById("sort").value === "barycentre") {
    for (var pass = 0; pass < 14; pass++) {
      const seq = pass % 2 === 0 ? keys : keys.slice().reverse();
      seq.forEach(function (k) {
        const list = groups[k];
        if (list.length < 2) return;
        const bary = {};
        list.forEach(function (n) {
          const ns = n.connectedEdges(":visible").map(function (e) {
            return e.source().id() === n.id() ? e.target() : e.source();
          }).filter(function (m) { return pos[m.id()] && m.id() !== n.id(); });
          bary[n.id()] = ns.length
            ? ns.reduce(function (t, m) { return t + pos[m.id()].y; }, 0) / ns.length
            : pos[n.id()].y;
        });
        const sorted = list.slice().sort(function (a, b) { return bary[a.id()] - bary[b.id()]; });
        const slots = list.map(function (n) { return pos[n.id()].y; }).sort(function (a, b) { return a - b; });
        sorted.forEach(function (n, i) { pos[n.id()].y = slots[i]; });
        groups[k] = sorted;
      });
    }
  }
  return { pos: pos, rows: rows, rowY: rowY, rowMax: rowMax, topY: rowY[rows[0]] - rowMax[rows[0]] / 2 * ROW_H };
}

// ---------------------------------------------------------------------------
// Clusters. Same grid of groups, but each one is a floating blob.
// ---------------------------------------------------------------------------
function clustersArrangement(pool, RS) {
  const groups = buildGroups(pool, RS);
  const keys = Object.keys(groups);
  const meta = {};
  keys.forEach(function (k) {
    const parts = k.split("::");
    meta[k] = { col: parseInt(parts[0], 10), band: parseInt(parts[1], 10),
                n: groups[k].length, r: 26 * Math.sqrt(groups[k].length) + 20 };
  });
  const PAD = 58, colR = {}, bandR = {};
  keys.forEach(function (k) {
    const m = meta[k];
    colR[m.col] = Math.max(colR[m.col] || 0, m.r);
    bandR[m.band] = Math.max(bandR[m.band] || 0, m.r);
  });
  const colIdx = Object.keys(colR).map(Number).sort(function (a, b) { return a - b; });
  const colX = {}; var cx = 0;
  colIdx.forEach(function (c, i) {
    if (i > 0) cx += colR[colIdx[i - 1]] + colR[c] + PAD;
    colX[c] = cx;
  });
  const bandIdx = Object.keys(bandR).map(Number).sort(function (a, b) { return a - b; });
  const bandY = {}; var cyy = 0;
  bandIdx.forEach(function (b, i) {
    if (i > 0) cyy += bandR[bandIdx[i - 1]] + bandR[b] + PAD;
    bandY[b] = cyy;
  });

  const pos = {};
  keys.forEach(function (k) {
    const m = meta[k], list = groups[k];
    const bx = colX[m.col], by = bandY[m.band];
    m.cx = bx; m.cy = by;
    const pts = list.map(function (n, i) {
      const a = i * 2.3999632;
      const rad = m.r * 0.82 * Math.sqrt((i + 0.5) / list.length);
      return { id: n.id(), x: bx + rad * Math.cos(a), y: by + rad * Math.sin(a) };
    });
    const idx = {}; pts.forEach(function (pt, i) { idx[pt.id] = i; });
    const pairs = [];
    list.forEach(function (n) {
      n.connectedEdges(":visible").forEach(function (e) {
        const a = e.source().id(), b = e.target().id();
        if (idx[a] !== undefined && idx[b] !== undefined && a !== b) pairs.push([idx[a], idx[b]]);
      });
    });
    const MIN = 30;
    for (var it = 0; it < 200; it++) {
      for (var i = 0; i < pts.length; i++) {
        for (var j = i + 1; j < pts.length; j++) {
          var dx = pts[j].x - pts[i].x, dy = pts[j].y - pts[i].y;
          var d = Math.sqrt(dx * dx + dy * dy) || 0.01;
          if (d < MIN) {
            var push = (MIN - d) / d * 0.5;
            pts[i].x -= dx * push; pts[i].y -= dy * push;
            pts[j].x += dx * push; pts[j].y += dy * push;
          }
        }
      }
      pairs.forEach(function (pr) {
        const a = pts[pr[0]], b = pts[pr[1]];
        var dx = b.x - a.x, dy = b.y - a.y;
        a.x += dx * 0.012; a.y += dy * 0.012;
        b.x -= dx * 0.012; b.y -= dy * 0.012;
      });
      pts.forEach(function (pt) {
        var dx = pt.x - bx, dy = pt.y - by;
        var d = Math.sqrt(dx * dx + dy * dy);
        pt.x -= dx * 0.02; pt.y -= dy * 0.02;
        if (d > m.r * 0.9) { var sc = (m.r * 0.9) / d; pt.x = bx + dx * sc; pt.y = by + dy * sc; }
      });
    }
    pts.forEach(function (pt) { pos[pt.id] = { x: pt.x, y: pt.y }; });
  });

  blobs.style("display", "none");
  keys.forEach(function (k, i) {
    if (i >= BLOB_SLOTS) return;
    const m = meta[k], b = cy.getElementById("__blob" + i);
    if (!b || b.empty()) return;
    const tkey = bandMode() === "track" ? BAND_ORDER[m.band] : null;
    const tok = tkey && tkey !== "none" ? ("--tr-" + tkey.split("|")[0]) : "--tr-none";
    b.data("col", css().getPropertyValue(tok).trim() || "#888");
    b.data("d", m.r * 2);
    b.data("bstyle", tkey && tkey.indexOf("|") !== -1 ? "dashed" : "solid");
    b.style("display", "element");
    pos[b.id()] = { x: m.cx, y: m.cy };
  });

  return { pos: pos, colX: colX, bandY: bandY, bandIdx: bandIdx, colR: colR, colIdx: colIdx,
           bandR: bandR, topY: -(bandR[bandIdx[0]] + 80) };
}

function runLayout() {
  if (typeof detail !== "undefined") closeDetail();
  const mode = document.getElementById("layout").value;
  const pool = cy.nodes().filter(function (n) { return !n.data("header") && !n.data("blob"); });
  filterPass(pool);

  const xw = document.getElementById("xing-wrap");
  if (mode === "force") {
    headers.style("display", "none");
    blobs.style("display", "none");
    cy.nodes().removeClass("packed muted");
    xw.style.display = "none";
    pool.filter(":visible").layout({
      name: "cose", animate: true, animationDuration: 440,
      nodeRepulsion: 10000, idealEdgeLength: 90, gravity: 0.55,
      numIter: 900, fit: true, padding: 50, randomize: false
    }).run();
    document.getElementById("n-nodes").textContent = pool.filter(":visible").length;
    document.getElementById("n-edges").textContent = cy.edges(":visible").length;
    return;
  }

  const RS = roleSlotMap();
  var out, pos;
  if (mode === "clusters") {
    cy.nodes().addClass("packed");
    out = clustersArrangement(pool, RS);
    pos = out.pos;
  } else {
    blobs.style("display", "none");
    cy.nodes().removeClass("packed");
    out = columnsArrangement(pool, RS);
    pos = out.pos;
  }

  // Column headings, only for columns that actually hold something.
  headers.style("display", "none");
  const usedSlots = {};
  pool.filter(":visible").forEach(function (n) {
    usedSlots[RS.slot[parseInt(n.data("raw").role_x, 10)]] = parseInt(n.data("raw").role_x, 10);
  });
  Object.keys(usedSlots).map(Number).sort(function (a, b) { return a - b; })
    .forEach(function (slot, i) {
      if (i >= 8) return;
      const h = cy.getElementById("__hdr" + i);
      if (!h || h.empty()) return;
      const x = mode === "clusters" ? out.colX[slot] : slot * COL_W;
      if (x === undefined) return;
      h.data("label", ROLE_NAMES[usedSlots[slot]]);
      h.style("display", "element");
      pos[h.id()] = { x: x, y: out.topY - 66 };
    });

  // Band headings, only when rows mean something.
  if (bandMode() === "track") {
    const bands = mode === "clusters" ? out.bandIdx : out.rows;
    const leftX = mode === "clusters" ? -(out.colR[out.colIdx[0]] + 150) : -1.2 * COL_W;
    bands.slice(0, 4).forEach(function (b, i) {
      const h = cy.getElementById("__hdr" + (8 + i));
      if (!h || h.empty()) return;
      h.data("label", BAND_NAME[BAND_ORDER[b]] || "");
      h.style("display", "element");
      pos[h.id()] = { x: leftX, y: mode === "clusters" ? out.bandY[b] : out.rowY[b] };
    });
  }

  document.getElementById("n-nodes").textContent = pool.filter(":visible").length;
  document.getElementById("n-edges").textContent = cy.edges(":visible").length;
  xw.innerHTML = '<b id="n-xing">' + spanCost(RS.order) + '</b> column-spanning edges';
  xw.style.display = "";

  Object.keys(PINNED).forEach(function (id) {
    if (pos[id]) pos[id] = { x: PINNED[id].x, y: PINNED[id].y };
  });
  updateSaveNote();

  cy.layout({ name: "preset", positions: function (n) { return pos[n.id()] || n.position(); },
              animate: true, animationDuration: 440, fit: true, padding: 60 }).run();
}

function lineSample(colour, pattern) {
  return '<svg width="22" height="8" aria-hidden="true">' +
    '<line x1="1" y1="4" x2="21" y2="4" stroke="' + colour + '" stroke-width="1.8"' +
    (SVG_DASH[pattern] ? ' stroke-dasharray="' + SVG_DASH[pattern] + '"' : '') +
    ' stroke-linecap="round"/></svg>';
}

const nodeBox = document.getElementById("node-layers");
NODE_TYPES.forEach(function (t) {
  const value = t[0], name = t[1];
  const count = DATA.elements.filter(function (e) { return e.type === value; }).length;
  if (!count) return;
  const l = document.createElement("label");
  l.className = "layer";
  l.style.color = nodeColour(value);
  l.innerHTML = '<input type="checkbox" checked data-kind="node" value="' + value + '">' +
    '<span class="tick"></span><span class="name">' + name + '</span><span class="n">' + count + '</span>';
  nodeBox.appendChild(l);
});

const edgeBox = document.getElementById("edge-layers");
FAMILIES.forEach(function (f) {
  const fam = f[0], famName = f[1], members = f[2];
  const live = members.filter(function (m) {
    return DATA.connections.some(function (c) { return c.type === m[0]; });
  });
  if (!live.length) return;
  const wrap = document.createElement("div");
  wrap.className = "family";
  wrap.style.setProperty("--fam", famColour(fam));
  const head = document.createElement("button");
  head.className = "fam";
  head.type = "button";
  head.innerHTML = '<span class="bar"></span><span>' + famName + '</span>';
  head.addEventListener("click", function () {
    const boxes = [].slice.call(wrap.querySelectorAll('input[data-kind="edge"]'));
    const turnOn = boxes.some(function (b) { return !b.checked; });
    boxes.forEach(function (b) { b.checked = turnOn; });
    runLayout();
  });
  wrap.appendChild(head);
  live.forEach(function (m) {
    const type = m[0], name = m[1], pattern = m[2];
    const count = DATA.connections.filter(function (c) { return c.type === type; }).length;
    const l = document.createElement("label");
    l.className = "layer";
    l.style.color = famColour(fam);
    l.innerHTML = '<input type="checkbox" checked data-kind="edge" value="' + type + '">' +
      '<span class="tick"></span>' + lineSample(famColour(fam), pattern) +
      '<span class="name">' + name + '</span><span class="n">' + count + '</span>';
    wrap.appendChild(l);
  });
  edgeBox.appendChild(wrap);
});

const emphasisSel = document.getElementById("emphasis");
Object.keys(EMPHASIS).forEach(function (name) {
  const o = document.createElement("option");
  o.value = name; o.textContent = name;
  emphasisSel.appendChild(o);
});

function applyEmphasis() {
  const v = EMPHASIS[emphasisSel.value] || EMPHASIS["Everything"];
  document.querySelectorAll('input[data-kind="node"]').forEach(function (i) {
    i.checked = v.nodes === null ? true : v.nodes.indexOf(i.value) !== -1;
  });
  document.querySelectorAll('input[data-kind="edge"]').forEach(function (i) {
    i.checked = v.edges === null ? true : v.edges.indexOf(i.value) !== -1;
  });
  runLayout();
}

function checked(kind) {
  return new Set([].slice.call(
    document.querySelectorAll('input[data-kind="' + kind + '"]:checked')
  ).map(function (i) { return i.value; }));
}

document.querySelectorAll('input[type="checkbox"]').forEach(function (i) {
  i.addEventListener("change", runLayout);
});
document.getElementById("confidence").addEventListener("change", runLayout);
emphasisSel.addEventListener("change", applyEmphasis);
document.getElementById("layout").addEventListener("change", runLayout);
document.getElementById("sort").addEventListener("change", runLayout);
document.getElementById("roleorder").addEventListener("change", runLayout);
document.getElementById("depth").addEventListener("change", function () {
  const sel = cy.nodes(".sel");
  if (sel.length) sel.emit("tap");
});

const detail = document.getElementById("detail");
function closeDetail() {
  detail.classList.remove("open");
  cy.elements().removeClass("dim sel lit");
}
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"]/g, function (ch) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch];
  });
}

cy.on("tap", "node", function (evt) {
  const n = evt.target, e = n.data("raw");
  if (n.data("header") || n.data("blob")) return;
  const depth = parseInt(document.getElementById("depth").value, 10) || 1;
  cy.elements().removeClass("dim sel lit");
  cy.elements().not(headers).not(blobs).addClass("dim");
  var hood = n.closedNeighborhood();
  for (var d = 1; d < depth; d++) hood = hood.closedNeighborhood();
  hood.filter(":visible").removeClass("dim").addClass("lit");
  n.addClass("sel");

  const rows = n.connectedEdges(":visible").map(function (ed) {
    const out = ed.source().id() === n.id();
    const other = out ? ed.target() : ed.source();
    const c = ed.data("raw");
    const meta = EDGE_META[c.type] || { name: c.type, family: "structure" };
    const when = c.start_date ? c.start_date.slice(0, 4) : "";
    return '<li style="--fam:' + famColour(meta.family) + '">' +
      '<span class="rel">' + (out ? "" : "← ") + esc(meta.name) + (out ? " →" : "") + '</span> ' +
      esc(other.data("label")) +
      (when ? ' <span class="rel">' + esc(when) + '</span>' : '') +
      (c.status && c.status !== "active" ? ' <span class="rel">(' + esc(c.status) + ')</span>' : '') +
      '</li>';
  }).join("");

  detail.innerHTML =
    '<button class="close" aria-label="Close">×</button>' +
    '<h3>' + esc(e.label) + '</h3>' +
    '<p class="kind">' + esc(e.subtype || e.type) + (e.country ? " &middot; " + esc(e.country) : "") + '</p>' +
    (e.description ? '<p class="blurb">' + esc(e.description) + '</p>' : '') +
    (e.access ? '<span class="flag">access: ' + esc(e.access) + '</span>' : '') +
    (e.licence ? '<span class="flag">licence: ' + esc(e.licence) + '</span>' : '') +
    '<span class="flag">' + esc(e.confidence) + '</span>' +
    '<span class="flag">' + (e.last_verified ? "verified " + esc(e.last_verified) : "never verified") + '</span>' +
    (e.source_url ? '<span class="flag"><a href="' + esc(e.source_url) + '" target="_blank" rel="noopener">source</a></span>' : '') +
    (rows ? '<h4>Connections in this view</h4><ul>' + rows + '</ul>' : '');
  detail.classList.add("open");
  detail.querySelector(".close").addEventListener("click", closeDetail);
});
cy.on("tap", function (evt) { if (evt.target === cy) closeDetail(); });

window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () {
  setTimeout(function () {
    cy.style()
      .selector("node").style({
        "background-color": function (e) { return nodeColour(e.data("type")); },
        "color": css().getPropertyValue("--ink").trim()
      })
      .selector("edge").style({
        "line-color": function (e) { return famColour(e.data("fam")); },
        "target-arrow-color": function (e) { return famColour(e.data("fam")); }
      })
      .update();
  }, 50);
});

// ---------------------------------------------------------------------------
// Session persistence. Per-viewer, kept in this browser only: nothing is
// shared and nothing is written back to the dataset. Dragged positions are
// remembered as overrides and survive a change of arrangement until released.
// ---------------------------------------------------------------------------
const STORE_KEY = (window.DSM_CONFIG && window.DSM_CONFIG.storageKey) || "dsm-board-session-v1";
var PINNED = {};

function readStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) { return null; }
}
function writeStore() {
  try {
    const controls = {};
    ["emphasis", "layout", "roleorder", "sort", "confidence", "depth"].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) controls[id] = el.value;
    });
    const boxes = {};
    document.querySelectorAll('input[type="checkbox"][data-kind]').forEach(function (i) {
      boxes[i.dataset.kind + ":" + i.value] = i.checked;
    });
    localStorage.setItem(STORE_KEY, JSON.stringify({ controls: controls, boxes: boxes, pinned: PINNED }));
  } catch (err) { /* private browsing, quota, file:// restrictions */ }
}
function updateSaveNote() {
  const n = Object.keys(PINNED).length;
  const el = document.getElementById("save-note");
  if (!el) return;
  el.textContent = n
    ? n + (n === 1 ? " entity has" : " entities have") + " been placed by hand. Settings and positions are kept in this browser."
    : "Settings and anything you drag are kept in this browser.";
}
function restoreSession() {
  const st = readStore();
  if (!st) return false;
  PINNED = st.pinned || {};
  Object.keys(st.controls || {}).forEach(function (id) {
    const el = document.getElementById(id);
    if (el && st.controls[id] !== undefined) el.value = st.controls[id];
  });
  if (st.boxes) {
    document.querySelectorAll('input[type="checkbox"][data-kind]').forEach(function (i) {
      const k = i.dataset.kind + ":" + i.value;
      if (st.boxes[k] !== undefined) i.checked = st.boxes[k];
    });
  }
  return true;
}

cy.on("dragfree", "node", function (evt) {
  const n = evt.target;
  if (n.data("header") || n.data("blob")) return;
  PINNED[n.id()] = { x: n.position("x"), y: n.position("y") };
  updateSaveNote();
  writeStore();
});

document.getElementById("reset-pos").addEventListener("click", function () {
  PINNED = {}; writeStore(); runLayout();
});
document.getElementById("reset-all").addEventListener("click", function () {
  try { localStorage.removeItem(STORE_KEY); } catch (err) {}
  PINNED = {};
  location.reload();
});


// Restore before first paint; otherwise start from the default emphasis.
if (restoreSession()) { runLayout(); } else { applyEmphasis(); }

["emphasis", "layout", "roleorder", "sort", "confidence", "depth"].forEach(function (id) {
  const el = document.getElementById(id);
  if (el) el.addEventListener("change", writeStore);
});
document.querySelectorAll('input[type="checkbox"][data-kind]').forEach(function (i) {
  i.addEventListener("change", writeStore);
});

// ---------------------------------------------------------------------------
// Data status. Says where the data came from and lists anything that was wrong
// with it, so a bad row is visible instead of silently missing.
// ---------------------------------------------------------------------------
(function reportData() {
  const warnings = (DATA_META.warnings || []).slice();
  const unknown = {};
  DATA.connections.forEach(function (c) {
    if (!EDGE_META[c.type]) unknown[c.type] = (unknown[c.type] || 0) + 1;
  });
  Object.keys(unknown).forEach(function (t) {
    warnings.push(unknown[t] + (unknown[t] > 1 ? " relationships" : " relationship") + ' of type "' + t +
      '" cannot be shown because the page does not know that type.');
  });

  const when = DATA_META.loadedAt
    ? new Date(DATA_META.loadedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
  document.getElementById("data-status").textContent =
    "Data: " + (DATA_META.source === "sheet" ? "live sheet" : "repository copy") +
    " \u00b7 " + DATA.elements.length + " entities \u00b7 " + DATA.connections.length + " relationships" +
    (when ? " \u00b7 loaded " + when : "");

  const box = document.getElementById("data-warnings");
  if (warnings.length) {
    document.getElementById("data-warnings-summary").innerHTML =
      '<span class="warn-pill">' + warnings.length + (warnings.length > 1 ? " data problems" : " data problem") + "</span>";
    const ul = document.getElementById("data-warnings-list");
    warnings.forEach(function (w) {
      const li = document.createElement("li");
      li.textContent = w;
      ul.appendChild(li);
    });
    box.hidden = false;
  }
  window.DSM_STARTED = true;
})();
