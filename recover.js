const fs = require('fs');
let file = 'src/app/[locale]/dashboard/page.tsx';
let txt = fs.readFileSync(file, 'utf8');

// 1. Sales KPI
txt = txt.replace(
    /(\<div className=\"flex justify-between items-center text-xs font-bold\"\>[\s\S]*?\<span className=\"text-slate-500\"\>% Alcance\<\/span\>[\s\S]*?\<\/div\>[\s\S]*?)\<\/div\>/,
    `$1
                                {salesObjective > 0 && (
                                    <div className="flex justify-between items-center text-xs font-bold -mt-1">
                                        <span className="text-slate-400 text-[10px]">Diferencia vs Meta</span>
                                        <span className={\`text-[10px] flex items-center gap-1 \${totalSales >= salesObjective ? 'text-emerald-600' : 'text-rose-500'}\`}>
                                            {totalSales >= salesObjective ? '+' : ''}{(((totalSales / salesObjective) * 100) - 100).toFixed(1)}% {totalSales >= salesObjective ? '🚀' : '⚠️'}
                                        </span>
                                    </div>
                                )}
                            </div>`
);

// 2. Payroll KPI
txt = txt.replace(
    /(\<span className=\"text-slate-500\"\>% Presupuesto\<\/span\>[\s\S]*?\<\/div\>)/,
    `$1
                                {payrollObjective > 0 && totalSales > 0 && (
                                    <div className="flex justify-between items-center text-xs font-bold -mt-1">
                                        <span className="text-slate-400 text-[10px]">Diferencia vs Meta</span>
                                        <span className={\`text-[10px] flex items-center gap-1 \${((totalPayroll / totalSales) * 100) <= payrollObjective ? 'text-emerald-600' : 'text-rose-500'}\`}>
                                            {(((totalPayroll / totalSales) * 100) - payrollObjective) > 0 ? '+' : ''}{(((totalPayroll / totalSales) * 100) - payrollObjective).toFixed(2)}% {((totalPayroll / totalSales) * 100) <= payrollObjective ? '✅' : '⚠️'}
                                        </span>
                                    </div>
                                )}`
);

// 3. Operating Expense KPI
txt = txt.replace(
    /\<span className=\"text-slate-500\"\>% Gasto Operativo\<\/span\>[\s\S]*?\<\/div\>\s*\<div className=\"flex justify-between items-center text-xs font-bold\"\>\s*\<span className=\"text-slate-500\"\>% Presupuesto\<\/span\>[\s\S]*?\<\/div\>/,
    `$&
                                {operatingExpenseObjective > 0 && totalSales > 0 && (
                                    <div className="flex justify-between items-center text-xs font-bold -mt-1">
                                        <span className="text-slate-400 text-[10px]">Diferencia vs Meta</span>
                                        <span className={\`text-[10px] flex items-center gap-1 \${((totalOperatingExpense / totalSales) * 100) <= operatingExpenseObjective ? 'text-emerald-600' : 'text-rose-500'}\`}>
                                            {(((totalOperatingExpense / totalSales) * 100) - operatingExpenseObjective) > 0 ? '+' : ''}{(((totalOperatingExpense / totalSales) * 100) - operatingExpenseObjective).toFixed(2)}% {((totalOperatingExpense / totalSales) * 100) <= operatingExpenseObjective ? '✅' : '⚠️'}
                                        </span>
                                    </div>
                                )}`
);

// 4. Raw Material Purchases KPI
txt = txt.replace(
    /\<span className=\"text-slate-500\"\>% Materia Prima\<\/span\>[\s\S]*?\<\/div\>\s*\<div className=\"flex justify-between items-center text-xs font-bold\"\>\s*\<span className=\"text-slate-500\"\>% Presupuesto\<\/span\>[\s\S]*?\<\/div\>/,
    `$&
                                {rawMaterialObjective > 0 && totalSales > 0 && (
                                    <div className="flex justify-between items-center text-xs font-bold -mt-1">
                                        <span className="text-slate-400 text-[10px]">Diferencia vs Meta</span>
                                        <span className={\`text-[10px] flex items-center gap-1 \${((totalRawMaterial / totalSales) * 100) <= rawMaterialObjective ? 'text-emerald-600' : 'text-rose-500'}\`}>
                                            {(((totalRawMaterial / totalSales) * 100) - rawMaterialObjective) > 0 ? '+' : ''}{(((totalRawMaterial / totalSales) * 100) - rawMaterialObjective).toFixed(2)}% {((totalRawMaterial / totalSales) * 100) <= rawMaterialObjective ? '✅' : '⚠️'}
                                        </span>
                                    </div>
                                )}`
);

// 5. Categories emoji fix
txt = txt.replace(
    /\{\['purchases', 'waste'\]\.includes\(selectedKpi\) && detailGrouping === 'categories' \? getCategoryEmoji\(String\(item\.name \|\| ''\)\) : String\(item\.name \|\| ''\)\.slice\(0, 2\)\.toUpperCase\(\)\}/,
    `{['purchases', 'waste'].includes(selectedKpi) && detailGrouping === 'categories' ? (item.emoji || getCategoryEmoji(String(item.name || ''))) : String(item.name || '').slice(0, 2).toUpperCase()}`
);


fs.writeFileSync(file, txt, 'utf8');
console.log('Recovery applied!');
