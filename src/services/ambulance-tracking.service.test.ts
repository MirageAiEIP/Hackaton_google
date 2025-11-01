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

    it('should throw error if database query fails', async () => {
      vi.mocked(prisma.ambulance.findMany).mockRejectedValue(new Error('DB error'));

      await expect(service.getAllActiveAmbulances()).rejects.toThrow(
        'Failed to get active ambulances'
      );
    });
  });
});
