/* ============================================================================
   boot.js: loads the data first, then starts the interface (app.js).
   Kept separate so a data problem shows a readable message instead of a blank
   page.
   ========================================================================== */
(function () {
  "use strict";

  function fatal(err) {
    if (document.querySelector(".fatal")) return;
    var stage = document.querySelector(".stage") || document.body;
    var box = document.createElement("div");
    box.className = "fatal";
    var inner = document.createElement("div");
    var h = document.createElement("h2");
    h.textContent = "The map could not load";
    var p1 = document.createElement("p");
    p1.textContent = (err && err.message) ? err.message : String(err);
    var p2 = document.createElement("p");
    p2.textContent = "Details are in the browser console (F12). If this keeps happening, check the README.";
    inner.appendChild(h); inner.appendChild(p1); inner.appendChild(p2);
    box.appendChild(inner);
    stage.appendChild(box);
    var s = document.getElementById("data-status");
    if (s) s.textContent = "Data failed to load.";
    if (window.console) console.error(err);
  }

  // A script error after the data loaded would otherwise leave a blank map.
  window.addEventListener("error", function (e) {
    if (e && e.error && !window.DSM_STARTED) fatal(e.error);
  });

  if (typeof cytoscape === "undefined") {
    fatal(new Error("The drawing library (Cytoscape) did not load. Check your connection, or whether a content blocker is stopping cdnjs.cloudflare.com."));
    return;
  }

  window.DSMData.loadData(window.DSM_CONFIG).then(function (result) {
    window.DSM_DATA = result.data;
    window.DSM_META = result.meta;
    var s = document.createElement("script");
    s.src = "assets/app.js";
    s.onerror = function () { fatal(new Error("assets/app.js could not be loaded.")); };
    document.body.appendChild(s);
  }).catch(fatal);
})();
