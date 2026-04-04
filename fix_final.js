const fs = require('fs');
let file = 'src/app/[locale]/dashboard/page.tsx';
let txt = fs.readFileSync(file, 'utf8');

// Fix 1: The ternary data selector logic everywhere
let oldTernary = `(selectedKpi === 'sales' ? salesDetailData : selectedKpi === 'payroll' ? payrollDetailData : selectedKpi === 'expenses' ? expenseDetailData : purchaseDetailData)`;
let newTernary = `(selectedKpi === 'sales' ? salesDetailData : selectedKpi === 'payroll' ? payrollDetailData : selectedKpi === 'expenses' ? expenseDetailData : selectedKpi === 'waste' ? wasteDetailData : purchaseDetailData)`;
txt = txt.split(oldTernary).join(newTernary);

let oldTotal = `selectedKpi === 'sales' ? salesDetailData?.totalSales : selectedKpi === 'payroll' ? payrollDetailData?.totalPayroll : selectedKpi === 'expenses' ? expenseDetailData?.totalExpenses : purchaseDetailData?.totalPurchases`;
let newTotal = `selectedKpi === 'sales' ? salesDetailData?.totalSales : selectedKpi === 'payroll' ? payrollDetailData?.totalPayroll : selectedKpi === 'expenses' ? expenseDetailData?.totalExpenses : selectedKpi === 'waste' ? wasteDetailData?.totalWaste : purchaseDetailData?.totalPurchases`;
txt = txt.split(oldTotal).join(newTotal);

// Fix 2: Safe || [] access for the maps to prevent crash
let oldAccess = `as any)[detailGrouping]`;
let newAccess = `as any)?.[detailGrouping] || []`;
txt = txt.split(oldAccess).join(newAccess);

// Fix 3: Colors in the right-side Details list
// I will just locate the `.map((item: any, index: number) => {` inside Detail Cards Area
let listLineIndex = txt.indexOf(`Detail Cards Area`);
if (listLineIndex > 0) {
    let oldMapStart = `].sort((a, b) => b.value - a.value).map((item: any, index: number) => {`;
    let newMapStart = `].sort((a, b) => b.value - a.value).map((item: any, index: number) => {
                                    const origArr = (((selectedKpi === 'sales' ? salesDetailData : selectedKpi === 'payroll' ? payrollDetailData : selectedKpi === 'expenses' ? expenseDetailData : selectedKpi === 'waste' ? wasteDetailData : purchaseDetailData) as any)?.[detailGrouping] || []);
                                    const origIdx = origArr.findIndex((x) => x.name === item.name);
                                    const activeColorIdx = origIdx >= 0 ? origIdx : index;`;
    
    // We only want to replace the first occurrence after Detail Cards Area
    let before = txt.substring(0, listLineIndex);
    let after = txt.substring(listLineIndex);
    after = after.replace(oldMapStart, newMapStart);
    
    // Also replace the exact class array pull
    let oldColorArr = `                                                <div className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-white shadow-md group-hover:scale-110 transition-transform duration-300 text-xl" style={{ backgroundColor: [
                                                    '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'
                                                ][index % 7] }}>`;
    
    let newColorArr = `                                                <div className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-white shadow-md group-hover:scale-110 transition-transform duration-300 text-xl" style={{ backgroundColor: [
                                                    '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'
                                                ][activeColorIdx % 7] }}>`;
    
    after = after.replace(oldColorArr, newColorArr);
    txt = before + after;
}

fs.writeFileSync(file, txt, 'utf8');
console.log("Safe fix applied");
