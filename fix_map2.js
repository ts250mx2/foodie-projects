const fs = require('fs');
let file = 'src/app/[locale]/dashboard/page.tsx';
let txt = fs.readFileSync(file, 'utf8');

// Fix the map logic: `|| [].map` -> `|| []).map`
// We need to wrap the first part in parenthesis.
txt = txt.replace(
    /\{\(\(selectedKpi === 'sales' \? salesDetailData : selectedKpi === 'payroll' \? payrollDetailData : selectedKpi === 'expenses' \? expenseDetailData : selectedKpi === 'waste' \? wasteDetailData : purchaseDetailData\) as any\)\?\.\[detailGrouping\] \|\| \[\]\.map/g,
    `{(((selectedKpi === 'sales' ? salesDetailData : selectedKpi === 'payroll' ? payrollDetailData : selectedKpi === 'expenses' ? expenseDetailData : selectedKpi === 'waste' ? wasteDetailData : purchaseDetailData) as any)?.[detailGrouping] || []).map`
);

// Fix the array spread if there were unbalanced parenthesis
// We want exactly: `{[...(((...` to become `{[...((`
txt = txt.replace(
    /\{\[\.\.\.\(\(\(selectedKpi === 'sales'/g,
    `{[...((selectedKpi === 'sales'`
);

fs.writeFileSync(file, txt, 'utf8');
console.log('Fixed parens');
