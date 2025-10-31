import { PrismaClient, AmbulanceType } from '@prisma/client';

const prisma = new PrismaClient();

// Paris area hospitals with SAMU centers
const hospitals = [
  {
    name: 'Hôpital Pitié-Salpêtrière (AP-HP)',
    code: 'HP-PARIS-13',
    address: '47-83 Boulevard de l\'Hôpital',
    city: 'Paris',
    postalCode: '75013',
    latitude: 48.8404,
    longitude: 2.3646,
    phone: '+33 1 42 16 00 00',
    hasSMUR: true,
    hasEmergencyRoom: true,
    hasHelicopterPad: true,
    totalAmbulances: 8,
    availableAmbulances: 6,
  },
  {
    name: 'Hôpital Necker-Enfants Malades (AP-HP)',
    code: 'HP-PARIS-15',
    address: '149 Rue de Sèvres',
    city: 'Paris',
    postalCode: '75015',
    latitude: 48.8466,
    longitude: 2.3137,
    phone: '+33 1 44 49 40 00',
    hasSMUR: true,
    hasEmergencyRoom: true,
    hasHelicopterPad: false,
    totalAmbulances: 6,
    availableAmbulances: 4,
  },
  {
    name: 'Hôpital Saint-Antoine (AP-HP)',
    code: 'HP-PARIS-12',
    address: '184 Rue du Faubourg Saint-Antoine',
    city: 'Paris',
    postalCode: '75012',
    latitude: 48.8494,
    longitude: 2.3924,
    phone: '+33 1 49 28 20 00',
    hasSMUR: true,
    hasEmergencyRoom: true,
    hasHelicopterPad: false,
    totalAmbulances: 5,
    availableAmbulances: 3,
  },
  {
    name: 'Hôpital Bichat-Claude Bernard (AP-HP)',
    code: 'HP-PARIS-18',
    address: '46 Rue Henri Huchard',
    city: 'Paris',
    postalCode: '75018',
    latitude: 48.8991,
    longitude: 2.3305,
    phone: '+33 1 40 25 80 80',
    hasSMUR: true,
    hasEmergencyRoom: true,
    hasHelicopterPad: false,
    totalAmbulances: 7,
    availableAmbulances: 5,
  },
  {
    name: 'Hôpital Cochin (AP-HP)',
    code: 'HP-PARIS-14',
    address: '27 Rue du Faubourg Saint-Jacques',
    city: 'Paris',
    postalCode: '75014',
    latitude: 48.8359,
    longitude: 2.3408,
    phone: '+33 1 58 41 41 41',
    hasSMUR: true,
    hasEmergencyRoom: true,
    hasHelicopterPad: false,
    totalAmbulances: 6,
    availableAmbulances: 4,
  },
  {
    name: 'Hôpital Beaujon (AP-HP)',
    code: 'HP-CLICHY-92',
    address: '100 Boulevard du Général Leclerc',
    city: 'Clichy',
    postalCode: '92110',
    latitude: 48.9028,
    longitude: 2.3089,
    phone: '+33 1 40 87 50 00',
    hasSMUR: true,
    hasEmergencyRoom: true,
    hasHelicopterPad: false,
    totalAmbulances: 5,
    availableAmbulances: 3,
  },
];

// Generate ambulances for each hospital
function generateAmbulancesForHospital(hospitalId: string, hospitalCode: string, count: number) {
  const ambulances = [];
  const types: AmbulanceType[] = ['SMUR', 'SMUR', 'AMBULANCE', 'MEDICALISED', 'VSAV'];
  const callSigns = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel'];

  for (let i = 0; i < count; i++) {
    const type = types[i % types.length];
    const ambulance = {
      vehicleId: `${hospitalCode}-${String(i + 1).padStart(3, '0')}`,
      callSign: `${callSigns[i % callSigns.length]} ${i + 1}`,
      licensePlate: `${Math.floor(Math.random() * 900 + 100)}-${String.fromCharCode(
        65 + Math.floor(Math.random() * 26)
      )}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}-${Math.floor(
        Math.random() * 90 + 10
      )}`,
      type,
      hasDoctor: type === 'SMUR' || type === 'MEDICALISED',
      hasParamedic: true,
      hasAdvancedEquipment: type === 'SMUR' || type === 'MEDICALISED',
      homeHospitalId: hospitalId,
      crewSize: type === 'SMUR' ? 3 : 2,
      crewNames: generateCrewNames(type === 'SMUR' ? 3 : 2),
      driverName: generateDriverName(),
    };
    ambulances.push(ambulance);
  }

  return ambulances;
}

function generateCrewNames(count: number): string[] {
  const firstNames = [
    'Pierre',
    'Marie',
    'Jean',
    'Sophie',
    'Luc',
    'Claire',
    'Thomas',
    'Julie',
    'Marc',
    'Anne',
  ];
  const lastNames = [
    'Dubois',
    'Martin',
    'Bernard',
    'Petit',
    'Durand',
    'Leroy',
    'Moreau',
    'Simon',
    'Laurent',
    'Lefebvre',
  ];

  const names = [];
  for (let i = 0; i < count; i++) {
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    names.push(`${firstName} ${lastName}`);
  }
  return names;
}

function generateDriverName(): string {
  const firstNames = ['Antoine', 'François', 'Nicolas', 'Alexandre', 'Julien'];
  const lastNames = ['Garcia', 'Roux', 'Blanc', 'Girard', 'Andre'];
  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
  return `${firstName} ${lastName}`;
}

// Random offset for ambulance starting positions (within 2km of hospital)
function randomOffset(): number {
  return (Math.random() - 0.5) * 0.02; // ~1-2km offset
}

async function main() {
  console.log('🚑 Seeding hospitals and ambulances...');

  // Clear existing data
  console.log('Clearing existing ambulance and hospital data...');
  await prisma.ambulanceLocation.deleteMany({});
  await prisma.ambulance.deleteMany({});
  await prisma.hospital.deleteMany({});

  // Create hospitals
  console.log('Creating hospitals...');
  const createdHospitals = [];
  for (const hospitalData of hospitals) {
    const hospital = await prisma.hospital.create({
      data: hospitalData,
    });
    createdHospitals.push(hospital);
    console.log(`✅ Created hospital: ${hospital.name}`);
  }

  // Create ambulances
  console.log('\nCreating ambulances...');
  let totalAmbulances = 0;
  for (const hospital of createdHospitals) {
    const ambulances = generateAmbulancesForHospital(
      hospital.id,
      hospital.code,
      hospital.totalAmbulances
    );

    for (const ambulanceData of ambulances) {
      const ambulance = await prisma.ambulance.create({
        data: {
          ...ambulanceData,
          // Start ambulances at or near their home hospital with random offset
          currentLatitude: hospital.latitude + randomOffset(),
          currentLongitude: hospital.longitude + randomOffset(),
          status: 'AVAILABLE',
          heading: Math.floor(Math.random() * 360),
          speed: 0,
        },
      });
      totalAmbulances++;
      console.log(
        `✅ Created ambulance: ${ambulance.callSign} (${ambulance.vehicleId}) - ${ambulance.type}`
      );
    }
  }

  console.log(`\n✨ Seeding complete!`);
  console.log(`📊 Summary:`);
  console.log(`   - ${createdHospitals.length} hospitals created`);
  console.log(`   - ${totalAmbulances} ambulances created`);
  console.log(`   - ${createdHospitals.filter((h) => h.hasSMUR).length} hospitals with SMUR`);
  console.log(
    `   - ${createdHospitals.filter((h) => h.hasHelicopterPad).length} hospitals with helicopter pad`
  );

  console.log('\n🗺️  Map visualization available at: http://localhost:3000/map.html');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Seeding failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
