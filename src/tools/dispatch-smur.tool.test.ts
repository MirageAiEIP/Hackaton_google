import { describe, it, expect, beforeEach, vi } from 'vitest';
import { dispatchSMURTool } from './dispatch-smur.tool';
import { dispatchService } from '@/services/dispatch.service';
import { ambulanceTrackingService } from '@/services/ambulance-tracking.service';
import { TwilioElevenLabsProxyService } from '@/services/twilio-elevenlabs-proxy.service';

// Mock logger
vi.mock('@/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock services
vi.mock('@/services/dispatch.service', () => ({
  dispatchService: {
    createDispatch: vi.fn(),
  },
}));

vi.mock('@/services/ambulance-tracking.service', () => ({
  ambulanceTrackingService: {
    assignAmbulanceToDispatch: vi.fn(),
  },
}));

vi.mock('@/services/twilio-elevenlabs-proxy.service', () => ({
  TwilioElevenLabsProxyService: {
    getCallIdFromConversation: vi.fn(),
  },
}));

describe('dispatchSMURTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('tool definition', () => {
    it('should have correct description', () => {
      expect(dispatchSMURTool.description).toContain('Dispatche les secours SMUR');
      expect(dispatchSMURTool.description).toContain('P0');
      expect(dispatchSMURTool.description).toContain('P1');
    });

    it('should have required parameters defined', () => {
      const params = dispatchSMURTool.parameters.shape;

      expect(params.priority).toBeDefined();
      expect(params.location).toBeDefined();
      expect(params.symptoms).toBeDefined();
      expect(params.conversation_id).toBeDefined();
      expect(params.latitude).toBeDefined();
      expect(params.longitude).toBeDefined();
    });
  });

  describe('execute', () => {
    it('should dispatch SMUR for P0 priority with ambulance assignment', async () => {
      const mockDispatch = {
        dispatch: {
          id: 'dispatch_123',
          dispatchId: 'SMUR-1234567890',
          priority: 'P0',
          location: '15 rue Victor Hugo, Lyon',
          symptoms: 'Arrêt cardiaque',
          status: 'PENDING',
        },
        callId: 'call_123',
      };

      const mockAssignment = {
        ambulance: {
          id: 'amb_123',
          vehicleId: 'SMUR-75-001',
          callSign: 'Alpha 1',
        },
        estimatedArrivalMinutes: 8,
      };

      vi.mocked(TwilioElevenLabsProxyService.getCallIdFromConversation).mockReturnValue('call_123');
      vi.mocked(dispatchService.createDispatch).mockResolvedValue(mockDispatch as any);
      vi.mocked(ambulanceTrackingService.assignAmbulanceToDispatch).mockResolvedValue(
        mockAssignment as any
      );

      const result = await dispatchSMURTool.execute({
        conversation_id: 'conv_123',
        priority: 'P0',
        location: '15 rue Victor Hugo, Lyon',
        symptoms: 'Arrêt cardiaque',
        latitude: 45.764,
        longitude: 4.8357,
      });

      expect(result.success).toBe(true);
      expect(result.dispatchId).toBe('SMUR-1234567890');
      expect(result.callId).toBe('call_123');
      expect(result.eta).toBe('8 minutes');
      expect(result.message).toContain('secours SMUR sont en route');
      expect(result.message).toContain('Alpha 1');
      expect(result.message).toContain('SMUR-75-001');
    });

    it('should dispatch SMUR for P1 priority without coordinates', async () => {
      const mockDispatch = {
        dispatch: {
          id: 'dispatch_456',
          dispatchId: 'SMUR-9876543210',
          priority: 'P1',
          location: '23 avenue des Champs-Élysées, Paris',
          symptoms: 'AVC suspecté',
          status: 'PENDING',
        },
        callId: 'call_456',
      };

      vi.mocked(dispatchService.createDispatch).mockResolvedValue(mockDispatch as any);

      const result = await dispatchSMURTool.execute({
        priority: 'P1',
        location: '23 avenue des Champs-Élysées, Paris',
        symptoms: 'AVC suspecté',
      });

      expect(result.success).toBe(true);
      expect(result.dispatchId).toBe('SMUR-9876543210');
      expect(result.eta).toBe('10-20 minutes'); // Default ETA for P1
      expect(result.message).toContain('secours SMUR sont en route');
      expect(ambulanceTrackingService.assignAmbulanceToDispatch).not.toHaveBeenCalled();
    });

    it('should use default ETA for P0 when no coordinates provided', async () => {
      const mockDispatch = {
        dispatch: {
          id: 'dispatch_789',
          dispatchId: 'SMUR-1111111111',
          priority: 'P0',
          location: 'Emergency location',
          symptoms: 'Critical condition',
          status: 'PENDING',
        },
        callId: 'call_789',
      };

      vi.mocked(dispatchService.createDispatch).mockResolvedValue(mockDispatch as any);

      const result = await dispatchSMURTool.execute({
        priority: 'P0',
        location: 'Emergency location',
        symptoms: 'Critical condition',
      });

      expect(result.success).toBe(true);
      expect(result.eta).toBe('5-10 minutes'); // Default ETA for P0
    });

    it('should handle ambulance assignment failure gracefully', async () => {
      const mockDispatch = {
        dispatch: {
          id: 'dispatch_123',
          dispatchId: 'SMUR-1234567890',
          priority: 'P0',
          location: '15 rue Victor Hugo, Lyon',
          symptoms: 'Arrêt cardiaque',
          status: 'PENDING',
        },
        callId: 'call_123',
      };

      vi.mocked(dispatchService.createDispatch).mockResolvedValue(mockDispatch as any);
      vi.mocked(ambulanceTrackingService.assignAmbulanceToDispatch).mockRejectedValue(
        new Error('No ambulances available')
      );

      const result = await dispatchSMURTool.execute({
        priority: 'P0',
        location: '15 rue Victor Hugo, Lyon',
        symptoms: 'Arrêt cardiaque',
        latitude: 45.764,
        longitude: 4.8357,
      });

      expect(result.success).toBe(true);
      expect(result.eta).toBe('5-10 minutes'); // Fallback to default ETA
      expect(result.message).not.toContain('ambulance'); // No ambulance info
    });

    it('should resolve callId from conversationId', async () => {
      const mockDispatch = {
        dispatch: {
          id: 'dispatch_123',
          dispatchId: 'SMUR-1234567890',
          priority: 'P0',
          location: 'Test location',
          symptoms: 'Test symptoms',
          status: 'PENDING',
        },
        callId: 'resolved_call_123',
      };

      vi.mocked(TwilioElevenLabsProxyService.getCallIdFromConversation).mockReturnValue(
        'resolved_call_123'
      );
      vi.mocked(dispatchService.createDispatch).mockResolvedValue(mockDispatch as any);

      await dispatchSMURTool.execute({
        conversation_id: 'conv_456',
        priority: 'P0',
        location: 'Test location',
        symptoms: 'Test symptoms',
      });

      expect(TwilioElevenLabsProxyService.getCallIdFromConversation).toHaveBeenCalledWith(
        'conv_456'
      );
      expect(dispatchService.createDispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          callId: 'resolved_call_123',
        })
      );
    });

    it('should throw error when dispatch creation fails', async () => {
      vi.mocked(dispatchService.createDispatch).mockRejectedValue(new Error('Database error'));

      await expect(
        dispatchSMURTool.execute({
          priority: 'P0',
          location: 'Test location',
          symptoms: 'Test symptoms',
        })
      ).rejects.toThrow('Impossible de dispatcher le SMUR');
    });

    it('should pass all parameters to dispatch service', async () => {
      const mockDispatch = {
        dispatch: {
          id: 'dispatch_123',
          dispatchId: 'SMUR-1234567890',
          priority: 'P0',
          location: '15 rue Victor Hugo, Lyon',
          symptoms: 'Arrêt cardiaque',
          status: 'PENDING',
        },
        callId: 'call_123',
      };

      vi.mocked(dispatchService.createDispatch).mockResolvedValue(mockDispatch as any);

      await dispatchSMURTool.execute({
        priority: 'P0',
        location: '15 rue Victor Hugo, Lyon',
        symptoms: 'Arrêt cardiaque',
        latitude: 45.764,
        longitude: 4.8357,
      });

      expect(dispatchService.createDispatch).toHaveBeenCalledWith({
        priority: 'P0',
        location: '15 rue Victor Hugo, Lyon',
        symptoms: 'Arrêt cardiaque',
        callId: undefined,
        latitude: 45.764,
        longitude: 4.8357,
      });
    });

    it('should pass dispatch details to ambulance assignment', async () => {
      const mockDispatch = {
        dispatch: {
          id: 'dispatch_123',
          dispatchId: 'SMUR-1234567890',
          priority: 'P1',
          location: 'Test location',
          symptoms: 'Test symptoms',
          status: 'PENDING',
        },
        callId: 'call_123',
      };

      const mockAssignment = {
        ambulance: {
          id: 'amb_123',
          vehicleId: 'SMUR-75-001',
          callSign: 'Alpha 1',
        },
        estimatedArrivalMinutes: 15,
      };

      vi.mocked(dispatchService.createDispatch).mockResolvedValue(mockDispatch as any);
      vi.mocked(ambulanceTrackingService.assignAmbulanceToDispatch).mockResolvedValue(
        mockAssignment as any
      );

      await dispatchSMURTool.execute({
        priority: 'P1',
        location: 'Test location',
        symptoms: 'Test symptoms',
        latitude: 48.8566,
        longitude: 2.3522,
      });

      expect(ambulanceTrackingService.assignAmbulanceToDispatch).toHaveBeenCalledWith({
        dispatchId: 'SMUR-1234567890',
        patientLatitude: 48.8566,
        patientLongitude: 2.3522,
        priority: 'P1',
      });
    });
  });
});
