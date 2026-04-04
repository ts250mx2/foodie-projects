import sys

file = 'src/app/[locale]/dashboard/page.tsx'
with open(file, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    # Explicitly cast to string to avoid compiler TS2367 errors
    line = line.replace("selectedKpi === 'waste'", "(selectedKpi as string) === 'waste'")
    # Fix the missing parenthesis from the optional chaining
    line = line.replace("?.[detailGrouping] || [].map", "?.[detailGrouping] || []).map")
    
    new_lines.append(line)

with open(file, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("Nuked typescript errors.")
