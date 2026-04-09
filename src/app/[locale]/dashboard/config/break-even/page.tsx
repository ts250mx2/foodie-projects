'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/contexts/ThemeContext';
import Button from '@/components/Button';
import ExcelJS from 'exceljs';
import { toPng } from 'html-to-image';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';

interface Branch {
    IdSucursal: number;
    Sucursal: string;
}

interface FixedExpense {
    ConceptoGasto: string;
    Monto: number;
}

interface Scenario {
    IdEscenario: number;
    PrecioTicket: number;
    VolumenTickets: number;
}

// Local Price Input Component for consistent currency formatting
const PriceInput = ({ value, onChange, className, color = 'indigo', disabled = false }: any) => {
    const [isFocused, setIsFocused] = useState(false);
    const [displayValue, setDisplayValue] = useState('');

    useEffect(() => {
        if (!isFocused) {
            setDisplayValue(new Intl.NumberFormat('es-MX', { 
                minimumFractionDigits: 2, 
                maximumFractionDigits: 2 
            }).format(value || 0));
        }
    }, [value, isFocused]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (disabled) return;
        let raw = e.target.value.replace(/[^0-9.]/g, '');
        // Handle multiple decimals
        const parts = raw.split('.');
        if (parts.length > 2) raw = parts[0] + '.' + parts.slice(1).join('');
        
        setDisplayValue(e.target.value);
        const num = parseFloat(raw) || 0;
        onChange(num);
    };

    const colorClasses: Record<string, string> = {
        indigo: 'focus-within:border-indigo-500 focus-within:ring-indigo-500/10 text-indigo-900',
        orange: 'focus-within:border-orange-500 focus-within:ring-orange-500/10 text-orange-900',
        slate: 'focus-within:border-slate-500 focus-within:ring-slate-500/10 text-slate-900'
    };

    const currentClasses = colorClasses[color] || colorClasses.indigo;

    return (
        <div className={`flex items-center bg-white border-2 border-slate-200 rounded-xl overflow-hidden transition-all shadow-sm ${currentClasses.split(' ').slice(0, 2).join(' ')} ${className} ${disabled ? 'bg-slate-50 opacity-75' : ''}`}>
            <div className="pl-2.5 pr-1 py-1.5 flex items-center pointer-events-none bg-slate-50 border-r border-slate-100">
                <span className={`text-[10px] font-black italic ${currentClasses.split(' ').pop()}`}>$</span>
            </div>
            <input
                type="text"
                value={isFocused ? displayValue.replace(/,/g, '') : displayValue}
                onChange={handleChange}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                disabled={disabled}
                className="w-full px-2 py-1.5 outline-none text-[10px] font-black text-slate-900 text-right bg-transparent disabled:cursor-not-allowed"
            />
        </div>
    );
};

export default function BreakEvenPage() {

    const t = useTranslations('BreakEven');
    const tCommon = useTranslations('Common');
    const tProd = useTranslations('Production');
    const { colors } = useTheme();

    // Refs for auto-focus and export
    const expenseInputsRef = useRef<(HTMLInputElement | null)[]>([]);
    const chartRef = useRef<HTMLDivElement>(null);



    // Basic state
    const [branches, setBranches] = useState<Branch[]>([]);
    const [selectedBranch, setSelectedBranch] = useState<string>('');
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [project, setProject] = useState<any>(null);

    // Form data
    const [monthlySales, setMonthlySales] = useState<number>(0);
    const [avgTicket, setAvgTicket] = useState<number>(0);
    const [volume, setVolume] = useState<number>(0);
    const [rawMaterial, setRawMaterial] = useState<number>(0);
    const [packaging, setPackaging] = useState<number>(0);
    const [others, setOthers] = useState<number>(0);
    const [shipping, setShipping] = useState<number>(0);
    const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([]);
    const [representativeProducts, setRepresentativeProducts] = useState<any[]>([]);
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [newProduct, setNewProduct] = useState({ name: '', rawMaterial: 0, packaging: 0 });
    const [isChartModalOpen, setIsChartModalOpen] = useState(false);

    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(false);



    // Calculated values (Main Analysis)
    const avgSalesAmount = monthlySales;

    // Derived representative costs (Average of products or fallback to manual)
    const avgRawMaterial = useMemo(() => {
        if (representativeProducts.length === 0) return rawMaterial;
        const sum = representativeProducts.reduce((s, p) => s + (p.CostoMateriaPrima || 0), 0);
        return sum / representativeProducts.length;
    }, [representativeProducts, rawMaterial]);

    const avgPackaging = useMemo(() => {
        if (representativeProducts.length === 0) return packaging;
        const sum = representativeProducts.reduce((s, p) => s + (p.Empaque || 0), 0);
        return sum / representativeProducts.length;
    }, [representativeProducts, packaging]);

    const sumVariableCosts = avgRawMaterial + avgPackaging + others + shipping;
    const variableCostsTotal = sumVariableCosts * volume;

    const unitContributionMargin = avgTicket - sumVariableCosts;
    const totalFixedExpenses = fixedExpenses.reduce((sum, exp) => sum + (exp.Monto || 0), 0);
    const totalCostsPerPeriod = totalFixedExpenses + variableCostsTotal;

    // Final Break-Even Results
    const breakEvenUnits = unitContributionMargin > 0 ? totalFixedExpenses / unitContributionMargin : 0;
    const breakEvenDollars = breakEvenUnits * avgTicket;
    const dailyBreakEvenUnits = breakEvenUnits / 30;
    const dailyBreakEvenDollars = breakEvenDollars / 30;

    // Auto-focus logic for new expenses
    useEffect(() => {
        if (fixedExpenses.length > 0) {
            const lastIdx = fixedExpenses.length - 1;
            // Safe focus on the last element if it's empty (likely just created)
            if (expenseInputsRef.current[lastIdx] && !fixedExpenses[lastIdx].ConceptoGasto) {
                expenseInputsRef.current[lastIdx]?.focus();
            }
        }
    }, [fixedExpenses.length]);

    // Auto-calculate average ticket whenever monthly sales or volume changes
    useEffect(() => {
        const calculatedAvg = volume > 0 ? monthlySales / volume : 0;
        setAvgTicket(calculatedAvg);
    }, [monthlySales, volume]);


    // Chart Data Generation (Dynamic Points: 0, Break-Even, Current, and Projection)
    const chartData = useMemo(() => {
        const points = [];

        // 1. Point 0
        points.push({
            name: 'Inicio',
            ventas: 0,
            costos: totalFixedExpenses,
            fijos: totalFixedExpenses,
            variables: 0
        });

        // 2. Break-Even Point
        if (breakEvenDollars > 0) {
            points.push({
                name: 'Pto. Equilibrio',
                ventas: breakEvenDollars,
                costos: breakEvenDollars, // At break-even, costs = sales
                fijos: totalFixedExpenses,
                variables: breakEvenDollars - totalFixedExpenses
            });
        }

        // 3. Current Point
        if (monthlySales > 0) {
            points.push({
                name: 'Actual',
                ventas: monthlySales,
                costos: totalCostsPerPeriod,
                fijos: totalFixedExpenses,
                variables: variableCostsTotal
            });
        }

        // 4. Projection Point (150% of current or 150% of break-even)
        const targetVentas = Math.max(monthlySales, breakEvenDollars) * 1.5;
        if (targetVentas > 0) {
            const targetVolumen = avgTicket > 0 ? targetVentas / avgTicket : 0;
            const targetVariables = sumVariableCosts * targetVolumen;
            points.push({
                name: 'Proyección',
                ventas: targetVentas,
                costos: totalFixedExpenses + targetVariables,
                fijos: totalFixedExpenses,
                variables: targetVariables
            });
        }

        return points.sort((a, b) => a.ventas - b.ventas);
    }, [monthlySales, totalCostsPerPeriod, totalFixedExpenses, breakEvenDollars, variableCostsTotal, avgTicket, sumVariableCosts]);


    const years = Array.from({ length: 7 }, (_, i) => new Date().getFullYear() - 5 + i);

    useEffect(() => {
        const storedProject = localStorage.getItem('project');
        if (storedProject) setProject(JSON.parse(storedProject));
    }, []);

    useEffect(() => {
        if (project?.idProyecto) {
            fetchBranches();
            const savedBranch = localStorage.getItem('dashboardSelectedBranch');
            const savedMonth = localStorage.getItem('lastSelectedMonth');
            const savedYear = localStorage.getItem('lastSelectedYear');
            if (savedBranch) setSelectedBranch(savedBranch);
            if (savedMonth) setSelectedMonth(parseInt(savedMonth));
            if (savedYear) setSelectedYear(parseInt(savedYear));
        }
    }, [project]);

    useEffect(() => {
        if (selectedBranch && project) fetchData();
    }, [selectedBranch, selectedMonth, selectedYear, project]);

    const fetchBranches = async () => {
        try {
            const response = await fetch(`/api/branches?projectId=${project.idProyecto}`);
            const data = await response.json();
            if (data.success && data.data.length > 0) {
                setBranches(data.data);
                if (!selectedBranch) setSelectedBranch(data.data[0].IdSucursal.toString());
            }
        } catch (error) { console.error('Error fetching branches:', error); }
    };

    const fetchData = async () => {
        if (!project || !selectedBranch) return;
        setIsLoading(true);
        try {
            const params = new URLSearchParams({
                projectId: project.idProyecto,
                branchId: selectedBranch,
                month: (selectedMonth + 1).toString(),
                year: selectedYear.toString()
            });
            const response = await fetch(`/api/config/break-even?${params}`);
            const data = await response.json();
            if (data.success && data.data) {
                const price = data.data.PrecioTicket || 0;
                const vol = data.data.VolumenTickets || 0;
                setVolume(vol);
                setMonthlySales(price * vol);
                setRawMaterial(data.data.CostoMateriaPrima || 0);
                setPackaging(data.data.Empaque || 0);
                setOthers(data.data.Otros || 0);
                setShipping(data.data.Envio || 0);
                setFixedExpenses(data.data.fixedExpenses || []);
                setRepresentativeProducts(data.data.representativeProducts || []);
            } else {
                setMonthlySales(0); setVolume(0); setRawMaterial(0); setPackaging(0); setOthers(0); setShipping(0); setFixedExpenses([]);
                setRepresentativeProducts([]);
            }
        } catch (error) {
            console.error('Error fetching break-even data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        if (!project || !selectedBranch) return;
        setIsSaving(true);
        try {
            const response = await fetch('/api/config/break-even', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: project.idProyecto, branchId: selectedBranch, month: selectedMonth + 1, year: selectedYear,
                    price: avgTicket, volume: volume, 
                    rawMaterial: representativeProducts.length > 0 ? avgRawMaterial : rawMaterial, 
                    packaging: representativeProducts.length > 0 ? avgPackaging : packaging, 
                    others, shipping,
                    fixedExpenses, representativeProducts
                })
            });
            const data = await response.json();
            if (data.success) alert(t('successSave'));
            else alert(t('errorSave'));
        } catch (error) { 
            console.error('Error saving break-even data:', error); 
            alert(t('errorSave')); 
        } finally { 
            setIsSaving(false); 
        }
    };

    const handleAddExpense = () => setFixedExpenses([...fixedExpenses, { ConceptoGasto: '', Monto: 0 }]);
    const handleDeleteExpense = (index: number) => setFixedExpenses(fixedExpenses.filter((_, i) => i !== index));
    const handleUpdateExpense = (index: number, field: keyof FixedExpense, value: any) => {
        const newExpenses = [...fixedExpenses];
        newExpenses[index] = { ...newExpenses[index], [field]: value };
        setFixedExpenses(newExpenses);
    };

    const handleAddProduct = () => {
        if (!newProduct.name) return;
        setRepresentativeProducts([...representativeProducts, { 
            NombreProducto: newProduct.name, 
            CostoMateriaPrima: newProduct.rawMaterial, 
            Empaque: newProduct.packaging 
        }]);
        setNewProduct({ name: '', rawMaterial: 0, packaging: 0 });
        setIsProductModalOpen(false);
    };

    const handleDeleteProduct = (index: number) => {
        setRepresentativeProducts(representativeProducts.filter((_, i) => i !== index));
    };

    const formatCurrency = (val: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val);


    const handleExportExcel = async () => {
        if (!chartRef.current) return;
        setIsSaving(true);

        try {
            // 1. Capture Chart Image
            const chartDataUrl = await toPng(chartRef.current, { backgroundColor: '#ffffff', quality: 1 });
            
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Punto de Equilibrio');

            const branchName = branches.find(b => b.IdSucursal.toString() === selectedBranch)?.Sucursal || selectedBranch;
            const period = `${tProd(`months.${selectedMonth}`)} ${selectedYear}`;

            // --- STYLING HELPERS ---
            const headerFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
            const subHeaderFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
            const emeraldFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } };
            const indigoFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };
            const orangeFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF7ED' } };

            // --- PAGE TITLE ---
            worksheet.mergeCells('A1:L2');
            const mainTitle = worksheet.getCell('A1');
            mainTitle.value = `REPORTE DE PUNTO DE EQUILIBRIO - ${branchName.toString().toUpperCase()}`;
            mainTitle.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
            mainTitle.alignment = { vertical: 'middle', horizontal: 'center' };
            mainTitle.fill = headerFill;

            worksheet.mergeCells('A3:L3');
            const subTitle = worksheet.getCell('A3');
            subTitle.value = `Periodo: ${period} | Generado el: ${new Date().toLocaleDateString()}`;
            subTitle.font = { italic: true, color: { argb: 'FF64748B' } };
            subTitle.alignment = { horizontal: 'center' };

            // --- COLUMN WIDTHS ---
            worksheet.getColumn(1).width = 30; // Labels
            worksheet.getColumn(2).width = 15; // Values
            worksheet.getColumn(3).width = 5;  // Spacer
            worksheet.getColumn(4).width = 15; // Scenarios Table Start
            for(let i=5; i<=12; i++) worksheet.getColumn(i).width = 15;

            // --- LEFT COLUMN (BLOCKS) ---
            const drawBlockHeader = (row: number, title: string, fill: ExcelJS.Fill) => {
                worksheet.mergeCells(`A${row}:B${row}`);
                const cell = worksheet.getCell(`A${row}`);
                cell.value = title;
                cell.font = { bold: true, size: 10, color: { argb: fill === headerFill ? 'FFFFFFFF' : 'FF334155' } };
                cell.fill = fill;
                cell.alignment = { horizontal: 'center' };
            };

            const drawRow = (row: number, label: string, value: any, isCurrency = true) => {
                const cLabel = worksheet.getCell(`A${row}`);
                const cValue = worksheet.getCell(`B${row}`);
                cLabel.value = label;
                cValue.value = value;
                if(isCurrency) cValue.numFmt = '"$"#,##0.00';
                cLabel.font = { size: 9 };
                cValue.font = { size: 9, bold: true };
                cLabel.border = { bottom: { style: 'thin', color: { argb: 'FFF1F5F9' } } };
            };

            // Block: Ventas
            drawBlockHeader(5, 'VENTAS PROMEDIO', indigoFill);
            drawRow(6, 'Precio Ticket Promedio', avgTicket);
            drawRow(7, 'Volumen Mensual Tickets', volume, false);
            drawRow(8, 'Ventas Totales Proyectadas', avgSalesAmount);

            // Block: Costos Variables
            drawBlockHeader(10, 'COSTO VARIABLE UNITARIO', orangeFill);
            drawRow(11, 'Materia Prima', rawMaterial);
            drawRow(12, 'Empaque', packaging);
            drawRow(13, 'Otros', others);
            drawRow(14, 'Envío', shipping);
            drawRow(15, 'SUMA COSTOS VARIABLES', sumVariableCosts);
            drawRow(16, 'MARGEN DE CONTRIBUCIÓN', unitContributionMargin);

            // Block: Gastos Fijos
            drawBlockHeader(18, 'GASTOS FIJOS POR MES', subHeaderFill);
            let currentRow = 19;
            fixedExpenses.forEach(exp => {
                drawRow(currentRow, exp.ConceptoGasto, exp.Monto);
                currentRow++;
            });
            drawBlockHeader(currentRow, 'TOTAL GASTOS FIJOS', subHeaderFill);
            worksheet.getCell(`B${currentRow}`).value = totalFixedExpenses;
            worksheet.getCell(`B${currentRow}`).numFmt = '"$"#,##0.00';
            worksheet.getCell(`B${currentRow}`).font = { bold: true };

            // Block: Resultados BE
            const beRow = currentRow + 2;
            drawBlockHeader(beRow, 'RESULTADO PUNTO EQUILIBRIO', emeraldFill);
            drawRow(beRow + 1, 'Tickets Necesarios (Unidades)', Math.ceil(breakEvenUnits), false);
            drawRow(beRow + 2, 'Venta Necesaria ($)', breakEvenDollars);

            // --- INSERT CHART ---
            const imageId = workbook.addImage({
                base64: chartDataUrl.split(',')[1],
                extension: 'png',
            });

            worksheet.addImage(imageId, {
                tl: { col: 3, row: 4 }, // Starts at column D, row 5
                ext: { width: 800, height: 400 }
            });


            // Final Download
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Punto_Equilibrio_Pro_${branchName.toString().replace(/\s+/g, '_')}_${selectedMonth + 1}_${selectedYear}.xlsx`;
            a.click();
            window.URL.revokeObjectURL(url);

        } catch (error) {
            console.error('Error exporting excel:', error);
            alert('Error al generar el Excel con la gráfica.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="flex flex-col min-h-screen p-4 gap-4 bg-slate-50/50">
            {/* Header */}
            <div className="sticky top-16 z-30 flex flex-col md:flex-row justify-between items-center gap-3 bg-white/95 backdrop-blur-sm p-3 rounded-xl shadow-sm border border-slate-100">
                <div className="flex flex-col">
                    <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">📈 {t('title')}</h1>
                    <p className="text-[10px] text-slate-400 font-bold tracking-wider">{tProd(`months.${selectedMonth}`)} {selectedYear}</p>
                </div>
                <div className="flex items-center gap-3 flex-wrap justify-center">
                    {/* Selectors */}
                    <select value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)} className="px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 shadow-sm outline-none">
                        {branches.map(b => <option key={b.IdSucursal} value={b.IdSucursal}>{b.Sucursal}</option>)}
                    </select>
                    <select value={selectedMonth} onChange={(e) => setSelectedMonth(parseInt(e.target.value))} className="px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 shadow-sm outline-none">
                        {Array.from({ length: 12 }, (_, i) => <option key={i} value={i}>{tProd(`months.${i}`)}</option>)}
                    </select>
                    <select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))} className="px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 shadow-sm outline-none">
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <div className="flex items-center gap-2">
                        <Button 
                            onClick={() => setIsChartModalOpen(true)} 
                            className="h-9 px-3 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg font-black text-xs shadow-md active:scale-95 transition-all flex items-center gap-2 border border-indigo-200"
                        >
                            📊 Ver Gráfica
                        </Button>
                        <Button onClick={handleExportExcel} className="h-9 px-4 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-black text-xs shadow-md active:scale-95 transition-all flex items-center gap-2">

                            <span>📗</span> Exportar
                        </Button>
                        <Button onClick={handleSave} disabled={isSaving} className="h-9 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-black text-xs shadow-md active:scale-95 transition-all">
                            {isSaving ? '⏳' : '💾'} {t('save')}
                        </Button>
                    </div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto w-full flex flex-col gap-6 pb-20">
                
                {/* CONFIG BLOCKS */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">

                    {/* BLOCK 1: VENTAS PROMEDIO */}
                    <div className="bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden group hover:shadow-lg transition-all">
                        <div className="px-5 py-3.5 bg-slate-50 border-b border-indigo-100 flex items-center gap-3">
                            <span className="text-xl filter drop-shadow-sm">📊</span>
                            <h2 className="text-[13px] font-black text-indigo-900 uppercase tracking-widest">{t('salesBlockTitle')}</h2>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className="flex items-center justify-between gap-4 p-2 rounded-xl hover:bg-slate-50 transition-colors">
                                <span className="text-[11px] font-black text-slate-500 uppercase flex-1">{t('monthlySales')}</span>
                                <div className="w-32 flex-shrink-0">
                                    <PriceInput value={monthlySales} onChange={setMonthlySales} />
                                </div>
                            </div>
                            <div className="flex items-center justify-between gap-4 p-2 rounded-xl hover:bg-slate-50 transition-colors">
                                <span className="text-[11px] font-black text-slate-500 uppercase flex-1 truncate">{t('ticketVolume')}</span>
                                <div className="w-32 flex-shrink-0 flex items-center bg-slate-50 border-2 border-slate-200 rounded-xl overflow-hidden focus-within:ring-4 focus-within:ring-indigo-500/10 transition-all shadow-sm">
                                    <div className="pl-2.5 pr-1 py-1.5 flex items-center bg-slate-100/50 border-r border-slate-200">
                                        <span className="text-slate-400 text-[10px] font-bold">#</span>
                                    </div>
                                    <input type="number" value={volume || ''} onChange={e => setVolume(parseFloat(e.target.value) || 0)} className="w-full px-2 py-1.5 outline-none text-[10px] font-black text-slate-800 text-right bg-transparent" />
                                </div>
                            </div>
                            <div className="flex items-center justify-between gap-4 p-3.5 bg-indigo-50 rounded-xl border border-indigo-100 mt-2">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-indigo-800 uppercase tracking-wider">{t('avgTicketPrice')}</span>
                                    <span className="text-[7px] font-bold text-indigo-400 italic">Ventas / Clientes</span>
                                </div>
                                <span className="text-base font-black text-indigo-600">{formatCurrency(avgTicket)}</span>
                            </div>
                        </div>
                    </div>

                    {/* BLOCK 2: COSTO VARIABLE */}
                    <div className="bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden group hover:shadow-lg transition-all">
                        <div className="px-5 py-3.5 bg-orange-50/50 border-b border-orange-100 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <span className="text-xl filter drop-shadow-sm">📦</span>
                                <h2 className="text-[13px] font-black text-orange-900 uppercase tracking-widest">{t('variableCostBlockTitle')}</h2>
                            </div>
                            <button 
                                onClick={() => setIsProductModalOpen(true)}
                                className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 rounded-xl text-[10px] font-black uppercase text-white shadow-sm active:scale-95 transition-all flex items-center gap-2"
                            >
                                <span className="text-sm">+</span> {t('addProduct')}
                            </button>
                        </div>
                        <div className="p-5 space-y-2">
                            {/* Representative Products List */}
                            {representativeProducts.length > 0 && (
                                <div className="mb-4 space-y-2 max-h-[120px] overflow-y-auto pr-1">
                                    {representativeProducts.map((p, idx) => (
                                        <div key={idx} className="flex items-center justify-between gap-2 p-2 bg-orange-50/30 rounded-xl border border-orange-100/50 shadow-sm">
                                            <div className="flex flex-col flex-1 truncate">
                                                <span className="text-[10px] font-black text-slate-800 truncate">{p.NombreProducto}</span>
                                                <div className="flex gap-2">
                                                    <span className="text-[8px] font-bold text-slate-400">MP: {formatCurrency(p.CostoMateriaPrima)}</span>
                                                    <span className="text-[8px] font-bold text-slate-400">E: {formatCurrency(p.Empaque)}</span>
                                                </div>
                                            </div>
                                            <button onClick={() => handleDeleteProduct(idx)} className="p-1.5 text-rose-300 hover:text-rose-600 hover:bg-white rounded-lg transition-all">🗑️</button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {[
                                { k: 'rawMaterialCost', v: avgRawMaterial, s: setRawMaterial, disabled: representativeProducts.length > 0 },
                                { k: 'packagingCost', v: avgPackaging, s: setPackaging, disabled: representativeProducts.length > 0 },
                                { k: 'othersCost', v: others, s: setOthers },
                                { k: 'shippingCost', v: shipping, s: setShipping }
                            ].map(item => (
                                <div key={item.k} className={`flex items-center justify-between gap-4 p-2 rounded-lg hover:bg-slate-50 transition-colors ${item.disabled ? 'opacity-80' : ''}`}>
                                    <span className="text-[11px] font-black text-slate-500 uppercase flex-1">{t(item.k)}</span>
                                    <div className="w-32 flex-shrink-0">
                                        <PriceInput value={item.v} onChange={item.s} color="orange" disabled={item.disabled} />
                                    </div>
                                </div>
                            ))}

                            <div className="flex flex-col gap-2 mt-4">
                                <div className="flex justify-between items-center p-2.5 bg-orange-50 rounded-xl border border-orange-100 shadow-sm">
                                    <span className="text-[9px] font-black text-orange-500 uppercase tracking-wider">{t('sumVariableCosts')}</span>
                                    <span className="text-sm font-black text-orange-700">{formatCurrency(sumVariableCosts)}</span>
                                </div>
                                <div className="flex justify-between items-center p-2.5 bg-rose-50 rounded-xl border border-rose-100 shadow-sm">
                                    <div className="flex flex-col">
                                        <span className="text-[9px] font-black text-rose-500 uppercase tracking-wider">C. Variables * Volumen</span>
                                        <span className="text-[7px] font-bold text-rose-400 italic">Suma C.V. * Volumen Mensual</span>
                                    </div>
                                    <span className="text-sm font-black text-rose-700">{formatCurrency(variableCostsTotal)}</span>
                                </div>
                                <div className="flex justify-between items-center p-2.5 bg-indigo-50 rounded-xl border border-indigo-100 shadow-sm">
                                    <span className="text-[9px] font-black text-indigo-500 uppercase tracking-wider">{t('unitContributionMargin')}</span>
                                    <span className="text-sm font-black text-indigo-700">{formatCurrency(unitContributionMargin)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* BLOCK 3: GASTOS FIJOS */}
                    <div className="bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden flex flex-col group hover:shadow-lg transition-all">
                        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className="text-xl filter drop-shadow-sm">🏢</span>
                                <h2 className="text-[13px] font-black text-slate-800 uppercase tracking-widest">{t('fixedExpensesBlockTitle')}</h2>
                            </div>
                            <button onClick={handleAddExpense} className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-900 rounded-xl text-[10px] font-black uppercase text-white shadow-sm active:scale-95 transition-all flex items-center gap-2 border border-slate-700">
                                <span className="text-sm">+</span> {t('addExpense')}
                            </button>
                        </div>
                        <div className="p-5 space-y-5">
                            <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                                {fixedExpenses.map((exp, idx) => (
                                    <div key={idx} className="flex items-center gap-2 p-2 bg-slate-50/50 rounded-xl border border-slate-100 group shadow-sm transition-all hover:bg-white hover:border-slate-200">
                                        <input
                                            ref={el => { expenseInputsRef.current[idx] = el }}
                                            type="text"
                                            value={exp.ConceptoGasto}
                                            onChange={e => handleUpdateExpense(idx, 'ConceptoGasto', e.target.value)}
                                            placeholder="Concepto..."
                                            className="flex-1 px-3 py-2 bg-white border-2 border-slate-100 rounded-xl text-[11px] font-bold text-slate-700 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-400/5 transition-all shadow-sm"
                                        />
                                        <div className="w-32 flex-shrink-0">
                                            <PriceInput value={exp.Monto} onChange={(v: any) => handleUpdateExpense(idx, 'Monto', v)} color="indigo" />
                                        </div>
                                        <button onClick={() => handleDeleteExpense(idx)} className="p-2 text-rose-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all shadow-sm">🗑️</button>
                                    </div>
                                ))}
                            </div>
                            <div className="flex flex-col gap-3 pt-4 border-t border-slate-100">
                                <div className="flex justify-between items-center px-1">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('totalFixedExpenses')}</span>
                                    <span className="text-base font-black text-slate-700">{formatCurrency(totalFixedExpenses)}</span>
                                </div>
                                <div className="flex flex-col gap-1 items-end bg-gradient-to-br from-indigo-600 to-indigo-700 px-4 py-3 rounded-2xl text-white shadow-md overflow-hidden relative">
                                    <span className="text-[9px] font-black text-indigo-200 uppercase z-10 tracking-widest">{t('totalCostsPerPeriod')}</span>
                                    <span className="text-xl font-black z-10 drop-shadow-sm">{formatCurrency(totalCostsPerPeriod)}</span>
                                    <div className="absolute top-0 right-0 w-12 h-12 bg-white/5 rounded-full translate-x-4 -translate-y-4"></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* BLOCK 4: RESULTADO PUNTO DE EQUILIBRIO */}
                    <div className="bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden group hover:shadow-lg transition-all animate-in fade-in slide-in-from-bottom-4">
                        <div className="px-5 py-3.5 bg-emerald-50/50 border-b border-emerald-100 flex items-center gap-3">
                            <span className="text-xl filter drop-shadow-sm">🎯</span>
                            <h2 className="text-[13px] font-black text-emerald-900 uppercase tracking-widest">Resultado Punto de Equilibrio</h2>
                        </div>
                        <div className="p-5 space-y-3">
                            <div className="grid grid-cols-2 gap-3 mb-3">
                                <div className="flex flex-col p-3 bg-slate-50 rounded-xl border border-slate-100">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider leading-tight mb-1">{t('dailyBreakEvenUnits')}</span>
                                    <span className="text-sm font-black text-slate-700">{Math.ceil(dailyBreakEvenUnits).toLocaleString()} <small className="text-[8px] text-slate-400 font-bold">Und</small></span>
                                </div>
                                <div className="flex flex-col p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                                    <span className="text-[9px] font-black text-emerald-800 uppercase tracking-wider leading-tight mb-1">{t('dailyBreakEvenDollars')}</span>
                                    <span className="text-sm font-black text-emerald-600">{formatCurrency(dailyBreakEvenDollars)}</span>
                                </div>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100 hover:border-emerald-200 transition-all">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Punto Equilibrio (Unidades)</span>
                                    <span className="text-[8px] font-bold text-slate-400 italic">C. Fijos / Margen Cont. Unit.</span>
                                </div>
                                <span className="text-base font-black text-slate-800">{Math.ceil(breakEvenUnits).toLocaleString()} <small className="text-[10px] text-slate-400 font-bold uppercase">Und</small></span>
                            </div>
                            <div className="flex flex-col gap-1 items-end bg-gradient-to-br from-emerald-600 to-emerald-700 px-4 py-3 rounded-2xl text-white shadow-md overflow-hidden relative group-hover:scale-[1.02] transition-transform">
                                <span className="text-[9px] font-black text-emerald-100 uppercase z-10 tracking-widest">Punto de Equilibrio ($)</span>
                                <span className="text-xl font-black z-10 drop-shadow-sm">{formatCurrency(breakEvenDollars)}</span>
                                <div className="absolute top-0 right-0 w-12 h-12 bg-white/5 rounded-full translate-x-4 -translate-y-4"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {isLoading && (
                <div className="fixed inset-0 z-[100] bg-white/60 backdrop-blur-sm flex items-center justify-center">
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-[10px] text-indigo-600 font-black animate-pulse uppercase tracking-[0.2em]">Cargando...</p>
                    </div>
                </div>
            )}

            {/* Product Modal */}
            {isProductModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-sm rounded-[24px] shadow-2xl overflow-hidden border border-white/20 animate-in zoom-in-95 duration-300">
                        <div className="px-6 py-4 bg-orange-50 border-b border-orange-100 flex justify-between items-center">
                            <h3 className="text-sm font-black text-orange-900 uppercase tracking-widest">{t('addProduct')}</h3>
                            <button onClick={() => setIsProductModalOpen(false)} className="text-orange-400 hover:text-orange-600 transition-colors font-black">✕</button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('productName')}</label>
                                <input 
                                    type="text" 
                                    value={newProduct.name} 
                                    onChange={e => setNewProduct({...newProduct, name: e.target.value})}
                                    placeholder="Nombre del producto..."
                                    className="w-full px-4 py-2.5 bg-slate-50 border-2 border-slate-100 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-400/5 transition-all shadow-sm"
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('rawMaterialCost')}</label>
                                <PriceInput value={newProduct.rawMaterial} onChange={(v: any) => setNewProduct({...newProduct, rawMaterial: v})} color="orange" />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('packagingCost')}</label>
                                <PriceInput value={newProduct.packaging} onChange={(v: any) => setNewProduct({...newProduct, packaging: v})} color="orange" />
                            </div>
                            <Button 
                                onClick={handleAddProduct}
                                className="w-full h-11 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-black text-xs shadow-lg shadow-orange-600/20 active:scale-95 transition-all mt-2"
                            >
                                {t('saveProduct')}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Chart Modal */}
            {isChartModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-5xl rounded-[32px] shadow-2xl overflow-hidden border border-white/20 animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
                        <div className="px-8 py-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center flex-shrink-0">
                            <div className="flex flex-col">
                                <h3 className="text-lg font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">📉 Gráfica de Punto de Equilibrio</h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{tProd(`months.${selectedMonth}`)} {selectedYear}</p>
                            </div>
                            <button onClick={() => setIsChartModalOpen(false)} className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 rounded-full text-slate-400 hover:text-slate-600 hover:shadow-md transition-all font-black text-xl">✕</button>
                        </div>
                        <div className="p-8 overflow-y-auto flex-1 bg-white">
                            <div ref={chartRef} className="w-full h-[500px] flex items-center justify-center">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={chartData} margin={{ top: 20, right: 40, left: 20, bottom: 40 }}>
                                        <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" vertical={false} />
                                        <XAxis 
                                            dataKey="ventas" 
                                            type="number"
                                            domain={[0, 'auto']}
                                            tickFormatter={(val) => `$${(val / 1000).toFixed(1)}k`}
                                            label={{ value: 'Ventas Totales ($)', position: 'insideBottom', offset: -20, fontSize: 11, fontStyle: 'italic', fontWeight: 800, fill: '#64748b' }} 
                                            fontSize={10} 
                                            tick={{ fill: '#64748b', fontWeight: 600 }} 
                                        />
                                        <YAxis 
                                            fontSize={10} 
                                            tick={{ fill: '#64748b', fontWeight: 600 }} 
                                            tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`} 
                                            label={{ value: 'Costos ($)', angle: -90, position: 'insideLeft', fontSize: 11, fontStyle: 'italic', fontWeight: 800, fill: '#64748b' }}
                                        />
                                        <Tooltip 
                                            formatter={(value: number) => formatCurrency(value)}
                                            labelFormatter={(label) => `Ventas: ${formatCurrency(label)}`}
                                            contentStyle={{ fontSize: '12px', borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.25)', padding: '16px' }}
                                            itemStyle={{ fontWeight: 900, padding: '4px 0' }}
                                        />
                                        <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: '900', paddingBottom: '20px' }} />
                                        
                                        {/* Sales Line */}
                                        <Line type="monotone" dataKey="ventas" name="Línea de Ventas" stroke="#10b981" strokeWidth={4} dot={{ r: 6, fill: '#10b981', strokeWidth: 4, stroke: '#fff' }} activeDot={{ r: 10, strokeWidth: 0 }} />
                                        
                                        {/* Total Costs Line */}
                                        <Line type="monotone" dataKey="costos" name="Costos Totales" stroke="#6366f1" strokeWidth={4} dot={{ r: 6, fill: '#6366f1', strokeWidth: 4, stroke: '#fff' }} activeDot={{ r: 10, strokeWidth: 0 }} />
                                        
                                        {/* Fixed Costs Line (Horizontal) */}
                                        <Line type="monotone" dataKey="fijos" name="Costos Fijos" stroke="#94a3b8" strokeWidth={2} strokeDasharray="6 6" dot={false} activeDot={false} />
                                        
                                        {/* Variable Costs Line (Slope) */}
                                        <Line type="monotone" dataKey="variables" name="Costos Variables" stroke="#f97316" strokeWidth={2} strokeDasharray="4 4" dot={false} opacity={0.5} activeDot={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                        <div className="px-8 py-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 flex-shrink-0">
                             <Button onClick={() => setIsChartModalOpen(false)} className="px-6 h-10 bg-white border border-slate-200 text-slate-600 rounded-xl font-black text-xs hover:bg-slate-100 transition-all">Cerrar</Button>
                             <Button onClick={handleExportExcel} className="px-6 h-10 bg-indigo-600 text-white rounded-xl font-black text-xs hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-2">
                                <span>📗</span> Exportar Reporte
                             </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}


