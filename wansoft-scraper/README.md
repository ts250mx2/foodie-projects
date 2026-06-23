# Wansoft → Ventas por sucursal (automatizado)

Consulta cada hora el reporte **Reportes → Ingresos → Ventas por sucursal**
(`ConsolidatedSalesMasterReport`) de Wansoft para **todas las sucursales del día de hoy**
y guarda los totales en MySQL (`BDFoodieProjects.tblWansoftVentasSucursal`).

En vez de raspar el HTML, llama directamente al endpoint que usa el propio reporte
(`Reports/GetConsolidatedSales`), que respeta `subsidiaryId + startDate + endDate` y
devuelve JSON. Es rápido (~7 s las 10 sucursales) y robusto.

## Archivos
| Archivo | Rol |
|---|---|
| `scrape.mjs` | **Producción.** Una corrida: login → ventas del día por sucursal → upsert en BD. |
| `scheduler.mjs` | Loop en proceso que llama a `scrape.mjs` cada hora (alternativa al cron). |
| `auth.mjs` | Login reusable en Wansoft (Playwright). |
| `report.mjs` | Lista de sucursales + llamada a `GetConsolidatedSales`. |
| `db.mjs` | Crea la tabla (idempotente) y hace upsert por `(Fecha, IdSucursal)`. |
| `explore*.mjs`, `test-*.mjs`, `verify-dates.mjs` | Helpers de desarrollo/diagnóstico (no necesarios en producción). |

## Configuración (`.env`)
```
WANSOFT_URL=https://www.wansoft.net/Wansoft.Web/
WANSOFT_USER=...
WANSOFT_PASS=...
DB_HOST=74.208.192.90
DB_USER=kyk
DB_PASSWORD=...
DB_NAME=BDFoodieProjects
DB_PORT=3306
HEADFUL=0          # 1 para ver el navegador (debug local)
INTERVALO_MIN=60   # sólo para scheduler.mjs
```

## Instalación
```bash
npm install
npx playwright install chromium
# En servidor Linux, además las libs del navegador:
npx playwright install-deps chromium   # (o: sudo apt-get install ...)
```

## Uso manual
```bash
node scrape.mjs            # consulta y guarda el día de HOY
node scrape.mjs --dry      # consulta e imprime, SIN tocar la BD
DATE=2026-06-22 node scrape.mjs   # una fecha específica
```

## Programar cada hora (servidor 24/7)

**Opción A — cron (Linux, recomendado):** sobrevive reinicios, una corrida por hora.
```cron
# minuto 0 de cada hora
0 * * * * cd /ruta/wansoft-scraper && /usr/bin/node scrape.mjs >> scrape.log 2>&1
```

**Opción B — proceso permanente con pm2** (Linux o Windows Server):
```bash
npm i -g pm2
pm2 start scheduler.mjs --name wansoft-ventas
pm2 save && pm2 startup   # para que arranque al bootear
```

**Opción C — Windows Task Scheduler** (si el servidor es Windows):
```powershell
schtasks /Create /SC HOURLY /TN "WansoftVentas" ^
  /TR "node \"C:\ruta\wansoft-scraper\scrape.mjs\"" /ST 00:00 /F
```

## Tabla `tblWansoftVentasSucursal`
Una fila por `(Fecha, IdSucursal)`; cada corrida horaria **actualiza** (upsert) el total
acumulado del día. `CapturadoEn` indica la última actualización.

| Columna | Significado |
|---|---|
| `Fecha`, `IdSucursal`, `Sucursal` | Día e identidad de la sucursal en Wansoft |
| `VentasBrutas{Subtotal,Iva,Total}` | Ventas brutas |
| `Cortesias`, `Descuentos`, `Promociones`, `Cancelaciones`, `Anulaciones` | Deducciones |
| `VentasNetas{Subtotal,Iva,Total}` | Ventas netas (= brutas − deducciones) |
| `CapturadoEn` | Timestamp de la última captura |

Ejemplos:
```sql
-- Ventas netas de hoy por sucursal
SELECT Sucursal, VentasNetasTotal, CapturadoEn
FROM tblWansoftVentasSucursal
WHERE Fecha = CURDATE()
ORDER BY VentasNetasTotal DESC;

-- Total del día
SELECT Fecha, SUM(VentasNetasTotal) AS TotalDia
FROM tblWansoftVentasSucursal
WHERE Fecha = CURDATE();
```

## Notas
- `Fecha = hoy` se calcula en zona horaria **America/Mexico_City**, así el servidor puede estar en UTC.
- El total del día crece durante el día; el upsert horario mantiene siempre el valor más reciente.
- Si quieres conservar el **histórico intradía** (cómo creció hora a hora) en vez de sobrescribir,
  cámbiate a modo *append* (quitar la llave única y agregar `CapturadoEn` a la PK).
