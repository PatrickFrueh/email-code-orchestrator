import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import 'dotenv/config';

async function fetchEmails() {
  const client = new ImapFlow({
    host: process.env.IMAP_HOST || 'imap.gmail.com',
    port: Number(process.env.IMAP_PORT) || 993,
    secure: true,
    auth: {
      user: process.env.IMAP_USER!,
      pass: process.env.IMAP_PASS!
    }
  });

  // Connect to the server
  await client.connect();
  console.log('Connected to IMAP server');

  // Open INBOX
  const lock = await client.getMailboxLock('INBOX');
  
  try {
    // Search for unseen messages
    const messages = client.fetch({ seen: false }, { envelope: true, source: true });
    
    for await (let msg of messages) {
    //   console.log('Found message:', msg.envelope?.subject);

      // Parse the raw email source
      const parsed = await simpleParser(msg.source);
      
      // Display structured content
      console.log('HTML body:', parsed.html);
      console.log('Text body:', parsed.text);
    }
  } finally {
    lock.release();
  }

  await client.logout();
}

fetchEmails().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});