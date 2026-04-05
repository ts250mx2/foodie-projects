'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect, useCallback } from 'react';
import Button from '@/components/Button';
import * as XLSX from 'xlsx';

interface MassiveProductUploadProps {
    onSuccess?: () => void;
    hideHeader?: boolean;
}

export default function MassiveProductUpload({ onSuccess, hideHeader = false }: MassiveProductUploadProps) {
    const t = useTranslations('Navigation');
    const [project, setProject] = useState<any>(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const [uploadedData, setUploadedData] = useState<any[]>([]);
    const [existingProducts, setExistingProducts] = useState<{ code: string, name: string }[]>([]);
    const [existingCategories, setExistingCategories] = useState<string[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        const storedProject = localStorage.getItem('project');
        if (storedProject) setProject(JSON.parse(storedProject));
    }, []);

    const fetchExistingProducts = async () => {
        if (!project?.idProyecto) return;
        try {
            const response = await fetch(`/api/products/massive-upload/check-duplicates?projectId=${project.idProyecto}`);
            const data = await response.json();
            if (data.success) {
                setExistingProducts(data.products);
                setExistingCategories(data.categories);
            }
        } catch (error) {
            console.error('Error fetching existing products data:', error);
        }
    };

    const processFile = async (file: File) => {
        await fetchExistingProducts();

        const reader = new FileReader();
        reader.onload = (e) => {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const json = XLSX.utils.sheet_to_json(worksheet);

            // Map keys to expected format if needed, or just set it
            setUploadedData(json);
        };
        reader.readAsArrayBuffer(file);
    };

    const isDuplicateCode = (code: any) => {
        if (!code) return false;
        return existingProducts.some(p => p.code === code.toString());
    };

    const isDuplicateName = (name: any) => {
        if (!name) return false;
        return existingProducts.some(p => p.name?.toLowerCase() === name.toString().toLowerCase());
    };

    const isInvalidCategory = (category: any) => {
        if (!category) return false;
        return !existingCategories.some(c => c.toLowerCase() === category.toString().toLowerCase());
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) processFile(file);
    };

    const onDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) processFile(file);
    }, [project]);

    const onDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const onDragLeave = () => {
        setIsDragging(false);
    };

    const handleDownloadTemplate = async () => {
        if (!project?.idProyecto) return;

        setIsDownloading(true);
        try {
            const response = await fetch(`/api/products/massive-upload/template?projectId=${project.idProyecto}`);
            if (!response.ok) throw new Error('Error al generar la plantilla');

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'plantilla_productos.xlsx';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Error downloading template:', error);
            alert('Error al descargar la plantilla. Por favor intente de nuevo.');
        } finally {
            setIsDownloading(false);
        }
    };

    const handleProcessUpload = async () => {
        if (!project?.idProyecto || uploadedData.length === 0) return;

        // Filter valid products: no duplicates in Code or Name
        const validProducts = uploadedData.filter(row =>
            !isDuplicateCode(row.Codigo) && !isDuplicateName(row.Producto)
        );

        if (validProducts.length === 0) {
            alert('No hay productos válidos para procesar (todos tienen advertencias de duplicado).');
            return;
        }

        if (!confirm(`Se van a procesar ${validProducts.length} productos de los ${uploadedData.length} cargados. ¿Desea continuar?`)) {
            return;
        }

        setIsProcessing(true);
        try {
            const response = await fetch('/api/products/massive-upload/process', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: project.idProyecto,
                    products: validProducts
                })
            });

            const data = await response.json();
            if (data.success) {
                alert(data.message);
                setUploadedData([]);
                setExistingProducts([]);
                setExistingCategories([]);
                if (onSuccess) onSuccess();
            } else {
                throw new Error(data.message);
            }
        } catch (error: any) {
            console.error('Error processing upload:', error);
            alert('Error: ' + error.message);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className={hideHeader ? "" : "p-6"}>
            {!hideHeader && (
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">
                            {t('massiveProductUpload')}
                        </h1>
                        <p className="text-gray-600 mt-2">
                            Utiliza esta herramienta para cargar múltiples productos de forma rápida.
                        </p>
                    </div>
                </div>
            )}

            <div className="flex justify-end mb-4">
                <Button
                    onClick={handleDownloadTemplate}
                    isLoading={isDownloading}
                    variant="secondary"
                    className="text-xs"
                >
                    📥 Descargar Plantilla
                </Button>
            </div>

            <div
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                className={`
                    border-2 border-dashed rounded-xl p-6 mb-8 flex flex-col items-center justify-center transition-all cursor-pointer
                    ${isDragging ? 'border-primary-500 bg-primary-50' : 'border-gray-300 bg-white hover:border-gray-400'}
                `}
            >
                <input
                    type="file"
                    id="file-upload"
                    className="hidden"
                    accept=".xlsx, .xls, .csv"
                    onChange={handleFileChange}
                />
                <label htmlFor="file-upload" className="flex flex-col items-center cursor-pointer w-full h-full">
                    <span className="text-4xl mb-2 text-center">📄</span>
                    <p className="text-lg font-medium text-gray-700 text-center">
                        Arrastra un archivo aquí o haz clic para seleccionar
                    </p>
                    <p className="text-gray-500 mt-1 text-sm">
                        Soporta Excel (.xlsx, .xls) y CSV
                    </p>
                </label>
            </div>

            {uploadedData.length > 0 && (
                <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
                    <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                        <div className="flex flex-col gap-2">
                            <h2 className="font-semibold text-gray-800">Vista Previa de Datos ({uploadedData.length})</h2>
                            <div className="flex flex-wrap gap-2 text-[10px]">
                                <span className="flex items-center gap-1 text-primary-600 bg-primary-50 px-2 py-0.5 rounded border border-primary-100 italic">
                                    <span className="w-1.5 h-1.5 bg-primary-400 rounded-full"></span>
                                    Advertencia: Duplicado o Inexistente en el sistema
                                </span>
                            </div>
                        </div>
                        <button
                            onClick={() => {
                                setUploadedData([]);
                                setExistingProducts([]);
                                setExistingCategories([]);
                            }}
                            className="text-red-500 hover:text-red-600 text-sm font-medium"
                        >
                            Limpiar
                        </button>
                    </div>
                    <div className="overflow-x-auto max-h-[400px]">
                        <table className="w-full text-left text-sm">
                            <thead className="sticky top-0 bg-gray-100 text-gray-600 uppercase text-xs font-semibold z-10">
                                <tr>
                                    {Object.keys(uploadedData[0]).map((key) => (
                                        <th key={key} className="px-4 py-3 border-b whitespace-nowrap">{key}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {uploadedData.map((row, idx) => {
                                    const hasDuplicateCode = isDuplicateCode(row.Codigo);
                                    const hasDuplicateName = isDuplicateName(row.Producto);
                                    const hasInvalidCategory = isInvalidCategory(row.Categoria);

                                    const hasIssues = hasDuplicateCode || hasDuplicateName || hasInvalidCategory;

                                    return (
                                        <tr key={idx} className={`hover:bg-gray-50 transition-colors ${hasIssues ? 'bg-primary-50/20' : ''}`}>
                                            {Object.keys(uploadedData[0]).map((key, vIdx) => {
                                                const val = row[key];
                                                const isCodeIssue = key === 'Codigo' && hasDuplicateCode;
                                                const isNameIssue = key === 'Producto' && hasDuplicateName;
                                                const isCatIssue = key === 'Categoria' && hasInvalidCategory;

                                                const isCritical = isCodeIssue || isNameIssue || isCatIssue;

                                                let title = "";
                                                if (isCodeIssue) title = "Este código ya existe";
                                                if (isNameIssue) title = "Este nombre de producto ya existe";
                                                if (isCatIssue) title = "Esta categoría no existe en el sistema";

                                                return (
                                                    <td key={vIdx} className={`px-4 py-3 text-gray-700 ${isCritical ? 'text-primary-600 font-medium' : ''}`}>
                                                        <div className="flex items-center gap-2">
                                                            {val}
                                                            {isCritical && (
                                                                <span title={title} className="cursor-help text-primary-500">
                                                                    ⚠️
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end">
                        <Button
                            onClick={handleProcessUpload}
                            isLoading={isProcessing}
                            variant="primary"
                        >
                            🚀 Procesar Carga Masiva
                        </Button>
                    </div>
                </div>
            )}

            {!uploadedData.length && (
                <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100 flex flex-col items-center justify-center min-h-[200px]">
                    <div className="text-5xl mb-3 opacity-20">📊</div>
                    <p className="text-gray-500 text-center text-sm max-w-xs">
                        Sube un archivo para ver la vista previa de los productos antes de realizar la carga masiva al sistema.
                    </p>
                </div>
            )}
        </div>
    );
}
