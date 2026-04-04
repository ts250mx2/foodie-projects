const fs = require('fs');
let file = 'src/app/[locale]/dashboard/page.tsx';
let txt = fs.readFileSync(file, 'utf8');

// 1. Ternary fix globally: "purchaseDetailData)" -> "selectedKpi === 'waste' ? wasteDetailData : purchaseDetailData)"
// BUT only in the relevant specific ternary:
const ternaryOld = /(selectedKpi === 'sales' \? salesDetailData : selectedKpi === 'payroll' \? payrollDetailData : selectedKpi === 'expenses' \? expenseDetailData : purchaseDetailData)/g;
const ternaryNew = "(selectedKpi === 'sales' ? salesDetailData : selectedKpi === 'payroll' ? payrollDetailData : selectedKpi === 'expenses' ? expenseDetailData : selectedKpi === 'waste' ? wasteDetailData : purchaseDetailData)";
txt = txt.replace(ternaryOld, ternaryNew);

// 2. total field fix
const totalOld = /selectedKpi === 'sales' \? salesDetailData\?\.totalSales : selectedKpi === 'payroll' \? payrollDetailData\?\.totalPayroll : selectedKpi === 'expenses' \? expenseDetailData\?\.totalExpenses : purchaseDetailData\?\.totalPurchases/g;
const totalNew = "selectedKpi === 'sales' ? salesDetailData?.totalSales : selectedKpi === 'payroll' ? payrollDetailData?.totalPayroll : selectedKpi === 'expenses' ? expenseDetailData?.totalExpenses : selectedKpi === 'waste' ? wasteDetailData?.totalWaste : purchaseDetailData?.totalPurchases";
txt = txt.replace(totalOld, totalNew);

// 3. Adding || [] to map arrays
txt = txt.replace(/as any\)\[detailGrouping\]/g, "as any)?.[detailGrouping] || []");

// 4. Update the grouping buttons
const btnOld = `                                ) : (
                                    <>
                                        <button
                                            onClick={() => setDetailGrouping('categories')}
                                            className={\`px-3 py-1.5 rounded-md text-xs font-black transition-all \${detailGrouping === 'categories' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}\`}
                                        >
                                            Categor├¡a
                                        </button>
                                        <button
                                            onClick={() => setDetailGrouping('days')}
                                            className={\`px-3 py-1.5 rounded-md text-xs font-black transition-all \${detailGrouping === 'days' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}\`}
                                        >
                                            D├¡a
                                        </button>
                                    </>
                                )}`;
                                
const btnNew = `                                ) : (selectedKpi === 'purchases' || selectedKpi === 'waste') ? (
                                    <>
                                        <button
                                            onClick={() => setDetailGrouping('categories')}
                                            className={\`px-3 py-1.5 rounded-md text-xs font-black transition-all \${detailGrouping === 'categories' ? (selectedKpi === 'waste' ? 'bg-pink-700' : 'bg-amber-500') + ' text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}\`}
                                        >
                                            Categoría
                                        </button>
                                        {selectedKpi === 'purchases' && (
                                            <button
                                                onClick={() => setDetailGrouping('providers')}
                                                className={\`px-3 py-1.5 rounded-md text-xs font-black transition-all \${detailGrouping === 'providers' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}\`}
                                            >
                                                Proveedor
                                            </button>
                                        )}
                                        <button
                                            onClick={() => setDetailGrouping('days')}
                                            className={\`px-3 py-1.5 rounded-md text-xs font-black transition-all \${detailGrouping === 'days' ? (selectedKpi === 'waste' ? 'bg-pink-700' : 'bg-amber-500') + ' text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}\`}
                                        >
                                            Día
                                        </button>
                                    </>
                                ) : null}`;

txt = txt.replace(btnOld, btnNew);

// 5. Color sync logic
const listTopOld = `                            {/* Detail Cards Area */}
                            <div className="lg:col-span-5 flex flex-col gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                {[...(((selectedKpi === 'sales' ? salesDetailData : selectedKpi === 'payroll' ? payrollDetailData : selectedKpi === 'expenses' ? expenseDetailData : selectedKpi === 'waste' ? wasteDetailData : purchaseDetailData) as any)?.[detailGrouping] || [])].sort((a, b) => b.value - a.value).map((item: any, index: number) => {
                                    const total = selectedKpi === 'sales' ? salesDetailData?.totalSales : selectedKpi === 'payroll' ? payrollDetailData?.totalPayroll : selectedKpi === 'expenses' ? expenseDetailData?.totalExpenses : selectedKpi === 'waste' ? wasteDetailData?.totalWaste : purchaseDetailData?.totalPurchases;
                                    return (
                                        <div 
                                            key={index}`;

const listTopNew = `                            {/* Detail Cards Area */}
                            <div className="lg:col-span-5 flex flex-col gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                {[...(((selectedKpi === 'sales' ? salesDetailData : selectedKpi === 'payroll' ? payrollDetailData : selectedKpi === 'expenses' ? expenseDetailData : selectedKpi === 'waste' ? wasteDetailData : purchaseDetailData) as any)?.[detailGrouping] || [])].sort((a, b) => b.value - a.value).map((item: any, index: number) => {
                                    const total = selectedKpi === 'sales' ? salesDetailData?.totalSales : selectedKpi === 'payroll' ? payrollDetailData?.totalPayroll : selectedKpi === 'expenses' ? expenseDetailData?.totalExpenses : selectedKpi === 'waste' ? wasteDetailData?.totalWaste : purchaseDetailData?.totalPurchases;
                                    const origArr = (((selectedKpi === 'sales' ? salesDetailData : selectedKpi === 'payroll' ? payrollDetailData : selectedKpi === 'expenses' ? expenseDetailData : selectedKpi === 'waste' ? wasteDetailData : purchaseDetailData) as any)?.[detailGrouping] || []);
                                    const origIdx = origArr.findIndex((x) => x.name === item.name);
                                    const activeColorIdx = origIdx >= 0 ? origIdx : index;
                                    return (
                                        <div 
                                            key={index}`;

txt = txt.replace(listTopOld, listTopNew);

const iconColorOld = `                                                <div className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-white shadow-md group-hover:scale-110 transition-transform duration-300 text-xl" style={{ backgroundColor: [
                                                    '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'
                                                ][index % 7] }}>`;

const iconColorNew = `                                                <div className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-white shadow-md group-hover:scale-110 transition-transform duration-300 text-xl" style={{ backgroundColor: [
                                                    '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'
                                                ][activeColorIdx % 7] }}>`;

txt = txt.replace(iconColorOld, iconColorNew);

// 6. Emoji fix
const emojiOld = `{selectedKpi === 'purchases' && detailGrouping === 'categories' ? (item.emoji || getCategoryEmoji(String(item.name || ''))) : String(item.name || '').slice(0, 2).toUpperCase()}`;
const emojiNew = `{['purchases', 'waste'].includes(selectedKpi) && detailGrouping === 'categories' ? (item.emoji || getCategoryEmoji(String(item.name || ''))) : String(item.name || '').slice(0, 2).toUpperCase()}`;
txt = txt.replace(emojiOld, emojiNew);

fs.writeFileSync(file, txt, 'utf8');
console.log('Update successful');
