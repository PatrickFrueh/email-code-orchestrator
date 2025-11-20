import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { extractLinks, extractCodes, filterCodeLinks, fetchCodeFromLink } from './extractor.js';
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
      // console.log('Found message:', msg.envelope?.subject);

      // Skip if no source data
      if (!msg.source) {
        console.log('No source data, skipping...');
        continue;
      }

      // Parse the raw email source
      const parsed = await simpleParser(msg.source);
      
      console.log(`\n📧 Processing: ${msg.envelope?.subject}`);
      
      // Strategy 1: Try to find codes directly in email
      const directCodes = extractCodes(parsed.text || '');
      
      if (directCodes.length > 0) {
        console.log(`✅ Code found in email: ${directCodes.join(', ')}`);
        continue; // Skip to next email
      }
      
      // Strategy 2: No direct code, look for "code request" links
      const allLinks = extractLinks(parsed.html || '');
      const codeLinks = filterCodeLinks(allLinks);
      
      if (codeLinks.length > 0) {
        console.log(`🔗 No direct code. Found ${codeLinks.length} verification link(s)`);
        console.log('HTML body:', parsed.html);
        // Try each code link until we find a code
        for (const link of codeLinks) {
          console.log(`   Fetching: ${link}`);
          const code = await fetchCodeFromLink(link);
          
          if (code) {
            console.log(`✅ Code extracted from link: ${code}`);
            break; // Stop after first success
          } else {
            console.log(`   ⚠️  No code found at this link`);
          }
        }
      } else {
        console.log(`ℹ️  No codes or verification links found`);
      }
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