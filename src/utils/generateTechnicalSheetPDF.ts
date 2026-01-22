import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface ProductData {
    Producto: string;
    Categoria: string;
    Presentacion: string;
    Precio: number;
    IVA: number;
    RutaFoto?: string;
    IdTipoProducto?: number;
}

export interface KitItem {
    Codigo: string;
    Producto: string;
    Categoria: string; // Product Category
    CategoriaRecetario?: string; // Recipe Category (for grouping)
    Presentacion: string;
    Cantidad: number;
    Precio: number;
    PresentacionInventario?: string;
    PesoFinal?: number;
    ConversionSimple?: number;
    PrecioProcesado?: number;
    Total?: number;
}

export interface Instruction {
    NumeroPaso: number;
    Instrucciones: string;
    RutaArchivo: string | null;
}

export interface Document {
    Descripcion: string;
    RutaArchivo: string | null;
}

export interface CostingHeaderData {
    // Shared
    unidadCompra?: string;
    precio?: number; // Precio Unidad Compra / Precio
    categoriaRecetario?: string;
    conversionSimple?: number;
    unidadInventario?: string;
    pesoInicial?: number;
    pesoFinal?: number; // Yield / Rendimiento

    // Raw Material specific
    rendimientoPercent?: number;
    mermaPercent?: number;
    precioUnitarioCompraNeto?: number;
    precioProcesado?: number;

    // Sub-recipe specific
    formulaCostoUnidad?: number;

    // Totals
    totalCost?: number;
}

export async function generateTechnicalSheetPDF(
    product: ProductData,
    kitItems: KitItem[],
    instructions: Instruction[],
    documents: Document[],
    costingData?: CostingHeaderData
) {
    const doc = new jsPDF();
    let yPosition = 20;

    // Title
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('FICHA TÉCNICA', doc.internal.pageSize.getWidth() / 2, yPosition, { align: 'center' });
    yPosition += 15;

    // Product Name
    doc.setFontSize(16);
    doc.text(product.Producto, doc.internal.pageSize.getWidth() / 2, yPosition, { align: 'center' });
    yPosition += 15;

    // Product Photo
    if (product.RutaFoto) {
        try {
            const img = await loadImage(product.RutaFoto);
            const imgWidth = 80;
            const imgHeight = 60;
            const xPosition = (doc.internal.pageSize.getWidth() - imgWidth) / 2;
            doc.addImage(img, 'JPEG', xPosition, yPosition, imgWidth, imgHeight);
            yPosition += imgHeight + 10;
        } catch (error) {
            console.error('Error loading product photo:', error);
        }
    }

    // Product Details
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Categoría: ${product.Categoria}`, 20, yPosition);
    yPosition += 7;
    doc.text(`Presentación: ${product.Presentacion}`, 20, yPosition);
    yPosition += 7;
    doc.text(`Precio: $${product.Precio.toFixed(2)}`, 20, yPosition);
    yPosition += 7;
    doc.text(`IVA: ${product.IVA}%`, 20, yPosition);
    yPosition += 15;

    // Costing Section
    if (kitItems.length > 0 || costingData) {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('COSTEO', 20, yPosition);
        yPosition += 10;

        // --- Info Boxes (Tax, Cost/Price) ---
        // Always show these if we have Costing Data or Kit Items (assuming totals are calculable)
        const totalCost = costingData?.totalCost ?? kitItems.reduce((sum, item) => sum + ((item.Total ?? (item.Cantidad * item.Precio))), 0);
        const taxAmount = product.Precio * (product.IVA / 100);
        const costPriceWithIVA = product.Precio > 0 ? (totalCost / product.Precio) * 100 : 0;
        const priceWithoutIVA = product.Precio - taxAmount;
        const costPriceWithoutIVA = priceWithoutIVA > 0 ? (totalCost / priceWithoutIVA) * 100 : 0;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        const boxWidth = 55;
        const boxHeight = 12;
        let xPos = 20;

        // Box 1: Tax
        doc.setFillColor(255, 140, 0); // Orange
        doc.rect(xPos, yPosition, boxWidth, boxHeight, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.text('% Impuesto', xPos + 2, yPosition + 4);
        doc.setFont('helvetica', 'normal');
        doc.text(`${product.IVA}% = $${taxAmount.toFixed(2)}`, xPos + 2, yPosition + 9);

        // Box 2: Cost/Price with IVA
        xPos += boxWidth + 5;
        doc.rect(xPos, yPosition, boxWidth, boxHeight, 'F');
        doc.setFont('helvetica', 'bold');
        doc.text('% Costo/Precio con IVA', xPos + 2, yPosition + 4);
        doc.setFont('helvetica', 'normal');
        doc.text(`${costPriceWithIVA.toFixed(2)}%`, xPos + 2, yPosition + 9);

        // Box 3: Net Cost/Price without IVA
        xPos += boxWidth + 5;
        doc.rect(xPos, yPosition, boxWidth, boxHeight, 'F');
        doc.setFont('helvetica', 'bold');
        doc.text('% Costo Neto/Precio (Sin IVA)', xPos + 2, yPosition + 4);
        doc.setFont('helvetica', 'normal');
        doc.text(`${costPriceWithoutIVA.toFixed(2)}%`, xPos + 2, yPosition + 9);

        doc.setTextColor(0, 0, 0);
        yPosition += boxHeight + 10;

        // --- Custom Header Fields per Product Type ---
        if (costingData && (product.IdTipoProducto === 0 || product.IdTipoProducto === 2)) {
            // Raw Material (0) or Sub-recipe (2)
            doc.setFontSize(9);
            const col1X = 20;
            const col2X = 110;
            const rowHeight = 6;

            // Row 1
            doc.setFont('helvetica', 'bold');
            doc.text('Unidad de Compra:', col1X, yPosition);
            doc.setFont('helvetica', 'normal');
            doc.text(costingData.unidadCompra || '-', col1X + 35, yPosition);

            doc.setFont('helvetica', 'bold');
            doc.text(product.IdTipoProducto === 0 ? 'Precio Unidad Compra:' : 'Precio:', col2X, yPosition);
            doc.setFont('helvetica', 'normal');
            doc.text(`$${(costingData.precio || 0).toFixed(2)}`, col2X + 40, yPosition);
            yPosition += rowHeight;

            // Row 2
            doc.setFont('helvetica', 'bold');
            doc.text('Categoría Recetario:', col1X, yPosition);
            doc.setFont('helvetica', 'normal');
            doc.text(costingData.categoriaRecetario || 'Sin Categoría', col1X + 35, yPosition);
            yPosition += rowHeight;

            // Row 3
            doc.setFont('helvetica', 'bold');
            doc.text('Contenido:', col1X, yPosition);
            doc.setFont('helvetica', 'normal');
            doc.text((costingData.conversionSimple || 1).toString(), col1X + 35, yPosition);

            doc.setFont('helvetica', 'bold');
            doc.text('Unidad de Inventario:', col2X, yPosition);
            doc.setFont('helvetica', 'normal');
            doc.text(costingData.unidadInventario || '(Igual a Compra)', col2X + 40, yPosition);
            yPosition += rowHeight;

            // Row 4
            doc.setFont('helvetica', 'bold');
            doc.text('Peso Inicial:', col1X, yPosition);
            doc.setFont('helvetica', 'normal');
            doc.text((costingData.pesoInicial || 0).toString(), col1X + 35, yPosition);

            doc.setFont('helvetica', 'bold');
            doc.text(product.IdTipoProducto === 0 ? 'Peso Final:' : 'Rendimiento (PesoFinal):', col2X, yPosition);
            doc.setFont('helvetica', 'normal');
            doc.text((costingData.pesoFinal || 0).toString(), col2X + 40, yPosition);
            yPosition += rowHeight + 5;

            // Specific Boxes Logic
            if (product.IdTipoProducto === 0) {
                // Raw Material Boxes (Yield, Merma, PU Neto, Precio Proc)
                const smBoxWidth = 40;
                let smX = 20;

                // Box A: Yield
                doc.setFillColor(245, 245, 245); // Light Gray
                doc.rect(smX, yPosition, smBoxWidth, 14, 'F');
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(100, 100, 100);
                doc.text('% RENDIMIENTO', smX + 2, yPosition + 5);
                doc.setTextColor(0, 0, 0);
                doc.setFontSize(11);
                doc.text(`${(costingData.rendimientoPercent || 0).toFixed(2)}%`, smX + 2, yPosition + 11);

                // Box B: Merma
                smX += smBoxWidth + 5;
                doc.setFillColor(245, 245, 245);
                doc.rect(smX, yPosition, smBoxWidth, 14, 'F');
                doc.setFontSize(9);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(100, 100, 100);
                doc.text('% MERMA', smX + 2, yPosition + 5);
                doc.setTextColor(220, 38, 38); // Red
                doc.setFontSize(11);
                doc.text(`${(costingData.mermaPercent || 0).toFixed(2)}%`, smX + 2, yPosition + 11);

                // Box C: PU Neto
                smX += smBoxWidth + 5;
                doc.setFillColor(245, 245, 245);
                doc.rect(smX, yPosition, smBoxWidth, 14, 'F');
                doc.setFontSize(9);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(100, 100, 100);
                doc.text('P/U COMPRA NETO', smX + 2, yPosition + 5);
                doc.setTextColor(37, 99, 235); // Blue
                doc.setFontSize(11);
                doc.text(`$${(costingData.precioUnitarioCompraNeto || 0).toFixed(2)}`, smX + 2, yPosition + 11);

                // Box D: Precio Procesado
                smX += smBoxWidth + 5;
                doc.setFillColor(245, 245, 245);
                doc.rect(smX, yPosition, smBoxWidth, 14, 'F');
                doc.setFontSize(9);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(100, 100, 100);
                doc.text('PRECIO PROCESADO', smX + 2, yPosition + 5);
                doc.setTextColor(234, 88, 12); // Orange
                doc.setFontSize(11);
                doc.text(`$${(costingData.precioProcesado || 0).toFixed(2)}`, smX + 2, yPosition + 11);

                yPosition += 20;

            } else if (product.IdTipoProducto === 2) {
                // Sub-recipe Box (Formula Costo/Unidad)
                doc.setFillColor(239, 246, 255); // Blue 50
                doc.rect(20, yPosition, 60, 14, 'F');
                doc.setDrawColor(219, 234, 254); // Blue 100
                doc.rect(20, yPosition, 60, 14, 'D'); // Border

                doc.setFontSize(9);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(37, 99, 235); // Blue 600
                doc.text('FORMULA COSTO/UNIDAD', 22, yPosition + 5);

                doc.setFontSize(12);
                doc.setTextColor(30, 64, 175); // Blue 800
                doc.text(`$${(costingData.formulaCostoUnidad || 0).toFixed(2)}`, 22, yPosition + 11);

                doc.setTextColor(0, 0, 0);
                yPosition += 20;
            } else {
                yPosition += 5;
            }
        }

        doc.setTextColor(0, 0, 0);

        // --- Grid ---
        if (kitItems.length > 0) {
            // Group items by Recipe Category
            const groupedItems: { [key: string]: KitItem[] } = {};
            kitItems.forEach(item => {
                const cat = item.CategoriaRecetario || 'Sin Categoría de Recetario';
                if (!groupedItems[cat]) {
                    groupedItems[cat] = [];
                }
                groupedItems[cat].push(item);
            });

            // Create table data
            const tableData: any[] = [];

            // Sort categories alphabetically
            const sortedCategories = Object.keys(groupedItems).sort();

            sortedCategories.forEach(categoria => {
                const items = groupedItems[categoria];

                // Add category subtotal row (Header style)
                const categoryTotal = items.reduce((sum, item) => sum + (item.Total ?? (item.Cantidad * item.Precio)), 0);

                tableData.push([
                    { content: categoria, colSpan: 5, styles: { fontStyle: 'bold', fillColor: [240, 240, 240], textColor: [153, 66, 13] } }, // Category Header
                    { content: `$${categoryTotal.toFixed(2)}`, styles: { fontStyle: 'bold', fillColor: [240, 240, 240], textColor: [0, 0, 0] } }
                ]);

                // Add Items
                items.forEach(item => {
                    tableData.push([
                        item.Codigo,
                        item.Producto,
                        item.Cantidad.toString(),
                        item.PresentacionInventario || '-',
                        `$${(item.PrecioProcesado || 0).toFixed(2)}`,
                        `$${(item.Total || 0).toFixed(2)}`
                    ]);
                });
            });

            autoTable(doc, {
                startY: yPosition,
                head: [['Código', 'Producto', 'Cantidad', 'Pres. Inv.', 'Precio Proc.', 'Total']],
                body: tableData,
                foot: [['', '', '', '', 'Total General:', `$${totalCost.toFixed(2)}`]],
                theme: 'grid',
                headStyles: { fillColor: [255, 140, 0] },
                footStyles: { fillColor: [255, 140, 0], fontStyle: 'bold', textColor: [255, 255, 255] },
                styles: { fontSize: 8 },
                columnStyles: {
                    0: { cellWidth: 25 }, // Codigo
                    1: { cellWidth: 'auto' }, // Producto
                    2: { cellWidth: 20, halign: 'center' }, // Cantidad
                    3: { cellWidth: 25 }, // Pres Inv
                    4: { cellWidth: 25, halign: 'right' }, // Precio Proc
                    5: { cellWidth: 25, halign: 'right' }  // Total
                }
            });

            yPosition = (doc as any).lastAutoTable.finalY + 15;
        }
    }

    // Instructions Section (unchanged logic)
    if (instructions.length > 0) {
        // ... existing code logic
        if (yPosition > 250) { doc.addPage(); yPosition = 20; }
        doc.setFontSize(14); doc.setFont('helvetica', 'bold');
        doc.text('INSTRUCCIONES', 20, yPosition); yPosition += 10;

        for (const instruction of instructions) {
            if (yPosition > 270) { doc.addPage(); yPosition = 20; }
            doc.setFontSize(10); doc.setFont('helvetica', 'bold');
            doc.text(`Paso ${instruction.NumeroPaso}:`, 20, yPosition); yPosition += 6;
            doc.setFont('helvetica', 'normal');
            const lines = doc.splitTextToSize(instruction.Instrucciones, 170);
            doc.text(lines, 20, yPosition);
            yPosition += lines.length * 5 + 5;

            if (instruction.RutaArchivo) {
                // Simplified image logic for brevity in replace
                const isImage = /\.(jpg|jpeg|png|gif|bmp)$/i.test(instruction.RutaArchivo);
                if (isImage) {
                    try {
                        const img = await loadImage(instruction.RutaArchivo);
                        const imgH = 45;
                        if (yPosition + imgH > 280) { doc.addPage(); yPosition = 20; }
                        doc.addImage(img, 'JPEG', 20, yPosition, 60, imgH);
                        yPosition += imgH + 5;
                    } catch (e) { /* ignore */ }
                } else {
                    doc.setFont('helvetica', 'italic');
                    doc.text(`Archivo: ${instruction.RutaArchivo}`, 20, yPosition);
                    yPosition += 5;
                }
            }
            yPosition += 5;
        }
        yPosition += 10;
    }

    // Support Documents Section
    if (documents.length > 0) {
        if (yPosition > 250) { doc.addPage(); yPosition = 20; }
        doc.setFontSize(14); doc.setFont('helvetica', 'bold');
        doc.text('OBSERVACIONES / PUNTOS CRÍTICOS', 20, yPosition); yPosition += 10;

        for (const docItem of documents) {
            if (yPosition > 260) { doc.addPage(); yPosition = 20; }
            doc.setFontSize(10); doc.setFont('helvetica', 'bold');
            doc.text('Descripción:', 20, yPosition); yPosition += 6;
            doc.setFont('helvetica', 'normal');
            const lines = doc.splitTextToSize(docItem.Descripcion, 170);
            doc.text(lines, 20, yPosition);
            yPosition += lines.length * 5 + 5;
            if (docItem.RutaArchivo) {
                const isImage = /\.(jpg|jpeg|png|gif|bmp)$/i.test(docItem.RutaArchivo);
                if (isImage) {
                    try {
                        const img = await loadImage(docItem.RutaArchivo);
                        const imgH = 45;
                        if (yPosition + imgH > 280) { doc.addPage(); yPosition = 20; }
                        doc.addImage(img, 'JPEG', 20, yPosition, 60, imgH);
                        yPosition += imgH + 5;
                    } catch (e) { /* ignore */ }
                } else {
                    doc.setFont('helvetica', 'italic');
                    doc.text(`Archivo: ${docItem.RutaArchivo}`, 20, yPosition);
                    yPosition += 5;
                }
            }
            yPosition += 10;
        }
    }

    // Save PDF
    doc.save(`Ficha_Tecnica_${product.Producto.replace(/\s+/g, '_')}.pdf`);
}

// Helper function to load images
function loadImage(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(img, 0, 0);
                resolve(canvas.toDataURL('image/jpeg'));
            } else {
                reject(new Error('Could not get canvas context'));
            }
        };
        img.onerror = reject;
        img.src = url;
    });
}
