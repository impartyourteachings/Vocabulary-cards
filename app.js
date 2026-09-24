// Wordplay reads the teacher's Google Sheet each time the page opens.
(() => {
  'use strict';

  const DEFAULT_SHEETS = [
    'https://docs.google.com/spreadsheets/d/1lraybmNTALa5bAU_DlIWs1rFXIhfigHUyYDz7RR9ulY/edit?usp=sharing'
  ];
  const $ = id => document.getElementById(id);
  const dialog = $('setup-dialog');
  const suppliedLinks = new URLSearchParams(location.search).getAll('sheet');
  let sheetLinks = suppliedLinks.length ? suppliedLinks : DEFAULT_SHEETS;
  let words = [];
  let currentDay = '';
  const clean = value => String(value ?? '').trim();

  function sheetDetails(raw) {
    let url;
    try { url = new URL(raw); } catch { throw new Error('Paste a full Google Sheets link beginning with https://.'); }
    if (url.protocol !== 'https:' || url.hostname !== 'docs.google.com') {
      throw new Error('Please use a link from Google Sheets.');
    }
    const match = url.pathname.match(/^\/spreadsheets\/d\/([a-zA-Z0-9_-]+)(?:\/|$)/);
    if (!match) throw new Error('Use the regular Google Sheets link from your browser address bar.');
    const gid = url.searchParams.get('gid') || new URLSearchParams(url.hash.slice(1)).get('gid') || '0';
    if (!/^\d+$/.test(gid)) throw new Error('The spreadsheet tab link is not valid.');
    return { id: match[1], gid };
  }

  function cellText(cell) {
    if (cell?.f != null) return clean(cell.f);
    const value = cell?.v;
    if (typeof value === 'string') {
      const date = value.match(/^Date\((\d{4}),(\d{1,2}),(\d{1,2})\)$/);
      if (date) return new Date(Number(date[1]), Number(date[2]), Number(date[3]))
        .toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    }
    return clean(value);
  }

  // This query returns all rows, including the date rows, without guessing headers.
  function readSheet(raw) {
    const { id, gid } = sheetDetails(raw);
    return new Promise((resolve, reject) => {
      const callback = '__wordplay_' + Math.random().toString(36).slice(2);
      const script = document.createElement('script');
      let finished = false;
      const timer = setTimeout(() => finish(new Error('The Sheet took too long to respond. Check its sharing settings.')), 12000);
      function finish(error, result) {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        script.remove();
        delete window[callback];
        error ? reject(error) : resolve(result);
      }
      window[callback] = response => {
        if (response.status !== 'ok' || !response.table) {
          return finish(new Error('Could not read the Sheet. Allow anyone with the link to view it.'));
        }
        finish(null, response.table.rows.map(row => row.c.map(cellText)));
      };
      script.onerror = () => finish(new Error('Could not load Google Sheets. Check its link and sharing setting.'));
      const url = new URL(`https://docs.google.com/spreadsheets/d/${id}/gviz/tq`);
      url.searchParams.set('gid', gid);
      url.searchParams.set('headers', '0');
      url.searchParams.set('range', 'A1:F');
      url.searchParams.set('tqx', `out:json;responseHandler:${callback}`);
      script.src = url.href;
      document.head.append(script);
    });
  }

  // The teacher's layout: A date row, then B word, C grammar, D meaning,
  // E related words, F examples. A new date row starts another Day section.
  function rowsToWords(sheets) {
    const entries = [];
    let dayNumber = 0;
    for (const rows of sheets) {
      let day = '';
      let date = '';
      for (const row of rows) {
        const [dateCell, word, partOfSpeech, definition, related, example] =
          Array.from({ length: 6 }, (_, index) => clean(row[index]));
        if (dateCell.toLowerCase() === 'date' && word.toLowerCase() === 'word') continue;
        if (dateCell && dateCell !== date) {
          date = dateCell;
          day = `Day ${++dayNumber}`;
        }
        if (!word || !definition) continue; // Incomplete entries appear when filled in.
        if (!day) day = `Day ${++dayNumber}`;
        entries.push({ day, date, word, partOfSpeech, definition, related, example });
      }
    }
    return entries;
  }

  // Join visual line wraps, then mark each example sentence separately.
  // Existing stars are accepted, but the Sheet no longer needs to contain them.
  function splitExamples(value) {
    const pieces = [];
    let current = '';
    const finish = () => {
      if (current) pieces.push({ type: 'sentence', text: current });
      current = '';
    };
    for (const line of value.split(/\r?\n/).map(clean)) {
      if (!line) {
        finish();
      } else if (/^\(\d+\)$/.test(line)) {
        finish();
        pieces.push({ type: 'sense', text: line });
      } else if (line.startsWith('★')) {
        finish();
        current = clean(line.replace(/^★\s*/, ''));
      } else {
        if (/[.!?][”"')\]]*$/.test(current)) finish();
        current += (current ? ' ' : '') + line;
      }
    }
    finish();
    return pieces;
  }

  function addExamples(card, value) {
    if (!value) return;
    const examples = document.createElement('span');
    examples.className = 'card-examples';
    for (const piece of splitExamples(value)) {
      const line = document.createElement('span');
      line.className = piece.type === 'sense' ? 'example-sense' : 'example-sentence';
      line.textContent = piece.text;
      examples.append(line);
    }
    card.append(examples);
  }

  function addRelated(card, value) {
    if (!value) return;
    const sections = [];
    for (const line of value.split(/\r?\n/).map(clean).filter(Boolean)) {
      if (/^(?:syn(?:onyms?)?|ant(?:onyms?)?)\s*:?[.]?$/i.test(line)) {
        sections.push({ heading: line, words: [] });
      } else {
        if (!sections.length) sections.push({ heading: '', words: [] });
        sections[sections.length - 1].words.push(
          ...line.split(/[,;|]/).map(clean).filter(Boolean)
        );
      }
    }
    if (!sections.length) return;
    const related = document.createElement('span');
    related.className = 'card-related';
    for (const section of sections) {
      const block = document.createElement('span');
      block.className = 'related-section';
      if (section.heading) {
        const heading = document.createElement('span');
        heading.className = 'related-heading';
        heading.textContent = section.heading;
        block.append(heading);
      }
      if (section.words.length) {
        const words = document.createElement('span');
        words.className = 'related-words';
        words.textContent = section.words.join(' · ');
        block.append(words);
      }
      related.append(block);
    }
    card.append(related);
  }

  function addBackLine(card, className, value) {
    if (!value) return;
    const element = document.createElement('span');
    element.className = className;
    element.textContent = value;
    card.append(element);
  }

  function showDay(day) {
    currentDay = day;
    $('current-day').textContent = day;
    const todaysWords = words.filter(entry => entry.day === day);
    $('day-date').textContent = todaysWords[0]?.date || '';
    $('word-count').textContent = `${todaysWords.length} word${todaysWords.length === 1 ? '' : 's'}`;
    $('day-tabs').querySelectorAll('button').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.day === day));
    });
    const cards = todaysWords.map(entry => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'word-card';
      card.setAttribute('aria-expanded', 'false');
      card.setAttribute('aria-label', `Reveal the definition of ${entry.word}`);
      const front = document.createElement('span');
      front.className = 'card-word';
      front.textContent = entry.word;
      card.append(front);
      card.addEventListener('click', () => {
        const open = card.getAttribute('aria-expanded') === 'true';
        card.setAttribute('aria-expanded', String(!open));
        card.setAttribute('aria-label', open ? `Reveal the definition of ${entry.word}` : `Hide the definition of ${entry.word}`);
        card.replaceChildren();
        if (open) {
          card.append(front);
        } else {
          addBackLine(card, 'card-pos', entry.partOfSpeech);
          addBackLine(card, 'card-definition', entry.definition);
          addRelated(card, entry.related);
          addExamples(card, entry.example);
        }
      });
      return card;
    });
    $('cards-grid').replaceChildren(...cards);
  }

  function displayWords(entries) {
    if (!entries.length) throw new Error('No complete words were found. Fill in columns B (word) and D (definition).');
    words = entries;
    const days = [...new Set(words.map(entry => entry.day))];
    const tabs = days.map(day => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'day-tab';
      button.dataset.day = day;
      button.textContent = day;
      button.addEventListener('click', () => showDay(day));
      return button;
    });
    $('day-tabs').replaceChildren(...tabs);
    $('source-note').textContent = 'From your teacher’s spreadsheet';
    $('footer-source').textContent = 'Live spreadsheet';
    showDay(days[0]);
  }

  async function useSheets(links) {
    if (!links.length || links.length > 30) throw new Error('Paste between 1 and 30 Google Sheets links.');
    links.forEach(sheetDetails);
    const sheets = await Promise.all(links.map(readSheet));
    const entries = rowsToWords(sheets);
    displayWords(entries);
    sheetLinks = links;
    const studentUrl = new URL(location.href);
    studentUrl.search = '';
    if (links.join('\n') !== DEFAULT_SHEETS.join('\n')) {
      links.forEach(link => studentUrl.searchParams.append('sheet', link));
    }
    history.replaceState(null, '', studentUrl);
    $('share-url').value = studentUrl.href;
    $('share-box').hidden = false;
    $('form-status').style.color = '#146640';
    $('form-status').textContent = `${entries.length} cards loaded across ${new Set(entries.map(entry => entry.day)).size} days.`;
  }

  $('open-setup').addEventListener('click', () => dialog.showModal());
  $('close-setup').addEventListener('click', () => dialog.close());
  $('sheet-form').addEventListener('submit', async event => {
    event.preventDefault();
    const links = $('sheet-url').value.split(/\r?\n/).map(clean).filter(Boolean);
    const button = $('load-button');
    button.disabled = true;
    button.textContent = 'Loading…';
    $('form-status').textContent = '';
    $('share-box').hidden = true;
    try { await useSheets(links); }
    catch (error) {
      $('form-status').style.color = '#9b3935';
      $('form-status').textContent = error.message;
    } finally {
      button.disabled = false;
      button.textContent = 'Load words';
    }
  });
  $('copy-link').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText($('share-url').value);
      $('copy-link').textContent = 'Copied!';
    } catch {
      $('share-url').select();
      $('copy-link').textContent = 'Select link';
    }
  });

  $('sheet-url').value = sheetLinks.join('\n');
  $('cards-grid').innerHTML = '<div class="empty-state">Loading your word cards…</div>';
  useSheets(sheetLinks).catch(error => {
    $('source-note').textContent = 'Sheet unavailable';
    const message = document.createElement('div');
    message.className = 'empty-state';
    const heading = document.createElement('h3');
    heading.textContent = 'Could not open the word list';
    const detail = document.createElement('p');
    detail.textContent = error.message;
    const fix = document.createElement('button');
    fix.className = 'primary-button';
    fix.textContent = 'Check the Sheet link';
    fix.addEventListener('click', () => dialog.showModal());
    message.append(heading, detail, fix);
    $('cards-grid').replaceChildren(message);
  });
})();
