import fs from 'fs';
import path from 'path';
import process from 'process';
import readline from 'readline';
import { google } from 'googleapis';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
];

const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');
const TOKEN_PATH = path.join(process.cwd(), 'token.json');

function ask(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve =>
    rl.question(query, answer => {
      rl.close();
      resolve(answer);
    })
  );
}

export async function getAuth() {
  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
  const { client_id, client_secret, redirect_uris } =
    credentials.installed || credentials.web;

  const auth = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  );

  // 🔁 Reuse saved token
  if (fs.existsSync(TOKEN_PATH)) {
    auth.setCredentials(JSON.parse(fs.readFileSync(TOKEN_PATH)));
    console.log('♻️ Using existing token.json');
    return auth;
  }

  // 🆕 First time login
  const url = auth.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });

  console.log('\n🔐 Open this URL in your browser:\n');
  console.log(url);

  const code = await ask('\n📎 Paste the code here: ');
  const { tokens } = await auth.getToken(code);

  auth.setCredentials(tokens);
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));

  console.log('💾 token.json saved');
  return auth;
}
