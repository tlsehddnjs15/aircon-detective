// 에어컨탐정 견적 의뢰 접수: Supabase에 저장하고, 담당자 휴대폰으로 문자를 보냅니다 (SOLAPI).
//
// Vercel 환경변수
//   SUPABASE_URL, SUPABASE_SECRET_KEY   문의 저장용 (README 참고)
//   SOLAPI_API_KEY, SOLAPI_API_SECRET   문자 발송용
//   SMS_FROM                            SOLAPI에 등록한 발신번호
//   SMS_TO                              문의를 받을 번호 (비워두면 01047483142)
// 저장과 문자 중 하나만 설정해도 동작합니다. 둘 다 실패하면 고객 화면에 문자 앱 열기 안내가 나옵니다.

import crypto from 'node:crypto';
import { T, clean, db, readBody, sameOrigin, send, storagePathOf, supabaseReady } from './_lib.js';

const PHONE_RE = /^01[016789]-?\d{3,4}-?\d{4}$/;

// EUC-KR 기준 바이트 수 (한글 2바이트). 90바이트 넘으면 LMS로 보냅니다.
const smsBytes = (t) => [...t].reduce((n, c) => n + (c.charCodeAt(0) > 127 ? 2 : 1), 0);

function authHeader(key, secret) {
  const date = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const salt = crypto.randomBytes(16).toString('hex');
  const signature = crypto.createHmac('sha256', secret).update(date + salt).digest('hex');
  return `HMAC-SHA256 apiKey=${key}, date=${date}, salt=${salt}, signature=${signature}`;
}

async function sendSms(text) {
  const { SOLAPI_API_KEY, SOLAPI_API_SECRET, SMS_FROM } = process.env;
  if (!SOLAPI_API_KEY || !SOLAPI_API_SECRET || !SMS_FROM) return false;
  const to = (process.env.SMS_TO || '01047483142').replace(/\D/g, '');
  const isLong = smsBytes(text) > 90;
  const message = {
    to,
    from: SMS_FROM.replace(/\D/g, ''),
    text,
    type: isLong ? 'LMS' : 'SMS',
    ...(isLong ? { subject: '에어컨탐정 견적 의뢰' } : {}),
  };
  try {
    const r = await fetch('https://api.solapi.com/messages/v4/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader(SOLAPI_API_KEY, SOLAPI_API_SECRET) },
      body: JSON.stringify({ message }),
    });
    if (!r.ok) { console.error('SOLAPI error', r.status, await r.text().catch(() => '')); return false; }
    return true;
  } catch (err) {
    console.error('SOLAPI request failed', err);
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(res, 405, { ok: false, error: 'method_not_allowed' });
  }
  if (!sameOrigin(req)) return send(res, 403, { ok: false, error: 'bad_origin' });

  const body = readBody(req);
  // 봇이 채우는 숨은 칸(website)에 값이 있으면 조용히 성공 처리하고 버립니다.
  if (body.website) return send(res, 200, { ok: true });

  const name = clean(body.name, 30);
  const phone = clean(body.phone, 20);
  const service = clean(body.service, 60);
  const area = clean(body.area, 80);
  const aircon = clean(body.aircon, 60);
  const memo = clean(body.memo, 600);
  const photos = (Array.isArray(body.photos) ? body.photos : [])
    .filter((u) => String(storagePathOf(u) || '').startsWith('acquotes/'))
    .slice(0, 5);

  if (!name) return send(res, 400, { ok: false, error: 'name_required' });
  if (!PHONE_RE.test(phone)) return send(res, 400, { ok: false, error: 'phone_invalid' });
  if (body.agree !== true) return send(res, 400, { ok: false, error: 'consent_required' });

  const text = [
    '[에어컨탐정 견적 의뢰]',
    `성함: ${name}`,
    `연락처: ${phone}`,
    `서비스: ${service || '미선택'}`,
    aircon && `에어컨: ${aircon}`,
    area && `지역: ${area}`,
    memo && `내용: ${memo}`,
    photos.length && `사진 ${photos.length}장:`,
    ...photos,
  ].filter(Boolean).join('\n');

  const smsSent = await sendSms(text);

  let saved = false;
  if (supabaseReady()) {
    try {
      await db('POST', T.quotes, { body: { name, phone, service, area, aircon, memo, photos, sms_sent: smsSent }, prefer: 'return=minimal' });
      saved = true;
    } catch (err) {
      console.error('quote save failed', err);
    }
  }

  if (!saved && !smsSent) return send(res, 502, { ok: false, error: 'not_delivered' });
  return send(res, 200, { ok: true, saved, smsSent });
}
