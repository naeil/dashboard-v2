const http = require('http')

http.createServer((request, response) => {
  response.end('ok')
}).listen(5173, '0.0.0.0', () => {
  console.log('listening')
})

setInterval(() => {}, 1000)
