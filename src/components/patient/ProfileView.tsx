import React, { useState } from 'react';
import { useCareSync } from '../../context/CareSyncContext';
import { User, Phone, Moon, Lock, Save, Key, Copy, RefreshCw, Trash2, ShieldCheck } from 'lucide-react';

export const ProfileView: React.FC = () => {
  const {
    patient,
    currentUser,
    connectionCode,
    generateConnectionCode,
    revokeConnectionCode,
    updateUserProfile,
    addToast,
  } = useCareSync();

  const [name, setName] = useState<string>(currentUser?.name || patient?.name || '');
  const [age, setAge] = useState<number>(currentUser?.age || patient?.age || 72);
  const [caregiver, setCaregiver] = useState<string>(currentUser?.primaryCaregiver || patient?.primaryCaregiver || '');
  const [phone, setPhone] = useState<string>(currentUser?.caregiverPhone || patient?.caregiverPhone || '');
  const [quietHours, setQuietHours] = useState<string>(currentUser?.quietHours || patient?.quietHours || '10:00 PM - 7:00 AM');
  const [isRegenerating, setIsRegenerating] = useState<boolean>(false);

  React.useEffect(() => {
    if (currentUser) {
      setName(currentUser.name || '');
      setAge(currentUser.age || 72);
      setCaregiver(currentUser.primaryCaregiver || '');
      setPhone(currentUser.caregiverPhone || '');
      setQuietHours(currentUser.quietHours || '10:00 PM - 7:00 AM');
    }
  }, [currentUser]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateUserProfile({
      name,
      age,
      primaryCaregiver: caregiver,
      caregiverPhone: phone,
      quietHours,
    });
  };

  const handleCopyCode = () => {
    if (connectionCode?.code) {
      navigator.clipboard.writeText(connectionCode.code);
      addToast('Connection code copied to clipboard! 📋', 'success');
    }
  };

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    await generateConnectionCode();
    setIsRegenerating(false);
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-4">
          <img
            src={currentUser?.avatarUrl || patient.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250'}
            alt={currentUser?.name || patient.name}
            className="w-16 h-16 rounded-full object-cover border-2 border-teal-700 shadow-md"
          />
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">{currentUser?.name || patient.name}</h1>
            <p className="text-xs text-slate-500 font-medium">Patient Account • Secure Profile</p>
          </div>
        </div>

        <button
          onClick={handleSave}
          className="px-5 py-3 rounded-2xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs shadow-md shadow-teal-700/20 flex items-center gap-2 transition-all"
        >
          <Save className="w-4 h-4" />
          Save Settings
        </button>
      </div>

      {/* CAREGIVER CONNECTION CODE CARD */}
      <div className="bg-gradient-to-br from-teal-50/80 via-white to-slate-50 p-6 rounded-3xl border-2 border-teal-200/80 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-teal-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-700 text-white flex items-center justify-center shadow-xs">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">Caregiver Connection Code</h2>
              <p className="text-xs text-slate-600">Give this code to your caregiver to securely link their CareSync app.</p>
            </div>
          </div>
        </div>

        {connectionCode?.code ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-teal-100 shadow-xs">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-teal-800 block mb-1">
                Your Active Code
              </span>
              <div className="text-3xl font-mono font-extrabold text-teal-950 tracking-wider">
                {connectionCode.code}
              </div>
              <span className="text-[11px] text-slate-400 font-medium mt-1 block">
                Expires on: {new Date(connectionCode.expiresAt).toLocaleDateString()}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleCopyCode}
                className="py-2.5 px-4 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs shadow-xs flex items-center gap-1.5 transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                Copy Code
              </button>
              <button
                type="button"
                disabled={isRegenerating}
                onClick={handleRegenerate}
                className="py-2.5 px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
                Regenerate
              </button>
              <button
                type="button"
                onClick={revokeConnectionCode}
                className="py-2.5 px-3 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs transition-colors flex items-center gap-1"
                title="Revoke Code"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Revoke
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white p-5 rounded-2xl border border-slate-200 text-center space-y-3">
            <p className="text-xs text-slate-600 font-medium">No active caregiver connection code found.</p>
            <button
              type="button"
              disabled={isRegenerating}
              onClick={handleRegenerate}
              className="py-2.5 px-4 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs shadow-xs inline-flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
              Generate Connection Code
            </button>
          </div>
        )}
      </div>

      <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* PERSONAL DETAILS */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <User className="w-5 h-5 text-teal-700" />
            Personal Information
          </h2>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Age</label>
              <input
                type="number"
                value={age}
                onChange={(e) => setAge(parseInt(e.target.value) || 72)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>
        </div>

        {/* CAREGIVER & EMERGENCY CONTACTS */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Phone className="w-5 h-5 text-indigo-700" />
            Caregiver & Emergency Contact
          </h2>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Trusted Caregiver Name</label>
              <input
                type="text"
                value={caregiver}
                onChange={(e) => setCaregiver(e.target.value)}
                placeholder="e.g. Sarah Johnson"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Caregiver Phone Number</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. (555) 019-2831"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>
        </div>

        {/* QUIET HOURS & NOTIFICATION SCHEDULE */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Moon className="w-5 h-5 text-indigo-700" />
            Sleep Schedule & Quiet Hours
          </h2>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Quiet Hours Interval</label>
              <input
                type="text"
                value={quietHours}
                onChange={(e) => setQuietHours(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <p className="text-[11px] text-slate-400">Non-urgent audio reminders are silenced during quiet hours.</p>
          </div>
        </div>

        {/* PRIVACY & VOICE PREFERENCES */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Lock className="w-5 h-5 text-teal-700" />
            Privacy & Security
          </h2>

          <div className="space-y-3 text-xs">
            <label className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200/80 cursor-pointer">
              <span className="font-semibold text-slate-800">Voice Assistant Speech Feedback</span>
              <input type="checkbox" defaultChecked className="w-4 h-4 text-teal-700 rounded" />
            </label>

            <label className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200/80 cursor-pointer">
              <span className="font-semibold text-slate-800">Share Daily CareScore with Connected Caregiver</span>
              <input type="checkbox" defaultChecked className="w-4 h-4 text-teal-700 rounded" />
            </label>
          </div>
        </div>
      </form>
    </div>
  );
};

