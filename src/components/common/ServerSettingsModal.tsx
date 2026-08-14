import React, { useState, useEffect } from 'react';
import { getApiBaseUrl, setApiBaseUrl, checkServerHealthApi } from '../../services/api';
import { Server, Wifi, CheckCircle2, AlertCircle, RefreshCw, X, Save, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ServerSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ServerSettingsModal: React.FC<ServerSettingsModalProps> = ({ isOpen, onClose }) => {
  const [serverUrl, setServerUrl] = useState<string>('');
  const [testing, setTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string; database?: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setServerUrl(getApiBaseUrl() || '');
      setTestResult(null);
    }
  }, [isOpen]);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    const res = await checkServerHealthApi(serverUrl.trim());
    setTestResult(res);
    setTesting(false);
  };

  const handleSave = () => {
    setApiBaseUrl(serverUrl.trim());
    onClose();
  };

  const handleReset = () => {
    setServerUrl('');
    setApiBaseUrl('');
    setTestResult(null);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-stone-200 space-y-5"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-stone-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-200/60">
                <Server className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-stone-900 text-base">Backend Server Connection</h3>
                <p className="text-xs text-stone-500 font-medium">Configure network endpoint for API requests</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-stone-700 block mb-1.5">
                Backend Server URL
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={serverUrl}
                  onChange={(e) => {
                    setServerUrl(e.target.value);
                    setTestResult(null);
                  }}
                  placeholder="https://api.caresync.app"
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-xs font-mono font-semibold text-stone-800 focus:outline-none focus:ring-2 focus:ring-teal-700"
                />
              </div>
              <p className="text-[11px] text-stone-400 mt-1.5">
                Enter your production backend API domain (e.g. <span className="font-mono text-stone-600">https://api.caresync.app</span>).
              </p>
            </div>

            {/* Test Status Banner */}
            {testResult && (
              <div
                className={`p-3.5 rounded-xl border text-xs font-semibold flex items-start gap-2.5 ${
                  testResult.ok
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                {testResult.ok ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-bold">{testResult.ok ? 'Connection Successful!' : 'Connection Failed'}</div>
                  <div className="text-[11px] opacity-90">{testResult.message}</div>
                  {testResult.database && (
                    <div className="text-[10px] text-emerald-700 font-mono mt-0.5">
                      Database: {testResult.database}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleTest}
                disabled={testing || !serverUrl.trim()}
                className="flex-1 py-2.5 px-3 rounded-xl border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
                {testing ? 'Testing...' : 'Test Connection'}
              </button>

              <button
                type="button"
                onClick={handleReset}
                title="Reset to default LAN address"
                className="p-2.5 rounded-xl border border-stone-200 bg-white hover:bg-stone-100 text-stone-600 text-xs font-semibold transition-colors flex items-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </button>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex gap-2 pt-4 border-t border-stone-100">
            <button
              type="button"
              onClick={onClose}
              className="w-1/2 py-2.5 rounded-xl border border-stone-200 text-stone-600 font-semibold text-xs hover:bg-stone-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="w-1/2 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              Save Settings
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
