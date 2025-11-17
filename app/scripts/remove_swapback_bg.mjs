#!/usr/bin/env node

/**
 * Script pour générer une version transparente du logo texte SwapBack
 * Supprime automatiquement le fond noir et recadre l'image
 */

import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Chemins des fichiers
const INPUT_PATH = join(__dirname, '../public/icons/swapback_text_with_bg.png');
const OUTPUT_PATH = join(__dirname, '../public/icons/swapback_text_no_bg.png');

// Seuil de tolérance pour la détection de la couleur de fond (0-255)
const COLOR_TOLERANCE = 30;

async function removeBackground() {
  try {
    console.log('🔄 Lecture de l\'image source...');
    
    // Lire l'image et ses métadonnées
    const image = sharp(INPUT_PATH);
    const metadata = await image.metadata();
    const { data, info } = await image
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    console.log(`📐 Dimensions: ${info.width}x${info.height}, ${info.channels} canaux`);

    // Détecter la couleur de fond (pixel en haut à gauche [0,0])
    const bgR = data[0];
    const bgG = data[1];
    const bgB = data[2];
    
    console.log(`🎨 Couleur de fond détectée: RGB(${bgR}, ${bgG}, ${bgB})`);

    // Parcourir tous les pixels et remplacer le fond par de la transparence
    const newData = Buffer.from(data);
    
    for (let i = 0; i < data.length; i += info.channels) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      // Calculer la distance de couleur avec le fond
      const colorDistance = Math.sqrt(
        Math.pow(r - bgR, 2) +
        Math.pow(g - bgG, 2) +
        Math.pow(b - bgB, 2)
      );
      
      // Si la couleur est proche du fond, la rendre transparente
      if (colorDistance <= COLOR_TOLERANCE) {
        newData[i + 3] = 0; // Canal alpha = 0 (transparent)
      } else {
        newData[i + 3] = 255; // Canal alpha = 255 (opaque)
      }
    }

    console.log('✨ Suppression du fond en cours...');

    // Créer l'image avec le fond transparent
    const processedImage = sharp(newData, {
      raw: {
        width: info.width,
        height: info.height,
        channels: info.channels
      }
    });

    // Recadrer automatiquement pour supprimer les marges transparentes
    await processedImage
      .trim({
        threshold: 10, // Seuil pour détecter les bords
        background: { r: 0, g: 0, b: 0, alpha: 0 } // Fond transparent
      })
      .png({
        compressionLevel: 9,
        quality: 100
      })
      .toFile(OUTPUT_PATH);

    // Obtenir les nouvelles dimensions après recadrage
    const outputMetadata = await sharp(OUTPUT_PATH).metadata();
    
    console.log(`✅ Image générée avec succès !`);
    console.log(`📏 Nouvelles dimensions: ${outputMetadata.width}x${outputMetadata.height}`);
    console.log(`📁 Fichier créé: ${OUTPUT_PATH}`);
    console.log(`💾 Taille: ${(outputMetadata.size / 1024).toFixed(2)} KB`);
    
  } catch (error) {
    console.error('❌ Erreur lors du traitement:', error.message);
    
    if (error.code === 'ENOENT') {
      console.error(`\n⚠️  Le fichier source n'existe pas: ${INPUT_PATH}`);
      console.error('Assurez-vous que swapback_text_with_bg.png est présent dans public/icons/\n');
    }
    
    process.exit(1);
  }
}

// Exécuter le script
console.log('🚀 Démarrage de la génération du logo transparent...\n');
removeBackground();
