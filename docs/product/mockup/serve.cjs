'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const port = Number(process.argv[2] || 3107);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Use a valid port number');
const files = new Map([
  ['/', ['interactive.html', 'text/html; charset=utf-8']],
  ['/interactive.html', ['interactive.html', 'text/html; charset=utf-8']],
  ['/knowledge.js', ['knowledge.js', 'text/javascript; charset=utf-8']],
  ['/work-map.js', ['work-map.js', 'text/javascript; charset=utf-8']],
  ['/desktop-preview.png', ['desktop-preview.png', 'image/png']],
  ['/mobile-preview.png', ['mobile-preview.png', 'image/png']],
]);
const server = http.createServer((request, response) => {
  const file = files.get(request.url.split('?')[0]);
  if (!file) { response.writeHead(404); response.end('Not found'); return; }
  fs.readFile(path.join(__dirname, file[0]), (error, content) => {
    if (error) { response.writeHead(500); response.end('Unable to load mockup'); return; }
    response.writeHead(200, { 'Content-Type': file[1], 'Cache-Control': 'no-store' });
    response.end(content);
  });
});
server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? 'Port is in use. Pass another port number.' : 'Unable to start mockup server.'); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => console.log('Mirinae mockup: http://127.0.0.1:' + port));
