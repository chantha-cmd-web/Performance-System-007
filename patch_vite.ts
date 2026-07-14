import fs from 'fs';
let content = fs.readFileSync('vite.config.ts', 'utf-8');
content = content.replace("base: './',", "base: '/Performance-System-007/',");
fs.writeFileSync('vite.config.ts', content);
