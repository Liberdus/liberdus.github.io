/**
 * Simple CORS-enabled development server
 * Run with: node cors-server.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 5500;

// MIME types
const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.wav': 'audio/wav',
    '.mp4': 'video/mp4',
    '.woff': 'application/font-woff',
    '.ttf': 'application/font-ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.otf': 'application/font-otf',
    '.wasm': 'application/wasm'
};

const server = http.createServer((req, res) => {
    try {
        // Enable CORS for all requests
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        
        // Handle preflight requests
        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }

        const parsedUrl = url.parse(req.url);
        let pathname = parsedUrl.pathname;
        
        // Default to index.html
        if (pathname === '/') {
            pathname = '/index.html';
        }

        const filePath = path.join(__dirname, pathname);
        const ext = path.parse(filePath).ext;
        const mimeType = mimeTypes[ext] || 'text/plain';

        fs.readFile(filePath, (err, data) => {
            if (err) {
                if (err.code === 'ENOENT') {
                    // Only log 404s for actual file requests, not favicon spam
                    if (!pathname.includes('favicon')) {
                        console.log(`404: ${pathname}`);
                    }
                    res.writeHead(404, { 'Content-Type': 'text/html' });
                    res.end('<h1>404 Not Found</h1>');
                } else {
                    console.error(`500: ${pathname}`, err.message);
                    res.writeHead(500, { 'Content-Type': 'text/html' });
                    res.end('<h1>500 Internal Server Error</h1>');
                }
            } else {
                res.writeHead(200, { 'Content-Type': mimeType });
                res.end(data);
            }
        });
    } catch (error) {
        // Silently handle errors (prevents SSL handshake error spam)
        if (!res.headersSent) {
            try {
                res.writeHead(400);
                res.end();
            } catch (e) {
                // Connection already closed
            }
        }
    }
});

// Handle connection errors gracefully (suppresses SSL/TLS handshake errors)
server.on('clientError', (err, socket) => {
    // Silently close connections with SSL/TLS handshake attempts
    // These happen when browsers try HTTPS first
    if (err.code === 'ECONNRESET' || err.code === 'ERR_SSL_WRONG_VERSION_NUMBER' || !err.code) {
        socket.end();
        return;
    }
    
    // Only log actual errors, not SSL handshake attempts
    if (err.message && !err.message.includes('Parse Error') && !err.message.includes('Bad request')) {
        console.error('Client error:', err.message);
    }
    
    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});

server.listen(PORT, () => {
    console.log(`🚀 CORS-enabled development server running at http://localhost:${PORT}`);
    console.log('📁 Serving files from:', __dirname);
    console.log('🔓 CORS enabled for all origins');
    console.log('');
    console.log('Available pages:');
    console.log(`  📄 Main App: http://localhost:${PORT}/index.html`);
    console.log(`  🔐 Admin Panel: http://localhost:${PORT}/admin.html`);
    console.log(`  🧪 Wallet Test: http://localhost:${PORT}/wallet-test.html`);
    console.log(`  🔍 Debug Dashboard: http://localhost:${PORT}/debug-dashboard.html`);
    console.log('');
    console.log('Press Ctrl+C to stop the server');
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Shutting down development server...');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});
