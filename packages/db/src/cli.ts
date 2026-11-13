import pg from 'pg';
import { migrate } from './migrate';

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL is not set (see .env.example)'); process.exit(1); }
const pool = new pg.Pool({ connectionString: url });
migrate(pool).then(a => { console.log(a.length ? `Applied: ${a.join(', ')}` : 'Up to date'); return pool.end(); })
  .catch(e => { console.error(e.message); process.exit(1); });
