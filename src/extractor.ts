// Purpose: Extract useful data from email content

import axios from 'axios';

export function extractLinks(html: string): string[] {
  // Guard clause: if no input, return empty array
  if (!html) return [];
  
  // Regex pattern to find URLs
  const LINK_REGEX = /https?:\/\/[^\s<>"]+/gi;
  
  // .match() returns array of matches or null
  const matches = html.match(LINK_REGEX);
  
  // If no matches, return empty array
  if (!matches) return [];
  
  // Remove duplicates using Set
  // Set only keeps unique values
  // [...set] converts Set back to array
  return [...new Set(matches)];
}

export function extractCodes(text: string): string[] {
  if (!text) return [];
  
  // Match exactly 6 digits with word boundaries
  // \b = word boundary (prevents matching part of longer numbers)
  // \d{6} = exactly 6 digits
  const CODE_REGEX = /\b\d{6}\b/g;
  
  const matches = text.match(CODE_REGEX);
  if (!matches) return [];
  
  return [...new Set(matches)];
}

/**
 * Extract codes with context awareness - only match codes that appear
 * near verification-related keywords
 */
function extractCodesWithContext(html: string): string[] {
  if (!html) return [];
  
  // Keywords that suggest nearby text is a verification code
  const codeContextKeywords = [
    'code',
    'verification',
    'verify',
    'access',
    'temporary',
    'zugangscode',
    'verifizierung',
    'bestätigung',
    'pin',
    'otp'
  ];
  
  // Look for patterns like: "Your code is: 123456" or "Code: 123456"
  // Context-aware patterns that capture the relationship
  const contextPatterns = [
    /(?:code|verification|verify|zugangscode|pin)[\s:]+(\d{6})/gi,
    /(\d{6})[\s\-]+(?:is your|verification|access)/gi,
    /<[^>]*>(\d{6})<\/[^>]*>/gi, // Code inside HTML tags
  ];
  
  const foundCodes = new Set<string>();
  
  // Try each pattern
  for (const pattern of contextPatterns) {
    const matches = html.matchAll(pattern);
    for (const match of matches) {
      // match[1] is the captured group (the 6-digit code)
      if (match[1]) {
        foundCodes.add(match[1]);
      }
    }
  }
  
  // Fallback: if no contextual matches, look for simple codes
  // but only if HTML is small (likely a simple verification page)
  if (foundCodes.size === 0 && html.length < 50000) {
    const simpleCodes = extractCodes(html);
    // Only accept if there are very few codes (reduces false positives)
    if (simpleCodes.length <= 3) {
      simpleCodes.forEach(code => foundCodes.add(code));
    }
  }
  
  return Array.from(foundCodes);
}

// Keywords that suggest a link leads to a verification code
const CODE_LINK_KEYWORDS = [
  'code',
  'verify',
  'verifizierung',
  'anfordern',
  'bestätigung',
  'confirmation',
  'activate'
];

export function filterCodeLinks(links: string[]): string[] {
  return links.filter(link => {
    // Convert to lowercase for case-insensitive matching
    const lowerLink = link.toLowerCase();
    
    // Check if any keyword appears in the URL
    return CODE_LINK_KEYWORDS.some(keyword => lowerLink.includes(keyword));
  });
}

/**
 * Fetch a URL and try to extract a 6-digit code from it
 * 
 * @param url - The webpage URL to fetch
 * @returns The first 6-digit code found, or null if none
 */
export async function fetchCodeFromLink(url: string): Promise<string | null> {
  try {
    // Make HTTP GET request
    const response = await axios.get(url, {
      timeout: 10000, // 10 seconds max wait
      headers: {
        // Pretend to be a real browser (some sites block bots)
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      maxRedirects: 5, // Follow redirects
      validateStatus: (status) => status < 400 // Accept 2xx and 3xx
    });
    
    // response.data contains the HTML of the page
    const html = response.data;
    
    // DEBUG: Log response info
    console.log(`\n   📄 Response: ${response.status} ${response.statusText}`);
    console.log(`   📄 Content length: ${html.length} chars`);
    console.log(`   📄 Preview (first 500 chars):`);
    console.log(html.substring(0, 500));
    
    // Check for error indicators in the response
    const lowerHtml = html.toLowerCase();
    const errorKeywords = ['expired', 'invalid', 'error', 'not found', 'abgelaufen', 'ungültig'];
    const hasError = errorKeywords.some(keyword => lowerHtml.includes(keyword));
    
    if (hasError) {
      console.log(`   ⚠️  Response contains error keywords - likely expired/invalid link`);
      return null;
    }
    
    // Extract codes with context awareness
    const codes = extractCodesWithContext(html);
    
    if (codes.length > 0) {
      console.log(`   🔍 Found ${codes.length} contextual code(s): ${codes.join(', ')}`);
    } else {
      console.log(`   ℹ️  No codes found in meaningful context`);
    }
    
    // Return first code found, or null
    return codes[0] || null;
    
  } catch (error) {
    // Error handling: network failure, timeout, 404, etc.
    if (axios.isAxiosError(error)) {
      // axios.isAxiosError narrows the type to AxiosError
      console.error(`   ❌ Failed to fetch ${url}: ${error.message}`);
    } else {
      console.error(`   ❌ Unexpected error:`, error);
    }
    return null;
  }
}