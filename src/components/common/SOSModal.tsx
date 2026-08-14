import React, { useState } from 'react';
import { useCareSync } from '../../context/CareSyncContext';
import { AlertTriangle, Phone, ShieldAlert, X, HeartHandshake } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const SOSModal: React.FC = () => {
  const { sosModalOpen, setSosModalOpen, sendSOS, patient } = useCareSync();
  const [selectedReason, setSelectedReason] = useState<string>('Need assistance');

  if (!sosModalOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-rose-100 overflow-hidden relative"
        >
          {/* Header */}
          <div className="flex items-start justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-rose-100 rounded-xl text-rose-600">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Are you sure you need help?</h2>
                <p className="text-xs text-slate-500 mt-0.5">CareSync Emergency Assistance</p>
              </div>
            </div>
            <button
              onClick={() => setSosModalOpen(false)}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Contact details */}
          <div className="my-5 space-y-3">
            <p className="text-sm font-medium text-slate-700">
              Triggering SOS will instantly send priority push alerts, SMS, and an automated call to your caregiver:
            </p>

            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-sm">
                  SJ
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900">{patient.emergencyContact}</div>
                  <div className="text-xs text-slate-500">{patient.emergencyPhone}</div>
                </div>
              </div>
              <a
                href={`tel:${patient.emergencyPhone}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-sm transition-colors"
              >
                <Phone className="w-3.5 h-3.5" />
                Call Now
              </a>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600">Optionally select reason:</label>
              <select
                value={selectedReason}
                onChange={(e) => setSelectedReason(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                <option value="Need assistance with medication or walk">Need assistance with medication/walk</option>
                <option value="Feeling unwell or dizzy">Feeling unwell or dizzy</option>
                <option value="Slipped or lost balance">Slipped or lost balance</option>
                <option value="Urgent question for caregiver">Urgent question for caregiver</option>
              </select>
            </div>
          </div>

          {/* Action buttons */}
          <div className="space-y-2 pt-2">
            <button
              onClick={() => sendSOS(selectedReason)}
              className="w-full py-3.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-bold text-sm shadow-lg shadow-rose-600/25 flex items-center justify-center gap-2 transition-all transform active:scale-[0.98]"
            >
              <ShieldAlert className="w-5 h-5" />
              Send Immediate Emergency SOS
            </button>

            <button
              onClick={() => setSosModalOpen(false)}
              className="w-full py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-medium transition-colors"
            >
              Cancel
            </button>
          </div>

          {/* Safety Disclaimer */}
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-start gap-2 text-[11px] text-slate-400">
            <HeartHandshake className="w-4 h-4 shrink-0 text-slate-400 mt-0.5" />
            <p>
              CareSync is a personal routine & wellness companion. For acute life-threatening medical emergencies, always dial <strong>911</strong> or local emergency services directly.
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
