// 견적 의뢰서 사진 올리기 준비: 손님(로그인 없음)에게 사진 1장용 1회용 업로드 주소를 발급합니다.
// 사진은 acquotes/ 폴더에만 저장되고, 의뢰서와 함께 관리자 화면에서 볼 수 있습니다.
import crypto from 'node:crypto';
import { publicUrl, readBody, sameOrigin, send, signUpload, supabaseReady } from './_lib.js';

const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

// 같은 접속자가 짧은 시간에 너무 많이 요청하지 못하게 막습니다 (서버가 살아 있는 동안만 기억하는 간단한 제한).
const hits = new Map();
function tooMany(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length > 30;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(res, 405, { ok: false, error: 'method_not_allowed' });
  }
  if (!sameOrigin(req)) return send(res, 403, { ok: false, error: 'bad_origin' });
  if (!supabaseReady()) return send(res, 500, { ok: false, error: 'not_configured' });
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
  if (tooMany(ip)) return send(res, 429, { ok: false, error: 'too_many' });
  try {
    const { type } = readBody(req);
    const ext = EXT[type];
    if (!ext) return send(res, 400, { ok: false, error: 'unsupported_type' });
    const d = new Date();
    const month = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    const path = `acquotes/${month}/${crypto.randomBytes(12).toString('hex')}.${ext}`;
    const uploadUrl = await signUpload(path);
    return send(res, 200, { ok: true, uploadUrl, publicUrl: publicUrl(path) });
  } catch (err) {
    console.error('quote-upload', err);
    return send(res, 500, { ok: false, error: 'server_error' });
  }
}
