# Framework de Test Automatique - Système de Triage IA

Framework complet pour valider et calibrer le système de triage médical avec des cas cliniques annotés.

## 🚀 Quick Start

```bash
# 1. Démarrer le serveur de développement
npm run dev

# 2. Dans un autre terminal, lancer les tests de calibration
npm run test:calibration

# 3. Ouvrir le rapport HTML généré
# reports/calibration-report.html
```

## 📁 Structure

```
test-framework/
├── clinical-cases.json          # 20 cas cliniques annotés par priorité
├── automated-testing.ts         # Framework de test automatique
├── audio-samples/               # (À créer) Fichiers audio .wav
└── README.md                    # Ce fichier
```

## 📋 Cas Cliniques Inclus

Le dataset contient **20 cas cliniques** couvrant tous les niveaux de priorité :

### P0-P1 : Urgences Vitales (6 cas)
- Arrêt cardiaque
- Infarctus du myocarde
- Hémorragie sévère
- Détresse respiratoire aiguë
- AVC
- Céphalée en coup de tonnerre

### P2 : Urgences (5 cas)
- Douleur abdominale sévère
- Fracture
- Confusion aiguë personne âgée
- Attaque de panique
- Réaction allergique

### P3 : Non Urgent (5 cas)
- Fièvre enfant
- Douleur abdominale légère
- Entorse cheville
- Brûlure 2e degré

### P4-P5 : Conseil / Admin (4 cas)
- Demande pharmacie de garde
- Prise de rendez-vous
- Question médicament
- Rhume / infection virale

## 🎯 Métriques Évaluées

### 1. Métriques Globales
- **Précision (Accuracy)** : % de tests réussis
- **Sensibilité P0-P1** : % de vrais positifs pour urgences vitales (OBJECTIF: ≥ 95%)
- **Coût des Erreurs** : Score pondéré des erreurs critiques

### 2. Coûts des Erreurs
```
Sous-estimation P0-P1 → P3/P4   = 100 points (CRITIQUE)
Sous-estimation P0-P1 → P2      = 50 points
Sous-estimation P2 → P3/P4      = 50 points
Sur-estimation P4 → P2          = 10 points
Sur-estimation P3 → P0-P1       = 20 points
```

### 3. Matrice de Confusion
```
              Prédit:
              P0-P1  P2    P3    P4-P5
Réel: P0-P1   [TP]   FN    FN    FN
      P2      FP     [TP]  FN    FN
      P3      FP     FP    [TP]  FN
      P4-P5   FP     FP    FP    [TP]
```

## 🔧 Configuration

### Modifier les Seuils de Score
Éditer `src/services/analysis/hybrid-sentiment.service.ts`:

```typescript
private getRecommendation(score: number): RecommendationType {
  if (score >= 85) {  // Seuil INCREASE_PRIORITY
    return 'INCREASE_PRIORITY';
  }
  if (score <= 25) {  // Seuil DECREASE_PRIORITY
    return 'DECREASE_PRIORITY';
  }
  return 'MAINTAIN';
}
```

### Ajuster les Bonus Cliniques
```typescript
private calculateClinicalBonus(indicators: string[]): number {
  let bonus = 0;
  if (indicators.includes('PANIC')) bonus += 8;
  if (indicators.includes('DYSPNEA')) bonus += 6;
  // ... etc
  return bonus;
}
```

## 📊 Interpréter les Résultats

### Exemple de Sortie Console
```
🚀 Démarrage des tests de calibration...

📋 20 cas cliniques chargés

Testing: CASE_001_CARDIAC_ARREST...
  ✓ PASS

Testing: CASE_011_PHARMACY_INFO...
  ✗ FAIL: Score 35 hors intervalle [0, 15]

...

============================================================
📊 RÉSUMÉ DES TESTS
============================================================
Total: 20
Réussis: 18
Précision: 90.0%
Sensibilité P0-P1: 100.0%
Coût erreurs: 50
============================================================

📄 Rapport détaillé: reports/calibration-report.html
```

### Rapport HTML
Le rapport HTML généré contient :
- Dashboard avec métriques clés
- Performance par catégorie médicale
- Matrice de confusion visualisée
- Tableau détaillé de tous les cas
- Recommandations d'amélioration

## ✅ Critères de Validation

Le test réussit si :
- ✅ Sensibilité P0-P1 ≥ 95%
- ✅ Précision globale ≥ 85%
- ✅ Pas de faux négatifs critiques (P0-P1 → P3/P4)

## 📝 Ajouter des Cas Cliniques

### Format JSON
```json
{
  "id": "CASE_XXX_DESCRIPTION",
  "transcript": "Transcription de l'appel...",
  "audioUrl": null,
  "groundTruth": {
    "priority": "P0",
    "sentiment": "PANICKED",
    "clinicalIndicators": ["PANIC", "DYSPNEA"],
    "expectedScoreMin": 95,
    "expectedScoreMax": 100,
    "expectedRecommendation": "INCREASE_PRIORITY"
  },
  "metadata": {
    "category": "Urgence vitale",
    "description": "Description médicale",
    "requiredAction": "Action requise"
  }
}
```

### Avec Audio
1. Placer le fichier `.wav` dans `test-framework/audio-samples/`
2. Référencer dans `audioUrl`: `"audioUrl": "audio-samples/case_xxx.wav"`

## 🔄 Workflow de Calibration

### Étape 1 : Test Initial
```bash
npm run test:calibration
```
Analyser le rapport HTML pour identifier les problèmes.

### Étape 2 : Ajustement
Modifier les paramètres dans :
- `src/services/analysis/hybrid-sentiment.service.ts` (seuils)
- `src/services/analysis/audio-analysis.service.ts` (détection PANIC)

### Étape 3 : Re-test
```bash
npm run test:calibration
```
Comparer avec le test précédent.

### Étape 4 : Itération
Répéter jusqu'à atteindre :
- Sensibilité P0-P1 ≥ 95%
- Précision globale ≥ 85%

## 📈 Suivi des Performances

### Historique des Calibrations
Sauvegarder chaque rapport avec horodatage :
```bash
cp reports/calibration-report.html reports/calibration-2025-10-12-v1.html
```

### Comparer les Versions
Ouvrir plusieurs rapports côte à côte pour comparer :
- Évolution de la sensibilité P0-P1
- Réduction du coût des erreurs
- Amélioration par catégorie

## 🧪 Tests Avancés

### Test avec Audio Réel
```typescript
// Ajouter dans clinical-cases.json
{
  "id": "CASE_AUDIO_001",
  "transcript": "Sera généré par Whisper",
  "audioUrl": "audio-samples/real-emergency-call.wav",
  // ...
}
```

### Test de Performance
```bash
# Mesurer le temps de traitement
time npm run test:calibration
```

### Test de Charge
Dupliquer les cas cliniques pour tester avec 100+ cas.

## 📚 Ressources

### Datasets Recommandés
- **MIMIC-IV-Ext Triage**: https://physionet.org/content/mietic/1.0.0/
- **MIMIC-IV-ED**: https://physionet.org/content/mimic-iv-ed/
- **Kaggle Emergency Triage**: https://www.kaggle.com/datasets

### Documentation
- `CALIBRATION_GUIDE.md` : Guide complet de calibration
- `SENTIMENT_ANALYSIS.md` : Documentation de l'analyse de sentiment
- `CLAUDE.md` : Instructions projet

## 🆘 Troubleshooting

### Erreur "Cannot connect to localhost:3000"
```bash
# Vérifier que le serveur est démarré
npm run dev
```

### Erreur "clinical-cases.json not found"
```bash
# Vérifier le chemin
ls test-framework/clinical-cases.json
```

### Tests échouent massivement
1. Vérifier que Claude Sonnet 4.5 est configuré
2. Vérifier les logs du serveur pour erreurs API
3. Tester manuellement un cas avec `test-audio.cjs`

## 🤝 Contribution

Pour ajouter des cas cliniques :
1. Annoter par un médecin régulateur
2. Valider le format JSON
3. Tester individuellement
4. Ajouter au dataset principal

---

**Objectif** : Atteindre 95%+ de sensibilité sur P0-P1 avec 85%+ de précision globale pour déploiement en production.
