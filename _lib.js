// 에어컨탐정 공용 도구: Supabase 호출, 관리자 로그인 쿠키, 요청 처리
// 파일 이름이 _ 로 시작하면 Vercel이 주소(엔드포인트)로 만들지 않습니다.
import crypto from 'node:crypto';

const env = (k) => process.env[k] || '';
const SB_URL = () => env('SUPABASE_URL').replace(/\/+$/, '');
const SB_KEY = () => env('SUPABASE_SECRET_KEY') || env('SUPABASE_SERVICE_ROLE_KEY');
export const BUCKET = 'media';

export const SERVICE_IDS = ['clean', 'repair', 'install'];
// 단정 오피스케어와 같은 Supabase를 쓰므로, 에어컨탐정 전용 테이블 이름을 따로 씁니다.
export const T = { posts: 'ac_posts', quotes: 'ac_quotes' };
export const UPLOAD_DIR = 'acposts';
export const QUOTE_STATUS = ['신규', '연락완료', '견적발송', '종료'];

export const supabaseReady = () => !!(SB_URL() && SB_KEY());

function sbHeaders(extra = {}) {
  const key = SB_KEY();
  const h = { apikey: key, ...extra };
  // 예전 방식 service_role 키(JWT)만 Authorization 헤더에도 넣습니다. 새 sb_secret_ 키는 apikey 헤더만 씁니다.
  if (key.startsWith('eyJ')) h.Authorization = `Bearer ${key}`;
  return h;
}

/** Supabase 테이블 호출 (PostgREST) */
export async function db(method, table, { query = '', body, prefer } = {}) {
  const res = await fetch(`${SB_URL()}/rest/v1/${table}${query ? `?${query}` : ''}`, {
    method,
    headers: sbHeaders({ 'Content-Type': 'application/json', ...(prefer ? { Prefer: prefer } : {}) }),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!res.ok) {
    const err = new Error(`supabase ${table} ${res.status}: ${text.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const publicUrl = (path) => `${SB_URL()}/storage/v1/object/public/${BUCKET}/${path}`;

/** 우리 저장소에 올라간 사진 주소인지 확인하고, 맞으면 저장 경로를 돌려줍니다 */
export function storagePathOf(url) {
  const prefix = `${SB_URL()}/storage/v1/object/public/${BUCKET}/`;
  if (typeof url !== 'string' || !url.startsWith(prefix)) return null;
  const path = url.slice(prefix.length);
  return /^[a-z]+\/[0-9]{6}\/[a-z0-9]{8,40}\.(jpg|png|webp|gif)$/.test(path) ? path : null;
}

/** 브라우저가 Supabase로 직접 올릴 수 있는 1회용 업로드 주소 */
export async function signUpload(path) {
  const res = await fetch(`${SB_URL()}/storage/v1/object/upload/sign/${BUCKET}/${path}`, {
    method: 'POST',
    headers: sbHeaders({ 'Content-Type': 'application/json' }),
    body: '{}',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.url) throw new Error(`sign upload ${res.status}: ${JSON.stringify(data).slice(0, 200)}`);
  return `${SB_URL()}/storage/v1${data.url}`;
}

/** 사진 파일 삭제 (실패해도 글·사진 삭제는 계속 진행) */
export async function removeObjects(paths) {
  const list = [...new Set(paths.filter(Boolean))];
  if (!list.length) return;
  try {
    await fetch(`${SB_URL()}/storage/v1/object/${BUCKET}`, {
      method: 'DELETE',
      headers: sbHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ prefixes: list }),
    });
  } catch (err) {
    console.error('storage remove failed', err);
  }
}

/* ---------- 관리자 로그인 ---------- */
const COOKIE = 'ac_admin';
const WEEK = 60 * 60 * 24 * 7;
const sessionSecret = () =>
  env('SESSION_SECRET') ||
  crypto.createHash('sha256').update(`aircon-detective|${env('ADMIN_PASSWORD')}|${SB_KEY()}`).digest('hex');
const sign = (v) => crypto.createHmac('sha256', sessionSecret()).update(v).digest('hex');

export function checkPassword(input) {
  const real = env('ADMIN_PASSWORD');
  if (!real || typeof input !== 'string') return false;
  const a = crypto.createHash('sha256').update(input).digest();
  const b = crypto.createHash('sha256').update(real).digest();
  return crypto.timingSafeEqual(a, b);
}

export function adminCookie(res, on) {
  const value = on ? `${Date.now() + WEEK * 1000}.` : '';
  const token = on ? value + sign(value) : '';
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${on ? WEEK : 0}`);
}

export function isAdmin(req) {
  if (!env('ADMIN_PASSWORD')) return false;
  const raw = String(req.headers.cookie || '')
    .split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith(`${COOKIE}=`));
  if (!raw) return false;
  const token = raw.slice(COOKIE.length + 1);
  const dot = token.indexOf('.');
  if (dot < 1) return false;
  const value = token.slice(0, dot + 1);
  const sig = token.slice(dot + 1);
  if (!/^[0-9a-f]{64}$/.test(sig)) return false;
  const ok = crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(sign(value), 'hex'));
  return ok && Number(value.slice(0, -1)) > Date.now();
}

/* ---------- 요청 처리 ---------- */
export function send(res, status, data) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.statusCode = status;
  res.end(JSON.stringify(data));
}

export function readBody(req) {
  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = {}; } }
  return b && typeof b === 'object' ? b : {};
}

/** 다른 사이트에서 몰래 보내는 요청을 막습니다 */
export function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try { return new URL(origin).host === req.headers.host; } catch { return false; }
}

export const clean = (v, max) =>
  String(v ?? '').replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '').trim().slice(0, max);

export const queryParam = (req, name) => {
  if (req.query && req.query[name] != null) return String(req.query[name]);
  try { return new URL(req.url, 'http://x').searchParams.get(name) || ''; } catch { return ''; }
};

/** 관리자 전용 요청을 감쌉니다 */
export function guard(req, res, { admin = false } = {}) {
  if (!supabaseReady()) { send(res, 500, { ok: false, error: 'not_configured' }); return false; }
  if (req.method !== 'GET' && !sameOrigin(req)) { send(res, 403, { ok: false, error: 'bad_origin' }); return false; }
  if (admin && !isAdmin(req)) { send(res, 401, { ok: false, error: 'login_required' }); return false; }
  return true;
}
