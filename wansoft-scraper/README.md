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
| `scrape.mjs` | Una corrida del **resumen consolidado**: login → ventas del día por sucursal → upsert en BD. |
| `scrape-all.mjs` | **Producción (completo).** Resumen consolidado **+ los 21 reportes** de Wansoft, una tabla por reporte. Lo dispara el cron y el botón "Sincronizar ahora" del dashboard. |
| `scheduler.mjs` | Loop en proceso que llama a `scrape.mjs` cada hora (alternativa al cron). |
| `auth.mjs` | Login reusable en Wansoft (Playwright). |
| `report.mjs` | Lista de sucursales + llamada a `GetConsolidatedSales`. |
| `reports-registry.mjs` | **Fuente única de verdad:** define los 21 reportes (endpoint, tabla, tipo, columnas). |
| `parse.mjs` | Parsers genéricos de los fragmentos HTML (rowReport / twoCard / Highcharts). |
| `fetch-reports.mjs` | Pide cada reporte por su endpoint AJAX y lo parsea a filas. |
| `reports-db.mjs` | Crea una tabla por reporte y refresca el día por `(Fecha, IdSucursal)` (delete+insert). |
| `db.mjs` | Crea la tabla del consolidado (idempotente) y hace upsert por `(Fecha, IdSucursal)`. |
| `dev/` | Helpers de desarrollo: extracción de fixtures y `test-parsers.mjs` (test offline de parsers). |
| `explore*.mjs`, `test-*.mjs`, `verify-dates.mjs` | Helpers de desarrollo/diagnóstico (no necesarios en producción). |

## Todos los reportes (`scrape-all.mjs`)
Además del resumen consolidado, trae los 21 reportes de **Reportes → Ingresos** (Ventas por
forma de pago, por grupo, por tipo de grupo, por zona, por tipo de orden, por hora, por usuario,
por terminal, por modificador, por platillo, propinas, promociones, personas por hora/fecha/día,
cobros por forma de pago, cancelaciones, cortesías, descuentos, anulaciones y megapuntos).

Cada reporte se guarda en su propia tabla `tblWansoft<Reporte>` (ver `reports-registry.mjs`).
Para agregar/ajustar un reporte basta con editar el registry. Los parsers están verificados
offline contra HTML real del portal:
```bash
npm run test-parsers
```

Uso:
```bash
node scrape-all.mjs                       # hoy, todos los reportes, todas las sucursales
node scrape-all.mjs --dry                 # imprime resumen, no toca la BD
node scrape-all.mjs --branch=123          # una sola sucursal
node scrape-all.mjs --only=SalesByGroup,SalesByUser
DATE=2026-06-22 node scrape-all.mjs       # fecha específica
```
La corrida imprime una línea `SUMMARY {json}` que el API web (`/api/config/pos-connection/sync`)
lee para registrar la bitácora.

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
# minuto 0 de cada hora — TODOS los reportes
0 * * * * cd /ruta/wansoft-scraper && /usr/bin/node scrape-all.mjs >> scrape.log 2>&1
```
> Para sólo el resumen consolidado usa `scrape.mjs` en vez de `scrape-all.mjs`.

**Botón "Sincronizar ahora" (dashboard):** el API `/api/config/pos-connection/sync` lanza
`scrape-all.mjs` como proceso hijo usando las credenciales de Wansoft guardadas en `tblPOSConfig`
y la BD del proyecto. Requiere que el servidor de la app tenga este folder con sus dependencias
(`npm install`) y el navegador de Playwright instalado (`npx playwright install chromium`).

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
