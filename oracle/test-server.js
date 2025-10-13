const express = require('express');
const app = express();
const PORT = 3001;

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'OK' });
});

app.post('/simulate', (req, res) => {
  res.json({ status: 'OK', received: req.body });
});

const server = app.listen(PORT, () => {
  console.log(`✅ Serveur de test démarré sur le port ${PORT}`);
});

// Empêcher le serveur de se fermer
process.on('SIGINT', () => {
  console.log('Fermeture du serveur...');
  server.close(() => {
    console.log('Serveur fermé');
    process.exit(0);
  });
});
