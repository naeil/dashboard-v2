import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '')
    const proxyTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:8080'

                              return {
                                    plugins: [react()],
                                    // 빌드 결과물을 Spring Boot static 폴더로 직접 출력
                                    build: {
                                            outDir: path.resolve(__dirname, '../src/main/resources/static'),
                                            emptyOutDir: true,
                                    },
                                    server: {
                                            port: 5173,
                                            allowedHosts: ['.trycloudflare.com', '192.168.0.86'],
                                            proxy: {
                                                      '/api': {
                                                                  target: proxyTarget,
                                                                  changeOrigin: true,
                                                      },
                                            },
                                    },
                              }
})
