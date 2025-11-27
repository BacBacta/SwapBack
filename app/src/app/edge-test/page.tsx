export const runtime = 'edge';

export default function EdgeTestPage() {
  return (
    <html>
      <head>
        <title>Edge Test</title>
      </head>
      <body style={{ margin: 0, padding: '2rem', backgroundColor: '#111', color: '#0f0', fontFamily: 'monospace' }}>
        <h1>✅ Edge Runtime Test</h1>
        <p>Si vous voyez ceci, Vercel fonctionne !</p>
        <p>Date: {new Date().toISOString()}</p>
      </body>
    </html>
  );
}
