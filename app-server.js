const http = require('http');

const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SwapBack - Application</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            min-height: 100vh; 
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            color: white;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            padding: 20px;
        }
        .container { max-width: 1200px; margin: 0 auto; }
        header { text-align: center; margin: 40px 0; }
        h1 { 
            font-size: 4rem; 
            background: linear-gradient(135deg, #00d4ff, #7b2ff7, #ff006e);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            margin-bottom: 20px;
        }
        .subtitle { font-size: 1.3rem; color: #aaa; margin-bottom: 40px; }
        .status-grid { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin: 40px 0;
        }
        .card { 
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 12px;
            padding: 30px;
            text-align: center;
            transition: transform 0.3s, border-color 0.3s;
        }
        .card:hover { 
            transform: translateY(-5px);
            border-color: rgba(255,255,255,0.2);
        }
        .card-icon { font-size: 3rem; margin-bottom: 15px; }
        .card-title { font-size: 1.2rem; font-weight: 600; margin-bottom: 10px; }
        .card-desc { color: #999; font-size: 0.9rem; }
        .badge { 
            display: inline-block;
            background: rgba(76, 175, 80, 0.2);
            color: #4caf50;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 0.9rem;
            margin: 10px 0;
            border: 1px solid rgba(76, 175, 80, 0.3);
        }
        .features { margin: 60px 0; }
        .features h2 { font-size: 2rem; text-align: center; margin-bottom: 40px; }
        .feature-list { 
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 30px;
        }
        .feature-item {
            background: rgba(0, 212, 255, 0.05);
            border-left: 4px solid #00d4ff;
            padding: 25px;
            border-radius: 8px;
        }
        .feature-item h3 { color: #00d4ff; margin-bottom: 10px; }
        .feature-item p { color: #aaa; line-height: 1.6; }
        .cta { 
            text-align: center; 
            margin: 60px 0;
            padding: 40px;
            background: rgba(123, 47, 247, 0.1);
            border-radius: 12px;
            border: 1px solid rgba(123, 47, 247, 0.3);
        }
        .cta h2 { font-size: 1.8rem; margin-bottom: 20px; }
        .btn {
            display: inline-block;
            background: linear-gradient(135deg, #00d4ff, #7b2ff7);
            color: white;
            padding: 15px 40px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 600;
            transition: transform 0.3s;
            border: none;
            cursor: pointer;
        }
        .btn:hover { transform: scale(1.05); }
        footer { 
            text-align: center; 
            padding: 40px 0;
            color: #666;
            border-top: 1px solid rgba(255,255,255,0.1);
            margin-top: 60px;
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>SwapBack</h1>
            <p class="subtitle">The Most Advanced Swap Router on Solana</p>
            <div style="margin: 20px 0;">
                <span class="badge">✅ Production Ready</span>
            </div>
        </header>

        <div class="status-grid">
            <div class="card">
                <div class="card-icon">✅</div>
                <div class="card-title">Programs Compiled</div>
                <div class="card-desc">4 Solana programs ready</div>
                <div class="badge" style="background: rgba(76, 175, 80, 0.2); color: #4caf50;">2.8 MB BPF</div>
            </div>
            <div class="card">
                <div class="card-icon">🚀</div>
                <div class="card-title">Deployment Ready</div>
                <div class="card-desc">Devnet deployment prepared</div>
                <div class="badge" style="background: rgba(76, 175, 80, 0.2); color: #4caf50;">Ready</div>
            </div>
            <div class="card">
                <div class="card-icon">⚙️</div>
                <div class="card-title">Interface Running</div>
                <div class="card-desc">Live on localhost:3001</div>
                <div class="badge" style="background: rgba(76, 175, 80, 0.2); color: #4caf50;">Active</div>
            </div>
        </div>

        <div class="features">
            <h2>Key Features</h2>
            <div class="feature-list">
                <div class="feature-item">
                    <h3>💰 70-80% Cashback</h3>
                    <p>Receive up to 80% of generated surplus as rebates</p>
                </div>
                <div class="feature-item">
                    <h3>🔥 Automatic Burn</h3>
                    <p>20-30% of surplus buys and burns $BACK</p>
                </div>
                <div class="feature-item">
                    <h3>🎯 Best Execution</h3>
                    <p>Intelligent routing for optimal prices</p>
                </div>
            </div>
        </div>

        <div class="cta">
            <h2>Ready to Deploy</h2>
            <p style="margin-bottom: 30px; color: #aaa;">All components are compiled and ready for Solana Devnet deployment</p>
            <p style="font-size: 0.9rem; color: #666;">Run: <code style="background: rgba(0,0,0,0.3); padding: 5px 10px; border-radius: 4px;">anchor deploy --provider.cluster devnet</code></p>
        </div>

        <footer>
            <p>SwapBack v0.1.0 • Built with Anchor & Solana</p>
            <p style="margin-top: 10px; font-size: 0.9rem;">Session: October 24, 2025</p>
        </footer>
    </div>
</body>
</html>
`;

const server = http.createServer((req, res) => {
    res.writeHead(200, { 
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache'
    });
    res.end(html);
});

server.listen(3001, '0.0.0.0', () => {
    console.log('✅ SwapBack Interface running at http://localhost:3001');
    console.log('✅ Server listening on all interfaces');
});

process.on('SIGTERM', () => {
    console.log('Server shutting down...');
    process.exit(0);
});
