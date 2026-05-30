/* ==========================================================================
   gitcoin brain — main.js
   vanilla, vault-aware, hash-routed
   ========================================================================== */

(() => {
  'use strict';

  // ---- Config

  const DEFAULT_VAULT_NAME = 'gitcoin';
  const STORAGE_PREFIX = 'gb:v1:';

  // tag display names + sidebar order. These are the type-tags worth browsing
  // as collections — not the owner tags (kevin/operations/...), which are
  // layers, not collections.
  const TAG_DISPLAY = {
    anchor:         { label: 'Strategy & Anchors', desc: 'where Kevin\'s head is' },
    report:         { label: 'Daily Reports',      desc: 'nightly synthesis' },
    trending:       { label: 'Trending',           desc: 'movement + news scan' },
    'field-intel':  { label: 'Field Intel',        desc: 'AI-jobs deep trends' },
    person:         { label: 'People',             desc: 'stakeholder index' },
    draft:          { label: 'Drafts',             desc: 'in-flight writing' },
    writing:        { label: 'Writing',            desc: 'Kevin long-form' },
    weekly:         { label: 'Weekly Rollups',     desc: '' },
    'grant-report': { label: 'Grants',             desc: 'funding intel' },
    kpi:            { label: 'KPI Trendlines',     desc: '' },
  };
  const TAG_ORDER = ['anchor', 'report', 'trending', 'field-intel', 'person', 'draft', 'writing', 'weekly', 'grant-report', 'kpi'];

  // ---- State

  const state = {
    url: localStorage.getItem(STORAGE_PREFIX + 'url') || 'http://127.0.0.1:1940',
    // Vault name is configurable — different deployments mount different vaults
    // (e.g. /vault/gitcoin locally, /vault/default on a fresh hosted instance).
    vaultName: localStorage.getItem(STORAGE_PREFIX + 'vault') || DEFAULT_VAULT_NAME,
    token: localStorage.getItem(STORAGE_PREFIX + 'token') || '',
    vaultInfo: null,
    tagCounts: {},
    connected: false,
    error: null,
  };

  // ---- Utilities

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  const h = (tag, attrs = {}, ...children) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (v !== null && v !== undefined && v !== false) el.setAttribute(k, v);
    }
    for (const c of children.flat()) {
      if (c === null || c === undefined || c === false) continue;
      if (typeof c === 'string') el.appendChild(document.createTextNode(c));
      else el.appendChild(c);
    }
    return el;
  };

  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));

  const formatDate = (iso) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch { return iso; }
  };

  // ---- API

  const api = async (path, opts = {}) => {
    if (!state.token) throw new Error('no token');
    const url = `${state.url}/vault/${state.vaultName}/api${path}`;
    const r = await fetch(url, {
      ...opts,
      headers: {
        'Authorization': `Bearer ${state.token}`,
        'Accept': 'application/json',
        ...(opts.headers || {}),
      },
    });
    if (r.status === 401 || r.status === 403) {
      throw new Error(`auth-${r.status}`);
    }
    if (!r.ok) {
      throw new Error(`http-${r.status}`);
    }
    return r.json();
  };

  const fetchVaultInfo = async () => {
    const url = `${state.url}/vault/${state.vaultName}`;
    const r = await fetch(url, {
      headers: { 'Authorization': `Bearer ${state.token}` },
    });
    if (r.status === 401 || r.status === 403) throw new Error(`auth-${r.status}`);
    if (!r.ok) throw new Error(`http-${r.status}`);
    return r.json();
  };

  const fetchNotes = (params) => {
    const q = new URLSearchParams(params).toString();
    return api(`/notes?${q}`);
  };

  const fetchNote = (path) => {
    return api(`/notes/${encodeURIComponent(path)}`);
  };

  const fetchTags = () => api('/tags');

  // ---- Token + connection

  const openTokenModal = () => {
    $('#token-modal').classList.add('shown');
    $('#token-input').value = state.token || '';
    $('#token-url-input').value = state.url;
    const vf = $('#token-vault-input');
    if (vf) vf.value = state.vaultName;
    $('#token-cancel').style.display = state.connected ? 'inline-block' : 'none';
    // Default to the OAuth ("sign in") affordance; paste-token stays
    // available behind a toggle for cases without a hub origin.
    $('#token-paste-section').style.display = 'none';
    $('#token-submit').style.display = 'none';
    $('#oauth-submit').style.display = 'inline-block';
    setTimeout(() => $('#token-url-input').focus(), 50);
  };

  const closeTokenModal = () => {
    $('#token-modal').classList.remove('shown');
    $('#token-err').classList.remove('shown');
  };

  const setTokenIndicator = () => {
    const el = $('#token-indicator');
    const status = el.querySelector('.status-label');
    el.classList.remove('connected', 'error');
    if (state.error) {
      el.classList.add('error');
      status.textContent = 'error';
    } else if (state.connected) {
      el.classList.add('connected');
      status.textContent = state.vaultInfo?.stats?.totalNotes
        ? `connected · ${state.vaultInfo.stats.totalNotes} notes`
        : 'connected';
    } else {
      status.textContent = 'disconnected';
    }
  };

  const tryConnect = async () => {
    if (!state.token) {
      state.connected = false;
      setTokenIndicator();
      openTokenModal();
      return false;
    }
    try {
      const info = await fetchVaultInfo();
      const tags = await fetchTags();
      state.vaultInfo = info;
      state.tagCounts = Object.fromEntries(tags.map(t => [t.name, t.count]));
      state.connected = true;
      state.error = null;
      setTokenIndicator();
      renderSidebar();
      return true;
    } catch (e) {
      state.connected = false;
      state.error = e.message;
      setTokenIndicator();
      if (e.message.startsWith('auth-')) {
        openTokenModal();
        $('#token-err').classList.add('shown');
      }
      return false;
    }
  };

  // ---- Sidebar

  const renderSidebar = () => {
    const container = $('#tag-list');
    container.innerHTML = '';
    for (const tag of TAG_ORDER) {
      const count = state.tagCounts[tag] || 0;
      if (count === 0 && !TAG_DISPLAY[tag]) continue;
      const display = TAG_DISPLAY[tag] || { label: tag, desc: '' };
      const link = h('div', {
        class: 'sidebar-link',
        'data-route': `#/tag/${tag}`,
      },
        h('span', { class: 'name' }, display.label),
        h('span', { class: 'count' }, String(count))
      );
      link.addEventListener('click', () => {
        window.location.hash = `/tag/${tag}`;
      });
      container.appendChild(link);
    }
    updateActiveSidebar();
  };

  const updateActiveSidebar = () => {
    const hash = window.location.hash || '#/';
    $$('.sidebar-link').forEach(el => {
      const route = el.getAttribute('data-route');
      el.classList.toggle('active', route === hash);
    });
  };

  // ---- Markdown

  const md = (text) => {
    if (!window.marked) return escapeHtml(text);
    try {
      window.marked.setOptions({ breaks: false, gfm: true });
      return window.marked.parse(text || '');
    } catch (e) {
      return escapeHtml(text);
    }
  };

  // ---- View rendering

  const renderView = (children) => {
    const v = $('#view');
    v.innerHTML = '';
    if (Array.isArray(children)) children.forEach(c => v.appendChild(c));
    else if (children) v.appendChild(children);
  };

  const loadingView = () => h('div', { class: 'loading' }, 'loading…');

  const errorView = (err) => h('div', { class: 'err' },
    h('div', { class: 'ornament-large' }, '✦'),
    h('p', {}, 'something\'s amiss.'),
    h('div', { class: 'err-detail' }, err)
  );

  // --- HOME

  const renderHome = async () => {
    if (!state.connected) {
      renderView(h('div', { class: 'err' },
        h('div', { class: 'ornament-large' }, '✦'),
        h('p', {}, 'not connected. paste your token to begin.')
      ));
      return;
    }

    const hero = h('div', { class: 'hero' },
      h('div', { class: 'eyebrow' }, 'the gitcoin brain'),
      h('h1', {}, 'A working knowledge base.'),
      h('p', { class: 'lede',
        html: 'A scrubbed mirror of Kevin\'s Gitcoin context, plus team work. ' +
              'Browse the collections below, search anything, or <em>plug it into your AI</em> ' +
              'via MCP. Updated nightly.'
      })
    );

    // surface today's drafts prominently if they exist
    const todaysDraftsTeaser = h('div', { id: 'drafts-teaser', style: 'margin: 2.5rem 0;' });

    const tagGrid = h('div', { class: 'tag-grid' });
    for (const tag of TAG_ORDER) {
      const count = state.tagCounts[tag] || 0;
      if (count === 0) continue;
      const display = TAG_DISPLAY[tag] || { label: tag, desc: '' };
      const card = h('button', {
        class: 'tag-card',
        onclick: () => window.location.hash = `/tag/${tag}`,
      },
        h('div', { class: 'tag-name' }, display.label),
        h('div', { class: 'tag-count' }, String(count)),
        h('div', { class: 'tag-desc' }, display.desc || '')
      );
      tagGrid.appendChild(card);
    }

    const ornament = h('div', { class: 'ornament' }, '※');

    const recentTitle = h('div', { class: 'section-head' },
      h('h2', {}, 'Recent activity'),
      h('span', { class: 'meta' }, 'across all collections')
    );

    const recentList = h('div', { class: 'note-list' },
      h('div', { class: 'loading' }, 'loading recent…')
    );

    const mcp = renderMcpBlock(true);

    renderView([hero, todaysDraftsTeaser, tagGrid, ornament, recentTitle, recentList, mcp]);

    // load today's drafts teaser
    try {
      const draftNotes = await fetchNotes({ tag: 'daily-draft', limit: 5, sort: 'desc' });
      const drafts = draftNotes
        .filter(n => n.path && n.path.startsWith('jobs/runs/daily-tweet-drafts/'))
        .sort((a, b) => (b.path || '').localeCompare(a.path || ''));
      if (drafts[0]) {
        const target = drafts[0];
        const datePart = (target.path || '').split('/').pop();
        const teaser = h('div', {
          style: 'border-left:3px solid var(--gold); padding:1.25rem 1.5rem; background:var(--bg-soft); cursor:pointer;',
          onclick: () => window.location.hash = '/drafts',
        },
          h('div', { class: 'smcaps gold', style: 'margin-bottom:0.5rem;' },
            'today\'s drafts · ' + datePart
          ),
          h('h3', { style: 'font-family:var(--display); font-style:italic; font-size:1.4rem; color:var(--ink); margin-bottom:0.45rem;' },
            'Tweet copy per actionable item.'
          ),
          h('p', { style: 'color:var(--ink-soft); font-size:0.95rem; margin-bottom:0;' },
            target.preview ? target.preview.slice(0, 200) + (target.preview.length > 200 ? '…' : '') : 'pre-drafted tweets ready for review and editing.'
          )
        );
        $('#drafts-teaser').appendChild(teaser);
      }
    } catch (e) {
      // silent failure on teaser — non-critical
    }

    // load recent
    try {
      const notes = await fetchNotes({ limit: 12, sort: 'desc' });
      recentList.innerHTML = '';
      if (notes.length === 0) {
        recentList.appendChild(h('div', { class: 'empty' },
          h('p', {}, 'nothing yet.')
        ));
      } else {
        notes.forEach(n => recentList.appendChild(noteEntry(n)));
      }
    } catch (e) {
      recentList.innerHTML = '';
      recentList.appendChild(errorView(e.message));
    }
  };

  // --- TAG VIEW

  let tagViewState = { offset: 0, limit: 20, total: 0 };

  const renderTagView = async (tag) => {
    if (!state.connected) return renderHome();
    const display = TAG_DISPLAY[tag] || { label: tag, desc: '' };
    const total = state.tagCounts[tag] || 0;
    tagViewState = { offset: 0, limit: 20, total };

    const head = h('div', { class: 'section-head' },
      h('h2', {}, display.label),
      h('span', { class: 'meta' }, `${total} notes`)
    );

    const list = h('div', { class: 'note-list' },
      h('div', { class: 'loading' }, 'loading…')
    );

    const pagination = h('div', { class: 'pagination', id: 'pagination', style: 'display:none' });

    renderView([head, list, pagination]);

    const loadPage = async (offset) => {
      list.innerHTML = '';
      list.appendChild(h('div', { class: 'loading' }, 'loading…'));
      try {
        const notes = await fetchNotes({
          tag, limit: tagViewState.limit, offset, sort: 'desc',
        });
        list.innerHTML = '';
        if (notes.length === 0) {
          list.appendChild(h('div', { class: 'empty' },
            h('p', {}, 'no notes in this collection.')
          ));
        } else {
          notes.forEach(n => list.appendChild(noteEntry(n)));
        }
        renderPagination(pagination, offset, tagViewState.limit, total, loadPage);
      } catch (e) {
        list.innerHTML = '';
        list.appendChild(errorView(e.message));
      }
    };
    loadPage(0);
  };

  const renderPagination = (el, offset, limit, total, loadPage) => {
    el.innerHTML = '';
    if (total <= limit) {
      el.style.display = 'none';
      return;
    }
    el.style.display = 'flex';
    const start = offset + 1;
    const end = Math.min(offset + limit, total);
    const prevBtn = h('button', {
      onclick: () => loadPage(Math.max(0, offset - limit))
    }, '← previous');
    if (offset === 0) prevBtn.disabled = true;

    const nextBtn = h('button', {
      onclick: () => loadPage(offset + limit)
    }, 'next →');
    if (offset + limit >= total) nextBtn.disabled = true;

    el.appendChild(prevBtn);
    el.appendChild(h('span', {}, `${start}–${end} of ${total}`));
    el.appendChild(nextBtn);
  };

  // --- RECENT (alias for home with focus on recent)

  const renderRecent = async () => {
    if (!state.connected) return renderHome();

    const head = h('div', { class: 'section-head' },
      h('h2', {}, 'Recent activity'),
      h('span', { class: 'meta' }, 'newest across all collections')
    );

    const list = h('div', { class: 'note-list' },
      h('div', { class: 'loading' }, 'loading…')
    );

    renderView([head, list]);

    try {
      const notes = await fetchNotes({ limit: 40, sort: 'desc' });
      list.innerHTML = '';
      notes.forEach(n => list.appendChild(noteEntry(n)));
    } catch (e) {
      list.innerHTML = '';
      list.appendChild(errorView(e.message));
    }
  };

  // --- TODAY'S BRIEF

  const renderToday = async () => {
    if (!state.connected) return renderHome();

    const head = h('div', { class: 'section-head' },
      h('h2', {}, 'Today\'s brief'),
      h('span', { class: 'meta' }, 'latest daily report')
    );

    const body = h('div', {}, h('div', { class: 'loading' }, 'loading…'));

    renderView([head, body]);

    try {
      // grab the most recent daily summary
      const notes = await fetchNotes({ tag: 'daily', limit: 50, sort: 'desc' });
      // sort by date descending — prefer summary.md if present
      const todays = notes
        .filter(n => n.path && n.path.includes('/daily/'))
        .sort((a, b) => (b.path || '').localeCompare(a.path || ''));

      const summary = todays.find(n => n.path && n.path.endsWith('/summary'));
      const report = todays.find(n => n.path && n.path.endsWith('/report'));
      const target = summary || report || todays[0];

      if (!target) {
        body.innerHTML = '';
        body.appendChild(h('div', { class: 'empty' },
          h('div', { class: 'ornament-large' }, '✦'),
          h('p', {}, 'no daily reports found.')
        ));
        return;
      }
      // fetch full content
      const note = await fetchNote(target.path);
      body.innerHTML = '';
      body.appendChild(noteDetailContent(note));
    } catch (e) {
      body.innerHTML = '';
      body.appendChild(errorView(e.message));
    }
  };

  // --- TODAY'S DRAFTS (tweet drafts per "Worth acting on" item)

  const renderDrafts = async () => {
    if (!state.connected) return renderHome();

    const head = h('div', { class: 'section-head' },
      h('h2', {}, h('em', {}, 'Today\'s drafts')),
      h('span', { class: 'meta' }, 'tweet copy per actionable item')
    );

    const body = h('div', {}, h('div', { class: 'loading' }, 'loading…'));
    renderView([head, body]);

    try {
      // grab the most recent daily-tweets note
      const notes = await fetchNotes({ tag: 'daily-draft', limit: 30, sort: 'desc' });
      const drafts = notes
        .filter(n => n.path && n.path.startsWith('jobs/runs/daily-tweet-drafts/'))
        .sort((a, b) => (b.path || '').localeCompare(a.path || ''));
      const target = drafts[0];
      if (!target) {
        body.innerHTML = '';
        body.appendChild(h('div', { class: 'empty' },
          h('div', { class: 'ornament-large' }, '✦'),
          h('p', {}, 'no drafts yet.'),
          h('p', { style: 'font-size:0.92rem; font-style:normal;' },
            'The tweet-drafter derive (', h('code', {}, 'scripts/derive_daily_tweets.py'),
            ') runs against today\'s trending.md and writes drafts here when an ',
            h('code', {}, 'ANTHROPIC_API_KEY'), ' is configured.')
        ));
        return;
      }
      const note = await fetchNote(target.path);
      body.innerHTML = '';
      body.appendChild(noteDetailContent(note));
    } catch (e) {
      body.innerHTML = '';
      body.appendChild(errorView(e.message));
    }
  };

  // --- SEARCH

  const renderSearch = async (q) => {
    if (!state.connected) return renderHome();
    const head = h('div', { class: 'section-head' },
      h('h2', {}, h('em', {}, 'Search'), ' — “', q, '”'),
      h('span', { class: 'meta' }, 'full-text')
    );
    const list = h('div', { class: 'note-list' },
      h('div', { class: 'loading' }, 'searching…')
    );
    renderView([head, list]);

    try {
      const notes = await fetchNotes({ search: q, limit: 40 });
      list.innerHTML = '';
      if (notes.length === 0) {
        list.appendChild(h('div', { class: 'empty' },
          h('div', { class: 'ornament-large' }, '✦'),
          h('p', {}, 'no matches.')
        ));
      } else {
        notes.forEach(n => list.appendChild(noteEntry(n)));
      }
    } catch (e) {
      list.innerHTML = '';
      list.appendChild(errorView(e.message));
    }
  };

  // --- NOTE VIEW

  const renderNote = async (notePath) => {
    if (!state.connected) return renderHome();
    renderView([h('div', { class: 'loading' }, 'loading…')]);
    try {
      const note = await fetchNote(notePath);
      const back = h('div', {
        class: 'back',
        onclick: () => window.history.back(),
      }, 'back');
      renderView([back, noteDetailContent(note)]);
    } catch (e) {
      renderView(errorView(e.message));
    }
  };

  // --- MCP block (used inline on home, or full page on /mcp)

  const renderMcpBlock = (asInline) => {
    const url = `${state.url}/vault/${state.vaultName}`;
    const block = h('div', { class: 'mcp-block' + (asInline ? '' : ' open') });

    const head = h('div', {},
      h('h3', {}, 'Plug it into your AI'),
      h('p', { class: 'mcp-intro',
        html: 'Add the Gitcoin Brain as an MCP server to Claude Desktop / Claude Code / Cursor — ask questions of it from the AI you already use.'
      })
    );
    block.appendChild(head);

    const toggle = h('span', {
      class: 'mcp-toggle',
      onclick: () => block.classList.toggle('open'),
    }, asInline ? 'show setup' : 'hide setup');
    block.appendChild(toggle);

    const content = h('div', { class: 'mcp-content' });

    content.appendChild(h('h4', {}, 'Vault URL'));
    content.appendChild(h('pre', {}, h('code', {}, url)));

    content.appendChild(h('h4', {}, 'For Claude Code'));
    const claudeCodeCmd = `claude mcp add --transport sse parachute-vault-gitcoin ${url}/mcp --header "Authorization: Bearer YOUR_TOKEN"`;
    content.appendChild(h('pre', {}, h('code', {}, claudeCodeCmd)));

    content.appendChild(h('h4', {}, 'For Claude Desktop'));
    content.appendChild(h('p', { html: 'Settings → Developer → Edit Config → add the MCP server below to <code>mcpServers</code>:' }));
    const claudeDesktopJson = JSON.stringify({
      'parachute-vault-gitcoin': {
        'transport': { 'type': 'sse', 'url': `${url}/mcp` },
        'headers': { 'Authorization': 'Bearer YOUR_TOKEN' }
      }
    }, null, 2);
    content.appendChild(h('pre', {}, h('code', {}, claudeDesktopJson)));

    content.appendChild(h('h4', {}, 'Then try asking'));
    content.appendChild(h('div', { class: 'examples' },
      h('ul', {},
        h('li', {}, 'What does the brain know about Coefficient Giving?'),
        h('li', {}, 'Summarize the current rebuild.how strategy.'),
        h('li', {}, 'Who in our network might know Daniel Zingale?'),
        h('li', {}, 'What did yesterday\'s daily report say is worth acting on?')
      )
    ));

    content.appendChild(h('h4', {}, 'Or browse this UI'));
    content.appendChild(h('p', {
      html: 'If you\'d rather read directly: click any collection on the left, or use search above. This UI is read-only — for editing, use Parachute Notes or talk to your Claude.'
    }));

    block.appendChild(content);
    return block;
  };

  const renderMcpPage = () => {
    if (!state.connected) return renderHome();
    const head = h('div', { class: 'section-head' },
      h('h2', {}, h('em', {}, 'Plug into your AI'))
    );
    renderView([head, renderMcpBlock(false)]);
  };

  // --- Note entry (list item)

  const noteEntry = (note) => {
    const path = note.path || note.id;
    const meta = note.metadata || {};
    const titleText = extractTitle(note);
    const previewText = note.preview || extractPreview(note.content);

    const tags = (note.tags || []).map(t =>
      h('span', { class: 'tag' }, t.toUpperCase())
    );

    const metaFields = [];
    if (meta.last_contact) metaFields.push(['last contact', formatDate(meta.last_contact)]);
    if (meta.occurred_at) metaFields.push(['date', formatDate(meta.occurred_at)]);
    if (meta.committed_at) metaFields.push(['committed', formatDate(meta.committed_at)]);
    if (meta.published_at) metaFields.push(['published', formatDate(meta.published_at)]);
    if (meta.meeting_count !== undefined) metaFields.push(['meetings', meta.meeting_count]);

    const entry = h('div', {
      class: 'note-entry',
      onclick: () => {
        window.location.hash = `/note/${encodeURIComponent(path)}`;
      },
    },
      h('div', { class: 'note-meta' },
        ...tags,
        h('span', { class: 'path' }, path)
      ),
      h('div', { class: 'note-title' }, titleText || '(untitled)'),
      h('div', { class: 'note-preview' }, previewText),
      metaFields.length > 0 ? h('div', { class: 'note-bottom' },
        ...metaFields.map(([k, v]) => h('span', {},
          h('span', { class: 'field-key' }, k + ':'),
          ' ' + v
        ))
      ) : null
    );
    return entry;
  };

  // --- Note detail (used in note view + today's brief)

  const noteDetailContent = (note) => {
    const path = note.path || note.id;
    const meta = note.metadata || {};
    const tags = (note.tags || []).map(t => h('span', { class: 'crumb tag' }, t.toUpperCase()));

    return h('div', { class: 'note-view' },
      h('div', { class: 'note-view-head' },
        h('div', { class: 'crumbs' },
          ...tags,
          h('span', { class: 'crumb path' }, path)
        ),
        h('div', { class: 'note-view-meta' },
          ...renderMetaPairs(meta, note)
        )
      ),
      h('div', { class: 'note-view-body', html: md(note.content || '') })
    );
  };

  const renderMetaPairs = (meta, note) => {
    const pairs = [];
    const addPair = (key, val) => {
      pairs.push(h('div', { class: 'key' }, key));
      pairs.push(h('div', { class: 'val' }, String(val)));
    };
    if (note.createdAt) addPair('imported', formatDate(note.createdAt));
    if (meta.last_contact) addPair('last contact', formatDate(meta.last_contact));
    if (meta.occurred_at) addPair('occurred', formatDate(meta.occurred_at));
    if (meta.committed_at) addPair('committed', formatDate(meta.committed_at));
    if (meta.deadline) addPair('deadline', formatDate(meta.deadline));
    if (meta.published_at) addPair('published', formatDate(meta.published_at));
    if (meta.meeting_count !== undefined) addPair('meetings', meta.meeting_count);
    if (meta.topics) addPair('topics', meta.topics);
    if (meta.owner) addPair('owner', meta.owner);
    if (meta.status) addPair('status', meta.status);
    if (meta.kpi) addPair('kpi', meta.kpi);
    if (meta.url) {
      pairs.push(h('div', { class: 'key' }, 'url'));
      const valEl = h('div', { class: 'val' });
      valEl.appendChild(h('a', { href: meta.url, class: 'link', target: '_blank', rel: 'noopener' }, meta.url));
      pairs.push(valEl);
    }
    return pairs;
  };

  const extractTitle = (note) => {
    const meta = note.metadata || {};
    if (meta.name) return meta.name;
    if (meta.title) return meta.title;
    const content = note.content || note.preview || '';
    // First H1
    const h1 = content.match(/^#\s+(.+)/m);
    if (h1) return h1[1].trim();
    // First non-empty line
    const firstLine = content.split('\n').find(l => l.trim() && !l.startsWith('---'));
    if (firstLine) return firstLine.replace(/^[#*\s-]+/, '').trim().slice(0, 90);
    return note.path ? note.path.split('/').pop().replace(/[_-]/g, ' ') : '(untitled)';
  };

  const extractPreview = (content) => {
    if (!content) return '';
    // strip frontmatter, headings, leading bullets
    let s = content.replace(/^---[\s\S]*?---/m, '');
    s = s.replace(/^#+\s+.*/gm, '');
    s = s.replace(/^[-*+]\s+/gm, '');
    s = s.replace(/\n+/g, ' ');
    s = s.trim();
    return s.slice(0, 260);
  };

  // ---- Router

  const routes = [
    { match: /^#?\/?$/, render: renderHome },
    { match: /^#\/today\/?$/, render: renderToday },
    { match: /^#\/drafts\/?$/, render: renderDrafts },
    { match: /^#\/recent\/?$/, render: renderRecent },
    { match: /^#\/mcp\/?$/, render: renderMcpPage },
    { match: /^#\/tag\/(.+)$/, render: (m) => renderTagView(m[1]) },
    { match: /^#\/note\/(.+)$/, render: (m) => renderNote(decodeURIComponent(m[1])) },
    { match: /^#\/search\?q=(.+)$/, render: (m) => renderSearch(decodeURIComponent(m[1])) },
  ];

  const route = async () => {
    const hash = window.location.hash || '#/';
    updateActiveSidebar();
    if (!state.connected) {
      if (state.token) {
        await tryConnect();
      }
    }
    if (!state.connected) {
      renderView(h('div', { class: 'err' },
        h('div', { class: 'ornament-large' }, '✦'),
        h('p', {}, 'not connected. paste your token to begin.')
      ));
      return;
    }
    for (const r of routes) {
      const m = hash.match(r.match);
      if (m) {
        await r.render(m);
        return;
      }
    }
    renderView(h('div', { class: 'err' },
      h('div', { class: 'ornament-large' }, '✦'),
      h('p', {}, 'route not found.')
    ));
  };

  // ---- Setup

  // Parse a user-entered vault URL into { host, name }. Accepts either a full
  // `https://host/vault/<name>` URL (extracts both) or a bare host (name comes
  // from the vault-name field, else current state, else default).
  const parseHostAndVault = (raw) => {
    const m = raw.match(/^(.*?)\/vault\/([^/]+)\/?$/);
    if (m) return { host: m[1].replace(/\/$/, ''), name: m[2] };
    const field = $('#token-vault-input');
    const name = (field && field.value.trim()) || state.vaultName || DEFAULT_VAULT_NAME;
    return { host: raw.replace(/\/$/, ''), name };
  };

  const setupTokenModal = () => {
    // OAuth (default primary) — kicks the browser over to the vault's
    // consent page. Returns here with ?code=...&state=... which init() picks
    // up and completes via handleOAuthCallback.
    $('#oauth-submit').addEventListener('click', async () => {
      const raw = $('#token-url-input').value.trim().replace(/\/$/, '');
      if (!raw) {
        $('#token-err').textContent = 'Enter a vault URL first.';
        $('#token-err').classList.add('shown');
        return;
      }
      const { host, name } = parseHostAndVault(raw);
      state.url = host;
      state.vaultName = name;
      localStorage.setItem(STORAGE_PREFIX + 'url', host);
      localStorage.setItem(STORAGE_PREFIX + 'vault', name);
      // Vault OAuth discovery lives under /vault/<name>/.well-known/...
      const issuer = `${host}/vault/${name}`;
      try {
        $('#token-err').classList.remove('shown');
        $('#oauth-submit').disabled = true;
        $('#oauth-submit').textContent = 'redirecting…';
        await window.GBOAuth.beginOAuth(issuer);
        // beginOAuth navigates away; nothing more to do.
      } catch (e) {
        $('#oauth-submit').disabled = false;
        $('#oauth-submit').textContent = 'sign in';
        $('#token-err').textContent = e.message || 'Sign-in failed.';
        $('#token-err').classList.add('shown');
      }
    });

    // Paste-token fallback — reveals the token field + swaps the primary
    // button.
    $('#token-paste-toggle').addEventListener('click', (e) => {
      e.preventDefault();
      const paste = $('#token-paste-section');
      const isShown = paste.style.display !== 'none';
      if (isShown) {
        paste.style.display = 'none';
        $('#oauth-submit').style.display = 'inline-block';
        $('#token-submit').style.display = 'none';
        $('#token-paste-toggle').textContent = 'Paste one instead';
      } else {
        paste.style.display = 'block';
        $('#oauth-submit').style.display = 'none';
        $('#token-submit').style.display = 'inline-block';
        $('#token-paste-toggle').textContent = 'Sign in with OAuth instead';
        setTimeout(() => $('#token-input').focus(), 50);
      }
    });

    $('#token-submit').addEventListener('click', async () => {
      const newToken = $('#token-input').value.trim();
      const raw = $('#token-url-input').value.trim().replace(/\/$/, '');
      if (!newToken) return;
      const { host, name } = parseHostAndVault(raw || 'http://127.0.0.1:1940');
      state.token = newToken;
      state.url = host;
      state.vaultName = name;
      localStorage.setItem(STORAGE_PREFIX + 'token', state.token);
      localStorage.setItem(STORAGE_PREFIX + 'url', state.url);
      localStorage.setItem(STORAGE_PREFIX + 'vault', state.vaultName);
      const ok = await tryConnect();
      if (ok) {
        closeTokenModal();
        route();
      }
    });
    $('#token-cancel').addEventListener('click', closeTokenModal);
    $('#token-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') $('#token-submit').click();
    });
    $('#token-url-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        // Enter on the URL field defaults to whichever primary is shown.
        const primary = $('#oauth-submit').style.display !== 'none' ? '#oauth-submit' : '#token-submit';
        $(primary).click();
      }
    });
  };

  // Called from init() when the page loads with ?code=...&state=... in the URL
  // (the vault has just redirected us back from its consent page).
  const handleOAuthCallback = async (cb) => {
    try {
      // Tell the user something is happening — the exchange takes ~200ms but
      // a bare loading… screen is jarring.
      renderView(h('div', { class: 'loading' }, 'completing sign-in…'));
      const { token } = await window.GBOAuth.completeOAuth(cb.code, cb.state);
      // Store. token.access_token is a pvt_* — same shape as paste-flow.
      // Persist scope + vault + iss for display + future refresh logic.
      state.token = token.access_token;
      // The token response tells us which vault we're connected to and the
      // service URL. Prefer it over whatever the user typed into the modal.
      if (token.services?.vault?.url) {
        // services.vault.url is the full vault URL including /vault/<name>;
        // strip the /vault/<name> suffix to recover the origin base.
        const m = String(token.services.vault.url).match(/^(.*?)\/vault\/[^/]+\/?$/);
        if (m) state.url = m[1];
      }
      // The token response's `vault` is authoritative — the OAuth flow may have
      // resolved a different vault than the user typed.
      if (token.vault) {
        state.vaultName = token.vault;
        localStorage.setItem(STORAGE_PREFIX + 'vault', token.vault);
      }
      state.oauth = {
        scope: token.scope,
        vault: token.vault,
        iss: token.iss,
        connectedAt: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_PREFIX + 'token', state.token);
      localStorage.setItem(STORAGE_PREFIX + 'url', state.url);
      localStorage.setItem(STORAGE_PREFIX + 'oauth', JSON.stringify(state.oauth));
      // Strip ?code/?state from the URL so a refresh doesn't try to re-exchange.
      window.GBOAuth.cleanCallbackFromUrl();
      closeTokenModal();
      await tryConnect();
      route();
    } catch (e) {
      window.GBOAuth.cleanCallbackFromUrl();
      // Surface the error in the modal rather than a blank screen.
      openTokenModal();
      $('#token-err').textContent = e.message || 'Sign-in could not complete.';
      $('#token-err').classList.add('shown');
      if (e.approveUrl) {
        const hint = $('#token-hint');
        hint.innerHTML = '';
        hint.appendChild(document.createTextNode('Your hub admin needs to approve this app. '));
        const a = document.createElement('a');
        a.href = e.approveUrl;
        a.target = '_blank';
        a.rel = 'noopener';
        a.className = 'link';
        a.textContent = 'Open approval page';
        hint.appendChild(a);
      }
    }
  };

  const setupSearch = () => {
    const input = $('#search-input');
    let timer;
    input.addEventListener('input', () => {
      const q = input.value.trim();
      clearTimeout(timer);
      if (!q) return;
      timer = setTimeout(() => {
        window.location.hash = `/search?q=${encodeURIComponent(q)}`;
      }, 350);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const q = input.value.trim();
        if (q) window.location.hash = `/search?q=${encodeURIComponent(q)}`;
      }
    });
  };

  const setupSidebarLinks = () => {
    $$('.sidebar-link[data-route]').forEach(el => {
      el.addEventListener('click', () => {
        window.location.hash = el.getAttribute('data-route').slice(1) || '';
      });
    });
  };

  // ---- Init

  const init = async () => {
    setupTokenModal();
    setupSearch();
    setupSidebarLinks();
    setTokenIndicator();

    window.addEventListener('hashchange', route);

    // If the vault just redirected us back with ?code=...&state=..., finish
    // the OAuth exchange before doing anything else.
    const cb = window.GBOAuth && window.GBOAuth.detectCallback();
    if (cb && cb.error) {
      window.GBOAuth.cleanCallbackFromUrl();
      openTokenModal();
      $('#token-err').textContent = `Sign-in cancelled: ${cb.description || cb.error}`;
      $('#token-err').classList.add('shown');
      route();
      return;
    }
    if (cb && cb.code) {
      await handleOAuthCallback(cb);
      return;
    }

    // Restore the cached OAuth context for display purposes.
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + 'oauth');
      if (raw) state.oauth = JSON.parse(raw);
    } catch {}

    if (state.token) {
      await tryConnect();
    } else {
      openTokenModal();
    }
    route();
  };

  // Expose a little API for inline onclick
  window.GB = { openTokenModal };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
