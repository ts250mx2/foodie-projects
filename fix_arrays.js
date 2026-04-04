const fs = require('fs');
let file = 'src/app/[locale]/dashboard/page.tsx';
let txt = fs.readFileSync(file, 'utf8');

txt = txt.replace(/useState\<Branch\[\]\>\(\[\] \|\| \[\]\)/, "useState<Branch[]>([])");
txt = txt.replace(/\[project\] \|\| \[\]\)/, "[project])");
txt = txt.replace(/\[selectedBranch\] \|\| \[\]\)/, "[selectedBranch])");
txt = txt.replace(/\[selectedMonth\] \|\| \[\]\)/, "[selectedMonth])");
txt = txt.replace(/\[selectedYear\] \|\| \[\]\)/, "[selectedYear])");
txt = txt.replace(/\[project, selectedBranch, selectedMonth, selectedYear\] \|\| \[\]\)/, "[project, selectedBranch, selectedMonth, selectedYear])");
txt = txt.replace(/\}, \[\] \|\| \[\]\)/, "}, [])");

fs.writeFileSync(file, txt, 'utf8');
