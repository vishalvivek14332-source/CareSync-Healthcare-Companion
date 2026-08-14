import React, { useState, useRef } from 'react';
import { useCareSync } from '../../context/CareSyncContext';
import { User, Phone, Moon, Lock, Save, Key, Copy, RefreshCw, Trash2, ShieldCheck, Camera, Image, Check, X } from 'lucide-react';

export const ProfileView: React.FC = () => {
  const {
    patient,
    currentUser,
    connectionCode,
    generateConnectionCode,
    revokeConnectionCode,
    updateUserProfile,
    updateProfilePhoto,
    addToast,
  } = useCareSync();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState<string>(currentUser?.name || patient?.name || '');
  const [age, setAge] = useState<number>(currentUser?.age || patient?.age || 72);
  const [caregiver, setCaregiver] = useState<string>(currentUser?.primaryCaregiver || patient?.primaryCaregiver || '');
  const [phone, setPhone] = useState<string>(currentUser?.caregiverPhone || patient?.caregiverPhone || '');
  const [quietHours, setQuietHours] = useState<string>(currentUser?.quietHours || patient?.quietHours || '10:00 PM - 7:00 AM');
  const [isRegenerating, setIsRegenerating] = useState<boolean>(false);

  // Photo upload state
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const [isSavingPhoto, setIsSavingPhoto] = useState<boolean>(false);

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

  // Image Gallery Selection & Client-side Canvas 256x256 compression
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      addToast('Please select a valid image file (JPEG, PNG, WebP)', 'error');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      addToast('Selected image exceeds 10MB limit', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 256;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setPreviewPhoto(compressedDataUrl);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleConfirmPhoto = async () => {
    if (!previewPhoto) return;
    setIsSavingPhoto(true);
    try {
      await updateProfilePhoto(previewPhoto);
      setPreviewPhoto(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingPhoto(false);
    }
  };

  const currentAvatar = previewPhoto || currentUser?.avatarUrl || patient?.avatarUrl;
  const userInitials = (currentUser?.name || patient?.name || 'Patient')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <div className="space-y-6 pb-20 max-w-4xl mx-auto pt-2 px-1">
      {/* Hidden File Input for Phone Gallery */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handlePhotoSelect}
        accept="image/*"
        className="hidden"
      />

      {/* Header */}
      <div className="bg-white p-6 rounded-3xl border border-stone-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <div className="relative group">
            {currentAvatar ? (
              <img
                src={currentAvatar}
                alt={currentUser?.name || patient.name}
                className="w-18 h-18 rounded-full object-cover border-2 border-teal-700 shadow-md"
              />
            ) : (
              <div className="w-18 h-18 rounded-full bg-teal-700 text-white font-extrabold text-xl flex items-center justify-center border-2 border-teal-800 shadow-md">
                {userInitials}
              </div>
            )}

            <button
              onClick={() => fileInputRef.current?.click()}
              title="Change Profile Photo"
              className="absolute -bottom-1 -right-1 p-2 rounded-full bg-stone-900 hover:bg-black text-white shadow-md transition-transform hover:scale-105"
            >
              <Camera className="w-4 h-4" />
            </button>
          </div>

          <div>
            <h1 className="text-2xl font-extrabold text-stone-900">{currentUser?.name || patient.name}</h1>
            <p className="text-xs text-stone-500 font-medium">Patient Account • Secure Profile</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-xs font-bold text-teal-800 hover:underline mt-1 inline-flex items-center gap-1"
            >
              <Image className="w-3.5 h-3.5" />
              Choose Photo from Gallery
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-end sm:self-center">
          {previewPhoto && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleConfirmPhoto}
                disabled={isSavingPhoto}
                className="px-4 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs shadow-xs flex items-center gap-1.5 transition-colors"
              >
                <Check className="w-4 h-4" />
                {isSavingPhoto ? 'Saving...' : 'Confirm Photo'}
              </button>
              <button
                onClick={() => setPreviewPhoto(null)}
                className="p-2.5 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <button
            onClick={handleSave}
            className="px-5 py-3 rounded-2xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs shadow-md shadow-teal-700/20 flex items-center gap-2 transition-all"
          >
            <Save className="w-4 h-4" />
            Save Settings
          </button>
        </div>
      </div>

      {/* CAREGIVER CONNECTION CODE CARD */}
      <div className="bg-gradient-to-br from-teal-50/80 via-white to-stone-50 p-6 rounded-3xl border-2 border-teal-200/80 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-teal-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-700 text-white flex items-center justify-center shadow-xs">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-stone-900">Caregiver Connection Code</h2>
              <p className="text-xs text-stone-600">Give this code to your trusted caregiver to securely link their CareSync app.</p>
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
              <span className="text-[11px] text-stone-400 font-medium mt-1 block">
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
                className="py-2.5 px-3.5 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 font-semibold text-xs transition-colors flex items-center gap-1.5"
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
          <div className="bg-white p-5 rounded-2xl border border-stone-200 text-center space-y-3">
            <p className="text-xs text-stone-600 font-medium">No active caregiver connection code found.</p>
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
        <div className="bg-white p-6 rounded-3xl border border-stone-200/80 shadow-2xs space-y-4">
          <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
            <User className="w-5 h-5 text-teal-700" />
            Personal Information
          </h2>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-stone-700 block mb-1">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-xs font-semibold text-stone-800 focus:outline-none focus:ring-2 focus:ring-teal-700"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-stone-700 block mb-1">Age</label>
              <input
                type="number"
                value={age}
                onChange={(e) => setAge(parseInt(e.target.value) || 72)}
                className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-xs font-semibold text-stone-800 focus:outline-none focus:ring-2 focus:ring-teal-700"
              />
            </div>
          </div>
        </div>

        {/* CAREGIVER & EMERGENCY CONTACTS */}
        <div className="bg-white p-6 rounded-3xl border border-stone-200/80 shadow-2xs space-y-4">
          <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
            <Phone className="w-5 h-5 text-indigo-700" />
            Caregiver & Emergency Contact
          </h2>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-stone-700 block mb-1">Trusted Caregiver Name</label>
              <input
                type="text"
                value={caregiver}
                onChange={(e) => setCaregiver(e.target.value)}
                placeholder="e.g. Sarah Johnson"
                className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-xs font-semibold text-stone-800 focus:outline-none focus:ring-2 focus:ring-teal-700"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-stone-700 block mb-1">Caregiver Phone Number</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. (555) 019-2831"
                className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-xs font-semibold text-stone-800 focus:outline-none focus:ring-2 focus:ring-teal-700"
              />
            </div>
          </div>
        </div>

        {/* QUIET HOURS & NOTIFICATION SCHEDULE */}
        <div className="bg-white p-6 rounded-3xl border border-stone-200/80 shadow-2xs space-y-4">
          <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
            <Moon className="w-5 h-5 text-indigo-700" />
            Sleep Schedule & Quiet Hours
          </h2>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-stone-700 block mb-1">Quiet Hours Interval</label>
              <input
                type="text"
                value={quietHours}
                onChange={(e) => setQuietHours(e.target.value)}
                className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-xs font-semibold text-stone-800 focus:outline-none focus:ring-2 focus:ring-teal-700"
              />
            </div>
            <p className="text-[11px] text-stone-400">Non-urgent audio reminders are silenced during quiet hours.</p>
          </div>
        </div>

        {/* PRIVACY & NOTIFICATION PREFERENCES */}
        <div className="bg-white p-6 rounded-3xl border border-stone-200/80 shadow-2xs space-y-4">
          <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
            <Lock className="w-5 h-5 text-teal-700" />
            Privacy & Security
          </h2>

          <div className="space-y-3 text-xs">
            <label className="flex items-center justify-between p-3 bg-stone-50 rounded-xl border border-stone-200/80 cursor-pointer">
              <span className="font-semibold text-stone-800">Voice Assistant Speech Feedback</span>
              <input type="checkbox" defaultChecked className="w-4 h-4 text-teal-700 rounded" />
            </label>

            <label className="flex items-center justify-between p-3 bg-stone-50 rounded-xl border border-stone-200/80 cursor-pointer">
              <span className="font-semibold text-stone-800">Share Daily CareScore with Connected Caregiver</span>
              <input type="checkbox" defaultChecked className="w-4 h-4 text-teal-700 rounded" />
            </label>
          </div>
        </div>
      </form>
    </div>
  );
};
