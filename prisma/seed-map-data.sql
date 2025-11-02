-- Seed sample map data for testing

-- Insert sample hospitals
INSERT INTO hospitals (id, name, code, latitude, longitude, address, city, "postalCode", phone, "hasSMUR", "hasEmergencyRoom", "hasHelicopterPad", "isActive", "createdAt", "updatedAt")
VALUES
  ('hosp-1', 'Hôpital Pitié-Salpêtrière', 'PSL', 48.8388, 2.3622, '47-83 Boulevard de l''Hôpital', 'Paris', '75013', '+33142161000', true, true, false, true, NOW(), NOW()),
  ('hosp-2', 'Hôpital Cochin', 'CCH', 48.8389, 2.3387, '27 Rue du Faubourg Saint-Jacques', 'Paris', '75014', '+33158412000', true, true, false, true, NOW(), NOW()),
  ('hosp-3', 'Hôpital Saint-Antoine', 'STA', 48.8499, 2.3932, '184 Rue du Faubourg Saint-Antoine', 'Paris', '75012', '+33149282000', true, true, true, true, NOW(), NOW()),
  ('hosp-4', 'Hôpital Bichat', 'BCT', 48.8990, 2.3275, '46 Rue Henri Huchard', 'Paris', '75018', '+33140257777', true, true, false, true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Insert sample ambulances
INSERT INTO ambulances (id, "vehicleId", "callSign", "licensePlate", type, "hasDoctor", "hasParamedic", "hasAdvancedEquipment", status, "currentLatitude", "currentLongitude", heading, speed, "homeHospitalId", "crewSize", "crewNames", "driverName", "isActive", "createdAt", "updatedAt")
VALUES
  ('amb-1', 'SMUR-01', 'ALPHA-1', 'AB-123-CD', 'SMUR', true, true, true, 'AVAILABLE', 48.8566, 2.3522, 45, 0, 'hosp-1', 3, ARRAY['Dr. Martin', 'Inf. Dubois', 'Amb. Laurent'], 'Amb. Laurent', true, NOW(), NOW()),
  ('amb-2', 'MEDIC-02', 'BRAVO-2', 'EF-456-GH', 'MEDICALISED', true, true, true, 'DISPATCHED', 48.8606, 2.3376, 120, 65, 'hosp-2', 2, ARRAY['Dr. Bernard', 'Amb. Richard'], 'Amb. Richard', true, NOW(), NOW()),
  ('amb-3', 'AMB-03', 'CHARLIE-3', 'IJ-789-KL', 'AMBULANCE', false, true, false, 'AVAILABLE', 48.8433, 2.3984, 0, 0, 'hosp-3', 2, ARRAY['Amb. Petit', 'Amb. Moreau'], 'Amb. Petit', true, NOW(), NOW()),
  ('amb-4', 'SMUR-04', 'DELTA-4', 'MN-012-OP', 'SMUR', true, true, true, 'RETURNING', 48.8789, 2.3488, 270, 45, 'hosp-4', 3, ARRAY['Dr. Leroy', 'Inf. Simon', 'Amb. Garnier'], 'Amb. Garnier', true, NOW(), NOW()),
  ('amb-5', 'VSAV-05', 'ECHO-5', 'QR-345-ST', 'VSAV', false, true, true, 'ON_SCENE', 48.8520, 2.3700, 0, 0, 'hosp-1', 2, ARRAY['Sgt. Roux', 'Cpl. Blanc'], 'Sgt. Roux', true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Insert sample dispatches
INSERT INTO dispatches (id, "dispatchId", priority, status, latitude, longitude, location, symptoms, "requestedAt", "dispatchedAt", "ambulanceId", "estimatedArrivalMinutes", "createdAt", "updatedAt")
VALUES
  ('disp-1', 'DISP-2025-001', 'P1', 'EN_ROUTE', 48.8606, 2.3376, '15 Rue de Rivoli, Paris 75001', ARRAY['Chest pain', 'Difficulty breathing'], NOW() - INTERVAL '5 minutes', NOW() - INTERVAL '3 minutes', 'amb-2', 7, NOW(), NOW()),
  ('disp-2', 'DISP-2025-002', 'P0', 'ON_SCENE', 48.8520, 2.3700, '42 Avenue des Champs-Élysées, Paris 75008', ARRAY['Cardiac arrest', 'Unconscious'], NOW() - INTERVAL '15 minutes', NOW() - INTERVAL '12 minutes', 'amb-5', 0, NOW(), NOW()),
  ('disp-3', 'DISP-2025-003', 'P2', 'COMPLETED', 48.8789, 2.3488, '8 Boulevard Haussmann, Paris 75009', ARRAY['Fracture', 'Fall'], NOW() - INTERVAL '25 minutes', NOW() - INTERVAL '20 minutes', 'amb-4', 0, NOW(), NOW()),
  ('disp-4', 'DISP-2025-004', 'P3', 'PENDING', 48.8450, 2.3950, '120 Rue de Charonne, Paris 75011', ARRAY['Minor laceration', 'Bleeding'], NOW() - INTERVAL '2 minutes', NULL, NULL, NULL, NOW(), NOW()),
  ('disp-5', 'DISP-2025-005', 'P2', 'PENDING', 48.8900, 2.3300, '30 Rue La Fayette, Paris 75009', ARRAY['Abdominal pain', 'Nausea'], NOW() - INTERVAL '8 minutes', NULL, NULL, NULL, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
