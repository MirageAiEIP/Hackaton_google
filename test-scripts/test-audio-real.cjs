#!/usr/bin/env node
/**
 * Test du système avec fichiers audio réels
 * Pipeline: Whisper → Gemini → Analyse vocale → Fusion
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

const API_URL = 'http://localhost:3000/api/v1/sentiment/upload-audio';
const AUDIO_DIR = './test_audio';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

const audioFiles = [
  {
    filename: 'tel_test.wav',
    description: 'Test téléphone - Demande pharmacie de garde (calme)',
    expectedCategory: 'NON URGENT',
  },
  {
    filename: 'WIN_20251012_00_59_12_Pro.wav',
    description: 'Enregistrement 1 - À analyser',
    expectedCategory: 'À déterminer',
  },
  {
    filename: 'WIN_20251012_00_59_24_Pro.wav',
    description: 'Enregistrement 2 - À analyser',
    expectedCategory: 'À déterminer',
  },
];

async function testAudioFile(audioFile, index, total) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`${colors.cyan}TEST ${index}/${total}: ${audioFile.description}${colors.reset}`);
  console.log(`${colors.blue}Fichier: ${audioFile.filename}${colors.reset}`);

  try {
    const audioPath = path.join(AUDIO_DIR, audioFile.filename);

    // Vérifier que le fichier existe
    if (!fs.existsSync(audioPath)) {
      console.log(`${colors.red}ERREUR: Fichier introuvable${colors.reset}`);
      return { audioFile, error: 'File not found', passed: false };
    }

    const fileSize = fs.statSync(audioPath).size;
    console.log(`${colors.yellow}Taille: ${(fileSize / 1024).toFixed(1)} KB${colors.reset}`);

    // Créer FormData avec le fichier audio
    const form = new FormData();
    form.append('audio', fs.createReadStream(audioPath));
    form.append('callId', `test-audio-${Date.now()}-${index}`);

    console.log(`${colors.yellow}Upload en cours...${colors.reset}`);

    const response = await axios.post(API_URL, form, {
      headers: {
        ...form.getHeaders(),
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 60000, // 60s timeout
    });

    const result = response.data.data; // Extract from wrapper

    console.log(`\n${colors.magenta}RÉSULTATS:${colors.reset}`);
    console.log(`${colors.green}Upload réussi${colors.reset}`);
    console.log(`  Call ID: ${result.callId}`);
    console.log(`  Audio URL: ${result.audioUrl}`);

    console.log(`\n${colors.yellow}Analyse en cours...${colors.reset}`);

    const analysisResponse = await axios.post(
      'http://localhost:3000/api/v1/sentiment/analyze',
      {
        callId: result.callId,
        transcript: 'Audio transcription',
        audioUrl: result.audioUrl,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 60000,
      }
    );

    const analysis = analysisResponse.data.data;

    console.log(`\n${colors.magenta}ANALYSE COMPLÈTE:${colors.reset}`);
    console.log(`  ${colors.cyan}Score texte (Gemini):${colors.reset} ${analysis.textScore}/100`);
    console.log(`  ${colors.cyan}Score vocal (ponctuation):${colors.reset} ${analysis.audioScore}/100`);
    console.log(`  ${colors.cyan}Score FINAL:${colors.reset} ${colors.green}${analysis.finalScore}/100${colors.reset}`);
    console.log(`  ${colors.cyan}Recommandation:${colors.reset} ${analysis.recommendation}`);
    console.log(`  ${colors.cyan}Cohérence:${colors.reset} ${analysis.coherence}`);
    console.log(`  ${colors.cyan}Confiance:${colors.reset} ${(analysis.confidence * 100).toFixed(1)}%`);
    console.log(`  ${colors.cyan}Raisonnement:${colors.reset}`);
    console.log(`     ${analysis.reasoning.substring(0, 200)}...`);

    // Déterminer si c'est un succès
    let passed = true;
    let category = '';

    if (analysis.finalScore >= 70) {
      category = 'URGENT';
    } else if (analysis.finalScore >= 40) {
      category = 'MODÉRÉ';
    } else {
      category = 'NON URGENT';
    }

    console.log(`\n${colors.yellow}Catégorie détectée: ${category}${colors.reset}`);
    console.log(`${colors.yellow}Catégorie attendue: ${audioFile.expectedCategory}${colors.reset}`);

    return {
      audioFile,
      result: analysis,
      category,
      passed,
    };

  } catch (error) {
    console.log(`\n${colors.red}ERREUR:${colors.reset}`, error.message);
    if (error.response) {
      console.log(`${colors.red}Response status:${colors.reset}`, error.response.status);
      console.log(`${colors.red}Response data:${colors.reset}`, JSON.stringify(error.response.data, null, 2));
    }
    return { audioFile, error: error.message, passed: false };
  }
}

async function runAllTests() {
  console.log(`${colors.cyan}${'='.repeat(80)}`);
  console.log(`TEST SYSTÈME COMPLET - WHISPER + GEMINI + ANALYSE VOCALE`);
  console.log(`${'='.repeat(80)}${colors.reset}\n`);

  const results = [];
  const startTime = Date.now();

  for (let i = 0; i < audioFiles.length; i++) {
    const result = await testAudioFile(audioFiles[i], i + 1, audioFiles.length);
    results.push(result);

    // Pause entre les tests
    if (i < audioFiles.length - 1) {
      console.log(`\n${colors.yellow}Pause 3s avant le prochain test...${colors.reset}`);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(1);

  // Résumé final
  console.log(`\n\n${colors.cyan}${'='.repeat(80)}`);
  console.log(`RÉSUMÉ FINAL`);
  console.log(`${'='.repeat(80)}${colors.reset}\n`);

  console.log(`Temps d'exécution: ${duration}s`);
  console.log(`Fichiers testés: ${audioFiles.length}`);

  const successful = results.filter((r) => !r.error).length;
  const failed = results.filter((r) => r.error).length;

  console.log(`${colors.green}Succès: ${successful}/${audioFiles.length}${colors.reset}`);
  if (failed > 0) {
    console.log(`${colors.red}Échecs: ${failed}/${audioFiles.length}${colors.reset}`);
  }

  console.log(`\n${colors.magenta}DÉTAILS PAR FICHIER:${colors.reset}`);
  results.forEach((r, idx) => {
    if (r.error) {
      console.log(`  ${idx + 1}. ${colors.red}${r.audioFile.filename}${colors.reset} - Erreur: ${r.error}`);
    } else {
      const scoreColor = r.result.finalScore >= 70 ? colors.red : r.result.finalScore >= 40 ? colors.yellow : colors.green;
      console.log(`  ${idx + 1}. ${colors.green}${r.audioFile.filename}${colors.reset}`);
      console.log(`     Score: ${scoreColor}${r.result.finalScore}/100${colors.reset} | ${r.result.recommendation} | ${r.category}`);
    }
  });

  console.log(`\n${colors.cyan}${'='.repeat(80)}${colors.reset}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

// Vérifier que form-data est installé
try {
  require.resolve('form-data');
} catch (e) {
  console.error(`${colors.red}ERREUR: Le package 'form-data' n'est pas installé.${colors.reset}`);
  console.log(`${colors.yellow}Installez-le avec: npm install form-data${colors.reset}`);
  process.exit(1);
}

// Lancer les tests
runAllTests().catch((error) => {
  console.error(`${colors.red}Erreur fatale:${colors.reset}`, error);
  process.exit(1);
});
