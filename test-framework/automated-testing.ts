/**
 * Framework de Test Automatique pour le Système de Triage IA
 *
 * Usage:
 * npm run test:calibration
 */

/* eslint-disable no-console */

import fs from 'fs';
import path from 'path';

interface ClinicalCase {
  id: string;
  transcript: string;
  audioUrl: string | null;
  groundTruth: {
    priority: string;
    sentiment: string;
    clinicalIndicators: string[];
    expectedScoreMin: number;
    expectedScoreMax: number;
    expectedRecommendation: string;
  };
  metadata: {
    category: string;
    description: string;
    requiredAction: string;
  };
}

interface TestResult {
  caseId: string;
  passed: boolean;
  actualScore: number;
  expectedScoreMin: number;
  expectedScoreMax: number;
  actualRecommendation: string;
  expectedRecommendation: string;
  errors: string[];
  category: string;
}

interface ConfusionMatrix {
  'P0-P1': { 'P0-P1': number; P2: number; P3: number; 'P4-P5': number };
  P2: { 'P0-P1': number; P2: number; P3: number; 'P4-P5': number };
  P3: { 'P0-P1': number; P2: number; P3: number; 'P4-P5': number };
  'P4-P5': { 'P0-P1': number; P2: number; P3: number; 'P4-P5': number };
}

class TriageTestFramework {
  private baseUrl = 'http://localhost:3000';
  private results: TestResult[] = [];
  private confusionMatrix: ConfusionMatrix = {
    'P0-P1': { 'P0-P1': 0, P2: 0, P3: 0, 'P4-P5': 0 },
    P2: { 'P0-P1': 0, P2: 0, P3: 0, 'P4-P5': 0 },
    P3: { 'P0-P1': 0, P2: 0, P3: 0, 'P4-P5': 0 },
    'P4-P5': { 'P0-P1': 0, P2: 0, P3: 0, 'P4-P5': 0 },
  };

  /**
   * Charge les cas cliniques depuis le fichier JSON
   */
  async loadClinicalCases(): Promise<ClinicalCase[]> {
    const casesPath = path.join(__dirname, 'clinical-cases.json');
    const casesData = await fs.promises.readFile(casesPath, 'utf-8');
    return JSON.parse(casesData);
  }

  /**
   * Exécute un test sur un cas clinique
   */
  async testCase(clinicalCase: ClinicalCase): Promise<TestResult> {
    const errors: string[] = [];

    try {
      // Appel à l'API d'analyse de sentiment
      const response = await fetch(`${this.baseUrl}/api/sentiment/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callId: clinicalCase.id,
          transcript: clinicalCase.transcript,
          audioUrl: clinicalCase.audioUrl,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const result = await response.json();

      // Validation du score
      const scoreInRange =
        result.finalScore >= clinicalCase.groundTruth.expectedScoreMin &&
        result.finalScore <= clinicalCase.groundTruth.expectedScoreMax;

      if (!scoreInRange) {
        errors.push(
          `Score ${result.finalScore} hors intervalle [${clinicalCase.groundTruth.expectedScoreMin}, ${clinicalCase.groundTruth.expectedScoreMax}]`
        );
      }

      // Validation de la recommandation
      if (result.recommendation !== clinicalCase.groundTruth.expectedRecommendation) {
        errors.push(
          `Recommandation incorrecte: ${result.recommendation} (attendu: ${clinicalCase.groundTruth.expectedRecommendation})`
        );
      }

      // Mise à jour de la confusion matrix
      this.updateConfusionMatrix(
        clinicalCase.groundTruth.priority,
        this.scoreToPriority(result.finalScore)
      );

      return {
        caseId: clinicalCase.id,
        passed: errors.length === 0,
        actualScore: result.finalScore,
        expectedScoreMin: clinicalCase.groundTruth.expectedScoreMin,
        expectedScoreMax: clinicalCase.groundTruth.expectedScoreMax,
        actualRecommendation: result.recommendation,
        expectedRecommendation: clinicalCase.groundTruth.expectedRecommendation,
        errors,
        category: clinicalCase.metadata.category,
      };
    } catch (error) {
      return {
        caseId: clinicalCase.id,
        passed: false,
        actualScore: 0,
        expectedScoreMin: clinicalCase.groundTruth.expectedScoreMin,
        expectedScoreMax: clinicalCase.groundTruth.expectedScoreMax,
        actualRecommendation: 'ERROR',
        expectedRecommendation: clinicalCase.groundTruth.expectedRecommendation,
        errors: [`Exception: ${(error as Error).message}`],
        category: clinicalCase.metadata.category,
      };
    }
  }

  /**
   * Convertit un score en priorité P0-P5
   */
  private scoreToPriority(score: number): string {
    if (score >= 95) {
      return 'P0-P1';
    }
    if (score >= 75) {
      return 'P2';
    }
    if (score >= 40) {
      return 'P3';
    }
    return 'P4-P5';
  }

  /**
   * Met à jour la matrice de confusion
   */
  private updateConfusionMatrix(actual: string, predicted: string) {
    const actualKey = actual === 'P0' || actual === 'P1' ? 'P0-P1' : actual === 'P4' || actual === 'P5' ? 'P4-P5' : actual;
    const predictedKey = predicted;

    if (this.confusionMatrix[actualKey as keyof ConfusionMatrix]) {
      this.confusionMatrix[actualKey as keyof ConfusionMatrix][predictedKey as keyof (typeof this.confusionMatrix)['P0-P1']]++;
    }
  }

  /**
   * Calcule les métriques de performance
   */
  calculateMetrics() {
    const totalTests = this.results.length;
    const passedTests = this.results.filter((r) => r.passed).length;
    const accuracy = passedTests / totalTests;

    // Calcul par catégorie
    const categories = [...new Set(this.results.map((r) => r.category))];
    const categoryMetrics = categories.map((cat) => {
      const catResults = this.results.filter((r) => r.category === cat);
      const catPassed = catResults.filter((r) => r.passed).length;
      return {
        category: cat,
        total: catResults.length,
        passed: catPassed,
        accuracy: catPassed / catResults.length,
      };
    });

    // Métriques critiques : Sensibilité pour P0-P1
    const p0p1True = this.confusionMatrix['P0-P1']['P0-P1'];
    const p0p1False =
      this.confusionMatrix['P0-P1'].P2 +
      this.confusionMatrix['P0-P1'].P3 +
      this.confusionMatrix['P0-P1']['P4-P5'];
    const p0p1Sensitivity = p0p1True / (p0p1True + p0p1False);

    // Calcul coût des erreurs (pondéré)
    let totalCost = 0;
    totalCost += this.confusionMatrix['P0-P1'].P3 * 100; // CRITIQUE
    totalCost += this.confusionMatrix['P0-P1']['P4-P5'] * 100;
    totalCost += this.confusionMatrix['P0-P1'].P2 * 50;
    totalCost += this.confusionMatrix.P2.P3 * 50;
    totalCost += this.confusionMatrix.P2['P4-P5'] * 50;
    totalCost += this.confusionMatrix.P3['P0-P1'] * 20;
    totalCost += this.confusionMatrix['P4-P5'].P2 * 10;

    return {
      totalTests,
      passedTests,
      accuracy,
      categoryMetrics,
      p0p1Sensitivity,
      totalCost,
      confusionMatrix: this.confusionMatrix,
    };
  }

  /**
   * Génère un rapport HTML
   */
  generateHTMLReport(metrics: ReturnType<typeof this.calculateMetrics>) {
    const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rapport de Calibration - Triage IA</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; }
    h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }
    h2 { color: #34495e; margin-top: 30px; }
    .metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin: 20px 0; }
    .metric-card { background: #ecf0f1; padding: 20px; border-radius: 5px; border-left: 4px solid #3498db; }
    .metric-value { font-size: 2em; font-weight: bold; color: #2c3e50; }
    .metric-label { color: #7f8c8d; font-size: 0.9em; }
    .critical { border-left-color: #e74c3c; }
    .success { border-left-color: #27ae60; }
    .warning { border-left-color: #f39c12; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #34495e; color: white; }
    tr:hover { background: #f5f5f5; }
    .passed { color: #27ae60; font-weight: bold; }
    .failed { color: #e74c3c; font-weight: bold; }
    .confusion-matrix { display: grid; grid-template-columns: repeat(5, 1fr); gap: 5px; margin: 20px 0; }
    .cm-cell { background: #ecf0f1; padding: 15px; text-align: center; border-radius: 3px; }
    .cm-header { background: #34495e; color: white; font-weight: bold; }
    .cm-diagonal { background: #27ae60; color: white; font-weight: bold; }
    .cm-error { background: #e74c3c; color: white; }
  </style>
</head>
<body>
  <div class="container">
    <h1>📊 Rapport de Calibration - Système de Triage IA</h1>
    <p><strong>Date:</strong> ${new Date().toLocaleString('fr-FR')}</p>

    <h2>📈 Métriques Globales</h2>
    <div class="metric-grid">
      <div class="metric-card ${metrics.accuracy >= 0.9 ? 'success' : 'warning'}">
        <div class="metric-label">Précision Globale</div>
        <div class="metric-value">${(metrics.accuracy * 100).toFixed(1)}%</div>
        <small>${metrics.passedTests} / ${metrics.totalTests} tests réussis</small>
      </div>

      <div class="metric-card ${metrics.p0p1Sensitivity >= 0.95 ? 'success' : 'critical'}">
        <div class="metric-label">Sensibilité P0-P1 (CRITIQUE)</div>
        <div class="metric-value">${(metrics.p0p1Sensitivity * 100).toFixed(1)}%</div>
        <small>Objectif: ≥ 95%</small>
      </div>

      <div class="metric-card ${metrics.totalCost < 200 ? 'success' : 'critical'}">
        <div class="metric-label">Coût des Erreurs</div>
        <div class="metric-value">${metrics.totalCost}</div>
        <small>Plus bas = meilleur</small>
      </div>
    </div>

    <h2>📋 Performance par Catégorie</h2>
    <table>
      <thead>
        <tr>
          <th>Catégorie</th>
          <th>Tests</th>
          <th>Réussis</th>
          <th>Précision</th>
        </tr>
      </thead>
      <tbody>
        ${metrics.categoryMetrics
          .map(
            (cat) => `
          <tr>
            <td>${cat.category}</td>
            <td>${cat.total}</td>
            <td>${cat.passed}</td>
            <td class="${cat.accuracy >= 0.9 ? 'passed' : 'failed'}">${(cat.accuracy * 100).toFixed(1)}%</td>
          </tr>
        `
          )
          .join('')}
      </tbody>
    </table>

    <h2>🎯 Matrice de Confusion</h2>
    <div class="confusion-matrix">
      <div class="cm-cell cm-header"></div>
      <div class="cm-cell cm-header">P0-P1 (Prédit)</div>
      <div class="cm-cell cm-header">P2 (Prédit)</div>
      <div class="cm-cell cm-header">P3 (Prédit)</div>
      <div class="cm-cell cm-header">P4-P5 (Prédit)</div>

      <div class="cm-cell cm-header">P0-P1 (Réel)</div>
      <div class="cm-cell cm-diagonal">${metrics.confusionMatrix['P0-P1']['P0-P1']}</div>
      <div class="cm-cell cm-error">${metrics.confusionMatrix['P0-P1'].P2}</div>
      <div class="cm-cell cm-error">${metrics.confusionMatrix['P0-P1'].P3}</div>
      <div class="cm-cell cm-error">${metrics.confusionMatrix['P0-P1']['P4-P5']}</div>

      <div class="cm-cell cm-header">P2 (Réel)</div>
      <div class="cm-cell cm-error">${metrics.confusionMatrix.P2['P0-P1']}</div>
      <div class="cm-cell cm-diagonal">${metrics.confusionMatrix.P2.P2}</div>
      <div class="cm-cell">${metrics.confusionMatrix.P2.P3}</div>
      <div class="cm-cell cm-error">${metrics.confusionMatrix.P2['P4-P5']}</div>

      <div class="cm-cell cm-header">P3 (Réel)</div>
      <div class="cm-cell">${metrics.confusionMatrix.P3['P0-P1']}</div>
      <div class="cm-cell">${metrics.confusionMatrix.P3.P2}</div>
      <div class="cm-cell cm-diagonal">${metrics.confusionMatrix.P3.P3}</div>
      <div class="cm-cell">${metrics.confusionMatrix.P3['P4-P5']}</div>

      <div class="cm-cell cm-header">P4-P5 (Réel)</div>
      <div class="cm-cell">${metrics.confusionMatrix['P4-P5']['P0-P1']}</div>
      <div class="cm-cell">${metrics.confusionMatrix['P4-P5'].P2}</div>
      <div class="cm-cell">${metrics.confusionMatrix['P4-P5'].P3}</div>
      <div class="cm-cell cm-diagonal">${metrics.confusionMatrix['P4-P5']['P4-P5']}</div>
    </div>

    <h2>🔍 Résultats Détaillés</h2>
    <table>
      <thead>
        <tr>
          <th>ID Cas</th>
          <th>Catégorie</th>
          <th>Score Obtenu</th>
          <th>Score Attendu</th>
          <th>Recommandation</th>
          <th>Statut</th>
          <th>Erreurs</th>
        </tr>
      </thead>
      <tbody>
        ${this.results
          .map(
            (r) => `
          <tr>
            <td>${r.caseId}</td>
            <td>${r.category}</td>
            <td>${r.actualScore}</td>
            <td>${r.expectedScoreMin}-${r.expectedScoreMax}</td>
            <td>${r.actualRecommendation}</td>
            <td class="${r.passed ? 'passed' : 'failed'}">${r.passed ? '✓ PASS' : '✗ FAIL'}</td>
            <td>${r.errors.join(', ')}</td>
          </tr>
        `
          )
          .join('')}
      </tbody>
    </table>

    <h2>💡 Recommandations</h2>
    <ul>
      ${metrics.p0p1Sensitivity < 0.95 ? '<li class="failed">⚠️ CRITIQUE: Sensibilité P0-P1 insuffisante. Ajuster les seuils pour augmenter la détection des urgences vitales.</li>' : ''}
      ${metrics.totalCost > 200 ? '<li class="warning">⚠️ Coût des erreurs élevé. Revoir les pondérations et bonus cliniques.</li>' : ''}
      ${metrics.accuracy < 0.85 ? '<li class="warning">⚠️ Précision globale < 85%. Envisager plus de calibration.</li>' : ''}
      ${metrics.accuracy >= 0.9 && metrics.p0p1Sensitivity >= 0.95 ? '<li class="passed">✓ Performance optimale atteinte !</li>' : ''}
    </ul>
  </div>
</body>
</html>
    `;

    return html;
  }

  /**
   * Exécute tous les tests
   */
  async runAllTests() {
    console.log('🚀 Démarrage des tests de calibration...\n');

    const cases = await this.loadClinicalCases();
    console.log(`📋 ${cases.length} cas cliniques chargés\n`);

    for (const clinicalCase of cases) {
      console.log(`Testing: ${clinicalCase.id}...`);
      const result = await this.testCase(clinicalCase);
      this.results.push(result);

      if (result.passed) {
        console.log(`  ✓ PASS\n`);
      } else {
        console.log(`  ✗ FAIL: ${result.errors.join(', ')}\n`);
      }

      // Délai pour ne pas surcharger le serveur
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // Calculer métriques
    const metrics = this.calculateMetrics();

    // Générer rapport
    const htmlReport = this.generateHTMLReport(metrics);
    const reportPath = path.join(__dirname, '../reports/calibration-report.html');
    await fs.promises.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.promises.writeFile(reportPath, htmlReport);

    // Afficher résumé
    console.log('\n' + '='.repeat(60));
    console.log('📊 RÉSUMÉ DES TESTS');
    console.log('='.repeat(60));
    console.log(`Total: ${metrics.totalTests}`);
    console.log(`Réussis: ${metrics.passedTests}`);
    console.log(`Précision: ${(metrics.accuracy * 100).toFixed(1)}%`);
    console.log(`Sensibilité P0-P1: ${(metrics.p0p1Sensitivity * 100).toFixed(1)}%`);
    console.log(`Coût erreurs: ${metrics.totalCost}`);
    console.log('='.repeat(60));
    console.log(`\n📄 Rapport détaillé: ${reportPath}\n`);

    // Retourner le code de sortie approprié
    return metrics.p0p1Sensitivity >= 0.95 && metrics.accuracy >= 0.85 ? 0 : 1;
  }
}

// Exécution
const framework = new TriageTestFramework();
framework.runAllTests().then((exitCode) => {
  process.exit(exitCode);
}).catch((error) => {
  console.error('❌ Erreur fatale:', error);
  process.exit(1);
});
