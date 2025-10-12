#!/usr/bin/env node
/**
 * Batterie COMPLÈTE de 100 tests pour l'analyse de sentiment Gemini
 * Couvre tous les scénarios possibles pour le hackathon Google
 */

const axios = require('axios');

const API_URL = 'http://localhost:3000/api/v1/sentiment/analyze';

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
  // ========== URGENCES VITALES P0/P1 (score 85-100) - 25 cas ==========
  {
    name: '🚨 P0 - Arrêt cardiaque',
    callId: 'p0-cardiac-arrest-1',
    transcript: "Allô ! Mon mari ne respire plus ! Il est tombé, il bouge plus du tout ! Vite !",
    expectedRecommendation: 'INCREASE_PRIORITY',
    expectedScore: { min: 85, max: 100 },
  },
  {
    name: '🚨 P0 - Arrêt cardiaque (panique extrême)',
    callId: 'p0-cardiac-arrest-2',
    transcript: "Au secours ! Au secours ! Il respire plus ! Aidez-moi ! Je sais pas quoi faire ! Vite !",
    expectedRecommendation: 'INCREASE_PRIORITY',
    expectedScore: { min: 85, max: 100 },
  },
  {
    name: '🚨 P0 - Inconscience totale',
    callId: 'p0-unconscious',
    transcript: "Mon père est inconscient ! Il répond plus ! Il est tout mou ! Venez vite s'il vous plaît !",
    expectedRecommendation: 'INCREASE_PRIORITY',
    expectedScore: { min: 85, max: 100 },
  },
  {
    name: '🚨 P1 - Hémorragie massive',
    callId: 'p1-hemorrhage-1',
    transcript: "Il y a du sang partout ! Mon fils s'est coupé avec une scie, ça saigne énormément ! Aidez-moi !",
    expectedRecommendation: 'INCREASE_PRIORITY',
    expectedScore: { min: 85, max: 100 },
  },
  {
    name: '🚨 P1 - Hémorragie post-accouchement',
    callId: 'p1-hemorrhage-2',
    transcript: "Ma femme vient d'accoucher, elle perd beaucoup de sang, vraiment beaucoup ! Elle est toute pâle !",
    expectedRecommendation: 'INCREASE_PRIORITY',
    expectedScore: { min: 85, max: 100 },
  },
  {
    name: '🚨 P1 - AVC classique',
    callId: 'p1-stroke-1',
    transcript: "Ma femme, sa bouche est tordue d'un côté, elle arrive pas à lever le bras droit. Elle parle bizarre.",
    expectedRecommendation: 'INCREASE_PRIORITY',
    expectedScore: { min: 85, max: 100 },
  },
  {
    name: '🚨 P1 - AVC avec confusion',
    callId: 'p1-stroke-2',
    transcript: "Mon mari dit n'importe quoi, son visage est bizarre, un côté bouge plus. C'est arrivé d'un coup il y a 15 minutes.",
    expectedRecommendation: 'INCREASE_PRIORITY',
    expectedScore: { min: 85, max: 100 },
  },
  {
    name: '🚨 P1 - AVC avec paralysie',
    callId: 'p1-stroke-3',
    transcript: "Maman est tombée, maintenant tout le côté gauche bouge plus, sa bouche tombe, elle parle pas bien.",
    expectedRecommendation: 'INCREASE_PRIORITY',
    expectedScore: { min: 85, max: 100 },
  },
  {
    name: '🚨 P1 - Détresse respiratoire sévère',
    callId: 'p1-respiratory-1',
    transcript: "J'arrive plus à respirer ! J'étouffe ! Mes lèvres deviennent bleues ! Aidez-moi vite !",
    expectedRecommendation: 'INCREASE_PRIORITY',
    expectedScore: { min: 85, max: 100 },
  },
  {
    name: '🚨 P1 - Asphyxie',
    callId: 'p1-choking',
    transcript: "Mon bébé s'est étouffé avec quelque chose ! Il respire plus ! Il devient bleu ! Au secours !",
    expectedRecommendation: 'INCREASE_PRIORITY',
    expectedScore: { min: 85, max: 100 },
  },
  {
    name: '🚨 P1 - Traumatisme crânien grave',
    callId: 'p1-head-trauma-1',
    transcript: "Mon fils est tombé de l'échelle, il saigne de la tête, il répond plus ! Il a les yeux ouverts mais il me voit pas !",
    expectedRecommendation: 'INCREASE_PRIORITY',
    expectedScore: { min: 85, max: 100 },
  },
  {
    name: '🚨 P1 - Accident de voiture grave',
    callId: 'p1-car-accident',
    transcript: "Il y a eu un accident ! La personne est coincée dans la voiture, elle saigne beaucoup, elle respire avec difficulté !",
    expectedRecommendation: 'INCREASE_PRIORITY',
    expectedScore: { min: 85, max: 100 },
  },
  {
    name: '🚨 P1 - Brûlure grave',
    callId: 'p1-burns',
    transcript: "Mon mari a renversé de l'huile bouillante sur lui ! C'est tout rouge et blanc ! Il crie de douleur !",
    expectedRecommendation: 'INCREASE_PRIORITY',
    expectedScore: { min: 85, max: 100 },
  },
  {
    name: '🚨 P1 - Convulsions',
    callId: 'p1-seizure',
    transcript: "Mon enfant fait une crise ! Il tremble de partout, il bave, ses yeux roulent ! Ça s'arrête pas !",
    expectedRecommendation: 'INCREASE_PRIORITY',
    expectedScore: { min: 85, max: 100 },
  },
  {
    name: '🚨 P1 - Réaction allergique sévère',
    callId: 'p1-anaphylaxis',
    transcript: "Mon fils a mangé des cacahuètes, maintenant son visage gonfle, sa gorge gonfle, il respire de plus en plus mal !",
    expectedRecommendation: 'INCREASE_PRIORITY',
    expectedScore: { min: 85, max: 100 },
  },
  {
    name: '🚨 P1 - Overdose médicamenteuse',
    callId: 'p1-overdose',
    transcript: "J'ai trouvé ma fille par terre avec des boîtes de médicaments vides ! Elle répond pas ! Je vois pas si elle respire !",
    expectedRecommendation: 'INCREASE_PRIORITY',
    expectedScore: { min: 85, max: 100 },
  },
  {
    name: '🚨 P1 - Noyade',
    callId: 'p1-drowning',
    transcript: "On vient de sortir un enfant de la piscine ! Il respire pas ! Il est tout bleu ! Qu'est-ce qu'on fait ?!",
    expectedRecommendation: 'INCREASE_PRIORITY',
    expectedScore: { min: 85, max: 100 },
  },
  {
    name: '🚨 P1 - Accouchement imminent',
    callId: 'p1-birth',
    transcript: "Ma femme est en train d'accoucher ! Le bébé arrive ! Je vois la tête ! Qu'est-ce que je fais ?!",
    expectedRecommendation: 'INCREASE_PRIORITY',
    expectedScore: { min: 85, max: 100 },
  },
  {
    name: '🚨 P1 - Électrocution',
    callId: 'p1-electrocution',
    transcript: "Mon collègue a touché un fil électrique ! Il est tombé ! Il bouge plus ! Il respire bizarrement !",
    expectedRecommendation: 'INCREASE_PRIORITY',
    expectedScore: { min: 85, max: 100 },
  },
  {
    name: '🚨 P1 - Chute d\'une grande hauteur',
    callId: 'p1-fall',
    transcript: "Un ouvrier est tombé du toit ! Il est tombé de 6 mètres ! Il bouge plus, il saigne !",
    expectedRecommendation: 'INCREASE_PRIORITY',
    expectedScore: { min: 85, max: 100 },
  },
  {
    name: '🚨 P1 - Pendaison/Tentative de suicide',
    callId: 'p1-hanging',
    transcript: "J'ai trouvé mon frère pendu dans sa chambre ! Je l'ai décroché mais il respire très mal ! Vite !",
    expectedRecommendation: 'INCREASE_PRIORITY',
    expectedScore: { min: 85, max: 100 },
  },
  {
    name: '🚨 P1 - Amputation traumatique',
    callId: 'p1-amputation',
    transcript: "Il s'est coupé la main avec la machine ! La main est coupée ! Il y a du sang partout !",
    expectedRecommendation: 'INCREASE_PRIORITY',
    expectedScore: { min: 85, max: 100 },
  },
  {
    name: '🚨 P1 - Bébé qui ne respire pas',
    callId: 'p1-baby-not-breathing',
    transcript: "Mon bébé de 3 mois respire plus ! Il est tout mou ! Il est bleu ! Au secours !",
    expectedRecommendation: 'INCREASE_PRIORITY',
    expectedScore: { min: 85, max: 100 },
  },
  {
    name: '🚨 P1 - Intoxication au CO',
    callId: 'p1-co-poisoning',
    transcript: "Toute la famille est malade ! On a des maux de tête terribles, des vomissements ! Le détecteur de CO sonne !",
    expectedRecommendation: 'INCREASE_PRIORITY',
    expectedScore: { min: 85, max: 100 },
  },
  {
    name: '🚨 P1 - Décompensation cardiaque aiguë',
    callId: 'p1-heart-failure',
    transcript: "Mon père arrive plus à respirer du tout ! Il est assis, il crache du liquide rose ! Il va mourir !",
    expectedRecommendation: 'INCREASE_PRIORITY',
    expectedScore: { min: 85, max: 100 },
  },

  // ========== URGENCES IMPORTANTES P2 (score 70-84) - 25 cas ==========
  {
    name: '⚠️ P2 - Douleur thoracique classique',
    callId: 'p2-chest-pain-1',
    transcript: "J'ai une douleur très forte dans la poitrine depuis 10 minutes. Ça serre, ça irradie dans le bras gauche.",
    expectedRecommendation: 'INCREASE_PRIORITY',
    expectedScore: { min: 70, max: 90 },
  },
  {
    name: '⚠️ P2 - Douleur thoracique avec sueurs',
    callId: 'p2-chest-pain-2',
    transcript: "J'ai mal dans la poitrine, je transpire beaucoup, j'ai des nausées. J'ai peur que ce soit le cœur.",
    expectedRecommendation: 'INCREASE_PRIORITY',
    expectedScore: { min: 70, max: 90 },
  },
  {
    name: '⚠️ P2 - Crise d\'asthme sévère',
    callId: 'p2-asthma',
    transcript: "J'ai fait une crise d'asthme, mon inhalateur marche pas. J'ai du mal à respirer. Aidez-moi.",
    expectedRecommendation: 'INCREASE_PRIORITY',
    expectedScore: { min: 70, max: 90 },
  },
  {
    name: '⚠️ P2 - Diabète décompensé',
    callId: 'p2-diabetes',
    transcript: "Je suis diabétique, j'ai fait un malaise, je tremble, je vois flou, je transpire énormément.",
    expectedRecommendation: 'INCREASE_PRIORITY',
    expectedScore: { min: 70, max: 90 },
  },
  {
    name: '⚠️ P2 - Fracture ouverte',
    callId: 'p2-open-fracture',
    transcript: "Je suis tombé à vélo, ma jambe est cassée, l'os sort de la peau. Ça saigne et ça fait très mal.",
    expectedRecommendation: 'INCREASE_PRIORITY',
    expectedScore: { min: 70, max: 90 },
  },
  {
    name: '⚠️ P2 - Traumatisme crânien modéré',
    callId: 'p2-head-trauma-2',
    transcript: "Mon fils est tombé, il a vomi deux fois, il a très mal à la tête, il voit double.",
    expectedRecommendation: 'INCREASE_PRIORITY',
    expectedScore: { min: 70, max: 90 },
  },
  {
    name: '⚠️ P2 - Douleur abdominale aiguë',
    callId: 'p2-appendicitis',
    transcript: "J'ai une douleur atroce en bas à droite du ventre. Ça a commencé ce matin, ça empire. Je peux plus bouger.",
    expectedRecommendation: 'INCREASE_PRIORITY',
    expectedScore: { min: 70, max: 90 },
  },
  {
    name: '⚠️ P2 - Colique néphrétique',
    callId: 'p2-kidney-stone',
    transcript: "J'ai une douleur insupportable dans le dos qui descend dans l'aine. Je vomis, ça fait très très mal.",
    expectedRecommendation: 'INCREASE_PRIORITY',
    expectedScore: { min: 70, max: 90 },
  },
  {
    name: '⚠️ P2 - Grossesse avec saignements',
    callId: 'p2-pregnancy-bleeding',
    transcript: "Je suis enceinte de 7 mois, j'ai des saignements importants et des contractions douloureuses.",
    expectedRecommendation: 'INCREASE_PRIORITY',
    expectedScore: { min: 70, max: 90 },
  },
  {
    name: '⚠️ P2 - Intoxication alimentaire sévère',
    callId: 'p2-food-poisoning',
    transcript: "Je vomis sans arrêt depuis 6 heures, j'ai de la diarrhée, je me sens très faible, j'arrive plus à boire.",
    expectedRecommendation: 'INCREASE_PRIORITY',
    expectedScore: { min: 70, max: 90 },
  },
  {
    name: '⚠️ P2 - Fièvre élevée avec raideur nuque',
    callId: 'p2-meningitis',
    transcript: "Mon fils a 40 de fièvre, il a le cou tout raide, la lumière lui fait mal aux yeux, il vomit.",
    expectedRecommendation: 'INCREASE_PRIORITY',
    expectedScore: { min: 70, max: 90 },
  },
  {
    name: '⚠️ P2 - Plaie profonde',
    callId: 'p2-deep-wound',
    transcript: "Je me suis coupé profondément avec un couteau, c'est une grosse entaille, ça saigne beaucoup mais j'arrive à comprimer.",
    expectedRecommendation: 'INCREASE_PRIORITY',
    expectedScore: { min: 70, max: 90 },
  },
  {
    name: '⚠️ P2 - Crise de panique sévère',
    callId: 'p2-panic-attack',
    transcript: "Je peux plus respirer ! Mon cœur bat très vite ! J'ai l'impression que je vais mourir ! Aidez-moi !",
    expectedRecommendation: 'INCREASE_PRIORITY',
    expectedScore: { min: 70, max: 90 },
  },
  {
    name: '⚠️ P2 - Morsure de chien',
    callId: 'p2-dog-bite',
    transcript: "Un chien m'a mordu à la jambe, c'est une grosse plaie profonde, ça saigne pas mal.",
    expectedRecommendation: 'INCREASE_PRIORITY',
    expectedScore: { min: 70, max: 90 },
  },
  {
    name: '⚠️ P2 - Troubles neurologiques',
    callId: 'p2-neuro',
    transcript: "J'ai des fourmillements dans tout le bras gauche, j'ai très mal à la tête, je vois des éclairs.",
    expectedRecommendation: 'INCREASE_PRIORITY',
    expectedScore: { min: 70, max: 90 },
  },
  {
    name: '⚠️ P2 - Rétention urinaire',
    callId: 'p2-urinary-retention',
    transcript: "Je peux plus uriner depuis 12 heures, j'ai le ventre gonflé et très douloureux.",
    expectedRecommendation: 'INCREASE_PRIORITY',
    expectedScore: { min: 70, max: 90 },
  },
  {
    name: '⚠️ P2 - Luxation épaule',
    callId: 'p2-shoulder-dislocation',
    transcript: "Mon épaule est sortie, je l'ai déboîtée en faisant du sport. Ça fait très mal, je peux plus bouger le bras.",
    expectedRecommendation: 'INCREASE_PRIORITY',
    expectedScore: { min: 70, max: 90 },
  },
  {
    name: '⚠️ P2 - Crise d\'épilepsie prolongée',
    callId: 'p2-epilepsy',
    transcript: "Ma fille épileptique fait une crise qui dure depuis 5 minutes, elle s'arrête pas.",
    expectedRecommendation: 'INCREASE_PRIORITY',
    expectedScore: { min: 70, max: 90 },
  },
  {
    name: '⚠️ P2 - Confusion mentale aiguë',
    callId: 'p2-confusion',
    transcript: "Mon père de 80 ans dit n'importe quoi depuis ce matin, il me reconnaît plus, il est agité.",
    expectedRecommendation: 'INCREASE_PRIORITY',
    expectedScore: { min: 70, max: 90 },
  },
  {
    name: '⚠️ P2 - Saignement digestif',
    callId: 'p2-gi-bleeding',
    transcript: "Je vomis du sang rouge, j'en ai vomi plusieurs fois. Je me sens faible et étourdi.",
    expectedRecommendation: 'INCREASE_PRIORITY',
    expectedScore: { min: 70, max: 90 },
  },
  {
    name: '⚠️ P2 - Pneumothorax',
    callId: 'p2-pneumothorax',
    transcript: "J'ai eu un coup dans les côtes, maintenant j'ai très mal pour respirer, ça fait un bruit bizarre.",
    expectedRecommendation: 'INCREASE_PRIORITY',
    expectedScore: { min: 70, max: 90 },
  },
  {
    name: '⚠️ P2 - Occlusion intestinale',
    callId: 'p2-bowel-obstruction',
    transcript: "J'ai mal au ventre depuis 2 jours, je vomis tout ce que je mange, je suis ballonné, je vais plus aux toilettes.",
    expectedRecommendation: 'INCREASE_PRIORITY',
    expectedScore: { min: 70, max: 90 },
  },
  {
    name: '⚠️ P2 - Phlébite',
    callId: 'p2-dvt',
    transcript: "J'ai le mollet gonflé, rouge, chaud et très douloureux. C'est arrivé en quelques heures.",
    expectedRecommendation: 'INCREASE_PRIORITY',
    expectedScore: { min: 70, max: 90 },
  },
  {
    name: '⚠️ P2 - Crise de goutte',
    callId: 'p2-gout',
    transcript: "Mon gros orteil est gonflé, tout rouge, j'ai une douleur atroce, je peux même pas poser le pied par terre.",
    expectedRecommendation: 'INCREASE_PRIORITY',
    expectedScore: { min: 70, max: 90 },
  },
  {
    name: '⚠️ P2 - Palpitations sévères',
    callId: 'p2-palpitations',
    transcript: "Mon cœur bat très vite depuis une heure, je sens qu'il bat n'importe comment, j'ai des vertiges.",
    expectedRecommendation: 'INCREASE_PRIORITY',
    expectedScore: { min: 70, max: 90 },
  },

  // ========== CAS MODÉRÉS P3 (score 40-69) - 25 cas ==========
  {
    name: '🟡 P3 - Douleur abdominale modérée',
    callId: 'p3-abdominal-pain',
    transcript: "Bonjour, j'ai mal au ventre depuis ce matin. C'est vraiment douloureux. Je sais pas si je dois venir.",
    expectedRecommendation: 'MAINTAIN',
    expectedScore: { min: 40, max: 69 },
  },
  {
    name: '🟡 P3 - Fièvre élevée enfant',
    callId: 'p3-fever-child',
    transcript: "Mon enfant a 39.5 de fièvre depuis hier soir. Il est un peu faible mais il boit.",
    expectedRecommendation: 'MAINTAIN',
    expectedScore: { min: 40, max: 69 },
  },
  {
    name: '🟡 P3 - Entorse cheville',
    callId: 'p3-ankle-sprain',
    transcript: "Je me suis tordu la cheville en faisant du sport. C'est gonflé et ça fait mal quand je marche.",
    expectedRecommendation: 'MAINTAIN',
    expectedScore: { min: 40, max: 69 },
  },
  {
    name: '🟡 P3 - Gastro-entérite',
    callId: 'p3-gastro',
    transcript: "J'ai la gastro, je vomis et j'ai la diarrhée depuis ce matin. Je suis fatigué.",
    expectedRecommendation: 'MAINTAIN',
    expectedScore: { min: 40, max: 69 },
  },
  {
    name: '🟡 P3 - Coupure superficielle',
    callId: 'p3-cut',
    transcript: "Je me suis coupé en cuisine, c'est une coupure nette, ça saigne un peu, je me demande si il faut des points.",
    expectedRecommendation: 'MAINTAIN',
    expectedScore: { min: 40, max: 69 },
  },
  {
    name: '🟡 P3 - Infection urinaire',
    callId: 'p3-uti',
    transcript: "J'ai des brûlures quand j'urine, j'ai envie d'uriner tout le temps, j'ai un peu mal au dos.",
    expectedRecommendation: 'MAINTAIN',
    expectedScore: { min: 40, max: 69 },
  },
  {
    name: '🟡 P3 - Crise d\'asthme légère',
    callId: 'p3-mild-asthma',
    transcript: "J'ai un peu de mal à respirer, je pense que c'est l'asthme, mon inhalateur aide un peu.",
    expectedRecommendation: 'MAINTAIN',
    expectedScore: { min: 40, max: 69 },
  },
  {
    name: '🟡 P3 - Douleur dentaire',
    callId: 'p3-tooth-pain',
    transcript: "J'ai très mal aux dents depuis hier, c'est lancinant, j'ai essayé des anti-douleurs mais ça passe pas.",
    expectedRecommendation: 'MAINTAIN',
    expectedScore: { min: 40, max: 69 },
  },
  {
    name: '🟡 P3 - Lombalgie aiguë',
    callId: 'p3-back-pain',
    transcript: "Je me suis bloqué le dos ce matin, j'ai très mal, je peux presque plus bouger.",
    expectedRecommendation: 'MAINTAIN',
    expectedScore: { min: 40, max: 69 },
  },
  {
    name: '🟡 P3 - Migraine sévère',
    callId: 'p3-migraine',
    transcript: "J'ai une migraine terrible, j'ai vomi, la lumière me fait mal, mes médicaments marchent pas.",
    expectedRecommendation: 'MAINTAIN',
    expectedScore: { min: 40, max: 69 },
  },
  {
    name: '🟡 P3 - Angine',
    callId: 'p3-sore-throat',
    transcript: "J'ai très mal à la gorge, j'ai du mal à avaler, j'ai un peu de fièvre.",
    expectedRecommendation: 'MAINTAIN',
    expectedScore: { min: 40, max: 69 },
  },
  {
    name: '🟡 P3 - Otite',
    callId: 'p3-ear-infection',
    transcript: "Mon enfant a très mal à l'oreille, il pleure beaucoup, il a de la fièvre.",
    expectedRecommendation: 'MAINTAIN',
    expectedScore: { min: 40, max: 69 },
  },
  {
    name: '🟡 P3 - Piqûre d\'insecte gonflée',
    callId: 'p3-insect-bite',
    transcript: "J'ai été piqué par quelque chose, c'est tout gonflé et rouge, ça fait mal.",
    expectedRecommendation: 'MAINTAIN',
    expectedScore: { min: 40, max: 69 },
  },
  {
    name: '🟡 P3 - Bronchite',
    callId: 'p3-bronchitis',
    transcript: "Je tousse beaucoup depuis 3 jours, j'ai de la fièvre, je crache vert.",
    expectedRecommendation: 'MAINTAIN',
    expectedScore: { min: 40, max: 69 },
  },
  {
    name: '🟡 P3 - Eczéma infecté',
    callId: 'p3-eczema',
    transcript: "Mon eczéma s'est infecté, c'est tout rouge, ça suinte, ça fait mal.",
    expectedRecommendation: 'MAINTAIN',
    expectedScore: { min: 40, max: 69 },
  },
  {
    name: '🟡 P3 - Conjonctivite',
    callId: 'p3-conjunctivitis',
    transcript: "J'ai l'œil tout rouge et qui colle, ça me démange, ça pleure.",
    expectedRecommendation: 'MAINTAIN',
    expectedScore: { min: 40, max: 69 },
  },
  {
    name: '🟡 P3 - Vertige',
    callId: 'p3-vertigo',
    transcript: "J'ai des vertiges depuis ce matin, tout tourne, j'ai un peu mal au cœur.",
    expectedRecommendation: 'MAINTAIN',
    expectedScore: { min: 40, max: 69 },
  },
  {
    name: '🟡 P3 - Urticaire',
    callId: 'p3-hives',
    transcript: "J'ai des plaques rouges partout qui me démangent énormément, je sais pas ce que c'est.",
    expectedRecommendation: 'MAINTAIN',
    expectedScore: { min: 40, max: 69 },
  },
  {
    name: '🟡 P3 - Hématome important',
    callId: 'p3-hematoma',
    transcript: "Je suis tombé, j'ai un gros bleu qui enfle sur la cuisse, c'est douloureux.",
    expectedRecommendation: 'MAINTAIN',
    expectedScore: { min: 40, max: 69 },
  },
  {
    name: '🟡 P3 - Hémorroïdes',
    callId: 'p3-hemorrhoids',
    transcript: "J'ai très mal quand je vais à la selle, j'ai vu du sang, je pense que ce sont des hémorroïdes.",
    expectedRecommendation: 'MAINTAIN',
    expectedScore: { min: 40, max: 69 },
  },
  {
    name: '🟡 P3 - Torticolis',
    callId: 'p3-stiff-neck',
    transcript: "J'ai le cou bloqué depuis ce matin, je peux plus tourner la tête, c'est très douloureux.",
    expectedRecommendation: 'MAINTAIN',
    expectedScore: { min: 40, max: 69 },
  },
  {
    name: '🟡 P3 - Entorse doigt',
    callId: 'p3-finger-sprain',
    transcript: "Je me suis coincé le doigt dans une porte, c'est gonflé, bleu, je peux plus le plier.",
    expectedRecommendation: 'MAINTAIN',
    expectedScore: { min: 40, max: 69 },
  },
  {
    name: '🟡 P3 - Sinusite',
    callId: 'p3-sinusitis',
    transcript: "J'ai mal au front et aux joues, j'ai le nez bouché, de la fièvre modérée.",
    expectedRecommendation: 'MAINTAIN',
    expectedScore: { min: 40, max: 69 },
  },
  {
    name: '🟡 P3 - Douleur musculaire',
    callId: 'p3-muscle-pain',
    transcript: "Je me suis fait un claquage au mollet en courant, ça fait mal mais je peux marcher.",
    expectedRecommendation: 'MAINTAIN',
    expectedScore: { min: 40, max: 69 },
  },
  {
    name: '🟡 P3 - Règles douloureuses',
    callId: 'p3-period-pain',
    transcript: "J'ai des règles très douloureuses, j'ai mal au ventre, mes anti-douleurs habituels marchent pas.",
    expectedRecommendation: 'MAINTAIN',
    expectedScore: { min: 40, max: 69 },
  },

  // ========== CAS NON URGENTS P4/P5 (score 0-39) - 25 cas ==========
  {
    name: '🟢 P5 - Demande pharmacie de garde',
    callId: 'p5-pharmacy-info',
    transcript: "Oui bonjour, je voudrais savoir quelle est la pharmacie de garde s'il vous plaît.",
    expectedRecommendation: 'DECREASE_PRIORITY',
    expectedScore: { min: 0, max: 39 },
  },
  {
    name: '🟢 P5 - Demande médecin de garde',
    callId: 'p5-doctor-info',
    transcript: "Bonjour, j'aurais besoin des coordonnées du médecin de garde pour ce week-end.",
    expectedRecommendation: 'DECREASE_PRIORITY',
    expectedScore: { min: 0, max: 39 },
  },
  {
    name: '🟢 P4 - Mal de tête léger',
    callId: 'p4-mild-headache',
    transcript: "Bonjour, j'ai un peu mal à la tête depuis ce matin. C'est supportable mais ça persiste.",
    expectedRecommendation: 'DECREASE_PRIORITY',
    expectedScore: { min: 0, max: 39 },
  },
  {
    name: '🟢 P4 - Petite toux',
    callId: 'p4-mild-cough',
    transcript: "J'ai une petite toux qui dure depuis quelques jours. Pas de fièvre, je me sens bien sinon.",
    expectedRecommendation: 'DECREASE_PRIORITY',
    expectedScore: { min: 0, max: 39 },
  },
  {
    name: '🟢 P4 - Rhume',
    callId: 'p4-cold',
    transcript: "J'ai le nez qui coule, j'éternue, j'ai un peu mal à la gorge. C'est un rhume classique.",
    expectedRecommendation: 'DECREASE_PRIORITY',
    expectedScore: { min: 0, max: 39 },
  },
  {
    name: '🟢 P5 - Question sur médicament',
    callId: 'p5-medication-question',
    transcript: "Je voudrais savoir si je peux prendre du paracétamol avec mon traitement habituel.",
    expectedRecommendation: 'DECREASE_PRIORITY',
    expectedScore: { min: 0, max: 39 },
  },
  {
    name: '🟢 P4 - Petite égratignure',
    callId: 'p4-scratch',
    transcript: "Je me suis égratigné avec une ronce, c'est superficiel, je voulais savoir si il faut désinfecter.",
    expectedRecommendation: 'DECREASE_PRIORITY',
    expectedScore: { min: 0, max: 39 },
  },
  {
    name: '🟢 P4 - Fatigue générale',
    callId: 'p4-fatigue',
    transcript: "Je suis très fatigué depuis quelques jours, je voudrais un conseil.",
    expectedRecommendation: 'DECREASE_PRIORITY',
    expectedScore: { min: 0, max: 39 },
  },
  {
    name: '🟢 P5 - Prise de RDV',
    callId: 'p5-appointment',
    transcript: "Bonjour, je voudrais prendre rendez-vous avec un médecin généraliste.",
    expectedRecommendation: 'DECREASE_PRIORITY',
    expectedScore: { min: 0, max: 39 },
  },
  {
    name: '🟢 P4 - Insomnie',
    callId: 'p4-insomnia',
    transcript: "Je dors mal depuis quelques nuits, je me demande si je devrais consulter.",
    expectedRecommendation: 'DECREASE_PRIORITY',
    expectedScore: { min: 0, max: 39 },
  },
  {
    name: '🟢 P4 - Problème de peau mineur',
    callId: 'p4-skin-minor',
    transcript: "J'ai un petit bouton qui est apparu, c'est rouge mais pas très gênant.",
    expectedRecommendation: 'DECREASE_PRIORITY',
    expectedScore: { min: 0, max: 39 },
  },
  {
    name: '🟢 P5 - Demande d\'ordonnance',
    callId: 'p5-prescription',
    transcript: "J'ai besoin d'un renouvellement d'ordonnance pour mon traitement habituel.",
    expectedRecommendation: 'DECREASE_PRIORITY',
    expectedScore: { min: 0, max: 39 },
  },
  {
    name: '🟢 P4 - Douleur musculaire légère',
    callId: 'p4-muscle-ache',
    transcript: "J'ai un peu mal aux muscles depuis que j'ai fait du sport, c'est des courbatures je pense.",
    expectedRecommendation: 'DECREASE_PRIORITY',
    expectedScore: { min: 0, max: 39 },
  },
  {
    name: '🟢 P4 - Acné',
    callId: 'p4-acne',
    transcript: "Mon acné empire, je voudrais un traitement plus efficace.",
    expectedRecommendation: 'DECREASE_PRIORITY',
    expectedScore: { min: 0, max: 39 },
  },
  {
    name: '🟢 P5 - Conseil vaccin',
    callId: 'p5-vaccine',
    transcript: "Je pars en voyage, je voudrais savoir quels vaccins il me faut.",
    expectedRecommendation: 'DECREASE_PRIORITY',
    expectedScore: { min: 0, max: 39 },
  },
  {
    name: '🟢 P4 - Constipation',
    callId: 'p4-constipation',
    transcript: "Je suis constipé depuis quelques jours, c'est gênant mais pas douloureux.",
    expectedRecommendation: 'DECREASE_PRIORITY',
    expectedScore: { min: 0, max: 39 },
  },
  {
    name: '🟢 P4 - Perte de poids souhaitée',
    callId: 'p4-weight-loss',
    transcript: "Je voudrais perdre du poids, je cherche des conseils nutritionnels.",
    expectedRecommendation: 'DECREASE_PRIORITY',
    expectedScore: { min: 0, max: 39 },
  },
  {
    name: '🟢 P5 - Question administrative',
    callId: 'p5-admin',
    transcript: "J'ai besoin d'un certificat médical pour le sport, comment faire ?",
    expectedRecommendation: 'DECREASE_PRIORITY',
    expectedScore: { min: 0, max: 39 },
  },
  {
    name: '🟢 P4 - Allergie saisonnière',
    callId: 'p4-hay-fever',
    transcript: "J'ai le rhume des foins, les yeux qui piquent et qui pleurent, le nez qui coule.",
    expectedRecommendation: 'DECREASE_PRIORITY',
    expectedScore: { min: 0, max: 39 },
  },
  {
    name: '🟢 P4 - Verrues',
    callId: 'p4-warts',
    transcript: "J'ai des verrues plantaires, je voudrais les faire enlever.",
    expectedRecommendation: 'DECREASE_PRIORITY',
    expectedScore: { min: 0, max: 39 },
  },
  {
    name: '🟢 P4 - Douleur légère chronique',
    callId: 'p4-chronic-pain',
    transcript: "J'ai mal au genou depuis longtemps, c'est supportable mais je voudrais un avis.",
    expectedRecommendation: 'DECREASE_PRIORITY',
    expectedScore: { min: 0, max: 39 },
  },
  {
    name: '🟢 P5 - Demande de conseil général',
    callId: 'p5-general-advice',
    transcript: "Je voudrais des conseils pour mieux dormir et gérer le stress.",
    expectedRecommendation: 'DECREASE_PRIORITY',
    expectedScore: { min: 0, max: 39 },
  },
  {
    name: '🟢 P4 - Petite brûlure',
    callId: 'p4-minor-burn',
    transcript: "Je me suis brûlé légèrement en cuisinant, c'est rouge mais pas de cloque.",
    expectedRecommendation: 'DECREASE_PRIORITY',
    expectedScore: { min: 0, max: 39 },
  },
  {
    name: '🟢 P4 - Hoquet persistant',
    callId: 'p4-hiccups',
    transcript: "J'ai le hoquet depuis plusieurs heures, c'est gênant, comment l'arrêter ?",
    expectedRecommendation: 'DECREASE_PRIORITY',
    expectedScore: { min: 0, max: 39 },
  },
  {
    name: '🟢 P5 - Fausse alerte',
    callId: 'p5-false-alarm',
    transcript: "Pardon, j'ai appelé par erreur, tout va bien, désolé.",
    expectedRecommendation: 'DECREASE_PRIORITY',
    expectedScore: { min: 0, max: 39 },
  },
];

async function runTest(testCase, index, total) {
  try {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`${colors.cyan}TEST ${index}/${total}: ${testCase.name}${colors.reset}`);
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

    const result = response.data.data;

    // Afficher les résultats de manière concise
    const scoreMatch = result.finalScore >= testCase.expectedScore.min && result.finalScore <= testCase.expectedScore.max;
    const recommendationMatch = result.recommendation === testCase.expectedRecommendation;
    const passed = scoreMatch && recommendationMatch;

    const status = passed ? `${colors.green}✅ PASS${colors.reset}` : `${colors.red}❌ FAIL${colors.reset}`;
    console.log(`${status} | Score: ${result.finalScore}/100 | Rec: ${result.recommendation} | Conf: ${(result.confidence * 100).toFixed(0)}%`);

    if (!passed) {
      console.log(`${colors.yellow}  Expected: ${testCase.expectedScore.min}-${testCase.expectedScore.max}, ${testCase.expectedRecommendation}${colors.reset}`);
    }

    return { testCase, result, passed };
  } catch (error) {
    console.error(`\n${colors.red}❌ ERREUR:${colors.reset}`, error.message);
    return { testCase, error: error.message, passed: false };
  }
}

async function runAllTests() {
  console.log(`${colors.cyan}${'='.repeat(80)}`);
  console.log(`🧪 BATTERIE COMPLÈTE - 100 TESTS GEMINI`);
  console.log(`${'='.repeat(80)}${colors.reset}\n`);

  const results = [];
  const startTime = Date.now();

  for (let i = 0; i < testCases.length; i++) {
    const result = await runTest(testCases[i], i + 1, testCases.length);
    results.push(result);

    // Pause courte entre tests
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(1);

  // Résumé final
  console.log(`\n\n${colors.cyan}${'='.repeat(80)}`);
  console.log(`📊 RÉSUMÉ FINAL - 100 TESTS`);
  console.log(`${'='.repeat(80)}${colors.reset}\n`);

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  const percentage = ((passed / total) * 100).toFixed(1);

  console.log(`Temps d'exécution: ${duration}s`);
  console.log(`Tests réussis: ${colors.green}${passed}/${total}${colors.reset} (${percentage}%)`);

  // Stats par catégorie
  const categories = {
    'P0/P1 (Urgences vitales)': results.slice(0, 25),
    'P2 (Urgences importantes)': results.slice(25, 50),
    'P3 (Cas modérés)': results.slice(50, 75),
    'P4/P5 (Non urgents)': results.slice(75, 100),
  };

  console.log(`\n${colors.magenta}📈 STATS PAR CATÉGORIE:${colors.reset}`);
  for (const [category, categoryResults] of Object.entries(categories)) {
    const categoryPassed = categoryResults.filter((r) => r.passed).length;
    const categoryTotal = categoryResults.length;
    const categoryPercentage = ((categoryPassed / categoryTotal) * 100).toFixed(1);
    const color = categoryPercentage >= 90 ? colors.green : categoryPercentage >= 70 ? colors.yellow : colors.red;
    console.log(`  ${category}: ${color}${categoryPassed}/${categoryTotal}${colors.reset} (${categoryPercentage}%)`);
  }

  const failed = results.filter((r) => !r.passed);
  if (failed.length > 0) {
    console.log(`\n${colors.red}❌ Tests échoués (${failed.length}):${colors.reset}`);
    failed.forEach((r, idx) => {
      if (idx < 20) { // Afficher max 20 échecs pour pas surcharger
        console.log(`  ${idx + 1}. ${r.testCase.name}`);
      }
    });
    if (failed.length > 20) {
      console.log(`  ... et ${failed.length - 20} autres`);
    }
  }

  console.log(`\n${colors.cyan}${'='.repeat(80)}${colors.reset}\n`);

  // Exit code
  process.exit(failed.length > 0 ? 1 : 0);
}

// Lancer tous les tests
runAllTests().catch((error) => {
  console.error(`${colors.red}Erreur fatale:${colors.reset}`, error);
  process.exit(1);
});
