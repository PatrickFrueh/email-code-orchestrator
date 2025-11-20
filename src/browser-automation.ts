/**
 * Browser Automation for Netflix Actions
 * 
 * This module uses Puppeteer to automate browser interactions that require:
 * - Authentication (login)
 * - Button clicks
 * - JavaScript execution
 * 
 * Use cases:
 * - Household update confirmation
 * - Travel verification
 * - Account security confirmations
 */

import puppeteer, { Browser, Page } from 'puppeteer';

interface NetflixCredentials {
  email: string;
  password: string;
}

/**
 * Confirm Netflix household update by automating browser interaction
 * 
 * Flow:
 * 1. Launch headless browser
 * 2. Navigate to confirmation link
 * 3. Handle login if required
 * 4. Find and click confirmation button
 * 5. Verify success
 * 
 * @param confirmationLink - The link from the email
 * @param credentials - Netflix login credentials
 * @returns true if successful, false otherwise
 */
export async function confirmNetflixHousehold(
  confirmationLink: string,
  credentials: NetflixCredentials
): Promise<boolean> {
  console.log('   🌐 Launching headless browser...');
  
  let browser: Browser | null = null;
  
  try {
    // Launch browser with sensible defaults
    browser = await puppeteer.launch({
      headless: true, // Set to false to see browser window for debugging
      args: [
        '--no-sandbox', // Required for Docker
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage', // Overcome limited resource problems
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
      ],
      // slowMo: 100, // Uncomment to slow down actions for debugging
    });
    
    const page = await browser.newPage();
    
    // Set realistic viewport (pretend to be desktop browser)
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Set user agent to avoid bot detection
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    
    console.log('   🔗 Navigating to confirmation link...');
    
    // Decode HTML entities in URL (&amp; -> &)
    const decodedLink = confirmationLink
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"');
    
    console.log(`   🔗 Decoded link: ${decodedLink}`);
    
    // Navigate to the confirmation link
    await page.goto(decodedLink, {
      waitUntil: 'networkidle2', // Wait until network is idle
      timeout: 30000, // 30 second timeout
    });
    
    // Small delay to let page settle (using setTimeout wrapped in Promise)
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check if we need to login
    const needsLogin = await isLoginRequired(page);
    
    if (needsLogin) {
      console.log('   🔐 Login required, authenticating...');
      const loginSuccess = await performLogin(page, credentials);
      
      if (!loginSuccess) {
        console.log('   ❌ Login failed');
        return false;
      }
      
      console.log('   ✅ Login successful');
    } else {
      console.log('   ℹ️  Already authenticated (cookies present)');
    }
    
    // Now try to find and click the confirmation button
    console.log('   🔍 Looking for confirmation button...');
    
    const confirmed = await clickConfirmationButton(page);
    
    if (confirmed) {
      console.log('   ✅ Household update confirmed successfully!');
      
      // Take screenshot for verification (optional)
      // await page.screenshot({ path: 'confirmation-success.png' });
      
      return true;
    } else {
      console.log('   ⚠️  Could not find or click confirmation button');
      
      // Debug: save HTML for inspection
      const html = await page.content();
      console.log('   📄 Page preview:', html.substring(0, 500));
      
      return false;
    }
    
  } catch (error) {
    console.error('   ❌ Browser automation error:', error);
    return false;
  } finally {
    // Always close browser to free resources
    if (browser) {
      await browser.close();
      console.log('   🔒 Browser closed');
    }
  }
}

/**
 * Check if the current page requires login
 */
async function isLoginRequired(page: Page): Promise<boolean> {
  try {
    // Look for common Netflix login form elements
    const loginSelectors = [
      'input[name="userLoginId"]',
      'input[type="email"][name="email"]',
      '#id_userLoginId',
      'input[data-uia="login-field"]',
    ];
    
    for (const selector of loginSelectors) {
      const element = await page.$(selector);
      if (element) {
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error('   ⚠️  Error checking login status:', error);
    return false;
  }
}

/**
 * Perform Netflix login
 */
async function performLogin(
  page: Page,
  credentials: NetflixCredentials
): Promise<boolean> {
  try {
    // Try different possible selectors (Netflix may change these)
    const emailSelectors = [
      'input[name="userLoginId"]',
      'input[type="email"]',
      '#id_userLoginId',
      'input[data-uia="login-field"]',
    ];
    
    const passwordSelectors = [
      'input[name="password"]',
      'input[type="password"]',
      '#id_password',
      'input[data-uia="password-field"]',
    ];
    
    const submitSelectors = [
      'button[type="submit"]',
      'button[data-uia="login-submit-button"]',
      'button.login-button',
    ];
    
    // Find and fill email
    let emailFilled = false;
    for (const selector of emailSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        await page.type(selector, credentials.email, { delay: 100 }); // Type with delay (more human-like)
        emailFilled = true;
        break;
      } catch {
        continue;
      }
    }
    
    if (!emailFilled) {
      console.log('   ⚠️  Could not find email input field');
      return false;
    }
    
    // Find and fill password
    let passwordFilled = false;
    for (const selector of passwordSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        await page.type(selector, credentials.password, { delay: 100 });
        passwordFilled = true;
        break;
      } catch {
        continue;
      }
    }
    
    if (!passwordFilled) {
      console.log('   ⚠️  Could not find password input field');
      return false;
    }
    
    // Find and click submit button
    let submitted = false;
    for (const selector of submitSelectors) {
      try {
        await page.click(selector);
        submitted = true;
        break;
      } catch {
        continue;
      }
    }
    
    if (!submitted) {
      console.log('   ⚠️  Could not find submit button');
      return false;
    }
    
    // Wait for navigation (login redirect)
    await page.waitForNavigation({ 
      waitUntil: 'networkidle2',
      timeout: 15000 
    }).catch(() => {
      // Sometimes Netflix doesn't navigate, just updates the page
      console.log('   ℹ️  No navigation detected, assuming SPA update');
    });
    
    // Wait a bit for any JS to settle
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Verify login was successful by checking if login form is gone
    const stillNeedsLogin = await isLoginRequired(page);
    
    return !stillNeedsLogin;
    
  } catch (error) {
    console.error('   ⚠️  Login error:', error);
    return false;
  }
}

/**
 * Find and click the household confirmation button
 */
async function clickConfirmationButton(page: Page): Promise<boolean> {
  try {
    // ONLY look for the specific confirmation button
    const buttonKeywords = [
      'Aktualisierung bestätigen', // Primary German button
      'Update household', // English equivalent
      'Confirm update', // Alternative English
    ];
    
    // Wait for buttons/links to be present
    await page.waitForSelector('button, a[role="button"], a[href], div[role="button"]', { timeout: 10000 });
    
    // Get all clickable elements (buttons, links, divs with button role)
    const buttons = await page.$$('button, a[role="button"], a[href*="update"], div[role="button"]');
    
    console.log(`   📊 Found ${buttons.length} clickable element(s) on page`);
    
    for (const button of buttons) {
      try {
        // Get button text content and element info
        const info = await page.evaluate(el => {
          return {
            text: el.textContent || '',
            tagName: el.tagName,
            href: el.getAttribute('href') || '',
            className: el.className || '',
          };
        }, button);
        
        const trimmedText = info.text.trim();
        
        console.log(`   🔍 Checking ${info.tagName.toLowerCase()}: "${trimmedText.substring(0, 80)}"`);
        if (info.href) {
          console.log(`      href: ${info.href.substring(0, 80)}`);
        }
        
        // Check if button text matches any keyword
        const matches = buttonKeywords.some(keyword => 
          trimmedText.toLowerCase().includes(keyword.toLowerCase())
        );
        
        if (matches) {
          console.log(`   🎯 Found matching element: "${trimmedText}"`);
          
          // Scroll button into view
          await page.evaluate(el => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), button);
          
          // Wait a bit for any animations
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Click the button
          await button.click();
          
          console.log(`   ✅ Clicked! Waiting for response...`);
          
          // Wait for any resulting navigation or updates
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          // Check for success indicators
          const success = await checkForSuccessMessage(page);
          
          return success;
        }
      } catch (error) {
        console.log(`   ⚠️  Error processing element:`, error);
        continue;
      }
    }
    
    console.log('   ⚠️  No matching confirmation button found');
    return false;
    
  } catch (error) {
    console.error('   ⚠️  Error clicking confirmation button:', error);
    return false;
  }
}

/**
 * Check if the page shows a success message
 */
async function checkForSuccessMessage(page: Page): Promise<boolean> {
  try {
    const successKeywords = [
      'erfolgreich',
      'success',
      'bestätigt',
      'confirmed',
      'aktualisiert',
      'updated',
      'danke',
      'thank you',
    ];
    
    // Get page text content
    const bodyText = await page.evaluate(() => document.body.textContent || '');
    const lowerText = bodyText.toLowerCase();
    
    // Check for success keywords
    const hasSuccess = successKeywords.some(keyword => 
      lowerText.includes(keyword.toLowerCase())
    );
    
    return hasSuccess;
    
  } catch (error) {
    console.error('   ⚠️  Error checking for success:', error);
    return false;
  }
}

/**
 * Extract action link from Netflix household update email
 */
export function extractHouseholdActionLink(html: string): string | null {
  if (!html) return null;
  
  // Look for Netflix household/travel links (in priority order)
  const linkPatterns = [
    // Priority 1: Direct update link with nftoken
    /https:\/\/www\.netflix\.com\/account\/update-primary-location[^\s<>"]+/gi,
    // Priority 2: Travel verification
    /https:\/\/www\.netflix\.com\/account\/travel\/verify[^\s<>"]+/gi,
    // Priority 3: Manage account access (may require navigation)
    /https:\/\/www\.netflix\.com\/ManageAccountAccess[^\s<>"]+/gi,
    // Priority 4: Any household-related link
    /https:\/\/www\.netflix\.com\/[^\s<>"]*household[^\s<>"]+/gi,
  ];
  
  for (const pattern of linkPatterns) {
    const matches = html.match(pattern);
    if (matches && matches.length > 0) {
      // Return first match, decode HTML entities
      return matches[0]
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"');
    }
  }
  
  return null;
}
