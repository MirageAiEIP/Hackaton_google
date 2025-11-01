import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AmbulanceTrackingService } from './ambulance-tracking.service';
import { prisma } from '@/utils/prisma';
import { AmbulanceStatus, AmbulanceType } from '@prisma/client';
import { Container } from '@/infrastructure/di/Container';

// Mock logger first
vi.mock('@/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock Container
vi.mock('@/infrastructure/di/Container', () => ({
  Container: {
    getInstance: vi.fn(() => ({
      getEventBus: vi.fn(() => ({
        publish: vi.fn(),
      })),
    })),
  },
}));

// Mock Prisma
vi.mock('@/utils/prisma', () => ({
  prisma: {
    ambulance: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    dispatch: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    ambulanceLocation: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

describe('AmbulanceTrackingService', () => {
  let service: AmbulanceTrackingService;

  beforeEach(() => {
    service = new AmbulanceTrackingService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Tests cleanup
    vi.clearAllMocks();
  });

  describe('createAmbulance', () => {
    it('should create a SMUR ambulance with default doctor', async () => {
      const mockAmbulance = {
        id: 'amb_123',
        vehicleId: 'SMUR-75-001',
        callSign: 'Alpha 1',
        licensePlate: 'ABC-123-XY',
        type: 'SMUR' as AmbulanceType,
        homeHospitalId: 'hospital_123',
        currentLatitude: 48.8566,
        currentLongitude: 2.3522,
        hasDoctor: true,
        hasParamedic: true,
        hasAdvancedEquipment: false,
        status: 'AVAILABLE' as AmbulanceStatus,
        heading: 0,
        speed: 0,
        currentDispatchId: null,
        crewSize: 2,
        crewNames: ['Dr. Smith', 'Nurse Johnson'],
        driverName: 'Driver Brown',
        isActive: true,
        lastServiceAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        homeHospital: {
          id: 'hospital_123',
          name: 'Hôpital Necker',
          code: 'HP-PARIS-01',
          address: '149 Rue de Sèvres',
          city: 'Paris',
          postalCode: '75015',
          latitude: 48.8566,
          longitude: 2.3522,
          totalAmbulances: 5,
          availableAmbulances: 3,
          hasSMUR: true,
          hasEmergencyRoom: true,
          hasHelicopterPad: false,
          phone: '+33123456789',
          emergencyContact: '+33987654321',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };

      vi.mocked(prisma.ambulance.create).mockResolvedValue(mockAmbulance);

      const result = await service.createAmbulance({
        vehicleId: 'SMUR-75-001',
        callSign: 'Alpha 1',
        licensePlate: 'ABC-123-XY',
        type: 'SMUR',
        homeHospitalId: 'hospital_123',
        currentLatitude: 48.8566,
        currentLongitude: 2.3522,
        crewNames: ['Dr. Smith', 'Nurse Johnson'],
        driverName: 'Driver Brown',
      });

      expect(result).toEqual(mockAmbulance);
      expect(prisma.ambulance.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          vehicleId: 'SMUR-75-001',
          callSign: 'Alpha 1',
          type: 'SMUR',
          hasDoctor: true, // Should default to true for SMUR
          hasParamedic: true,
          status: 'AVAILABLE',
        }),
        include: {
          homeHospital: true,
        },
      });
    });

    it('should create a regular ambulance without doctor', async () => {
      const mockAmbulance = {
        id: 'amb_456',
        vehicleId: 'AMB-75-001',
        callSign: 'Bravo 1',
        licensePlate: 'XYZ-789-AB',
        type: 'AMBULANCE' as AmbulanceType,
        homeHospitalId: 'hospital_456',
        currentLatitude: 48.8566,
        currentLongitude: 2.3522,
        hasDoctor: false,
        hasParamedic: true,
        hasAdvancedEquipment: false,
        status: 'AVAILABLE' as AmbulanceStatus,
        heading: 0,
        speed: 0,
        currentDispatchId: null,
        crewSize: 2,
        crewNames: [],
        driverName: null,
        isActive: true,
        lastServiceAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        homeHospital: {
          id: 'hospital_456',
          name: 'Hôpital Test',
          code: 'HP-TEST-01',
          address: 'Test Address',
          city: 'Paris',
          postalCode: '75015',
          latitude: 48.8566,
          longitude: 2.3522,
          totalAmbulances: 3,
          availableAmbulances: 2,
          hasSMUR: false,
          hasEmergencyRoom: true,
          hasHelicopterPad: false,
          phone: '+33123456789',
          emergencyContact: null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };

      vi.mocked(prisma.ambulance.create).mockResolvedValue(mockAmbulance);

      const result = await service.createAmbulance({
        vehicleId: 'AMB-75-001',
        callSign: 'Bravo 1',
        licensePlate: 'XYZ-789-AB',
        type: 'AMBULANCE',
        homeHospitalId: 'hospital_456',
        currentLatitude: 48.8566,
        currentLongitude: 2.3522,
      });

      expect(result.hasDoctor).toBe(false);
      expect(result.type).toBe('AMBULANCE');
    });

    it('should throw error if creation fails', async () => {
      vi.mocked(prisma.ambulance.create).mockRejectedValue(new Error('DB error'));

      await expect(
        service.createAmbulance({
          vehicleId: 'SMUR-75-001',
          callSign: 'Alpha 1',
          licensePlate: 'ABC-123-XY',
          type: 'SMUR',
          homeHospitalId: 'hospital_123',
          currentLatitude: 48.8566,
          currentLongitude: 2.3522,
        })
      ).rejects.toThrow('Failed to create ambulance');
    });
  });

  describe('findNearestAvailableAmbulance', () => {
    it('should find the nearest available ambulance', async () => {
      const mockAmbulances = [
        {
          id: 'amb_1',
          vehicleId: 'SMUR-1',
          callSign: 'Alpha 1',
          licensePlate: 'ABC-123',
          type: 'SMUR' as AmbulanceType,
          homeHospitalId: 'hosp_1',
          currentLatitude: 48.8566, // Close to target
          currentLongitude: 2.3522,
          hasDoctor: true,
          hasParamedic: true,
          hasAdvancedEquipment: false,
          status: 'AVAILABLE' as AmbulanceStatus,
          heading: 0,
          speed: 0,
          currentDispatchId: null,
          crewSize: 2,
          crewNames: [],
          driverName: null,
          isActive: true,
          lastServiceAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          homeHospital: {
            id: 'hosp_1',
            name: 'Hospital 1',
            code: 'HP-01',
            address: 'Address 1',
            city: 'Paris',
            postalCode: '75001',
            latitude: 48.8566,
            longitude: 2.3522,
            totalAmbulances: 2,
            availableAmbulances: 1,
            hasSMUR: true,
            hasEmergencyRoom: true,
            hasHelicopterPad: false,
            phone: '+33123456789',
            emergencyContact: null,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
        {
          id: 'amb_2',
          vehicleId: 'SMUR-2',
          callSign: 'Alpha 2',
          licensePlate: 'XYZ-789',
          type: 'SMUR' as AmbulanceType,
          homeHospitalId: 'hosp_2',
          currentLatitude: 48.9, // Further from target
          currentLongitude: 2.5,
          hasDoctor: true,
          hasParamedic: true,
          hasAdvancedEquipment: false,
          status: 'AVAILABLE' as AmbulanceStatus,
          heading: 0,
          speed: 0,
          currentDispatchId: null,
          crewSize: 2,
          crewNames: [],
          driverName: null,
          isActive: true,
          lastServiceAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          homeHospital: {
            id: 'hosp_2',
            name: 'Hospital 2',
            code: 'HP-02',
            address: 'Address 2',
            city: 'Paris',
            postalCode: '75002',
            latitude: 48.9,
            longitude: 2.5,
            totalAmbulances: 2,
            availableAmbulances: 1,
            hasSMUR: true,
            hasEmergencyRoom: true,
            hasHelicopterPad: false,
            phone: '+33123456789',
            emergencyContact: null,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      ];

      vi.mocked(prisma.ambulance.findMany).mockResolvedValue(mockAmbulances);

      const result = await service.findNearestAvailableAmbulance(48.8566, 2.3522);

      expect(result).toBeDefined();
      expect(result?.vehicleId).toBe('SMUR-1');
      expect(result?.distanceKm).toBeDefined();
      expect(result?.distanceKm).toBeLessThan(1); // Very close
    });

    it('should filter by ambulance type', async () => {
      const mockAmbulances = [
        {
          id: 'amb_1',
          vehicleId: 'SMUR-1',
          type: 'SMUR' as AmbulanceType,
          currentLatitude: 48.8566,
          currentLongitude: 2.3522,
          status: 'AVAILABLE' as AmbulanceStatus,
          isActive: true,
        },
      ];

      vi.mocked(prisma.ambulance.findMany).mockResolvedValue(mockAmbulances as any);

      await service.findNearestAvailableAmbulance(48.8566, 2.3522, 'SMUR');

      expect(prisma.ambulance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: 'SMUR',
            status: 'AVAILABLE',
            isActive: true,
          }),
        })
      );
    });

    it('should return null if no ambulances available', async () => {
      vi.mocked(prisma.ambulance.findMany).mockResolvedValue([]);

      const result = await service.findNearestAvailableAmbulance(48.8566, 2.3522);

      expect(result).toBeNull();
    });

    it('should throw error if database query fails', async () => {
      vi.mocked(prisma.ambulance.findMany).mockRejectedValue(new Error('DB error'));

      await expect(service.findNearestAvailableAmbulance(48.8566, 2.3522)).rejects.toThrow(
        'Failed to find nearest ambulance'
      );
    });
  });

  describe('updateAmbulanceLocation', () => {
    it('should update ambulance location and create history record', async () => {
      const mockAmbulance = {
        id: 'amb_123',
        vehicleId: 'SMUR-1',
        callSign: 'Alpha 1',
        licensePlate: 'ABC-123',
        type: 'SMUR' as AmbulanceType,
        homeHospitalId: 'hosp_1',
        currentLatitude: 48.87,
        currentLongitude: 2.36,
        heading: 45,
        speed: 60,
        status: 'EN_ROUTE' as AmbulanceStatus,
        hasDoctor: true,
        hasParamedic: true,
        hasAdvancedEquipment: false,
        currentDispatchId: 'dispatch_123',
        crewSize: 2,
        crewNames: [],
        driverName: null,
        isActive: true,
        lastServiceAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockLocationHistory = {
        id: 'loc_123',
        ambulanceId: 'amb_123',
        latitude: 48.87,
        longitude: 2.36,
        heading: 45,
        speed: 60,
        altitude: null,
        status: 'EN_ROUTE' as AmbulanceStatus,
        dispatchId: 'dispatch_123',
        distanceToTarget: null,
        recordedAt: new Date(),
      };

      vi.mocked(prisma.ambulance.update).mockResolvedValue(mockAmbulance);
      vi.mocked(prisma.ambulanceLocation.create).mockResolvedValue(mockLocationHistory);

      const result = await service.updateAmbulanceLocation({
        ambulanceId: 'amb_123',
        latitude: 48.87,
        longitude: 2.36,
        heading: 45,
        speed: 60,
        status: 'EN_ROUTE',
        dispatchId: 'dispatch_123',
      });

      expect(result).toEqual(mockAmbulance);
      expect(prisma.ambulance.update).toHaveBeenCalledWith({
        where: { id: 'amb_123' },
        data: {
          currentLatitude: 48.87,
          currentLongitude: 2.36,
          heading: 45,
          speed: 60,
          status: 'EN_ROUTE',
        },
      });
      expect(prisma.ambulanceLocation.create).toHaveBeenCalledWith({
        data: {
          ambulanceId: 'amb_123',
          latitude: 48.87,
          longitude: 2.36,
          heading: 45,
          speed: 60,
          status: 'EN_ROUTE',
          dispatchId: 'dispatch_123',
        },
      });
    });
  });

  describe('getAllActiveAmbulances', () => {
    it('should return all active ambulances', async () => {
      const mockAmbulances = [
        {
          id: 'amb_1',
          vehicleId: 'SMUR-1',
          status: 'AVAILABLE' as AmbulanceStatus,
          homeHospital: {
            id: 'hosp_1',
            name: 'Hospital 1',
            code: 'HP-01',
            latitude: 48.8566,
            longitude: 2.3522,
          },
        },
        {
          id: 'amb_2',
          vehicleId: 'SMUR-2',
          status: 'EN_ROUTE' as AmbulanceStatus,
          homeHospital: {
            id: 'hosp_2',
            name: 'Hospital 2',
            code: 'HP-02',
            latitude: 48.9,
            longitude: 2.5,
          },
        },
      ];

      vi.mocked(prisma.ambulance.findMany).mockResolvedValue(mockAmbulances as any);

      const result = await service.getAllActiveAmbulances();

      expect(result).toHaveLength(2);
      expect(prisma.ambulance.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        include: {
          homeHospital: {
            select: {
              id: true,
              name: true,
              code: true,
              latitude: true,
              longitude: true,
            },
          },
        },
        orderBy: { vehicleId: 'asc' },
      });
    });

    it('should return empty array when no active ambulances', async () => {
      vi.mocked(prisma.ambulance.findMany).mockResolvedValue([]);

      const result = await service.getAllActiveAmbulances();

      expect(result).toHaveLength(0);
      expect(result).toEqual([]);
    });

    it('should throw error if database query fails', async () => {
      vi.mocked(prisma.ambulance.findMany).mockRejectedValue(new Error('DB error'));

      await expect(service.getAllActiveAmbulances()).rejects.toThrow(
        'Failed to get active ambulances'
      );
    });
  });

  describe('updateAmbulanceLocation with event publishing', () => {
    it('should update location and publish event', async () => {
      const mockAmbulance = {
        id: 'amb_123',
        vehicleId: 'SMUR-1',
        currentLatitude: 48.87,
        currentLongitude: 2.36,
        heading: 45,
        speed: 60,
        status: 'EN_ROUTE' as AmbulanceStatus,
      };

      vi.mocked(prisma.ambulance.update).mockResolvedValue(mockAmbulance as any);
      vi.mocked(prisma.ambulanceLocation.create).mockResolvedValue({} as any);

      const mockEventBus = {
        publish: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(Container.getInstance).mockReturnValue({
        getEventBus: () => mockEventBus,
      } as any);

      const result = await service.updateAmbulanceLocation({
        ambulanceId: 'amb_123',
        latitude: 48.87,
        longitude: 2.36,
        heading: 45,
        speed: 60,
        status: 'EN_ROUTE',
        dispatchId: 'dispatch_123',
      });

      expect(result).toEqual(mockAmbulance);
      expect(mockEventBus.publish).toHaveBeenCalled();
    });

    it('should handle location update errors gracefully', async () => {
      vi.mocked(prisma.ambulance.update).mockRejectedValue(new Error('Update failed'));

      const result = await service.updateAmbulanceLocation({
        ambulanceId: 'amb_123',
        latitude: 48.87,
        longitude: 2.36,
        status: 'EN_ROUTE',
      });

      expect(result).toBeUndefined();
    });

    it('should use default values for optional parameters', async () => {
      const mockAmbulance = {
        id: 'amb_123',
        vehicleId: 'SMUR-1',
        currentLatitude: 48.87,
        currentLongitude: 2.36,
        heading: 0,
        speed: 0,
        status: 'AVAILABLE' as AmbulanceStatus,
      };

      vi.mocked(prisma.ambulance.update).mockResolvedValue(mockAmbulance as any);
      vi.mocked(prisma.ambulanceLocation.create).mockResolvedValue({} as any);

      const mockEventBus = {
        publish: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(Container.getInstance).mockReturnValue({
        getEventBus: () => mockEventBus,
      } as any);

      const result = await service.updateAmbulanceLocation({
        ambulanceId: 'amb_123',
        latitude: 48.87,
        longitude: 2.36,
        status: 'AVAILABLE',
      });

      expect(result).toEqual(mockAmbulance);
      expect(prisma.ambulance.update).toHaveBeenCalledWith({
        where: { id: 'amb_123' },
        data: {
          currentLatitude: 48.87,
          currentLongitude: 2.36,
          heading: 0,
          speed: 0,
          status: 'AVAILABLE',
        },
      });
    });
  });

  describe('findNearestAvailableAmbulance with type filtering', () => {
    it('should find nearest SMUR ambulance when type specified', async () => {
      const mockAmbulances = [
        {
          id: 'amb_1',
          vehicleId: 'SMUR-1',
          type: 'SMUR' as AmbulanceType,
          currentLatitude: 48.8566,
          currentLongitude: 2.3522,
          status: 'AVAILABLE' as AmbulanceStatus,
          isActive: true,
          homeHospital: {},
        },
      ];

      vi.mocked(prisma.ambulance.findMany).mockResolvedValue(mockAmbulances as any);

      const result = await service.findNearestAvailableAmbulance(48.87, 2.36, 'SMUR');

      expect(result).toBeDefined();
      expect(result?.type).toBe('SMUR');
      expect(prisma.ambulance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'AVAILABLE',
            isActive: true,
            type: 'SMUR',
          }),
        })
      );
    });

    it('should calculate distance and return nearest ambulance', async () => {
      const mockAmbulances = [
        {
          id: 'amb_1',
          vehicleId: 'SMUR-1',
          currentLatitude: 48.8566,
          currentLongitude: 2.3522,
          homeHospital: {},
        },
        {
          id: 'amb_2',
          vehicleId: 'SMUR-2',
          currentLatitude: 48.9,
          currentLongitude: 2.5,
          homeHospital: {},
        },
      ];

      vi.mocked(prisma.ambulance.findMany).mockResolvedValue(mockAmbulances as any);

      const result = await service.findNearestAvailableAmbulance(48.8566, 2.3522);

      expect(result).toBeDefined();
      expect(result?.id).toBe('amb_1'); // Closest one
      expect(result?.distanceKm).toBeDefined();
      expect(result?.distanceKm).toBeLessThan(1);
    });
  });

  describe('createAmbulance with different types', () => {
    it('should create MEDICALISED ambulance with doctor by default', async () => {
      const mockAmbulance = {
        id: 'amb_456',
        vehicleId: 'MED-1',
        type: 'MEDICALISED' as AmbulanceType,
        hasDoctor: true,
        hasParamedic: true,
        status: 'AVAILABLE' as AmbulanceStatus,
        homeHospital: {},
      };

      vi.mocked(prisma.ambulance.create).mockResolvedValue(mockAmbulance as any);

      const result = await service.createAmbulance({
        vehicleId: 'MED-1',
        callSign: 'Med 1',
        licensePlate: 'MED-123',
        type: 'MEDICALISED',
        homeHospitalId: 'hosp_1',
        currentLatitude: 48.8566,
        currentLongitude: 2.3522,
      });

      expect(result.hasDoctor).toBe(true);
      expect(result.type).toBe('MEDICALISED');
    });

    it('should create ambulance with custom crew configuration', async () => {
      const mockAmbulance = {
        id: 'amb_789',
        vehicleId: 'SMUR-3',
        type: 'SMUR' as AmbulanceType,
        hasDoctor: true,
        hasParamedic: true,
        crewNames: ['Dr. Smith', 'Nurse Johnson', 'Paramedic Brown'],
        driverName: 'Driver Wilson',
        status: 'AVAILABLE' as AmbulanceStatus,
        homeHospital: {},
      };

      vi.mocked(prisma.ambulance.create).mockResolvedValue(mockAmbulance as any);

      const result = await service.createAmbulance({
        vehicleId: 'SMUR-3',
        callSign: 'Alpha 3',
        licensePlate: 'SMUR-789',
        type: 'SMUR',
        homeHospitalId: 'hosp_1',
        currentLatitude: 48.8566,
        currentLongitude: 2.3522,
        crewNames: ['Dr. Smith', 'Nurse Johnson', 'Paramedic Brown'],
        driverName: 'Driver Wilson',
        hasDoctor: true,
        hasParamedic: true,
      });

      expect(result.crewNames).toHaveLength(3);
      expect(result.driverName).toBe('Driver Wilson');
    });
  });

  describe('assignAmbulanceToDispatch', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should assign nearest SMUR ambulance to P0 dispatch and start simulation', async () => {
      const mockNearestAmbulance = {
        id: 'amb_123',
        vehicleId: 'SMUR-1',
        callSign: 'Alpha 1',
        type: 'SMUR' as AmbulanceType,
        currentLatitude: 48.8566,
        currentLongitude: 2.3522,
        status: 'AVAILABLE' as AmbulanceStatus,
        distanceKm: 5.2,
        homeHospital: {},
      };

      const mockUpdatedAmbulance = {
        ...mockNearestAmbulance,
        status: 'DISPATCHED' as AmbulanceStatus,
        currentDispatchId: 'SMUR-123',
      };

      const mockUpdatedDispatch = {
        id: 'dispatch_1',
        dispatchId: 'SMUR-123',
        status: 'DISPATCHED',
        dispatchedAt: new Date(),
        distanceKm: 5.2,
        estimatedArrivalMinutes: 6,
      };

      vi.mocked(prisma.ambulance.findMany).mockResolvedValue([mockNearestAmbulance as any]);
      vi.mocked(prisma.$transaction).mockResolvedValue([
        mockUpdatedAmbulance,
        mockUpdatedDispatch,
      ] as any);

      const mockEventBus = {
        publish: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(Container.getInstance).mockReturnValue({
        getEventBus: () => mockEventBus,
      } as any);

      const result = await service.assignAmbulanceToDispatch({
        dispatchId: 'SMUR-123',
        patientLatitude: 48.87,
        patientLongitude: 2.36,
        priority: 'P0',
      });

      expect(result.ambulance.id).toBe('amb_123');
      expect(result.dispatch.status).toBe('DISPATCHED');
      expect(result.estimatedArrivalMinutes).toBeGreaterThan(0);
      expect(result.distanceKm).toBeGreaterThan(0);
      expect(mockEventBus.publish).toHaveBeenCalled();
    });

    it('should assign regular ambulance to P2 dispatch (non-critical)', async () => {
      const mockNearestAmbulance = {
        id: 'amb_456',
        vehicleId: 'AMB-1',
        type: 'AMBULANCE' as AmbulanceType,
        currentLatitude: 48.85,
        currentLongitude: 2.35,
        status: 'AVAILABLE' as AmbulanceStatus,
        distanceKm: 2.1,
        homeHospital: {},
      };

      const mockUpdatedAmbulance = {
        ...mockNearestAmbulance,
        status: 'DISPATCHED' as AmbulanceStatus,
        currentDispatchId: 'DISP-456',
      };

      const mockUpdatedDispatch = {
        id: 'dispatch_2',
        dispatchId: 'DISP-456',
        status: 'DISPATCHED',
        dispatchedAt: new Date(),
        distanceKm: 2.1,
        estimatedArrivalMinutes: 3,
      };

      vi.mocked(prisma.ambulance.findMany).mockResolvedValue([mockNearestAmbulance as any]);
      vi.mocked(prisma.$transaction).mockResolvedValue([
        mockUpdatedAmbulance,
        mockUpdatedDispatch,
      ] as any);

      const mockEventBus = {
        publish: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(Container.getInstance).mockReturnValue({
        getEventBus: () => mockEventBus,
      } as any);

      const result = await service.assignAmbulanceToDispatch({
        dispatchId: 'DISP-456',
        patientLatitude: 48.87,
        patientLongitude: 2.37,
        priority: 'P2',
      });

      expect(result.ambulance.id).toBe('amb_456');
      expect(result.estimatedArrivalMinutes).toBe(3);

      // Should not filter by type for P2
      expect(prisma.ambulance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'AVAILABLE',
            isActive: true,
          }),
        })
      );
    });

    it('should throw error when no available ambulances', async () => {
      vi.mocked(prisma.ambulance.findMany).mockResolvedValue([]);

      await expect(
        service.assignAmbulanceToDispatch({
          dispatchId: 'SMUR-123',
          patientLatitude: 48.87,
          patientLongitude: 2.36,
          priority: 'P0',
        })
      ).rejects.toThrow('No available ambulances found');
    });

    it('should handle database transaction errors', async () => {
      const mockNearestAmbulance = {
        id: 'amb_123',
        distanceKm: 5.2,
        homeHospital: {},
      };

      vi.mocked(prisma.ambulance.findMany).mockResolvedValue([mockNearestAmbulance as any]);
      vi.mocked(prisma.$transaction).mockRejectedValue(new Error('Transaction failed'));

      await expect(
        service.assignAmbulanceToDispatch({
          dispatchId: 'SMUR-123',
          patientLatitude: 48.87,
          patientLongitude: 2.36,
          priority: 'P0',
        })
      ).rejects.toThrow('Transaction failed');
    });

    it('should filter by SMUR type for P1 priority', async () => {
      const mockNearestAmbulance = {
        id: 'amb_smur',
        vehicleId: 'SMUR-2',
        type: 'SMUR' as AmbulanceType,
        currentLatitude: 48.8566,
        currentLongitude: 2.3522,
        status: 'AVAILABLE' as AmbulanceStatus,
        distanceKm: 3.5,
        homeHospital: {},
      };

      const mockUpdatedAmbulance = {
        ...mockNearestAmbulance,
        status: 'DISPATCHED' as AmbulanceStatus,
      };

      const mockUpdatedDispatch = {
        dispatchId: 'SMUR-P1-123',
        status: 'DISPATCHED',
      };

      vi.mocked(prisma.ambulance.findMany).mockResolvedValue([mockNearestAmbulance as any]);
      vi.mocked(prisma.$transaction).mockResolvedValue([
        mockUpdatedAmbulance,
        mockUpdatedDispatch,
      ] as any);

      const mockEventBus = {
        publish: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(Container.getInstance).mockReturnValue({
        getEventBus: () => mockEventBus,
      } as any);

      await service.assignAmbulanceToDispatch({
        dispatchId: 'SMUR-P1-123',
        patientLatitude: 48.87,
        patientLongitude: 2.36,
        priority: 'P1',
      });

      // Should filter by SMUR type for P1
      expect(prisma.ambulance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'AVAILABLE',
            isActive: true,
            type: 'SMUR',
          }),
        })
      );
    });

    it('should calculate ETA based on distance', async () => {
      const mockNearestAmbulance = {
        id: 'amb_123',
        currentLatitude: 48.8566,
        currentLongitude: 2.3522,
        distanceKm: 10.0,
        homeHospital: {},
      };

      const mockUpdatedAmbulance = {
        ...mockNearestAmbulance,
        status: 'DISPATCHED' as AmbulanceStatus,
      };

      const mockUpdatedDispatch = {
        dispatchId: 'DISP-ETA',
        estimatedArrivalMinutes: 10,
      };

      vi.mocked(prisma.ambulance.findMany).mockResolvedValue([mockNearestAmbulance as any]);
      vi.mocked(prisma.$transaction).mockResolvedValue([
        mockUpdatedAmbulance,
        mockUpdatedDispatch,
      ] as any);

      const mockEventBus = {
        publish: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(Container.getInstance).mockReturnValue({
        getEventBus: () => mockEventBus,
      } as any);

      const result = await service.assignAmbulanceToDispatch({
        dispatchId: 'DISP-ETA',
        patientLatitude: 48.87,
        patientLongitude: 2.36,
        priority: 'P2',
      });

      // ETA calculated based on actual distance
      expect(result.estimatedArrivalMinutes).toBeGreaterThan(0);
    });

    it('should publish AmbulanceDispatchedEvent after assignment', async () => {
      const mockNearestAmbulance = {
        id: 'amb_event',
        vehicleId: 'SMUR-EVENT',
        currentLatitude: 48.8566,
        currentLongitude: 2.3522,
        distanceKm: 5.0,
        homeHospital: {},
      };

      const mockUpdatedAmbulance = {
        ...mockNearestAmbulance,
        status: 'DISPATCHED' as AmbulanceStatus,
      };

      const mockUpdatedDispatch = {
        dispatchId: 'DISP-EVENT',
      };

      vi.mocked(prisma.ambulance.findMany).mockResolvedValue([mockNearestAmbulance as any]);
      vi.mocked(prisma.$transaction).mockResolvedValue([
        mockUpdatedAmbulance,
        mockUpdatedDispatch,
      ] as any);

      const mockPublish = vi.fn().mockResolvedValue(undefined);
      const mockEventBus = {
        publish: mockPublish,
      };

      vi.mocked(Container.getInstance).mockReturnValue({
        getEventBus: () => mockEventBus,
      } as any);

      await service.assignAmbulanceToDispatch({
        dispatchId: 'DISP-EVENT',
        patientLatitude: 48.87,
        patientLongitude: 2.36,
        priority: 'P0',
      });

      expect(mockPublish).toHaveBeenCalledTimes(1);
      const publishedEvent = mockPublish.mock.calls[0][0];
      expect(publishedEvent.eventName).toBe('AmbulanceDispatchedEvent');
      expect(publishedEvent.ambulanceId).toBe('amb_event');
      expect(publishedEvent.dispatchId).toBe('DISP-EVENT');
    });
  });

  describe('cleanup', () => {
    it('should clear all movement intervals', () => {
      // Access private property through type casting for testing
      const serviceWithIntervals = service as any;

      // Mock setInterval to track created intervals
      const mockInterval1 = { id: 'interval_1' } as any;
      const mockInterval2 = { id: 'interval_2' } as any;

      serviceWithIntervals.movementIntervals.set('amb_1', mockInterval1);
      serviceWithIntervals.movementIntervals.set('amb_2', mockInterval2);

      expect(serviceWithIntervals.movementIntervals.size).toBe(2);

      service.cleanup();

      expect(serviceWithIntervals.movementIntervals.size).toBe(0);
    });

    it('should not error when cleaning up with no active intervals', () => {
      expect(() => service.cleanup()).not.toThrow();
    });
  });

  describe('private helper methods (tested through public methods)', () => {
    it('should calculate distance between two coordinates', async () => {
      // Test calculateDistance indirectly through findNearestAvailableAmbulance
      const mockAmbulances = [
        {
          id: 'amb_1',
          vehicleId: 'SMUR-1',
          type: 'SMUR' as AmbulanceType,
          currentLatitude: 48.8566, // Paris coordinates
          currentLongitude: 2.3522,
          status: 'AVAILABLE' as AmbulanceStatus,
          isActive: true,
          homeHospital: {},
        },
        {
          id: 'amb_2',
          vehicleId: 'SMUR-2',
          type: 'SMUR' as AmbulanceType,
          currentLatitude: 51.5074, // London coordinates (much further)
          currentLongitude: -0.1278,
          status: 'AVAILABLE' as AmbulanceStatus,
          isActive: true,
          homeHospital: {},
        },
      ];

      vi.mocked(prisma.ambulance.findMany).mockResolvedValue(mockAmbulances as any);

      // Search near Paris
      const result = await service.findNearestAvailableAmbulance(48.87, 2.36);

      // Should find Paris ambulance as nearest
      expect(result).toBeDefined();
      expect(result?.id).toBe('amb_1');
      expect(result?.distanceKm).toBeLessThan(5); // Within 5km
    });

    it('should filter by ambulance type correctly', async () => {
      const mockAmbulances = [
        {
          id: 'amb_smur',
          vehicleId: 'SMUR-1',
          type: 'SMUR' as AmbulanceType,
          currentLatitude: 48.8566,
          currentLongitude: 2.3522,
          status: 'AVAILABLE' as AmbulanceStatus,
          isActive: true,
          homeHospital: {},
        },
      ];

      vi.mocked(prisma.ambulance.findMany).mockResolvedValue(mockAmbulances as any);

      const result = await service.findNearestAvailableAmbulance(48.87, 2.36, 'SMUR');

      expect(result).toBeDefined();
      expect(result?.type).toBe('SMUR');

      // Verify filter was applied
      expect(prisma.ambulance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: 'SMUR',
          }),
        })
      );
    });

    it('should handle missing ambulance in findNearest gracefully', async () => {
      vi.mocked(prisma.ambulance.findMany).mockResolvedValue([]);

      const result = await service.findNearestAvailableAmbulance(48.87, 2.36);

      expect(result).toBeNull();
    });

    it('should correctly determine SMUR requirement for P0 priority', async () => {
      const mockAmbulances = [
        {
          id: 'amb_smur',
          type: 'SMUR' as AmbulanceType,
          currentLatitude: 48.8566,
          currentLongitude: 2.3522,
          distanceKm: 2.0,
          homeHospital: {},
        },
      ];

      vi.mocked(prisma.ambulance.findMany).mockResolvedValue(mockAmbulances as any);
      vi.mocked(prisma.$transaction).mockResolvedValue([
        { id: 'amb_smur', status: 'DISPATCHED' },
        { dispatchId: 'TEST', status: 'DISPATCHED' },
      ] as any);

      const mockEventBus = {
        publish: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(Container.getInstance).mockReturnValue({
        getEventBus: () => mockEventBus,
      } as any);

      await service.assignAmbulanceToDispatch({
        dispatchId: 'TEST',
        patientLatitude: 48.87,
        patientLongitude: 2.36,
        priority: 'P0',
      });

      // Should have filtered by SMUR type
      expect(prisma.ambulance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: 'SMUR',
          }),
        })
      );
    });

    it('should not require SMUR for P2 priority', async () => {
      const mockAmbulances = [
        {
          id: 'amb_regular',
          type: 'AMBULANCE' as AmbulanceType,
          currentLatitude: 48.8566,
          currentLongitude: 2.3522,
          distanceKm: 2.0,
          homeHospital: {},
        },
      ];

      vi.mocked(prisma.ambulance.findMany).mockResolvedValue(mockAmbulances as any);
      vi.mocked(prisma.$transaction).mockResolvedValue([
        { id: 'amb_regular', status: 'DISPATCHED' },
        { dispatchId: 'TEST-P2', status: 'DISPATCHED' },
      ] as any);

      const mockEventBus = {
        publish: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(Container.getInstance).mockReturnValue({
        getEventBus: () => mockEventBus,
      } as any);

      await service.assignAmbulanceToDispatch({
        dispatchId: 'TEST-P2',
        patientLatitude: 48.87,
        patientLongitude: 2.36,
        priority: 'P2',
      });

      // Should NOT have filtered by type
      expect(prisma.ambulance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({
            type: expect.anything(),
          }),
        })
      );
    });
  });
});
