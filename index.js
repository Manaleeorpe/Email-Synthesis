import path from 'node:path';
import process from 'node:process';
import fs from 'fs';
import { getAuth } from './auth.js';
import { google } from 'googleapis';

import { startSubscriber, saveLastHistoryId } from './pubsubSubscriber.js';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
];

const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');
const LAST_HISTORY_FILE = './lastHistoryId.json';

function hasHistoryCursor() {
  return fs.existsSync(LAST_HISTORY_FILE);
}

async function main() {
  const auth = await getAuth();

  const gmail = google.gmail({ version: 'v1', auth });

  // ✅ Create watch ONLY once
  if (!hasHistoryCursor()) {
    console.log('🆕 Creating Gmail watch...');

    const watchRes = await gmail.users.watch({
      userId: 'me',
      requestBody: {
        topicName: 'projects/go-chatbot-461805/topics/gmail-events',
        labelIds: ['INBOX'],
      },
    });

    console.log('✅ Watch created:', watchRes.data);
    await saveLastHistoryId(watchRes.data.historyId);
  } else {
    console.log('♻️ Existing history cursor found. Reusing watch.');
  }

  // Always start subscriber
  await startSubscriber(auth);
}

await main();
