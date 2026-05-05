/* ============================================
   Liberdus Journal — Blog logic
   --------------------------------------------
   - Loads meta.yaml, renders list of articles
   - Opens article in modal when card clicked
   - Supports direct URL: /blog/?3 → opens article #3
   - Renders article.md (markdown) using marked.js
   - Updates URL state via history.pushState
   ============================================ */

(function () {
  'use strict';

  // -----------------------------
  // Config
  // -----------------------------
  const META_URL = './meta.yaml';

  // -----------------------------
  // DOM
  // -----------------------------
  const postsList = document.getElementById('postsList');
  const modal = document.getElementById('articleModal');
  const modalArticle = document.getElementById('modalArticle');
  const modalClose = document.getElementById('modalClose');
  const modalScroll = document.getElementById('modalScroll');
  const modalProgress = document.getElementById('modalProgress');
  const todayDateEl = document.getElementById('todayDate');

  // -----------------------------
  // State
  // -----------------------------
  let articlesById = {};

  // -----------------------------
  // Utilities
  // -----------------------------
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  function formatDate(iso) {
    // "2026-04-14" → "APR 14"
    const d = new Date(iso + 'T00:00:00');
    if (isNaN(d.getTime())) return iso;
    return `${months[d.getMonth()].toUpperCase()} ${d.getDate()}`;
  }

  function formatLongDate(iso) {
    // "2026-04-14" → "April 14, 2026"
    const d = new Date(iso + 'T00:00:00');
    if (isNaN(d.getTime())) return iso;
    const longMonths = ['January','February','March','April','May','June',
                        'July','August','September','October','November','December'];
    return `${longMonths[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  }

  function setMastheadDate() {
    if (!todayDateEl) return;
    const now = new Date();
    const roman = (n) => {
      const map = [['M',1000],['CM',900],['D',500],['CD',400],['C',100],['XC',90],
                   ['L',50],['XL',40],['X',10],['IX',9],['V',5],['IV',4],['I',1]];
      let r = '';
      map.forEach(([s, v]) => { while (n >= v) { r += s; n -= v; } });
      return r;
    };
    todayDateEl.textContent =
      `${months[now.getMonth()]} ${now.getDate()} · ${roman(now.getFullYear())}`;
  }

  function readMin(text) {
    const words = text.trim().split(/\s+/).length;
    return Math.max(1, Math.round(words / 220));
  }

  // Parse the ?N query — supports "?3" (no key) and "?id=3"
  function getArticleIdFromURL() {
    const search = window.location.search;
    if (!search || search === '?') return null;

    // Try ?id=3 form
    const params = new URLSearchParams(search);
    if (params.has('id')) {
      const v = parseInt(params.get('id'), 10);
      return isNaN(v) ? null : v;
    }

    // Try bare ?3 form
    const bare = search.slice(1).split('&')[0];
    const v = parseInt(bare, 10);
    return isNaN(v) ? null : v;
  }

  // -----------------------------
  // Load meta.yaml
  // -----------------------------
  async function loadMeta() {
    try {
      const res = await fetch(META_URL);
      if (!res.ok) throw new Error(`Failed to load meta.yaml (${res.status})`);
      const text = await res.text();
      const data = jsyaml.load(text);
      if (!data || !Array.isArray(data.articles)) {
        throw new Error('meta.yaml is malformed — expected an "articles" list.');
      }
      return data.articles;
    } catch (err) {
      console.error('[blog] meta.yaml load error:', err);
      postsList.innerHTML =
        `<div class="error-msg">Couldn't load the journal index. Please try again later.</div>`;
      return [];
    }
  }

  // -----------------------------
  // Render article list
  // -----------------------------
  function renderList(articles) {
    if (!articles.length) {
      postsList.innerHTML =
        `<div class="error-msg">No entries yet. Check back soon.</div>`;
      return;
    }

    // Sort newest-first by date
    const sorted = [...articles].sort((a, b) => (a.date < b.date ? 1 : -1));

    postsList.innerHTML = sorted.map((a) => {
      articlesById[a.id] = a;
      const author = (a.author || 'Liberdus Staff').toUpperCase();
      const date = formatDate(a.date);
      return `
        <article class="article-card fade-in" data-id="${a.id}" tabindex="0" role="button" aria-label="Open article: ${escapeAttr(a.title)}">
          <div class="article-card-body">
            <h2 class="article-card-title">${escapeHtml(a.title)}</h2>
            <p class="article-card-intro">${escapeHtml(a.intro)}</p>
            <div class="article-card-meta">
              <span>${date}</span>
              <span class="article-card-meta-dot"></span>
              <span class="author">${escapeHtml(author)}</span>
            </div>
          </div>
          <div class="article-card-thumb">
            <img src="./${a.id}/thumb.png" alt="" loading="lazy"
                 onerror="this.style.display='none'; this.parentElement.style.background='var(--paper-warm)';">
          </div>
        </article>
      `;
    }).join('');

    // Wire up clicks
    postsList.querySelectorAll('.article-card').forEach((card) => {
      const id = parseInt(card.dataset.id, 10);
      card.addEventListener('click', () => openArticle(id));
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openArticle(id);
        }
      });
    });
  }

  // -----------------------------
  // Render & open article in modal
  // -----------------------------
  async function openArticle(id, { fromURL = false } = {}) {
    const meta = articlesById[id];
    if (!meta) {
      console.warn(`[blog] No article with id=${id}`);
      return;
    }

    // Reset modal content + scroll
    modalArticle.innerHTML = `<div class="loading">Loading entry…</div>`;
    modalScroll.scrollTop = 0;
    modalProgress.style.width = '0%';

    // Open modal immediately (for snappy feel)
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');

    // Update URL (unless we got here FROM the URL)
    if (!fromURL) {
      const newURL = `${window.location.pathname}?${id}`;
      history.pushState({ articleId: id }, '', newURL);
    }

    // Fetch markdown
    let mdText;
    try {
      const res = await fetch(`./${id}/article.md`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      mdText = await res.text();
    } catch (err) {
      console.error('[blog] article.md load error:', err);
      modalArticle.innerHTML = `
        <div class="article-header">
          <h1 class="article-title">Couldn't load this entry.</h1>
          <p class="article-dek">Try again, or return to the journal index.</p>
        </div>
      `;
      return;
    }

    // Configure marked: rewrite relative image paths to live in the article folder
    const renderer = new marked.Renderer();
    const baseImageRenderer = renderer.image.bind(renderer);
    renderer.image = function (href, title, text) {
      // marked v12 may pass an object-style first arg; normalize.
      let h, t, x;
      if (typeof href === 'object' && href !== null) {
        h = href.href; t = href.title; x = href.text;
      } else {
        h = href; t = title; x = text;
      }
      // Rewrite relative paths to ./{id}/...
      if (h && !/^(https?:|data:|\/)/.test(h)) {
        h = `./${id}/${h.replace(/^\.\//, '')}`;
      }
      const titleAttr = t ? ` title="${escapeAttr(t)}"` : '';
      const altAttr = ` alt="${escapeAttr(x || '')}"`;
      return `<img src="${escapeAttr(h)}"${altAttr}${titleAttr} loading="lazy">`;
    };

    marked.setOptions({ renderer, gfm: true, breaks: false });
    const bodyHTML = marked.parse(mdText);

    // Compose final article HTML
    const tagsHTML = (meta.tags || []).map(
      (t) => `<a href="#" class="article-tag" onclick="event.preventDefault()">${escapeHtml(t)}</a>`
    ).join('');

    const minutes = readMin(mdText);

    modalArticle.innerHTML = `
      <header class="article-header">
        <span class="article-cat">No. ${meta.id} · ${escapeHtml((meta.tags && meta.tags[0]) || 'journal').toUpperCase()}</span>
        <h1 class="article-title">${escapeHtml(meta.title)}</h1>
        <p class="article-dek">${escapeHtml(meta.intro)}</p>
        <div class="article-byline">
          <span>By <strong>${escapeHtml(meta.author || 'Liberdus Staff')}</strong></span>
          <span>${escapeHtml(formatLongDate(meta.date))}</span>
          <span>${minutes} minute read</span>
        </div>
      </header>
      <div class="article-body">${bodyHTML}</div>
      ${tagsHTML ? `<div class="article-tags">${tagsHTML}</div>` : ''}
    `;

    // Reset scroll for the modal
    modalScroll.scrollTop = 0;
    updateModalProgress();
  }

  function closeArticle() {
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');

    // Drop the ?N from the URL
    if (window.location.search) {
      history.pushState({}, '', window.location.pathname);
    }
  }

  // -----------------------------
  // Reading progress (modal scroll)
  // -----------------------------
  function updateModalProgress() {
    if (!modalScroll || !modalProgress) return;
    const max = modalScroll.scrollHeight - modalScroll.clientHeight;
    if (max <= 0) { modalProgress.style.width = '0%'; return; }
    const pct = Math.min(100, Math.max(0, (modalScroll.scrollTop / max) * 100));
    modalProgress.style.width = pct + '%';
  }

  // -----------------------------
  // Escapers
  // -----------------------------
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function escapeAttr(s) { return escapeHtml(s); }

  // -----------------------------
  // Wire up modal close events
  // -----------------------------
  modalClose.addEventListener('click', closeArticle);
  modal.querySelectorAll('[data-close]').forEach((el) => {
    el.addEventListener('click', closeArticle);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.getAttribute('aria-hidden') === 'false') {
      closeArticle();
    }
  });
  modalScroll.addEventListener('scroll', updateModalProgress, { passive: true });

  // Browser back/forward
  window.addEventListener('popstate', () => {
    const id = getArticleIdFromURL();
    if (id != null && articlesById[id]) {
      openArticle(id, { fromURL: true });
    } else {
      // No id in URL — close modal if open
      if (modal.getAttribute('aria-hidden') === 'false') {
        modal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('modal-open');
      }
    }
  });

  // -----------------------------
  // Boot
  // -----------------------------
  setMastheadDate();

  loadMeta().then((articles) => {
    renderList(articles);

    // Auto-open if URL has ?N
    const urlId = getArticleIdFromURL();
    if (urlId != null && articlesById[urlId]) {
      openArticle(urlId, { fromURL: true });
    }
  });

})();
