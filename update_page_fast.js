const fs = require('fs');
let file = 'src/app/[locale]/dashboard/page.tsx';
let txt = fs.readFileSync(file, 'utf8');

// The file was reverted to 3 days ago (or some earlier state).
// Let's add the missing `wasteDetailData` and safe access `|| []` everywhere in the details rendering block.

// 1. Grouping buttons
const targetGrouping = `                                ) : (
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

const replacementGrouping = `                                ) : (selectedKpi === 'purchases' || selectedKpi === 'waste') ? (
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

txt = txt.replace(targetGrouping, replacementGrouping);

// 2. Global replacements for the ternaries pulling data
txt = txt.replace(/selectedKpi === 'expenses' \? expenseDetailData : purchaseDetailData\)/g, "selectedKpi === 'expenses' ? expenseDetailData : selectedKpi === 'waste' ? wasteDetailData : purchaseDetailData)");
txt = txt.replace(/selectedKpi === 'expenses' \? expenseDetailData\?\.totalExpenses : purchaseDetailData\?\.totalPurchases/g, "selectedKpi === 'expenses' ? expenseDetailData?.totalExpenses : selectedKpi === 'waste' ? wasteDetailData?.totalWaste : purchaseDetailData?.totalPurchases");

// 3. Add safe access || [] to map statements
txt = txt.replace(/\]\.map/g, "] || []].map");
txt = txt.replace(/\]\)/g, "] || [])");
// Actually, earlier today I just did: (data as any)?.[grouping] || []
txt = txt.replace(/as any\)\[detailGrouping\]\.map/g, "as any)?.[detailGrouping] || []).map");
txt = txt.replace(/as any\)\[detailGrouping\]\}\s+margin/g, "as any)?.[detailGrouping] || []} margin");
txt = txt.replace(/as any\)\[detailGrouping\]\}\s+cx/g, "as any)?.[detailGrouping] || []} cx");
txt = txt.replace(/as any\)\[detailGrouping\]\]\.sort/g, "as any)?.[detailGrouping] || []].sort");

// 4. Emojis
txt = txt.replace(/selectedKpi === 'purchases' && detailGrouping === 'categories' \? getCategoryEmoji\(String\(item\.name \|\| ''\)\) : String\(item\.name \|\| ''\)\.slice\(0, 2\)\.toUpperCase\(\)/, "['purchases', 'waste'].includes(selectedKpi) && detailGrouping === 'categories' ? (item.emoji || getCategoryEmoji(String(item.name || ''))) : String(item.name || '').slice(0, 2).toUpperCase()");

// 5. The final goal requested right now! Color sync!
const mapTarget = `                                {[...((selectedKpi === 'sales' ? salesDetailData : selectedKpi === 'payroll' ? payrollDetailData : selectedKpi === 'expenses' ? expenseDetailData : selectedKpi === 'waste' ? wasteDetailData : purchaseDetailData) as any)?.[detailGrouping] || []].sort((a, b) => b.value - a.value).map((item: any, index: number) => {
                                    const total = selectedKpi === 'sales' ? salesDetailData?.totalSales : selectedKpi === 'payroll' ? payrollDetailData?.totalPayroll : selectedKpi === 'expenses' ? expenseDetailData?.totalExpenses : selectedKpi === 'waste' ? wasteDetailData?.totalWaste : purchaseDetailData?.totalPurchases;
                                    return (
                                        <div 
                                            key={index}`;

const mapReplace = `                                {[...((selectedKpi === 'sales' ? salesDetailData : selectedKpi === 'payroll' ? payrollDetailData : selectedKpi === 'expenses' ? expenseDetailData : selectedKpi === 'waste' ? wasteDetailData : purchaseDetailData) as any)?.[detailGrouping] || []].sort((a, b) => b.value - a.value).map((item: any, index: number) => {
                                    const total = selectedKpi === 'sales' ? salesDetailData?.totalSales : selectedKpi === 'payroll' ? payrollDetailData?.totalPayroll : selectedKpi === 'expenses' ? expenseDetailData?.totalExpenses : selectedKpi === 'waste' ? wasteDetailData?.totalWaste : purchaseDetailData?.totalPurchases;
                                    const originalArray = ((selectedKpi === 'sales' ? salesDetailData : selectedKpi === 'payroll' ? payrollDetailData : selectedKpi === 'expenses' ? expenseDetailData : selectedKpi === 'waste' ? wasteDetailData : purchaseDetailData) as any)?.[detailGrouping] || [];
                                    const colorIndex = originalArray.findIndex((x: any) => x.name === item.name);
                                    const finalColorIndex = colorIndex >= 0 ? colorIndex : index;
                                    return (
                                        <div 
                                            key={index}`;
txt = txt.replace(mapTarget, mapReplace);

txt = txt.replace(/\]\[index \% 7\] \}\}\>/g, "][(typeof finalColorIndex !== 'undefined' ? finalColorIndex : index) % 7] }}>");

fs.writeFileSync(file, txt, 'utf8');
console.log('Fixed everything!');
