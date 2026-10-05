# Deep-Sea Mining Knowledge Board

An open, interactive map of who is who in deep-sea mining: companies, states,
regulators, legal instruments, licence areas, research bodies, and the
relationships between them. It covers both the international seabed (the ISA
regime) and national jurisdiction, including the parallel US licensing track.

Viewers can switch what the map emphasises, choose how it is laid out, filter by
kind of entity or relationship, and click any entity to trace its connections.
Anything a viewer drags is remembered in their own browser.

**Live site:** <https://elementsofpod.github.io/deep-sea-mining-knowledge-board/> (once you have
followed "Publish it" below)

**Repository:** <https://github.com/elementsofpod/deep-sea-mining-knowledge-board>

> **Status: working draft.** The data is seed data that has not been checked
> against primary sources. Every row carries a `confidence` value and a
> `last_verified` date; at the moment most are blank. Do not cite it yet.

---

## What is in this folder

```
index.html            The page. Open this (from a web address) to see the map.
assets/
  config.js           The one file you may need to edit: where the data comes from.
  data-loader.js      Reads and checks the data tables; works out the computed columns.
  boot.js             Loads the data, then starts the interface.
  app.js              The interface: the map, the controls, the saved session.
  style.css           Colours and layout.
data/
  elements.csv        One row per entity.
  connections.csv     One row per relationship.
  anchors.csv         A short list that tells the page which permitting regime
                      (ISA, US, national) each regulator or area belongs to.
docs/
  working-with-the-repository.md   Beginner's guide: updating files, and working from another device.
  codebook.md         The rules for recording data. Read before adding rows.
  maintaining.md      Day-to-day: taking suggestions, updating, making a release.
  kumu-advanced-editor.txt   Styling code for the Kumu version of the board.
```

There is nothing to install and nothing to build. It is plain HTML, CSS and
JavaScript, plus two CSV files.

---

## Publish it (about 15 minutes, no coding)

You need a free GitHub account. GitHub Pages hosts the site at no cost, **but only
from a public repository** on the free plan. The data is therefore public, which
suits an open knowledge board.

### 1. Unzip the download

You will have a folder called `dsm-knowledge-board`. Open it. You should see
`index.html`, `README.md` and the folders `assets`, `data` and `docs`.

### 2. Create the repository

1. Sign in at github.com **as `elementsofpod`** and click the **+** at the top right, then
   **New repository**.
2. Name it `deep-sea-mining-knowledge-board`. Lowercase, no spaces: the name becomes part of the
   web address, so keep it exactly like this.
3. Set it to **Public**.
4. **Leave "Add a README file" unticked.** The folder already has one.
5. Click **Create repository**.

### 3. Upload the files

1. On the empty repository page, click the link **uploading an existing file**.
2. Open the unzipped folder, select **everything inside it** (`index.html`,
   `README.md`, `assets`, `data`, `docs`) and drag the selection into the browser
   window.
   - **Drag the contents, not the outer folder.** If you drag the outer folder,
     everything lands one level too deep and the site will not appear. Afterwards,
     the first screen of your repository should list `index.html` directly.
   - Use Chrome, Edge or Firefox. Dragging folders is unreliable in some other
     browsers.
3. Wait for the upload bar to finish, then click **Commit changes**.

### 4. Switch the site on

1. In your repository, click the **Settings** tab at the top (if you cannot see it,
   open the **...** menu and choose Settings).
2. In the left sidebar, under "Code and automation", click **Pages**.
3. Under "Build and deployment", set **Source** to **Deploy from a branch**.
4. Under **Branch**, choose **main** and the folder **/ (root)**, then click **Save**.
5. Wait. It can take up to ten minutes the first time. Refresh the Pages settings
   page and a banner will show your address:
   `https://elementsofpod.github.io/deep-sea-mining-knowledge-board/`

### 5. Check it worked

Open the address. You should see the map, and at the bottom of the screen:

> Data: repository copy · 126 entities · 163 relationships

If something is wrong, see **Troubleshooting** below.

### The same thing from a command line

If you are comfortable with git, from inside the folder:

```bash
git init
git add .
git commit -m "First version"
git branch -M main
git remote add origin https://github.com/elementsofpod/deep-sea-mining-knowledge-board.git
git push -u origin main
```

Then do step 4 above.

If git says `remote origin already exists`, the folder already points somewhere. Change it
instead of adding it again:

```bash
git remote set-url origin https://github.com/elementsofpod/deep-sea-mining-knowledge-board.git
git remote -v
```

---

## Try it on your own computer first (optional)

Browsers will not let a page opened by double-clicking read its own data files,
so `index.html` shows an explanatory message that way. To preview locally, run a
small server from inside the folder:

```bash
python3 -m http.server 8000
```

then open <http://localhost:8000>.

---

## Updating the data

Two routes. They can be combined.

**Edit the files here.** Open `data/elements.csv` or `data/connections.csv` on
GitHub, click the pencil icon, change a row, click **Commit changes**. The site
updates within a few minutes. This is fine for a small correction. For anything
bigger, a spreadsheet is much easier than GitHub's text editor.

**Use a Google Sheet as the live source.** Keep the data in a sheet, publish its
tabs as CSV, and paste the links into `assets/config.js`. Changes then appear on
the site without touching GitHub at all. The files in `data/` stay as the backup
copy and the citable snapshot. Step-by-step instructions, and how to run a
suggestion form, are in [`docs/maintaining.md`](docs/maintaining.md).

New to GitHub? [`docs/working-with-the-repository.md`](docs/working-with-the-repository.md) walks through updating files and working from another device, step by step.

Either way, **never change an entity's `id`** once it is in use. Relationships
point at ids, and so do the positions viewers have saved in their browsers.

---

## What viewers can and cannot do

- Change the emphasis, the arrangement, the filters and the evidence threshold.
- Click an entity to light up its connections, one or two steps out.
- Drag entities. Their positions and their settings are saved **in that viewer's
  own browser, on that device**. They are not shared, and they are not written
  back to the data.
- Reset everything with the buttons under "Your session".

Because saved positions belong to a web address, **changing the address later
(a new repository name, a different account, a custom domain) resets everyone's saved
layouts.** The address is `https://elementsofpod.github.io/deep-sea-mining-knowledge-board/`; settle it before you share the link widely.

If a layout turns out to be worth keeping for everyone, it needs to become data
rather than something one person did once. That is a change to the project, not a
setting; ask.

---

## Troubleshooting

| What you see | Likely cause and fix |
|---|---|
| A 404 page at your address | Pages is not switched on yet, or `index.html` is one folder too deep. Check Settings → Pages, and check the first screen of the repository lists `index.html`. |
| A blank page | Wait ten minutes after the first publish, then hard-refresh (Ctrl/Cmd + Shift + R). |
| "The map could not load" | Read the message: it says what is wrong. The usual causes are a damaged CSV or a wrong link in `config.js`. |
| "This page was opened as a local file" | You double-clicked `index.html`. Use the web address, or the local server above. |
| A footer note such as "3 data problems" | Click it. Each line names a row that was skipped and why. The rest of the map still works. |
| An entity is missing | Its `type` is not one the page knows, its `id` is a duplicate, or it has no relationships (isolated entities are hidden). The footer note names the first two. |
| "The live sheet could not be read" | The sheet link in `config.js` is wrong or unpublished. The page falls back to the files in `data/`, so the map still works. |
| Changes do not appear | GitHub can take a few minutes, and browsers cache. Hard-refresh. |

---

## Licence

No licence has been chosen yet, and **without one, nobody else is allowed to reuse
the code or the data**, which defeats the purpose of an open board. Decide with
whoever owns the project. The usual pairing for this kind of work is an open
licence for the dataset (for example Creative Commons Attribution 4.0) and a
permissive one for the code (for example MIT).

To add it: on the repository page click **Add file → Create new file**, name it
`LICENSE`, and GitHub will offer a **Choose a license template** button.

---

## Related files

The ethical-landscape map (values, outcomes and framings) is a separate project
with its own data and codebook, and is not part of this folder.
