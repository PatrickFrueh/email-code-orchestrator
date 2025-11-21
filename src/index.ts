import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { extractLinks, extractCodes, filterCodeLinks, fetchCodeFromLink } from './extractor.js';
import { confirmNetflixHousehold, extractHouseholdActionLink } from './browser-automation.js';
import { sendCodeNotification, sendHouseholdNotification, sendErrorNotification } from './messaging/telegram.js';
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
    // Track processed message UIDs to mark as seen later
    const processedUIDs: number[] = [];
    
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
      
      const subject = msg.envelope?.subject || '';
      const emailText = parsed.text || '';
      const emailHtml = parsed.html || '';
      
      // Detect email type by subject/content
      const isHouseholdUpdate = subject.includes('Haushalt') || 
                                emailText.includes('Aktualisierung bestätigen') ||
                                emailText.includes('Ja, das war ich');
      
      if (isHouseholdUpdate) {
        console.log('🏠 Detected Netflix household update email');
        
        // Extract the action link
        const actionLink = extractHouseholdActionLink(emailHtml);
        
        if (!actionLink) {
          console.log('   ⚠️  Could not find household action link');
          continue;
        }
        
        console.log('   🔗 Found action link:', actionLink);
        
        // Check if Netflix credentials are configured
        const netflixEmail = process.env.NETFLIX_EMAIL;
        const netflixPassword = process.env.NETFLIX_PASSWORD;
        
        if (!netflixEmail || !netflixPassword) {
          console.log('   ⚠️  Netflix credentials not configured in .env');
          console.log('   💡 Add NETFLIX_EMAIL and NETFLIX_PASSWORD to .env to enable automation');
          console.log('   🔗 Manual action required: Open this link to confirm:');
          console.log('      ', actionLink);
          continue;
        }
        
        // Perform browser automation
        console.log('   🤖 Starting browser automation...');
        
        const success = await confirmNetflixHousehold(actionLink, {
          email: netflixEmail,
          password: netflixPassword,
        });
        
        if (success) {
          console.log('   ✅ Household update completed successfully!');
          await sendHouseholdNotification(true, netflixEmail);
        } else {
          console.log('   ❌ Automation failed - manual intervention may be required');
          console.log('   🔗 Try manually: ', actionLink);
          await sendHouseholdNotification(false, netflixEmail, 'Automation failed - manual intervention required');
        }
        
        // Track for marking as seen later
        processedUIDs.push(msg.uid);
        
        continue; // Move to next email
      }
      
      // Strategy 1: Try to find codes directly in email
      const directCodes = extractCodes(emailText);
      
      if (directCodes.length > 0) {
        console.log(`✅ Code found in email: ${directCodes.join(', ')}`);
        await sendCodeNotification(
          directCodes[0],
          subject,
          msg.envelope?.from?.[0]?.address || 'Unknown sender'
        );
        
        // Track for marking as seen later
        processedUIDs.push(msg.uid);
        
        continue; // Skip to next email
      }
      
      // Strategy 2: No direct code, look for "code request" links
      const allLinks = extractLinks(emailHtml);
      const codeLinks = filterCodeLinks(allLinks);
      
      if (codeLinks.length > 0) {
        console.log(`🔗 No direct code. Found ${codeLinks.length} verification link(s)`);
        // Try each code link until we find a code
        for (const link of codeLinks) {
          console.log(`   Fetching: ${link}`);
          const code = await fetchCodeFromLink(link);
          
          if (code) {
            console.log(`✅ Code extracted from link: ${code}`);
            await sendCodeNotification(
              code,
              subject,
              msg.envelope?.from?.[0]?.address || 'Unknown sender'
            );
            
            // Track for marking as seen later
            processedUIDs.push(msg.uid);
            
            break; // Stop after first success
          } else {
            console.log(`   ⚠️  No code found at this link`);
          }
        }
      } else {
        console.log(`ℹ️  No codes or verification links found`);
      }
    }
    
    // Mark all processed emails as seen (after iteration completes)
    if (processedUIDs.length > 0) {
      console.log(`\n📧 Marking ${processedUIDs.length} email(s) as read...`);
      await client.messageFlagsAdd(processedUIDs, ['\\Seen']);
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