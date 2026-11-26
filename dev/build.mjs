import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'fs';
const r = await build({ entryPoints: ['src/main.js'], bundle: true, minify: true, format: 'iife', write: false, target: 'es2020', legalComments: 'none' });
let js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const html = readFileSync('template.html', 'utf8').replace('/*__APP__*/', () => js);
writeFileSync('../office/index.html', html);
console.log('ok', (html.length / 1024).toFixed(0) + 'KB');
