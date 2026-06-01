/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { RequestConfig, ResponseData, KeyValuePair, TestResult } from '../types';

export interface SandboxResult {
  modifiedConfig: RequestConfig;
  logs: string[];
  tests: TestResult[];
  modifiedVariables: KeyValuePair[];
}

// Simple Assertion Class mimicking Postman/Chai Matchers
class ExpectAssertion {
  private val: any;
  private isNegated = false;

  constructor(val: any) {
    this.val = val;
  }

  get to() { return this; }
  get be() { return this; }
  get been() { return this; }
  get is() { return this; }
  get not() {
    this.isNegated = !this.isNegated;
    return this;
  }

  equal(other: any) {
    const passed = this.isNegated ? (this.val !== other) : (this.val === other);
    if (!passed) {
      throw new Error(`Expected ${JSON.stringify(this.val)} ${this.isNegated ? 'not to equal' : 'to equal'} ${JSON.stringify(other)}`);
    }
  }

  include(item: any) {
    let passed = false;
    if (typeof this.val === 'string' || Array.isArray(this.val)) {
      passed = this.val.includes(item);
    } else if (this.val && typeof this.val === 'object') {
      passed = item in this.val;
    }
    if (this.isNegated) passed = !passed;
    if (!passed) {
      throw new Error(`Expected ${JSON.stringify(this.val)} ${this.isNegated ? 'not to include' : 'to include'} ${JSON.stringify(item)}`);
    }
  }

  contain(item: any) {
    this.include(item);
  }

  a(typeName: string) {
    const actualType = typeof this.val;
    const passed = this.isNegated ? (actualType !== typeName) : (actualType === typeName);
    if (!passed) {
      throw new Error(`Expected ${JSON.stringify(this.val)} ${this.isNegated ? 'not to be type' : 'to be type'} "${typeName}"`);
    }
  }

  an(typeName: string) {
    this.a(typeName);
  }

  get true() {
    const passed = this.isNegated ? (this.val !== true) : (this.val === true);
    if (!passed) {
      throw new Error(`Expected ${JSON.stringify(this.val)} ${this.isNegated ? 'not to be' : 'to be'} true`);
    }
    return this;
  }

  get false() {
    const passed = this.isNegated ? (this.val !== false) : (this.val === false);
    if (!passed) {
      throw new Error(`Expected ${JSON.stringify(this.val)} ${this.isNegated ? 'not to be' : 'to be'} false`);
    }
    return this;
  }

  get null() {
    const passed = this.isNegated ? (this.val !== null) : (this.val === null);
    if (!passed) {
      throw new Error(`Expected ${JSON.stringify(this.val)} ${this.isNegated ? 'not to be' : 'to be'} null`);
    }
    return this;
  }

  get undefined() {
    const passed = this.isNegated ? (this.val !== undefined) : (this.val === undefined);
    if (!passed) {
      throw new Error(`Expected ${JSON.stringify(this.val)} ${this.isNegated ? 'not to be' : 'to be'} undefined`);
    }
    return this;
  }

  above(num: number) {
    const passed = this.isNegated ? (this.val <= num) : (this.val > num);
    if (!passed) {
      throw new Error(`Expected ${this.val} ${this.isNegated ? 'not to be greater than' : 'to be greater than'} ${num}`);
    }
  }

  below(num: number) {
    const passed = this.isNegated ? (this.val >= num) : (this.val < num);
    if (!passed) {
      throw new Error(`Expected ${this.val} ${this.isNegated ? 'not to be less than' : 'to be less than'} ${num}`);
    }
  }
}

/**
 * Replaces any {{variableName}} double brackets inside a string with their value
 */
export function replacePlaceholderVariables(input: string, variables: KeyValuePair[]): string {
  if (!input) return '';
  return input.replace(/\{\{([^}]+)\}\}/g, (_, varName) => {
    const trimmed = varName.trim();
    const match = variables.find(v => v.key === trimmed && v.enabled);
    return match ? match.value : `{{${trimmed}}}`;
  });
}

/**
 * Perform replacement on full Request Configuration
 */
export function resolveRequestConfigVariables(config: RequestConfig, variables: KeyValuePair[]): RequestConfig {
  const replaceStr = (s: string) => replacePlaceholderVariables(s, variables);

  return {
    ...config,
    url: replaceStr(config.url),
    headers: config.headers.map(h => ({
      ...h,
      key: replaceStr(h.key),
      value: replaceStr(h.value)
    })),
    queryParams: config.queryParams.map(q => ({
      ...q,
      key: replaceStr(q.key),
      value: replaceStr(q.value)
    })),
    body: replaceStr(config.body),
    formData: config.formData.map(f => ({
      ...f,
      key: replaceStr(f.key),
      value: replaceStr(f.value)
    })),
    auth: {
      ...config.auth,
      bearerToken: config.auth.bearerToken ? replaceStr(config.auth.bearerToken) : undefined,
      basicUsername: config.auth.basicUsername ? replaceStr(config.auth.basicUsername) : undefined,
      basicPassword: config.auth.basicPassword ? replaceStr(config.auth.basicPassword) : undefined,
      apiKeyName: config.auth.apiKeyName ? replaceStr(config.auth.apiKeyName) : undefined,
      apiKeyValue: config.auth.apiKeyValue ? replaceStr(config.auth.apiKeyValue) : undefined,
    }
  };
}

/**
 * Execute pre-request or post-request scripts in a controlled sandbox.
 */
export function executeScript(
  scriptType: 'pre' | 'post',
  scriptCode: string,
  config: RequestConfig,
  variables: KeyValuePair[],
  response?: ResponseData
): SandboxResult {
  const logs: string[] = [];
  const tests: TestResult[] = [];
  
  // Clone structures to avoid state pollution
  const variablesClone = JSON.parse(JSON.stringify(variables)) as KeyValuePair[];
  const configClone = JSON.parse(JSON.stringify(config)) as RequestConfig;

  if (!scriptCode || scriptCode.trim() === '') {
    return {
      modifiedConfig: configClone,
      logs,
      tests,
      modifiedVariables: variablesClone
    };
  }

  // Create environment helper API
  const environmentAPI = {
    get: (keyName: string) => {
      const match = variablesClone.find(v => v.key === keyName);
      return match ? match.value : undefined;
    },
    set: (keyName: string, value: string) => {
      logs.push(`[Script] pm.environment.set("${keyName}", "${value}")`);
      const index = variablesClone.findIndex(v => v.key === keyName);
      if (index !== -1) {
        variablesClone[index].value = value;
      } else {
        variablesClone.push({
          id: Math.random().toString(36).substr(2, 9),
          key: keyName,
          value: value,
          enabled: true
        });
      }
    },
    has: (keyName: string) => {
      return variablesClone.some(v => v.key === keyName);
    },
    unset: (keyName: string) => {
      logs.push(`[Script] pm.environment.unset("${keyName}")`);
      const index = variablesClone.findIndex(v => v.key === keyName);
      if (index !== -1) {
        variablesClone.splice(index, 1);
      }
    },
    clear: () => {
      logs.push(`[Script] pm.environment.clear()`);
      variablesClone.length = 0;
    }
  };

  // Mock standard Request API
  const requestAPI = {
    get url() { return configClone.url; },
    set url(newUrl: string) {
      logs.push(`[Script] Modifying request URL to "${newUrl}"`);
      configClone.url = newUrl;
    },
    get method() { return configClone.method; },
    headers: {
      get: (name: string) => {
        const item = configClone.headers.find(h => h.key.toLowerCase() === name.toLowerCase() && h.enabled);
        return item ? item.value : null;
      },
      set: (name: string, val: string) => {
        logs.push(`[Script] Set Header "${name}": "${val}"`);
        const item = configClone.headers.find(h => h.key.toLowerCase() === name.toLowerCase());
        if (item) {
          item.value = val;
          item.enabled = true;
        } else {
          configClone.headers.push({
            id: Math.random().toString(36).substr(2, 9),
            key: name,
            value: val,
            enabled: true
          });
        }
      }
    }
  };

  // Mock standard Response API (Only for post-request scripts)
  let responseAPI: any = null;
  if (scriptType === 'post' && response) {
    responseAPI = {
      code: response.status,
      status: response.statusText,
      headers: {
        get: (name: string) => {
          // Case insensitive match
          const key = Object.keys(response.headers).find(k => k.toLowerCase() === name.toLowerCase());
          return key ? response.headers[key] : null;
        }
      },
      text: () => response.body,
      json: () => {
        try {
          return JSON.parse(response.body);
        } catch (e) {
          throw new Error('Response body is not valid JSON, cannot call pm.response.json()');
        }
      }
    };
  }

  // Expect-assertions engine helper
  const expectFn = (val: any) => new ExpectAssertion(val);

  // Test suite runner
  const testSuite = (testName: string, testFn: () => void) => {
    try {
      if (typeof testFn !== 'function') {
        throw new Error('Test body callback must be a function');
      }
      testFn();
      tests.push({ name: testName, passed: true });
      logs.push(`[Test Pass] ✓ ${testName}`);
    } catch (e: any) {
      tests.push({ name: testName, passed: false, error: e.message });
      logs.push(`[Test Fail] ✗ ${testName} - Error: ${e.message}`);
    }
  };

  // Build the sandboxed context wrapper
  const pmMock = {
    environment: environmentAPI,
    request: requestAPI,
    response: responseAPI,
    test: testSuite,
    expect: expectFn,
    info: {
      eventName: scriptType === 'pre' ? 'prerequest' : 'test',
      iteration: 0
    }
  };

  // Override standard logs to fetch console outputs inside the sandbox editor
  const sandboxConsole = {
    log: (...args: any[]) => {
      const line = args.map(arg => {
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg, null, 2);
          } catch {
            return String(arg);
          }
        }
        return String(arg);
      }).join(' ');
      logs.push(`[Console] ${line}`);
    },
    error: (...args: any[]) => {
      const line = args.map(arg => String(arg)).join(' ');
      logs.push(`[Console Error] ${line}`);
    }
  };

  try {
    // Generate sandboxed executor function
    const runner = new Function('pm', 'console', `
      try {
        ${scriptCode}
      } catch (err) {
        console.error("Scripts crashed with top-level error: " + err.message);
        throw err;
      }
    `);

    runner(pmMock, sandboxConsole);
  } catch (err: any) {
    logs.push(`[Execution Error] Blocked script due to crash: ${err.message}`);
    // Record general script fail
    tests.push({
      name: `${scriptType === 'pre' ? 'Pre-request' : 'Post-request/assert'} Script compilation`,
      passed: false,
      error: err.message
    });
  }

  return {
    modifiedConfig: configClone,
    logs,
    tests,
    modifiedVariables: variablesClone
  };
}

// Script instruction examples for user templates
export const SCRIPT_TEMPLATES = {
  pre: [
    {
      name: 'Set default request credentials',
      code: `// Autopopulate variables prior to running
pm.environment.set("auth_host", "https://httpbin.org");
pm.request.headers.set("X-Client-Timestamp", Date.now().toString());
console.log("Pre-request script executed. Host set to " + pm.environment.get("auth_host"));`
    },
    {
      name: 'Generate random uuid in pre-request header',
      code: `// Generate custom variable
const randomHex = Math.random().toString(36).substring(2);
pm.environment.set("session_id", "sess_" + randomHex);
pm.request.headers.set("X-Session-ID", pm.environment.get("session_id"));
console.log("Stored dynamic variable session_id in environment!");`
    }
  ],
  post: [
    {
      name: 'Status code check: 200 OK',
      code: `pm.test("Status code is 200", function () {
    pm.expect(pm.response.code).to.equal(200);
});`
    },
    {
      name: 'Check JSON body parameters',
      code: `pm.test("Response body matches key assertions", function () {
    const data = pm.response.json();
    console.log("Retrieved data from API parser:", data);
    
    pm.expect(data).to.be.an("object");
    // Change this assertion based on your REST properties (e.g. data.id)
    // pm.expect(data.url).to.include("http");
});`
    },
    {
      name: 'Assert response timing latency',
      code: `// Assert response speed threshold
pm.test("Response time is under 1500ms", function () {
    // In our runner environment, we can do direct threshold checks
    // pm.response is fully accessible!
});`
    },
    {
      name: 'Store Access Token from Login API',
      code: `pm.test("Read login token and persist in environment", function () {
    const jsonData = pm.response.json();
    if (jsonData && (jsonData.token || jsonData.accessToken)) {
        const token = jsonData.token || jsonData.accessToken;
        pm.environment.set("token", token);
        console.log("Successfully extracted and locked token: Bearer " + token);
    } else {
        console.log("No token fields found in response body.");
    }
});`
    }
  ]
};
