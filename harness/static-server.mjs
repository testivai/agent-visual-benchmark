// The scorer's own static file server. It serves a workspace's site/ directory
// without running any code from that workspace.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
};

function resolveFile(root, urlPath) {
  let rel;
  try {
    rel = decodeURIComponent(urlPath.split('?')[0]);
  } catch {
    return null;
  }
  const file = path.resolve(root, `.${path.posix.normalize(`/${rel}`)}`);
  if (file !== root && !file.startsWith(root + path.sep)) return null;
  if (!fs.existsSync(file)) return null;
  if (fs.statSync(file).isDirectory()) {
    const index = path.join(file, 'index.html');
    return fs.existsSync(index) ? index : null;
  }
  return file;
}

export function startStaticServer(rootDir) {
  const root = path.resolve(rootDir);
  const server = http.createServer((req, res) => {
    const file = resolveFile(root, req.url ?? '/');
    if (!file) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('not found');
      return;
    }
    res.writeHead(200, {
      'content-type': TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        port,
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise((done) => { server.closeAllConnections?.(); server.close(() => done()); }),
      });
    });
  });
}
