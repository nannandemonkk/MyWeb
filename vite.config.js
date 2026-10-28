import { defineConfig, loadEnv } from 'vite'
import path from 'node:path'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const root = process.cwd()
  const env = loadEnv(mode, root, '')
  const privateRoots = [
    path.resolve(root, 'server'), path.resolve(root, 'artifacts'),
    path.resolve(root, env.DATA_DIR || 'server/data'),
    path.resolve(root, env.DOCS_DIR || 'server/document'),
  ]
  const privateDirectories = privateRoots.map((directory) => `${directory.split(path.sep).join('/')}/**`)
  const privateFiles = {
    name: 'myweb-private-files',
    apply: 'serve',
    configureServer(server) {
      // Reject before transforms and SPA fallback, including missing files and /@fs requests.
      server.middlewares.use((req, res, next) => {
        let url = (req.url || '/').split('?')[0]
        try { url = decodeURIComponent(url) } catch { res.statusCode = 400; res.end('Bad request'); return }
        const file = url.startsWith('/@fs/') ? path.resolve(url.slice(5)) : path.resolve(root, `.${url}`)
        const privateFile = privateRoots.some((directory) => {
          const relative = path.relative(directory, file)
          return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
        })
        if (privateFile) { res.statusCode = 403; res.end('Private server files are not served by Vite.'); return }
        next()
      })
    },
  }
  return {
    plugins: [privateFiles, react()],
    server: {
      // Atomic Markdown saves must not trigger temporary-file reads on Windows.
      watch: { ignored: [/\.tmpdir(?:[\\/]|$)/, /\.tmp$/] },
      // Vite is rooted at the repository: never let its file server bypass Express draft/auth rules.
      fs: {
        strict: true,
        allow: [root],
        deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/server/**', '**/artifacts/**', ...privateDirectories],
      },
      proxy: {
        '/api': {
          target: env.API_TARGET || `http://127.0.0.1:${env.PORT || 3000}`,
          // Preserve the browser Host: backend Origin validation then works through this proxy.
          changeOrigin: false,
        },
      },
    },
  }
})
