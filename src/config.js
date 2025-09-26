import dotenv from 'dotenv';
dotenv.config();

const required = (key) => {
  if (!process.env[key]) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return process.env[key];
};

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 3000),
  db: {
    host: required('DB_HOST'),
    port: Number(process.env.DB_PORT || 3306),
    user: required('DB_USER'),
    password: required('DB_PASSWORD'),
    database: required('DB_NAME')
  },
  corsOrigins: (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean),
  jwtSecret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production'
};
