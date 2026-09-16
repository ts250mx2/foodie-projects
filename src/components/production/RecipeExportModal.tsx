'use client';

import { useState } from 'react';
import { FileSpreadsheet, FileText, List, ListTree } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable, { RowInput } from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import BaseModal from '@/components/BaseModal';

/**
 * Exportación de platillos y subrecetas a Excel o PDF.
 *
 * Dos decisiones independientes: el formato y qué tanto se exporta. "Solo los
 * registros" saca la tabla tal como se ve en pantalla; "con detalle" agrega los
 * ingredientes de cada receta, que se piden en una sola consulta al abrir la
 * descarga y no al cargar la página — en un recetario grande son miles de
 * renglones que casi nunca se ocupan.
 *
 * Se exporta lo que el usuario tiene filtrado en pantalla, no el catálogo
 * entero: si buscó "ceviche", eso es lo que espera que salga.
 */

/** Renglón de la tabla, con los campos de ambas pantallas. */
export interface RecipeExportRow {
    IdProducto: number;
    Producto: string;
    Codigo?: string;
    Categoria?: string;
    SeccionMenu?: string;
    Presentacion?: string;
    Costo?: number;
    Precio?: number;
    IVA?: number;
    PorcentajeCostoIdeal?: number;
    PorcentajeCostoSinIva?: number;
    AlertaCostoSinIva?: number;
}

/** Ingrediente devuelto por /api/production/recipe-export. */
interface DetailRow {
    idProductoPadre: number;
    idProducto: number;
    producto: string;
    codigo: string;
    cantidad: number;
    unidad: string;
    costo: number;
    total: number;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    projectId: number;
    /** 1 = platillos, 2 = subrecetas. Define columnas, título y archivo. */
    tipo: 1 | 2;
    /** Los renglones YA filtrados y ordenados como se ven en pantalla. */
    rows: RecipeExportRow[];
    projectName?: string;
}

type Formato = 'excel' | 'pdf';
type Alcance = 'registros' | 'detalle';

const money = (n: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'USD' }).format(Number(n) || 0);
const qty = (n: number) =>
    new Intl.NumberFormat('es-MX', { maximumFractionDigits: 4 }).format(Number(n) || 0);
const pct = (n: number) => `${(Number(n) || 0).toFixed(2)}%`;

type OpcionProps = {
    activa: boolean;
    onClick: () => void;
    icon: React.ElementType;
    titulo: string;
    detalle: string;
};

/** Tarjeta seleccionable. Vive fuera del modal para que React no la remonte. */
function Opcion({ activa, onClick, icon: Icon, titulo, detalle }: OpcionProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`flex-1 min-w-0 text-left rounded-lg border p-3 transition-colors ${activa ? 'border-violet-300 bg-violet-50' : 'border-gray-200 bg-white hover:bg-gray-50'
                }`}
        >
            <span className="flex items-center gap-2">
                <Icon size={16} style={{ color: activa ? '#7C3AED' : '#6B7280' }} />
                <span className="text-sm font-bold" style={{ color: activa ? '#5B21B6' : '#1F2937' }}>{titulo}</span>
            </span>
            <span className="block text-[11px] mt-1 leading-snug" style={{ color: '#6B7280' }}>{detalle}</span>
        </button>
    );
}

export default function RecipeExportModal({
    isOpen, onClose, projectId, tipo, rows, projectName,
}: Props) {
    const [formato, setFormato] = useState<Formato>('excel');
    const [alcance, setAlcance] = useState<Alcance>('registros');
    const [isExporting, setIsExporting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const esPlatillo = tipo === 1;
    const titulo = esPlatillo ? 'Platillos' : 'Subrecetas';
    const archivo = `${titulo}_${new Date().toISOString().slice(0, 10)}`;

    /** Ingredientes agrupados por receta, solo de lo que está en pantalla. */
    const cargarDetalle = async (): Promise<Map<number, DetailRow[]>> => {
        const res = await fetch(`/api/production/recipe-export?projectId=${projectId}&tipoProducto=${tipo}`);
        const data = await res.json();
        if (!data.success) throw new Error(data.message || 'No se pudo cargar el detalle.');

        const visibles = new Set(rows.map(r => r.IdProducto));
        const map = new Map<number, DetailRow[]>();
        for (const item of data.data as DetailRow[]) {
            if (!visibles.has(item.idProductoPadre)) continue;
            const lista = map.get(item.idProductoPadre) || [];
            lista.push(item);
            map.set(item.idProductoPadre, lista);
        }
        return map;
    };

    /** Columnas de la receta, sin ingredientes. Es la tabla de la pantalla. */
    const registroBase = (row: RecipeExportRow) => esPlatillo
        ? {
            Producto: row.Producto,
            'Código': row.Codigo || '',
            'Categoría': row.Categoria || '',
            'Sección': row.SeccionMenu || '',
            Precio: Number(row.Precio) || 0,
            'IVA %': Number(row.IVA) || 0,
            Costo: Number(row.Costo) || 0,
            '% Costo Ideal': Number(row.PorcentajeCostoIdeal) || 0,
            '% Costo Real s/IVA': Number(row.PorcentajeCostoSinIva) || 0,
            Alerta: row.AlertaCostoSinIva === 1 ? 'EXCEDE' : '',
        }
        : {
            Producto: row.Producto,
            'Código': row.Codigo || '',
            'Categoría': row.Categoria || '',
            'Presentación': row.Presentacion || '',
            Costo: Number(row.Costo) || 0,
        };

    const exportarExcel = async () => {
        const wb = XLSX.utils.book_new();

        if (alcance === 'registros') {
            const ws = XLSX.utils.json_to_sheet(rows.map(registroBase));
            XLSX.utils.book_append_sheet(wb, ws, titulo);
        } else {
            const detalle = await cargarDetalle();
            // Tabla plana: las columnas de la receta se repiten en cada
            // ingrediente. Es lo que sirve para filtrar y hacer tablas
            // dinámicas en Excel; el PDF sí va agrupado.
            const planas: Record<string, unknown>[] = [];
            for (const row of rows) {
                const base = registroBase(row);
                const items = detalle.get(row.IdProducto) || [];
                if (items.length === 0) {
                    // Una receta sin ingredientes no se desaparece del reporte:
                    // que esté vacía suele ser justo lo que hay que revisar.
                    planas.push({ ...base, Ingrediente: '(sin ingredientes capturados)' });
                    continue;
                }
                for (const item of items) {
                    planas.push({
                        ...base,
                        Ingrediente: item.producto,
                        'Código Ingrediente': item.codigo,
                        Cantidad: item.cantidad,
                        Unidad: item.unidad,
                        'Costo Unitario': item.costo,
                        'Costo Renglón': item.total,
                    });
                }
            }
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(planas), 'Detalle');
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.map(registroBase)), titulo);
        }

        XLSX.writeFile(wb, `${archivo}.xlsx`);
    };

    const exportarPDF = async () => {
        // Apaisado cuando hay muchas columnas: platillos trae diez y el detalle
        // agrega las del ingrediente.
        const horizontal = esPlatillo || alcance === 'detalle';
        const doc = new jsPDF({ orientation: horizontal ? 'landscape' : 'portrait' });
        const ancho = horizontal ? 297 : 210;
        const centro = ancho / 2;

        doc.setFontSize(16);
        doc.setTextColor(0, 0, 0);
        doc.text(titulo.toUpperCase(), centro, 15, { align: 'center' });

        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);
        if (projectName) doc.text(`Proyecto: ${projectName}`, 15, 23);
        doc.text(
            alcance === 'detalle' ? 'Con detalle de ingredientes' : 'Listado de registros',
            15, 28
        );
        doc.text(`Generado: ${new Date().toLocaleString('es-MX')}`, ancho - 15, 23, { align: 'right' });

        if (alcance === 'registros') {
            const head = esPlatillo
                ? [['Producto', 'Código', 'Categoría', 'Sección', 'Precio', 'IVA', 'Costo', '% Ideal', '% Costo s/IVA', '']]
                : [['Producto', 'Código', 'Categoría', 'Presentación', 'Costo']];

            const body = rows.map(row => esPlatillo
                ? [
                    row.Producto,
                    row.Codigo || '',
                    row.Categoria || '',
                    row.SeccionMenu || '',
                    money(row.Precio || 0),
                    `${Number(row.IVA) || 0}%`,
                    money(row.Costo || 0),
                    pct(row.PorcentajeCostoIdeal || 0),
                    pct(row.PorcentajeCostoSinIva || 0),
                    row.AlertaCostoSinIva === 1 ? '!' : '',
                ]
                : [
                    row.Producto,
                    row.Codigo || '',
                    row.Categoria || '',
                    row.Presentacion || '',
                    money(row.Costo || 0),
                ]
            );

            autoTable(doc, {
                startY: 33,
                head,
                body,
                theme: 'striped',
                headStyles: { fillColor: [13, 148, 136] },
                styles: { fontSize: 8, cellPadding: 1.5 },
                columnStyles: esPlatillo
                    ? { 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' }, 8: { halign: 'right' }, 9: { halign: 'center' } }
                    : { 4: { halign: 'right' } },
                didParseCell: (data) => {
                    // El platillo pasado del ideal se marca en rojo, igual que
                    // en pantalla: en papel no hay tooltip que lo explique.
                    if (esPlatillo && data.section === 'body' && rows[data.row.index]?.AlertaCostoSinIva === 1) {
                        if (data.column.index === 8 || data.column.index === 9) {
                            data.cell.styles.textColor = [153, 27, 27];
                            data.cell.styles.fontStyle = 'bold';
                        }
                    }
                },
            });
        } else {
            const detalle = await cargarDetalle();
            const body: RowInput[] = [];

            for (const row of rows) {
                const items = detalle.get(row.IdProducto) || [];
                const encabezado = esPlatillo
                    ? `${row.Producto}   ·   Precio ${money(row.Precio || 0)}   ·   Costo ${money(row.Costo || 0)}   ·   ${pct(row.PorcentajeCostoSinIva || 0)} s/IVA (ideal ${pct(row.PorcentajeCostoIdeal || 0)})`
                    : `${row.Producto}   ·   ${row.Presentacion || ''}   ·   Costo ${money(row.Costo || 0)}`;

                body.push([{
                    content: encabezado,
                    colSpan: 5,
                    styles: {
                        fillColor: [240, 245, 255],
                        fontStyle: 'bold',
                        textColor: row.AlertaCostoSinIva === 1 ? [153, 27, 27] : [30, 64, 175],
                    },
                }]);

                if (items.length === 0) {
                    body.push([{
                        content: 'Sin ingredientes capturados',
                        colSpan: 5,
                        styles: { textColor: [150, 150, 150], fontStyle: 'italic' },
                    }]);
                    continue;
                }

                for (const item of items) {
                    body.push([item.producto, item.codigo, qty(item.cantidad), item.unidad, money(item.total)]);
                }
            }

            autoTable(doc, {
                startY: 33,
                head: [['Ingrediente', 'Código', 'Cantidad', 'Unidad', 'Costo']],
                body,
                theme: 'striped',
                headStyles: { fillColor: [13, 148, 136] },
                styles: { fontSize: 8, cellPadding: 1.5 },
                columnStyles: { 2: { halign: 'right' }, 4: { halign: 'right' } },
            });
        }

        const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 150;
        const costoTotal = rows.reduce((sum, r) => sum + (Number(r.Costo) || 0), 0);
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);
        doc.text(
            `${rows.length} ${rows.length === 1 ? 'receta' : 'recetas'} — costo sumado ${money(costoTotal)}`,
            15,
            finalY + 8
        );

        doc.save(`${archivo}.pdf`);
    };

    const exportar = async () => {
        if (rows.length === 0) {
            setError('No hay registros que exportar con el filtro actual.');
            return;
        }
        setIsExporting(true);
        setError(null);
        try {
            if (formato === 'excel') await exportarExcel();
            else await exportarPDF();
            onClose();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'No se pudo generar el archivo.');
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <BaseModal
            isOpen={isOpen}
            onClose={onClose}
            title={`Exportar ${titulo.toLowerCase()}`}
            subtitle={`${rows.length} ${rows.length === 1 ? 'registro' : 'registros'} en pantalla`}
            size="md"
            onConfirm={exportar}
            confirmLabel="Exportar"
            confirmLoading={isExporting}
        >
            <div className="space-y-4">
                <div>
                    <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: '#6B7280' }}>
                        Formato
                    </p>
                    <div className="flex gap-2">
                        <Opcion
                            activa={formato === 'excel'}
                            onClick={() => setFormato('excel')}
                            icon={FileSpreadsheet}
                            titulo="Excel"
                            detalle="Para filtrar y hacer cuentas"
                        />
                        <Opcion
                            activa={formato === 'pdf'}
                            onClick={() => setFormato('pdf')}
                            icon={FileText}
                            titulo="PDF"
                            detalle="Para imprimir o compartir"
                        />
                    </div>
                </div>

                <div>
                    <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: '#6B7280' }}>
                        Contenido
                    </p>
                    <div className="flex gap-2">
                        <Opcion
                            activa={alcance === 'registros'}
                            onClick={() => setAlcance('registros')}
                            icon={List}
                            titulo="Solo los registros"
                            detalle="La tabla tal como se ve"
                        />
                        <Opcion
                            activa={alcance === 'detalle'}
                            onClick={() => setAlcance('detalle')}
                            icon={ListTree}
                            titulo="Con detalle"
                            detalle="Incluye los ingredientes de cada receta"
                        />
                    </div>
                </div>

                <p className="text-xs" style={{ color: '#6B7280' }}>
                    Se exporta lo que tienes filtrado en pantalla.
                </p>

                {error && (
                    <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm" style={{ color: '#B91C1C' }}>
                        {error}
                    </div>
                )}
            </div>
        </BaseModal>
    );
}
