/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Columns, 
  History, 
  FolderHeart, 
  Keyboard, 
  Globe, 
  Trash2, 
  Folder, 
  Eye, 
  Settings, 
  Sparkles,
  Command,
  Plus,
  Bookmark,
  RefreshCw,
  Terminal,
  Save,
  Edit2,
  Moon,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  FolderPlus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { HttpMethod, RequestConfig, ResponseData, Environment, HistoryItem, SavedCollection, KeyValuePair, Tab } from './types';
import { executeScript, resolveRequestConfigVariables } from './utils/scriptRunner';
import RequestPanel from './components/RequestPanel';
import ResponseViewer from './components/ResponseViewer';
import ResponseComparer from './components/ResponseComparer';
import EnvironmentManager from './components/EnvironmentManager';

// Initial Environments Configs for Instant User Onboarding
const INITIAL_ENVIRONMENTS: Environment[] = [
  {
    id: 'env-prod',
    name: 'Production Cloud API',
    variables: [
      { id: 'v1', key: 'baseUrl', value: 'https://httpbin.org', enabled: true },
      { id: 'v2', key: 'defaultUser', value: 'chenguoming', enabled: true }
    ]
  },
  {
    id: 'env-mock',
    name: 'Staging Sandbox',
    variables: [
      { id: 'v3', key: 'baseUrl', value: 'https://httpbin.org', enabled: true },
      { id: 'v4', key: 'defaultUser', value: 'chenguoming-staging', enabled: true }
    ]
  }
];

// Initial default request config
const DEFAULT_REQUEST_CONFIG: RequestConfig = {
  method: 'GET',
  url: '{{baseUrl}}/get?email=chenguoming1@gmail.com',
  headers: [
    { id: 'h-1', key: 'Accept', value: 'application/json', enabled: true },
    { id: 'h-2', key: 'X-App-Client', value: 'ElectronSandboxApp', enabled: true }
  ],
  queryParams: [
    { id: 'q-1', key: 'email', value: 'chenguoming1@gmail.com', enabled: true }
  ],
  bodyType: 'none',
  body: '',
  formData: [],
  auth: { type: 'none' },
  preRequestScript: `// 1. Dynamic Variables setup (runs BEFORE outbound execution)
// Let's print out what is happening
console.log("Setting dynamic pre-sent header tokens...");

const calculatedStamp = Date.now().toString();
pm.request.headers.set("X-Executed-Timer", calculatedStamp);

// Let's modify baseUrl dynamics if active environment is selected
if (!pm.environment.has("baseUrl")) {
    pm.environment.set("baseUrl", "https://httpbin.org");
}`,
  postRequestScript: `// 2. Assertions suite (runs AFTER receiving endpoint return)
pm.test("Status is 200 OK", function () {
    pm.expect(pm.response.code).to.equal(200);
});

pm.test("Headers contain valid data content keys", function () {
    const contentType = pm.response.headers.get("Content-Type");
    pm.expect(contentType).to.include("json");
});

pm.test("Body values match user email parameters", function () {
    const data = pm.response.json();
    console.log("Retrieved content keys:", data.args);
    pm.expect(data.args.email).to.equal("chenguoming1@gmail.com");
});`
};

interface ThemeConfig {
  id: string;
  name: string;
  bgMain: string;
  bgSidebar: string;
  bgCard: string;
  textPrimary: string;
  textSecondary: string;
  borderClass: string;
  accentClass: string;
  accentHoverClass: string;
}

const PALETTE: Record<string, ThemeConfig> = {
  obsidian: {
    id: 'obsidian',
    name: 'Obsidian Dark',
    bgMain: 'bg-slate-950',
    bgSidebar: 'bg-slate-900',
    bgCard: 'bg-slate-900/40 border-slate-800/80',
    textPrimary: 'text-slate-100',
    textSecondary: 'text-slate-400',
    borderClass: 'border-slate-800/80',
    accentClass: 'bg-indigo-600 text-white hover:bg-indigo-505',
    accentHoverClass: 'hover:text-indigo-400'
  },
  cyberpunk: {
    id: 'cyberpunk',
    name: 'Cyberpunk Red',
    bgMain: 'bg-black',
    bgSidebar: 'bg-zinc-950',
    bgCard: 'bg-zinc-900/50 border-zinc-900',
    textPrimary: 'text-zinc-50',
    textSecondary: 'text-zinc-400',
    borderClass: 'border-cyan-950',
    accentClass: 'bg-cyan-600 text-black hover:bg-cyan-500',
    accentHoverClass: 'hover:text-cyan-400'
  },
  ocean: {
    id: 'ocean',
    name: 'Ocean Calm',
    bgMain: 'bg-sky-950',
    bgSidebar: 'bg-slate-950',
    bgCard: 'bg-slate-900/30 border-teal-950',
    textPrimary: 'text-teal-50',
    textSecondary: 'text-teal-400',
    borderClass: 'border-teal-950',
    accentClass: 'bg-teal-600 text-white hover:bg-teal-505',
    accentHoverClass: 'hover:text-teal-400'
  }
};

export default function App() {
  const [theme, setTheme] = useState<string>('obsidian');
  const [environments, setEnvironments] = useState<Environment[]>(INITIAL_ENVIRONMENTS);
  const [activeEnvId, setActiveEnvId] = useState<string>('env-prod');

  // Dynamic Tabs State
  const [tabs, setTabs] = useState<Tab[]>([
    {
      id: 'default-tab',
      name: 'Untitled',
      config: JSON.parse(JSON.stringify(DEFAULT_REQUEST_CONFIG)),
      response: null,
      isLoading: false,
      isChanged: false
    }
  ]);
  const [activeTabId, setActiveTabId] = useState<string>('default-tab');

  // Request-editor-active states synchronized reactively with active tab
  const [config, _setConfig] = useState<RequestConfig>(DEFAULT_REQUEST_CONFIG);
  const [response, _setResponse] = useState<ResponseData | null>(null);
  const [isLoading, _setIsLoading] = useState<boolean>(false);
  const [requestName, _setRequestName] = useState('Untitled');

  const setConfig = (newConfig: RequestConfig | ((prev: RequestConfig) => RequestConfig)) => {
    _setConfig(prev => {
      const resolved = typeof newConfig === 'function' ? newConfig(prev) : newConfig;
      setTabs(prevTabs => prevTabs.map(t => {
        if (t.id === activeTabId) {
          return { ...t, config: resolved, isChanged: true };
        }
        return t;
      }));
      return resolved;
    });
  };

  const setResponse = (newResponse: ResponseData | null | ((prev: ResponseData | null) => ResponseData | null)) => {
    _setResponse(prev => {
      const resolved = typeof newResponse === 'function' ? newResponse(prev) : newResponse;
      setTabs(prevTabs => prevTabs.map(t => {
        if (t.id === activeTabId) {
          return { ...t, response: resolved };
        }
        return t;
      }));
      return resolved;
    });
  };

  const setIsLoading = (newLoading: boolean | ((prev: boolean) => boolean)) => {
    _setIsLoading(prev => {
      const resolved = typeof newLoading === 'function' ? newLoading(prev) : newLoading;
      setTabs(prevTabs => prevTabs.map(t => {
        if (t.id === activeTabId) {
          return { ...t, isLoading: resolved };
        }
        return t;
      }));
      return resolved;
    });
  };

  const setRequestName = (newName: string | ((prev: string) => string)) => {
    _setRequestName(prev => {
      const resolved = typeof newName === 'function' ? newName(prev) : newName;
      setTabs(prevTabs => prevTabs.map(t => {
        if (t.id === activeTabId) {
          return { ...t, name: resolved, isChanged: true };
        }
        return t;
      }));
      return resolved;
    });
  };

  const handleSelectTab = (tabId: string) => {
    const targetTab = tabs.find(t => t.id === tabId);
    if (targetTab) {
      setActiveTabId(tabId);
      _setConfig(targetTab.config);
      _setResponse(targetTab.response);
      _setIsLoading(targetTab.isLoading);
      _setRequestName(targetTab.name);
    }
  };

  const handleCreateNewTab = () => {
    const newTabId = Math.random().toString(36).substr(2, 9);
    const newTab: Tab = {
      id: newTabId,
      name: 'Untitled',
      config: JSON.parse(JSON.stringify(DEFAULT_REQUEST_CONFIG)),
      response: null,
      isLoading: false,
      isChanged: false
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTabId);
    _setConfig(newTab.config);
    _setResponse(null);
    _setIsLoading(false);
    _setRequestName('Untitled');
  };

  const handleCloseTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tabs.length === 1) {
      const resetTab: Tab = {
        id: Math.random().toString(36).substr(2, 9),
        name: 'Untitled',
        config: JSON.parse(JSON.stringify(DEFAULT_REQUEST_CONFIG)),
        response: null,
        isLoading: false,
        isChanged: false
      };
      setTabs([resetTab]);
      setActiveTabId(resetTab.id);
      _setConfig(resetTab.config);
      _setResponse(null);
      _setIsLoading(false);
      _setRequestName('Untitled');
      return;
    }

    const targetIndex = tabs.findIndex(t => t.id === tabId);
    const nextTabs = tabs.filter(t => t.id !== tabId);
    setTabs(nextTabs);

    if (activeTabId === tabId) {
      const nextActiveIndex = targetIndex === 0 ? 0 : targetIndex - 1;
      const newActiveTab = nextTabs[nextActiveIndex];
      setActiveTabId(newActiveTab.id);
      _setConfig(newActiveTab.config);
      _setResponse(newActiveTab.response);
      _setIsLoading(newActiveTab.isLoading);
      _setRequestName(newActiveTab.name);
    }
  };

  const handleLoadQueryIntoTab = (associatedId: string, name: string, requestConfig: RequestConfig, existingResponse: ResponseData | null = null) => {
    const existingTab = tabs.find(t => t.associatedRequestId === associatedId);
    if (existingTab) {
      handleSelectTab(existingTab.id);
    } else {
      const newTabId = Math.random().toString(36).substr(2, 9);
      const newTab: Tab = {
        id: newTabId,
        name: name,
        config: JSON.parse(JSON.stringify(requestConfig)),
        response: existingResponse,
        isLoading: false,
        isChanged: false,
        associatedRequestId: associatedId
      };
      setTabs(prev => [...prev, newTab]);
      setActiveTabId(newTabId);
      _setConfig(newTab.config);
      _setResponse(newTab.response);
      _setIsLoading(newTab.isLoading);
      _setRequestName(newTab.name);
    }
    setActiveWorkspaceMode('dashboard');
  };

  const [sidebarTab, setSidebarTab] = useState<'history' | 'collections'>('history');
  
  // History list
  const [history, setHistory] = useState<HistoryItem[]>([]);
  // Saved collections list
  const [collections, setCollections] = useState<SavedCollection[]>([]);
  // Active selected view: 'dashboard' or 'diff'
  const [activeWorkspaceMode, setActiveWorkspaceMode] = useState<'dashboard' | 'diff'>('dashboard');

  // Collapsible subpanels state
  const [isRequestCollapsed, setIsRequestCollapsed] = useState(false);
  const [isResponseCollapsed, setIsResponseCollapsed] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Modals Toggles State
  const [isEnvManagerOpen, setIsEnvManagerOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [collectionNameInput, setCollectionNameInput] = useState('');
  const [saveTargetName, setSaveTargetName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState('Untitled');
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isSaveDropdownOpen, setIsSaveDropdownOpen] = useState(false);

  // Hydrate lists from localStorage on startup
  useEffect(() => {
    const cachedHistory = localStorage.getItem('api_request_history');
    if (cachedHistory) {
      try {
        setHistory(JSON.parse(cachedHistory));
      } catch {}
    }

    const cachedCollections = localStorage.getItem('api_saved_collections');
    if (cachedCollections) {
      try {
        setCollections(JSON.parse(cachedCollections));
      } catch {}
    } else {
      // Mock Collection setup on first run
      const defaultCollection: SavedCollection = {
        id: 'col-httpbin',
        name: 'HTTPBin General Endpoint Assertions',
        requests: [
          {
            id: 'col-req-get',
            name: 'GET arguments verification',
            config: DEFAULT_REQUEST_CONFIG
          },
          {
            id: 'col-req-jwt',
            name: 'Authorization Bearer Test mockup',
            config: {
              ...DEFAULT_REQUEST_CONFIG,
              method: 'POST',
              url: 'https://httpbin.org/post',
              bodyType: 'json',
              body: JSON.stringify({ tokenApplied: "{{defaultUser}}" }, null, 2),
              auth: { type: 'bearer', bearerToken: 'SECRET_API_JWTS_999' }
            }
          }
        ]
      };
      setCollections([defaultCollection]);
      localStorage.setItem('api_saved_collections', JSON.stringify([defaultCollection]));
    }
  }, []);

  // Keyboard Shortcuts Keydown Listeners Implementation
  useEffect(() => {
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      const isMac = navigator.userAgent.includes('Mac');
      const isTriggered = isMac ? e.metaKey : e.ctrlKey;

      if (isTriggered && e.key === 'Enter') {
        e.preventDefault();
        handleSendRequest();
      } else if (isTriggered && e.key === 'e') {
        e.preventDefault();
        setIsEnvManagerOpen(prev => !prev);
      } else if (isTriggered && e.key === 'h') {
        e.preventDefault();
        handleDeleteAllHistory();
      } else if (isTriggered && dKeyMatch(e)) {
        e.preventDefault();
        setActiveWorkspaceMode(prev => prev === 'dashboard' ? 'diff' : 'dashboard');
      } else if (e.key === '?') {
        if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
          e.preventDefault();
          setIsShortcutsOpen(prev => !prev);
        }
      }
    };

    const dKeyMatch = (e: KeyboardEvent) => e.key.toLowerCase() === 'd';

    window.addEventListener('keydown', handleGlobalShortcuts);
    return () => window.removeEventListener('keydown', handleGlobalShortcuts);
  }, [config, environments, activeEnvId, history]);

  // Outbound Network API Request Transaction Handler
  const handleSendRequest = async () => {
    if (isLoading) return;
    setIsLoading(true);
    setResponse(null);

    const activeEnv = environments.find(e => e.id === activeEnvId);
    let environmentVars = activeEnv ? activeEnv.variables : [];

    try {
      // 1. Run Pre-request JS Script
      const preScriptResult = executeScript(
        'pre', 
        config.preRequestScript, 
        config, 
        environmentVars
      );

      // Save mutated script variables back to Environment scope
      if (activeEnv) {
        const updatedEnvironments = environments.map(env => {
          if (env.id === activeEnvId) {
            return { ...env, variables: preScriptResult.modifiedVariables };
          }
          return env;
        });
        setEnvironments(updatedEnvironments);
        environmentVars = preScriptResult.modifiedVariables;
      }

      // 2. Resolve Environment Brackets Placeholder
      const resolvedConfig = resolveRequestConfigVariables(
        preScriptResult.modifiedConfig, 
        environmentVars
      );

      // Synthesize final Headers Payload
      const requestHeaders: Record<string, string> = {};
      resolvedConfig.headers.forEach(h => {
        if (h.enabled && h.key) {
          requestHeaders[h.key] = h.value;
        }
      });

      // Bind body metadata ContentTypes
      if (resolvedConfig.bodyType === 'json') {
        requestHeaders['Content-Type'] = 'application/json';
      } else if (resolvedConfig.bodyType === 'text') {
        requestHeaders['Content-Type'] = 'text/plain';
      }

      // Authorization Profile Injection
      if (resolvedConfig.auth.type === 'bearer' && resolvedConfig.auth.bearerToken) {
        requestHeaders['Authorization'] = `Bearer ${resolvedConfig.auth.bearerToken}`;
      } else if (resolvedConfig.auth.type === 'basic' && resolvedConfig.auth.basicUsername) {
        const encoded = btoa(`${resolvedConfig.auth.basicUsername}:${resolvedConfig.auth.basicPassword || ''}`);
        requestHeaders['Authorization'] = `Basic ${encoded}`;
      } else if (resolvedConfig.auth.type === 'apikey' && resolvedConfig.auth.apiKeyName && resolvedConfig.auth.apiKeyValue) {
        if (resolvedConfig.auth.apiKeyAddTo === 'headers') {
          requestHeaders[resolvedConfig.auth.apiKeyName] = resolvedConfig.auth.apiKeyValue;
        } else {
          // Add API Key variable dynamically to query url parameters
          try {
            const urlObj = new URL(resolvedConfig.url);
            urlObj.searchParams.append(resolvedConfig.auth.apiKeyName, resolvedConfig.auth.apiKeyValue);
            resolvedConfig.url = urlObj.toString();
          } catch {}
        }
      }

      // 3. Dispatch to Server-Side CORS Bypass Route Gate
      const proxyServerEndpoint = '/api/proxy';
      const proxyResponse = await fetch(proxyServerEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: resolvedConfig.url,
          method: resolvedConfig.method,
          headers: requestHeaders,
          body: resolvedConfig.bodyType !== 'none' ? resolvedConfig.body : undefined
        })
      });

      const proxyData = await proxyResponse.json();

      if (proxyData.error) {
        throw new Error(proxyData.error);
      }

      // 4. Run Post-response Tests script assertions
      const postScriptResult = executeScript(
        'post',
        config.postRequestScript,
        resolvedConfig,
        environmentVars,
        proxyData
      );

      // Sync variables back again
      if (activeEnv) {
        const updatedEnvironments = environments.map(env => {
          if (env.id === activeEnvId) {
            return { ...env, variables: postScriptResult.modifiedVariables };
          }
          return env;
        });
        setEnvironments(updatedEnvironments);
      }

      // Package Response results back visually
      const formattedResponse: ResponseData = {
        status: proxyData.status,
        statusText: proxyData.statusText,
        headers: proxyData.headers,
        body: proxyData.body,
        time: proxyData.time,
        size: proxyData.size,
        logs: [...preScriptResult.logs, ...postScriptResult.logs],
        tests: postScriptResult.tests
      };

      setResponse(formattedResponse);

      // Record to history tracking catalog
      const newHistoryItem: HistoryItem = {
        id: Math.random().toString(36).substr(2, 9),
        config: JSON.parse(JSON.stringify(config)),
        response: formattedResponse,
        timestamp: Date.now()
      };

      const updatedHistory = [newHistoryItem, ...history];
      setHistory(updatedHistory);
      localStorage.setItem('api_request_history', JSON.stringify(updatedHistory));

    } catch (err: any) {
      // Graceful assertion failures packages
      const errorResult: ResponseData = {
        status: 0,
        statusText: 'CORS/Connection Outage',
        headers: {},
        body: `Communication Gateway Fault: ${err.message}`,
        time: 0,
        size: 0,
        logs: [`[Transmission Error] Network handshake failed: ${err.message}`],
        tests: [{ name: 'Handshake completed', passed: false, error: err.message }]
      };
      setResponse(errorResult);
    } finally {
      setIsLoading(false);
    }
  };

  // Safe variables environments update
  const handleUpdateEnvironments = (updated: Environment[]) => {
    setEnvironments(updated);
    // Persist environments if needed inside future iterations (localStorage fits great)
    localStorage.setItem('api_saved_environments', JSON.stringify(updated));
  };

  // Retrieve item from history to load back into active input workspace
  const handleReuseHistoryRequest = (item: HistoryItem) => {
    const urlPath = item.config.url 
      ? item.config.url.replace(/^(https?:\/\/)?(www\.)?/, '').substring(0, 30) 
      : 'Query';
    const label = item.label || `${item.config.method} — ${urlPath || 'item'}`;
    handleLoadQueryIntoTab(item.id, label, item.config, item.response);
  };

  // Deleting catalog
  const handleDeleteHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const filtered = history.filter(h => h.id !== id);
    setHistory(filtered);
    localStorage.setItem('api_request_history', JSON.stringify(filtered));
  };

  const handleDeleteAllHistory = () => {
    setHistory([]);
    localStorage.removeItem('api_request_history');
  };

  // Saved Collection helpers
  const handleCreateCollection = () => {
    if (!collectionNameInput.trim()) return;
    const newCol: SavedCollection = {
      id: Math.random().toString(36).substr(2, 9),
      name: collectionNameInput.trim(),
      requests: []
    };
    const updated = [...collections, newCol];
    setCollections(updated);
    setCollectionNameInput('');
    localStorage.setItem('api_saved_collections', JSON.stringify(updated));
  };

  const handleSaveActiveRequestToCollection = (colId: string, customRequestName: string = '') => {
    const finalName = customRequestName.trim() || requestName.trim() || 'Untitled';
    const newReqId = Math.random().toString(36).substr(2, 9);
    const updated = collections.map(col => {
      if (col.id === colId) {
        return {
          ...col,
          requests: [
            ...col.requests,
            {
              id: newReqId,
              name: finalName,
              config: JSON.parse(JSON.stringify(config))
            }
          ]
        };
      }
      return col;
    });
    setCollections(updated);
    _setRequestName(finalName);
    
    // Clear unsaved changes flag and bind active requestId reference
    setTabs(prevTabs => prevTabs.map(t => {
      if (t.id === activeTabId) {
        return { ...t, name: finalName, associatedRequestId: newReqId, isChanged: false };
      }
      return t;
    }));

    localStorage.setItem('api_saved_collections', JSON.stringify(updated));
    setIsSaveModalOpen(false);
  };

  const handleSaveToNewCollection = (newColName: string, customRequestName: string = '') => {
    if (!newColName.trim()) return;
    const finalName = customRequestName.trim() || requestName.trim() || 'Untitled';
    const newColId = Math.random().toString(36).substr(2, 9);
    const newReqId = Math.random().toString(36).substr(2, 9);
    
    const newCol: SavedCollection = {
      id: newColId,
      name: newColName.trim(),
      requests: [
        {
          id: newReqId,
          name: finalName,
          config: JSON.parse(JSON.stringify(config))
        }
      ]
    };
    
    const updated = [...collections, newCol];
    setCollections(updated);
    _setRequestName(finalName);

    // Clear unsaved changes flag and bind active requestId reference
    setTabs(prevTabs => prevTabs.map(t => {
      if (t.id === activeTabId) {
        return { ...t, name: finalName, associatedRequestId: newReqId, isChanged: false };
      }
      return t;
    }));

    localStorage.setItem('api_saved_collections', JSON.stringify(updated));
    setIsSaveModalOpen(false);
  };

  const handleDirectSaveActiveRequest = () => {
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (!activeTab) return;

    let foundCollectionId: string | null = null;
    let foundRequestId: string | null = null;
    
    if (activeTab.associatedRequestId) {
      for (const col of collections) {
        const matchingReq = col.requests.find(r => r.id === activeTab.associatedRequestId);
        if (matchingReq) {
          foundCollectionId = col.id;
          foundRequestId = matchingReq.id;
          break;
        }
      }
    }

    if (foundCollectionId && foundRequestId) {
      const finalName = requestName.trim() || 'Untitled';
      const updated = collections.map(col => {
        if (col.id === foundCollectionId) {
          return {
            ...col,
            requests: col.requests.map(r => {
              if (r.id === foundRequestId) {
                return {
                  ...r,
                  name: finalName,
                  config: JSON.parse(JSON.stringify(config))
                };
              }
              return r;
            })
          };
        }
        return col;
      });
      setCollections(updated);
      _setRequestName(finalName);
      
      // Update active tab changed properties
      setTabs(prevTabs => prevTabs.map(t => {
        if (t.id === activeTabId) {
          return { ...t, name: finalName, isChanged: false };
        }
        return t;
      }));
      
      localStorage.setItem('api_saved_collections', JSON.stringify(updated));
    } else {
      // Unassociated request -> act as Save As
      setSaveTargetName(requestName);
      setIsSaveModalOpen(true);
    }
  };

  const handleRemoveCollection = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const filtered = collections.filter(c => c.id !== id);
    setCollections(filtered);
    localStorage.setItem('api_saved_collections', JSON.stringify(filtered));
  };

  const selectedTheme = PALETTE[theme] || PALETTE.obsidian;

  return (
    <div className={`h-screen w-screen flex flex-col ${selectedTheme.bgMain} ${selectedTheme.textPrimary} font-sans overflow-hidden transition-colors duration-200`}>
      
      {/* Frameless Desktop/Electron Style App Header */}
      <header className={`h-12 border-b ${selectedTheme.borderClass} ${selectedTheme.bgSidebar} px-4 flex items-center justify-between select-none flex-shrink-0 relative`}>
        {/* macOS Traffic lights mock aesthetics */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-rose-500 opacity-80" />
            <span className="w-3 h-3 rounded-full bg-amber-500 opacity-80" />
            <span className="w-3 h-3 rounded-full bg-emerald-500 opacity-80" />
          </div>

          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-indigo-400" />
            <h1 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
              API Sandbox Platform
              <span className="text-[9.5px] bg-slate-800 text-slate-300 font-bold px-2 py-0.5 rounded border border-slate-750">
                ELECTRON CHASSIS
              </span>
            </h1>
          </div>
        </div>

        {/* Global Control Center Toolbar */}
        <div className="flex items-center gap-4">
          
          {/* Active scope environmental selection dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-450 uppercase font-semibold">Scope:</span>
            <select
              id="active-env-dropdown"
              value={activeEnvId}
              onChange={(e) => setActiveEnvId(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg text-xs font-semibold py-1 px-3 text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="">No Active Scope Variables</option>
              {environments.map(env => (
                <option key={env.id} value={env.id}>{env.name}</option>
              ))}
            </select>
            <button
              id="open-env-mgr-btn"
              title="Manage Environment variables"
              onClick={() => setIsEnvManagerOpen(true)}
              className="p-1 px-2 border border-slate-800 hover:border-slate-705 rounded-lg text-xs font-semibold text-slate-300 bg-slate-950/65 flex items-center gap-1 transition-all cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5" /> Configure Variables
            </button>
          </div>

          <div className="border-l border-slate-800 h-5" />

          {/* Theme Selector */}
          <div className="flex items-center gap-2">
            <Moon className="w-3.5 h-3.5 text-indigo-400" />
            <select
              id="theme-select"
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg text-xs py-1 px-2.5 text-slate-350 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="obsidian">Slate Obsidian</option>
              <option value="cyberpunk">Midnight Cyberpunk</option>
              <option value="ocean">Calm Ocean Deep</option>
            </select>
          </div>

          {/* Shortcuts helpful guide trigger */}
          <button
            id="shortcuts-trigger-btn"
            title="Shortcuts guide"
            onClick={() => setIsShortcutsOpen(true)}
            className="text-slate-400 hover:text-indigo-400 p-1.5 rounded-lg hover:bg-slate-800 cursor-pointer transition flex items-center gap-1"
          >
            <Keyboard className="w-4 h-4" />
            <span className="text-xs font-semibold">Shortcuts</span>
          </button>
        </div>
      </header>

      {/* Main Framework body */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        
        {/* Left Side Catalog Sidebar Navigation */}
        <aside className={`transition-all duration-200 ${isSidebarCollapsed ? 'w-14' : 'w-80'} border-r ${selectedTheme.borderClass} ${selectedTheme.bgSidebar} flex flex-col justify-between flex-shrink-0 min-h-0 select-none overflow-hidden relative`}>
          {isSidebarCollapsed ? (
            <div className="flex-1 flex flex-col items-center py-4 gap-6 animate-fadeIn">
              {/* Expand Toggle Trigger button */}
              <button
                id="expand-sidebar-btn"
                onClick={() => setIsSidebarCollapsed(false)}
                className="p-2 text-slate-450 hover:text-indigo-400 hover:bg-slate-800/55 rounded-lg transition-all cursor-pointer"
                title="Expand Catalog Sidebar"
              >
                <ChevronRight className="w-5 h-5" />
              </button>

              <div className="w-8 border-b border-slate-808" />

              {/* Mini Interactive Icons to toggle with expand */}
              <button
                onClick={() => {
                  setSidebarTab('history');
                  setIsSidebarCollapsed(false);
                }}
                className={`p-2.5 rounded-xl transition cursor-pointer relative group ${
                  sidebarTab === 'history' ? 'bg-slate-800 text-indigo-400 border border-slate-750' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900/50'
                }`}
                title="Request Run History"
              >
                <History className="w-5 h-5" />
                {history.length > 0 && (
                  <span className="absolute -top-1 -right-2 bg-indigo-600 border border-slate-950 text-white font-mono text-[9px] font-bold px-1.5 py-0.2 rounded-full min-w-4 text-center">
                    {history.length}
                  </span>
                )}
                <div className="absolute left-16 top-1/2 -translate-y-1/2 bg-slate-900 border border-slate-800 text-slate-200 text-[10px] font-bold px-2 py-1 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-20">
                  History Catalog ({history.length})
                </div>
              </button>

              <button
                onClick={() => {
                  setSidebarTab('collections');
                  setIsSidebarCollapsed(false);
                }}
                className={`p-2.5 rounded-xl transition cursor-pointer relative group ${
                  sidebarTab === 'collections' ? 'bg-slate-800 text-indigo-400 border border-slate-750' : 'text-slate-500 hover:text-slate-330 hover:bg-slate-900/50'
                }`}
                title="Saves & Collections"
              >
                <FolderHeart className="w-5 h-5" />
                <div className="absolute left-16 top-1/2 -translate-y-1/2 bg-slate-900 border border-slate-800 text-slate-200 text-[10px] font-bold px-2 py-1 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-20">
                  Saved Collections
                </div>
              </button>

              <button
                onClick={() => {
                  setIsSidebarCollapsed(false);
                  setActiveWorkspaceMode(activeWorkspaceMode === 'dashboard' ? 'diff' : 'dashboard');
                }}
                className={`p-2.5 rounded-xl transition cursor-pointer relative group ${
                  activeWorkspaceMode === 'diff' ? 'bg-indigo-650 text-white border border-indigo-400/30' : 'text-slate-500 hover:text-slate-330 hover:bg-slate-900/50'
                }`}
                title="Response Comparative Arena"
              >
                <Columns className="w-5 h-5" />
                <div className="absolute left-16 top-1/2 -translate-y-1/2 bg-slate-900 border border-slate-800 text-slate-200 text-[10px] font-bold px-2 py-1 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-20">
                  {activeWorkspaceMode === 'diff' ? 'Show Workspace' : 'Diff Arena'}
                </div>
              </button>
            </div>
          ) : (
            <>
              <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                {/* Nav Headers switch */}
                <div className="p-3 border-b border-slate-800/80 bg-slate-950/40 flex items-center justify-between gap-1.5 flex-wrap">
                  <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-850">
                    <button
                      id="tab-btn-history"
                      onClick={() => setSidebarTab('history')}
                      className={`flex items-center gap-1.5 py-1 px-3 rounded-md text-xs font-bold transition cursor-pointer ${
                        sidebarTab === 'history' ? 'bg-slate-850 text-indigo-400' : 'text-slate-500 hover:text-slate-350'
                      }`}
                    >
                      <History className="w-3.5 h-3.5" /> History
                    </button>
                    <button
                      id="tab-btn-collections"
                      onClick={() => setSidebarTab('collections')}
                      className={`flex items-center gap-1.5 py-1 px-3 rounded-md text-xs font-bold transition cursor-pointer ${
                        sidebarTab === 'collections' ? 'bg-slate-850 text-indigo-400' : 'text-slate-500 hover:text-slate-350'
                      }`}
                    >
                      <FolderHeart className="w-3.5 h-3.5" /> Collections
                    </button>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    {/* Response differences toggle */}
                    <button
                      id="toggle-diff-ws-btn"
                      onClick={() => {
                        setActiveWorkspaceMode(prev => prev === 'dashboard' ? 'diff' : 'dashboard');
                      }}
                      className={`py-1 px-2.5 rounded-lg text-[11px] font-bold border transition duration-150 cursor-pointer ${
                        activeWorkspaceMode === 'diff' 
                          ? 'bg-indigo-600 border-indigo-400 text-white' 
                          : 'border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      Diff
                    </button>

                    {/* Collapse Button */}
                    <button
                      id="collapse-sidebar-btn"
                      title="Collapse Sidebar"
                      onClick={() => setIsSidebarCollapsed(true)}
                      className="p-1 px-1.5 border border-slate-800/80 hover:border-slate-700 text-slate-400 hover:text-indigo-400 rounded-lg bg-slate-950 transition cursor-pointer"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* List Catalog displays scrollable */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
              
              {/* HISTORY DISCOVERY LIST */}
              {sidebarTab === 'history' && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between px-1 mb-2">
                    <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Previous request items</span>
                    {history.length > 0 && (
                      <button
                        onClick={handleDeleteAllHistory}
                        className="text-[10px] text-rose-500 hover:text-rose-450 font-bold transition flex items-center gap-1 cursor-pointer"
                      >
                        ✕ Clear Logs
                      </button>
                    )}
                  </div>

                  {history.map((item) => {
                    const methodColor = 
                      item.config.method === 'GET' ? 'text-teal-400' :
                      item.config.method === 'POST' ? 'text-indigo-400' :
                      item.config.method === 'PUT' ? 'text-amber-400' : 'text-rose-400';

                    return (
                      <div
                        key={item.id}
                        onClick={() => handleReuseHistoryRequest(item)}
                        className="group flex flex-col p-2.5 rounded-xl border border-slate-850 bg-slate-950/20 hover:bg-slate-850/60 cursor-pointer transition text-left"
                      >
                        <div className="flex items-center justify-between text-xs mb-1 font-mono">
                          <span className={`font-bold ${methodColor}`}>{item.config.method}</span>
                          <span className={`text-[10px] font-semibold ${
                            item.response.status >= 200 && item.response.status < 300 
                              ? 'text-teal-400' 
                              : 'text-rose-400'
                          }`}>
                            {item.response.status}
                          </span>
                        </div>
                        <p className="text-[11px] font-medium text-slate-350 truncate font-mono">
                          {item.config.url}
                        </p>
                        <div className="flex items-center justify-between text-[10px] text-slate-500 mt-2">
                          <span>{new Date(item.timestamp).toLocaleTimeString()}</span>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-slate-400 font-semibold">{item.response.time}ms</span>
                            <button
                              title="Delete Item"
                              onClick={(e) => handleDeleteHistoryItem(item.id, e)}
                              className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-500 transition cursor-pointer p-0.5 rounded hover:bg-slate-800"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {history.length === 0 && (
                    <div className="text-center text-slate-600 text-xs py-12 px-4 italic">
                      No requests tracked yet. Trigger "Send" on custom API endpoints.
                    </div>
                  )}
                </div>
              )}

              {/* SAVE COLLECTIONS LIST */}
              {sidebarTab === 'collections' && (
                <div className="space-y-3">
                  {/* Create input */}
                  <div className="p-2 border border-slate-850 bg-slate-950/40 rounded-xl space-y-2">
                    <span className="text-[9.5px] text-slate-500 uppercase tracking-widest font-bold block">Create Folder Collection</span>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        placeholder="Collection name..."
                        value={collectionNameInput}
                        onChange={(e) => setCollectionNameInput(e.target.value)}
                        className="flex-1 bg-slate-900 border border-slate-800 rounded-lg py-1 px-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      <button
                        onClick={handleCreateCollection}
                        className="bg-indigo-600 hover:bg-indigo-505 text-white p-1 rounded-lg text-xs font-semibold flex items-center justify-center cursor-pointer px-2.5"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Collections folders map */}
                  <div className="space-y-2">
                    {collections.map((col) => (
                      <div key={col.id} className="border border-slate-850/60 rounded-xl bg-slate-950/20 overflow-hidden">
                        <div className="flex items-center justify-between p-2 px-3 bg-slate-950/40 border-b border-slate-850/60 select-none">
                          <div className="flex items-center gap-1.5 overflow-hidden">
                            <Folder className="w-3.5 h-3.5 text-indigo-400" />
                            <span className="text-xs font-bold text-slate-300 truncate">{col.name}</span>
                          </div>
                          
                          <button
                            title="Delete Collection"
                            onClick={(e) => handleRemoveCollection(col.id, e)}
                            className="text-slate-500 hover:text-rose-500 p-0.5 rounded cursor-pointer transition"
                          >
                            ✕
                          </button>
                        </div>

                        <div className="p-2 space-y-1">
                          {col.requests.map((req) => (
                            <div
                              key={req.id}
                              onClick={() => {
                                handleLoadQueryIntoTab(req.id, req.name, req.config, null);
                              }}
                              className="flex items-center justify-between p-1.5 rounded-lg text-[11px] font-medium hover:bg-slate-850/60 text-slate-350 cursor-pointer transition text-left"
                            >
                              <div className="flex items-center gap-1.5 overflow-hidden font-mono">
                                <span className={`text-[9.5px] font-bold ${
                                  req.config.method === 'GET' ? 'text-teal-400' :
                                  req.config.method === 'POST' ? 'text-indigo-400' : 'text-amber-400'
                                }`}>{req.config.method}</span>
                                <span className="truncate text-slate-300">{req.name}</span>
                              </div>
                              <ChevronRight className="w-3 h-3 text-slate-600" />
                            </div>
                          ))}

                          {col.requests.length === 0 && (
                            <p className="text-[10px] text-slate-600 text-center py-4 italic">Folder is empty.</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

              {/* Collated Quick Variables Info status */}
              {activeWorkspaceMode === 'dashboard' && (
                <div className="p-4 bg-slate-950/40 border-t border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Active Variables scope</span>
                    <button
                      onClick={() => setIsEnvManagerOpen(true)}
                      className="text-[10px] text-indigo-450 hover:text-indigo-400 font-bold transition flex items-center gap-0.5 cursor-pointer"
                    >
                      Edit variables
                    </button>
                  </div>

                  <div className="max-h-24 overflow-y-auto space-y-1">
                    {environments.find(e => e.id === activeEnvId)?.variables.filter(v => v.enabled).map(v => (
                      <div key={v.id} className="flex justify-between font-mono text-[10.5px] border-b border-slate-900 pb-0.5" title={`${v.key}: ${v.value}`}>
                        <span className="text-slate-400 font-semibold truncate w-1/2">{"{{"}{v.key}{"}}"}</span>
                        <span className="text-slate-500 truncate w-1/2 text-right">{v.value}</span>
                      </div>
                    ))}
                    {(!activeEnvId || environments.find(e => e.id === activeEnvId)?.variables.filter(v => v.enabled).length === 0) && (
                      <p className="text-[10px] text-slate-600 text-center italic py-2">No active variables loaded.</p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </aside>

        {/* Central Primary Layout Panels */}
        <main className="flex-1 flex flex-col p-4 overflow-hidden min-h-0 min-w-0 bg-slate-950/20">
          
          {/* Dynamic Request Tabs Navigation bar */}
          <div className="flex items-center justify-between border-b border-slate-800/40 pb-1.5 mb-2 flex-shrink-0 select-none gap-4">
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-thin max-w-full py-0.5 pr-2">
              {tabs.map((tab) => {
                const isActive = tab.id === activeTabId;
                return (
                  <div
                    key={tab.id}
                    onClick={() => handleSelectTab(tab.id)}
                    className={`group flex items-center gap-2 pl-3 px-2 py-1.5 rounded-lg border text-xs font-semibold transition cursor-pointer select-none whitespace-nowrap ${
                      isActive
                        ? 'bg-slate-900 border-slate-750 text-indigo-400 shadow-sm'
                        : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
                    }`}
                  >
                    <span className="truncate max-w-[120px]">
                      {tab.name}
                    </span>
                    
                    {tab.isChanged && (
                      <span 
                        className="text-amber-500 font-bold font-mono text-[14px] leading-none select-none pl-0.5" 
                        title="Unsaved changes"
                      >
                        *
                      </span>
                    )}

                    <button
                      onClick={(e) => handleCloseTab(tab.id, e)}
                      className="ml-1 p-0.5 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-all cursor-pointer opacity-50 group-hover:opacity-100"
                      title="Close Tab"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}

              {/* Add New Tab Button */}
              <button
                onClick={handleCreateNewTab}
                className="p-1 px-1.5 bg-slate-900/40 hover:bg-slate-900 border border-slate-800 hover:border-slate-750 text-slate-450 hover:text-indigo-400 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 text-[11px] font-bold"
                title="Open New Tab"
              >
                <Plus className="w-3.5 h-3.5" /> New Tab
              </button>
            </div>
            
            {/* Quick status count */}
            <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-950/35 border border-slate-905 px-2 py-0.5 rounded hidden md:inline-block">
              {tabs.length} {tabs.length === 1 ? 'tab' : 'tabs'}
            </span>
          </div>
          
          <AnimatePresence mode="wait">
            {activeWorkspaceMode === 'dashboard' ? (
              <motion.div
                key="dashboard-workspace"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.15 }}
                className="flex-1 flex flex-col min-h-0"
              >
                {/* 3-in-1 Unified Dashboard Panel Container */}
                <div className="flex-1 flex flex-col bg-slate-900 border border-slate-800 rounded-xl shadow-xl overflow-hidden min-h-0">
                  {/* Unified Header with Request Name and Save Buttons */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between px-5 py-3 bg-slate-950/30 border-b border-slate-805 gap-3 flex-shrink-0 select-none">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <span className="text-[10px] uppercase tracking-widest font-bold text-indigo-400 font-mono bg-indigo-950/40 border border-indigo-950 px-2 py-0.5 rounded flex-shrink-0">
                        Active Request
                      </span>
                      
                      {isEditingName ? (
                        <input
                          type="text"
                          value={tempName}
                          onChange={(e) => setTempName(e.target.value)}
                          onBlur={() => {
                            const final = tempName.trim() || 'Untitled';
                            setRequestName(final);
                            setIsEditingName(false);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const final = tempName.trim() || 'Untitled';
                              setRequestName(final);
                              setIsEditingName(false);
                            } else if (e.key === 'Escape') {
                              setIsEditingName(false);
                            }
                          }}
                          autoFocus
                          maxLength={50}
                          className="bg-slate-950 border border-indigo-500 rounded-lg py-1 px-2.5 text-xs font-bold text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-505 w-64 max-w-sm"
                        />
                      ) : (
                        <div 
                          onClick={() => {
                            setTempName(requestName);
                            setIsEditingName(true);
                          }}
                          className="flex items-center gap-2 hover:bg-slate-850 px-2 py-1 rounded-lg transition group cursor-pointer border border-transparent hover:border-slate-800"
                          title="Click to rename request"
                        >
                          <span className="text-xs font-bold text-slate-100 group-hover:text-indigo-400 transition-colors">
                            {requestName}
                          </span>
                          <Edit2 className="w-3 h-3 text-slate-500 group-hover:text-indigo-400 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0" />
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      {/* Save Split Selector Control */}
                      <div className="relative flex items-stretch">
                        <button
                          onClick={() => {
                            handleDirectSaveActiveRequest();
                          }}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-l-lg text-xs font-bold text-emerald-400 bg-emerald-950/35 hover:bg-emerald-950/50 border border-emerald-900/60 transition cursor-pointer shadow-sm hover:text-emerald-300"
                          title="Save settings"
                        >
                          <Save className="w-3.5 h-3.5" /> Save
                        </button>
                        
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsSaveDropdownOpen(!isSaveDropdownOpen);
                          }}
                          className="px-2 py-1.5 rounded-r-lg text-xs font-bold text-emerald-400 bg-emerald-950/35 hover:bg-emerald-950/50 border border-emerald-900/60 border-l-0 transition cursor-pointer shadow-sm flex items-center justify-center hover:text-emerald-300"
                          title="Save options"
                        >
                          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-205 ${isSaveDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isSaveDropdownOpen && (
                          <>
                            <div 
                              className="fixed inset-0 z-40" 
                              onClick={() => setIsSaveDropdownOpen(false)} 
                            />
                            <div className="absolute right-0 top-full mt-1.5 w-36 bg-slate-900 border border-slate-800 rounded-lg shadow-xl py-1 z-50 animate-fadeIn select-all">
                              <button
                                onClick={() => {
                                  setIsSaveDropdownOpen(false);
                                  setSaveTargetName(requestName);
                                  setIsSaveModalOpen(true);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-350 hover:text-white hover:bg-slate-800/80 transition text-left cursor-pointer"
                              >
                                <FolderPlus className="w-3.5 h-3.5 text-indigo-400" />
                                <span>Save As...</span>
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Main Sections Body - Request Composer & Responses directly stacked inside 1 panel */}
                  <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
                    {/* Top Section request constructor */}
                    <RequestPanel
                      config={config}
                      onChangeConfig={setConfig}
                      onSend={handleSendRequest}
                      isLoading={isLoading}
                      isCollapsed={isRequestCollapsed}
                      onToggleCollapse={() => {
                        setIsRequestCollapsed(!isRequestCollapsed);
                        if (isRequestCollapsed && isResponseCollapsed) {
                          setIsResponseCollapsed(false);
                        }
                      }}
                      isIntegrated={true}
                    />

                    {/* Bottom Section responses outcomes */}
                    <ResponseViewer
                      response={response}
                      isLoading={isLoading}
                      isCollapsed={isResponseCollapsed}
                      onToggleCollapse={() => {
                        setIsResponseCollapsed(!isResponseCollapsed);
                        if (isResponseCollapsed && isRequestCollapsed) {
                          setIsRequestCollapsed(false);
                        }
                      }}
                      isIntegrated={true}
                    />
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="comparison-arena-workspace"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.15 }}
                className="flex-1 min-h-0"
              >
                <ResponseComparer history={history} />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* Environments Variable slide Manager Modals */}
      <EnvironmentManager
        environments={environments}
        activeEnvId={activeEnvId}
        onSelectActiveEnv={setActiveEnvId}
        onUpdateEnvironments={handleUpdateEnvironments}
        isOpen={isEnvManagerOpen}
        onClose={() => setIsEnvManagerOpen(false)}
      />

      {/* Save Request Popup Dialog */}
      {isSaveModalOpen && (
        <div id="save_request_modal" className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 select-none">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-md p-6 shadow-2xl space-y-5 animate-fadeIn">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Save className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-bold text-slate-100">Save Request To Collection</h3>
              </div>
              <button 
                onClick={() => setIsSaveModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 transition text-sm font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Request Name Input Context */}
            <div className="space-y-2">
              <label className="text-[10.5px] text-slate-400 uppercase tracking-wider font-bold block">Request Name</label>
              <input
                type="text"
                value={saveTargetName}
                onChange={(e) => setSaveTargetName(e.target.value)}
                placeholder="Give your request a name..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-xs text-slate-250 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold font-mono"
              />
            </div>

            {/* Choose Target Collection Folder */}
            <div className="space-y-2.5">
              <label className="text-[10.5px] text-slate-400 uppercase tracking-wider font-bold block">Choose Collection Folder</label>
              
              {collections.length > 0 ? (
                <div className="max-h-40 overflow-y-auto border border-slate-850 rounded-xl p-1 bg-slate-950/30 space-y-1">
                  {collections.map(col => (
                    <button
                      key={col.id}
                      onClick={() => handleSaveActiveRequestToCollection(col.id, saveTargetName)}
                      className="w-full flex items-center justify-between p-2.5 rounded-lg text-xs font-semibold text-slate-350 hover:text-white hover:bg-slate-850/60 transition text-left cursor-pointer border border-transparent hover:border-slate-800"
                    >
                      <div className="flex items-center gap-2">
                        <Folder className="w-4 h-4 text-indigo-400" />
                        <span>{col.name}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-bold bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-full">
                        {col.requests.length} items
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-slate-500 font-medium italic py-2 text-center">No folder collections exist yet. Create one below to save!</p>
              )}
            </div>

            {/* Inline creation on-the-fly */}
            <div className="border-t border-slate-800 pt-4 space-y-2.5">
              <label className="text-[10.5px] text-slate-400 uppercase tracking-wider font-bold block">Or Save to a New Folder</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="New collection name..."
                  value={collectionNameInput}
                  onChange={(e) => setCollectionNameInput(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-810 rounded-lg py-2 px-3 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  onClick={() => {
                    if (!collectionNameInput.trim()) return;
                    handleSaveToNewCollection(collectionNameInput, saveTargetName);
                    setCollectionNameInput('');
                  }}
                  className="bg-indigo-600 hover:bg-indigo-550 text-white px-3 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Save
                </button>
              </div>
            </div>

            {/* Close popups */}
            <div className="pt-2 flex justify-between gap-3">
              <button
                onClick={() => setIsSaveModalOpen(false)}
                className="w-full bg-slate-800/60 hover:bg-slate-805 text-slate-300 py-2 rounded-lg text-xs font-bold transition cursor-pointer border border-slate-800/80"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shortcuts Guide Modals */}
      {isShortcutsOpen && (
        <div id="shortcuts_modal" className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 select-none">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-md p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
              <Command className="w-5 h-5 text-indigo-400 font-bold" />
              <h3 className="text-sm font-bold text-slate-100">Postman Desktop Keyboard Shortcuts</h3>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400 font-semibold">Trigger Send Request</span>
                <kbd className="font-mono bg-slate-950 border border-slate-800 text-slate-300 px-2 py-0.5 rounded shadow">Ctrl+Enter</kbd>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400 font-semibold">Toggle Variables Manager</span>
                <kbd className="font-mono bg-slate-950 border border-slate-800 text-slate-300 px-2 py-0.5 rounded shadow">Ctrl+E</kbd>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400 font-semibold">Toggle Diff Arena Mode</span>
                <kbd className="font-mono bg-slate-950 border border-slate-800 text-slate-300 px-2 py-0.5 rounded shadow">Ctrl+D</kbd>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400 font-semibold">Clear History Logs catalog</span>
                <kbd className="font-mono bg-slate-950 border border-slate-800 text-slate-300 px-2 py-0.5 rounded shadow">Ctrl+H</kbd>
              </div>
              <div className="flex justify-between text-xs pt-1 border-t border-slate-900">
                <span className="text-slate-400 font-semibold">Focus Quick Commands Help</span>
                <kbd className="font-mono bg-slate-950 border border-slate-800 text-slate-300 px-2.5 py-0.5 rounded shadow">?</kbd>
              </div>
            </div>

            <p className="text-[10px] text-slate-500 font-semibold text-center italic">* Note: Replaces meta commands for macOS systems.</p>

            <button
              onClick={() => setIsShortcutsOpen(false)}
              className="w-full bg-indigo-600 hover:bg-indigo-505 text-white py-2 rounded-lg text-xs font-bold transition-all shadow-lg cursor-pointer"
            >
              Close instructions
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
