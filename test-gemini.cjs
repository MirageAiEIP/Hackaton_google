#!/usr/bin/env node
/**
 * Batterie de tests pour l'analyse de sentiment avec Google Gemini
 * Tests avec différents niveaux d'urgence
 */

const axios = require('axios');

const API_URL = 'http://localhost:3000/api/v1/sentiment/analyze';

// Codes couleur pour le terminal
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

const testCases = [
  // ========== URGENCES VITALES (P0/P1) ==========
  {
    name: '🚨 URGENCE VITALE - Arrêt cardiaque',
    callId: 'test-cardiac-arrest',
    transcript: "Allô ! Allô ! Mon mari, il respire plus ! Il est tombé par terre, il bouge plus ! Aidez-moi vite s'il vous plaît !",
    expectedRecommendation: 'INCREASE_PRIORITY',
    expectedScore: { min: 85, max: 100 },
  },
  {
    name: '🚨 URGENCE VITALE - Hémorragie massive',
    callId: 'test-hemorrhage',
    transcript: "Aidez-moi ! Il y a du sang partout ! Mon fils s'est coupé avec une scie, ça saigne beaucoup, je sais pas quoi faire ! Vite !",
    expectedRecommendation: 'INCREASE_PRIORITY',
    expectedScore: { min: 85, max: 100 },
  },
  {
    name: '⚠️ URGENCE IMPORTANTE - Douleur thoracique',
    callId: 'test-chest-pain',
    transcript: "Bonjour, j'ai une douleur très forte dans la poitrine depuis 10 minutes. Ça serre, j'arrive pas bien à respirer. J'ai peur.",
    expectedRecommendation: 'INCREASE_PRIORITY',
    expectedScore: { min: 70, max: 95 },
  },
  {
    name: '⚠️ URGENCE IMPORTANTE - Signes d\'AVC',
    callId: 'test-stroke',
    transcript: "Ma femme, elle parle bizarre, sa bouche est tordue d'un côté. Elle arrive pas à lever le bras droit. C'est arrivé il y a 30 minutes.",
    expectedRecommendation: 'INCREASE_PRIORITY',
    expectedScore: { min: 75, max: 95 },
  },
  {
    name: '⚠️ URGENCE - Détresse respiratoire',
    callId: 'test-breathing',
    transcript: "J'arrive plus à respirer correctement ! J'ai fait une crise d'asthme, mon inhalateur marche pas. Aidez-moi !",
    expectedRecommendation: 'INCREASE_PRIORITY',
    expectedScore: { min: 80, max: 100 },
  },

  // ========== CAS MODÉRÉS (P2) ==========
  {
    name: '🟡 MODÉRÉ - Douleur abdominale intense',
    callId: 'test-abdominal-pain',
    transcript: "Bonjour, j'ai très mal au ventre depuis ce matin. C'est vraiment douloureux, ça me lance. Je sais pas si je dois venir aux urgences.",
    expectedRecommendation: 'MAINTAIN',
    expectedScore: { min: 60, max: 85 },
  },
  {
    name: '🟡 MODÉRÉ - Fièvre élevée',
    callId: 'test-fever',
    transcript: "Mon enfant a 39.5 de fièvre depuis hier soir. Il est un peu faible mais il boit. Je sais pas quoi faire.",
    expectedRecommendation: 'MAINTAIN',
    expectedScore: { min: 50, max: 75 },
  },
  {
    name: '🟡 MODÉRÉ - Entorse cheville',
    callId: 'test-ankle',
    transcript: "Je me suis tordu la cheville en faisant du sport. C'est gonflé et ça fait mal quand je marche. Je devrais venir ?",
    expectedRecommendation: 'MAINTAIN',
    expectedScore: { min: 40, max: 70 },
  },

  // ========== CAS NON URGENTS (P4/P5) ==========
  {
    name: '🟢 NON URGENT - Mal de tête léger',
    callId: 'test-headache',
    transcript: "Bonjour, j'ai un peu mal à la tête depuis ce matin. C'est supportable mais ça persiste. Vous pensez que je devrais consulter ?",
    expectedRecommendation: 'DECREASE_PRIORITY',
    expectedScore: { min: 10, max: 40 },
  },
  {
    name: '🟢 NON URGENT - Demande d\'information',
    callId: 'test-pharmacy',
    transcript: "Oui bonjour, je me présente, je m'appelle Alexandre Lagas, j'aurais voulu avoir un renseignement sur la pharmacie de garde s'il vous plaît.",
    expectedRecommendation: 'DECREASE_PRIORITY',
    expectedScore: { min: 0, max: 30 },
  },
  {
    name: '🟢 NON URGENT - Toux persistante',
    callId: 'test-cough',
    transcript: "Bonjour, j'ai une petite toux qui dure depuis quelques jours. Pas de fièvre, je me sens bien sinon. C'est juste un peu gênant.",
    expectedRecommendation: 'DECREASE_PRIORITY',
    expectedScore: { min: 15, max: 40 },
  },

  // ========== CAS CONFUS ==========
  {
    name: '🔵 CONFUS - Patient désorienté',
    callId: 'test-confused',
    transcript: "Euh... je... j'sais plus... mal... où je suis... aide... tête qui tourne... je... quoi ?",
    expectedRecommendation: 'INCREASE_PRIORITY',
    expectedScore: { min: 60, max: 90 },
  },
];

async function runTest(testCase) {
  try {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`${colors.cyan}TEST: ${testCase.name}${colors.reset}`);
    console.log(`${colors.blue}Transcript: "${testCase.transcript}"${colors.reset}`);

    const response = await axios.post(
      API_URL,
      {
        callId: testCase.callId,
        transcript: testCase.transcript,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const result = response.data.data; // Extract from wrapper

    // Afficher les résultats
    console.log(`\n${colors.magenta}📊 RÉSULTATS:${colors.reset}`);
    console.log(`  - Score texte: ${result.textScore}/100`);
    console.log(`  - Score audio: ${result.audioScore || 'N/A'}/100`);
    console.log(`  - Score final: ${result.finalScore}/100`);
    console.log(`  - Recommandation: ${result.recommendation}`);
    console.log(`  - Cohérence: ${result.coherence}`);
    console.log(`  - Confiance: ${(result.confidence * 100).toFixed(1)}%`);

    // Vérifications
    const checks = [];

    // Check recommendation
    const recommendationMatch = result.recommendation === testCase.expectedRecommendation;
    checks.push({
      name: 'Recommandation',
      pass: recommendationMatch,
      expected: testCase.expectedRecommendation,
      actual: result.recommendation,
    });

    // Check score range
    const scoreInRange =
      result.finalScore >= testCase.expectedScore.min &&
      result.finalScore <= testCase.expectedScore.max;
    checks.push({
      name: 'Score',
      pass: scoreInRange,
      expected: `${testCase.expectedScore.min}-${testCase.expectedScore.max}`,
      actual: result.finalScore,
    });

    // Afficher les vérifications
    console.log(`\n${colors.yellow}✓ VÉRIFICATIONS:${colors.reset}`);
    checks.forEach((check) => {
      const icon = check.pass ? '✅' : '❌';
      const color = check.pass ? colors.green : colors.red;
      console.log(
        `  ${icon} ${check.name}: ${color}${check.actual}${colors.reset} (attendu: ${check.expected})`
      );
    });

    const allPassed = checks.every((c) => c.pass);
    if (allPassed) {
      console.log(`\n${colors.green}✅ TEST RÉUSSI${colors.reset}`);
    } else {
      console.log(`\n${colors.red}❌ TEST ÉCHOUÉ${colors.reset}`);
    }

    return { testCase, result, checks, passed: allPassed };
  } catch (error) {
    console.error(`\n${colors.red}❌ ERREUR:${colors.reset}`, error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    return { testCase, error: error.message, passed: false };
  }
}

async function runAllTests() {
  console.log(`${colors.cyan}${'='.repeat(80)}`);
  console.log(`🧪 BATTERIE DE TESTS - ANALYSE DE SENTIMENT GEMINI`);
  console.log(`${'='.repeat(80)}${colors.reset}\n`);

  const results = [];

  for (const testCase of testCases) {
    const result = await runTest(testCase);
    results.push(result);

    // Pause entre les tests pour ne pas surcharger l'API
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  // Résumé final
  console.log(`\n\n${colors.cyan}${'='.repeat(80)}`);
  console.log(`📊 RÉSUMÉ FINAL`);
  console.log(`${'='.repeat(80)}${colors.reset}\n`);

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  const percentage = ((passed / total) * 100).toFixed(1);

  console.log(`Tests réussis: ${colors.green}${passed}/${total}${colors.reset} (${percentage}%)`);

  const failed = results.filter((r) => !r.passed);
  if (failed.length > 0) {
    console.log(`\n${colors.red}Tests échoués:${colors.reset}`);
    failed.forEach((r) => {
      console.log(`  ❌ ${r.testCase.name}`);
    });
  }

  console.log(`\n${colors.cyan}${'='.repeat(80)}${colors.reset}\n`);

  // Exit code basé sur les résultats
  process.exit(failed.length > 0 ? 1 : 0);
}

// Lancer tous les tests
runAllTests().catch((error) => {
  console.error(`${colors.red}Erreur fatale:${colors.reset}`, error);
  process.exit(1);
});
