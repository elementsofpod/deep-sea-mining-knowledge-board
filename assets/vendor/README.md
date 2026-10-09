# Third-party files used by the world map

| File | What it is | Licence |
|---|---|---|
| `d3.min.js` | d3 7.9.0, for drawing the map, zooming and panning | ISC, see `LICENSE-d3.txt` |
| `topojson-client.min.js` | topojson-client 3.1.0, to read the world outline | ISC, see `LICENSE-topojson-client.txt` |
| `../world-110m.json` | world-atlas 2.0.2, `countries-110m.json` | ISC, see `LICENSE-world-atlas.txt`. The shapes come from Natural Earth, which is in the public domain. |

They are kept in the repository rather than loaded from another website, so the
map keeps working even if an outside service is unavailable.
