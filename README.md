# Wordplay vocabulary cards

This is a small website made of three files:

- `index.html` gives the page its content and structure.
- `styles.css` controls its appearance on phones and computers.
- `app.js` reads your Google Sheet, creates the Day sections, and reveals definitions when a word is clicked.

## Your spreadsheet layout

The site is connected to the draft Sheet you supplied. It reads columns A–F, with no header row required:

| Column | Content |
| --- | --- |
| A | Date on its own row, such as `Sept 24, 2026` |
| B | Word on each vocabulary row |
| C | Part of speech |
| D | Definition |
| E | Synonyms and antonyms |
| F | Example sentences |

The next date in column A starts **Day 2**, and so on. Cards appear only when both the word and definition are filled. Part of speech, related words and examples appear on the reverse of the card when present.

The Sheet must allow **Anyone with the link → Viewer**. Do not include private student information. The website reads it when the page opens or refreshes. The site does not save students' progress or collect their names.

## Try it on your computer

The site tries to read your live Sheet as soon as `index.html` opens. If the browser blocks the request from a local file, put the files on GitHub Pages and try the published URL.

## Put it online with GitHub Pages

1. Create a free GitHub account if you do not already have one.
2. Create a public repository, for example `vocabulary-cards`.
3. Upload `index.html`, `styles.css`, and `app.js` to the repository root. You may also upload this README.
4. In the repository, open **Settings → Pages**. Choose **Deploy from a branch**, then select `main` and `/ (root)` and save.
5. Visit `https://YOUR-USERNAME.github.io/vocabulary-cards/` when GitHub shows the published link.
6. Open the website. It will load the supplied Sheet automatically. Click **Spreadsheet settings** to see the source link or switch to another Sheet later.

Students can open the link without a GitHub account. Changes in the Sheet appear when they refresh the page. GitHub Pages publishes the site itself; the Sheet remains your editable source for vocabulary.
