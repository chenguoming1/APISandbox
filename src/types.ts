/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

export interface KeyValuePair {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
  description?: string;
}

export type AuthType = 'none' | 'bearer' | 'basic' | 'apikey';

export interface AuthSettings {
  type: AuthType;
  bearerToken?: string;
  basicUsername?: string;
  basicPassword?: string;
  apiKeyName?: string;
  apiKeyValue?: string;
  apiKeyAddTo?: 'headers' | 'query';
}

export type BodyType = 'none' | 'json' | 'text' | 'form-data';

export interface RequestConfig {
  method: HttpMethod;
  url: string;
  headers: KeyValuePair[];
  queryParams: KeyValuePair[];
  bodyType: BodyType;
  body: string;
  formData: KeyValuePair[];
  auth: AuthSettings;
  preRequestScript: string;
  postRequestScript: string;
}

export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

export interface ResponseData {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  time: number; // in milliseconds
  size: number; // in bytes
  logs: string[];
  tests: TestResult[];
  error?: string;
}

export interface Environment {
  id: string;
  name: string;
  variables: KeyValuePair[];
}

export interface HistoryItem {
  id: string;
  label?: string;
  config: RequestConfig;
  response: ResponseData;
  timestamp: number;
}

export interface SavedCollection {
  id: string;
  name: string;
  requests: {
    id: string;
    name: string;
    config: RequestConfig;
  }[];
}

export interface Tab {
  id: string;
  name: string;
  config: RequestConfig;
  response: ResponseData | null;
  isLoading: boolean;
  isChanged: boolean;
  associatedRequestId?: string; // Optional reference if it comes from a saved collection or history item
}
