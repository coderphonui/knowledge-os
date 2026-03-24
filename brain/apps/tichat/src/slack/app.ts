import { App } from '@slack/bolt';

export function createSlackApp(): App {
  if (!process.env.SLACK_BOT_TOKEN) throw new Error('SLACK_BOT_TOKEN is required');
  if (!process.env.SLACK_APP_TOKEN) throw new Error('SLACK_APP_TOKEN is required');

  return new App({
    token: process.env.SLACK_BOT_TOKEN,
    appToken: process.env.SLACK_APP_TOKEN,
    socketMode: true,
  });
}
