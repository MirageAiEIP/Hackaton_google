-- Create emergency calls and dispatches for map visualization

-- Create emergency calls
INSERT INTO calls (id, "createdAt", "updatedAt", "startedAt", status, priority, "chiefComplaint", "currentSymptoms")
VALUES
  ('call-emerg-1', NOW() - INTERVAL '5 minutes', NOW(), NOW() - INTERVAL '5 minutes', 'IN_PROGRESS', 'P1', 'Chest pain and difficulty breathing', 'Patient reports severe chest pain radiating to left arm, shortness of breath'),
  ('call-emerg-2', NOW() - INTERVAL '15 minutes', NOW(), NOW() - INTERVAL '15 minutes', 'IN_PROGRESS', 'P0', 'Cardiac arrest', 'Patient found unconscious, not breathing, no pulse detected'),
  ('call-emerg-3', NOW() - INTERVAL '25 minutes', NOW(), NOW() - INTERVAL '25 minutes', 'COMPLETED', 'P2', 'Fall with possible fracture', 'Patient fell from stairs, unable to move right leg, severe pain'),
  ('call-emerg-4', NOW() - INTERVAL '2 minutes', NOW(), NOW() - INTERVAL '2 minutes', 'IN_PROGRESS', 'P3', 'Minor laceration', 'Small cut on hand from broken glass, bleeding controlled'),
  ('call-emerg-5', NOW() - INTERVAL '8 minutes', NOW(), NOW() - INTERVAL '8 minutes', 'IN_PROGRESS', 'P2', 'Severe abdominal pain', 'Patient reports acute abdominal pain with nausea and vomiting')
ON CONFLICT (id) DO NOTHING;

-- Create dispatches linked to calls
INSERT INTO dispatches (id, "callId", "dispatchId", priority, status, latitude, longitude, location, symptoms, "requestedAt", "dispatchedAt", "ambulanceId", "estimatedArrivalMinutes", "createdAt", "updatedAt")
VALUES
  ('disp-1', 'call-emerg-1', 'DISP-2025-001', 'P1', 'EN_ROUTE', 48.8606, 2.3376, '15 Rue de Rivoli, Paris 75001', 'Chest pain, Difficulty breathing', NOW() - INTERVAL '5 minutes', NOW() - INTERVAL '3 minutes', 'amb-2', 7, NOW(), NOW()),
  ('disp-2', 'call-emerg-2', 'DISP-2025-002', 'P0', 'ON_SCENE', 48.8520, 2.3700, '42 Avenue des Champs-Élysées, Paris 75008', 'Cardiac arrest, Unconscious', NOW() - INTERVAL '15 minutes', NOW() - INTERVAL '12 minutes', 'amb-5', 0, NOW(), NOW()),
  ('disp-3', 'call-emerg-3', 'DISP-2025-003', 'P2', 'COMPLETED', 48.8789, 2.3488, '8 Boulevard Haussmann, Paris 75009', 'Fracture, Fall', NOW() - INTERVAL '25 minutes', NOW() - INTERVAL '20 minutes', 'amb-4', 0, NOW(), NOW()),
  ('disp-4', 'call-emerg-4', 'DISP-2025-004', 'P3', 'PENDING', 48.8450, 2.3950, '120 Rue de Charonne, Paris 75011', 'Minor laceration, Bleeding', NOW() - INTERVAL '2 minutes', NULL, NULL, NULL, NOW(), NOW()),
  ('disp-5', 'call-emerg-5', 'DISP-2025-005', 'P2', 'PENDING', 48.8900, 2.3300, '30 Rue La Fayette, Paris 75009', 'Abdominal pain, Nausea', NOW() - INTERVAL '8 minutes', NULL, NULL, NULL, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
