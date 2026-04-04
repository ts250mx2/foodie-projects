const fs = require('fs');
let file = 'src/app/[locale]/dashboard/page.tsx';
let txt = fs.readFileSync(file, 'utf8');

// 1. Add state variable for Waste
const stateTarget = `    const [purchaseDetailData, setPurchaseDetailData] = useState<{
        categories: any[];
        days: any[];
        totalPurchases: number;
    } | null>(null);`;
const stateAdd = `    const [purchaseDetailData, setPurchaseDetailData] = useState<{
        categories: any[];
        days: any[];
        totalPurchases: number;
    } | null>(null);
    const [wasteDetailData, setWasteDetailData] = useState<{
        categories: any[];
        days: any[];
        totalWaste: number;
    } | null>(null);`;
txt = txt.replace(stateTarget, stateAdd);

// 2. Add fetch function
const fetchTarget = `    useEffect(() => {
        if (selectedKpi === 'sales') {`;
const fetchAdd = `    const fetchWasteDetails = async () => {
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

    useEffect(() => {
        if (selectedKpi === 'sales') {`;
txt = txt.replace(fetchTarget, fetchAdd);

// 3. Call fetch function in useEffect
const effectTarget = `        } else if (selectedKpi === 'purchases') {
            fetchPurchaseDetails();
        }
    }, [selectedKpi, selectedMonth, selectedYear, selectedBranch]);`;
const effectAdd = `        } else if (selectedKpi === 'purchases') {
            fetchPurchaseDetails();
        } else if (selectedKpi === 'waste') {
            fetchWasteDetails();
        }
    }, [selectedKpi, selectedMonth, selectedYear, selectedBranch]);`;
txt = txt.replace(effectTarget, effectAdd);

// 4. In Waste KPI card, allow clicking it!
const kpiTarget = `                {/* Waste KPI Card */}
                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-all relative overflow-hidden group text-left">`;
const kpiAdd = `                {/* Waste KPI Card */}
                <div 
                    onClick={() => setSelectedKpi(selectedKpi === 'waste' ? null : 'waste')}
                    className={\`p-4 rounded-xl border transition-all relative overflow-hidden group text-left cursor-pointer \${selectedKpi === 'waste' ? 'bg-pink-50 border-pink-200 shadow-md ring-2 ring-pink-500 ring-opacity-20' : 'bg-white border-slate-100 shadow-sm hover:shadow-md'}\`}
                >`;
txt = txt.replace(kpiTarget, kpiAdd);

fs.writeFileSync(file, txt, 'utf8');
console.log('Waste fully injected!');
