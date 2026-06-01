/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { HttpMethod, RequestConfig, KeyValuePair, BodyType, AuthType, AuthSettings } from '../types';
import { SCRIPT_TEMPLATES } from '../utils/scriptRunner';
import { Plus, Trash2, Code2, Shield, Settings2, FileCode, Beaker, HelpCircle, ChevronDown, ChevronUp, Sliders } from 'lucide-react';

interface RequestPanelProps {
  config: RequestConfig;
  onChangeConfig: (newConfig: RequestConfig) => void;
  onSend: () => void;
  isLoading: boolean;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function RequestPanel({ 
  config, 
  onChangeConfig, 
  onSend, 
  isLoading,
  isCollapsed = false,
  onToggleCollapse
}: RequestPanelProps) {
  const [activeTab, setActiveTab] = useState<'params' | 'auth' | 'headers' | 'body' | 'scripts'>('params');

  // Synchronize URL string and Query Params Table
  // When Config.URL changes, parse queries IF they don't match the table to avoid typing feedback loops
  useEffect(() => {
    try {
      const urlStr = config.url;
      if (!urlStr) return;
      
      // Look for query separator
      const questionIndex = urlStr.indexOf('?');
      if (questionIndex === -1) {
        // No query params in URL. If the query params table has enabled rows, they should be appended.
        return;
      }

      const queryString = urlStr.substring(questionIndex + 1);
      const searchParams = new URLSearchParams(queryString);
      
      const newParams: KeyValuePair[] = [];
      searchParams.forEach((val, key) => {
        newParams.push({
          id: Math.random().toString(36).substr(2, 9),
          key,
          value: val,
          enabled: true
        });
      });

      // Simple compare existing enabled keys, if changed structurally, update
      const currentEnabled = config.queryParams.filter(q => q.enabled && q.key);
      const hasChanged = currentEnabled.length !== newParams.length || 
        currentEnabled.some((q, i) => q.key !== newParams[i]?.key || q.value !== newParams[i]?.value);

      if (hasChanged) {
        // Retain any existing disabled fields to not wipe rows out
        const disabledParams = config.queryParams.filter(q => !q.enabled);
        onChangeConfig({ ...config, queryParams: [...newParams, ...disabledParams] });
      }
    } catch {
      // Gracefully handle malformed URLs during typing
    }
  }, [config.url]);

  // When Config.queryParams table changes, rebuild the query suffix on URL string
  const handleUpdateParams = (updatedParams: KeyValuePair[]) => {
    let baseUrl = config.url;
    const questionIndex = baseUrl.indexOf('?');
    if (questionIndex !== -1) {
      baseUrl = baseUrl.substring(0, questionIndex);
    }

    const enabledParams = updatedParams.filter(p => p.enabled && p.key.trim() !== '');
    if (enabledParams.length > 0) {
      const searchParams = new URLSearchParams();
      enabledParams.forEach(p => {
        searchParams.append(p.key.trim(), p.value);
      });
      baseUrl = `${baseUrl}?${searchParams.toString()}`;
    }

    onChangeConfig({
      ...config,
      url: baseUrl,
      queryParams: updatedParams
    });
  };

  // Adding empty row template
  const addRow = (type: 'queryParams' | 'headers' | 'formData') => {
    const newRow: KeyValuePair = {
      id: Math.random().toString(36).substr(2, 9),
      key: '',
      value: '',
      enabled: true
    };
    if (type === 'queryParams') {
      handleUpdateParams([...config.queryParams, newRow]);
    } else {
      onChangeConfig({
        ...config,
        [type]: [...config[type], newRow]
      });
    }
  };

  // Editing cells row spreadsheet
  const editRowField = (
    type: 'queryParams' | 'headers' | 'formData',
    rowId: string,
    field: 'key' | 'value',
    val: string
  ) => {
    const updated = config[type].map(row => 
      row.id === rowId ? { ...row, [field]: val } : row
    );

    if (type === 'queryParams') {
      handleUpdateParams(updated);
    } else {
      onChangeConfig({ ...config, [type]: updated });
    }
  };

  // Toggle checkbox
  const toggleRowEnabled = (type: 'queryParams' | 'headers' | 'formData', rowId: string) => {
    const updated = config[type].map(row => 
      row.id === rowId ? { ...row, enabled: !row.enabled } : row
    );
    if (type === 'queryParams') {
      handleUpdateParams(updated);
    } else {
      onChangeConfig({ ...config, [type]: updated });
    }
  };

  // Delete row spreadsheet line
  const removeRowField = (type: 'queryParams' | 'headers' | 'formData', rowId: string) => {
    const updated = config[type].filter(row => row.id !== rowId);
    if (type === 'queryParams') {
      handleUpdateParams(updated);
    } else {
      onChangeConfig({ ...config, [type]: updated });
    }
  };

  // Insert assertion templates from preset configurations
  const insertScriptTemplate = (type: 'pre' | 'post', codeChunk: string) => {
    const field = type === 'pre' ? 'preRequestScript' : 'postRequestScript';
    const currentCode = config[field];
    const separator = currentCode.trim() ? '\n\n' : '';
    onChangeConfig({
      ...config,
      [field]: currentCode + separator + codeChunk
    });
  };

  const httpMethods: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];

  return (
    <div 
      id="request_panel_container" 
      className={`bg-slate-900 rounded-xl border border-slate-800 shadow-lg flex flex-col transition-all duration-150 ${
        isCollapsed ? 'p-3 gap-2' : 'p-5 gap-4'
      }`}
    >
      {/* Collapsible Panel Header Bar */}
      <div className="flex items-center justify-between border-b border-slate-800/60 pb-2 select-none">
        <div className="flex items-center gap-2 overflow-hidden mr-2">
          <Sliders className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Request Composer</span>
          {isCollapsed && (
            <span className="text-xs font-mono font-semibold text-slate-500 bg-slate-950 px-2.5 py-0.5 rounded border border-slate-850 truncate max-w-sm sm:max-w-md md:max-w-lg lg:max-w-xl">
              <b className={config.method === 'GET' ? 'text-teal-400' : 'text-indigo-400'}>{config.method}</b> — {config.url || 'No Target URL Specified'}
            </span>
          )}
        </div>
        {onToggleCollapse && (
          <button 
            type="button"
            onClick={onToggleCollapse}
            className="text-slate-400 hover:text-indigo-400 px-2 py-1 rounded hover:bg-slate-800 transition cursor-pointer flex items-center gap-1.5 flex-shrink-0"
          >
            {isCollapsed ? (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold uppercase tracking-wide">Expand Config</span>
              </>
            ) : (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold uppercase tracking-wide">Collapse</span>
              </>
            )}
          </button>
        )}
      </div>

      {!isCollapsed && (
        <>
          {/* Target Address bar */}
      <div className="flex flex-col sm:flex-row items-stretch gap-2">
        {/* Method Picker */}
        <select
          id="http-method-select"
          value={config.method}
          onChange={(e) => onChangeConfig({ ...config, method: e.target.value as HttpMethod })}
          className={`bg-slate-950 font-mono text-xs font-bold leading-5 tracking-wide uppercase px-4 py-2.5 rounded-lg border focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer text-center ${
            config.method === 'GET' ? 'text-teal-400 border-teal-900' :
            config.method === 'POST' ? 'text-indigo-400 border-indigo-900' :
            config.method === 'PUT' ? 'text-amber-400 border-amber-900' :
            config.method === 'DELETE' ? 'text-rose-455 border-rose-900 font-bold' : 'text-slate-350 border-slate-800'
          }`}
        >
          {httpMethods.map(m => (
            <option key={m} value={m} className="font-mono bg-slate-950 font-bold">{m}</option>
          ))}
        </select>

        {/* URL Inputs */}
        <div className="flex-1 relative">
          <input
            id="request-url-input"
            type="text"
            placeholder="Enter target endpoint URL (e.g. {{baseUrl}}/get or https://httpbin.org/json)..."
            value={config.url}
            onChange={(e) => onChangeConfig({ ...config, url: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onSend();
              }
            }}
            className="w-full bg-slate-950 text-slate-100 hover:border-slate-800 border border-slate-850 rounded-lg py-2.5 px-3.5 text-xs font-medium focus:outline-none focus:border-indigo-500 transition leading-5 focus:ring-1 focus:ring-indigo-900/30 font-mono"
          />
        </div>

        {/* Send Button Trigger */}
        <button
          id="send-request-btn"
          onClick={onSend}
          disabled={isLoading}
          className="bg-indigo-600 hover:bg-indigo-505 disabled:bg-indigo-800 text-white font-semibold text-xs py-2.5 px-6 rounded-lg transition shadow-md hover:shadow-indigo-900/10 flex items-center justify-center gap-2 cursor-pointer"
        >
          {isLoading ? (
            <>
              <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
              <span>Connecting...</span>
            </>
          ) : (
            <>
              <span>Send Request</span>
            </>
          )}
        </button>
      </div>

      {/* Tabs list layout */}
      <div className="flex items-center gap-1 border-b border-slate-800 pb-1 mt-1 flex-shrink-0 select-none">
        <button
          id="req-tab-params"
          onClick={() => setActiveTab('params')}
          className={`px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer transition ${
            activeTab === 'params' 
              ? 'bg-slate-850 text-indigo-400 font-bold' 
              : 'text-slate-400 hover:bg-slate-850/40 hover:text-slate-200'
          }`}
        >
          Params
          {config.queryParams.filter(q => q.enabled && q.key).length > 0 && (
            <span className="ml-1 px-1 bg-slate-800 rounded font-mono text-[9px] text-slate-300">
              {config.queryParams.filter(q => q.enabled && q.key).length}
            </span>
          )}
        </button>

        <button
          id="req-tab-auth"
          onClick={() => setActiveTab('auth')}
          className={`px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer transition ${
            activeTab === 'auth' 
              ? 'bg-slate-850 text-indigo-400 font-bold' 
              : 'text-slate-400 hover:bg-slate-850/40 hover:text-slate-200'
          }`}
        >
          Auth
          {config.auth.type !== 'none' && (
            <span className="ml-1 w-1.5 h-1.5 rounded-full bg-indigo-500 inline-block animate-pulse"></span>
          )}
        </button>

        <button
          id="req-tab-headers"
          onClick={() => setActiveTab('headers')}
          className={`px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer transition ${
            activeTab === 'headers' 
              ? 'bg-slate-850 text-indigo-400 font-bold' 
              : 'text-slate-400 hover:bg-slate-850/40 hover:text-slate-200'
          }`}
        >
          Headers
          {config.headers.filter(h => h.enabled && h.key).length > 0 && (
            <span className="ml-1 px-1 bg-slate-800 rounded font-mono text-[9px] text-slate-300">
              {config.headers.filter(h => h.enabled && h.key).length}
            </span>
          )}
        </button>

        <button
          id="req-tab-body"
          onClick={() => setActiveTab('body')}
          className={`px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer transition ${
            activeTab === 'body' 
              ? 'bg-slate-850 text-indigo-400 font-bold' 
              : 'text-slate-400 hover:bg-slate-850/40 hover:text-slate-200'
          }`}
        >
          Body
          {config.bodyType !== 'none' && (
            <span className="ml-1.5 px-1 py-0.2 bg-indigo-950 text-indigo-400 text-[8px] font-bold rounded">
              {config.bodyType.toUpperCase()}
            </span>
          )}
        </button>

        <button
          id="req-tab-scripts"
          onClick={() => setActiveTab('scripts')}
          className={`px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer transition ${
            activeTab === 'scripts' 
              ? 'bg-slate-850 text-indigo-400 font-bold' 
              : 'text-slate-400 hover:bg-slate-850/40 hover:text-slate-200'
          }`}
        >
          Scripts Automation
          {(config.preRequestScript.trim() || config.postRequestScript.trim()) && (
            <span className="ml-1.5 px-1 py-0.2 bg-amber-950 text-amber-500 border border-amber-900/40 font-mono text-[8px] font-bold rounded">
              JS
            </span>
          )}
        </button>
      </div>

      {/* Dynamic Pane Content based on Active Tabs */}
      <div className="flex-1 min-h-[220px]">
        {/* PARAMS LIST */}
        {activeTab === 'params' && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">URL Query Parameters Table</span>
              <button
                onClick={() => addRow('queryParams')}
                className="text-xs bg-slate-800/60 hover:bg-slate-800 text-indigo-400 py-1 px-2.5 rounded font-semibold cursor-pointer transition flex items-center gap-1 border border-slate-750"
              >
                <Plus className="w-3.5 h-3.5" /> Append Parameter
              </button>
            </div>

            <div className="border border-slate-850 rounded-xl overflow-hidden bg-slate-950/20">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-950/50 text-left border-b border-slate-850 select-none text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                    <th className="w-12 py-2 text-center">Status</th>
                    <th className="py-2 px-3">Param Key</th>
                    <th className="py-2 px-3">Param Value</th>
                    <th className="w-12 py-2 pr-4 text-right">Delete</th>
                  </tr>
                </thead>
                <tbody>
                  {config.queryParams.map((row) => (
                    <tr key={row.id} className="border-b border-slate-850 hover:bg-slate-850/10">
                      <td className="py-1.5 text-center">
                        <input
                          type="checkbox"
                          checked={row.enabled}
                          onChange={() => toggleRowEnabled('queryParams', row.id)}
                          className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-0 bg-slate-950 border-slate-800"
                        />
                      </td>

                      <td className="py-1.5 px-3">
                        <input
                          type="text"
                          value={row.key}
                          placeholder="e.g. limit"
                          onChange={(e) => editRowField('queryParams', row.id, 'key', e.target.value)}
                          className="w-full bg-transparent text-xs text-slate-200 border-none focus:outline-none font-mono placeholder-slate-650"
                        />
                      </td>

                      <td className="py-1.5 px-3">
                        <input
                          type="text"
                          value={row.value}
                          placeholder="e.g. 50"
                          onChange={(e) => editRowField('queryParams', row.id, 'value', e.target.value)}
                          className="w-full bg-transparent text-xs text-slate-350 border-none focus:outline-none font-mono placeholder-slate-650"
                        />
                      </td>

                      <td className="py-1.5 pr-4 text-right">
                        <button
                          onClick={() => removeRowField('queryParams', row.id)}
                          className="text-slate-500 hover:text-rose-500 hover:bg-slate-800 p-1 rounded transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {config.queryParams.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center p-8 text-xs text-slate-550 border-none select-none">
                        No active query parameters configured. Standard GET parameters are synced automatically here from your Address inputs.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* AUTH PROFILES */}
        {activeTab === 'auth' && (
          <div className="flex flex-col gap-4 bg-slate-950/20 p-4 rounded-xl border border-slate-850 max-w-2xl">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider w-24">Type</label>
              <select
                value={config.auth.type}
                onChange={(e) => onChangeConfig({
                  ...config,
                  auth: { ...config.auth, type: e.target.value as AuthType }
                })}
                className="bg-slate-900 border border-slate-800 rounded-lg text-xs py-2 px-3 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-transparent cursor-pointer w-48 font-medium"
              >
                <option value="none">No Authorization</option>
                <option value="bearer">Bearer Token</option>
                <option value="basic">Basic Auth</option>
                <option value="apikey">API Key</option>
              </select>
            </div>

            {config.auth.type === 'none' && (
              <p className="text-xs text-slate-500 italic pl-1 flex items-center gap-2">
                <Shield className="w-4 h-4 text-slate-600" />
                This request will be sent without explicit authorization payloads. Configure header properties instead.
              </p>
            )}

            {/* BEARER TOKEN */}
            {config.auth.type === 'bearer' && (
              <div className="flex flex-col gap-1.5 pl-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Access Token secret</label>
                <input
                  type="text"
                  placeholder="e.g. {{bearer_token}} or raw jwt token value..."
                  value={config.auth.bearerToken || ''}
                  onChange={(e) => onChangeConfig({
                    ...config,
                    auth: { ...config.auth, bearerToken: e.target.value }
                  })}
                  className="bg-slate-900 border border-slate-800 rounded-lg py-2 px-3 text-xs font-mono text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-slate-650"
                />
                <p className="text-[10px] text-slate-600">Appended as <code className="text-indigo-400">Authorization: Bearer &lt;token&gt;</code> in final headers.</p>
              </div>
            )}

            {/* BASIC AUTH */}
            {config.auth.type === 'basic' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-1">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Username</label>
                  <input
                    type="text"
                    placeholder="e.g. {{username}}"
                    value={config.auth.basicUsername || ''}
                    onChange={(e) => onChangeConfig({
                      ...config,
                      auth: { ...config.auth, basicUsername: e.target.value }
                    })}
                    className="bg-slate-900 border border-slate-800 rounded-lg py-2 px-3 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-slate-650"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Password / Token</label>
                  <input
                    type="password"
                    placeholder="e.g. {{password}}"
                    value={config.auth.basicPassword || ''}
                    onChange={(e) => onChangeConfig({
                      ...config,
                      auth: { ...config.auth, basicPassword: e.target.value }
                    })}
                    className="bg-slate-900 border border-slate-800 rounded-lg py-2 px-3 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-slate-650"
                  />
                </div>
                <p className="text-[10px] text-slate-600 sm:col-span-2">Credentials will be Base64-encoded to yield basic authority headers.</p>
              </div>
            )}

            {/* API KEY */}
            {config.auth.type === 'apikey' && (
              <div className="flex flex-col gap-3 pl-1">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Header Key name</label>
                    <input
                      type="text"
                      placeholder="e.g. X-API-Key"
                      value={config.auth.apiKeyName || ''}
                      onChange={(e) => onChangeConfig({
                        ...config,
                        auth: { ...config.auth, apiKeyName: e.target.value }
                      })}
                      className="bg-slate-900 border border-slate-800 rounded-lg py-2 px-3 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-slate-650 font-mono"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Key value secret</label>
                    <input
                      type="text"
                      placeholder="e.g. {{my_secret_key}}"
                      value={config.auth.apiKeyValue || ''}
                      onChange={(e) => onChangeConfig({
                        ...config,
                        auth: { ...config.auth, apiKeyValue: e.target.value }
                      })}
                      className="bg-slate-900 border border-slate-800 rounded-lg py-2 px-3 text-xs text-slate-350 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-slate-650 font-mono"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider w-24">Add Key To</label>
                  <label className="flex items-center gap-1.5 text-xs text-slate-350 cursor-pointer">
                    <input
                      type="radio"
                      checked={config.auth.apiKeyAddTo === 'headers'}
                      onChange={() => onChangeConfig({
                        ...config,
                        auth: { ...config.auth, apiKeyAddTo: 'headers' }
                      })}
                      className="text-indigo-600 bg-slate-900"
                    /> Headers
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-slate-350 cursor-pointer">
                    <input
                      type="radio"
                      checked={config.auth.apiKeyAddTo === 'query'}
                      onChange={() => onChangeConfig({
                        ...config,
                        auth: { ...config.auth, apiKeyAddTo: 'query' }
                      })}
                      className="text-indigo-600 bg-slate-900"
                    /> Query parameters
                  </label>
                </div>
              </div>
            )}
          </div>
        )}

        {/* HEADERS */}
        {activeTab === 'headers' && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Custom Headers Specification</span>
              <button
                onClick={() => addRow('headers')}
                className="text-xs bg-slate-800/60 hover:bg-slate-800 text-indigo-400 py-1 px-2.5 rounded font-semibold cursor-pointer transition flex items-center gap-1 border border-slate-750"
              >
                <Plus className="w-3.5 h-3.5" /> Append Header
              </button>
            </div>

            <div className="border border-slate-850 rounded-xl overflow-hidden bg-slate-950/20">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-950/50 text-left border-b border-slate-850 select-none text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                    <th className="w-12 py-2 text-center">Status</th>
                    <th className="py-2 px-3">Header Name</th>
                    <th className="py-2 px-3">Header Value</th>
                    <th className="w-12 py-2 pr-4 text-right font-bold">Delete</th>
                  </tr>
                </thead>
                <tbody>
                  {config.headers.map((row) => (
                    <tr key={row.id} className="border-b border-slate-850 hover:bg-slate-850/10">
                      <td className="py-1.5 text-center">
                        <input
                          type="checkbox"
                          checked={row.enabled}
                          onChange={() => toggleRowEnabled('headers', row.id)}
                          className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-0 bg-slate-950 border-slate-800"
                        />
                      </td>

                      <td className="py-1.5 px-3">
                        <input
                          type="text"
                          value={row.key}
                          placeholder="e.g. Content-Type"
                          onChange={(e) => editRowField('headers', row.id, 'key', e.target.value)}
                          className="w-full bg-transparent text-xs text-slate-200 border-none focus:outline-none font-mono placeholder-slate-650"
                        />
                      </td>

                      <td className="py-1.5 px-3">
                        <input
                          type="text"
                          value={row.value}
                          placeholder="e.g. application/json"
                          onChange={(e) => editRowField('headers', row.id, 'value', e.target.value)}
                          className="w-full bg-transparent text-xs text-slate-350 border-none focus:outline-none font-mono placeholder-slate-650"
                        />
                      </td>

                      <td className="py-1.5 pr-4 text-right">
                        <button
                          onClick={() => removeRowField('headers', row.id)}
                          className="text-slate-500 hover:text-rose-500 hover:bg-slate-800 p-1 rounded transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {config.headers.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center p-8 text-xs text-slate-550 border-none select-none">
                        No custom headers added. Standard client headers will be auto-calculated.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* PAYLOAD BODY */}
        {activeTab === 'body' && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-4 border-b border-slate-850 pb-2">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 cursor-pointer">
                <input
                  type="radio"
                  checked={config.bodyType === 'none'}
                  onChange={() => onChangeConfig({ ...config, bodyType: 'none' })}
                  className="text-indigo-600 focus:ring-0"
                /> None
              </label>
              
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 cursor-pointer">
                <input
                  type="radio"
                  checked={config.bodyType === 'json'}
                  onChange={() => onChangeConfig({ ...config, bodyType: 'json' })}
                  className="text-indigo-600 focus:ring-0"
                /> JSON (raw)
              </label>

              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 cursor-pointer">
                <input
                  type="radio"
                  checked={config.bodyType === 'text'}
                  onChange={() => onChangeConfig({ ...config, bodyType: 'text' })}
                  className="text-indigo-600 focus:ring-0"
                /> Text (plain)
              </label>
            </div>

            {config.bodyType === 'none' && (
              <p className="text-xs text-slate-500 italic p-4 bg-slate-950/25 border border-slate-850 rounded-xl max-w-lg mt-2 flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-slate-650" /> This request does not carry any payload values in the BODY slot. Recommended for GET/DELETE/OPTIONS.
              </p>
            )}

            {(config.bodyType === 'json' || config.bodyType === 'text') && (
              <div className="flex flex-col gap-1.5 h-full">
                <textarea
                  id="raw-body-textarea"
                  value={config.body}
                  onChange={(e) => onChangeConfig({ ...config, body: e.target.value })}
                  placeholder={config.bodyType === 'json' ? '{\n  "name": "Jane Doe",\n  "job": "Lead architect"\n}' : 'Enter plain body content text...'}
                  rows={6}
                  className="w-full flex-1 bg-slate-950 text-slate-100 hover:border-slate-800/80 border border-slate-850 rounded-xl p-3 font-mono text-xs focus:outline-none focus:border-indigo-500 transition shadow-inner placeholder-slate-700 min-h-[140px] leading-5"
                />
                <p className="text-[10px] text-slate-650 mt-1 font-mono">
                  {config.bodyType === 'json' 
                    ? '✓ Ensure your JSON syntax matches standard raw objects {"key": "val"}. Pre-request scripting replaces expressions beforehand.' 
                    : '✓ Raw text content payload.'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* SCRIPTS AUTOMATION */}
        {activeTab === 'scripts' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* PRE REQUEST SCRIPT PANEL */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-350 flex items-center gap-1">
                  <FileCode className="w-4 h-4 text-indigo-400" />
                  Pre-request JS Sandbox Script
                </span>
                
                {/* Templates Selector */}
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      insertScriptTemplate('pre', e.target.value);
                      e.target.value = ''; // reset selection
                    }
                  }}
                  className="bg-slate-950 border border-slate-850 text-[10px] font-semibold text-slate-400 py-0.5 px-2 rounded hover:border-slate-700 cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">+ Macros Templates presets</option>
                  {SCRIPT_TEMPLATES.pre.map((t, idx) => (
                    <option key={`pre-t-${idx}`} value={t.code}>{t.name}</option>
                  ))}
                </select>
              </div>

              <textarea
                id="pre-request-script-textarea"
                value={config.preRequestScript}
                onChange={(e) => onChangeConfig({ ...config, preRequestScript: e.target.value })}
                placeholder="// Run actions BEFORE outbound query execution&#10;pm.environment.set(&quot;baseUrl&quot;, &quot;https://httpbin.org&quot;);&#10;pm.request.headers.set(&quot;X-Pre-Sent&quot;, &quot;True&quot;);"
                rows={6}
                className="w-full flex-1 bg-slate-950 text-slate-100 hover:border-slate-800/80 border border-slate-850 rounded-xl p-3 font-mono text-xs focus:outline-none focus:border-indigo-500 transition placeholder-slate-700 leading-5 min-h-[140px]"
              />
              <p className="text-[10px] text-slate-650 leading-relaxed font-sans">
                Operate on outbound requests. Supports <code className="text-slate-400 font-mono">pm.environment.set(k, v)</code> and <code className="text-slate-400 font-mono">pm.request.headers.set(k, v)</code>.
              </p>
            </div>

            {/* TESTS SCRIPT PANEL */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-350 flex items-center gap-1.5">
                  <Beaker className="w-4 h-4 text-amber-400 font-bold" />
                  Post-request/Assert script runner
                </span>

                {/* Templates Selector */}
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      insertScriptTemplate('post', e.target.value);
                      e.target.value = ''; // reset selection
                    }
                  }}
                  className="bg-slate-950 border border-slate-850 text-[10px] font-semibold text-slate-400 py-0.5 px-2 rounded hover:border-slate-700 cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">+ Macros Assertion templates</option>
                  {SCRIPT_TEMPLATES.post.map((t, idx) => (
                    <option key={`post-t-${idx}`} value={t.code}>{t.name}</option>
                  ))}
                </select>
              </div>

              <textarea
                id="post-request-script-textarea"
                value={config.postRequestScript}
                onChange={(e) => onChangeConfig({ ...config, postRequestScript: e.target.value })}
                placeholder="// Execute assertions AFTER response metrics arrive&#10;pm.test(&quot;HTTP status is 200&quot;, function () {&#10;    pm.expect(pm.response.code).to.equal(200);&#10;});"
                rows={6}
                className="w-full flex-1 bg-slate-950 text-slate-100 hover:border-slate-800/80 border border-slate-850 rounded-xl p-3 font-mono text-xs focus:outline-none focus:border-indigo-500 transition placeholder-slate-700 leading-5 min-h-[140px]"
              />
              <p className="text-[10px] text-slate-650 leading-relaxed font-sans">
                Assert results. Supports <code className="text-slate-400 font-mono">pm.expect(x).to.equal(y)</code>, <code className="text-slate-400 font-mono">pm.response.json()</code>, <code className="text-slate-400 font-mono">console.log(...)</code>, etc.
              </p>
            </div>
          </div>
        )}
      </div>
        </>
      )}
    </div>
  );
}
