# Despliegue en servidor Linux (24/7) + cron

Guía paso a paso para dejar el scraper de Wansoft corriendo cada hora en un
servidor Linux. Comandos pensados para Ubuntu/Debian (ajusta a tu distro).

> Recomendado: desplegar en el **mismo servidor donde ya corre la app / la BD**
> (la app ya envía correos con el mismo SMTP, así las alertas también funcionarán).

---

## 1. Copiar la carpeta al servidor

Desde tu PC (en la raíz del repo):

```bash
# Opción A: rsync por SSH
rsync -av --exclude node_modules --exclude screenshots --exclude dumps \
  wansoft-scraper/ usuario@TU_SERVIDOR:/opt/wansoft-scraper/

# Opción B: si el repo está en el servidor, sólo entra a la carpeta
```

El `.env` NO se sube con git (está en `.gitignore`); cópialo aparte o créalo en el servidor (paso 3).

---

## 2. Instalar Node y dependencias

```bash
# Node 18+ (si no lo tienes)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

cd /opt/wansoft-scraper
npm install --omit=dev

# Navegador + librerías del sistema que Playwright necesita en Linux headless
npx playwright install chromium
sudo npx playwright install-deps chromium
```

---

## 3. Crear el `.env`

```bash
cp .env.example .env
nano .env   # llena WANSOFT_*, DB_*, ALERT_EMAIL, SMTP_*
```

---

## 4. Probar antes de programar

```bash
# Sin tocar la BD (sólo imprime)
node scrape.mjs --dry

# Real (guarda en BD)
node scrape.mjs

# Probar el canal de alertas (envía un email a ALERT_EMAIL)
node diag-mail.mjs
```

Si `node scrape.mjs` lista las 10 sucursales y dice "Guardado en ...", está listo.

---

## 5. Programar con cron (cada hora + cierre nocturno)

```bash
crontab -e
```

Pega esto (ajusta la ruta y la del binario de node con `which node`):

```cron
# Zona horaria para que "hoy" y las horas coincidan con México
CRON_TZ=America/Mexico_City

# Captura del día en curso, cada hora en punto
0 * * * * cd /opt/wansoft-scraper && /usr/bin/node scrape.mjs >> /opt/wansoft-scraper/scrape.log 2>&1

# Captura FINAL del día anterior (después del cierre), 1:15 AM hora MX
15 1 * * * cd /opt/wansoft-scraper && /usr/bin/node scrape.mjs --yesterday >> /opt/wansoft-scraper/scrape.log 2>&1
```

> `CRON_TZ` lo soporta cronie (Ubuntu/Debian/CentOS modernos). Si tu cron no lo
> soporta, usa el equivalente en UTC: hora MX + 6h (ej. `0 6 * * *` para el cierre).

Verifica que quedó: `crontab -l`

---

## 6. (Alternativa) proceso permanente con pm2

En vez de cron, un proceso que corre el scrape cada hora internamente:

```bash
sudo npm i -g pm2
pm2 start scheduler.mjs --name wansoft-ventas
pm2 save && pm2 startup    # arranca al bootear el servidor
pm2 logs wansoft-ventas    # ver salida
```

(El cierre nocturno `--yesterday` igual conviene dejarlo en cron.)

---

## 7. Mantenimiento

- **Logs:** `tail -f /opt/wansoft-scraper/scrape.log`. Rota con `logrotate` si crece.
- **Alertas:** además del email, cada alerta se registra en `alerts.log`.
- **Actualizar credenciales de Wansoft:** edita `.env` y listo (no requiere reinstalar).
- **Verificar datos:** en MySQL `SELECT Fecha, COUNT(*), SUM(VentasNetasTotal) FROM tblWansoftVentasSucursal GROUP BY Fecha ORDER BY Fecha DESC;`

## Notas de zona horaria
- `node scrape.mjs` calcula "hoy" en **America/Mexico_City** internamente, así que
  aunque el servidor esté en UTC los datos caen en la fecha correcta.
- `CRON_TZ` sólo afecta **a qué hora dispara** el cron, no a la fecha que consulta el script.
