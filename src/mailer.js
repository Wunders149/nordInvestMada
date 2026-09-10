import net from 'net';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';

dotenv.config();

const SMTP_USER = process.env.SMTP_USER || process.env.EMAIL_USER;
const SMTP_PASS = process.env.SMTP_PASS || process.env.EMAIL_PASS;
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER;
const SMTP_HOST = process.env.SMTP_HOST || (/@smtp-brevo\.com$/i.test(SMTP_USER || '') ? 'smtp-relay.brevo.com' : 'smtp.gmail.com');
const SMTP_PORT = Number.parseInt(process.env.SMTP_PORT || '587', 10) || 587;
const SMTP_SECURE = process.env.SMTP_SECURE === 'true';
const SMTP_TIMEOUT_MS = Number.parseInt(process.env.SMTP_TIMEOUT_MS || '15000', 10) || 15000;
const SMTP_TOTAL_TIMEOUT_MS = SMTP_TIMEOUT_MS + 15000;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || SMTP_USER;

const configured = Boolean(SMTP_USER && SMTP_PASS);

if (!configured) {
  console.warn('[mailer] SMTP non configuré : définissez SMTP_USER et SMTP_PASS dans .env');
}

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465 || SMTP_SECURE,
  requireTLS: SMTP_PORT !== 465,
  connectionTimeout: Math.floor(SMTP_TIMEOUT_MS / 2),
  greetingTimeout: Math.floor(SMTP_TIMEOUT_MS / 2),
  socketTimeout: SMTP_TIMEOUT_MS,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS
  }
});

export const mailConfig = {
  host: SMTP_HOST,
  port: SMTP_PORT,
  user: SMTP_USER,
  from: SMTP_FROM,
  adminEmail: ADMIN_EMAIL,
  configured
};

export function isSmtpConfigured() {
  return configured;
}

function withTimeout(promise, ms, label) {
  let timer;
  return Promise.race([
    Promise.resolve(promise).finally(() => clearTimeout(timer)),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} (délai dépassé après ${ms}ms)`)), ms);
    })
  ]);
}

export async function verifyTransporter() {
  if (!configured) {
    console.warn('[mailer] Vérification SMTP ignorée : configuration manquante');
    return false;
  }
  try {
    await withTimeout(transporter.verify(), SMTP_TIMEOUT_MS, `Vérification SMTP ${SMTP_HOST}:${SMTP_PORT}`);
    console.log(`[mailer] SMTP vérifié avec succès sur ${SMTP_HOST}:${SMTP_PORT}`);
    return true;
  } catch (err) {
    console.error(`[mailer] Échec de vérification SMTP sur ${SMTP_HOST}:${SMTP_PORT}:`, err.response || err.message);
    return false;
  }
}

export async function sendEmail(options) {
  if (!configured) {
    const err = new Error('SMTP non configuré : définissez SMTP_USER et SMTP_PASS dans .env');
    console.error('[mailer]', err.message);
    throw err;
  }
  const info = await withTimeout(
    transporter.sendMail(options),
    SMTP_TOTAL_TIMEOUT_MS,
    `Envoi SMTP ${SMTP_HOST}:${SMTP_PORT}`
  );
  const recipients = options.to || options.cc
    ? `${options.to || ''}${options.cc ? `, cc: ${options.cc}` : ''}`
    : `bcc: ${String(options.bcc || '').split(',').length} destinataires`;
  console.log(`[mailer] Email envoyé (${recipients})`);
  return info;
}

function checkPortReachability(host, port) {
  return new Promise(resolve => {
    const started = Date.now();
    let settled = false;
    const finish = (reachable, error) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve({ port, reachable, ms: Date.now() - started, error: error || null });
    };
    const socket = net.connect({ host, port, timeout: 6000, autoSelectFamily: true });
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false, 'timeout'));
    socket.once('error', err => finish(false, err.code || err.message));
  });
}

export async function diagnoseSmtp() {
  const testedPorts = [...new Set([SMTP_PORT, 587, 2525, 465, 25])];
  const results = await Promise.all(
    testedPorts.map(port => checkPortReachability(SMTP_HOST, port))
  );
  return {
    host: SMTP_HOST,
    from: SMTP_FROM,
    user: SMTP_USER,
    results
  };
}

export function logMailFailure(context, err) {
  const detail = err?.response || err?.message || String(err);
  console.error(`[mailer] Échec d'envoi (${context}):`, detail);
}