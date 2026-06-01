/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Environment, KeyValuePair } from '../types';
import { Plus, Trash2, ShieldAlert, Monitor, Download, Upload, Check, Settings } from 'lucide-react';

interface EnvironmentManagerProps {
  environments: Environment[];
  activeEnvId: string;
  onSelectActiveEnv: (id: string) => void;
  onUpdateEnvironments: (envs: Environment[]) => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function EnvironmentManager({
  environments,
  activeEnvId,
  onSelectActiveEnv,
  onUpdateEnvironments,
  isOpen,
  onClose
}: EnvironmentManagerProps) {
  const [selectedEnvId, setSelectedEnvId] = useState<string>(activeEnvId || (environments[0]?.id || ''));
  const [newEnvName, setNewEnvName] = useState('');

  const currentEnv = environments.find(e => e.id === selectedEnvId);

  // Add environment
  const handleAddEnv = () => {
    if (!newEnvName.trim()) return;
    const newEnv: Environment = {
      id: Math.random().toString(36).substr(2, 9),
      name: newEnvName.trim(),
      variables: [
        { id: Math.random().toString(36).substr(2, 9), key: 'baseUrl', value: 'https://httpbin.org', enabled: true }
      ]
    };
    const updated = [...environments, newEnv];
    onUpdateEnvironments(updated);
    setSelectedEnvId(newEnv.id);
    setNewEnvName('');
  };

  // Delete environment
  const handleDeleteEnv = (id: string) => {
    const updated = environments.filter(e => e.id !== id);
    onUpdateEnvironments(updated);
    if (selectedEnvId === id) {
      setSelectedEnvId(updated[0]?.id || '');
    }
    if (activeEnvId === id) {
      onSelectActiveEnv('');
    }
  };

  // Add Variable row
  const handleAddVariable = () => {
    if (!currentEnv) return;
    const newVar: KeyValuePair = {
      id: Math.random().toString(36).substr(2, 9),
      key: '',
      value: '',
      enabled: true
    };
    const updated = environments.map(e => {
      if (e.id === currentEnv.id) {
        return { ...e, variables: [...e.variables, newVar] };
      }
      return e;
    });
    onUpdateEnvironments(updated);
  };

  // Edit fields
  const handleEditVariable = (varId: string, field: 'key' | 'value', val: string) => {
    if (!currentEnv) return;
    const updated = environments.map(e => {
      if (e.id === currentEnv.id) {
        return {
          ...e,
          variables: e.variables.map(v => v.id === varId ? { ...v, [field]: val } : v)
        };
      }
      return e;
    });
    onUpdateEnvironments(updated);
  };

  // Toggle variable enabled
  const handleToggleVariable = (varId: string) => {
    if (!currentEnv) return;
    const updated = environments.map(e => {
      if (e.id === currentEnv.id) {
        return {
          ...e,
          variables: e.variables.map(v => v.id === varId ? { ...v, enabled: !v.enabled } : v)
        };
      }
      return e;
    });
    onUpdateEnvironments(updated);
  };

  // Remove variable row
  const handleRemoveVariable = (varId: string) => {
    if (!currentEnv) return;
    const updated = environments.map(e => {
      if (e.id === currentEnv.id) {
        return {
          ...e,
          variables: e.variables.filter(v => v.id !== varId)
        };
      }
      return e;
    });
    onUpdateEnvironments(updated);
  };

  // Export Env
  const handleExport = () => {
    if (!currentEnv) return;
    const jsonStr = JSON.stringify(currentEnv, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentEnv.name.toLowerCase().replace(/\s+/g, '_')}_env.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import Env
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed && typeof parsed === 'object' && parsed.name && Array.isArray(parsed.variables)) {
          const imported: Environment = {
            id: Math.random().toString(36).substr(2, 9),
            name: `${parsed.name} (Imported)`,
            variables: parsed.variables.map((v: any) => ({
              id: v.id || Math.random().toString(36).substr(2, 9),
              key: v.key || '',
              value: v.value || '',
              enabled: v.enabled !== undefined ? v.enabled : true
            }))
          };
          onUpdateEnvironments([...environments, imported]);
          setSelectedEnvId(imported.id);
        } else {
          alert('Invalid environment JSON configuration schema.');
        }
      } catch {
        alert('Failed to parse uploaded file. Make sure it is valid JSON.');
      }
    };
    reader.readAsText(file);
  };

  if (!isOpen) return null;

  return (
    <div id="env_manager_modal" className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/60 p-4">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-indigo-400" />
            <h3 className="text-base font-semibold text-slate-100">Environment Variables Manager</h3>
          </div>
          <button
            id="close-env-modal"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1 rounded-md hover:bg-slate-800 transition"
          >
            ✕
          </button>
        </div>

        {/* Modal Body (Sidebar + Content layout) */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar environments list */}
          <div className="w-64 border-r border-slate-800 bg-slate-950/20 p-4 flex flex-col gap-4">
            <div className="flex gap-1.5">
              <input
                id="new-env-input"
                type="text"
                placeholder="New Environment..."
                value={newEnvName}
                onChange={(e) => setNewEnvName(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-800 rounded-md py-1.5 px-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button
                id="create-env-btn"
                onClick={handleAddEnv}
                className="bg-indigo-600 hover:bg-indigo-505 text-white p-1.5 rounded-md text-xs font-semibold flex items-center justify-center cursor-pointer"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1">
              {environments.map((env) => {
                const isActive = activeEnvId === env.id;
                const isSelected = selectedEnvId === env.id;
                return (
                  <div
                    key={env.id}
                    onClick={() => setSelectedEnvId(env.id)}
                    className={`group flex items-center justify-between p-2.5 rounded-lg text-xs font-medium cursor-pointer transition ${
                      isSelected 
                        ? 'bg-slate-800 text-indigo-400 border border-slate-750' 
                        : 'text-slate-400 hover:bg-slate-850 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <button
                        title={isActive ? 'Deactivate' : 'Set as Active'}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectActiveEnv(isActive ? '' : env.id);
                        }}
                        className={`w-4 h-4 rounded-full flex items-center justify-center border cursor-pointer border-slate-700 transition ${
                          isActive ? 'bg-indigo-900/60 border-indigo-450 focus:scale-95' : 'hover:bg-slate-800'
                        }`}
                      >
                        {isActive && <Check className="w-2.5 h-2.5 text-indigo-400" />}
                      </button>
                      <span className="truncate">{env.name}</span>
                    </div>

                    <button
                      title="Delete environment"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteEnv(env.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 text-rose-500 hover:text-rose-400 hover:bg-slate-800/60 p-1 rounded-md cursor-pointer transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}

              {environments.length === 0 && (
                <p className="text-center text-slate-600 py-8 text-[11px]">No custom environments configured yet.</p>
              )}
            </div>
          </div>

          {/* Active Variable Sheet */}
          <div className="flex-1 p-5 flex flex-col overflow-hidden">
            {currentEnv ? (
              <div className="flex flex-col h-full overflow-hidden">
                {/* Variable Utilities Bar */}
                <div className="flex items-center justify-between mb-4 flex-shrink-0">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-100 flex items-center gap-1.5">
                      {currentEnv.name} Environment
                      {activeEnvId === currentEnv.id && (
                        <span className="text-[10px] bg-indigo-950/60 text-indigo-400 border border-indigo-900/50 py-0.5 px-2 rounded-full font-bold">
                          ACTIVE ENVIRONMENT
                        </span>
                      )}
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5">Define key-value properties. Replace expressions in request headers/URI with <code className="text-indigo-400 font-mono text-[10px] font-semibold">{"{{key}}"}</code></p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleExport}
                      className="flex items-center gap-1 py-1 px-2.5 border border-slate-800 hover:border-slate-700 rounded-md text-xs text-slate-300 font-medium cursor-pointer transition bg-slate-950/20"
                    >
                      <Download className="w-3.5 h-3.5" /> Export Env
                    </button>
                    <label className="flex items-center gap-1 py-1 px-2.5 border border-slate-800 hover:border-slate-700 rounded-md text-xs text-slate-300 font-medium cursor-pointer transition bg-slate-950/20">
                      <Upload className="w-3.5 h-3.5" /> Import
                      <input
                        type="file"
                        accept=".json"
                        onChange={handleImport}
                        className="hidden"
                      />
                    </label>
                    <button
                      onClick={handleAddVariable}
                      className="bg-indigo-600 hover:bg-indigo-505 text-white px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1 cursor-pointer transition"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Variable
                    </button>
                  </div>
                </div>

                {/* Variable Grid Table */}
                <div className="flex-1 overflow-y-auto border border-slate-800/80 rounded-xl bg-slate-950/15">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-slate-950/40 text-left border-b border-slate-800 select-none text-[11px] font-semibold text-slate-450 uppercase tracking-wider">
                        <th className="w-12 py-2 text-center">Status</th>
                        <th className="py-2 px-3">Variable Name</th>
                        <th className="py-2 px-3">Variable Value</th>
                        <th className="w-12 py-2 pr-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentEnv.variables.map((v) => (
                        <tr key={v.id} className="border-b border-slate-800/40 hover:bg-slate-850/10">
                          {/* Toggle active status checkbox */}
                          <td className="py-2 text-center align-middle">
                            <input
                              type="checkbox"
                              checked={v.enabled}
                              onChange={() => handleToggleVariable(v.id)}
                              className="w-3.5 h-3.5 rounded border-slate-800 text-indigo-600 focus:ring-0 bg-slate-950"
                            />
                          </td>

                          {/* Key name */}
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={v.key}
                              placeholder="e.g. baseUrl"
                              onChange={(e) => handleEditVariable(v.id, 'key', e.target.value)}
                              className="w-full bg-transparent text-xs text-slate-100 border-none focus:outline-none placeholder-slate-650"
                            />
                          </td>

                          {/* Key value */}
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={v.value}
                              placeholder="e.g. https://api.prod.org"
                              onChange={(e) => handleEditVariable(v.id, 'value', e.target.value)}
                              className="w-full bg-transparent text-xs text-slate-300 border-none focus:outline-none placeholder-slate-650"
                            />
                          </td>

                          {/* Controls */}
                          <td className="py-2 pr-4 text-right align-middle">
                            <button
                              title="Delete Variable row"
                              onClick={() => handleRemoveVariable(v.id)}
                              className="text-slate-500 hover:text-rose-500 hover:bg-slate-800/80 p-1.5 rounded-md cursor-pointer transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}

                      {currentEnv.variables.length === 0 && (
                        <tr>
                          <td colSpan={4} className="text-center p-8 text-xs text-slate-500">
                            No variables added to this environment scope. Click "Add Variable" above.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500">
                <ShieldAlert className="w-10 h-10 text-slate-700 mb-2" />
                <p className="text-sm font-medium text-slate-400">No Environment Selected</p>
                <p className="text-xs text-slate-5ff mt-1">Please add or select a workspace scope in the sidebar list.</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-slate-800 bg-slate-950/60 p-4">
          <button
            onClick={onClose}
            className="bg-indigo-600 hover:bg-indigo-505 text-white font-medium text-xs py-2 px-4 rounded-lg cursor-pointer transition shadow-lg hover:shadow-indigo-900/10"
          >
            Apply & Close Manager
          </button>
        </div>
      </div>
    </div>
  );
}
