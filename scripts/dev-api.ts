import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseUrl } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

// Load .env.local into process.env
const envPath = resolve(projectRoot, '.env.local');
try {
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx);
    const value = trimmed.slice(eqIdx + 1);
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
} catch {
  console.error(`Warning: Could not read ${envPath}`);
}

// Dynamic import of the handler (after env vars are loaded)
const { default: handler } = await import('../api/[[...path]].ts');

function collectBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
  });
}

const PORT = parseInt(process.env.API_DEV_PORT || '3001', 10);

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  // CORS for local dev
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const rawBody = await collectBody(req);
  const parsed = parseUrl(req.url || '/', true);

  // Extend req with VercelRequest-like properties
  const vercelReq = req as any;
  vercelReq.query = { ...parsed.query };
  vercelReq.body = rawBody ? (() => { try { return JSON.parse(rawBody); } catch { return rawBody; } })() : undefined;

  // Extend res with VercelResponse-like methods
  const vercelRes = res as any;
  let statusCode = 200;
  vercelRes.status = (code: number) => { statusCode = code; return vercelRes; };
  vercelRes.json = (data: any) => {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  };
  vercelRes.send = (data: any) => {
    if (typeof data === 'object') {
      vercelRes.json(data);
    } else {
      res.writeHead(statusCode, { 'Content-Type': 'text/plain' });
      res.end(String(data));
    }
  };
  vercelRes.redirect = (urlOrStatus: string | number, url?: string) => {
    const location = typeof urlOrStatus === 'string' ? urlOrStatus : url!;
    const code = typeof urlOrStatus === 'number' ? urlOrStatus : 302;
    res.writeHead(code, { Location: location });
    res.end();
  };

  try {
    await handler(vercelReq, vercelRes);
  } catch (err: any) {
    console.error(`API Error [${req.method} ${req.url}]:`, err);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message || 'Internal Server Error' }));
    }
  }
});

server.listen(PORT, () => {
  console.log(`API dev server running at http://localhost:${PORT}`);
});
