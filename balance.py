import sys

file = 'src/app/[locale]/dashboard/page.tsx'
with open(file, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    if "{((selectedKpi === 'sales'" in line and "|| []).map" in line:
        line = line.replace("{((selectedKpi === 'sales'", "{(((selectedKpi === 'sales'")
    new_lines.append(line)

with open(file, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("Balanced the parentheses.")
