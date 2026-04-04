const fs = require('fs');
let file = 'src/app/[locale]/dashboard/page.tsx';
let txt = fs.readFileSync(file, 'utf8');

// 1. Add `providers` to `purchaseDetailData` type definition
txt = txt.replace(
    /categories: any\[\];\n        days: any\[\];\n        totalPurchases: number;/,
    `categories: any[];
        providers: any[];
        days: any[];
        totalPurchases: number;`
);

// 2. Add 'providers' to the list of grouping checks in `fetchPurchaseDetails` if they were explicitly checked.
txt = txt.replace(
    /if \(!\['categories', 'days'\]\.includes\(detailGrouping\)\) {\n                    setDetailGrouping\('categories'\);\n                }/,
    `if (!['categories', 'providers', 'days'].includes(detailGrouping)) {
                    setDetailGrouping('categories');
                }`
);

// 3. Add the "Proveedor" button in the group of "Categoría" and "Día" for purchases and waste
// Wait, the user ONLY said "en compras de materia prima agregar el agrupamiento por porveedor". 
// This means "Proveedor" should only be available when `selectedKpi === 'purchases'` or if it's both, we hide it for waste?
// The user said: "en compras de materia prima agregar el agrupamiento por porveedor, debe estar entre categoria y dia"
// The current code has a grouped section for BOTH purchases and waste.
// Let's modify the JSX directly.
txt = txt.replace(
    /<button\n                                            onClick=\{\(\) => setDetailGrouping\('days'\)\}\n                                            className=\{\`px-3 py-1.5 rounded-md text-xs font-black transition-all \$\{detailGrouping === 'days' \? \(selectedKpi === 'waste' \? 'bg-rose-700' : 'bg-amber-500'\) \+ ' text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'\}\`\}\n                                        >\n                                            Día\n                                        <\/button>/,
    `{selectedKpi === 'purchases' && (
                                            <button
                                                onClick={() => setDetailGrouping('providers')}
                                                className={\`px-3 py-1.5 rounded-md text-xs font-black transition-all \${detailGrouping === 'providers' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}\`}
                                            >
                                                Proveedor
                                            </button>
                                        )}
                                        <button
                                            onClick={() => setDetailGrouping('days')}
                                            className={\`px-3 py-1.5 rounded-md text-xs font-black transition-all \${detailGrouping === 'days' ? (selectedKpi === 'waste' ? 'bg-rose-700' : 'bg-amber-500') + ' text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}\`}
                                        >
                                            Día
                                        </button>`
);

fs.writeFileSync(file, txt, 'utf8');
console.log('Provider UI added');
