// Scheduler en proceso: ejecuta el scrape al arrancar y luego cada hora.
// Alternativa al cron del sistema. Úsalo con pm2 para resiliencia:
//   pm2 start scheduler.mjs --name wansoft-ventas
import 'dotenv/config';
import { runOnce } from './scrape.mjs';

const INTERVALO_MS = Number(process.env.INTERVALO_MIN || 60) * 60 * 1000;
let corriendo = false;

async function tick() {
  if (corriendo) {
    console.log(new Date().toISOString(), 'Saltado: la corrida anterior sigue en curso.');
    return;
  }
  corriendo = true;
  try {
    await runOnce();
  } catch (e) {
    console.error(new Date().toISOString(), 'ERROR en corrida:', e.message);
  } finally {
    corriendo = false;
  }
}

console.log(new Date().toISOString(), `Scheduler iniciado. Intervalo = ${INTERVALO_MS / 60000} min.`);
tick();
setInterval(tick, INTERVALO_MS);
