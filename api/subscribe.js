// POST /api/subscribe  { email, company? }  ->  adds the email to the Resend
// "Buildbench Newsletter" segment. Vercel Node serverless function, no npm deps.
//
// Env vars:
//   RESEND_API_KEY      (required) Resend API key with full access (contacts + segments)
//   RESEND_SEGMENT_ID   (optional) segment ID; if unset, looked up by name below
//   RESEND_SEGMENT_NAME (optional) defaults to "Buildbench Newsletter"
//
// Responses: 200/201 {ok:true}, 400 invalid_email, 405 method_not_allowed,
// 409 already_subscribed, 500 server_error. Resend errors and the key are never sent to the client.
"use strict";

const API = "https://api.resend.com";
const DEFAULT_SEGMENT_NAME = "Buildbench Newsletter";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
let cachedSegmentId = null;

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function isValidEmail(email) {
  return typeof email === "string" && email.length <= 254 && EMAIL_RE.test(email);
}

async function resend(path, method, body) {
  const r = await fetch(API + path, {
    method: method || "GET",
    headers: {
      Authorization: "Bearer " + process.env.RESEND_API_KEY,
      "Content-Type": "application/json",
      "User-Agent": "nellyon-ai-stack-subscribe/1.0",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await r.json(); } catch (e) { /* empty body */ }
  return { status: r.status, ok: r.ok, data };
}

class ResendError extends Error {
  constructor(step, r) {
    super("Resend " + step + " failed with HTTP " + r.status);
    this.detail = r.data && (r.data.name || r.data.message);
  }
}

async function getSegmentId() {
  if (process.env.RESEND_SEGMENT_ID) return process.env.RESEND_SEGMENT_ID;
  if (cachedSegmentId) return cachedSegmentId;
  const name = (process.env.RESEND_SEGMENT_NAME || DEFAULT_SEGMENT_NAME).toLowerCase();
  const r = await resend("/segments");
  if (!r.ok) throw new ResendError("list segments", r);
  const seg = ((r.data && r.data.data) || []).find((s) => String(s.name).toLowerCase() === name);
  if (!seg) throw new Error("Resend segment not found: " + name);
  cachedSegmentId = seg.id;
  return seg.id;
}

async function readBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === "string") { try { return JSON.parse(req.body); } catch (e) { return {}; } }
    if (Buffer.isBuffer(req.body)) { try { return JSON.parse(req.body.toString("utf8")); } catch (e) { return {}; } }
    return req.body;
  }
  // Fallback when the body wasn't pre-parsed.
  const chunks = [];
  let size = 0;
  for await (const c of req) { size += c.length; if (size > 10000) break; chunks.push(c); }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); } catch (e) { return {}; }
}

async function subscribe(email) {
  const segmentId = await getSegmentId();
  const key = encodeURIComponent(email);

  // 1. Does the contact already exist (globally)?
  const existing = await resend("/contacts/" + key);
  let exists = existing.ok;
  if (!existing.ok && existing.status !== 404) throw new ResendError("get contact", existing);

  // 2. New contact: create it straight into the segment.
  if (!exists) {
    const created = await resend("/contacts", "POST", { email, unsubscribed: false, segments: [{ id: segmentId }] });
    if (created.ok) return { status: 201, body: { ok: true } };
    const msg = String((created.data && created.data.message) || "").toLowerCase();
    if (created.status === 409 || msg.includes("already")) exists = true; // race: created meanwhile
    else throw new ResendError("create contact", created);
  }

  // 3. Existing contact: already in the segment?
  const segs = await resend("/contacts/" + key + "/segments");
  if (!segs.ok) throw new ResendError("list contact segments", segs);
  const inSegment = ((segs.data && segs.data.data) || []).some((s) => s.id === segmentId);

  // Re-subscribing explicitly clears a previous global unsubscribe.
  const wasUnsubscribed = existing.ok && existing.data && existing.data.unsubscribed === true;
  if (wasUnsubscribed) {
    const upd = await resend("/contacts/" + key, "PATCH", { unsubscribed: false });
    if (!upd.ok) throw new ResendError("update contact", upd);
  }
  if (inSegment) {
    return wasUnsubscribed
      ? { status: 200, body: { ok: true } }
      : { status: 409, body: { ok: false, error: "already_subscribed" } };
  }

  const added = await resend("/contacts/" + key + "/segments/" + encodeURIComponent(segmentId), "POST");
  if (!added.ok) throw new ResendError("add contact to segment", added);
  return { status: 200, body: { ok: true } };
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return send(res, 405, { ok: false, error: "method_not_allowed" });
  }

  const body = await readBody(req);
  // Honeypot: real users never fill the hidden "company" field. Pretend success for bots.
  if (body && typeof body.company === "string" && body.company.trim() !== "") {
    return send(res, 200, { ok: true });
  }

  const email = String((body && body.email) || "").trim().toLowerCase();
  if (!isValidEmail(email)) return send(res, 400, { ok: false, error: "invalid_email" });

  if (!process.env.RESEND_API_KEY) {
    console.error("subscribe: RESEND_API_KEY is not set");
    return send(res, 500, { ok: false, error: "server_error" });
  }

  try {
    const result = await subscribe(email);
    return send(res, result.status, result.body);
  } catch (err) {
    console.error("subscribe:", err.message, err.detail || ""); // never logs the key
    return send(res, 500, { ok: false, error: "server_error" });
  }
};
