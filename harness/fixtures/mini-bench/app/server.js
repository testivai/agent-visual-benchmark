// Minimal static server for the mini app.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, 'site');
const port = Number(process.env.PORT || 4173);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8' };

http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]);
  let file = path.join(root, path.normalize(rel));
  if (!file.startsWith(root)) { res.writeHead(403); res.end(); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(port, '127.0.0.1');
