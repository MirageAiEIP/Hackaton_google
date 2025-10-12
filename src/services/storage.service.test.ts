import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StorageService } from './storage.service';
import { Storage } from '@google-cloud/storage';
import fs from 'fs';

// Mock Google Cloud Storage
vi.mock('@google-cloud/storage');

// Mock filesystem
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    writeFileSync: vi.fn(),
    unlinkSync: vi.fn(),
    mkdirSync: vi.fn(),
    readFileSync: vi.fn(),
  },
  existsSync: vi.fn(),
  writeFileSync: vi.fn(),
  unlinkSync: vi.fn(),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn(),
}));

describe('StorageService', () => {
  let storageService: StorageService;
  const mockBucket = {
    exists: vi.fn(),
    file: vi.fn(),
    addLifecycleRule: vi.fn(),
  };
  const mockFile = {
    save: vi.fn(),
    download: vi.fn(),
    delete: vi.fn(),
    getSignedUrl: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock Storage constructor
    vi.mocked(Storage).mockImplementation(() => ({
      bucket: vi.fn(() => mockBucket as any),
      createBucket: vi.fn(),
    })) as any;

    mockBucket.file.mockReturnValue(mockFile);
    mockBucket.exists.mockResolvedValue([true]);

    storageService = new StorageService();
  });

  describe('uploadAudio - Local Fallback', () => {
    it('should save audio locally when GCS is disabled', async () => {
      const audioBuffer = Buffer.from('test audio data');
      const callId = 'call-123';
      const filename = 'test.wav';

      // Force GCS upload to fail, triggering local fallback
      mockFile.save.mockRejectedValue(new Error('GCS disabled'));
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const result = await storageService.uploadAudio(audioBuffer, callId, filename);

      expect(result).toContain('temp-audio');
      expect(result).toContain(callId);
      expect(fs.mkdirSync).toHaveBeenCalled();
      expect(fs.writeFileSync).toHaveBeenCalledWith(expect.any(String), audioBuffer);
    });

    it('should cleanup local file after TTL', async () => {
      vi.useFakeTimers();

      const audioBuffer = Buffer.from('test audio data');
      const callId = 'call-123';
      const filename = 'test.wav';

      // Force GCS upload to fail, triggering local fallback
      mockFile.save.mockRejectedValue(new Error('GCS disabled'));
      vi.mocked(fs.existsSync).mockReturnValue(false);

      await storageService.uploadAudio(audioBuffer, callId, filename);

      // Fast-forward 1 hour
      vi.advanceTimersByTime(3600000);

      expect(fs.unlinkSync).toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe('downloadAudio', () => {
    it('should download from local storage if file exists', async () => {
      const localPath = '/temp-audio/test.wav';
      const mockBuffer = Buffer.from('audio data');

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(mockBuffer);

      const result = await storageService.downloadAudio(localPath);

      expect(result).toBe(mockBuffer);
      expect(fs.readFileSync).toHaveBeenCalledWith(localPath);
    });

    it('should throw error if local file not found', async () => {
      const localPath = '/temp-audio/nonexistent.wav';

      vi.mocked(fs.existsSync).mockReturnValue(false);

      await expect(storageService.downloadAudio(localPath)).rejects.toThrow('Audio file not found');
    });

    it('should throw error for invalid GCS URI (missing bucket)', async () => {
      const invalidUri = 'gs:///file.wav'; // No bucket name

      await expect(storageService.downloadAudio(invalidUri)).rejects.toThrow(
        'Invalid GCS URI: missing bucket name'
      );
    });
  });

  describe('deleteAudio', () => {
    it('should delete local file if it exists', async () => {
      const localPath = '/temp-audio/test.wav';

      vi.mocked(fs.existsSync).mockReturnValue(true);

      await storageService.deleteAudio(localPath);

      expect(fs.unlinkSync).toHaveBeenCalledWith(localPath);
    });

    it('should throw error for invalid GCS URI in delete', async () => {
      const invalidUri = 'gs:///file.wav';

      await expect(storageService.deleteAudio(invalidUri)).rejects.toThrow(
        'Invalid GCS URI: missing bucket name'
      );
    });
  });

  describe('getSignedUrl', () => {
    it('should throw error for non-GCS URLs', async () => {
      const localPath = '/temp-audio/test.wav';

      await expect(storageService.getSignedUrl(localPath)).rejects.toThrow(
        'Signed URLs only available for GCS files'
      );
    });

    it('should throw error for invalid GCS URI', async () => {
      const invalidUri = 'gs:///file.wav';

      await expect(storageService.getSignedUrl(invalidUri)).rejects.toThrow(
        'Invalid GCS URI: missing bucket name'
      );
    });
  });

  describe('URI Parsing', () => {
    it('should correctly parse GCS URI', async () => {
      const gcsUri = 'gs://my-bucket/folder/file.wav';
      const mockBuffer = Buffer.from('audio data');

      mockFile.download.mockResolvedValue([mockBuffer]);

      const result = await storageService.downloadAudio(gcsUri);

      expect(result).toBe(mockBuffer);
      expect(mockFile.download).toHaveBeenCalled();
    });

    it('should handle GCS URI with nested paths', async () => {
      const gcsUri = 'gs://my-bucket/path/to/deep/folder/file.wav';
      const mockBuffer = Buffer.from('audio data');

      mockFile.download.mockResolvedValue([mockBuffer]);

      const result = await storageService.downloadAudio(gcsUri);

      expect(result).toBe(mockBuffer);
    });
  });

  describe('Error Handling', () => {
    it('should handle GCS initialization failure gracefully', () => {
      vi.mocked(Storage).mockImplementation(() => {
        throw new Error('GCS init failed');
      }) as any;

      // Should not throw, just log and fallback to local
      expect(() => new StorageService()).not.toThrow();
    });

    it('should fallback to local when GCS upload fails', async () => {
      mockFile.save.mockRejectedValue(new Error('GCS upload failed'));

      const audioBuffer = Buffer.from('test audio data');
      const callId = 'call-456';
      const filename = 'test.wav';

      vi.mocked(fs.existsSync).mockReturnValue(false);

      const result = await storageService.uploadAudio(audioBuffer, callId, filename);

      // Should return local path
      expect(result).toContain('temp-audio');
      expect(fs.writeFileSync).toHaveBeenCalled();
    });
  });
});
