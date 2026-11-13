'use strict';
const fs = require('node:fs');
const path = require('node:path');
const destination = path.resolve(__dirname, '../../../.cache/mirinae-pages');
fs.mkdirSync(destination, { recursive: true });
fs.copyFileSync(path.join(__dirname, 'interactive.html'), path.join(destination, 'index.html'));
fs.copyFileSync(path.join(__dirname, 'knowledge.js'), path.join(destination, 'knowledge.js'));
fs.writeFileSync(path.join(destination, '.nojekyll'), '');
console.log('Static Pages files: .cache/mirinae-pages (index.html, knowledge.js, .nojekyll)');
