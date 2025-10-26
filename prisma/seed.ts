import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('🌱 Starting database seeding...');

  // Seed Default Admin User
  console.log('👤 Seeding default admin user...');

  const adminExists = await prisma.user.findUnique({
    where: { employeeId: 'ADMIN001' },
  });

  if (!adminExists) {
    const hashedPassword = await bcrypt.hash('Admin123!', 12);

    await prisma.user.create({
      data: {
        employeeId: 'ADMIN001',
        fullName: 'System Administrator',
        password: hashedPassword,
        role: 'ADMIN',
        isActive: true,
      },
    });

    console.log('✅ Default admin user created (ADMIN001 / Admin123!)');
  } else {
    console.log('ℹ️  Default admin user already exists');
  }

  // Seed Default Operator User
  console.log('👤 Seeding default operator user...');

  const operatorExists = await prisma.user.findUnique({
    where: { employeeId: 'OP001' },
  });

  if (!operatorExists) {
    const hashedPassword = await bcrypt.hash('SecureOp123!', 12);

    const operator = await prisma.operator.create({
      data: {
        email: 'operator1@samu.fr',
        name: 'Test Operator',
        status: 'AVAILABLE',
      },
    });

    await prisma.user.create({
      data: {
        employeeId: 'OP001',
        fullName: 'Test Operator',
        password: hashedPassword,
        role: 'OPERATOR',
        isActive: true,
        operatorId: operator.id,
      },
    });

    console.log('✅ Default operator user created (OP001 / SecureOp123!)');
  } else {
    console.log('ℹ️  Default operator user already exists');
  }

  // Seed Medical Knowledge Base
  console.log('📚 Seeding medical knowledge...');

  const emergencySigns = [
    {
      title: 'Arrêt Cardiaque - Signes',
      content:
        "Absence de pouls, inconscience, absence de respiration. Intervention immédiate requise. Appel SMUR + RCP.",
      category: 'emergency_sign',
      subcategory: 'cardiac',
      verified: true,
      verifiedBy: 'Dr. Medical Expert',
      verifiedAt: new Date(),
    },
    {
      title: 'Syndrome Coronarien Aigu (SCA)',
      content:
        "Douleur thoracique constrictive > 20min, irradiation bras gauche/mâchoire, sueurs froides, dyspnée, nausées. Risque d'infarctus. Urgence vitale.",
      category: 'emergency_sign',
      subcategory: 'cardiac',
      verified: true,
      verifiedBy: 'Dr. Medical Expert',
      verifiedAt: new Date(),
    },
    {
      title: 'Détresse Respiratoire Aiguë',
      content:
        'Dyspnée sévère, tirage intercostal, cyanose, SpO2 < 90%, impossibilité de parler. Urgence vitale.',
      category: 'emergency_sign',
      subcategory: 'respiratory',
      verified: true,
      verifiedBy: 'Dr. Medical Expert',
      verifiedAt: new Date(),
    },
    {
      title: 'AVC - Signes FAST',
      content:
        "F=Face (asymétrie faciale), A=Arms (faiblesse bras), S=Speech (trouble parole), T=Time (appel immédiat). Fenêtre thérapeutique 4h30.",
      category: 'emergency_sign',
      subcategory: 'neurological',
      verified: true,
      verifiedBy: 'Dr. Medical Expert',
      verifiedAt: new Date(),
    },
    {
      title: 'Hémorragie Sévère',
      content:
        'Saignement artériel (pulsatile, rouge vif), > 500ml, choc hémorragique. Compression + SMUR.',
      category: 'emergency_sign',
      subcategory: 'trauma',
      verified: true,
      verifiedBy: 'Dr. Medical Expert',
      verifiedAt: new Date(),
    },
  ];

  const protocols = [
    {
      title: 'Protocole ABCD - Triage Initial',
      content: `
A - Airway (Voies Aériennes): Vérifier perméabilité, corps étranger, obstruction
B - Breathing (Respiration): Fréquence respiratoire, amplitude, SpO2, dyspnée
C - Circulation: Pouls, TA, saignement, douleur thoracique, état de choc
D - Disability/Consciousness: Échelle AVPU, score Glasgow, déficit neurologique
      `,
      category: 'protocol',
      subcategory: 'triage',
      verified: true,
      verifiedBy: 'Dr. Medical Expert',
      verifiedAt: new Date(),
    },
    {
      title: 'Échelle de Douleur',
      content: `
0 = Pas de douleur
1-3 = Douleur légère
4-6 = Douleur modérée
7-9 = Douleur sévère
10 = Douleur maximale imaginable
      `,
      category: 'protocol',
      subcategory: 'assessment',
      verified: true,
      verifiedBy: 'Dr. Medical Expert',
      verifiedAt: new Date(),
    },
  ];

  const symptoms = [
    {
      title: 'Douleur Thoracique - Typologie',
      content:
        "Constrictive/serrement: SCA. Piqûre: péricardite. Déchirure: dissection aortique. Pleurétique: pneumothorax/embolie.",
      category: 'symptom',
      subcategory: 'chest_pain',
      verified: true,
      verifiedBy: 'Dr. Medical Expert',
      verifiedAt: new Date(),
    },
    {
      title: 'Dyspnée - Causes Urgentes',
      content:
        "OAP (crépitants, orthopnée), pneumothorax (abolition MV), embolie pulmonaire (douleur pleurétique + tachycardie), asthme aigu grave.",
      category: 'symptom',
      subcategory: 'dyspnea',
      verified: true,
      verifiedBy: 'Dr. Medical Expert',
      verifiedAt: new Date(),
    },
  ];

  // Insert all knowledge
  for (const item of [...emergencySigns, ...protocols, ...symptoms]) {
    await prisma.medicalKnowledge.create({
      data: item,
    });
  }

  console.log(
    `✅ Created ${emergencySigns.length + protocols.length + symptoms.length} medical knowledge entries`
  );

  // Create sample test patient (for development only)
  if (process.env.NODE_ENV === 'development') {
    console.log('👤 Creating test patient...');

    const testPatient = await prisma.patient.create({
      data: {
        phoneHash: 'test_hash_123',
        age: 45,
        gender: 'M',
        address: '12 rue Victor Hugo',
        city: 'Paris',
        postalCode: '75015',
        latitude: 48.8566,
        longitude: 2.3522,
        locationPrecision: 'exact',
        allergies: ['Pénicilline'],
        medications: ['Lisinopril', 'Metformine'],
        chronicConditions: ['HTA', 'Diabète type 2'],
      },
    });

    console.log(`✅ Created test patient: ${testPatient.id}`);
  }

  console.log('🎉 Database seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
