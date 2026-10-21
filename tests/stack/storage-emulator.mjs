// Minimal emulator of the Supabase Storage HTTP API for tests.
// Implements the calls the app makes: upload (raw body), remove, and public object reads.
// Object rows are written to storage.objects *as the caller's database role* with their JWT
// claims, so the storage RLS policies from supabase/migrations are genuinely enforced.
// TEST HARNESS ONLY.

import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import pg from 'pg';

const port = Number(process.env.STACK_PORT ?? 54333);
const secret = process.env.STACK_JWT_SECRET;
const filesDir = process.env.STACK_FILES_DIR ?? path.resolve('.stack/storage');
const pool = new pg.Pool({ connectionString: process.env.STACK_DB_URL, max: 5 });
fs.mkdirSync(filesDir, { recursive: true });

function verifyJwt(token) {
  const [h, b, s] = token.split('.');
  if (!h || !b || !s) return null;
  const expected = createHmac('sha256', secret).update(`${h}.${b}`).digest();
  const given = Buffer.from(s, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  const claims = JSON.parse(Buffer.from(b, 'base64url').toString('utf8'));
  if (claims.exp && claims.exp * 1000 < Date.now()) return null;
  return claims;
}

function send(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}
const readBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });

async function asRole(claims, fn) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const role = ['anon', 'authenticated', 'service_role'].includes(claims.role) ? claims.role : 'anon';
    await client.query(`set local role ${role}`);
    await client.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims)]);
    const out = await fn(client);
    await client.query('commit');
    return out;
  } catch (e) {
    await client.query('rollback').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

const safeRel = (bucket, name) => {
  const p = path.normalize(path.join(bucket, name));
  if (p.startsWith('..') || path.isAbsolute(p)) throw new Error('bad path');
  return p;
};

http
  .createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://x');
      const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
      // Public read: /object/public/<bucket>/<path...>
      if (req.method === 'GET' && parts[0] === 'object' && parts[1] === 'public') {
        const bucket = parts[2];
        const name = parts.slice(3).join('/');
        const b = await pool.query('select public from storage.buckets where id = $1', [bucket]);
        if (!b.rows[0]?.public) return send(res, 404, { error: 'not_found' });
        const file = path.join(filesDir, safeRel(bucket, name));
        if (!fs.existsSync(file)) return send(res, 404, { error: 'not_found' });
        const meta = await pool.query('select metadata from storage.objects where bucket_id = $1 and name = $2', [bucket, name]);
        res.writeHead(200, { 'content-type': meta.rows[0]?.metadata?.mimetype ?? 'application/octet-stream' });
        return fs.createReadStream(file).pipe(res);
      }

      const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
      const claims = token ? verifyJwt(token) : null;
      if (!claims) return send(res, 401, { statusCode: '401', error: 'Unauthorized', message: 'Invalid JWT' });

      // Upload: POST /object/<bucket>/<path...>
      if ((req.method === 'POST' || req.method === 'PUT') && parts[0] === 'object' && parts.length >= 3) {
        const bucket = parts[1];
        const name = parts.slice(2).join('/');
        const body = await readBody(req);
        const contentType = (req.headers['content-type'] ?? 'application/octet-stream').split(';')[0].trim();
        const bucketRow = (await pool.query('select * from storage.buckets where id = $1', [bucket])).rows[0];
        if (!bucketRow) return send(res, 404, { statusCode: '404', error: 'Bucket not found', message: 'Bucket not found' });
        if (bucketRow.file_size_limit && body.length > Number(bucketRow.file_size_limit)) {
          return send(res, 413, { statusCode: '413', error: 'Payload too large', message: 'The object exceeded the maximum allowed size' });
        }
        if (bucketRow.allowed_mime_types?.length && !bucketRow.allowed_mime_types.includes(contentType)) {
          return send(res, 415, { statusCode: '415', error: 'invalid_mime_type', message: `mime type ${contentType} is not supported` });
        }
        const id = randomUUID();
        try {
          await asRole(claims, (c) =>
            c.query(
              `insert into storage.objects (id, bucket_id, name, owner, owner_id, metadata)
               values ($1, $2, $3, $4, $5, $6)`,
              [id, bucket, name, claims.sub ?? null, claims.sub ?? null, { mimetype: contentType, size: body.length }],
            ),
          );
        } catch (e) {
          const rls = /row-level security|permission denied/i.test(e.message);
          const dup = /duplicate key/i.test(e.message);
          return send(res, rls ? 403 : dup ? 409 : 400, {
            statusCode: rls ? '403' : dup ? '409' : '400',
            error: rls ? 'Unauthorized' : dup ? 'Duplicate' : 'Error',
            message: rls ? 'new row violates row-level security policy' : e.message,
          });
        }
        const file = path.join(filesDir, safeRel(bucket, name));
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, body);
        return send(res, 200, { Id: id, Key: `${bucket}/${name}` });
      }

      // Remove: DELETE /object/<bucket>  { prefixes: [...] }
      if (req.method === 'DELETE' && parts[0] === 'object' && parts.length === 2) {
        const bucket = parts[1];
        const { prefixes = [] } = JSON.parse((await readBody(req)).toString('utf8') || '{}');
        const rows = await asRole(claims, (c) =>
          c.query('delete from storage.objects where bucket_id = $1 and name = any($2::text[]) returning id, name', [bucket, prefixes]),
        );
        for (const r of rows.rows) fs.rmSync(path.join(filesDir, safeRel(bucket, r.name)), { force: true });
        return send(res, 200, rows.rows.map((r) => ({ id: r.id, name: r.name, bucket_id: bucket })));
      }

      return send(res, 404, { error: 'not_implemented_in_emulator' });
    } catch (e) {
      return send(res, 500, { error: 'emulator_error', message: String(e.message ?? e) });
    }
  })
  .listen(port, '127.0.0.1', () => console.log(`storage emulator on ${port}`));
