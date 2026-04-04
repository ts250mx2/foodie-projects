const fs = require('fs');
let file = 'src/app/[locale]/dashboard/page.tsx';
let txt = fs.readFileSync(file, 'utf8');

// 1. Add wasteDetailData state
txt = txt.replace(
    /const \[purchaseDetailData, setPurchaseDetailData\] = useState([^;]+);/g,
    `const [purchaseDetailData, setPurchaseDetailData] = useState$1;
    const [wasteDetailData, setWasteDetailData] = useState<{
        categories: any[];
        days: any[];
        totalWaste: number;
    } | null>(null);`
);

// 2. Add fetchWasteDetails function
txt = txt.replace(
    /const fetchPurchaseDetails = async \(\) => {[\s\S]*?finally {\n            setIsLoadingDetails\(false\);\n        }\n    };\n/g,
    match => match + `
    const fetchWasteDetails = async () => {
        if (!project?.idProyecto || !selectedBranch || selectedKpi !== 'waste') return;

        setIsLoadingDetails(true);
        try {
            const response = await fetch(\`/api/dashboard/waste-details?projectId=\${project.idProyecto}&branchId=\${selectedBranch}&month=\${selectedMonth}&year=\${selectedYear}\`);
            const data = await response.json();
            if (data.success) {
                setWasteDetailData(data.data);
                if (!['categories', 'days'].includes(detailGrouping)) {
                    setDetailGrouping('categories');
                }
            }
        } catch (error) {
            console.error('Error fetching waste details:', error);
        } finally {
            setIsLoadingDetails(false);
        }
    };
`
);

// 3. Update selectedKpi useEffect
txt = txt.replace(
    /} else if \(selectedKpi === 'purchases'\) {\n            fetchPurchaseDetails\(\);\n        }/g,
    `} else if (selectedKpi === 'purchases') {
            fetchPurchaseDetails();
        } else if (selectedKpi === 'waste') {
            fetchWasteDetails();
        }`
);

// 4. Update Waste KPI Card (make it clickable)
txt = txt.replace(
    /<div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-all relative overflow-hidden group text-left">/g,
    (match, offset, str) => {
        // Only replace the ONE which is for Waste (Mermas). 
        // It's the last one.
        if (offset > str.lastIndexOf('Materia Prima')) {
            return `<div 
                    onClick={() => setSelectedKpi(selectedKpi === 'waste' ? null : 'waste')}
                    className={\`p-4 rounded-xl border transition-all relative overflow-hidden group text-left cursor-pointer \${selectedKpi === 'waste' ? 'bg-rose-50 border-rose-200 shadow-md ring-2 ring-rose-500 ring-opacity-20' : 'bg-white border-slate-100 shadow-sm hover:shadow-md'}\`}
                >`;
        }
        return match;
    }
);

// Mermas styling color inside the card (the title)
txt = txt.replace(
    /<span className="text-\[10px\] font-black text-slate-400 uppercase tracking-widest mb-1 block">Mermas<\/span>/g,
    `<span className={\`text-[10px] font-black uppercase tracking-widest mb-1 block \${selectedKpi === 'waste' ? 'text-rose-500' : 'text-slate-400'}\`}>Mermas</span>`
);


// 5. Update Detail Section visibility
txt = txt.replace(
    /\(selectedKpi === 'sales' \|\| selectedKpi === 'payroll' \|\| selectedKpi === 'expenses' \|\| selectedKpi === 'purchases'\)/g,
    `(selectedKpi === 'sales' || selectedKpi === 'payroll' || selectedKpi === 'expenses' || selectedKpi === 'purchases' || selectedKpi === 'waste')`
);

// 6. Update Detail Section Headers
txt = txt.replace(
    /selectedKpi === 'expenses' \? 'bg-rose-500' : 'bg-amber-500'/g,
    `selectedKpi === 'expenses' ? 'bg-rose-500' : selectedKpi === 'waste' ? 'bg-rose-700' : 'bg-amber-500'`
);
txt = txt.replace(
    /selectedKpi === 'expenses' \? 'Análisis Detallado de Gastos' : 'Análisis Detallado de Compras'/g,
    `selectedKpi === 'expenses' ? 'Análisis Detallado de Gastos' : selectedKpi === 'waste' ? 'Análisis Detallado de Mermas' : 'Análisis Detallado de Compras'`
);

// 7. Update groupings
txt = txt.replace(
    / : \(\n                                    <>\n                                        <button\n                                            onClick={\(\) => setDetailGrouping\('categories'\)}\n                                            className={`px-3 py-1\.5 rounded-md text-xs font-black transition-all \${detailGrouping === 'categories' \? 'bg-amber-500/g,
    ` : (selectedKpi === 'purchases' || selectedKpi === 'waste') ? (
                                    <>
                                        <button
                                            onClick={() => setDetailGrouping('categories')}
                                            className={\`px-3 py-1.5 rounded-md text-xs font-black transition-all \${detailGrouping === 'categories' ? (selectedKpi === 'waste' ? 'bg-rose-700' : 'bg-amber-500')`
);
txt = txt.replace(
    /'\)} text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}\n                                        >\n                                            Categoría\n                                        <\/button>\n                                        <button\n                                            onClick={\(\) => setDetailGrouping\('days'\)}\n                                            className={`px-3 py-1\.5 rounded-md text-xs font-black transition-all \${detailGrouping === 'days' \? 'bg-amber-500/g,
    `')} text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}\`}
                                        >
                                            Categoría
                                        </button>
                                        <button
                                            onClick={() => setDetailGrouping('days')}
                                            className={\`px-3 py-1.5 rounded-md text-xs font-black transition-all \${detailGrouping === 'days' ? (selectedKpi === 'waste' ? 'bg-rose-700' : 'bg-amber-500')`
);

// 8. Update data selector (ternary chaining)
txt = txt.replace(
    /selectedKpi === 'expenses' \? expenseDetailData : purchaseDetailData/g,
    `selectedKpi === 'expenses' ? expenseDetailData : selectedKpi === 'waste' ? wasteDetailData : purchaseDetailData`
);

txt = txt.replace(
    /selectedKpi === 'expenses' \? expenseDetailData\?\.totalExpenses : purchaseDetailData\?\.totalPurchases/g,
    `selectedKpi === 'expenses' ? expenseDetailData?.totalExpenses : selectedKpi === 'waste' ? wasteDetailData?.totalWaste : purchaseDetailData?.totalPurchases`
);

// Update colors and texts inside details loop
txt = txt.replace(
    /selectedKpi === 'expenses' \? 'hover:border-rose-200' : 'hover:border-amber-200'/g,
    `selectedKpi === 'expenses' ? 'hover:border-rose-200' : selectedKpi === 'waste' ? 'hover:border-rose-300' : 'hover:border-amber-200'`
);
txt = txt.replace(
    /selectedKpi === 'expenses' \? 'text-rose-500' : 'text-amber-500'/g,
    `selectedKpi === 'expenses' ? 'text-rose-500' : selectedKpi === 'waste' ? 'text-rose-700' : 'text-amber-500'`
);
txt = txt.replace(
    /selectedKpi === 'purchases' && detailGrouping === 'categories'/g,
    `['purchases', 'waste'].includes(selectedKpi) && detailGrouping === 'categories'`
);
txt = txt.replace(
    /selectedKpi === 'expenses' \? 'Detalle de gasto' : 'Detalle de compra'/g,
    `selectedKpi === 'expenses' ? 'Detalle de gasto' : selectedKpi === 'waste' ? 'Detalle de merma' : 'Detalle de compra'`
);
txt = txt.replace(
    /selectedKpi === 'expenses' \? 'text-rose-600' : 'text-amber-600'/g,
    `selectedKpi === 'expenses' ? 'text-rose-600' : selectedKpi === 'waste' ? 'text-rose-800' : 'text-amber-600'`
);

fs.writeFileSync(file, txt, 'utf8');
console.log('Update script finished.');
