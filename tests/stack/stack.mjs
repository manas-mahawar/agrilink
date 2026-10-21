#!/usr/bin/env node
// Local Supabase-compatible stack for integration and end-to-end tests (Linux, no Docker).
//
//   PostgreSQL 15/16 (system install)   127.0.0.1:54322
//   Supabase Auth (GoTrue binary)       127.0.0.1:54331
//   PostgREST binary                    127.0.0.1:54332
//   Storage emulator (this folder)      127.0.0.1:54333
//   SMTP sink + mailbox API             127.0.0.1:54325 / 54324
//   Gateway (Supabase URL)              http://127.0.0.1:54321  ->  /auth/v1, /rest/v1, /storage/v1
//
// Usage:
//   node tests/stack/stack.mjs reset    # fresh database + Supabase Auth schema + app migrations
//   node tests/stack/stack.mjs start    # run all services in the foreground (Ctrl+C stops)
//   node tests/stack/stack.mjs env      # print the environment variables the app needs
//
// Binaries: set STACK_BIN_DIR (default ./.stack/bin) containing `auth` and `postgrest`
// (download with tests/stack/download-binaries.sh) and PG_BIN (default /usr/lib/postgresql/16/bin).
// TEST HARNESS ONLY. Production uses a hosted Supabase project.

import { spawn, spawnSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const workDir = process.env.STACK_WORK_DIR ?? path.join(root, '.stack');
const binDir = process.env.STACK_BIN_DIR ?? path.join(workDir, 'bin');
const pgBin = process.env.PG_BIN ?? '/usr/lib/postgresql/16/bin';
const pgData = path.join(workDir, 'pgdata');
// PostgreSQL refuses to run as root: when started as root, run it as STACK_OS_USER (default "postgres").
const osUser = process.env.STACK_OS_USER ?? (process.getuid?.() === 0 ? 'postgres' : null);

export const PORTS = { gateway: 54321, pg: 54322, mailbox: 54324, smtp: 54325, auth: 54331, rest: 54332, storage: 54333 };
export const JWT_SECRET = 'local-test-jwt-secret-that-is-at-least-32-characters';
export const DB_URL = `postgres://postgres@127.0.0.1:${PORTS.pg}/postgres`;
export const SITE_URL = process.env.STACK_SITE_URL ?? 'http://localhost:3000';

function b64url(input) {
  return Buffer.from(input).toString('base64url');
}
export function signJwt(payload) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}
const longLived = { iss: 'supabase-local', iat: 1700000000, exp: 2000000000 };
export const ANON_KEY = signJwt({ ...longLived, role: 'anon' });
export const SERVICE_KEY = signJwt({ ...longLived, role: 'service_role' });

export const appEnv = {
  NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${PORTS.gateway}`,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: ANON_KEY,
  SUPABASE_SECRET_KEY: SERVICE_KEY,
  STACK_DB_URL: DB_URL,
  STACK_MAILBOX_URL: `http://127.0.0.1:${PORTS.mailbox}`,
};

function run(cmd, args, opts = {}) {
  const full = osUser ? ['runuser', ['-u', osUser, '--', cmd, ...args]] : [cmd, args];
  const r = spawnSync(full[0], full[1], { stdio: opts.quiet ? 'pipe' : 'inherit', encoding: 'utf8', ...opts });
  if (r.status !== 0 && !opts.allowFail) {
    throw new Error(`${cmd} ${args.join(' ')} failed (${r.status}): ${r.stderr ?? ''}`);
  }
  return r;
}
function psqlFile(file) {
  const r = spawnSync('psql', ['-h', '127.0.0.1', '-p', String(PORTS.pg), '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q', '-f', file], {
    encoding: 'utf8',
  });
  if (r.status !== 0) throw new Error(`psql ${path.basename(file)} failed:\n${r.stderr}`);
  if (r.stderr?.trim()) process.stderr.write(r.stderr.split('\n').filter((l) => !/NOTICE/.test(l)).join('\n'));
}

function gotrueEnv() {
  return {
    ...process.env,
    GOTRUE_API_HOST: '127.0.0.1',
    PORT: String(PORTS.auth),
    API_EXTERNAL_URL: `http://127.0.0.1:${PORTS.gateway}/auth/v1`,
    GOTRUE_DB_DRIVER: 'postgres',
    GOTRUE_DB_DATABASE_URL: `postgres://supabase_auth_admin:auth-admin-local-only@127.0.0.1:${PORTS.pg}/postgres?sslmode=disable&search_path=auth`,
    GOTRUE_SITE_URL: SITE_URL,
    GOTRUE_URI_ALLOW_LIST: `${SITE_URL}/**,http://127.0.0.1:3000/**`,
    GOTRUE_JWT_SECRET: JWT_SECRET,
    GOTRUE_JWT_EXP: '3600',
    GOTRUE_JWT_AUD: 'authenticated',
    GOTRUE_JWT_DEFAULT_GROUP_NAME: 'authenticated',
    GOTRUE_JWT_ADMIN_ROLES: 'service_role',
    GOTRUE_DISABLE_SIGNUP: 'false',
    GOTRUE_EXTERNAL_EMAIL_ENABLED: 'true',
    GOTRUE_MAILER_AUTOCONFIRM: process.env.STACK_AUTOCONFIRM ?? 'true',
    GOTRUE_SMTP_HOST: '127.0.0.1',
    GOTRUE_SMTP_PORT: String(PORTS.smtp),
    GOTRUE_SMTP_ADMIN_EMAIL: 'no-reply@agrilink.local',
    GOTRUE_SMTP_SENDER_NAME: 'AgriLink (local test)',
    GOTRUE_SMTP_MAX_FREQUENCY: '1s',
    GOTRUE_RATE_LIMIT_EMAIL_SENT: '1000',
    GOTRUE_PASSWORD_MIN_LENGTH: '8',
    GOTRUE_LOG_LEVEL: 'warn',
    GOTRUE_DB_MIGRATIONS_PATH: path.join(binDir, 'migrations'),
  };
}

function reset() {
  fs.mkdirSync(workDir, { recursive: true });
  if (osUser) spawnSync('chown', ['-R', `${osUser}`, workDir]);
  run(path.join(pgBin, 'pg_ctl'), ['-D', pgData, 'stop', '-m', 'fast'], { allowFail: true, quiet: true });
  fs.rmSync(pgData, { recursive: true, force: true });
  run(path.join(pgBin, 'initdb'), ['-D', pgData, '-U', 'postgres', '--auth=trust', '-E', 'UTF8', '--locale=C.UTF-8'], { quiet: true });
  startPostgres();
  psqlFile(path.join(here, 'bootstrap.sql'));
  const mig = spawnSync(path.join(binDir, 'auth'), ['migrate'], { env: gotrueEnv(), encoding: 'utf8' });
  if (mig.status !== 0) throw new Error(`Supabase Auth migrations failed:\n${mig.stdout}\n${mig.stderr}`);
  const dir = path.join(root, 'supabase', 'migrations');
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) psqlFile(path.join(dir, f));
  console.log('Stack database reset: Supabase roles, Auth schema and all app migrations applied.');
}

function startPostgres() {
  const ready = spawnSync(path.join(pgBin, 'pg_isready'), ['-h', '127.0.0.1', '-p', String(PORTS.pg)]);
  if (ready.status === 0) return;
  run(path.join(pgBin, 'pg_ctl'), [
    '-D', pgData, '-w', '-l', path.join(workDir, 'postgres.log'),
    '-o', `-p ${PORTS.pg} -k /tmp -c listen_addresses=127.0.0.1 -c max_connections=200`, 'start',
  ], { quiet: true });
}

function start() {
  startPostgres();
  const procs = [];
  const launch = (name, cmd, args, env) => {
    const p = spawn(cmd, args, { env: env ?? process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    const log = fs.createWriteStream(path.join(workDir, `${name}.log`), { flags: 'a' });
    p.stdout.pipe(log);
    p.stderr.pipe(log);
    p.on('exit', (code) => console.log(`[stack] ${name} exited (${code})`));
    procs.push(p);
  };
  launch('auth', path.join(binDir, 'auth'), ['serve'], gotrueEnv());
  launch('postgrest', path.join(binDir, 'postgrest'), [], {
    ...process.env,
    PGRST_DB_URI: `postgres://authenticator:authenticator-local-only@127.0.0.1:${PORTS.pg}/postgres`,
    PGRST_DB_SCHEMAS: 'public',
    PGRST_DB_ANON_ROLE: 'anon',
    PGRST_DB_EXTRA_SEARCH_PATH: 'public,extensions',
    PGRST_JWT_SECRET: JWT_SECRET,
    PGRST_SERVER_HOST: '127.0.0.1',
    PGRST_SERVER_PORT: String(PORTS.rest),
    PGRST_DB_POOL: '20',
    PGRST_LOG_LEVEL: 'warn',
  });
  launch('storage', process.execPath, [path.join(here, 'storage-emulator.mjs')], {
    ...process.env, STACK_PORT: String(PORTS.storage), STACK_DB_URL: DB_URL, STACK_JWT_SECRET: JWT_SECRET,
    STACK_FILES_DIR: path.join(workDir, 'storage'),
  });
  launch('mail', process.execPath, [path.join(here, 'smtp-sink.mjs')], {
    ...process.env, SMTP_PORT: String(PORTS.smtp), MAILBOX_PORT: String(PORTS.mailbox),
  });
  launch('gateway', process.execPath, [path.join(here, 'gateway.mjs')], {
    ...process.env, GATEWAY_PORT: String(PORTS.gateway),
    AUTH_PORT: String(PORTS.auth), REST_PORT: String(PORTS.rest), STORAGE_PORT: String(PORTS.storage),
  });
  const stop = () => {
    for (const p of procs) p.kill('SIGTERM');
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  console.log(`[stack] running. Supabase URL ${appEnv.NEXT_PUBLIC_SUPABASE_URL}  (logs in ${workDir})`);
}

const isCli = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
const cmd = isCli ? process.argv[2] : undefined;
if (cmd === 'reset') reset();
else if (cmd === 'start') start();
else if (cmd === 'env') for (const [k, v] of Object.entries(appEnv)) console.log(`${k}=${v}`);
else if (cmd) {
  console.error(`Unknown command ${cmd}. Use reset | start | env.`);
  process.exit(1);
}
