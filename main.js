/* ==========================================================================
   gitcoin brain — main.js
   vanilla, vault-aware, hash-routed
   ========================================================================== */

(() => {
  'use strict';

  // ---- Config

  const VAULT_NAME = 'gitcoin';
  const STORAGE_PREFIX = 'gb:v1:';

  // tag display names + sidebar order
  const TAG_DISPLAY = {
    custom:  { label: 'Strategic Anchors', desc: 'Kevin\'s voice + insights' },
    owocki:  { label: 'Recent Owocki',     desc: 'rebuild.how artifacts' },
    daily:   { label: 'Daily Reports',     desc: 'nightly derives' },
    monthly: { label: 'Monthly Rollups',   desc: '' },
    draft:   { label: 'Drafts',            desc: 'in-progress writing' },
    person:  { label: 'People',            desc: 'stakeholders' },
    gov:     { label: 'Governance',        desc: 'gov.gitcoin.co threads' },
    giveth:  { label: 'Giveth',            desc: '' },
    howto:   { label: 'How-To',            desc: '' },
  };
  const TAG_ORDER = ['custom', 'owocki', 'daily', 'draft', 'person', 'monthly', 'gov', 'giveth', 'howto'];

  // ---- State

  const state = {
    url: localStorage.getItem(STORAGE_PREFIX + 'url') || 'http://127.0.0.1:1940',
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
    const url = `${state.url}/vault/${VAULT_NAME}/api${path}`;
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
    const url = `${state.url}/vault/${VAULT_NAME}`;
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
    $('#token-cancel').style.display = state.connected ? 'inline-block' : 'none';
    setTimeout(() => $('#token-input').focus(), 50);
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
        .filter(n => n.path && n.path.startsWith('derives/daily-tweets/'))
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
        .filter(n => n.path && n.path.includes('processed/daily/'))
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
        .filter(n => n.path && n.path.startsWith('derives/daily-tweets/'))
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
    const url = `${state.url}/vault/${VAULT_NAME}`;
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

  const setupTokenModal = () => {
    $('#token-submit').addEventListener('click', async () => {
      const newToken = $('#token-input').value.trim();
      const newUrl = $('#token-url-input').value.trim().replace(/\/$/, '');
      if (!newToken) return;
      state.token = newToken;
      state.url = newUrl || 'http://127.0.0.1:1940';
      localStorage.setItem(STORAGE_PREFIX + 'token', state.token);
      localStorage.setItem(STORAGE_PREFIX + 'url', state.url);
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
