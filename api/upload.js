// 사진 올리기 준비: 관리자에게 Supabase 1회용 업로드 주소를 발급합니다.
// 실제 파일은 브라우저가 Supabase로 바로 올립니다 (Vercel 요청 크기 제한을 피하기 위해).
import crypto from 'node:crypto';
import { UPLOAD_DIR, guard, publicUrl, readBody, send, signUpload } from './_lib.js';

const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(res, 405, { ok: false, error: 'method_not_allowed' });
  }
  if (!guard(req, res, { admin: true })) return;
  try {
    const { type, folder } = readBody(req);
    const ext = EXT[type];
    if (!ext) return send(res, 400, { ok: false, error: 'unsupported_type' });
    const dir = UPLOAD_DIR;
    const d = new Date();
    const month = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    const path = `${dir}/${month}/${crypto.randomBytes(12).toString('hex')}.${ext}`;
    const uploadUrl = await signUpload(path);
    return send(res, 200, { ok: true, uploadUrl, publicUrl: publicUrl(path) });
  } catch (err) {
    console.error('upload', err);
    return send(res, 500, { ok: false, error: 'server_error' });
  }
}
