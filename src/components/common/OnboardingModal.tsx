import React, { useState } from 'react';
import { useCareSync } from '../../context/CareSyncContext';
import { Heart, ShieldCheck, Droplet, Footprints, ArrowRight, CheckCircle2, UserCheck, Key, Copy } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const OnboardingModal: React.FC = () => {
  const {
    activeRole,
    onboardingCompleted,
    setOnboardingCompleted,
    patient,
    currentUser,
    connectionCode,
    linkPatientWithCode,
    updateUserProfile,
    addToast,
  } = useCareSync();

  const [step, setStep] = useState<number>(1);

  // Patient Form State
  const [waterGoal, setWaterGoal] = useState<number>(2.0);
  const [stepGoal, setStepGoal] = useState<number>(5000);
  const [caregiverName, setCaregiverName] = useState<string>(patient.primaryCaregiver || '');
  const [caregiverPhone, setCaregiverPhone] = useState<string>(patient.caregiverPhone || '');

  // Caregiver Link State
  const [inputCode, setInputCode] = useState<string>('');
  const [linking, setLinking] = useState<boolean>(false);

  if (onboardingCompleted) return null;

  const handleFinish = () => {
    if (activeRole === 'patient') {
      updateUserProfile({
        primaryCaregiver: caregiverName,
        caregiverPhone,
        emergencyContact: caregiverName ? `${caregiverName} (Caregiver)` : undefined,
        emergencyPhone: caregiverPhone || undefined,
      });
    }
    setOnboardingCompleted(true);
  };

  const handleCaregiverConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCode.trim()) {
      addToast('Please enter the caregiver connection code', 'warning');
      return;
    }

    setLinking(true);
    try {
      await linkPatientWithCode(inputCode);
      setStep(4);
    } catch (err: any) {
      // Error toast handled in context
    } finally {
      setLinking(false);
    }
  };

  const copyCodeToClipboard = () => {
    if (connectionCode?.code) {
      navigator.clipboard.writeText(connectionCode.code);
      addToast('Connection code copied to clipboard! 📋', 'success');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-3xl max-w-lg w-full p-6 md:p-8 shadow-2xl border border-slate-100 relative overflow-hidden"
      >
        {/* Step Indicator Bar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`h-2 rounded-full transition-all duration-300 ${
                  s === step
                    ? 'w-8 bg-teal-700'
                    : s < step
                    ? 'w-4 bg-teal-200'
                    : 'w-4 bg-slate-100'
                }`}
              />
            ))}
          </div>
          <span className="text-xs font-semibold text-slate-400">Step {step} of 4</span>
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="space-y-4"
            >
              <div className="w-14 h-14 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-100 shadow-sm">
                <Heart className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  Welcome to CareSync, {currentUser?.name?.split(' ')[0] || 'there'}!
                </h2>
                <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                  {activeRole === 'patient'
                    ? 'CareSync quietly helps you stay on track with your daily health routine and keeps your trusted loved ones informed when something needs attention.'
                    : 'CareSync helps you stay connected with your family members, monitor wellness metrics, and manage medication schedules with ease.'}
                </p>
              </div>

              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-3">
                <div className="flex items-center gap-3 text-xs text-slate-700 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-teal-700 shrink-0" />
                  <span>{activeRole === 'patient' ? 'Simple medication & routine confirmation' : 'Direct oversight of patient medication schedules'}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-700 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-teal-700 shrink-0" />
                  <span>{activeRole === 'patient' ? 'Hydration & activity tracking tailored to you' : 'Real-time hydration and activity compliance summary'}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-700 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-teal-700 shrink-0" />
                  <span>{activeRole === 'patient' ? 'Automated alerts for your family caregiver' : 'Automated escalation alerts for unconfirmed doses'}</span>
                </div>
              </div>

              <button
                onClick={() => setStep(2)}
                className="w-full py-3.5 px-4 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-semibold text-sm shadow-md flex items-center justify-center gap-2 transition-all mt-4"
              >
                Get Started
                <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="space-y-4"
            >
              {activeRole === 'patient' ? (
                <>
                  <div className="w-14 h-14 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100 shadow-sm">
                    <Droplet className="w-7 h-7" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Set your daily health routines</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Customize your wellness targets for clear daily guidance.</p>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 mb-1">
                        <Droplet className="w-3.5 h-3.5 text-sky-500" />
                        Daily Water Goal (Liters)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="1.0"
                        max="4.0"
                        value={waterGoal}
                        onChange={(e) => setWaterGoal(parseFloat(e.target.value) || 2.0)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 mb-1">
                        <Footprints className="w-3.5 h-3.5 text-emerald-500" />
                        Daily Activity Goal (Steps)
                      </label>
                      <input
                        type="number"
                        step="500"
                        min="1000"
                        max="20000"
                        value={stepGoal}
                        onChange={(e) => setStepGoal(parseInt(e.target.value) || 5000)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-100 shadow-sm">
                    <UserCheck className="w-7 h-7" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Caregiver Dashboard Overview</h2>
                    <p className="text-xs text-slate-500 mt-0.5">As a caregiver, you have access to real-time compliance metrics.</p>
                  </div>
                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2 text-xs text-slate-700">
                    <p>• Review daily dose adherence</p>
                    <p>• Add or modify patient medication schedules</p>
                    <p>• Receive multi-stage emergency escalation alerts</p>
                  </div>
                </>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setStep(1)}
                  className="w-1/3 py-3 rounded-xl border border-slate-200 text-slate-600 font-medium text-sm hover:bg-slate-50"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  className="w-2/3 py-3 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-semibold text-sm shadow-md flex items-center justify-center gap-2"
                >
                  Next Step
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="space-y-4"
            >
              {activeRole === 'patient' ? (
                <>
                  <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-100 shadow-sm">
                    <Key className="w-7 h-7" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Your Caregiver Connection Code</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Give this code to your caregiver to connect them to your CareSync account.
                    </p>
                  </div>

                  <div className="bg-teal-50/70 rounded-2xl p-5 border border-teal-200 text-center space-y-3">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-teal-800">
                      Active Connection Code
                    </span>
                    <div className="text-3xl font-mono font-extrabold text-teal-900 tracking-wider">
                      {connectionCode?.code || 'CARE-ALEX72'}
                    </div>
                    <button
                      onClick={copyCodeToClipboard}
                      className="py-2 px-4 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs shadow-xs inline-flex items-center gap-1.5 transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Copy Code
                    </button>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => setStep(2)}
                      className="w-1/3 py-3 rounded-xl border border-slate-200 text-slate-600 font-medium text-sm hover:bg-slate-50"
                    >
                      Back
                    </button>
                    <button
                      onClick={() => setStep(4)}
                      className="w-2/3 py-3 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-semibold text-sm shadow-md flex items-center justify-center gap-2"
                    >
                      Continue
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-100 shadow-sm">
                    <Key className="w-7 h-7" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Connect to a Patient</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Enter the patient's Care Connection Code (e.g. CARE-7K4P9Q).
                    </p>
                  </div>

                  <form onSubmit={handleCaregiverConnect} className="space-y-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Patient Connection Code *
                      </label>
                      <input
                        type="text"
                        required
                        value={inputCode}
                        onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                        placeholder="CARE-XXXXXX"
                        className="w-full font-mono uppercase bg-slate-50 border border-slate-200 rounded-xl p-3 text-base font-bold text-slate-900 text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-600"
                      />
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setStep(2)}
                        className="w-1/3 py-3 rounded-xl border border-slate-200 text-slate-600 font-medium text-sm hover:bg-slate-50"
                      >
                        Back
                      </button>
                      <button
                        type="submit"
                        disabled={linking}
                        className="w-2/3 py-3 rounded-xl bg-indigo-700 hover:bg-indigo-800 text-white font-semibold text-sm shadow-md flex items-center justify-center gap-2"
                      >
                        {linking ? 'Connecting...' : 'Connect to Patient'}
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </form>
                </>
              )}
            </motion.div>
          )}

          {step === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="space-y-5 text-center"
            >
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto border-2 border-emerald-200 shadow-inner">
                <ShieldCheck className="w-9 h-9" />
              </div>
              <div>
                <h2 className="text-2xl font-extrabold text-slate-900">You're All Set!</h2>
                <p className="text-sm text-slate-600 mt-1">
                  Your personalized CareSync {activeRole === 'patient' ? 'companion' : 'caregiver hub'} is ready.
                </p>
              </div>

              <button
                onClick={handleFinish}
                className="w-full py-4 px-4 rounded-2xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-base shadow-xl shadow-teal-700/20 transition-all transform active:scale-[0.99]"
              >
                Launch CareSync Dashboard
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

