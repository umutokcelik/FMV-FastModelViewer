import { randomBytes } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { inspectSelection, isWithin } from './launch-files.mjs';

const host = '127.0.0.1';
const appIcons = new Set(['/favicon.ico', '/fmv-icon.png', '/settings-icon.svg']);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
};
const appPolicy = [
  "default-src 'none'",
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "connect-src 'self' blob: data:",
  "worker-src 'self' blob:",
  "base-uri 'none'",
  "frame-ancestors 'none'",
].join('; ');

function decodePath(value) {
  const parts = value.split('/').map(decodeURIComponent);
  if (parts.some((part) => !part || part === '.' || part === '..' || /[\\/:\x00-\x1f]/.test(part))) {
    throw new Error('Invalid path');
  }
  return parts.join('/');
}

async function serveFile(request, response, root, relative, model = false, selectedFile) {
  const file = await realpath(selectedFile || path.resolve(root, relative));
  if (!isWithin(root, file)) throw new Error('Outside selected folder');
  const info = await stat(file);
  if (!info.isFile()) throw new Error('File not found');

  const type = types[path.extname(file).toLowerCase()];
  response.setHeader('Content-Type', (model && !type?.startsWith('image/') ? null : type) || 'application/octet-stream');
  response.setHeader('Content-Length', info.size);
  response.setHeader('Cache-Control', model ? 'no-store' : relative.startsWith('_next/static/') ? 'public, max-age=31536000, immutable' : 'no-cache');
  if (model) response.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
  if (request.method === 'HEAD') response.end();
  else await pipeline(createReadStream(file), response);
}

function send(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(body);
}

export async function startLocalServer({ webRoot, argument } = {}) {
  let root;
  try {
    root = await realpath(webRoot);
    if (!(await stat(path.join(root, 'index.html'))).isFile()) throw new Error('index.html');
  } catch {
    throw new Error('FMV derlemesi bulunamadı. Proje klasöründe npm run build çalıştır.');
  }

  const selection = await inspectSelection(argument);
  const token = selection ? randomBytes(24).toString('hex') : '';
  const privatePrefix = `/_fmv/${token}/`;
  let origin;
  const server = createServer(async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    if (request.headers.host !== server.address()?.address + ':' + server.address()?.port) {
      send(response, 403, 'Host not allowed');
      return;
    }
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.setHeader('Allow', 'GET, HEAD');
      send(response, 405, 'Method not allowed');
      return;
    }

    try {
      const pathname = new URL(request.url, origin).pathname;
      if (pathname.startsWith('/_fmv/')) {
        if (!selection || !pathname.startsWith(privatePrefix)) throw new Error('Unknown selection');
        const route = pathname.slice(privatePrefix.length);
        if (route === 'selection') {
          response.writeHead(200, { 'Content-Type': types['.json'], 'Cache-Control': 'no-store' });
          response.end(request.method === 'HEAD' ? undefined : JSON.stringify({ paths: selection.paths, initial: selection.initial }));
          return;
        }
        if (!route.startsWith('file/')) throw new Error('Unknown route');
        const file = decodePath(route.slice('file/'.length));
        if (selection.resources && !selection.resources.has(file)) throw new Error('File not selected');
        await serveFile(request, response, selection.root, file, true, file === selection.initial ? selection.file : undefined);
        return;
      }

      response.setHeader('Content-Security-Policy', appPolicy);
      if (pathname !== '/' && !appIcons.has(pathname) && !pathname.startsWith('/_next/')) throw new Error('Unknown route');
      await serveFile(request, response, root, pathname === '/' ? 'index.html' : decodePath(pathname.slice(1)));
    } catch {
      if (!response.headersSent && !response.destroyed) send(response, 404, 'Not found');
    }
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, host, () => {
      origin = `http://${host}:${server.address().port}`;
      server.off('error', reject);
      resolve();
    });
  });

  return {
    origin,
    url: token ? `${origin}/#${token}` : origin + '/',
    close() {
      return new Promise((resolve) => {
        server.close(resolve);
        server.closeAllConnections();
      });
    },
  };
}
