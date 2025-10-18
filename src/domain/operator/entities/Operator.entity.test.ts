import { describe, it, expect } from 'vitest';
import { Operator, OperatorStatus } from './Operator.entity';

describe('Operator Entity', () => {
  describe('Business Logic', () => {
    it('should create an operator with default OFFLINE status', () => {
      const operator = new Operator({
        id: 'op-1',
        email: 'operator@samu.fr',
        name: 'Jean Dupont',
        role: 'operator',
        status: OperatorStatus.OFFLINE,
        totalCallsHandled: 0,
        averageHandleTime: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(operator.status).toBe(OperatorStatus.OFFLINE);
      expect(operator.isAvailable()).toBe(false);
    });

    it('should set operator to AVAILABLE', () => {
      const operator = new Operator({
        id: 'op-1',
        email: 'operator@samu.fr',
        name: 'Jean Dupont',
        role: 'operator',
        status: OperatorStatus.OFFLINE,
        totalCallsHandled: 0,
        averageHandleTime: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      operator.setAvailable();

      expect(operator.status).toBe(OperatorStatus.AVAILABLE);
      expect(operator.isAvailable()).toBe(true);
      expect(operator.lastActiveAt).toBeDefined();
    });

    it('should set operator to BUSY when claiming a call', () => {
      const operator = new Operator({
        id: 'op-1',
        email: 'operator@samu.fr',
        name: 'Jean Dupont',
        role: 'operator',
        status: OperatorStatus.AVAILABLE,
        totalCallsHandled: 0,
        averageHandleTime: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      operator.setBusy('call-123');

      expect(operator.status).toBe(OperatorStatus.BUSY);
      expect(operator.currentCallId).toBe('call-123');
      expect(operator.isAvailable()).toBe(false);
    });

    it('should throw error when trying to set BUSY if not available', () => {
      const operator = new Operator({
        id: 'op-1',
        email: 'operator@samu.fr',
        name: 'Jean Dupont',
        role: 'operator',
        status: OperatorStatus.OFFLINE,
        totalCallsHandled: 0,
        averageHandleTime: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(() => operator.setBusy('call-123')).toThrow('Operator is not available');
    });

    it('should complete call and update statistics', () => {
      const operator = new Operator({
        id: 'op-1',
        email: 'operator@samu.fr',
        name: 'Jean Dupont',
        role: 'operator',
        status: OperatorStatus.BUSY,
        currentCallId: 'call-123',
        totalCallsHandled: 2,
        averageHandleTime: 300, // 5 minutes average
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      operator.completeCall(600); // 10 minutes

      expect(operator.status).toBe(OperatorStatus.AVAILABLE);
      expect(operator.currentCallId).toBeUndefined();
      expect(operator.totalCallsHandled).toBe(3);
      // Average: (300*2 + 600) / 3 = 400
      expect(operator.averageHandleTime).toBe(400);
      expect(operator.isAvailable()).toBe(true);
    });

    it('should throw error when completing call without active call', () => {
      const operator = new Operator({
        id: 'op-1',
        email: 'operator@samu.fr',
        name: 'Jean Dupont',
        role: 'operator',
        status: OperatorStatus.AVAILABLE,
        totalCallsHandled: 0,
        averageHandleTime: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(() => operator.completeCall(300)).toThrow('Operator has no active call');
    });

    it('should set operator to OFFLINE', () => {
      const operator = new Operator({
        id: 'op-1',
        email: 'operator@samu.fr',
        name: 'Jean Dupont',
        role: 'operator',
        status: OperatorStatus.AVAILABLE,
        currentCallId: 'call-123',
        totalCallsHandled: 0,
        averageHandleTime: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      operator.setOffline();

      expect(operator.status).toBe(OperatorStatus.OFFLINE);
      expect(operator.currentCallId).toBeUndefined();
      expect(operator.isAvailable()).toBe(false);
    });

    it('should return false for isAvailable when operator has current call', () => {
      const operator = new Operator({
        id: 'op-1',
        email: 'operator@samu.fr',
        name: 'Jean Dupont',
        role: 'operator',
        status: OperatorStatus.AVAILABLE,
        currentCallId: 'call-123', // Has active call
        totalCallsHandled: 0,
        averageHandleTime: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(operator.isAvailable()).toBe(false);
    });
  });

  describe('Data Mapping', () => {
    it('should convert to plain object', () => {
      const props = {
        id: 'op-1',
        email: 'operator@samu.fr',
        name: 'Jean Dupont',
        role: 'operator',
        status: OperatorStatus.AVAILABLE,
        totalCallsHandled: 5,
        averageHandleTime: 420,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const operator = new Operator(props);
      const obj = operator.toObject();

      expect(obj).toEqual(props);
    });
  });
});
