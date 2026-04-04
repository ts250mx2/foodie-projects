const fs = require('fs');
let file = 'src/app/[locale]/dashboard/page.tsx';
let txt = fs.readFileSync(file, 'utf8');

const target1 = `                                    const origArr = (((selectedKpi === 'sales' ? salesDetailData : selectedKpi === 'payroll' ? payrollDetailData : selectedKpi === 'expenses' ? expenseDetailData : selectedKpi === 'waste' ? wasteDetailData : purchaseDetailData) as any)?.[detailGrouping] || []);
                                    const origIdx = origArr.findIndex((x) => x.name === item.name);
                                    const activeColorIdx = origIdx >= 0 ? origIdx : index;
                                    const origArr = (((selectedKpi === 'sales' ? salesDetailData : selectedKpi === 'payroll' ? payrollDetailData : selectedKpi === 'expenses' ? expenseDetailData : selectedKpi === 'waste' ? wasteDetailData : purchaseDetailData) as any)?.[detailGrouping] || []);
                                    const origIdx = origArr.findIndex((x) => x.name === item.name);
                                    const activeColorIdx = origIdx >= 0 ? origIdx : index;`;

const replace1 = `                                    const origArr = (((selectedKpi === 'sales' ? salesDetailData : selectedKpi === 'payroll' ? payrollDetailData : selectedKpi === 'expenses' ? expenseDetailData : selectedKpi === 'waste' ? wasteDetailData : purchaseDetailData) as any)?.[detailGrouping] || []);
                                    const origIdx = origArr.findIndex((x: any) => x.name === item.name);
                                    const activeColorIdx = origIdx >= 0 ? origIdx : index;`;

txt = txt.split(target1).join(replace1);

const target2 = `                                                <div className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-white shadow-md group-hover:scale-110 transition-transform duration-300 text-xl" style={{ backgroundColor: [
                                                    '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'
                                                ][index % 7] }}>`;

const replace2 = `                                                <div className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-white shadow-md group-hover:scale-110 transition-transform duration-300 text-xl" style={{ backgroundColor: [
                                                    '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'
                                                ][activeColorIdx % 7] }}>`;

let startIdx = txt.indexOf('Detail Cards Area');
if (startIdx > -1) {
    let before = txt.substring(0, startIdx);
    let after = txt.substring(startIdx);
    after = after.split(target2).join(replace2);
    txt = before + after;
}

fs.writeFileSync(file, txt, 'utf8');
