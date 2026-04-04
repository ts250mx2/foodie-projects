const fs = require('fs');
let file = 'src/app/[locale]/dashboard/page.tsx';
let txt = fs.readFileSync(file, 'utf8');

// 1. Parenthesize array fallbacks for map
txt = txt.replace(/\?\.\[detailGrouping\] \|\| \[\]\.map/g, "?.[detailGrouping] || []).map");
// Oh wait, in fix_final.js I wrote:
// let newAccess = `as any)?.[detailGrouping] || []`;
// So `as any)[detailGrouping].map` became `as any)?.[detailGrouping] || [].map`
// I need perfectly placed parenthesis BEFORE `((selectedKpi`
// Let's just find and replace the whole block!

const oldBar = `BarChart data={(((selectedKpi === 'sales' ? salesDetailData : selectedKpi === 'payroll' ? payrollDetailData : selectedKpi === 'expenses' ? expenseDetailData : selectedKpi === 'waste' ? wasteDetailData : purchaseDetailData) as any)?.[detailGrouping] || [])}`;
const newBar = `BarChart data={(((selectedKpi as string) === 'sales' ? salesDetailData : (selectedKpi as string) === 'payroll' ? payrollDetailData : (selectedKpi as string) === 'expenses' ? expenseDetailData : (selectedKpi as string) === 'waste' ? wasteDetailData : purchaseDetailData) as any)?.[detailGrouping] || []}`;
txt = txt.split(oldBar).join(newBar);

// Use a global replace for the string cast and the array precedence
txt = txt.replace(/selectedKpi === 'waste'/g, "(selectedKpi as string) === 'waste'");

// For the `|| [].map` precedence:
// Current text has: `... purchaseDetailData) as any)?.[detailGrouping] || [].map((`
// Change it to: `(... purchaseDetailData) as any)?.[detailGrouping] || []).map((`
// Wait, if I do `|| []).map`, I need to insert a `(` at the beginning of `(((selected...`
txt = txt.replace(/data=\{((?!.*\?\.\[detailGrouping\] \|\| \[\]).*)as any\)\?\.\[detailGrouping\] \|\| \[\]\}/g, "data={($1as any)?.[detailGrouping] || []}");
txt = txt.replace(/as any\)\?\.\[detailGrouping\] \|\| \[\]\.map\(/g, "as any)?.[detailGrouping] || []).map(");

// Actually, let's just globally ensure `(((selectedKpi` matches `|| []).map` 
txt = txt.replace(/as any\)\?\.\[detailGrouping\] \|\| \[\]\.sort\(/g, "as any)?.[detailGrouping] || []).sort(");

// It's safer to just do:
txt = txt.replace(/\|\| \[\]\.map\(/g, "|| []).map(");
txt = txt.replace(/\(\(\(\(selectedKpi/g, "(((selectedKpi");
// But wait, the opening parenthesis `(` must balance!
// Let's just add the opening paren explicitly where it's used with map!
txt = txt.replace(/\{(\(selectedKpi as string\) === 'sales' \? salesDetailData : \(selectedKpi as string\) === 'payroll' \? payrollDetailData : \(selectedKpi as string\) === 'expenses' \? expenseDetailData : \(selectedKpi as string\) === 'waste' \? wasteDetailData : purchaseDetailData\) as any\)\?\.\[detailGrouping\] \|\| \[\]\)\.map/g, "{((($1 as any)?.[detailGrouping] || [])).map");

fs.writeFileSync(file, txt, 'utf8');
console.log("TS silenced");
