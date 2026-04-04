const fs = require('fs');
let file = 'src/app/[locale]/dashboard/page.tsx';
let txt = fs.readFileSync(file, 'utf8');

// 1. Upgrade list cards container
txt = txt.replace(
    /className=\{\`bg-white p-4 rounded-xl border border-slate-100 shadow-sm transition-all group flex justify-between items-center hover:shadow-md \$\{selectedKpi === 'sales' \? 'hover:border-emerald-200' : selectedKpi === 'payroll' \? 'hover:border-indigo-200' : selectedKpi === 'expenses' \? 'hover:border-rose-200' : selectedKpi === 'waste' \? 'hover:border-rose-300' : 'hover:border-amber-200'\}\`\}/,
    `className={\`bg-white p-4 rounded-2xl border border-slate-100 shadow-sm transition-all duration-300 group flex justify-between items-center hover:shadow-lg hover:-translate-y-1 \${selectedKpi === 'sales' ? 'hover:border-emerald-300 hover:shadow-emerald-500/10' : selectedKpi === 'payroll' ? 'hover:border-indigo-300 hover:shadow-indigo-500/10' : selectedKpi === 'expenses' ? 'hover:border-rose-300 hover:shadow-rose-500/10' : selectedKpi === 'waste' ? 'hover:border-pink-300 hover:shadow-pink-500/10' : 'hover:border-amber-300 hover:shadow-amber-500/10'}\`}`
);

// 2. Add glassmorphism to tooltips in BarChart and PieChart
txt = txt.replace(
    /className="bg-white p-3 shadow-xl border border-slate-100 rounded-lg"/g,
    `className="bg-white/90 backdrop-blur-md p-4 shadow-2xl border border-white/50 rounded-xl"`
);

// 3. Make BarChart bars wider
txt = txt.replace(
    /barSize=\{40\}/g,
    `barSize={48}`
);

// 4. Update the XAxis text to be slightly softer
txt = txt.replace(
    /tick=\{\{ fill: '#64748b', fontSize: 11, fontWeight: 700, textAnchor: 'end' \}\}/g,
    `tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600, textAnchor: 'end' }}`
);

// 5. Upgrade the icon background color container to include hover scale
txt = txt.replace(
    /className="w-10 h-10 rounded-lg flex items-center justify-center font-black text-white shadow-sm" style=\{\{ backgroundColor:/g,
    `className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-white shadow-md group-hover:scale-110 transition-transform duration-300 text-xl" style={{ backgroundColor:`
);

fs.writeFileSync(file, txt, 'utf8');
console.log('Details styling upgraded.');
