/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ResponseData } from '../types';
import { Network, FileText, CheckCircle2, Terminal, ShieldAlert, AlignLeft, Globe, HelpCircle } from 'lucide-react';

interface ResponseViewerProps {
  response: ResponseData | null;
  isLoading: boolean;
}

export default function ResponseViewer({ response, isLoading }: ResponseViewerProps) {
  const [activeTab, setActiveTab] = useState<'body' | 'headers' | 'tests' | 'console'>('body');
  const [bodyFormat, setBodyFormat] = useState<'pretty' | 'raw'>('pretty');

  if (isLoading) {
    return (
      <div id="response_loader" className="flex-1 min-h-[300px] flex flex-col items-center justify-center p-8 bg-slate-950/20 text-slate-400 border border-slate-800 rounded-xl">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin mb-3"></div>
        <p className="text-sm font-medium animate-pulse">Awaiting API Server Return Payload...</p>
        <p className="text-xs text-slate-500 mt-1">Executing pre-request script and passing through CORS proxy gate...</p>
      </div>
    );
  }

  if (!response) {
    return (
      <div id="empty_response" className="flex-1 min-h-[300px] flex flex-col items-center justify-center p-12 bg-slate-950/20 text-slate-500 border border-slate-850 border-dashed rounded-xl select-none">
        <Network className="w-12 h-12 text-slate-750 mb-3 animate-pulse" />
        <p className="text-sm font-semibold text-slate-400">Response Console is Empty</p>
        <p className="text-xs text-slate-500 mt-1 max-w-sm text-center">Configure properties, define script test suites, and trigger "Send" to retrieve RESTful resources in real-time.</p>
      </div>
    );
  }

  // Auto parsing for preview formats
  const parsedBodyPreview = () => {
    if (!response.body) return '';
    if (bodyFormat === 'pretty') {
      try {
        const parsed = JSON.parse(response.body);
        return JSON.stringify(parsed, null, 2);
      } catch {
        return response.body;
      }
    }
    return response.body;
  };

  // Quick stats styling
  const statusColor = response.status >= 200 && response.status < 300 
    ? 'text-emerald-400 bg-emerald-950/50 border border-emerald-900/60' 
    : response.status >= 400 
      ? 'text-rose-405 bg-rose-955/50 border border-rose-900/60'
      : 'text-amber-400 bg-amber-950/50 border border-amber-900/60';

  const testPassedCount = response.tests.filter(t => t.passed).length;
  const testFailedCount = response.tests.filter(t => !t.passed).length;

  return (
    <div id="response_panel_root" className="bg-slate-950/65 rounded-xl border border-slate-800 flex flex-col shadow-lg overflow-hidden flex-1 min-h-0">
      {/* Response Header Section */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between border-b border-slate-850 px-4 py-3 bg-slate-950/50 gap-3">
        <div className="flex items-center gap-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            Server Response
          </h3>

          <div className="flex items-center gap-2">
            {/* Status */}
            <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${statusColor}`}>
              {response.status} {response.statusText}
            </span>

            {/* Timings */}
            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold text-indigo-400 bg-indigo-950/40 border border-indigo-900/30">
              {response.time} ms
            </span>

            {/* Size */}
            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold text-slate-300 bg-slate-900/60 border border-slate-800/60">
              {(response.size / 1024).toFixed(2)} KB
            </span>
          </div>
        </div>

        {/* View Tabs Selector */}
        <div className="flex items-center gap-1">
          <button
            id="tab-btn-body"
            onClick={() => setActiveTab('body')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition ${
              activeTab === 'body' 
                ? 'bg-slate-800 text-indigo-400' 
                : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
            }`}
          >
            <AlignLeft className="w-3.5 h-3.5" /> Body
          </button>
          
          <button
            id="tab-btn-headers"
            onClick={() => setActiveTab('headers')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition relative ${
              activeTab === 'headers' 
                ? 'bg-slate-800 text-indigo-400' 
                : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
            }`}
          >
            <Globe className="w-3.5 h-3.5" /> Headers
            <span className="text-[9px] bg-slate-800 text-slate-300 px-1 hover:bg-slate-700 rounded ml-1">
              {Object.keys(response.headers || {}).length}
            </span>
          </button>

          <button
            id="tab-btn-tests"
            onClick={() => setActiveTab('tests')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition relative ${
              activeTab === 'tests' 
                ? 'bg-slate-800 text-indigo-400' 
                : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" /> Tests
            {response.tests.length > 0 && (
              <span className={`text-[9.5px] px-1.5 py-0.2 rounded font-bold ml-1 ${
                testFailedCount > 0 ? 'bg-rose-950/60 text-rose-400' : 'bg-emerald-950/60 text-emerald-400'
              }`}>
                {testPassedCount}/{response.tests.length}
              </span>
            )}
          </button>

          <button
            id="tab-btn-console"
            onClick={() => setActiveTab('console')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition relative ${
              activeTab === 'console' 
                ? 'bg-slate-800 text-indigo-400' 
                : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" /> Sandbox Logs
            {response.logs.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-500 absolute -top-0.5 -right-0.5 animate-pulse"></span>
            )}
          </button>
        </div>
      </div>

      {/* Response Panel Body content scrollable */}
      <div className="flex-1 overflow-y-auto min-h-0 bg-slate-950/40 p-4">
        {/* BODY PANEL */}
        {activeTab === 'body' && (
          <div className="flex flex-col h-full gap-3">
            {/* Format controllers */}
            <div className="flex items-center justify-between border-b border-slate-900 pb-2 mb-2">
              <span className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold flex items-center gap-1">
                <FileText className="w-3 h-3" /> Content Payload Representation
              </span>
              <div className="flex bg-slate-900/60 p-0.5 rounded-md border border-slate-850">
                <button
                  onClick={() => setBodyFormat('pretty')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                    bodyFormat === 'pretty' ? 'bg-indigo-600/30 text-indigo-400' : 'text-slate-500 hover:text-slate-200'
                  }`}
                >
                  PRETTY JSON
                </button>
                <button
                  onClick={() => setBodyFormat('raw')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                    bodyFormat === 'raw' ? 'bg-indigo-600/30 text-indigo-400' : 'text-slate-500 hover:text-slate-200'
                  }`}
                >
                  RAW
                </button>
              </div>
            </div>

            {/* Raw body display */}
            <div className="flex-1 overflow-auto rounded-lg bg-slate-950 border border-slate-900 p-4 font-mono text-[11.5px] text-slate-350 select-text leading-5 break-words whitespace-pre-wrap">
              {parsedBodyPreview() || (
                <span className="text-slate-600 italic">Server returned an empty or void response body.</span>
              )}
            </div>
          </div>
        )}

        {/* HEADERS PANEL */}
        {activeTab === 'headers' && (
          <div className="flex flex-col">
            <div className="border border-slate-900 rounded-lg overflow-hidden bg-slate-950">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-900/60 text-left border-b border-slate-850 select-none text-[10px] font-bold text-slate-450 uppercase tracking-wider">
                    <th className="py-2.5 px-4 w-1/3">Header Key</th>
                    <th className="py-2.5 px-4 w-2/3">Header Value</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(response.headers || {}).map(([key, value]) => (
                    <tr key={key} className="border-b border-slate-900 hover:bg-slate-900/20">
                      <td className="py-2.5 px-4 font-mono text-xs text-indigo-400 font-medium break-all select-all select-text align-top">{key}</td>
                      <td className="py-2.5 px-4 font-mono text-xs text-slate-350 break-all select-all select-text align-top">{value}</td>
                    </tr>
                  ))}
                  {Object.keys(response.headers || {}).length === 0 && (
                    <tr>
                      <td colSpan={2} className="text-center p-8 text-xs text-slate-550 italic">
                        No headers returned in response metadata scope.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* AUTOMATED TEST DISCOVERY PANEL */}
        {activeTab === 'tests' && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-slate-450 uppercase tracking-wider">Test Suite Run Log</h4>
              <span className="text-[11px] font-medium text-slate-400">
                Success Rate: <b className="text-emerald-400">{testPassedCount} passed</b>, <b className="text-rose-400">{testFailedCount} failed</b>
              </span>
            </div>

            <div className="space-y-2">
              {response.tests.map((test, index) => (
                <div
                  key={`test-${index}`}
                  className={`flex items-start gap-3 p-3 rounded-lg border text-xs font-medium transition ${
                    test.passed 
                      ? 'bg-emerald-950/20 border-emerald-900/50 text-emerald-350' 
                      : 'bg-rose-955/20 border-rose-900/50 text-rose-350'
                  }`}
                >
                  <span className={`inline-block font-bold py-0.5 px-1.5 rounded text-[9px] uppercase ${
                    test.passed ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-955 text-rose-450 font-bold'
                  }`}>
                    {test.passed ? 'PASS' : 'FAIL'}
                  </span>
                  
                  <div className="flex-1">
                    <p className="font-semibold text-slate-200">{test.name}</p>
                    {test.error && (
                      <p className="font-mono text-[11px] text-rose-400 mt-1 pl-2 border-l border-rose-500 bg-rose-950/10 py-1.5 rounded">
                        Assertion Error: {test.error}
                      </p>
                    )}
                  </div>
                </div>
              ))}

              {response.tests.length === 0 && (
                <div className="flex flex-col items-center justify-center p-12 bg-slate-900/20 border border-slate-900 rounded-xl text-center">
                  <ShieldAlert className="w-8 h-8 text-slate-700 mb-1.5" />
                  <p className="text-xs font-semibold text-slate-450">No Script Tests Triggers</p>
                  <p className="text-[11px] text-slate-550 mt-1 max-w-sm">Define assertions inside the "Post-request Script" editor box using <code>pm.test()</code> syntax to run automated tests on API response payloads.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* SANDBOX CONSOLE LOG PANEL */}
        {activeTab === 'console' && (
          <div className="flex flex-col h-full bg-slate-950 border border-slate-900 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between bg-slate-900/70 py-1.5 px-3 border-b border-slate-900 select-none">
              <span className="text-[9.5px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 font-mono">
                [stdout/stderr] Interpreter Console Lines
              </span>
              <span className="text-[9px] text-indigo-400 bg-slate-950/80 px-1 py-0.2 rounded font-mono font-medium">
                SANDBOX IS COLLATED
              </span>
            </div>
            
            <div className="flex-1 overflow-auto p-4 font-mono text-[11px] leading-5 text-slate-350 space-y-1.5 select-text min-h-[220px]">
              {response.logs.map((log, index) => {
                let textClass = 'text-slate-400';
                if (log.includes('[Execution Error]') || log.includes('[Test Fail]')) {
                  textClass = 'text-rose-450 font-semibold';
                } else if (log.includes('[Test Pass]')) {
                  textClass = 'text-emerald-400 font-medium';
                } else if (log.includes('[Script]')) {
                  textClass = 'text-indigo-450';
                } else if (log.includes('[Console Error]')) {
                  textClass = 'text-amber-500';
                }
                
                return (
                  <div key={`log-${index}`} className={`font-mono border-b border-slate-900/20 pb-0.5 ${textClass}`}>
                    {log}
                  </div>
                );
              })}

              {response.logs.length === 0 && (
                <span className="text-slate-650 italic">Console is quiet. No stdout outputs generated.</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
