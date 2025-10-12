import { Storage } from '@google-cloud/storage';
import { logger } from '@/utils/logger';
import fs from 'fs';
import path from 'path';

/**
 * Service de stockage des fichiers audio sur Google Cloud Storage
 *
 * Features:
 * - Upload/download audio files
 * - TTL automatique (1 heure par défaut)
 * - Fallback sur stockage local si GCS échoue
 */
export class StorageService {
  private storage!: Storage;
  private bucketName = 'samu-ai-audio-files'; // À adapter
  private useGCS = true; // Toggle pour dev/prod

  constructor() {
    try {
      // Résoudre le chemin absolu pour GOOGLE_APPLICATION_CREDENTIALS
      const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      let keyFilename: string | undefined;

      if (credentialsPath) {
        // Résoudre le chemin relatif si nécessaire
        keyFilename = path.isAbsolute(credentialsPath)
          ? credentialsPath
          : path.resolve(process.cwd(), credentialsPath);

        logger.info('Using GCS credentials', { keyFilename });
      }

      this.storage = new Storage({
        keyFilename, // Utilise le chemin résolu
      });

      logger.info('GCS client initialized successfully', { bucketName: this.bucketName });

      // Note: On ne vérifie pas l'existence du bucket ici pour éviter d'avoir besoin de storage.buckets.get
      // Le bucket sera vérifié lors du premier upload
    } catch (error) {
      logger.error('Failed to initialize GCS client', error as Error);
      this.useGCS = false;
    }
  }

  /**
   * Upload un fichier audio vers GCS ou local
   *
   * @param audioBuffer - Buffer du fichier audio
   * @param callId - ID de l'appel
   * @param originalFilename - Nom original du fichier
   * @returns URL du fichier (gs:// pour GCS, file:// pour local)
   */
  async uploadAudio(
    audioBuffer: Buffer,
    callId: string,
    originalFilename: string
  ): Promise<string> {
    const timestamp = Date.now();
    const extension = path.extname(originalFilename);
    const filename = `${callId}_${timestamp}${extension}`;

    // Mode GCS
    if (this.useGCS) {
      try {
        const bucket = this.storage.bucket(this.bucketName);
        const file = bucket.file(filename);

        await file.save(audioBuffer, {
          metadata: {
            contentType: 'audio/wav',
            metadata: {
              callId,
              uploadedAt: new Date().toISOString(),
              // Expiration dans 1h
              expiresAt: new Date(Date.now() + 3600000).toISOString(),
            },
          },
        });

        const gsUri = `gs://${this.bucketName}/${filename}`;

        logger.info('Audio uploaded to GCS', {
          callId,
          gsUri,
          fileSize: audioBuffer.length,
        });

        return gsUri;
      } catch (error) {
        logger.error('Failed to upload to GCS, falling back to local', error as Error, {
          callId,
        });
        // Fallback vers local
        return this.saveLocal(audioBuffer, filename, callId);
      }
    }

    // Mode Local (fallback)
    return this.saveLocal(audioBuffer, filename, callId);
  }

  /**
   * Sauvegarde locale (fallback)
   */
  private saveLocal(audioBuffer: Buffer, filename: string, callId: string): string {
    const tempDir = path.join(process.cwd(), 'temp-audio');

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const localPath = path.join(tempDir, filename);
    fs.writeFileSync(localPath, audioBuffer);

    // Cleanup après 1h
    setTimeout(() => {
      try {
        fs.unlinkSync(localPath);
        logger.info('Temporary audio file cleaned up', { localPath });
      } catch (error) {
        logger.warn('Failed to cleanup temporary file', { localPath, error });
      }
    }, 3600000); // 1h

    logger.info('Audio saved locally', {
      callId,
      localPath,
      fileSize: audioBuffer.length,
    });

    return localPath;
  }

  /**
   * Download un fichier depuis GCS ou local
   *
   * @param audioUrl - URL du fichier (gs:// ou file path)
   * @returns Buffer du fichier
   */
  async downloadAudio(audioUrl: string): Promise<Buffer> {
    // Si c'est une GCS URI
    if (audioUrl.startsWith('gs://')) {
      try {
        const uri = audioUrl.replace('gs://', '');
        const [bucketName, ...filePathParts] = uri.split('/');
        const filePath = filePathParts.join('/');

        if (!bucketName) {
          throw new Error('Invalid GCS URI: missing bucket name');
        }

        const bucket = this.storage.bucket(bucketName);
        const file = bucket.file(filePath);

        const [buffer] = await file.download();

        logger.info('Audio downloaded from GCS', {
          audioUrl,
          fileSize: buffer.length,
        });

        return buffer;
      } catch (error) {
        logger.error('Failed to download from GCS', error as Error, { audioUrl });
        throw error;
      }
    }

    // Si c'est un fichier local
    if (fs.existsSync(audioUrl)) {
      const buffer = fs.readFileSync(audioUrl);
      logger.info('Audio loaded from local storage', {
        audioUrl,
        fileSize: buffer.length,
      });
      return buffer;
    }

    throw new Error(`Audio file not found: ${audioUrl}`);
  }

  /**
   * Supprime un fichier (manuel)
   */
  async deleteAudio(audioUrl: string): Promise<void> {
    if (audioUrl.startsWith('gs://')) {
      const uri = audioUrl.replace('gs://', '');
      const [bucketName, ...filePathParts] = uri.split('/');
      const filePath = filePathParts.join('/');

      if (!bucketName) {
        throw new Error('Invalid GCS URI: missing bucket name');
      }

      const bucket = this.storage.bucket(bucketName);
      const file = bucket.file(filePath);

      await file.delete();

      logger.info('Audio deleted from GCS', { audioUrl });
    } else if (fs.existsSync(audioUrl)) {
      fs.unlinkSync(audioUrl);
      logger.info('Audio deleted from local storage', { audioUrl });
    }
  }

  /**
   * Génère une URL signée (pour download sécurisé)
   * Valide 15 minutes
   */
  async getSignedUrl(audioUrl: string): Promise<string> {
    if (!audioUrl.startsWith('gs://')) {
      throw new Error('Signed URLs only available for GCS files');
    }

    const uri = audioUrl.replace('gs://', '');
    const [bucketName, ...filePathParts] = uri.split('/');
    const filePath = filePathParts.join('/');

    if (!bucketName) {
      throw new Error('Invalid GCS URI: missing bucket name');
    }

    const bucket = this.storage.bucket(bucketName);
    const file = bucket.file(filePath);

    const [signedUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
    });

    return signedUrl;
  }
}

export const storageService = new StorageService();
