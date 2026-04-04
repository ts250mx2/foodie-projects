const fs = require('fs');
let file = 'src/app/[locale]/dashboard/page.tsx';
let txt = fs.readFileSync(file, 'utf8');

// Replace standard accesses to the array
txt = txt.replace(/\) as any\)\[detailGrouping\]/g, ") as any)?.[detailGrouping] || []");

// Also fix the [...array].sort logic just in case
txt = txt.replace(/\[\.\.\.\(\(selectedKpi ===/g, "[...(((selectedKpi ===");

fs.writeFileSync(file, txt, 'utf8');
console.log('Map fixed');
