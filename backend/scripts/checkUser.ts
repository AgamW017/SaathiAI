import 'dotenv/config';
import { loginWithEmailPassword } from '../src/services/authService.js';

async function run() {
  try {
    const res = await loginWithEmailPassword('officer1@saathi.in', undefined, 'SaathiTest@123');
    console.log('Login success:', res.user);
  } catch (err: any) {
    console.error('Login error:', err.message, err.stack);
  }
}
run();
