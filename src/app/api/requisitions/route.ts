import { NextRequest, NextResponse } from 'next/server';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import bcrypt from 'bcryptjs';
import { getProjectConnection } from '@/lib/dynamic-db';
import { OC_STATUS_PHANTOM } from '@/lib/warehouse';
import {
    MAX_AREA_LEN,
    MAX_NOTAS_LEN,
    MAX_REQUISITION_ITEMS,
    MAX_REQUISITION_QTY,
    MAX_SOLICITANTE_LEN,
    recordRequisitionStatusChange,
    resolveRequisitionProvider,
    resolveRequisitionUuid,
    sanitizeText,
} from '@/lib/requisitions';

interface IncomingItem {
    idProducto: number;
    cantidad: number;
    unidadMedida?: string | null;
}

/**
 * Crea una requisición desde la tablet de cocina.
 *
 * ENDPOINT SIN AUTENTICACIÓN. Reglas que lo sostienen:
 *  - el proyecto sale del UUID, jamás de un projectId mandado por el cliente;
 *  - los precios se leen de la base, nunca del cuerpo del request;
 *  - no se escribe en tblProductos ni en tblProveedoresProductos, así que una
 *    requisición no puede mover los precios del catálogo (a diferencia de una
 *    orden de compra normal, que sí actualiza el último precio del proveedor);
 *  - la orden nace Creada (Status 4, FechaAplicacion NULL): SIN SURTIR.
 */
export async function POST(request: NextRequest) {
    let connection;
    try {
        const body = await request.json();
        const { uuid, idSucursal, solicitante, area, idPerfil, pin, notas, items } = body ?? {};

        const project = await resolveRequisitionUuid(typeof uuid === 'string' ? uuid : '');
        if (!project) {
            return NextResponse.json({ success: false, message: 'Liga no válida' }, { status: 404 });
        }

        const cleanSolicitante = sanitizeText(solicitante, MAX_SOLICITANTE_LEN);
        if (!cleanSolicitante) {
            return NextResponse.json({ success: false, message: 'Indica quién solicita' }, { status: 400 });
        }

        const branchId = Number(idSucursal);
        if (!Number.isInteger(branchId) || branchId <= 0) {
            return NextResponse.json({ success: false, message: 'Selecciona una sucursal' }, { status: 400 });
        }

        if (!Array.isArray(items) || items.length === 0) {
            return NextResponse.json({ success: false, message: 'Agrega al menos un producto' }, { status: 400 });
        }
        if (items.length > MAX_REQUISITION_ITEMS) {
            return NextResponse.json(
                { success: false, message: `Máximo ${MAX_REQUISITION_ITEMS} productos por requisición` },
                { status: 400 }
            );
        }

        // Consolida por producto: si la tablet manda el mismo insumo dos veces
        // se suman las cantidades en lugar de crear renglones duplicados.
        const quantities = new Map<number, number>();
        const units = new Map<number, string | null>();
        for (const raw of items as IncomingItem[]) {
            const id = Number(raw?.idProducto);
            const qty = Number(raw?.cantidad);
            if (!Number.isInteger(id) || id <= 0) {
                return NextResponse.json({ success: false, message: 'Producto no válido' }, { status: 400 });
            }
            if (!Number.isFinite(qty) || qty <= 0 || qty > MAX_REQUISITION_QTY) {
                return NextResponse.json({ success: false, message: 'Cantidad no válida' }, { status: 400 });
            }
            quantities.set(id, (quantities.get(id) ?? 0) + qty);
            units.set(id, sanitizeText(raw?.unidadMedida, 45));
        }

        const productIds = [...quantities.keys()];
        connection = await getProjectConnection(project.idProyecto);

        // El PIN se revalida aquí, no solo en la pantalla de la tablet: si solo
        // se comprobara allá, bastaría con llamar a este endpoint directamente
        // para firmar un pedido a nombre de cualquier área.
        if (idPerfil) {
            // El perfil tiene que ser DE ESA sucursal: si no, el PIN de la
            // cocina de una sucursal serviría para firmar en cualquier otra.
            const [profileRows] = await connection.query(
                'SELECT Perfil, PinHash FROM tblRequisicionPerfiles WHERE IdPerfil = ? AND IdSucursal = ?',
                [Number(idPerfil), branchId]
            );
            const profile = (profileRows as RowDataPacket[])[0];
            if (!profile) {
                return NextResponse.json({ success: false, message: 'Perfil no válido para esa sucursal' }, { status: 400 });
            }
            if (profile.PinHash) {
                const ok = typeof pin === 'string' && await bcrypt.compare(pin, profile.PinHash);
                if (!ok) {
                    return NextResponse.json({ success: false, message: 'PIN incorrecto' }, { status: 401 });
                }
            }
        }

        const [branchRowsRaw] = await connection.query(
            'SELECT IdSucursal FROM tblSucursales WHERE IdSucursal = ? AND Status = 0',
            [branchId]
        );
        if ((branchRowsRaw as RowDataPacket[]).length === 0) {
            return NextResponse.json({ success: false, message: 'Sucursal no válida' }, { status: 400 });
        }

        // Los productos se revalidan contra la base: activos y de tipo insumo.
        // El costo sale de aquí, no del cliente.
        const placeholders = productIds.map(() => '?').join(',');
        const [productRowsRaw] = await connection.query(
            `SELECT
                p.IdProducto,
                COALESCE(NULLIF(p.UnidadMedidaInventario, ''), NULLIF(p.UnidadMedidaCompra, ''), 'PZA') AS Unidad,
                COALESCE(v.Costo, p.Precio, 0) AS CostoReferencia
             FROM tblProductos p
             LEFT JOIN vlProductos v ON p.IdProducto = v.IdProducto
             WHERE p.IdProducto IN (${placeholders}) AND p.Status = 0 AND p.IdTipoProducto = 0`,
            productIds
        );
        const productRows = productRowsRaw as RowDataPacket[];

        if (productRows.length !== productIds.length) {
            return NextResponse.json(
                { success: false, message: 'Algún producto ya no está disponible. Actualiza la página.' },
                { status: 409 }
            );
        }

        const notasLibres = sanitizeText(notas, MAX_NOTAS_LEN);
        const cleanArea = sanitizeText(area, MAX_AREA_LEN);
        // Marcador legible para la UI actual de Órdenes de Compra, que muestra Notas.
        const notasOrden = [
            '[Requisición]',
            cleanArea ? `${cleanArea} ·` : null,
            cleanSolicitante,
            notasLibres ? `— ${notasLibres}` : null,
        ].filter(Boolean).join(' ');

        await connection.beginTransaction();
        try {
            const idProveedor = await resolveRequisitionProvider(connection);

            const [result] = await connection.query(
                `INSERT INTO tblOrdenesCompra
                    (IdProveedor, IdSucursal, EsInterna, EsSalida, FechaOrden, Status, Notas,
                     EsRequisicion, RequisicionSolicitante, RequisicionArea, FechaRequisicionVista, FechaAct)
                 VALUES (?, ?, 1, 0, Now(), ?, ?, 1, ?, ?, NULL, Now())`,
                [idProveedor, branchId, OC_STATUS_PHANTOM, notasOrden, cleanSolicitante, cleanArea]
            );
            const idOrdenCompra = (result as ResultSetHeader).insertId;

            for (const row of productRows) {
                const cantidad = quantities.get(row.IdProducto)!;
                const costo = Number(row.CostoReferencia) || 0;
                await connection.query(
                    `INSERT INTO tblOrdenesCompraDetalle
                        (IdOrdenCompra, IdProducto, Cantidad, PrecioUnitario, Total, UnidadMedidaPedido, FechaAct)
                     VALUES (?, ?, ?, ?, ?, ?, Now())`,
                    [idOrdenCompra, row.IdProducto, cantidad, costo, cantidad * costo, units.get(row.IdProducto) || row.Unidad]
                );
            }

            // Primer renglón del track de estados: quién la levantó y cuándo.
            await recordRequisitionStatusChange(connection, {
                idOrdenCompra,
                statusAnterior: null,
                statusNuevo: OC_STATUS_PHANTOM,
                usuario: cleanSolicitante,
            });

            await connection.commit();

            return NextResponse.json({
                success: true,
                folio: idOrdenCompra,
                renglones: productRows.length,
                message: 'Requisición enviada',
            });
        } catch (e) {
            await connection.rollback();
            throw e;
        }
    } catch (error) {
        console.error('Error creating requisition:', error);
        return NextResponse.json({ success: false, message: 'No se pudo enviar la requisición' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
