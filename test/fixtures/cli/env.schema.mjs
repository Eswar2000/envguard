import { e } from '../../../dist/index.js';

export default {
  PORT: e.port().default(3000),
  DATABASE_URL: e.url(),
  JWT_SECRET: e.string().min(8).secret(),
};
