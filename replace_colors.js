const fs = require('fs');
const path = require('path');

function walk(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walk(dirPath, callback) : callback(dirPath);
    });
}

let modifiedFiles = 0;

walk('./src', function(filePath) {
    if (!filePath.endsWith('.tsx') && !filePath.endsWith('.ts')) return;

    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    // Replace orange with primary
    content = content.replace(/\borange\b/g, 'primary');

    // For secondary, it's trickier. They said primary and secondary. 
    // They used pink and purple before for gradients. Let's just leave pink/purple alone unless we know they represent secondary.
    // If they said "secondary... to #0a0a0a" we can just add secondary to our theme.
    
    if(content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        modifiedFiles++;
    }
});

console.log('Modified files:', modifiedFiles);
