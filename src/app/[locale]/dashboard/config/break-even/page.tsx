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

export default function BreakEvenPage() {
    const t = useTranslations('BreakEven');
    const tCommon = useTranslations('Common');
    const tProd = useTranslations('Production');
    const { colors } = useTheme();

    // Refs for auto-focus and export
    const expenseInputsRef = useRef<(HTMLInputElement | null)[]>([]);
    const chartRef = useRef<HTMLDivElement>(null);

    // Local Price Input Component for consistent currency formatting
    const PriceInput = ({ value, onChange, className, color = 'indigo' }: any) => {
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
            let raw = e.target.value.replace(/[^0-9.]/g, '');
            // Handle multiple decimals
            const parts = raw.split('.');
            if (parts.length > 2) raw = parts[0] + '.' + parts.slice(1).join('');
            
            setDisplayValue(e.target.value);
            const num = parseFloat(raw) || 0;
            onChange(num);
        };

        return (
            <div className={`flex items-center bg-white border-2 border-slate-200 rounded-xl overflow-hidden focus-within:border-${color}-500 focus-within:ring-4 focus-within:ring-${color}-500/10 transition-all shadow-sm ${className}`}>
                <div className="pl-2.5 pr-1 py-1.5 flex items-center pointer-events-none bg-slate-50 border-r border-slate-100">
                    <span className={`text-${color}-900 text-[10px] font-black italic`}>$</span>
                </div>
                <input
                    type="text"
                    value={isFocused ? displayValue.replace(/,/g, '') : displayValue}
                    onChange={handleChange}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    className="w-full px-2 py-1.5 outline-none text-[10px] font-black text-slate-900 text-right bg-transparent"
                />
            </div>
        );
    };

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
    const [scenarios, setScenarios] = useState<Scenario[]>(
        Array.from({ length: 5 }, (_, i) => ({ IdEscenario: i + 1, PrecioTicket: 0, VolumenTickets: 0 }))
    );
    
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [showRightBlocks, setShowRightBlocks] = useState(true);

    // Calculated values (Main Analysis)
    const avgSalesAmount = monthlySales;
    const sumVariableCosts = rawMaterial + packaging + others + shipping;
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

    // Sync Scenario 1 with Main Analysis if Scenario 1 is empty or upon first load
    useEffect(() => {
        if (scenarios[0].PrecioTicket === 0 && scenarios[0].VolumenTickets === 0 && (avgTicket > 0 || volume > 0)) {
            const newScenarios = [...scenarios];
            newScenarios[0] = { ...newScenarios[0], PrecioTicket: avgTicket, VolumenTickets: volume };
            setScenarios(newScenarios);
        }
    }, [avgTicket, volume]);

    // Derived values for the Analysis Table
    const scenarioData = useMemo(() => {
        return scenarios.map(s => {
            const ventasTotales = s.PrecioTicket * s.VolumenTickets;
            const costosVariables = sumVariableCosts * s.VolumenTickets;
            const costosTotales = totalFixedExpenses + costosVariables;
            const margenBruto = costosTotales - ventasTotales; // As requested: Costs - Sales
            const margenVsCostosFijos = margenBruto - totalFixedExpenses;

            return {
                ...s,
                costosFijos: totalFixedExpenses,
                costosVariables,
                costosTotales,
                ventasTotales,
                margenBruto,
                margenVsCostosFijos
            };
        });
    }, [scenarios, sumVariableCosts, totalFixedExpenses]);

    // Chart Data
    const chartData = useMemo(() => {
        const base = scenarioData.map(d => ({
            name: `Esc. ${d.IdEscenario}`,
            ventas: d.ventasTotales,
            costos: d.costosTotales,
            fijos: d.costosFijos,
            variables: d.costosVariables,
            volumen: d.VolumenTickets
        }));

        // Add zero point for break-even visualization
        const zeroPoint = {
            name: 'Punto 0',
            ventas: 0,
            costos: 0,
            fijos: 0,
            variables: 0,
            volumen: 0
        };

        return [zeroPoint, ...base].sort((a, b) => a.ventas - b.ventas);
    }, [scenarioData, totalFixedExpenses]);

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
        setIsLoading(true);
        try {
            const params = new URLSearchParams({
                projectId: project.idProyecto, branchId: selectedBranch,
                month: (selectedMonth + 1).toString(), year: selectedYear.toString()
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
                
                if (data.data.scenarios && data.data.scenarios.length === 5) {
                    setScenarios(data.data.scenarios);
                } else {
                    setScenarios(Array.from({ length: 5 }, (_, i) => ({ 
                        IdEscenario: i + 1, 
                        PrecioTicket: i === 0 ? (data.data.PrecioTicket || 0) : 0, 
                        VolumenTickets: i === 0 ? (data.data.VolumenTickets || 0) : 0 
                    })));
                }
            } else {
                setMonthlySales(0); setVolume(0); setRawMaterial(0); setPackaging(0); setOthers(0); setShipping(0); setFixedExpenses([]);
                setScenarios(Array.from({ length: 5 }, (_, i) => ({ IdEscenario: i + 1, PrecioTicket: 0, VolumenTickets: 0 })));
            }
        } catch (error) { console.error('Error fetching break-even data:', error); } finally { setIsLoading(false); }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const response = await fetch('/api/config/break-even', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: project.idProyecto, branchId: selectedBranch, month: selectedMonth + 1, year: selectedYear,
                    price: avgTicket, volume: volume, rawMaterial, packaging, others, shipping, fixedExpenses, scenarios
                })
            });
            const data = await response.json();
            if (data.success) alert(t('successSave'));
            else alert(t('errorSave'));
        } catch (error) { console.error('Error saving break-even data:', error); alert(t('errorSave')); } finally { setIsSaving(false); }
    };

    const handleUpdateScenario = (index: number, field: keyof Scenario, value: number) => {
        const newScenarios = [...scenarios];
        newScenarios[index] = { ...newScenarios[index], [field]: value };
        setScenarios(newScenarios);
    };

    const handleAddExpense = () => setFixedExpenses([...fixedExpenses, { ConceptoGasto: '', Monto: 0 }]);
    const handleDeleteExpense = (index: number) => setFixedExpenses(fixedExpenses.filter((_, i) => i !== index));
    const handleUpdateExpense = (index: number, field: keyof FixedExpense, value: any) => {
        const newExpenses = [...fixedExpenses];
        newExpenses[index] = { ...newExpenses[index], [field]: value };
        setFixedExpenses(newExpenses);
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

            // --- RIGHT COLUMN (TABLE & CHART) ---
            // Header for Scenarios table
            const tableRow = 5;
            const scenarioHeaderCells = ['D', 'E', 'F', 'G', 'H', 'I'];
            const scenarioLabels = ['Concepto', 'Esc. 1', 'Esc. 2', 'Esc. 3', 'Esc. 4', 'Esc. 5'];
            scenarioHeaderCells.forEach((col, i) => {
                const cell = worksheet.getCell(`${col}${tableRow}`);
                cell.value = scenarioLabels[i];
                cell.fill = headerFill;
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
                cell.alignment = { horizontal: 'center' };
            });

            const drawScenarioRow = (rowOffset: number, label: string, dataKey: string, isCurr = true) => {
                const r = tableRow + rowOffset;
                worksheet.getCell(`D${r}`).value = label;
                worksheet.getCell(`D${r}`).font = { size: 8, bold: true };
                scenarioData.forEach((d, i) => {
                    const cell = worksheet.getCell(`${scenarioHeaderCells[i+1]}${r}`);
                    cell.value = (d as any)[dataKey];
                    if(isCurr) cell.numFmt = '"$"#,##0.00';
                    cell.font = { size: 8 };
                    cell.alignment = { horizontal: 'right' };
                });
            };

            drawScenarioRow(1, 'Precio Promedio', 'PrecioTicket');
            drawScenarioRow(2, 'Volumen Tickets', 'VolumenTickets', false);
            drawScenarioRow(3, 'Ventas Totales', 'ventasTotales');
            drawScenarioRow(4, 'Costos Fijos', 'costosFijos');
            drawScenarioRow(5, 'Costos Variables', 'costosVariables');
            drawScenarioRow(6, 'Costos Totales', 'costosTotales');
            drawScenarioRow(7, 'Margen Bruto', 'margenBruto');
            drawScenarioRow(8, 'Margen vs Fijos', 'margenVsCostosFijos');

            // --- INSERT CHART ---
            const imageId = workbook.addImage({
                base64: chartDataUrl.split(',')[1],
                extension: 'png',
            });

            worksheet.addImage(imageId, {
                tl: { col: 3, row: 14 }, // Starts at column D, row 15 (0-indexed)
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
                            onClick={() => setShowRightBlocks(!showRightBlocks)} 
                            className={`h-9 px-3 rounded-lg font-black text-xs shadow-md active:scale-95 transition-all flex items-center gap-2 ${showRightBlocks ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'}`}
                        >
                            {showRightBlocks ? '👁️ Ver Menos' : '📊 Ver Detalles'}
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

            <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-6 pb-8 transition-all duration-500">
                
                {/* COLUMN LEFT - BASIC BLOCKS */}
                <div className={`${showRightBlocks ? 'lg:col-span-4' : 'lg:col-span-6'} flex flex-col gap-6 transition-all duration-500`}>
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
                        <div className="px-5 py-3.5 bg-orange-50/50 border-b border-orange-100 flex items-center gap-3">
                            <span className="text-xl filter drop-shadow-sm">📦</span>
                            <h2 className="text-[13px] font-black text-orange-900 uppercase tracking-widest">{t('variableCostBlockTitle')}</h2>
                        </div>
                        <div className="p-5 space-y-2">
                            {[
                                { k: 'rawMaterialCost', v: rawMaterial, s: setRawMaterial },
                                { k: 'packagingCost', v: packaging, s: setPackaging },
                                { k: 'othersCost', v: others, s: setOthers },
                                { k: 'shippingCost', v: shipping, s: setShipping }
                            ].map(item => (
                                <div key={item.k} className="flex items-center justify-between gap-4 p-2 rounded-lg hover:bg-slate-50 transition-colors">
                                    <span className="text-[11px] font-black text-slate-500 uppercase flex-1">{t(item.k)}</span>
                                    <div className="w-32 flex-shrink-0">
                                        <PriceInput value={item.v} onChange={item.s} color="orange" />
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

                    {showRightBlocks && (
                        <>
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
                        </>
                    )}
                </div>

                {/* COLUMN RIGHT - ANALYSIS & CHART OR MOVED BLOCKS */}
                <div className={`${showRightBlocks ? 'lg:col-span-8' : 'lg:col-span-6'} flex flex-col gap-6 transition-all duration-500`}>
                    {showRightBlocks ? (
                        <>
                            {/* ANALYSIS BLOCK */}
                            <div className="bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden group hover:shadow-lg transition-all">
                                <div className="px-5 py-3.5 bg-slate-50 border-b border-indigo-100 flex items-center gap-3">
                                    <span className="text-xl filter drop-shadow-sm">📈</span>
                                    <h2 className="text-[13px] font-black text-indigo-950 uppercase tracking-widest">ANÁLISIS DEL VOLUMEN DE VENTA</h2>
                                </div>
                                <div className="p-5 overflow-x-auto">
                                    <table className="w-full text-left border-separate border-spacing-0">
                                        <thead>
                                            <tr>
                                                <th className="p-2.5 text-[10px] uppercase font-black text-slate-400">Concepto</th>
                                                {Array.from({ length: 5 }, (_, i) => (
                                                    <th key={i} className="p-2.5 text-[10px] uppercase font-black text-indigo-700 text-center bg-indigo-50/50 border-x border-white rounded-t-xl">Captura {i + 1}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="text-[11px] font-bold text-slate-600">
                                            <tr className="border-t border-slate-50">
                                                <td className="p-3 bg-slate-50/30 rounded-l-xl">Precio Promedio Ticket</td>
                                                {scenarios.map((s, i) => (
                                                    <td key={i} className="p-1 border-x border-slate-50">
                                                        <div className="min-w-[110px]">
                                                            <PriceInput value={s.PrecioTicket} onChange={(v: any) => handleUpdateScenario(i, 'PrecioTicket', v)} />
                                                        </div>
                                                    </td>
                                                ))}
                                            </tr>
                                            <tr className="border-t border-slate-50">
                                                <td className="p-3 bg-slate-50/30 rounded-l-xl">Volumen Total Tickets</td>
                                                {scenarios.map((s, i) => (
                                                    <td key={i} className="p-1 border-x border-slate-50">
                                                        <div className="min-w-[110px] flex items-center bg-white border-2 border-slate-100 rounded-lg overflow-hidden focus-within:ring-4 focus-within:ring-indigo-500/10 transition-all shadow-sm">
                                                            <div className="pl-2 pr-1 py-1.5 flex items-center bg-slate-50 border-r border-slate-100">
                                                                <span className="text-slate-400 text-[10px] font-bold">#</span>
                                                            </div>
                                                            <input type="number" value={s.VolumenTickets || ''} onChange={e => handleUpdateScenario(i, 'VolumenTickets', parseFloat(e.target.value) || 0)} className="w-full px-2 py-1.5 outline-none text-[10px] font-black text-slate-900 text-right bg-transparent" />
                                                        </div>
                                                    </td>
                                                ))}
                                            </tr>
                                            <tr className="border-t border-slate-50 bg-slate-50/10">
                                                <td className="p-3">Costos Fijos Por Mes</td>
                                                {scenarioData.map((d, i) => <td key={i} className="p-3 text-right border-x border-slate-50 text-slate-400">{formatCurrency(d.costosFijos)}</td>)}
                                            </tr>
                                            <tr className="border-t border-slate-50">
                                                <td className="p-3">Costos Variables</td>
                                                {scenarioData.map((d, i) => <td key={i} className="p-3 text-right border-x border-slate-50 text-orange-600 font-semibold">{formatCurrency(d.costosVariables)}</td>)}
                                            </tr>
                                            <tr className="border-t border-slate-100 bg-slate-100/10">
                                                <td className="p-3 font-black text-slate-800">Costos Totales</td>
                                                {scenarioData.map((d, i) => <td key={i} className="p-3 text-right border-x border-slate-100 font-black text-slate-900 bg-slate-50/30">{formatCurrency(d.costosTotales)}</td>)}
                                            </tr>
                                            <tr className="border-t border-slate-50">
                                                <td className="p-3 font-black text-emerald-800">Ventas Totales</td>
                                                {scenarioData.map((d, i) => <td key={i} className="p-3 text-right border-x border-slate-50 font-black text-emerald-600 bg-emerald-50/40">{formatCurrency(d.ventasTotales)}</td>)}
                                            </tr>
                                            <tr className="border-t border-slate-100 bg-slate-900/5">
                                                <td className="p-3 font-black italic text-slate-700">Margen Bruto (Costos - Ventas)</td>
                                                {scenarioData.map((d, i) => (
                                                    <td key={i} className={`p-3 text-right border-x border-slate-100 font-black ${d.margenBruto < 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
                                                        {formatCurrency(d.margenBruto)}
                                                    </td>
                                                ))}
                                            </tr>
                                            <tr className="border-t border-slate-100">
                                                <td className="p-3 font-black text-slate-800 bg-slate-50/20 rounded-bl-xl">Margen Vs Costos Fijos</td>
                                                {scenarioData.map((d, i) => (
                                                    <td key={i} className={`p-3 text-right border-x border-slate-100 font-black ${d.margenVsCostosFijos < 0 ? 'text-blue-700' : 'text-rose-700'}`}>
                                                        {formatCurrency(d.margenVsCostosFijos)}
                                                    </td>
                                                ))}
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* CHART BLOCK */}
                            <div className="bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden flex-1 min-h-[420px] group hover:shadow-lg transition-all">
                                <div className="px-5 py-3.5 bg-indigo-50/50 border-b border-indigo-100 flex items-center gap-3">
                                    <span className="text-xl filter drop-shadow-sm">📉</span>
                                    <h2 className="text-[13px] font-black text-indigo-900 uppercase tracking-widest">Gráfica de Punto de Equilibrio</h2>
                                </div>
                                <div ref={chartRef} className="p-6 h-full flex items-center justify-center bg-white">
                                    <ResponsiveContainer width="100%" height={360}>
                                        <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                                            <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" vertical={false} />
                                            <XAxis 
                                                dataKey="ventas" 
                                                type="number"
                                                domain={[0, 'auto']}
                                                tickFormatter={(val) => `$${(val / 1000).toFixed(1)}k`}
                                                label={{ value: 'Ventas Totales ($)', position: 'insideBottom', offset: -10, fontSize: 11, fontWeight: 800, fill: '#64748b' }} 
                                                fontSize={10} 
                                                tick={{ fill: '#64748b', fontWeight: 600 }} 
                                            />
                                            <YAxis fontSize={10} tick={{ fill: '#64748b', fontWeight: 600 }} tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`} />
                                            <Tooltip 
                                                formatter={(value: number) => formatCurrency(value)}
                                                contentStyle={{ fontSize: '11px', borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)', padding: '12px' }}
                                                itemStyle={{ fontWeight: 800, padding: '2px 0' }}
                                            />
                                            <Legend wrapperStyle={{ fontSize: '11px', fontWeight: '900', paddingTop: '20px', color: '#1e293b' }} iconType="circle" />
                                            <Line type="monotone" dataKey="ventas" name="Ventas Totales" stroke="#10b981" strokeWidth={4} dot={{ r: 6, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 8, strokeWidth: 0 }} />
                                            <Line type="monotone" dataKey="costos" name="Costos Totales" stroke="#6366f1" strokeWidth={4} dot={{ r: 6, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 8, strokeWidth: 0 }} />
                                            <Line type="monotone" dataKey="variables" name="Costos Variables" stroke="#f97316" strokeWidth={2} strokeDasharray="6 6" dot={false} opacity={0.7} />
                                            <Line type="monotone" dataKey="fijos" name="Costos Fijos" stroke="#94a3b8" strokeWidth={2} strokeDasharray="4 4" dot={false} opacity={0.7} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            {/* MOVED BLOCK 3: GASTOS FIJOS */}
                            <div className="bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden flex flex-col group hover:shadow-lg transition-all animate-in zoom-in-95 duration-500">
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
                                    <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
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

                            {/* MOVED BLOCK 4: RESULTADO PUNTO DE EQUILIBRIO */}
                            <div className="bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden group hover:shadow-lg transition-all animate-in slide-in-from-right-10 duration-500">
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
                        </>
                    )}
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
        </div>
    );
}
