import '../env.js';
import { initialiseDatabase, seedDemoData } from '../db.js';

if (process.env.NODE_ENV === 'production') {
  console.error('Demo data seeding is disabled in production.');
  process.exit(1);
}

try {
  initialiseDatabase();
  seedDemoData();
  console.log('Development demo data created. Demo passwords are generated only by this explicit development command.');
} catch (error: any) {
  console.error(`Demo data was not created: ${error.message}`);
  process.exit(1);
}
