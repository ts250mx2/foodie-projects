import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { Connection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

export async function POST(request: NextRequest) {
    let connection: Connection | null = null;
    try {
        const body = await request.json();
        const { 
            projectId, 
            ocrType, 
            batchId, 
            selectedProviderId, 
            selectedPaymentChannelId, 
            selectedBranchId, 
            selectedExpenseConceptId,
            ocrResult,
            providerName 
        } = body;

        if (!projectId || !ocrType || !batchId || !selectedProviderId || !selectedPaymentChannelId || !selectedBranchId || !ocrResult) {
            return NextResponse.json({ success: false, message: 'Missing required fields for registration' }, { status: 400 });
        }

        const projectIdInt = parseInt(projectId);
        connection = await getProjectConnection(projectIdInt);

        // Start transaction
        await connection.beginTransaction();

        try {
            // 0. Fetch the first image of the batch for ArchivoDocumento (if gasto)
            console.log('Registering transaction for batchId:', batchId);
            const [batchDetails] = await connection.query<RowDataPacket[]>(
                'SELECT DocumentoOCR FROM tblDetalleDocumentosOCR WHERE IdDocumentoOCR = ? ORDER BY Orden LIMIT 1',
                [batchId]
            );
            const firstImage = batchDetails.length > 0 ? batchDetails[0].DocumentoOCR : null;
            console.log('Found firstImage:', firstImage ? 'Length: ' + firstImage.length : 'NULL');

            const receiptDate = new Date(ocrResult.date);
            const dia = receiptDate.getDate();
            const mes = receiptDate.getMonth() + 1;
            const anio = receiptDate.getFullYear();
            const formattedDate = ocrResult.date; // YYYY-MM-DD
            const compoundConcept = `${providerName} ${formattedDate}`;

            let expenseId: number | null = null;
            let purchaseId: number | null = null;

            if (ocrType === 'gasto') {
                // 1. Insert into tblGastos (Using user's exact mapping + IdSucursal from mandatory UI)
                const [expenseResult] = await connection.query<ResultSetHeader>(
                    `INSERT INTO tblGastos (
                        IdSucursal, IdProveedor, FechaGasto, Dia, Mes, Anio, 
                        IdConceptoGasto, Total, IdCanalPago, ArchivoDocumento, 
                        ConceptoGasto, FechaAct, Status, NumeroFactura
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 0, ?)`,
                    [
                        selectedBranchId, selectedProviderId, formattedDate, dia, mes, anio,
                        selectedExpenseConceptId, ocrResult.total, selectedPaymentChannelId,
                        firstImage, compoundConcept, ocrResult.ticketNumber
                    ]
                );
                expenseId = expenseResult.insertId;

                // 2. Insert Details into tblDetalleGastos
                for (const concept of ocrResult.concepts) {
                    // Create tblDetalleGastos if not exists (defensive)
                    await connection.query(`CREATE TABLE IF NOT EXISTS tblDetalleGastos (
                        IdDetalleGasto INT AUTO_INCREMENT PRIMARY KEY,
                        IdGasto INT,
                        Concepto VARCHAR(255),
                        Cantidad DECIMAL(18,4),
                        Costo DECIMAL(18,4),
                        Status INT,
                        FechaAct DATETIME
                    )`);

                    await connection.query(
                        `INSERT INTO tblDetalleGastos (IdGasto, Concepto, Cantidad, Costo, Status, FechaAct)
                         VALUES (?, ?, ?, ?, 0, NOW())`,
                        [expenseId, concept.description, concept.quantity, concept.price]
                    );
                }
            } else if (ocrType === 'compra') {
                // 1. Insert into tblCompras
                const [purchaseResult] = await connection.query<ResultSetHeader>(
                    `INSERT INTO tblCompras (
                        ConceptoCompra, FechaCompra, IdProveedor, NumeroFactura, 
                        Status, FechaAct, Total, IdCanalPago, IdSucursal,
                        ArchivoDocumento, NombreArchivo
                    ) VALUES (?, ?, ?, ?, 0, NOW(), ?, ?, ?, ?, ?)`,
                    [
                        compoundConcept, formattedDate, selectedProviderId, 
                        ocrResult.ticketNumber.toUpperCase(), ocrResult.total, 
                        selectedPaymentChannelId, selectedBranchId,
                        firstImage, `OCR_Compra_${formattedDate}.jpg`
                    ]
                );
                purchaseId = purchaseResult.insertId;

                // 2. Insert Details into tblDetalleCompras
                for (const concept of ocrResult.concepts) {
                    await connection.query(
                        `INSERT INTO tblDetalleCompras (IdCompra, IdProducto, Producto, Cantidad, Costo, FechaAct, Status)
                         VALUES (?, ?, ?, ?, ?, NOW(), 0)`,
                        [purchaseId, concept.productId, concept.description, concept.quantity, concept.price]
                    );
                }
            }

            // 3. Learning Persistence: Update linkage relationship tables
            // Provider linkage
            await connection.query(`CREATE TABLE IF NOT EXISTS tblRelacionProveedoresOCR (
                IdRelacionProveedorOCR INT AUTO_INCREMENT PRIMARY KEY,
                ProveedorOCR VARCHAR(255),
                IdProveedor INT,
                FechaAct DATETIME,
                Status INT,
                UNIQUE KEY (ProveedorOCR)
            )`);
            
            if (ocrResult.provider) {
                await connection.query(
                    `INSERT INTO tblRelacionProveedoresOCR (ProveedorOCR, IdProveedor, FechaAct, Status)
                     VALUES (?, ?, NOW(), 0)
                     ON DUPLICATE KEY UPDATE IdProveedor = VALUES(IdProveedor), FechaAct = NOW()`,
                    [ocrResult.provider, selectedProviderId]
                );
            }

            // Product linkage (Iterate concepts)
            await connection.query(`CREATE TABLE IF NOT EXISTS tblRelacionProductosOCR (
                IdRelacionProductoOCR INT AUTO_INCREMENT PRIMARY KEY,
                ProductoOCR VARCHAR(255),
                IdProducto INT,
                FechaAct DATETIME,
                Status INT,
                UNIQUE KEY (ProductoOCR)
            )`);

            if (ocrResult.concepts && Array.isArray(ocrResult.concepts)) {
                for (const concept of ocrResult.concepts) {
                    if (concept.productId) {
                        await connection.query(
                            `INSERT INTO tblRelacionProductosOCR (ProductoOCR, IdProducto, FechaAct, Status)
                             VALUES (?, ?, NOW(), 0)
                             ON DUPLICATE KEY UPDATE IdProducto = VALUES(IdProducto), FechaAct = NOW()`,
                            [concept.description, concept.productId]
                        );
                    }
                }
            }

            // 4. Mark OCR Batch as Processed and Link to the new transaction
            const linkField = ocrType === 'compra' ? 'IdCompra' : 'IdGasto';
            const transactionId = ocrType === 'compra' ? (purchaseId as any) : (expenseId as any);
            
            await connection.query(
                `UPDATE tblDocumentosOCR SET Status = 1, ${linkField} = ?, FechaAct = NOW() WHERE IdDocumentoOCR = ?`,
                [transactionId, batchId]
            );

            await connection.commit();

            return NextResponse.json({
                success: true,
                message: `${ocrType === 'compra' ? 'Compra' : 'Gasto'} registrada exitosamente`
            });

        } catch (error: any) {
            await connection.rollback();
            throw error;
        }
    } catch (error: any) {
        console.error('Error in register-transaction:', error);
        return NextResponse.json({ success: false, message: 'Error al registrar transacción: ' + error.message }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
