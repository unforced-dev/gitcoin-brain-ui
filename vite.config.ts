import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Project-page deploy: built assets live under /gitcoin-brain-ui/ on GitHub
// Pages, but dev stays at root. Base-aware code downstream reads
// import.meta.env.BASE_URL (router basename, OAuth redirect URI).
//
// Heads-up (inherited from parachute-brain): `vite preview` + public/404.html
// form a redirect loop under the project base — to check a build locally use
// `npm run dev`, or static-serve dist/ behind a /gitcoin-brain-ui/ prefix.
// .ts.net allowed so dev can be shared over Tailscale.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/gitcoin-brain-ui/' : '/',
  plugins: [react()],
  server: { allowedHosts: ['.ts.net'] },
  preview: { allowedHosts: ['.ts.net'] },
}))
