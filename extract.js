const fs = require('fs');

try {
    const diffText = fs.readFileSync('C:\\Users\\Ruben\\AppData\\Local\\Temp\\page_diff_utf8.txt', 'utf8');
    
    // We want to reconstruct what the corrupt file looked like.
    // In a Unified Diff, the added lines start with '+'.
    // We just want to extract everything from the first "+'use client'"
    const lines = diffText.split('\n');
    
    let corruptedCode = [];
    let parsing = false;
    
    for (const line of lines) {
        if (line.startsWith("+'use client';\\n")) {
            parsing = true;
            // The corrupted literal string started with +
            corruptedCode.push(line.substring(1));
        } else if (parsing) {
            // keep collecting added lines
            if (line.startsWith('+')) {
                corruptedCode.push(line.substring(1));
            } else if (line.startsWith('-')) {
                // Ignore deleted lines
                continue;
            } else if (line.startsWith(' ')) {
                // Context line, meaning it wasn't modified? Wait, the diff shows context lines.
                // But the corrupted file had NO unmodified context except the end of the file maybe?
                // Actually, the corrupt file was 62 lines.
                // Let's just collect ALL + and space lines AFTER the corrupted line started
                // wait, if we see '@@', we stop.
                if (line.startsWith('@@')) break;
                
                // For context lines starting with space, we add them, stripping the first space
                corruptedCode.push(line.substring(1));
            }
        }
    }
    
    // The first line inside corruptedCode is the massive stringified block
    let massiveLine = corruptedCode[0];
    // It's not a JavaScript string literal in the file, it's literally plain text that has '\' and 'n'.
    // We want to replace actual pairs of '\' and 'n' with actual newline characters.
    // Also replacing \' with ' and \" with " ?
    // Wait, let's see: in the diff we saw:
    // +'use client';\n\nimport { useState ...
    let restoredMassiveLine = massiveLine.replace(/\\n/g, '\n');
    let restoredContent = restoredMassiveLine + '\n' + corruptedCode.slice(1).join('\n');
    
    fs.writeFileSync('restored_page.tsx', restoredContent, 'utf8');
    console.log("Successfully extracted restored_page.tsx (Length: " + restoredContent.length + " chars)");
    
} catch(e) {
    console.error(e);
}
