# Working with the repository: a beginner's guide

How to change the board and keep every computer in step. No experience assumed.

---

## The one idea you need

There are two places your files live:

- **GitHub** holds the official copy. The website is built from it.
- **Your computer** can hold a second copy that you work on.

Two words connect them:

- **Push** sends your changes from your computer **up** to GitHub.
- **Pull** brings changes from GitHub **down** to your computer.

Once your changes reach GitHub, the website updates by itself in a few minutes.
Nothing else is needed.

Which tool you use is up to you. This guide gives three routes. **Route A needs
nothing installed** and is the best place to start.

| Route | Best for | Install? |
|---|---|---|
| A. The GitHub website | Small edits, any device | No |
| B. GitHub Desktop (click buttons) | Regular work on a computer | Yes, free |
| C. Git commands | If you already use them | Yes, free |

---

## Part 1. Updating files

### Route A: on the GitHub website

**Change an existing file**

1. Go to <https://github.com/elementspod/deep-sea-mining-knowledge-board> and sign in as **elementspod**, the account that
   owns it.
2. Click the file, for example `data/elements.csv`.
3. Click the **pencil icon** (Edit this file), top right of the file.
4. Make your change.
5. Click **Commit changes...**, write a short note about what you did, and click
   **Commit changes**.

**Replace a file with a new version from your computer**

1. Open the folder it belongs in (for example `data`).
2. Click **Add file → Upload files**.
3. Drag in the new file. **It must have exactly the same name** as the old one. Same
   name means it replaces the old file.
4. Write a short note and click **Commit changes**.

### Route B: GitHub Desktop (no typing commands)

First time only: install **GitHub Desktop** from desktop.github.com and sign in. Then
get your copy (see Part 2, "Get a copy on a computer").

Each time you update:

1. **Pull first.** Click **Fetch origin**. If it changes to **Pull origin**, click it.
   This is the habit that prevents most problems.
2. Edit your files as normal, using any program. Save them.
3. Go back to GitHub Desktop. The **Changes** list on the left shows every file you
   altered. Check it is what you expect.
4. In the box at the bottom left, write a short note, then click
   **Commit to main**.
5. Click **Push origin** at the top.

### Route C: commands

Open a terminal **inside the project folder** (the one containing `index.html`).
In File Explorer you can click the address bar, type `cmd`, and press Enter.

```
git pull
```
Do this first, every time. Then edit your files and save them, then:
```
git status
git add .
git commit -m "Describe what you changed"
git push
```
`git status` lists what changed. It is worth reading before you continue.

### After you push

Wait a few minutes, then reload the website with **Ctrl + Shift + R** (Cmd + Shift +
R on a Mac). That forces your browser to fetch the new version rather than show an old
copy it saved.

If you want to watch it happen, open your repository's **Actions** tab. A job called
"pages build and deployment" runs after each change. A green tick means it is live.

At the bottom of the site, the footer line should say how many entities and
relationships it loaded, and whether it found any problems.

---

## Part 2. Working on another device

### Easiest: just use the browser

Sign in to GitHub on the other device and use **Route A**. There is nothing to
download, and you cannot get out of step.

### A full copy on the other device ("cloning")

Do this once per device.

**With GitHub Desktop**

1. Install it and sign in. **Check it is signed in as the right account.**
2. Choose **File → Clone repository...**.
3. Pick your repository from the list, choose where on the computer to keep it, and
   click **Clone**.
4. To open the folder, choose **Repository → Show in Explorer**.

**With commands**

1. Install **Git for Windows** from git-scm.com. Accept the default options.
2. Open a terminal in the folder where you want the project to live, such as your
   Documents folder.
3. Run this (the address is also under the green **Code** button on GitHub):
   ```
   git clone https://github.com/elementspod/deep-sea-mining-knowledge-board.git
   ```
4. Move into the new folder:
   ```
   cd deep-sea-mining-knowledge-board
   ```
5. Tell Git who you are, for this project only:
   ```
   git config user.name "Your Name"
   git config user.email "your-github-noreply-address"
   ```
   Your private noreply address is under GitHub **Settings → Emails**. Commits in a
   public repository show this address to everyone, so use the private one.

The first time you push, a browser window opens so you can sign in to GitHub.

**If you only want to look at the files once**, open the repository, click the green
**Code** button, then **Download ZIP**. This is fine for reading. Do not work in it
for long, because it has no connection back to GitHub, so your changes would have to
be uploaded by hand through Route A.

### Keeping two devices in step

The rule that saves you: **pull before you start, push when you stop.**

Say you edited on the laptop yesterday and now you are on the desktop. If you start
without pulling, the desktop does not know about yesterday's changes, and the two
copies will collide when you push. Pulling first avoids this almost every time.

Try not to edit the same file in two places at once, including on the GitHub website.

---

## Part 3. Editing the data safely

The two files you will change most are `data/elements.csv` and
`data/connections.csv`. They are plain text tables, one row per line, with the
fields separated by commas.

**Best tools:** Google Sheets (File → Download → CSV always produces commas), or a
plain text editor such as VS Code or Notepad.

**If you use Excel, check the result.** Excel in many European countries, including
Norway, saves with **semicolons** instead of commas, and can rewrite dates into your
local style. Either one breaks the page. After saving, open the file in Notepad and
check:

- Fields are separated by **commas**, not semicolons.
- Dates still look like `2026-03-09` (year, month, day), not `9.3.2026`.

If you see a message such as *"elements is missing the columns id, label, type"*,
semicolons are almost certainly the cause.

**Always:** keep the first row (the column names) exactly as it is. Never change an
`id` once it is in use. The rules for every column are in `docs/codebook.md`, and
`docs/maintaining.md` covers the Google Sheet and suggestion-form workflow.

---

## Cheat sheet

**Starting work**
```
git pull            (Desktop: Fetch origin, then Pull origin)
```

**Finishing work**
```
git add .
git commit -m "What I changed"
git push            (Desktop: Commit to main, then Push origin)
```

**Then:** wait a few minutes and reload with Ctrl + Shift + R.

---

## When something goes wrong

| What you see | What it means and what to do |
|---|---|
| `Author identity unknown` | Git does not have your name yet. Run the two `git config` lines from the cloning steps, then commit again. |
| `rejected ... fetch first`, or `failed to push` | GitHub has changes you do not. Run `git pull`, then `git push` again. |
| A strange full-screen text editor opens after `git pull` | Git wants a note for combining two sets of changes. Press **Esc**, type `:wq`, press **Enter**. |
| `Need to specify how to reconcile divergent branches` | Run `git config pull.rebase false`, then `git pull` again. |
| `CONFLICT` | You and someone else changed the same lines. **Stop.** Do not guess. Copy your changed file somewhere safe, run `git merge --abort`, run `git pull`, then redo your change in the fresh file. |
| `Permission denied` or a 403 error | You are signed in to a different GitHub account than the one that owns the repository. Sign out and sign in again with the right one. A private browser window helps if your browser remembers the wrong account. |
| `not a git repository` | The terminal is in the wrong folder. Check that `dir` lists `index.html`. |
| Your change does not show on the website | Wait a few minutes, then reload with Ctrl + Shift + R. Check the **Actions** tab for a red cross. |
| The site shows an error after your change | Read the footer message on the site first: it usually names the bad row. If you cannot see the problem, open the file on GitHub, click **History**, click your change to see exactly what it altered, and put the earlier text back. |

If you are ever unsure, **stop and ask before running a command you do not
understand.** Nothing on GitHub is lost by waiting.
