# Maintaining the board

For whoever looks after the data day to day. You do not need to write code for
anything in sections 1 to 6. Section 7 lists the few changes that do.

## The setup in one picture

```
 suggestion form  ->  Pending tab  ->  you review  ->  Elements / Connections tabs
                                                              |
                                              "Publish to the web" as CSV
                                                              |
                                                  the page reads it live
                                                              |
              data/ folder on GitHub  <-- a snapshot you save now and then
              (also the automatic fallback if the sheet is ever unreachable)
```

The sheet is where the data lives and changes. The `data/` folder is the dated,
citable copy. The page works from either one.

---

## 1. Set up the Google Sheet (once)

1. Create a Google Sheet. Make three tabs named `Elements`, `Connections` and
   `Anchors`.
2. For each tab: **File → Import → Upload**, choose the matching file from `data/`,
   and pick **Replace current sheet**. Do not change the header row; the page
   finds columns by name.
3. Add drop-downs so nobody has to remember the vocabulary: select a column, then
   **Data → Data validation → Drop-down**, and paste the allowed values from
   [`codebook.md`](codebook.md) for `type`, `status` and `confidence`.
4. Make a fourth tab called `Pending` for incoming suggestions.

If the sheet is also used by a Kumu map, leave its extra columns and its caption
rows (`heading`, `track-label`) alone. The page ignores the extra columns,
recomputes the computed ones itself, and skips the caption rows.

## 2. Publish the tabs so the page can read them

1. In the sheet: **File → Share → Publish to the web**.
2. In the first drop-down choose the tab, **not** "Entire document". Choose
   **Comma-separated values (.csv)**. Click **Publish**, and copy the link.
3. Repeat for `Connections`. `Anchors` is optional; if you skip it the page uses
   `data/anchors.csv`.
4. **Test each link** in a private browser window. You should get a file download
   or plain comma-separated text. If you get a Google sign-in page, it is not
   published.
5. Open `assets/config.js` on GitHub (pencil icon) and paste the links:

   ```js
   sheetUrls: {
     elements:    "https://docs.google.com/spreadsheets/d/e/....../pub?gid=0&single=true&output=csv",
     connections: "https://docs.google.com/spreadsheets/d/e/....../pub?gid=123&single=true&output=csv",
     anchors:     ""
   },
   ```

   Click **Commit changes**. After a few minutes the footer of the site should read
   **Data: live sheet**.

Things to know:

- It must be the **"Publish to the web" link**. The ordinary download link is
  blocked by browsers and will fail.
- The link is public. Anyone with it can read the published tab.
- The published copy can lag the sheet by a few minutes.
- Fill in **both** `elements` and `connections`, or neither. With only one, the
  page ignores the sheet and uses `data/`.
- If the sheet cannot be reached, the page falls back to `data/` and says so in
  the footer. The map never goes blank because of a sheet problem.

## 3. Taking suggestions

Make a Google Form whose responses go to the `Pending` tab. Useful fields:

- Is this a new entity, a new relationship, or a correction?
- The ids or names involved, and the type (drop-downs from the codebook).
- **A source link (required).** It filters out most drive-by additions on its own.
- How sure they are: confirmed, reported or inferred.
- Their name, so they can be credited.

You are the only one who moves rows from `Pending` into `Elements` or
`Connections`. Publication is separate from contribution: anyone can suggest,
one person decides.

Before moving a row across:

- [ ] It has a `source_url` that actually supports it.
- [ ] `id` is a lowercase slug with no spaces, and is not already in use.
- [ ] `type` is from the list in the codebook.
- [ ] For a relationship, both `from` and `to` are existing ids.
- [ ] `confidence` is honest. `inferred` rows say in the label what they were
      inferred from.
- [ ] `last_verified` is today's date and `contributed_by` has the contributor.

Then reload the live site and read the footer. It should say **0 data problems**.
If it says otherwise, click it: each line names the row and what is wrong. The
page skips only the bad row and draws the rest.

## 4. Adding things: what else is needed?

| You add | You also need |
|---|---|
| A company, research body, NGO or source | At least one relationship, or it is hidden as isolated |
| A relationship | Both ends already exist as entities |
| A national regulator, act or area | Usually nothing: one authorisation relationship to something already tracked gives it its regime. If it has none, add it to `Anchors` with its track (`isa`, `dshmra` or `eez`). |
| A state | Its `country`. Relationships such as `sponsors` or `member-of`. |
| A dead or lapsed relationship | Keep it. Set `end_date` and `status: ended`. History is the point. |

You never type `role_x`, `country_rank` or `track`. The page works them out.

## 5. Make a snapshot (before citing, and every so often)

The `data/` folder is what a reader can cite, so refresh it when the data has moved
enough to matter.

1. In the sheet, for each tab: **File → Download → Comma-separated values (.csv)**.
   This downloads the tab you are on.
2. Rename the files to `elements.csv`, `connections.csv` and `anchors.csv`.
3. On GitHub, open the `data` folder, click **Add file → Upload files**, drag the
   three files in, and **Commit changes**. Same names replace the old files.
4. Optional but recommended: on the repository page, **Releases → Draft a new
   release**, give it a version tag such as `v0.2`, and publish it.
5. For a citable DOI, connect the repository to Zenodo (zenodo.org, sign in with
   GitHub, switch the repository on). Each release you publish is then archived
   with its own DOI. Follow Zenodo's own guide; the steps there change more often
   than this document.

## 6. Housekeeping

- **Never change an `id`.** Change the `label` and mention the old name in the
  description. Relationships and viewers' saved positions both point at ids.
- **Reset everyone's saved layouts.** Everyone's dragged positions live in their own
  browser. After a big restructure you may want them cleared. In `assets/config.js`
  change `storageKey` from `"dsm-board-session-v1"` to `"dsm-board-session-v2"`.
  This cannot be undone and cannot be targeted at one person.
- **Changing the web address resets saved layouts too**, because browsers tie saved
  data to the address.
- **Re-check old rows.** Anything with a `last_verified` older than six months is
  stale. The US licensing applications move fastest and want a standing check.

---

## 7. Changes that do need code

These are small, but they are edits to the files in `assets/`.

**A new kind of relationship.** Add it to the list called `FAMILIES` near the top
of `assets/app.js`, under the family it belongs to, with a name and a line pattern
(`solid`, `dashed`, `dotted` or `long`). Until you do, rows of that type are hidden
and the footer says so. Also record it in `codebook.md`.

**A new kind of entity.** Four places: the list called `NODE_TYPES` in
`assets/app.js` (name and shape), the table called `ROLE_X` in
`assets/data-loader.js` (which column it sits in), a colour in `assets/style.css`
(each `--t-...` colour appears three times, once for the light theme and twice for
dark; copy a line in all three places), and `codebook.md`.

**A new saved emphasis.** Add an entry to the list called `EMPHASIS` in
`assets/app.js`. Give it the entity types and relationship types it should show.
Add `band: "track"` to get the three permitting-track rows.

**Colours.** All of them are `--t-...` (entities) and `--f-...` (relationship
families) near the top of `assets/style.css`.

Edit on GitHub with the pencil icon, commit, wait a few minutes, hard-refresh. If
the page breaks afterwards, open GitHub's **History** for the file and revert.

---

## Why the page is built this way

A published page cannot be edited by its visitors, and each visitor's drags are
saved only on their own device. That is deliberate. A shared, silently autosaved
layout would change under a board meant to be cited. So the data is shared and
versioned (the sheet and `data/`), and arrangement is personal. If an arrangement
is worth keeping for everyone, it should become data: coordinates in the table, and
a decision someone made on purpose.
