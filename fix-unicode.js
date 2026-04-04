const fs = require('fs');
let file = 'src/app/[locale]/dashboard/page.tsx';
let txt = fs.readFileSync(file, 'utf8');

txt = txt.replace(/├í/g, 'á');
txt = txt.replace(/├⌐/g, 'é');
txt = txt.replace(/├¡/g, 'í');
txt = txt.replace(/├│/g, 'ó');
txt = txt.replace(/├║/g, 'ú');
txt = txt.replace(/├▒/g, 'ñ');

// Check for capital letters
txt = txt.replace(/├ü/g, 'Á');
txt = txt.replace(/├ë/g, 'É');
txt = txt.replace(/├ì/g, 'Í');
txt = txt.replace(/├ô/g, 'Ó');
txt = txt.replace(/├Ü/g, 'Ú');
txt = txt.replace(/├æ/g, 'Ñ');

// Check for emoji broken representations?
// '­ƒÑ®' etc mapping? That might be harder to fix generically. I will just rely on standard accents.
// Wait, the emojis were broken too: '🥩' became '­ƒÑ®'.
// I'll fix the code manually for emojis:
txt = txt.replace(/­ƒÑ®/g, '🥩');
txt = txt.replace(/­ƒÑª/g, '🥦');
txt = txt.replace(/­ƒÑø/g, '🥛');
txt = txt.replace(/­ƒÑ½/g, '🥫');
txt = txt.replace(/­ƒÑñ/g, '🥤');
txt = txt.replace(/­ƒÑí/g, '🥡');
txt = txt.replace(/­ƒº╝/g, '🧼');
txt = txt.replace(/­ƒÉƒ/g, '🐟');
txt = txt.replace(/­ƒì×/g, '🍞');
txt = txt.replace(/­ƒôª/g, '📦');

fs.writeFileSync(file, txt, 'utf8');
