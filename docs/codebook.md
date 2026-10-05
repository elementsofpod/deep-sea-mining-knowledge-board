# Deep-Sea Mining Knowledge Board — Codebook

The rulebook for the dataset. If a question comes up about how to record
something, the answer goes here so the next person doesn't have to guess.

Version 0.3 (draft, unverified seed data). Scope: **both the Area and national
jurisdiction.**

---

## The data tables

Three small tables. Each is a CSV file in `data/`, and each can also be a tab in
a Google Sheet (the tab names do not matter to the page, but keep them
`Elements`, `Connections` and `Anchors` so nobody has to guess).

| Table | One row per | Typed by hand |
|---|---|---|
| `elements.csv` | entity | yes |
| `connections.csv` | relationship | yes |
| `anchors.csv` | regime anchor (a short list, rarely changed) | yes |

The page checks all three every time it loads. A row it cannot use is skipped and
named in the footer, not silently dropped.

### Elements (one row per entity)

| Column | Required | Notes |
|---|---|---|
| `id` | yes | Lowercase slug, no spaces. Never reuse or change an id once published — connections point at it. |
| `label` | yes | Official name in English, expanded on first use. |
| `type` | yes | Controlled list, below. Drives node colour and shape. |
| `subtype` | no | Finer distinction (`contractor`, `parent`, `applicant`, `national regulator`). |
| `country` | no | Blank for high-seas areas and international bodies. |
| `description` | no | Two sentences maximum. |
| `status` | yes | `active`, `dissolved`, `in force`, `draft`, `unverified` |
| `source_url` | yes | Required on every submission. |
| `confidence` | yes | `confirmed`, `reported`, `inferred` |
| `last_verified` | yes | `YYYY-MM-DD`, the date a human last checked it. |
| `contributed_by` | yes | Name or handle. |
| `access`, `licence`, `cadence` | sources only | How open a `source` row is, under what licence, and how often it updates. Blank on every other type. |
| `image` | no | A flag or logo URL. Kept for other tools; the page does not currently draw it. |

### Connections (one row per relationship)

| Column | Required | Notes |
|---|---|---|
| `from`, `to` | yes | Both must be an `id` in Elements. |
| `type` | yes | Controlled list, below. Drives colour and line pattern. |
| `label` | no | The specific instance (`Polymetallic nodules (Area II)`). |
| `start_date`, `end_date` | no | `YYYY-MM-DD`. Blank end date means ongoing. |
| `status` | yes | `active`, `pending`, `extended`, `suspended`, `ended`, `lapsed`, `disputed` |
| `stake` | no | For ownership: `100%`, `51%`. |
| `source_url`, `confidence`, `last_verified`, `contributed_by` | yes | As above. |
| `source_id` | no | Which `source` node the claim came from. See The source layer. |

One row per relationship instance, not per pair. UK Seabed Resources holds two
separate CCZ contracts, so it gets two rows.

---

## Element types

| Type | Shape | Covers |
|---|---|---|
| `company` | circle | Contractors, licence holders, applicants, parents, technology suppliers |
| `state` | rounded box | Sovereign states in any role: sponsoring, coastal, home, non-party |
| `regulator` | hexagon | National licensing authorities (NOAA, Cook Islands SBMA, Norwegian Ministry of Energy) |
| `body` | hexagon | International organisations and their organs (ISA, Council, LTC, JPI Oceans) |
| `instrument` | box | Treaties, statutes, executive orders, regulations |
| `area` | diamond | Contract areas in the Area, and national licence zones |
| `research-org` | circle | Universities, institutes, geological surveys |
| `project` | circle | Named research programmes |
| `ngo` | circle | Campaign groups and coalitions |
| `exchange` | rounded box | Stock exchanges |
| `source` | tag | Where the data itself comes from: registers, databases, filings, compilations |

Regulators and international bodies share a shape because they do the same job in
different legal orders. That parallel is deliberate: the board should make it easy
to see NOAA and the ISA as two routes to the same seabed.

Some entities are genuinely two things at once. BGR is a research organisation
**and** an ISA contractor. Record the institutional character in `type` and let
the connections carry the role. Don't duplicate the entity.

## Connection types

Grouped into **families**. Colour carries the family; line pattern separates
types within it.

**Authorisation to operate**
| Type | Direction |
|---|---|
| `sponsors` | state → company |
| `issues-contract-to` | ISA → company |
| `issues-national-licence` | regulator → company |
| `applied-for` | company → regulator or area |

**Legal basis**
| Type | Direction |
|---|---|
| `authorised-under` | body/regulator/instrument → instrument |
| `enacted` | state → instrument |

**Ownership and capital**
| Type | Direction |
|---|---|
| `subsidiary-of` | company → company (use `stake`) |
| `joint-venture-with` | company → company |
| `listed-on` | company → exchange |
| `incorporated-in` | company → state |

**Resource access**
| Type | Direction |
|---|---|
| `holds-exploration-contract` | company/state → area (ISA regime) |
| `holds-national-licence` | company → area (national regime) |
| `former-licence` | company → area |

**Cooperation**: `mou-with`, `partner-in`, `supplies-technology-to`, `funds`
**Knowledge and oversight**: `monitors`, `studies`
**Position and contestation**: `opposes`, `advocates-to`, `supports-moratorium`
**Institutional structure**: `organ-of`, `member-of`

**Where the data comes from**
| Type | Direction |
|---|---|
| `publishes` | org → source |
| `documents` | source → whatever it covers |
| `derives-from` | source → source (secondary compilations) |
| `withholds` | org → source (information held back) |

---

## The source layer

Sources are entities, not just URLs. Each carries `access`
(`open`, `registration`, `freemium`, `paywalled`, `confidential`, `varies`),
`licence`, and `cadence`.

Two distinct things are being tracked, and they shouldn't be confused:

1. **Per-row provenance** — `source_url` on each row, as before. Unchanged.
2. **The information system** — roughly sixteen recurring institutional sources,
   who publishes them, what they cover, which ones merely restate others, and
   what is withheld.

The link between them is `source_id` on each connection row, naming which source
node the claim came from. Adding a source node per URL would double the graph and
teach nobody anything; sixteen institutions is the useful granularity.

`source_id` makes coverage checkable. On the current seed:

- **40% of relationship rows have no source attribution at all.**
- Of the rest, **56 of 97 come from one source**, the ISA contractor register.
- The MoU and corporate-ownership layers rest almost entirely on company
  materials and trade press — the two least independent sources in the set.

That concentration is a finding about the evidence base, not a defect in the
tooling. A map that cannot show its own dependence on a single register is
hiding something that matters.

`src-ltc-confidential` exists to record what is *not* available. Application
review and much contractor reporting sit outside public access, and a source
layer that only listed what can be read would misrepresent the information
landscape by omission.

**Keep these separate.** The most useful thing this board can show is that
incorporation, listing, sponsorship, and licence location are four different
jurisdictions for the same company, and that ISA contracts and national licences
are two different legal routes to the same resource. The moment they get collapsed
into "is associated with", both findings disappear.

---

## Visual encoding

Three channels, each carrying one thing:

| Channel | Carries |
|---|---|
| Edge colour | Relationship family |
| Edge line pattern | Which type within that family |
| Edge opacity | Evidence strength (`confirmed` strong, `inferred` faint) |
| Node colour | Entity type |
| Node shape | Entity type, reinforcing colour |
| Node size | Number of connections |

The reason confidence sits on opacity rather than on dashing: dashing is already
doing type work. If both used the same channel, a dashed line would be ambiguous
between "this is a national licence" and "we're not sure about this."

---

## Columns the page works out itself

Three columns used to be typed or produced by scripts. The page now computes them
from the other columns every time it loads. **Never type them into a sheet**; they
are deliberately absent from `data/*.csv`.

| Computed | From | Meaning |
|---|---|---|
| `role_x` | `type` | Which column an entity sits in: Capital 0, Companies 1, States 2, Authorities 3, Legal basis 4, Seabed 5, Knowledge and advocacy 6, Sources 7 |
| `country_rank` | `country` | Orders countries by how many entities each has, so the biggest national groupings form the thickest bands. Ties keep their order of first appearance. |
| `track` | relationships and `anchors.csv` | Which permitting regime or regimes: `isa`, `dshmra`, `eez`. Blank means outside all three. |

The practical consequence: a new row needs nothing beyond the columns in the
tables above to appear in the right place.

Column order and ordering within columns are display choices made in the page, not
properties of the data, which is why neither is stored.

---

## Permitting tracks and the anchors table

**Track is a property of the relationship, not of the entity.** A short list of
anchors is declared by hand in `anchors.csv`, with two columns, `id` and `track`:

| Track | Anchored | Examples |
|---|---|---|
| `isa` | ISA, its organs, UNCLOS, the Mining Code, BBNJ, the ISA contract areas | `isa`, `unclos`, `ccz`, `mar` |
| `dshmra` | NOAA, DSHMRA, EO 14285, the NOAA rule, the Penrhyn Basin | `noaa`, `dshmra`, `penrhyn-basin` |
| `eez` | National regulators, national acts, national waters | `sbma`, `nor-seabed-act`, `ck-eez` |

The page then works out everything else:

1. An authorisation relationship carries the regime of whichever anchor it touches
   and passes it to the other end.
2. An entity still without a regime inherits from a tracked neighbour, in one
   direction only: untracked takes from tracked, never the reverse.
3. A parent company takes the union across its subsidiaries.

That is why The Metals Company shows as both ISA and DSHMRA: its subsidiary NORI
holds ISA contracts, and its sister company TMC USA has applied to NOAA.

**When to add an anchor.** Usually never. A new regulator that issues a licence
over an existing national area picks up `eez` from that one relationship. Add an
anchor only when something belongs to a regime but has no authorisation
relationship to anything already tracked, for example a brand-new national act.

**Why not spread it node to node.** An early attempt did, and within two hops
every entity sat in all three tracks, because hubs like the ISA touch everything.
If the derivation is ever changed, check the multi-track list afterwards: it
should be short (currently seven entities).

**Rows that are not in any track** are drawn greyed, in a row of their own:
exchanges, home states, technology suppliers. That is accurate, not a gap. They
are not parties to any permitting regime.

---

## Confidence

| Value | Test |
|---|---|
| `confirmed` | Stated in a primary source: an ISA document, a company filing, a regulator's notice, a corporate registry. |
| `reported` | Stated in credible secondary reporting but not confirmed at source. |
| `inferred` | A reasonable reading of the evidence, not stated anywhere. |

`inferred` rows are allowed but must say in the description what they were
inferred from.

---

## Editorial rules

1. **No row without a source.** A fact everyone knows still needs a link.
2. **Dead relationships don't get deleted.** Set `end_date` and `status: ended`.
   Nautilus Minerals' collapse and Lockheed Martin's exit tell you things the
   current state of the graph alone doesn't.
3. **Don't change an `id`.** Change the `label` and note the old name.
4. **Re-verify on a cycle.** Anything with `last_verified` older than six months
   is stale. Applications and pending decisions need checking far more often.
5. **Contested facts stay contested.** If two sources disagree, use
   `status: disputed` and put both links in the description.
6. **Publication is separate from contribution.** Anyone can add rows. Releases
   are cut, dated, and versioned by the editor.

---

## Known gaps in the seed data

The seed is a spine, not a finished dataset.

**Highest priority**
- The ISA contractor list was assembled from a secondary compilation that appears
  to date from around 2020. **Every contractor row needs checking against the ISA's
  own contractors page.** Contracts issued since then are missing.
- Contract extensions are recorded loosely — several show a 2021 end date with
  `status: extended` and no new end date.
- The US NOAA track is moving fast and the seed captures only what was visible in
  mid-2026. Application statuses will have changed.
- `aomc` is recorded without a verified full legal name, and the merger's closing
  needs confirming.

**Thin or missing**
- State positions on a moratorium: only a handful recorded, against a reported
  count of over forty. The DSCC tracker is the source and it's mostly transcription.
- MoUs: barely represented. This is where the board will be most original, because
  nobody else has compiled them, and it's the layer that will take the most manual
  work.
- Investors and financial institutions: none.
- Cook Islands licence dates and terms are approximate.
- The Interoceanmetal consortium has six sponsoring states; only one is in the
  graph, because the others have no state node yet.
- National regimes covered only sparsely: Norway, Cook Islands, PNG, Japan and
  New Zealand have entries. Namibia, Mexico, Saudi Arabia/Sudan (Atlantis II Deep),
  Portugal/Azores and India's national programme do not.
