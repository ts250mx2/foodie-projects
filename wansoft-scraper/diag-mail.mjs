import 'dotenv/config';
import nodemailer from 'nodemailer';
import { verifyTransport } from './alert.mjs';

const v = await verifyTransport().then(() => 'OK').catch((e) => 'FALLO: ' + e.message);
console.log('verify() login SMTP:', v);

const t = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});
try {
  const i = await t.sendMail({
    from: process.env.SMTP_USER,
    to: process.env.SMTP_USER, // Yahoo -> Yahoo (mismo buzón)
    subject: 'Wansoft diag',
    text: 'diagnostico',
    html: '<p>diagnostico</p>',
  });
  console.log('self-send Yahoo->Yahoo OK:', i.messageId);
} catch (e) {
  console.log('self-send Yahoo->Yahoo FALLO:', e.message);
}
process.exit(0);
