'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/contexts/ThemeContext';
import Button from '@/components/Button';
import Input from '@/components/Input';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
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
import PageShell from '@/components/PageShell';
import { TrendingUp, BarChart3, Package, Building2, Target, Download, Save, RotateCcw, X, Trash2, Plus, Search, Check, ListPlus, Loader2 } from 'lucide-react';

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

// Modern Price Input Component
const PriceInput = ({ value, onChange, onBlur, className, color = 'indigo', disabled = false }: any) => {
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
        const parts = raw.split('.');
        if (parts.length > 2) raw = parts[0] + '.' + parts.slice(1).join('');
        setDisplayValue(e.target.value);
        const num = parseFloat(raw) || 0;
        onChange(num);
    };

    const colorClasses: Record<string, string> = {
        indigo: 'focus-within:ring-indigo-500 text-indigo-900',
        orange: 'focus-within:ring-orange-500 text-orange-900',
        emerald: 'focus-within:ring-emerald-500 text-emerald-900'
    };

    const currentClasses = colorClasses[color] || colorClasses.indigo;

    return (
        <div className={`flex items-center bg-white border-2 border-gray-200 rounded-lg overflow-hidden transition-all focus-within:ring-2 focus-within:ring-offset-0 ${currentClasses.split(' ').slice(0, 1).join(' ')} ${className} ${disabled ? 'bg-gray-50 opacity-60' : ''}`}>
            <div className="pl-3 pr-1 py-2.5 flex items-center pointer-events-none bg-gray-50 border-r border-gray-200">
                <span className={`text-sm font-bold ${currentClasses.split(' ').pop()}`}>$</span>
            </div>
            <input
                type="text"
                value={isFocused ? displayValue.replace(/,/g, '') : displayValue}
                onChange={handleChange}
                onFocus={() => setIsFocused(true)}
                onBlur={() => {
                    setIsFocused(false);
                    if (onBlur) onBlur();
                }}
                disabled={disabled}
                className="w-full px-3 py-2.5 outline-none text-sm font-bold text-gray-900 text-right bg-transparent disabled:cursor-not-allowed"
            />
        </div>
    );
};

export default function BreakEvenPage() {

    const t = useTranslations('BreakEven');
    const tCommon = useTranslations('Common');
    const tProd = useTranslations('Production');
    const { colors } = useTheme();

    const expenseInputsRef = useRef<(HTMLInputElement | null)[]>([]);
    const chartRef = useRef<HTMLDivElement>(null);

    const [branches, setBranches] = useState<Branch[]>([]);
    const [selectedBranch, setSelectedBranch] = useState<string>('');
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [project, setProject] = useState<any>(null);

    const [monthlySales, setMonthlySales] = useState<number>(0);
    const [avgTicket, setAvgTicket] = useState<number>(0);
    const [volume, setVolume] = useState<number>(0);
    const [rawMaterial, setRawMaterial] = useState<number>(0);
    const [packaging, setPackaging] = useState<number>(0);
    const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([]);
    const [representativeProducts, setRepresentativeProducts] = useState<any[]>([]);
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [newProduct, setNewProduct] = useState({ name: '', rawMaterial: 0, packaging: 0 });
    const [isChartModalOpen, setIsChartModalOpen] = useState(false);
    const [isFullExpensesModalOpen, setIsFullExpensesModalOpen] = useState(false);
    const [isFullProductsModalOpen, setIsFullProductsModalOpen] = useState(false);

    // Selector de conceptos de gasto (con sugerencia del mes anterior inmediato)
    const [isConceptsModalOpen, setIsConceptsModalOpen] = useState(false);
    const [concepts, setConcepts] = useState<{ concepto: string; monto: number; movimientos: number }[]>([]);
    const [conceptsLoading, setConceptsLoading] = useState(false);
    const [conceptSearch, setConceptSearch] = useState('');
    const [selectedConcepts, setSelectedConcepts] = useState<Set<string>>(new Set());
    const [prevPeriod, setPrevPeriod] = useState<{ m: number; y: number } | null>(null);

    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [autoSaveStatus, setAutoSaveStatus] = useState<'saved' | 'saving' | 'error' | null>(null);
    const preventAutoSaveRef = useRef(false);
    const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

    const avgSalesAmount = monthlySales;

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

    const sumVariableCosts = avgRawMaterial + avgPackaging;
    const variableCostsTotal = sumVariableCosts * volume;

    const unitContributionMargin = avgTicket - sumVariableCosts;
    const totalFixedExpenses = fixedExpenses.reduce((sum, exp) => sum + (exp.Monto || 0), 0);
    const totalCostsPerPeriod = totalFixedExpenses + variableCostsTotal;

    const breakEvenUnits = unitContributionMargin > 0 ? totalFixedExpenses / unitContributionMargin : 0;
    const breakEvenDollars = breakEvenUnits * avgTicket;
    const dailyBreakEvenUnits = breakEvenUnits / 30;
    const dailyBreakEvenDollars = breakEvenDollars / 30;

    useEffect(() => {
        if (fixedExpenses.length > 0) {
            const lastIdx = fixedExpenses.length - 1;
            if (expenseInputsRef.current[lastIdx] && !fixedExpenses[lastIdx].ConceptoGasto) {
                expenseInputsRef.current[lastIdx]?.focus();
            }
        }
    }, [fixedExpenses.length]);

    const handleSalesChange = (val: number) => {
        setMonthlySales(val);
        const newAvg = volume > 0 ? val / volume : 0;
        setAvgTicket(newAvg);
    };

    const handleVolumeChange = (val: number) => {
        const intVal = Math.round(val);
        setVolume(intVal);
        const newAvg = intVal > 0 ? monthlySales / intVal : 0;
        setAvgTicket(newAvg);
    };

    const handleAvgTicketChange = (val: number) => {
        setAvgTicket(val);
        const newVol = val > 0 ? Math.round(monthlySales / val) : 0;
        setVolume(newVol);
    };

    const chartData = useMemo(() => {
        const points = [];

        points.push({
            name: 'Inicio',
            ventas: 0,
            costos: totalFixedExpenses,
            fijos: totalFixedExpenses,
            variables: 0
        });

        if (breakEvenDollars > 0) {
            points.push({
                name: 'Pto. Equilibrio',
                ventas: breakEvenDollars,
                costos: breakEvenDollars,
                fijos: totalFixedExpenses,
                variables: breakEvenDollars - totalFixedExpenses
            });
        }

        if (monthlySales > 0) {
            points.push({
                name: 'Actual',
                ventas: monthlySales,
                costos: totalCostsPerPeriod,
                fijos: totalFixedExpenses,
                variables: variableCostsTotal
            });
        }

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
        preventAutoSaveRef.current = true;
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
                const vol = Math.round(data.data.VolumenTickets || 0);
                setVolume(vol);
                setMonthlySales(price * vol);
                setAvgTicket(price);
                setRawMaterial(data.data.CostoMateriaPrima || 0);
                setPackaging(data.data.Empaque || 0);
                setFixedExpenses(data.data.fixedExpenses || []);
                setRepresentativeProducts(data.data.representativeProducts || []);
            } else {
                setMonthlySales(0); setVolume(0); setAvgTicket(0); setRawMaterial(0); setPackaging(0); setFixedExpenses([]);
                setRepresentativeProducts([]);
            }
        } catch (error) {
            console.error('Error fetching break-even data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleImportPreviousMonth = async () => {
        if (!selectedBranch || !project?.idProyecto) return;

        let prevMonth = selectedMonth;
        let prevYear = selectedYear;
        if (prevMonth === 0) {
            prevMonth = 11;
            prevYear -= 1;
        } else {
            prevMonth -= 1;
        }

        if (!confirm(`¿Deseas importar los datos del mes anterior? Esto reemplazará los datos actuales.`)) return;

        setIsLoading(true);
        try {
            const params = new URLSearchParams({
                projectId: project.idProyecto,
                branchId: selectedBranch,
                month: (prevMonth + 1).toString(),
                year: prevYear.toString()
            });
            const response = await fetch(`/api/config/break-even?${params}`);
            const data = await response.json();
            if (data.success && data.data) {
                const price = data.data.PrecioTicket || 0;
                const vol = Math.round(data.data.VolumenTickets || 0);
                setVolume(vol);
                setMonthlySales(price * vol);
                setAvgTicket(price);
                setRawMaterial(data.data.CostoMateriaPrima || 0);
                setPackaging(data.data.Empaque || 0);
                setFixedExpenses(data.data.fixedExpenses || []);
                setRepresentativeProducts(data.data.representativeProducts || []);
                alert('Datos importados correctamente. No olvides guardar los cambios.');
            } else {
                alert('No se encontraron datos en el mes anterior.');
            }
        } catch (error) {
            console.error('Error importing previous month data:', error);
            alert('Error al importar datos.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async (silent = false) => {
        if (!project || !selectedBranch || isLoading) return;
        if (!silent) setIsSaving(true);
        try {
            const response = await fetch('/api/config/break-even', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: project.idProyecto, branchId: selectedBranch, month: selectedMonth + 1, year: selectedYear,
                    price: avgTicket, volume: volume,
                    rawMaterial: representativeProducts.length > 0 ? avgRawMaterial : rawMaterial,
                    packaging: representativeProducts.length > 0 ? avgPackaging : packaging,
                    fixedExpenses, representativeProducts
                })
            });
            const data = await response.json();
            if (data.success) {
                if (!silent) alert(t('successSave'));
                if (silent) setAutoSaveStatus('saved');
            } else {
                if (!silent) alert(t('errorSave'));
                if (silent) setAutoSaveStatus('error');
            }
        } catch (error) {
            console.error('Error saving break-even data:', error);
            if (!silent) alert(t('errorSave'));
            if (silent) setAutoSaveStatus('error');
        } finally {
            if (!silent) setIsSaving(false);
        }
    };

    useEffect(() => {
        if (isLoading || !selectedBranch || !project) return;

        if (preventAutoSaveRef.current) {
            preventAutoSaveRef.current = false;
            return;
        }

        setAutoSaveStatus('saving');
        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = setTimeout(() => {
            handleSave(true);
        }, 1500);

        return () => {
            if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current);
                handleSave(true);
            }
        };
    }, [monthlySales, volume, avgTicket, rawMaterial, packaging, fixedExpenses, representativeProducts]);

    const flushSave = () => {
        if (autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current);
            autoSaveTimerRef.current = null;
        }
        handleSave(true);
    };

    const handleAddExpense = () => setFixedExpenses([...fixedExpenses, { ConceptoGasto: '', Monto: 0 }]);
    const handleDeleteExpense = (index: number) => setFixedExpenses(fixedExpenses.filter((_, i) => i !== index));

    // Abre el selector de conceptos y trae el gasto del mes anterior inmediato.
    const openConceptsModal = async () => {
        setIsConceptsModalOpen(true);
        setSelectedConcepts(new Set());
        setConceptSearch('');
        if (!project?.idProyecto || !selectedBranch) { setConcepts([]); return; }
        setConceptsLoading(true);
        try {
            const params = new URLSearchParams({
                projectId: project.idProyecto, branchId: selectedBranch,
                month: (selectedMonth + 1).toString(), year: selectedYear.toString(),
            });
            const res = await fetch(`/api/config/break-even/expense-concepts?${params}`);
            const data = await res.json();
            if (data.success) { setConcepts(data.concepts || []); setPrevPeriod({ m: data.prevMonth, y: data.prevYear }); }
            else setConcepts([]);
        } catch { setConcepts([]); }
        finally { setConceptsLoading(false); }
    };

    const toggleConcept = (c: string) => setSelectedConcepts(prev => {
        const next = new Set(prev);
        if (next.has(c)) next.delete(c); else next.add(c);
        return next;
    });

    // Agrega los conceptos seleccionados como gastos fijos, con el monto sugerido
    // (lo gastado en ese concepto el mes anterior inmediato). Evita duplicados.
    const addSelectedConcepts = () => {
        const existing = new Set(fixedExpenses.map(e => (e.ConceptoGasto || '').trim().toLowerCase()));
        const toAdd = concepts
            .filter(c => selectedConcepts.has(c.concepto) && !existing.has(c.concepto.trim().toLowerCase()))
            .map(c => ({ ConceptoGasto: c.concepto, Monto: Math.round((c.monto || 0) * 100) / 100 }));
        if (toAdd.length) setFixedExpenses(prev => [...prev, ...toAdd]);
        setIsConceptsModalOpen(false);
    };

    const filteredConcepts = concepts.filter(c => c.concepto.toLowerCase().includes(conceptSearch.trim().toLowerCase()));
    const prevLabel = prevPeriod ? `${tProd(`months.${prevPeriod.m - 1}`)} ${prevPeriod.y}` : '';
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

    const handleExportPdf = async () => {
        setIsSaving(true);
        try {
            let chartDataUrl = '';
            if (chartRef.current) {
                try {
                    await new Promise(resolve => setTimeout(resolve, 100));
                    chartDataUrl = await toPng(chartRef.current, { backgroundColor: '#ffffff', quality: 1 });
                } catch (e) {
                    console.error('Error capturing chart:', e);
                }
            }

            const doc = new jsPDF();
            const branchName = branches.find(b => b.IdSucursal.toString() === selectedBranch)?.Sucursal || selectedBranch || 'Sucursal';
            const period = `${tProd(`months.${selectedMonth}`)} ${selectedYear}`;

            doc.setFillColor(31, 41, 55);
            doc.rect(0, 0, 210, 40, 'F');

            doc.setTextColor(255, 255, 255);
            doc.setFontSize(18);
            doc.setFont('helvetica', 'bold');
            doc.text('REPORTE DE PUNTO DE EQUILIBRIO', 105, 18, { align: 'center' });

            doc.setFontSize(12);
            doc.setFont('helvetica', 'normal');
            doc.text(`${branchName.toString().toUpperCase()} - ${period}`, 105, 28, { align: 'center' });

            doc.setTextColor(100, 116, 139);
            doc.setFontSize(8);
            doc.text(`Generado el: ${new Date().toLocaleString()}`, 10, 45);

            let currentY = 50;

            if (chartDataUrl) {
                doc.addImage(chartDataUrl, 'PNG', 10, 50, 190, 80);
                currentY = 140;
            } else {
                doc.setTextColor(150, 150, 150);
                doc.setFontSize(10);
                doc.text('(Gráfica no disponible)', 105, 70, { align: 'center' });
                currentY = 85;
            }

            autoTable(doc, {
                startY: currentY,
                head: [['RESUMEN DE VENTAS Y COSTOS VARIABLES', 'VALOR']],
                body: [
                    ['Ventas Totales Proyectadas', formatCurrency(avgSalesAmount || 0)],
                    ['Ticket Promedio por Persona', formatCurrency(avgTicket || 0)],
                    ['Personas Atendidas en el Mes', (volume || 0).toString()],
                    ['Materia Prima (Unitario)', formatCurrency(avgRawMaterial || 0)],
                    ['Empaque (Unitario)', formatCurrency(avgPackaging || 0)],
                    ['Suma Costos Variables', formatCurrency(sumVariableCosts || 0)],
                    ['Margen de Contribución Unitario', formatCurrency(unitContributionMargin || 0)],
                ],
                theme: 'striped',
                headStyles: { fillColor: [79, 70, 229] },
                styles: { fontSize: 9 },
                columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } }
            });

            currentY = (doc as any).lastAutoTable?.finalY + 10 || currentY + 60;

            const fixedExpensesBody: any[][] = fixedExpenses.map(exp => [exp.ConceptoGasto || '-', formatCurrency(exp.Monto || 0)]);
            fixedExpensesBody.push([{ content: 'TOTAL GASTOS FIJOS', styles: { fontStyle: 'bold' } }, { content: formatCurrency(totalFixedExpenses || 0), styles: { fontStyle: 'bold' } }]);

            autoTable(doc, {
                startY: currentY,
                head: [['GASTOS FIJOS MENSUALES', 'MONTO']],
                body: fixedExpensesBody,
                theme: 'striped',
                headStyles: { fillColor: [51, 65, 85] },
                styles: { fontSize: 9 },
                columnStyles: { 1: { halign: 'right' } }
            });

            currentY = (doc as any).lastAutoTable?.finalY + 10 || currentY + 40;

            autoTable(doc, {
                startY: currentY,
                head: [['RESULTADO: PUNTO DE EQUILIBRIO', 'OBJETIVO']],
                body: [
                    ['Personas Requeridas (Mensual)', Math.ceil(breakEvenUnits || 0).toLocaleString() + ' Personas'],
                    ['Venta Mensual Necesaria', formatCurrency(breakEvenDollars || 0)],
                    ['Personas Requeridas (Diario)', Math.ceil(dailyBreakEvenUnits || 0).toLocaleString() + ' Personas'],
                    ['Venta Diaria Necesaria', formatCurrency(dailyBreakEvenDollars || 0)],
                ],
                theme: 'grid',
                headStyles: { fillColor: [16, 185, 129] },
                styles: { fontSize: 10 },
                columnStyles: { 1: { halign: 'right', fontStyle: 'bold', textColor: [16, 185, 129] } }
            });

            doc.save(`Punto_Equilibrio_${branchName.toString().replace(/\s+/g, '_')}_${selectedMonth + 1}_${selectedYear}.pdf`);

        } catch (error) {
            console.error('Detailed Error exporting PDF:', error);
            alert('Error al generar el PDF: ' + (error instanceof Error ? error.message : 'Error desconocido'));
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <PageShell title={t('title')} icon={TrendingUp} actions={
            <div className="flex items-center gap-2 flex-wrap">
                {autoSaveStatus && (
                    <div className={`text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-2 ${
                        autoSaveStatus === 'saving' ? 'bg-blue-100 text-blue-700' :
                        autoSaveStatus === 'saved' ? 'bg-emerald-100 text-emerald-700' :
                        'bg-red-100 text-red-700'
                    }`}>
                        {autoSaveStatus === 'saving' && <div className="w-3 h-3 border-2 border-blue-700 border-t-transparent rounded-full animate-spin" />}
                        {autoSaveStatus === 'saved' && <div className="w-3 h-3 text-emerald-700">✓</div>}
                        {autoSaveStatus === 'error' && <div className="w-3 h-3 text-red-700">!</div>}
                        {autoSaveStatus === 'saving' ? 'Guardando...' : autoSaveStatus === 'saved' ? 'Guardado' : 'Error'}
                    </div>
                )}
                <select value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)} className="px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-0">
                    {branches.map(b => <option key={b.IdSucursal} value={b.IdSucursal}>{b.Sucursal}</option>)}
                </select>
                <select value={selectedMonth} onChange={(e) => setSelectedMonth(parseInt(e.target.value))} className="px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-0">
                    {Array.from({ length: 12 }, (_, i) => <option key={i} value={i}>{tProd(`months.${i}`)}</option>)}
                </select>
                <select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))} className="px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-0">
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <div className="flex gap-1.5">
                    <Button
                        onClick={handleImportPreviousMonth}
                        variant="outline"
                        size="sm"
                        leftIcon={RotateCcw}
                    >
                        Importar
                    </Button>
                    <Button
                        onClick={() => setIsChartModalOpen(true)}
                        variant="outline"
                        size="sm"
                        leftIcon={BarChart3}
                    >
                        Gráfica
                    </Button>
                    <Button onClick={handleExportPdf} variant="outline" size="sm" leftIcon={Download}>
                        Exportar
                    </Button>
                    <Button onClick={() => handleSave()} disabled={isSaving} variant="solid" size="sm" leftIcon={Save}>
                        {isSaving ? 'Guardando...' : 'Guardar'}
                    </Button>
                </div>
            </div>
        }>

            <div className="max-w-6xl mx-auto w-full flex flex-col gap-6 pb-20">

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                    {/* VENTAS Y VOLUMEN */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-all">
                        <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-blue-50/50 border-b border-blue-200 flex items-center gap-3">
                            <BarChart3 size={20} style={{ color: colors.colorFondo1 }} />
                            <h2 className="text-sm font-bold uppercase tracking-wide text-gray-900">Ventas & Volumen</h2>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2 block">Ventas Totales Mensuales</label>
                                <PriceInput value={monthlySales} onChange={handleSalesChange} onBlur={flushSave} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2 block">Personas atendidas en el mes</label>
                                <div className="flex items-center bg-white border-2 border-gray-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500/20">
                                    <div className="pl-3 pr-1 py-2.5 flex items-center bg-gray-50 border-r border-gray-200">
                                        <span className="text-sm font-bold text-gray-900">#</span>
                                    </div>
                                    <input
                                        type="number"
                                        step="1"
                                        value={volume}
                                        onChange={e => handleVolumeChange(parseInt(e.target.value) || 0)}
                                        onBlur={flushSave}
                                        className="w-full px-3 py-2.5 outline-none text-sm font-bold text-gray-900 text-right bg-transparent"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2 block">Ticket Promedio por Persona</label>
                                <PriceInput value={avgTicket} onChange={handleAvgTicketChange} onBlur={flushSave} color="indigo" />
                            </div>
                        </div>
                    </div>

                    {/* COSTOS VARIABLES */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-all">
                        <div className="px-6 py-4 bg-gradient-to-r from-orange-50 to-orange-50/50 border-b border-orange-200 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Package size={20} className="text-orange-600" />
                                <h2 className="text-sm font-bold uppercase tracking-wide text-gray-900">Costos Variables</h2>
                                {representativeProducts.length > 0 && (
                                    <span className="text-xs font-bold bg-orange-200 text-orange-800 px-2 py-0.5 rounded-full">
                                        {representativeProducts.length}
                                    </span>
                                )}
                            </div>
                            <Button
                                onClick={() => setIsProductModalOpen(true)}
                                variant="solid"
                                size="sm"
                                leftIcon={Plus}
                            >
                                Agregar
                            </Button>
                        </div>
                        <div className="p-6 space-y-4">
                            {representativeProducts.length > 0 && (
                                <div className="space-y-2 max-h-24 overflow-y-auto">
                                    {representativeProducts.map((p, idx) => (
                                        <div key={idx} className="flex items-center justify-between gap-2 p-2 bg-orange-50/50 rounded-lg border border-orange-100">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-bold text-gray-800 truncate">{p.NombreProducto}</p>
                                                <p className="text-[11px] text-gray-600">MP: {formatCurrency(p.CostoMateriaPrima)} • E: {formatCurrency(p.Empaque)}</p>
                                            </div>
                                            <button onClick={() => handleDeleteProduct(idx)} className="p-1.5 text-orange-300 hover:text-red-600 hover:bg-red-50 rounded transition-all">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div className="space-y-3 pt-2">
                                <div>
                                    <label className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2 block">Materia Prima (Unitario)</label>
                                    <PriceInput value={avgRawMaterial} onChange={setRawMaterial} color="orange" disabled={representativeProducts.length > 0} />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2 block">Empaque (Unitario)</label>
                                    <PriceInput value={avgPackaging} onChange={setPackaging} color="orange" disabled={representativeProducts.length > 0} />
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2 pt-2">
                                <div className="p-3 bg-orange-50 rounded-lg border border-orange-100">
                                    <p className="text-[10px] font-bold text-orange-700 uppercase">Suma C.V.</p>
                                    <p className="text-sm font-black text-orange-600">{formatCurrency(sumVariableCosts)}</p>
                                </div>
                                <div className="p-3 bg-red-50 rounded-lg border border-red-100">
                                    <p className="text-[10px] font-bold text-red-700 uppercase">Total C.V.</p>
                                    <p className="text-sm font-black text-red-600">{formatCurrency(variableCostsTotal)}</p>
                                </div>
                                <div className="p-3 rounded-lg border" style={{ backgroundColor: `${colors.colorFondo1}15`, borderColor: `${colors.colorFondo1}40` }}>
                                    <p className="text-[10px] font-bold uppercase" style={{ color: colors.colorFondo1 }}>Margen</p>
                                    <p className="text-sm font-black" style={{ color: colors.colorFondo1 }}>{formatCurrency(unitContributionMargin)}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* GASTOS FIJOS */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-all lg:col-span-2">
                        <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-gray-50/50 border-b border-gray-200 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Building2 size={20} className="text-gray-700" />
                                <h2 className="text-sm font-bold uppercase tracking-wide text-gray-900">Gastos Fijos</h2>
                                {fixedExpenses.length > 0 && (
                                    <span className="text-xs font-bold bg-gray-200 text-gray-800 px-2 py-0.5 rounded-full">
                                        {fixedExpenses.length}
                                    </span>
                                )}
                            </div>
                            <div className="flex gap-1.5">
                                <Button onClick={handleAddExpense} variant="outline" size="sm" leftIcon={Plus}>
                                    Manual
                                </Button>
                                <Button onClick={openConceptsModal} variant="solid" size="sm" leftIcon={ListPlus}>
                                    Agregar
                                </Button>
                            </div>
                        </div>
                        <div className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                                {fixedExpenses.map((exp, idx) => (
                                    <div key={idx} className="flex items-end gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200 group hover:border-gray-300 transition-all">
                                        <div className="flex-1 min-w-0">
                                            <label className="text-[10px] font-bold text-gray-600 uppercase mb-1 block">Concepto</label>
                                            <input
                                                ref={el => { expenseInputsRef.current[idx] = el }}
                                                type="text"
                                                value={exp.ConceptoGasto}
                                                onChange={e => handleUpdateExpense(idx, 'ConceptoGasto', e.target.value)}
                                                onBlur={flushSave}
                                                placeholder="Ej: Renta"
                                                className="w-full px-2 py-1.5 bg-white border border-gray-200 rounded text-xs font-bold text-gray-900 outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400/20"
                                            />
                                        </div>
                                        <div className="w-40 flex-shrink-0">
                                            <label className="text-[10px] font-bold text-gray-600 uppercase mb-1 block">Monto</label>
                                            <PriceInput value={exp.Monto} onChange={(v: any) => handleUpdateExpense(idx, 'Monto', v)} onBlur={flushSave} />
                                        </div>
                                        <button onClick={() => handleDeleteExpense(idx)} className="p-1.5 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded transition-all opacity-0 group-hover:opacity-100 flex-shrink-0">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <div className="flex gap-3">
                                <div className="flex-1 p-4 bg-gray-50 rounded-lg border border-gray-200">
                                    <p className="text-xs font-bold text-gray-600 uppercase mb-1">Total Gastos Fijos</p>
                                    <p className="text-xl font-black text-gray-900">{formatCurrency(totalFixedExpenses)}</p>
                                </div>
                                <div className="flex-1 p-4 rounded-lg border-2" style={{ backgroundColor: `${colors.colorFondo1}10`, borderColor: `${colors.colorFondo1}30` }}>
                                    <p className="text-xs font-bold uppercase mb-1" style={{ color: colors.colorFondo1 }}>Costo Total</p>
                                    <p className="text-xl font-black" style={{ color: colors.colorFondo1 }}>{formatCurrency(totalCostsPerPeriod)}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* PUNTO DE EQUILIBRIO */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-all lg:col-span-2">
                        <div className="px-6 py-4 bg-gradient-to-r from-emerald-50 to-emerald-50/50 border-b border-emerald-200 flex items-center gap-3">
                            <Target size={20} className="text-emerald-600" />
                            <h2 className="text-sm font-bold uppercase tracking-wide text-gray-900">Análisis: Punto de Equilibrio</h2>
                        </div>
                        <div className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                                    <p className="text-xs font-bold text-gray-600 uppercase mb-2">Personas Diarias</p>
                                    <p className="text-2xl font-black text-gray-900">{Math.ceil(dailyBreakEvenUnits).toLocaleString()}</p>
                                    <p className="text-[11px] text-gray-500 mt-1">personas/día</p>
                                </div>
                                <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                                    <p className="text-xs font-bold text-emerald-700 uppercase mb-2">Venta Diaria</p>
                                    <p className="text-2xl font-black text-emerald-600">{formatCurrency(dailyBreakEvenDollars)}</p>
                                    <p className="text-[11px] text-emerald-600/70 mt-1">requerido</p>
                                </div>
                                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                                    <p className="text-xs font-bold text-gray-600 uppercase mb-2">Personas Mensuales</p>
                                    <p className="text-2xl font-black text-gray-900">{Math.ceil(breakEvenUnits).toLocaleString()}</p>
                                    <p className="text-[11px] text-gray-500 mt-1">personas/mes</p>
                                </div>
                                <div className="p-4 rounded-lg border-2" style={{ backgroundColor: `${colors.colorFondo1}10`, borderColor: `${colors.colorFondo1}30` }}>
                                    <p className="text-xs font-bold uppercase mb-2" style={{ color: colors.colorFondo1 }}>Venta Mensual</p>
                                    <p className="text-2xl font-black" style={{ color: colors.colorFondo1 }}>{formatCurrency(breakEvenDollars)}</p>
                                    <p className="text-[11px] mt-1" style={{ color: `${colors.colorFondo1}70` }}>requerido</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {isLoading && (
                <div className="fixed inset-0 z-[100] bg-white/60 backdrop-blur-sm flex items-center justify-center">
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-8 h-8 border-3 rounded-full animate-spin" style={{ borderColor: colors.colorFondo1, borderTopColor: 'transparent' }}></div>
                        <p className="text-sm font-bold uppercase tracking-wide" style={{ color: colors.colorFondo1 }}>Cargando...</p>
                    </div>
                </div>
            )}

            {/* Product Modal */}
            {isProductModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-sm rounded-xl shadow-2xl overflow-hidden border border-gray-200">
                        <div className="px-6 py-4 bg-orange-50 border-b border-orange-200 flex justify-between items-center">
                            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Agregar Producto Representativo</h3>
                            <button onClick={() => setIsProductModalOpen(false)} className="p-1 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded transition-all">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2 block">Nombre del Producto</label>
                                <Input
                                    type="text"
                                    value={newProduct.name}
                                    onChange={e => setNewProduct({...newProduct, name: e.target.value})}
                                    placeholder="Ej: Tacos al pastor"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2 block">Costo Materia Prima</label>
                                <PriceInput value={newProduct.rawMaterial} onChange={(v: any) => setNewProduct({...newProduct, rawMaterial: v})} color="orange" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2 block">Costo Empaque</label>
                                <PriceInput value={newProduct.packaging} onChange={(v: any) => setNewProduct({...newProduct, packaging: v})} color="orange" />
                            </div>
                            <Button
                                onClick={handleAddProduct}
                                variant="solid"
                                className="w-full"
                            >
                                Agregar Producto
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Selector de conceptos de gasto */}
            {isConceptsModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setIsConceptsModalOpen(false)}>
                    <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl overflow-hidden border border-gray-200 flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
                        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center flex-shrink-0">
                            <div>
                                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide flex items-center gap-2">
                                    <ListPlus size={18} /> Agregar gastos fijos por concepto
                                </h3>
                                {prevLabel && <p className="text-xs text-gray-500 mt-1">Monto sugerido = lo gastado el mes anterior ({prevLabel})</p>}
                            </div>
                            <button onClick={() => setIsConceptsModalOpen(false)} className="p-1 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded transition-all"><X size={20} /></button>
                        </div>

                        {/* Buscador */}
                        <div className="px-6 pt-4 flex-shrink-0">
                            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 focus-within:border-gray-400">
                                <Search size={16} className="text-gray-400" />
                                <input value={conceptSearch} onChange={e => setConceptSearch(e.target.value)} placeholder="Buscar concepto…" autoFocus
                                    className="w-full py-2.5 bg-transparent outline-none text-sm text-gray-800 placeholder:text-gray-400" />
                            </div>
                        </div>

                        {/* Lista seleccionable */}
                        <div className="px-6 py-3 overflow-y-auto flex-1">
                            {conceptsLoading ? (
                                <div className="flex items-center justify-center gap-2 text-gray-400 py-12"><Loader2 size={18} className="animate-spin" /> Cargando conceptos…</div>
                            ) : filteredConcepts.length === 0 ? (
                                <div className="text-center text-gray-400 py-12 text-sm">No hay conceptos que coincidan.</div>
                            ) : (
                                <div className="space-y-1.5">
                                    {filteredConcepts.map(c => {
                                        const sel = selectedConcepts.has(c.concepto);
                                        const already = fixedExpenses.some(e => (e.ConceptoGasto || '').trim().toLowerCase() === c.concepto.trim().toLowerCase());
                                        return (
                                            <button key={c.concepto} onClick={() => toggleConcept(c.concepto)} disabled={already}
                                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all ${already ? 'opacity-40 cursor-not-allowed border-gray-100 bg-gray-50' : sel ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200 hover:border-gray-300 bg-white'}`}>
                                                <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${sel ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300'}`}>
                                                    {sel && <Check size={13} className="text-white" />}
                                                </span>
                                                <span className="flex-1 min-w-0">
                                                    <span className="block text-sm font-bold text-gray-800 truncate">
                                                        {c.concepto}{already && <span className="text-[10px] text-gray-400 font-semibold ml-1">(ya agregado)</span>}
                                                    </span>
                                                </span>
                                                <span className="text-right flex-shrink-0">
                                                    <span className="block text-sm font-black text-gray-900">{formatCurrency(c.monto)}</span>
                                                    <span className="block text-[10px] text-gray-400">{c.monto > 0 ? prevLabel : 'sin gasto previo'}</span>
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between gap-3 flex-shrink-0">
                            <span className="text-xs font-bold text-gray-600">{selectedConcepts.size} seleccionado(s)</span>
                            <div className="flex gap-2">
                                <Button onClick={() => setIsConceptsModalOpen(false)} variant="outline" size="sm">Cancelar</Button>
                                <Button onClick={addSelectedConcepts} disabled={selectedConcepts.size === 0} variant="solid" size="sm" leftIcon={Plus}>
                                    Agregar {selectedConcepts.size > 0 ? `(${selectedConcepts.size})` : ''}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Chart Modal */}
            {isChartModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-5xl rounded-xl shadow-2xl overflow-hidden border border-gray-200 flex flex-col max-h-[90vh]">
                        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center flex-shrink-0">
                            <div>
                                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide flex items-center gap-2">
                                    <BarChart3 size={18} />
                                    Gráfica de Punto de Equilibrio
                                </h3>
                                <p className="text-xs text-gray-600 mt-1">{tProd(`months.${selectedMonth}`)} {selectedYear}</p>
                            </div>
                            <button onClick={() => setIsChartModalOpen(false)} className="p-1 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded transition-all">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1 bg-white">
                            <div className="w-full h-[500px] flex items-center justify-center">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={chartData} margin={{ top: 20, right: 40, left: 20, bottom: 40 }}>
                                        <CartesianGrid strokeDasharray="4 4" stroke="#e5e7eb" vertical={false} />
                                        <XAxis
                                            dataKey="ventas"
                                            type="number"
                                            domain={[0, 'auto']}
                                            tickFormatter={(val) => `$${(val / 1000).toFixed(1)}k`}
                                            label={{ value: 'Ventas Totales ($)', position: 'insideBottom', offset: -20, fontSize: 11, fontWeight: 700, fill: '#6b7280' }}
                                            fontSize={10}
                                            tick={{ fill: '#6b7280', fontWeight: 600 }}
                                        />
                                        <YAxis
                                            fontSize={10}
                                            tick={{ fill: '#6b7280', fontWeight: 600 }}
                                            tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
                                            label={{ value: 'Costos ($)', angle: -90, position: 'insideLeft', fontSize: 11, fontWeight: 700, fill: '#6b7280' }}
                                        />
                                        <Tooltip
                                            formatter={(value: number) => formatCurrency(value)}
                                            labelFormatter={(label) => `Ventas: ${formatCurrency(label)}`}
                                            contentStyle={{ fontSize: '12px', borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', padding: '12px' }}
                                            itemStyle={{ fontWeight: 700, padding: '4px 0' }}
                                        />
                                        <Legend verticalAlign="top" height={32} wrapperStyle={{ fontSize: '11px', fontWeight: '700', paddingBottom: '20px' }} />

                                        <Line type="monotone" dataKey="ventas" name="Ventas" stroke="#10b981" strokeWidth={3} dot={{ r: 5, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 8, strokeWidth: 0 }} />
                                        <Line type="monotone" dataKey="costos" name="Costos Totales" stroke="#6366f1" strokeWidth={3} dot={{ r: 5, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 8, strokeWidth: 0 }} />
                                        <Line type="monotone" dataKey="fijos" name="Costos Fijos" stroke="#9ca3af" strokeWidth={2} strokeDasharray="6 6" dot={false} />
                                        <Line type="monotone" dataKey="variables" name="Costos Variables" stroke="#f97316" strokeWidth={2} strokeDasharray="4 4" dot={false} opacity={0.6} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3 flex-shrink-0">
                            <Button onClick={() => setIsChartModalOpen(false)} variant="outline" size="sm">Cerrar</Button>
                            <Button onClick={handleExportPdf} variant="solid" size="sm" leftIcon={Download}>Exportar PDF</Button>
                        </div>
                    </div>
                </div>
            )}
        </PageShell>
    );
}
