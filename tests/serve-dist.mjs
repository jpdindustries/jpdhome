import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../dist/', import.meta.url)));
const port = Number(process.env.PORT || 4173);
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8',
};

function mapPath(pathname) {
  let mapped = decodeURIComponent(pathname);
  if (mapped === '/jpdhome') return { redirect: '/jpdhome/' };
  if (mapped.startsWith('/jpdhome/')) mapped = mapped.slice('/jpdhome'.length);
  if (mapped.endsWith('/')) mapped += 'index.html';
  const candidate = normalize(join(root, mapped));
  if (candidate !== root && !candidate.startsWith(`${root}${sep}`)) return null;
  return { candidate };
}

function sendFile(response, filePath, statusCode = 200, method = 'GET') {
  response.writeHead(statusCode, {
    'Cache-Control': 'no-store',
    'Content-Type': mimeTypes[extname(filePath)] || 'application/octet-stream',
  });
  if (method === 'HEAD') response.end();
  else createReadStream(filePath).pipe(response);
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || '127.0.0.1'}`);
  const mapped = mapPath(url.pathname);
  if (mapped?.redirect) {
    response.writeHead(302, { Location: mapped.redirect });
    response.end();
    return;
  }
  if (mapped?.candidate) {
    try {
      const details = await stat(mapped.candidate);
      if (details.isFile()) {
        sendFile(response, mapped.candidate, 200, request.method);
        return;
      }
    } catch {
      // The custom 404 below is the expected miss path.
    }
  }
  sendFile(response, join(root, '404.html'), 404, request.method);
});

server.listen(port, '127.0.0.1', () => {
  process.stdout.write(`Production artifact available at http://127.0.0.1:${port}\n`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
