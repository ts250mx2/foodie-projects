
const fs = require('fs');
const content = fs.readFileSync('c:\\Users\\Ruben\\Documents\\Antigravity Projects\\foodie-projects\\src\\app\\[locale]\\dashboard\\config\\break-even\\page.tsx', 'utf8');

const tags = [];
const tagRegex = /<(\/?[a-zA-Z0-9]+)/g;
let match;

while ((match = tagRegex.exec(content)) !== null) {
    const tagName = match[1];
    if (tagName.startsWith('/')) {
        const lastTag = tags.pop();
        if (lastTag !== tagName.substring(1)) {
            console.log('Mismatch:', lastTag, 'vs', tagName);
        }
    } else {
        // Check if self-closing
        const endOfTag = content.indexOf('>', match.index);
        if (content[endOfTag - 1] !== '/') {
            tags.push(tagName);
        }
    }
}

console.log('Unclosed tags:', tags);
