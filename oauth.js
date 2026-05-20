/* ==========================================================================
   gitcoin brain — oauth.js
   OAuth 2.1 + PKCE client for Parachute Vault.

   Mirrors parachute-notes/src/lib/vault/oauth.ts, ported to vanilla JS.
   Surface:
     await GBOAuth.beginOAuth(issuerUrl, scope?)   → redirects browser
     await GBOAuth.completeOAuth(code, state)      → returns { token, pending }
     GBOAuth.redirectUri()                         → string
   ========================================================================== */

(() => {
  'use strict';

  const REDIRECT_PATH = '';
  const DEFAULT_SCOPE = 'vault:read vault:write';
  const STORAGE_KEYS = {
    pending: 'gb:oauth:pending',
    clientId: 'gb:oauth:client', // suffix: '<issuer>|<redirect>'
  };

  // ---- redirect URI

  // GH Pages serves index.html at the project root; we use the same URL as
  // both the app and the OAuth callback. The vault sends the user back here
  // with ?code=... &state=... — main.js detects and finishes the flow.
  function redirectUri() {
    const o = window.location.origin;
    const p = window.location.pathname.replace(/\/$/, '');
    // pathname may be "/gitcoin-brain-ui/" or "/" depending on host
    return `${o}${p}/${REDIRECT_PATH}`.replace(/\/$/, '/');
  }

  // ---- PKCE (RFC 7636)

  function base64UrlEncode(bytes) {
    let bin = '';
    for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function generateCodeVerifier(bytes = 32) {
    const buf = new Uint8Array(bytes);
    crypto.getRandomValues(buf);
    return base64UrlEncode(buf);
  }

  async function deriveCodeChallenge(verifier) {
    const data = new TextEncoder().encode(verifier);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return base64UrlEncode(new Uint8Array(hash));
  }

  function generateState(bytes = 16) {
    const buf = new Uint8Array(bytes);
    crypto.getRandomValues(buf);
    return base64UrlEncode(buf);
  }

  // ---- discovery + DCR

  async function discoverAuthServer(vaultUrl) {
    const base = vaultUrl.replace(/\/$/, '');
    const metaUrl = `${base}/.well-known/oauth-authorization-server`;
    let res;
    try {
      res = await fetch(metaUrl, { headers: { Accept: 'application/json' } });
    } catch (e) {
      throw new Error(`Could not reach vault at ${vaultUrl}: ${e.message}`);
    }
    if (!res.ok) {
      throw new Error(`OAuth discovery failed (${res.status}). Tried ${metaUrl}. Is this a Parachute Vault URL?`);
    }
    const data = await res.json();
    for (const f of ['issuer', 'authorization_endpoint', 'token_endpoint', 'registration_endpoint']) {
      if (typeof data[f] !== 'string' || !data[f]) {
        throw new Error(`Discovery response missing ${f}`);
      }
    }
    const methods = data.code_challenge_methods_supported || [];
    if (!methods.includes('S256')) {
      throw new Error('Vault does not advertise S256 PKCE — refusing.');
    }
    return data;
  }

  async function registerClient(endpoint, redirect) {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        client_name: 'Gitcoin Brain',
        redirect_uris: [redirect],
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none',
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Dynamic client registration failed (${res.status}): ${t.slice(0, 300)}`);
    }
    return res.json();
  }

  // ---- client_id cache (per issuer, per redirect_uri)

  function cacheKey(issuer, redirect) {
    return `${STORAGE_KEYS.clientId}:${issuer}|${redirect}`;
  }
  function loadCachedClientId(issuer, redirect) {
    try { return localStorage.getItem(cacheKey(issuer, redirect)); } catch { return null; }
  }
  function saveCachedClientId(issuer, redirect, clientId) {
    try { localStorage.setItem(cacheKey(issuer, redirect), clientId); } catch {}
  }
  function clearCachedClientId(issuer, redirect) {
    try { localStorage.removeItem(cacheKey(issuer, redirect)); } catch {}
  }

  // ---- pending OAuth state (sessionStorage, tab-scoped)

  function savePending(p) {
    try { sessionStorage.setItem(STORAGE_KEYS.pending, JSON.stringify(p)); } catch {}
  }
  function loadPending() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEYS.pending);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }
  function clearPending() {
    try { sessionStorage.removeItem(STORAGE_KEYS.pending); } catch {}
  }

  // ---- public surface

  async function beginOAuth(issuerInput, scope = DEFAULT_SCOPE) {
    const issuerUrl = (issuerInput || '').trim().replace(/\/$/, '');
    if (!issuerUrl) throw new Error('Vault URL required.');
    const redirect = redirectUri();

    const metadata = await discoverAuthServer(issuerUrl);

    let clientId = loadCachedClientId(metadata.issuer, redirect);
    if (!clientId) {
      const reg = await registerClient(metadata.registration_endpoint, redirect);
      clientId = reg.client_id;
      saveCachedClientId(metadata.issuer, redirect, clientId);
    }

    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await deriveCodeChallenge(codeVerifier);
    const state = generateState();

    const pending = {
      issuerUrl,
      issuer: metadata.issuer,
      tokenEndpoint: metadata.token_endpoint,
      clientId,
      codeVerifier,
      state,
      redirectUri: redirect,
      scope,
      startedAt: new Date().toISOString(),
    };
    savePending(pending);

    const u = new URL(metadata.authorization_endpoint);
    u.searchParams.set('response_type', 'code');
    u.searchParams.set('client_id', clientId);
    u.searchParams.set('redirect_uri', redirect);
    u.searchParams.set('code_challenge', codeChallenge);
    u.searchParams.set('code_challenge_method', 'S256');
    u.searchParams.set('state', state);
    u.searchParams.set('scope', scope);

    // Redirect the browser. The user lands on the vault's consent page.
    window.location.assign(u.toString());
  }

  async function completeOAuth(code, state) {
    const pending = loadPending();
    if (!pending) throw new Error('No pending OAuth flow. Start sign-in from the home page.');
    if (pending.state !== state) {
      clearPending();
      throw new Error('OAuth state mismatch — flow likely interrupted. Try again.');
    }

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      code_verifier: pending.codeVerifier,
      client_id: pending.clientId,
      redirect_uri: pending.redirectUri,
    });

    const res = await fetch(pending.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: body.toString(),
    });

    if (!res.ok) {
      const t = await res.text();
      clearPending();
      // Hub may return invalid_client with an approve_url when an operator
      // needs to allowlist the client. Surface that hint so the UI can link
      // straight to the hub admin page.
      try {
        const parsed = JSON.parse(t);
        if (parsed.error === 'invalid_client' && typeof parsed.approve_url === 'string') {
          const err = new Error('Your hub needs to approve this app before sign-in can complete.');
          err.approveUrl = parsed.approve_url;
          err.pendingApproval = true;
          throw err;
        }
      } catch (e) {
        if (e.pendingApproval) throw e;
      }
      throw new Error(`Token exchange failed (${res.status}): ${t.slice(0, 300)}`);
    }

    const token = await res.json();
    if (!token.access_token) {
      clearPending();
      throw new Error('Token response missing access_token.');
    }
    clearPending();
    return { token, pending };
  }

  // Detect a callback in the current URL. Returns { code, state } if both are
  // present as query params, else null.
  function detectCallback() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const error = params.get('error');
    if (error) return { error, description: params.get('error_description') };
    if (code && state) return { code, state };
    return null;
  }

  // Strip OAuth query params from the URL without reloading. Preserves any
  // hash route the user was on.
  function cleanCallbackFromUrl() {
    const u = new URL(window.location.href);
    ['code', 'state', 'error', 'error_description', 'iss'].forEach(k => u.searchParams.delete(k));
    const newUrl = u.pathname + (u.search || '') + (u.hash || '');
    history.replaceState(null, '', newUrl);
  }

  window.GBOAuth = {
    beginOAuth,
    completeOAuth,
    redirectUri,
    detectCallback,
    cleanCallbackFromUrl,
    clearCachedClientId,
    DEFAULT_SCOPE,
  };
})();
