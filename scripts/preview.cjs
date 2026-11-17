const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../android/app/src/main/assets/www');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf' };
http.createServer((req, res) => {
    let name;
    try { name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { res.writeHead(400).end(); return; }
    const file = path.resolve(root, '.' + (name === '/' ? '/index.html' : name));
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    fs.readFile(file, (error, data) => {
        if (error) res.writeHead(404).end();
        else { res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream'); res.end(data); }
    });
}).listen(Number(process.env.PORT || process.argv[process.argv.indexOf('--port') + 1] || 3000), '0.0.0.0');
