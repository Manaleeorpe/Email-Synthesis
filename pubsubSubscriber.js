// pubsubSubscriber.js

import { PubSub } from '@google-cloud/pubsub';
import { google } from 'googleapis';
import fs from 'fs';
import callAPI from './callLLM.js';

const PROJECT_ID = 'go-chatbot-461805';
const SUBSCRIPTION_NAME = 'gmail-events-subscription';

const LAST_HISTORY_FILE = './lastHistoryId.json';
const PROCESSED_THREADS_FILE = './processedThreads.json';

// -------------------- GLOBAL --------------------

// -------------------- STATE HELPERS --------------------

function getLastHistoryId() {
  if (!fs.existsSync(LAST_HISTORY_FILE)) return null;
  return String(JSON.parse(fs.readFileSync(LAST_HISTORY_FILE)).historyId);
}

function saveLastHistoryId(historyId) {
  console.log('🧭 Saving historyId:', historyId);
  fs.writeFileSync(
    LAST_HISTORY_FILE,
    JSON.stringify({ historyId: String(historyId) })
  );
}

function getProcessedThreads() {
  if (!fs.existsSync(PROCESSED_THREADS_FILE)) return new Set();
  return new Set(JSON.parse(fs.readFileSync(PROCESSED_THREADS_FILE)));
}

function saveProcessedThreads(set) {
  fs.writeFileSync(PROCESSED_THREADS_FILE, JSON.stringify([...set]));
}

// -------------------- GMAIL HELPERS --------------------

function getHeader(headers, name) {
  return headers.find(h => h.name === name)?.value;
}

function extractEmail(header) {
  if (!header) return null;
  const match = header.match(/<(.+?)>/);
  return match ? match[1] : header;
}

function decodeBase64(data) {
  return Buffer.from(
    data.replace(/-/g, '+').replace(/_/g, '/'),
    'base64'
  ).toString('utf-8');
}

function getBody(payload) {
  if (payload.body?.data) return decodeBase64(payload.body.data);
  if (!payload.parts) return '';

  for (const part of payload.parts) {
    if (part.mimeType === 'text/plain' && part.body?.data) {
      return decodeBase64(part.body.data);
    }
    if (part.parts) {
      for (const sub of part.parts) {
        if (sub.mimeType === 'text/plain' && sub.body?.data) {
          return decodeBase64(sub.body.data);
        }
      }
    }
  }
  return '';
}

// -------------------- MAIL SENDER --------------------

async function sendMail(gmail, to, subject, message) {
  const raw = [
    `To: ${to}`,
    'Content-Type: text/plain; charset=utf-8',
    'MIME-Version: 1.0',
    `Subject: ${subject}`,
    '',
    message,
  ];

  const encoded = Buffer.from(raw.join('\n'))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: encoded },
  });

  console.log('📤 Summary email sent');
}

// -------------------- SUBSCRIBER --------------------

async function startSubscriber(auth) {
  console.log('AUTH CREDS IN SUBSCRIBER:', auth.credentials);



    const pubsub = new PubSub({
    projectId: PROJECT_ID,
    keyFilename: 'pubsub-key.json',
  });

  const subscription = pubsub.subscription(SUBSCRIPTION_NAME);

  const processedThreads = getProcessedThreads();

  console.log('📡 Listening for Gmail events...');

  subscription.on('message', async (message) => {
    const gmail = google.gmail({
      version: 'v1',
      auth,
    });
    let newHistoryId;

    try {
      const data = JSON.parse(
        Buffer.from(message.data, 'base64').toString()
      );

      newHistoryId = String(data.historyId);
      const lastHistoryId = getLastHistoryId();

      console.log('📨 Pub/Sub historyId:', newHistoryId);

      // 1️⃣ FIRST EVENT → initialize cursor
      if (!lastHistoryId) {
        console.log('🆕 Initializing history cursor');
        saveLastHistoryId(newHistoryId);
        message.ack();
        return;
      }

      // 2️⃣ Ignore stale / out-of-order notifications
      if (BigInt(newHistoryId) <= BigInt(lastHistoryId)) {
        console.log(
          '⏭ Ignoring stale historyId:',
          newHistoryId,
          '(current:',
          lastHistoryId,
          ')'
        );
        message.ack();
        return;
      }

      // 3️⃣ Fetch history safely
      let historyRes;
      try {
        historyRes = await gmail.users.history.list({
          userId: 'me',
          startHistoryId: lastHistoryId,
          historyTypes: ['messageAdded'],
        });
      } catch (err) {
        if (err.code === 404) {
          console.warn('⚠️ Cursor invalid. Resetting.');
          saveLastHistoryId(newHistoryId);
          message.ack();
          return;
        }
        throw err;
      }

      const histories = historyRes.data.history || [];
      console.log(`📚 Found ${histories.length} history record(s)`);

      for (const h of histories) {
        for (const m of h.messagesAdded || []) {
          const msgId = m.message.id;

          const full = await gmail.users.messages.get({
            userId: 'me',
            id: msgId,
            format: 'full',
          });

          const threadId = full.data.threadId;

          // Thread idempotency
          if (processedThreads.has(threadId)) continue;

          const payload = full.data.payload;
          const subject =
            getHeader(payload.headers, 'Subject') || '(No Subject)';
          const fromEmail = extractEmail(
            getHeader(payload.headers, 'From')
          );

          // Skip self-sent mails
          if (fromEmail === 'manaleeorpe@gmail.com') continue;

          const body = getBody(payload);
          if (!body.trim()) continue;

          const summary = await callAPI(body, fromEmail);
          console.log(body)

          await sendMail(
          gmail,
          'manaleeorpe@gmail.com',
          `Summary: ${subject}`,
          summary
        );

          processedThreads.add(threadId);
          saveProcessedThreads(processedThreads);
        }
      }

      // ✅ Advance cursor ONLY after success
      saveLastHistoryId(newHistoryId);

    } catch (err) {
      console.error('❌ Subscriber error:', err);
    } finally {
      message.ack(); // ACK ONLY
    }
  });

  subscription.on('error', (err) => {
    console.error('❌ Subscription error:', err);
  });
}

export { startSubscriber, saveLastHistoryId };
