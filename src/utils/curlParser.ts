/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { RequestConfig, HttpMethod, KeyValuePair, BodyType, AuthSettings } from '../types';

export function isCurlCommand(input: string): boolean {
  const trimmed = input.trim();
  return (
    trimmed.toLowerCase().startsWith('curl ') ||
    trimmed.toLowerCase().startsWith('curl\n') ||
    trimmed.toLowerCase().startsWith('curl\r\n')
  );
}

export function parseCurl(curlCommand: string, defaultConfig: RequestConfig): RequestConfig {
  const tokens = tokenizeArgv(curlCommand);
  if (tokens.length === 0) return defaultConfig;

  // Create a clean slate config copy
  const config: RequestConfig = JSON.parse(JSON.stringify(defaultConfig));
  
  config.body = '';
  config.headers = [];
  config.queryParams = [];
  config.formData = [];
  config.auth = { type: 'none' };
  
  let method: HttpMethod | undefined = undefined;
  let url = '';
  let isGetFlag = false;
  const headerPairs: { key: string; value: string }[] = [];
  const bodyParts: string[] = [];
  const dataItems: { key: string; value: string }[] = [];
  
  const argsWithParams = new Set([
    '-X', '--request',
    '-H', '--header',
    '-d', '--data', '--data-raw', '--data-binary', '--data-ascii', '--data-urlencode',
    '-u', '--user',
    '-A', '--user-agent',
    '-b', '--cookie',
    '-c', '--cookie-jar',
    '-o', '--output',
    '-e', '--referer',
    '-m', '--max-time',
    '--connect-timeout',
    '--cacert', '--cert', '--key', '--pass', '--pubkey', '--retry'
  ]);

  for (let i = 1; i < tokens.length; i++) {
    const token = tokens[i];

    if (token === '-X' || token === '--request') {
      const nextVal = tokens[++i];
      if (nextVal) {
        // Clean any residual surrounding quotes from raw inputs
        const cleanVal = nextVal.replace(/^['"]|['"]$/g, '').toUpperCase();
        method = cleanVal as HttpMethod;
      }
    } else if (token === '-G' || token === '--get') {
      isGetFlag = true;
    } else if (token === '-H' || token === '--header') {
      const nextVal = tokens[++i];
      if (nextVal) {
        const colonIdx = nextVal.indexOf(':');
        if (colonIdx !== -1) {
          const key = nextVal.substring(0, colonIdx).trim();
          const value = nextVal.substring(colonIdx + 1).trim();
          headerPairs.push({ key, value });
        }
      }
    } else if (
      token === '-d' ||
      token === '--data' ||
      token === '--data-raw' ||
      token === '--data-binary' ||
      token === '--data-ascii' ||
      token === '--data-urlencode'
    ) {
      const nextVal = tokens[++i];
      if (nextVal !== undefined) {
        bodyParts.push(nextVal);
        
        // Parse key-value structure of data flag
        const eqIdx = nextVal.indexOf('=');
        if (eqIdx !== -1) {
          const key = nextVal.substring(0, eqIdx);
          const val = nextVal.substring(eqIdx + 1);
          dataItems.push({
            key: key.replace(/^['"]|['"]$/g, ''),
            value: val.replace(/^['"]|['"]$/g, '')
          });
        } else {
          dataItems.push({
            key: nextVal.replace(/^['"]|['"]$/g, ''),
            value: ''
          });
        }
      }
    } else if (token === '-u' || token === '--user') {
      const nextVal = tokens[++i];
      if (nextVal) {
        const colonIdx = nextVal.indexOf(':');
        if (colonIdx !== -1) {
          config.auth = {
            type: 'basic',
            basicUsername: nextVal.substring(0, colonIdx),
            basicPassword: nextVal.substring(colonIdx + 1)
          };
        } else {
          config.auth = {
            type: 'basic',
            basicUsername: nextVal,
            basicPassword: ''
          };
        }
      }
    } else if (token === '-b' || token === '--cookie') {
      const nextVal = tokens[++i];
      if (nextVal) {
        headerPairs.push({ key: 'Cookie', value: nextVal });
      }
    } else if (token === '-A' || token === '--user-agent') {
      const nextVal = tokens[++i];
      if (nextVal) {
        headerPairs.push({ key: 'User-Agent', value: nextVal });
      }
    } else if (token === '-e' || token === '--referer') {
      const nextVal = tokens[++i];
      if (nextVal) {
        headerPairs.push({ key: 'Referer', value: nextVal });
      }
    } else if (token.startsWith('-')) {
      // It's some other flag. If it takes an argument, skip the next item
      if (argsWithParams.has(token)) {
        i++;
      }
    } else {
      // It's a positional argument. If we haven't found a URL yet, assume this is the URL.
      if (!url) {
        url = token;
      }
    }
  }

  // Set method
  if (method) {
    config.method = method;
  } else if (isGetFlag) {
    config.method = 'GET';
  } else {
    // If no method was specified but we have data, default to POST, else GET.
    config.method = bodyParts.length > 0 ? 'POST' : 'GET';
  }

  // If -G is specified, curl forces standard GET behavior
  if (isGetFlag) {
    config.method = 'GET';
  }

  const isGetLike = config.method === 'GET' || config.method === 'HEAD' || config.method === 'OPTIONS';

  // Set URL
  if (url) {
    url = url.replace(/^['"]|['"]$/g, '');
    config.url = url;

    // Extract query params from URL if present
    try {
      const questionIndex = url.indexOf('?');
      if (questionIndex !== -1) {
        const queryString = url.substring(questionIndex + 1);
        const searchParams = new URLSearchParams(queryString);
        searchParams.forEach((val, key) => {
          config.queryParams.push({
            id: Math.random().toString(36).substr(2, 9),
            key,
            value: val,
            enabled: true
          });
        });
      }
    } catch {
      // Ignore URL parsing errors on malformed URLs
    }
  }

  // Set body OR query parameters based on method and flags
  if (isGetLike || isGetFlag) {
    // Treat parsed data items as query parameters
    dataItems.forEach(({ key, value }) => {
      // Safe decode URL encode values if they are encoded
      let decodedKey = key;
      let decodedValue = value;
      try {
        decodedKey = decodeURIComponent(key);
        decodedValue = decodeURIComponent(value);
      } catch {
        // Fallback to raw if not decodeable
      }
      
      config.queryParams.push({
        id: Math.random().toString(36).substr(2, 9),
        key: decodedKey,
        value: decodedValue,
        enabled: true
      });
    });

    config.bodyType = 'none';
    config.body = '';
    
    // Also append query parameters to the URL if they are not already there
    if (dataItems.length > 0 && config.url) {
      try {
        const urlObj = new URL(config.url.startsWith('http') ? config.url : `http://dummy.com/${config.url}`);
        dataItems.forEach(({ key, value }) => {
          try {
            urlObj.searchParams.append(decodeURIComponent(key), decodeURIComponent(value));
          } catch {
            urlObj.searchParams.append(key, value);
          }
        });
        const finalRelativeUrl = urlObj.pathname + urlObj.search;
        if (config.url.startsWith('http')) {
          config.url = urlObj.toString();
        } else {
          // If relative, reconstruct properly without the dummy host
          const hasLeadingSlash = config.url.startsWith('/');
          config.url = (hasLeadingSlash ? '' : '') + finalRelativeUrl.substring(1);
        }
      } catch {
        // Fallback to string concatenation if URL parser fails
        const joinChar = config.url.includes('?') ? '&' : '?';
        const queryStr = dataItems.map(item => `${item.key}=${item.value}`).join('&');
        config.url = `${config.url}${joinChar}${queryStr}`;
      }
    }
  } else {
    // For non-GET requests (like POST), set them as body parts
    if (bodyParts.length > 0) {
      config.body = bodyParts.join('&');
      // Try to auto-detect if JSON or text
      let isJson = false;
      try {
        const trimmedBody = config.body.trim();
        if (
          (trimmedBody.startsWith('{') && trimmedBody.endsWith('}')) ||
          (trimmedBody.startsWith('[') && trimmedBody.endsWith(']'))
        ) {
          JSON.parse(trimmedBody);
          isJson = true;
        }
      } catch {
        // Ignore parsing error, default to standard text
      }

      config.bodyType = isJson ? 'json' : 'text';
    } else {
      config.bodyType = 'none';
    }
  }

  // Set headers
  const finalHeaders: KeyValuePair[] = [];
  
  headerPairs.forEach(({ key, value }) => {
    const lowerKey = key.toLowerCase();
    const lowerVal = value.toLowerCase();

    if (lowerKey === 'authorization' && lowerVal.startsWith('bearer ')) {
      config.auth = {
        type: 'bearer',
        bearerToken: value.substring(7).trim()
      };
    } else if (lowerKey === 'authorization' && lowerVal.startsWith('basic ')) {
      try {
        const base64 = value.substring(6).trim();
        const decoded = atob(base64);
        const colonIdx = decoded.indexOf(':');
        if (colonIdx !== -1) {
          config.auth = {
            type: 'basic',
            basicUsername: decoded.substring(0, colonIdx),
            basicPassword: decoded.substring(colonIdx + 1)
          };
        } else {
          config.auth = {
            type: 'basic',
            basicUsername: decoded,
            basicPassword: ''
          };
        }
      } catch {
        finalHeaders.push({
          id: Math.random().toString(36).substr(2, 9),
          key,
          value,
          enabled: true
        });
      }
    } else {
      finalHeaders.push({
        id: Math.random().toString(36).substr(2, 9),
        key,
        value,
        enabled: true
      });
    }
  });

  config.headers = finalHeaders;

  return config;
}

export function tokenizeArgv(curlStr: string): string[] {
  // Normalize line endings and backslashes that get joined when pasting multi-line commands.
  // Replace backslash followed by any number of spaces, tabs, or newlines with a single space.
  const cleaned = curlStr
    .replace(/\\[ \t\r\n]+/g, ' ')
    .replace(/\\ /g, ' ')
    .trim();

  const args: string[] = [];
  let current = '';
  let inDoubleQuotes = false;
  let inSingleQuotes = false;
  let escaped = false;

  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];

    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === '\\') {
      if (inSingleQuotes) {
        current += char;
      } else {
        escaped = true;
      }
      continue;
    }

    if (char === '"' && !inSingleQuotes) {
      inDoubleQuotes = !inDoubleQuotes;
      continue;
    }

    if (char === "'" && !inDoubleQuotes) {
      inSingleQuotes = !inSingleQuotes;
      continue;
    }

    if (char === ' ' || char === '\t' || char === '\n' || char === '\r') {
      if (inDoubleQuotes || inSingleQuotes) {
        current += char;
      } else {
        if (current.length > 0) {
          args.push(current);
          current = '';
        }
      }
    } else {
      current += char;
    }
  }

  if (current.length > 0) {
    args.push(current);
  }

  return args;
}
