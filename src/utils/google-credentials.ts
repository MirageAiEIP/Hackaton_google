import fs from 'fs';
import path from 'path';
import { logger } from './logger';

/**
 * Auto-détecte le fichier de credentials Google Cloud dans le dossier config/
 * Cherche le premier fichier .json qui contient le project_id
 */
export function getGoogleCredentialsPath(): string | undefined {
  const configDir = path.join(process.cwd(), 'config');

  // Si le dossier config n'existe pas, retourner undefined
  if (!fs.existsSync(configDir)) {
    logger.debug('Config directory not found', { configDir });
    return undefined;
  }

  try {
    // Lister tous les fichiers .json dans config/
    const files = fs.readdirSync(configDir).filter((file) => file.endsWith('.json'));

    if (files.length === 0) {
      logger.debug('No JSON files found in config directory');
      return undefined;
    }

    // Prendre le premier fichier .json trouvé
    const credentialsFile = files[0];
    if (!credentialsFile) {
      return undefined;
    }

    const credentialsPath = path.join(configDir, credentialsFile);

    logger.info('Google credentials file detected', { credentialsFile });

    return credentialsPath;
  } catch (error) {
    logger.warn('Failed to auto-detect Google credentials file', { error });
    return undefined;
  }
}
