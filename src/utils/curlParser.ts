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
  const headerPairs: { key: string; value: string }[] = [];
  const bodyParts: string[] = [];
  
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
  } else {
    // If no method was specified but we have data, default to POST, else GET.
    config.method = bodyParts.length > 0 ? 'POST' : 'GET';
  }

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

  // Set body
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
  // Normalize line endings and join backslash split lines
  const normalized = curlStr.replace(/\\\r?\n/g, ' ').replace(/\\\n/g, ' ');
  const args: string[] = [];
  let current = '';
  let inDoubleQuotes = false;
  let inSingleQuotes = false;
  let escaped = false;

  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];

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
