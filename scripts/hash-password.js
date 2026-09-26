import crypto from 'node:crypto';
import readline from 'node:readline';

const prompt = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
prompt.question('Enter the owner password (input is visible in this terminal): ', (password) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  console.log(`OWNER_PASSWORD_HASH=${salt}$${hash}`);
  prompt.close();
});
