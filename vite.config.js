import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  server: {
    proxy: {
      // 前端请求 /api/xxx 时，Vite 帮你转发到后端去
      // 配了这个，前端就当作"后端跟我同一个地址"，跨域问题消失
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
})
