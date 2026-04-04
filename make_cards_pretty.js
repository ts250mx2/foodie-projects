const fs = require('fs');
let file = 'src/app/[locale]/dashboard/page.tsx';
let txt = fs.readFileSync(file, 'utf8');

// 1. Upgrade the main container classes
// Sales
txt = txt.replace(
    /className=\{\`bg-white p-4 rounded-xl border transition-all relative overflow-hidden group text-left cursor-pointer \$\{selectedKpi === 'sales' \? 'ring-2 ring-emerald-500 border-emerald-500 shadow-md' : 'border-slate-100 shadow-sm hover:shadow-md'\}\`\}/,
    `className={\`p-5 rounded-2xl border transition-all duration-300 relative overflow-hidden group text-left cursor-pointer hover:-translate-y-1 \${selectedKpi === 'sales' ? 'bg-gradient-to-b from-emerald-50/80 to-white border-emerald-300 ring-4 ring-emerald-500/10 shadow-xl shadow-emerald-500/10 z-10' : 'bg-white border-slate-100/80 shadow-sm hover:shadow-md hover:border-slate-200'}\`}`
);
// Payroll
txt = txt.replace(
    /className=\{\`p-4 rounded-xl border transition-all relative overflow-hidden group text-left cursor-pointer \$\{selectedKpi === 'payroll' \? 'bg-indigo-50 border-indigo-200 shadow-md ring-2 ring-indigo-500 ring-opacity-20' : 'bg-white border-slate-100 shadow-sm hover:shadow-md'\}\`\}/,
    `className={\`p-5 rounded-2xl border transition-all duration-300 relative overflow-hidden group text-left cursor-pointer hover:-translate-y-1 \${selectedKpi === 'payroll' ? 'bg-gradient-to-b from-indigo-50/80 to-white border-indigo-300 ring-4 ring-indigo-500/10 shadow-xl shadow-indigo-500/10 z-10' : 'bg-white border-slate-100/80 shadow-sm hover:shadow-md hover:border-slate-200'}\`}`
);
// Expenses
txt = txt.replace(
    /className=\{\`p-4 rounded-xl border transition-all relative overflow-hidden group text-left cursor-pointer \$\{selectedKpi === 'expenses' \? 'bg-rose-50 border-rose-200 shadow-md ring-2 ring-rose-500 ring-opacity-20' : 'bg-white border-slate-100 shadow-sm hover:shadow-md'\}\`\}/,
    `className={\`p-5 rounded-2xl border transition-all duration-300 relative overflow-hidden group text-left cursor-pointer hover:-translate-y-1 \${selectedKpi === 'expenses' ? 'bg-gradient-to-b from-rose-50/80 to-white border-rose-300 ring-4 ring-rose-500/10 shadow-xl shadow-rose-500/10 z-10' : 'bg-white border-slate-100/80 shadow-sm hover:shadow-md hover:border-slate-200'}\`}`
);
// Purchases
txt = txt.replace(
    /className=\{\`p-4 rounded-xl border transition-all relative overflow-hidden group text-left cursor-pointer \$\{selectedKpi === 'purchases' \? 'bg-amber-50 border-amber-200 shadow-md ring-2 ring-amber-500 ring-opacity-20' : 'bg-white border-slate-100 shadow-sm hover:shadow-md'\}\`\}/,
    `className={\`p-5 rounded-2xl border transition-all duration-300 relative overflow-hidden group text-left cursor-pointer hover:-translate-y-1 \${selectedKpi === 'purchases' ? 'bg-gradient-to-b from-amber-50/80 to-white border-amber-300 ring-4 ring-amber-500/10 shadow-xl shadow-amber-500/10 z-10' : 'bg-white border-slate-100/80 shadow-sm hover:shadow-md hover:border-slate-200'}\`}`
);
// Waste
txt = txt.replace(
    /className=\{\`p-4 rounded-xl border transition-all relative overflow-hidden group text-left cursor-pointer \$\{selectedKpi === 'waste' \? 'bg-rose-50 border-rose-200 shadow-md ring-2 ring-rose-500 ring-opacity-20' : 'bg-white border-slate-100 shadow-sm hover:shadow-md'\}\`\}/,
    `className={\`p-5 rounded-2xl border transition-all duration-300 relative overflow-hidden group text-left cursor-pointer hover:-translate-y-1 \${selectedKpi === 'waste' ? 'bg-gradient-to-b from-pink-50/80 to-white border-pink-300 ring-4 ring-pink-500/10 shadow-xl shadow-pink-500/10 z-10' : 'bg-white border-slate-100/80 shadow-sm hover:shadow-md hover:border-slate-200'}\`}`
);

// 2. Upgrade the SVG background icons layer
txt = txt.replace(
    /className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity"/g,
    `className="absolute -right-6 -top-6 p-4 opacity-[0.03] group-hover:opacity-10 group-hover:rotate-12 group-hover:scale-125 transition-all duration-500 ease-out"`
);

// 3. Upgrade the Numbers (h2)
txt = txt.replace(
    /className="text-2xl font-black text-slate-900 mb-2"/g,
    `className="text-3xl font-black tracking-tight text-slate-800 mb-2"`
);

fs.writeFileSync(file, txt, 'utf8');
console.log('Cards styling upgraded.');
