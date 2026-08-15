import React, { useState } from 'react';
import { useCareSync } from '../../context/CareSyncContext';
import { UserRole } from '../../types';
import {
  Activity,
  User,
  Users,
  ArrowRight,
  ShieldCheck,
  Heart,
  Lock,
  Mail,
  Phone,
  CheckCircle2,
  Sparkles,
  ArrowLeft,
  Server,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ServerSettingsModal } from '../common/ServerSettingsModal';

export const AuthLandingView: React.FC = () => {
  const { login, signup, loginDemoUser, addToast } = useCareSync();

  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [authMode, setAuthMode] = useState<'signup' | 'login'>('signup');
  const [loading, setLoading] = useState<boolean>(false);
  const [serverSettingsOpen, setServerSettingsOpen] = useState<boolean>(false);

  // Form Fields
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [age, setAge] = useState<number>(72);
  const [caregiverName, setCaregiverName] = useState<string>('');
  const [caregiverPhone, setCaregiverPhone] = useState<string>('');
  const [caregiverEmail, setCaregiverEmail] = useState<string>('');
  const [patientConnectionCode, setPatientConnectionCode] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || (authMode === 'signup' && !name)) {
      addToast('Please fill in all required fields', 'warning');
      return;
    }

    if (authMode === 'signup' && selectedRole === 'caregiver' && !patientConnectionCode.trim()) {
      addToast('Please enter the patient connection code (e.g. CARE-7K4P9Q)', 'warning');
      return;
    }

    setLoading(true);
    try {
      if (authMode === 'signup') {
        await signup({
          name,
          email,
          password,
          role: selectedRole || 'patient',
          age: selectedRole === 'patient' ? age : undefined,
          phone: phone || undefined,
          primaryCaregiver: selectedRole === 'patient' ? caregiverName : undefined,
          caregiverPhone: selectedRole === 'patient' ? caregiverPhone : undefined,
          caregiverEmail: selectedRole === 'patient' ? caregiverEmail : undefined,
          connectionCode: selectedRole === 'caregiver' ? patientConnectionCode.trim().toUpperCase() : undefined,
        });
      } else {
        await login(email, password);
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      addToast(err.message || 'Authentication failed. Please check credentials.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = async (role: 'patient' | 'caregiver') => {
    setLoading(true);
    try {
      await loginDemoUser(role);
    } catch (err: any) {
      addToast('Demo login failed: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-900/10 via-slate-50 to-slate-100 flex flex-col justify-between py-8 px-4 sm:px-6 lg:px-8">
      {/* Top Brand */}
      <div className="max-w-md mx-auto w-full text-center space-y-2">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-teal-700 text-white shadow-lg shadow-teal-700/20 mb-2">
          <Activity className="w-8 h-8 stroke-[2.5]" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">CareSync</h1>
        <p className="text-sm text-slate-600 font-medium">Empathetic Health Routines & Family Caregiving</p>
      </div>

      {/* Main Interactive Card */}
      <div className="max-w-md mx-auto w-full my-6">
        <AnimatePresence mode="wait">
          {!selectedRole ? (
            /* STEP 1: FIRST-LAUNCH ROLE SELECTION */
            <motion.div
              key="role-select"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-200/80 space-y-6"
            >
              <div className="text-center space-y-1">
                <span className="text-xs font-bold uppercase tracking-widest text-teal-700">Welcome to CareSync</span>
                <h2 className="text-2xl font-bold text-slate-900">Who is this app for?</h2>
                <p className="text-xs text-slate-500">
                  Select your role to configure a personalized care experience on this device.
                </p>
              </div>

              <div className="space-y-3.5 pt-2">
                {/* I'M A PATIENT */}
                <button
                  onClick={() => {
                    setSelectedRole('patient');
                    setAuthMode('signup');
                  }}
                  className="w-full group p-4 sm:p-5 rounded-2xl border-2 border-teal-100 bg-teal-50/50 hover:bg-teal-50 hover:border-teal-600 text-left transition-all flex items-center justify-between shadow-xs hover:shadow-md"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-teal-700 text-white flex items-center justify-center shrink-0 shadow-sm">
                      <User className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="font-extrabold text-slate-900 text-base block group-hover:text-teal-950">
                        I'm a Patient
                      </span>
                      <span className="text-xs text-slate-600 font-medium block mt-0.5">
                        Track daily medicine, alarms, hydration, and gentle wellness routines.
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-teal-700 shrink-0 transform group-hover:translate-x-1 transition-transform" />
                </button>

                {/* I'M A CAREGIVER */}
                <button
                  onClick={() => {
                    setSelectedRole('caregiver');
                    setAuthMode('signup');
                  }}
                  className="w-full group p-4 sm:p-5 rounded-2xl border-2 border-indigo-100 bg-indigo-50/40 hover:bg-indigo-50 hover:border-indigo-600 text-left transition-all flex items-center justify-between shadow-xs hover:shadow-md"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-indigo-700 text-white flex items-center justify-center shrink-0 shadow-sm">
                      <Users className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="font-extrabold text-slate-900 text-base block group-hover:text-indigo-950">
                        I'm a Caregiver
                      </span>
                      <span className="text-xs text-slate-600 font-medium block mt-0.5">
                        Support family members, manage medication schedules, and review alerts.
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-indigo-700 shrink-0 transform group-hover:translate-x-1 transition-transform" />
                </button>
              </div>

              {/* REVIEWER / DEMO QUICK LOGIN */}
              <div className="pt-4 border-t border-slate-100 space-y-2.5 text-center">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Reviewer & Demo Fast Access
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    disabled={loading}
                    onClick={() => handleQuickDemo('patient')}
                    className="py-2.5 px-3 rounded-xl border border-teal-200 bg-white hover:bg-teal-50 text-teal-800 text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-2xs"
                  >
                    <User className="w-3.5 h-3.5 text-teal-600" />
                    Patient Alex
                  </button>
                  <button
                    disabled={loading}
                    onClick={() => handleQuickDemo('caregiver')}
                    className="py-2.5 px-3 rounded-xl border border-indigo-200 bg-white hover:bg-indigo-50 text-indigo-800 text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-2xs"
                  >
                    <Users className="w-3.5 h-3.5 text-indigo-600" />
                    Caregiver Sarah
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            /* STEP 2: AUTHENTICATION FORM (SIGNUP / LOGIN) */
            <motion.div
              key="auth-form"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-200/80 space-y-5"
            >
              {/* Top back button & mode indicator */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <button
                  onClick={() => setSelectedRole(null)}
                  className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Change Role
                </button>

                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wide border ${
                  selectedRole === 'patient'
                    ? 'bg-teal-50 text-teal-800 border-teal-200'
                    : 'bg-indigo-50 text-indigo-800 border-indigo-200'
                }`}>
                  {selectedRole === 'patient' ? 'Patient Setup' : 'Caregiver Hub'}
                </span>
              </div>

              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {authMode === 'signup'
                    ? selectedRole === 'patient'
                      ? 'Create Patient Account'
                      : 'Create Caregiver Account'
                    : selectedRole === 'patient'
                    ? 'Patient Sign In'
                    : 'Caregiver Sign In'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {authMode === 'signup'
                    ? 'Enter your details to create your secure health profile.'
                    : 'Enter your credentials to continue to your dashboard.'}
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-3.5">
                {authMode === 'signup' && (
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      {selectedRole === 'patient' ? 'Patient Full Name' : 'Caregiver Full Name'} *
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={selectedRole === 'patient' ? 'e.g. Alex Johnson' : 'e.g. Sarah Johnson'}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-600"
                    />
                  </div>
                )}

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. alex@example.com"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Password *</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>

                {authMode === 'signup' && (
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Phone Number (Optional)</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(555) 012-3456"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-600"
                    />
                  </div>
                )}

                {/* Additional Patient Onboarding Fields: Caregiver Information */}
                {authMode === 'signup' && selectedRole === 'patient' && (
                  <div className="pt-2 border-t border-slate-100 space-y-3">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-teal-800 block">
                      Trusted Caregiver Information (Optional)
                    </span>
                    <div>
                      <label className="text-xs font-medium text-slate-600 block mb-1">Caregiver Name</label>
                      <input
                        type="text"
                        value={caregiverName}
                        onChange={(e) => setCaregiverName(e.target.value)}
                        placeholder="e.g. Sarah Johnson (Daughter)"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-600"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] font-medium text-slate-600 block mb-1">Caregiver Phone</label>
                        <input
                          type="tel"
                          value={caregiverPhone}
                          onChange={(e) => setCaregiverPhone(e.target.value)}
                          placeholder="(555) 019-2831"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-600"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-slate-600 block mb-1">Caregiver Email</label>
                        <input
                          type="email"
                          value={caregiverEmail}
                          onChange={(e) => setCaregiverEmail(e.target.value)}
                          placeholder="sarah@example.com"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-600"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Caregiver Onboarding: Patient Connection Code */}
                {authMode === 'signup' && selectedRole === 'caregiver' && (
                  <div className="pt-2 border-t border-slate-100 space-y-2">
                    <label className="text-xs font-bold text-slate-700 block">
                      Patient Connection Code *
                    </label>
                    <input
                      type="text"
                      required
                      value={patientConnectionCode}
                      onChange={(e) => setPatientConnectionCode(e.target.value.toUpperCase())}
                      placeholder="e.g. CARE-7K4P9Q"
                      maxLength={14}
                      className="w-full bg-slate-50 border-2 border-indigo-100 rounded-xl p-3 text-xs font-mono font-bold tracking-wider text-indigo-950 focus:outline-none focus:ring-2 focus:ring-indigo-600 uppercase placeholder:normal-case placeholder:font-sans placeholder:tracking-normal placeholder:font-normal"
                    />
                    <p className="text-[11px] text-slate-500 font-medium">
                      Enter the connection code provided by the patient.
                    </p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full py-3.5 px-4 rounded-xl text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 mt-4 ${
                    selectedRole === 'patient'
                      ? 'bg-teal-700 hover:bg-teal-800 shadow-teal-700/20'
                      : 'bg-indigo-700 hover:bg-indigo-800 shadow-indigo-700/20'
                  } ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  {loading ? (
                    <span>Processing...</span>
                  ) : (
                    <>
                      <span>{authMode === 'signup' ? 'Create Account & Continue' : 'Sign In'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Toggle signup/login */}
              <div className="text-center pt-2 text-xs text-slate-600">
                {authMode === 'signup' ? (
                  <span>
                    Already have an account?{' '}
                    <button
                      onClick={() => setAuthMode('login')}
                      className="font-bold text-teal-800 hover:underline"
                    >
                      Sign In
                    </button>
                  </span>
                ) : (
                  <span>
                    Don't have an account yet?{' '}
                    <button
                      onClick={() => setAuthMode('signup')}
                      className="font-bold text-teal-800 hover:underline"
                    >
                      Sign Up
                    </button>
                  </span>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer Info */}
      <div className="max-w-md mx-auto text-center text-xs text-slate-400 font-medium space-y-2">
        <div>CareSync HIPAA-aligned architecture • Strict RBAC & Local Alarm Security</div>
        <div>
          <button
            type="button"
            onClick={() => setServerSettingsOpen(true)}
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-stone-500 hover:text-teal-800 bg-stone-100 hover:bg-teal-50 px-3 py-1.5 rounded-full border border-stone-200/80 transition-colors"
          >
            <Server className="w-3.5 h-3.5 text-teal-700" />
            Backend Connection Settings
          </button>
        </div>
      </div>

      <ServerSettingsModal
        isOpen={serverSettingsOpen}
        onClose={() => setServerSettingsOpen(false)}
      />
    </div>
  );
};
