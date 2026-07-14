import fs from 'fs';
let content = fs.readFileSync('package.json', 'utf-8');
content = content.replace('"deploy": "gh-pages -d dist",', '"deploy": "gh-pages -d dist --repo https://github.com/chantha-cmd-web/Performance-System-007.git",');
fs.writeFileSync('package.json', content);
