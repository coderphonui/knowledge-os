import 'dotenv/config';
import { createSlackApp } from './slack/app.js';
import { registerHandlers } from './slack/handlers.js';
import { initAgent } from './agent/index.js';

async function main() {
  console.log('Starting tichat...');

  await initAgent();

  const app = createSlackApp();
  registerHandlers(app);

  await app.start();
  console.log('tichat is live — listening for Slack messages');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
