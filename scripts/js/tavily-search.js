#!/usr/bin/env node

const https = require('https');

const TAVILY_API_KEY = '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';

async function searchTavily(query, maxResults = 5) {
  const data = JSON.stringify({
    api_key: TAVILY_API_KEY,
    query: query,
    max_results: maxResults,
    search_depth: 'advanced',
    include_answer: true
  });

  const options = {
    hostname: 'api.tavily.com',
    port: 443,
    path: '/search',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  const query = process.argv.slice(2).join(' ') || 'Solana CLI latest version cargo lock v4 support';
  
  console.log(`\n🔍 Recherche Tavily: "${query}"\n`);
  
  try {
    const results = await searchTavily(query);
    
    if (results.answer) {
      console.log('📝 Réponse:', results.answer, '\n');
    }
    
    if (results.results && results.results.length > 0) {
      console.log('🔗 Résultats:\n');
      results.results.forEach((result, i) => {
        console.log(`${i + 1}. ${result.title}`);
        console.log(`   URL: ${result.url}`);
        console.log(`   Score: ${result.score}`);
        console.log(`   Extrait: ${result.content.substring(0, 200)}...`);
        console.log('');
      });
    }
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

main();
