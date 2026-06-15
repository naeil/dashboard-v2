import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const configFile = fileURLToPath(new URL('../vite.config.js', import.meta.url))

const server = await createServer({
  configFile,
  configLoader: 'native',
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
  },
})

await server.listen()
server.printUrls()

process.on('SIGTERM', async () => {
  await server.close()
  process.exit(0)
})

process.on('SIGINT', async () => {
  await server.close()
  process.exit(0)
})
