import fs from 'node:fs';
import path from 'node:path';
import { URL } from 'node:url';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

export function parseCookies(cookieHeader = '') {
  return cookieHeader.split(';').reduce((acc, pair) => {
    const trimmed = pair.trim();
    if (!trimmed) return acc;
    const idx = trimmed.indexOf('=');
    if (idx === -1) return acc;
    const key = trimmed.slice(0, idx).trim();
    const value = decodeURIComponent(trimmed.slice(idx + 1).trim());
    acc[key] = value;
    return acc;
  }, {});
}

export async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('Invalid JSON body');
  }
}

export function sendJson(res, statusCode, payload, extraHeaders = {}) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    ...extraHeaders
  });
  res.end(JSON.stringify(payload));
}

export function sendHtml(res, statusCode, html, extraHeaders = {}) {
  res.writeHead(statusCode, {
    'Content-Type': 'text/html; charset=utf-8',
    ...extraHeaders
  });
  res.end(html);
}

export function notFound(res) {
  sendJson(res, 404, { error: 'Not found' });
}

export function badRequest(res, message) {
  sendJson(res, 400, { error: message || 'Bad request' });
}

export function unauthorized(res) {
  sendJson(res, 401, { error: 'Unauthorized' });
}

export function forbidden(res) {
  sendJson(res, 403, { error: 'Forbidden' });
}

export function serverError(res, error) {
  console.error(error);
  sendJson(res, 500, { error: 'Internal server error' });
}

export function getRequestUrl(req, base = 'http://localhost') {
  return new URL(req.url, base);
}

export function serveStaticFile(res, publicDir, pathname) {
  const normalized = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.join(publicDir, normalized);
  if (!filePath.startsWith(publicDir)) {
    notFound(res);
    return;
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    notFound(res);
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': mimeType });
  fs.createReadStream(filePath).pipe(res);
}
