// Alertas por email (nodemailer). Reusa el SMTP de la app (Yahoo) por defecto.
// Además registra cada alerta en alerts.log para tener traza aunque el email falle.
import nodemailer from 'nodemailer';
import fs from 'node:fs';

const ENABLED = process.env.ALERTS_ENABLED !== '0';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.mail.yahoo.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER || 'ts250mx@yahoo.com',
    pass: process.env.SMTP_PASS, // definir en .env (no se hardcodea el secreto)
  },
});

/** Verifica conexión/login SMTP. Útil para diagnóstico. */
export function verifyTransport() {
  return transporter.verify();
}

const FROM = process.env.ALERT_FROM || '"Wansoft Scraper" <ts250mx@yahoo.com>';
const TO = process.env.ALERT_EMAIL || 'ts250mx@gmail.com';

/** Envía una alerta por email. Nunca lanza: registra y sigue. */
export async function sendAlert(subject, text) {
  // Traza local siempre (aunque el email falle o esté deshabilitado).
  try {
    fs.appendFileSync('alerts.log', `[${new Date().toISOString()}] ${subject}\n${text}\n\n`);
  } catch { /* noop */ }

  if (!ENABLED) {
    console.log('Alertas deshabilitadas (ALERTS_ENABLED=0). No se envía:', subject);
    return;
  }
  try {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #f97316;">Wansoft · ${subject}</h2>
        <pre style="font-family: inherit; white-space: pre-wrap; color: #333;">${text}</pre>
      </div>`;
    const info = await transporter.sendMail({
      from: FROM,
      to: TO,
      subject: `[Wansoft] ${subject}`,
      text,
      html,
    });
    console.log(`Alerta enviada a ${TO}: ${info.messageId}`);
  } catch (e) {
    console.error('No se pudo enviar la alerta por email:', e.message);
  }
}
