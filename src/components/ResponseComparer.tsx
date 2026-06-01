/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { HistoryItem } from '../types';
import { Columns, ArrowRightLeft, FileText, CheckCircle, AlertOctagon, HelpCircle } from 'lucide-react';

interface ResponseComparerProps {
  history: HistoryItem[];
}

export default function ResponseComparer({ history }: ResponseComparerProps) {
  const [leftId, setLeftId] = useState<string>('');
  const [rightId, setRightId] = useState<string>('');

  const leftItem = useMemo(() => history.find(item => item.id === leftId), [history, leftId]);
  const rightItem = useMemo(() => history.find(item => item.id === rightId), [history, rightId]);

  // Generate simple line-by-line comparison
  const bodyDiff = useMemo(() => {
    if (!leftItem || !rightItem) return null;

    let leftLines: string[] = [];
    let rightLines: string[] = [];

    // Attempt to format JSON for cleaner diff representation
    try {
      leftLines = JSON.stringify(JSON.parse(leftItem.response.body), null, 2).split('\n');
    } catch {
      leftLines = leftItem.response.body.split('\n');
    }

    try {
      rightLines = JSON.stringify(JSON.parse(rightItem.response.body), null, 2).split('\n');
    } catch {
      rightLines = rightItem.response.body.split('\n');
    }

    const maxLines = Math.max(leftLines.length, rightLines.length);
    const diffRows: {
      lineNumber: number;
      left: { text: string; status: 'equal' | 'modified' | 'empty' };
      right: { text: string; status: 'equal' | 'modified' | 'empty' };
    }[] = [];

    for (let i = 0; i < maxLines; i++) {
      const leftLine = leftLines[i] !== undefined ? leftLines[i] : null;
      const rightLine = rightLines[i] !== undefined ? rightLines[i] : null;

      if (leftLine === null) {
        diffRows.push({
          lineNumber: i + 1,
          left: { text: '', status: 'empty' },
          right: { text: rightLine || '', status: 'modified' }
        });
      } else if (rightLine === null) {
        diffRows.push({
          lineNumber: i + 1,
          left: { text: leftLine, status: 'modified' },
          right: { text: '', status: 'empty' }
        });
      } else if (leftLine !== rightLine) {
        diffRows.push({
          lineNumber: i + 1,
          left: { text: leftLine, status: 'modified' },
          right: { text: rightLine, status: 'modified' }
        });
      } else {
        diffRows.push({
          lineNumber: i + 1,
          left: { text: leftLine, status: 'equal' },
          right: { text: rightLine, status: 'equal' }
        });
      }
    }

    return diffRows.slice(0, 400); // Limit to 400 lines for visual efficiency
  }, [leftItem, rightItem]);

  // Headers Diffing Utility
  const headersComparison = useMemo(() => {
    if (!leftItem || !rightItem) {
      return { uniqueToLeft: [], uniqueToRight: [], matchingButDifferent: [], exactMatches: [] };
    }

    const leftHeaders = leftItem.response.headers || {};
    const rightHeaders = rightItem.response.headers || {};

    const uniqueToLeft: { key: string; value: string }[] = [];
    const uniqueToRight: { key: string; value: string }[] = [];
    const matchingButDifferent: { key: string; leftVal: string; rightVal: string }[] = [];
    const exactMatches: { key: string; value: string }[] = [];

    const allKeys = Array.from(new Set([...Object.keys(leftHeaders), ...Object.keys(rightHeaders)]));

    allKeys.forEach(key => {
      const parsedKey = key.toLowerCase();
      const inLeft = key in leftHeaders;
      const inRight = key in rightHeaders;

      if (inLeft && !inRight) {
        uniqueToLeft.push({ key, value: leftHeaders[key] });
      } else if (!inLeft && inRight) {
        uniqueToRight.push({ key, value: rightHeaders[key] });
      } else if (leftHeaders[key] !== rightHeaders[key]) {
        matchingButDifferent.push({ key, leftVal: leftHeaders[key], rightVal: rightHeaders[key] });
      } else {
        exactMatches.push({ key, value: leftHeaders[key] });
      }
    });

    return { uniqueToLeft, uniqueToRight, matchingButDifferent, exactMatches };
  }, [leftItem, rightItem]);

  return (
    <div id="response_comparer_view" className="flex flex-col h-full bg-slate-900 text-slate-100 p-6 overflow-y-auto">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-4 mb-6">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Columns className="w-5 h-5 text-indigo-400" />
            Response Comparison Tool
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Compare status codes, metadata headers, execution times, and payload bodies side-by-side.
          </p>
        </div>
      </div>

      {/* Selectors and Overview comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Left selector */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col gap-3">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
            Left Base Response (Target A)
          </label>
          <select
            id="left-history-selector"
            value={leftId}
            onChange={(e) => setLeftId(e.target.value)}
            className="w-full bg-slate-900 border border-slate-850 hover:border-slate-700 rounded-lg py-2 px-3 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">Select a previous request history item...</option>
            {history.map((item) => (
              <option key={`left-${item.id}`} value={item.id}>
                {item.config.method} {item.config.url.substring(0, 45)}{item.config.url.length > 45 ? '...' : ''} ({item.response.status} - {new Date(item.timestamp).toLocaleTimeString()})
              </option>
            ))}
          </select>

          {leftItem && (
            <div className="mt-3 grid grid-cols-3 gap-2 bg-slate-900 p-3 rounded-lg border border-slate-850">
              <div className="text-center">
                <span className="block text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Status</span>
                <span className={`inline-block font-mono text-sm font-semibold mt-1 px-2 py-0.5 rounded ${
                  leftItem.response.status >= 200 && leftItem.response.status < 300 
                    ? 'text-teal-400 bg-teal-950/40' 
                    : 'text-rose-400 bg-rose-950/40'
                }`}>
                  {leftItem.response.status}
                </span>
              </div>
              <div className="text-center border-x border-slate-800">
                <span className="block text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Latency</span>
                <span className="block font-mono text-xs font-semibold text-indigo-400 mt-1">
                  {leftItem.response.time} ms
                </span>
              </div>
              <div className="text-center">
                <span className="block text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Payload Size</span>
                <span className="block font-mono text-xs font-semibold text-slate-300 mt-1">
                  {(leftItem.response.size / 1024).toFixed(2)} KB
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Right selector */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col gap-3">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
            Right Target Response (Target B)
          </label>
          <select
            id="right-history-selector"
            value={rightId}
            onChange={(e) => setRightId(e.target.value)}
            className="w-full bg-slate-900 border border-slate-850 hover:border-slate-700 rounded-lg py-2 px-3 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">Select a previous request history item...</option>
            {history.map((item) => (
              <option key={`right-${item.id}`} value={item.id}>
                {item.config.method} {item.config.url.substring(0, 45)}{item.config.url.length > 45 ? '...' : ''} ({item.response.status} - {new Date(item.timestamp).toLocaleTimeString()})
              </option>
            ))}
          </select>

          {rightItem && (
            <div className="mt-3 grid grid-cols-3 gap-2 bg-slate-900 p-3 rounded-lg border border-slate-850">
              <div className="text-center">
                <span className="block text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Status</span>
                <span className={`inline-block font-mono text-sm font-semibold mt-1 px-2 py-0.5 rounded ${
                  rightItem.response.status >= 200 && rightItem.response.status < 300 
                    ? 'text-teal-400 bg-teal-950/40' 
                    : 'text-rose-400 bg-rose-950/40'
                }`}>
                  {rightItem.response.status}
                </span>
              </div>
              <div className="text-center border-x border-slate-800">
                <span className="block text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Latency</span>
                <span className="block font-mono text-xs font-semibold text-indigo-400 mt-1">
                  {rightItem.response.time} ms
                </span>
              </div>
              <div className="text-center">
                <span className="block text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Payload Size</span>
                <span className="block font-mono text-xs font-semibold text-slate-300 mt-1">
                  {(rightItem.response.size / 1024).toFixed(2)} KB
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {!leftItem || !rightItem ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12 bg-slate-950/40 rounded-xl border border-dashed border-slate-800 text-slate-500">
          <ArrowRightLeft className="w-12 h-12 text-slate-700 mb-3 animate-pulse" />
          <p className="text-sm font-medium text-slate-400">Two target history logs are required for comparison.</p>
          <p className="text-xs text-slate-500 mt-1">Please select the base and comparison requests above from the lists.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6 flex-1">
          {/* Quick Metrics Differences Card */}
          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Performance & Dimension Metrics
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-3 bg-slate-900 rounded-lg">
                <span className="text-xs text-slate-400 block">Status Diff</span>
                <span className="font-mono text-sm font-semibold mt-1 flex items-center gap-1.5">
                  {leftItem.response.status === rightItem.response.status ? (
                    <span className="text-teal-400 flex items-center gap-1"><CheckCircle className="w-4 h-4" /> Match</span>
                  ) : (
                    <span className="text-amber-400 flex items-center gap-1"><AlertOctagon className="w-4 h-4" /> {leftItem.response.status} vs {rightItem.response.status}</span>
                  )}
                </span>
              </div>

              <div className="p-3 bg-slate-900 rounded-lg">
                <span className="text-xs text-slate-400 block">Latency Delta</span>
                <span className="font-mono text-sm font-semibold mt-1 block">
                  {Math.abs(leftItem.response.time - rightItem.response.time)} ms{' '}
                  <span className="text-xs text-slate-500 font-normal">
                    ({leftItem.response.time < rightItem.response.time ? 'A is faster' : 'B is faster'})
                  </span>
                </span>
              </div>

              <div className="p-3 bg-slate-900 rounded-lg">
                <span className="text-xs text-slate-400 block">Size Delta</span>
                <span className="font-mono text-sm font-semibold mt-1 block">
                  {Math.abs(leftItem.response.size - rightItem.response.size).toLocaleString()} B{' '}
                  <span className="text-xs text-slate-500 font-normal">
                    ({leftItem.response.size > rightItem.response.size ? 'A is larger' : 'B is larger'})
                  </span>
                </span>
              </div>

              <div className="p-3 bg-slate-900 rounded-lg">
                <span className="text-xs text-slate-400 block">HTTP Method</span>
                <span className="font-mono text-sm font-semibold mt-1 text-slate-300 block">
                  {leftItem.config.method} {leftItem.config.method !== rightItem.config.method ? `vs ${rightItem.config.method}` : ''}
                </span>
              </div>
            </div>
          </div>

          {/* Headers Diff Panel */}
          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Metadata Headers Comparison
            </h3>

            {(headersComparison.uniqueToLeft.length === 0 &&
              headersComparison.uniqueToRight.length === 0 &&
              headersComparison.matchingButDifferent.length === 0) ? (
              <p className="text-xs text-teal-400 font-medium py-1">✓ Headers are exactly matches.</p>
            ) : (
              <div className="space-y-3 mt-3">
                {/* Modified values */}
                {headersComparison.matchingButDifferent.map(({ key, leftVal, rightVal }) => (
                  <div key={`mod-${key}`} className="text-xs border-l-2 border-amber-500 pl-3 py-1 bg-amber-950/10">
                    <span className="font-semibold text-slate-300">{key}:</span>
                    <div className="grid grid-cols-2 gap-4 mt-1 font-mono">
                      <div className="text-rose-400/80">A: <span className="underline">{leftVal}</span></div>
                      <div className="text-teal-400/80">B: <span className="underline">{rightVal}</span></div>
                    </div>
                  </div>
                ))}

                {/* Unique to Left */}
                {headersComparison.uniqueToLeft.map(({ key, value }) => (
                  <div key={`left-un-${key}`} className="text-xs border-l-2 border-rose-500 pl-3 py-1 bg-rose-950/10 font-mono">
                    <span className="font-semibold text-slate-300">{key}</span> <span className="text-rose-400 font-medium bg-rose-950/40 px-1.5 py-0.2 rounded text-[10px] uppercase ml-1">Unique to A</span>
                    <div className="text-slate-400 mt-0.5">{value}</div>
                  </div>
                ))}

                {/* Unique to Right */}
                {headersComparison.uniqueToRight.map(({ key, value }) => (
                  <div key={`right-un-${key}`} className="text-xs border-l-2 border-teal-500 pl-3 py-1 bg-teal-950/10 font-mono">
                    <span className="font-semibold text-slate-300">{key}</span> <span className="text-teal-400 font-medium bg-teal-950/40 px-1.5 py-0.2 rounded text-[10px] uppercase ml-1">Unique to B</span>
                    <div className="text-slate-400 mt-0.5">{value}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Line By Line body comparative renderer */}
          <div className="flex-1 flex flex-col bg-slate-950 rounded-xl border border-slate-800 overflow-hidden min-h-[400px]">
            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/60 p-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-4 h-4" />
                Line-by-Line Body Sandbox Diff (Left A vs Right B)
              </span>
              <div className="flex items-center gap-4 text-[10px] font-semibold tracking-wide">
                <span className="flex items-center gap-1 text-teal-400">● Modified/Added B</span>
                <span className="flex items-center gap-1 text-rose-400 font-semibold">● Modified/Removed A</span>
              </div>
            </div>

            <div className="flex-1 overflow-x-auto overflow-y-auto font-mono text-xs leading-5 select-text">
              <table className="w-full border-collapse">
                <tbody>
                  {bodyDiff?.map((row, index) => {
                    const isLeftMod = row.left.status === 'modified';
                    const isRightMod = row.right.status === 'modified';
                    
                    return (
                      <tr key={`diff-row-${index}`} className="hover:bg-slate-900/30 font-mono">
                        {/* Line number */}
                        <td className="w-10 text-right pr-3 select-none text-slate-600 border-r border-slate-900 align-top bg-slate-950/50">
                          {row.lineNumber}
                        </td>
                        
                        {/* Left split */}
                        <td className={`w-1/2 p-1 pl-4 align-top border-r border-slate-900 whitespace-pre-wrap break-all ${
                          isLeftMod ? 'bg-rose-950/30 text-rose-300 font-medium' : 'text-slate-400'
                        }`}>
                          {row.left.text}
                        </td>

                        {/* Right split */}
                        <td className={`w-1/2 p-1 pl-4 align-top whitespace-pre-wrap break-all ${
                          isRightMod ? 'bg-teal-950/30 text-teal-300 font-medium' : 'text-slate-400'
                        }`}>
                          {row.right.text}
                        </td>
                      </tr>
                    );
                  })}
                  {(!bodyDiff || bodyDiff.length === 0) && (
                    <tr>
                      <td colSpan={3} className="text-center p-8 text-slate-500 whitespace-nowrap">
                        Bodies are completely blank/null.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
