import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export interface AppConfig {
  nodeEnv: string;
  port: number;
  databaseUrl?: string;
  jwtAccessSecret: string;
  jwtRefreshSecret: string;
  corsAllowedOrigins: string[];
  fcmServerKey?: string;
  storageBucket?: string;
  storageProvider: 's3' | 'local';
  isProduction: boolean;
}

export function loadConfig(): AppConfig {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';

  const jwtAccessSecret = process.env.JWT_ACCESS_SECRET || (isProduction ? '' : 'dev_jwt_access_secret_caresync_2026_super_secure');
  const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || (isProduction ? '' : 'dev_jwt_refresh_secret_caresync_2026_super_secure');
  const databaseUrl = process.env.DATABASE_URL;

  // FAIL FAST IN PRODUCTION
  if (isProduction) {
    const missing: string[] = [];
    if (!databaseUrl) missing.push('DATABASE_URL');
    if (!jwtAccessSecret || jwtAccessSecret.includes('dev_')) missing.push('JWT_ACCESS_SECRET');
    if (!jwtRefreshSecret || jwtRefreshSecret.includes('dev_')) missing.push('JWT_REFRESH_SECRET');

    if (missing.length > 0) {
      console.error('❌ [FATAL CONFIG ERROR] Missing required production environment variables:');
      missing.forEach((v) => console.error(`   - ${v}`));
      console.error('CareSync will not start with incomplete production configuration. Exiting immediately.');
      process.exit(1);
    }
  }

  const rawCorsOrigins = process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:5173,capacitor://localhost,http://localhost';
  const corsAllowedOrigins = rawCorsOrigins.split(',').map((o) => o.trim()).filter(Boolean);

  return {
    nodeEnv,
    port: Number(process.env.PORT) || 3000,
    databaseUrl,
    jwtAccessSecret,
    jwtRefreshSecret,
    corsAllowedOrigins,
    fcmServerKey: process.env.FCM_SERVER_KEY,
    storageBucket: process.env.STORAGE_BUCKET,
    storageProvider: (process.env.STORAGE_PROVIDER as 's3' | 'local') || 'local',
    isProduction,
  };
}

export const config = loadConfig();
