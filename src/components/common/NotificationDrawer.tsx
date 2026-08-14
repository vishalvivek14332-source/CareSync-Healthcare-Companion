import React from 'react';
import { useCareSync } from '../../context/CareSyncContext';
import { Bell, Check, Trash2, X, Pill, Droplet, Footprints, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({ isOpen, onClose }) => {
  const { notifications, markNotificationRead, clearAllNotifications } = useCareSync();

  if (!isOpen) return null;

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-hidden">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs"
        />

        {/* Drawer Panel */}
        <div className="fixed inset-y-0 right-0 max-w-sm w-full flex pl-10">
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="w-full bg-white shadow-2xl flex flex-col border-l border-slate-200"
          >
            {/* Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-teal-100 text-teal-700 rounded-lg">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Notifications</h3>
                  <p className="text-xs text-slate-500">
                    {unreadCount > 0 ? `${unreadCount} unread reminders` : 'All caught up'}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Notification List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {notifications.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Bell className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm font-medium">No notifications right now</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => markNotificationRead(n.id)}
                    className={`p-3.5 rounded-xl border text-xs transition-all cursor-pointer relative ${
                      n.read
                        ? 'bg-slate-50/60 border-slate-200 text-slate-600'
                        : 'bg-teal-50/40 border-teal-200 text-slate-900 shadow-xs'
                    }`}
                  >
                    {!n.read && (
                      <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-teal-600" />
                    )}
                    <div className="font-bold text-slate-900 mb-0.5 pr-4">{n.title}</div>
                    <p className="text-slate-600 mb-1.5 leading-snug">{n.description}</p>
                    <div className="text-[10px] font-medium text-slate-400 flex items-center justify-between">
                      <span>{n.timestamp}</span>
                      {n.read ? (
                        <span className="text-slate-400">Read ✓</span>
                      ) : (
                        <span className="text-teal-700 font-semibold">Mark read</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="p-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs">
                <button
                  onClick={clearAllNotifications}
                  className="text-rose-600 hover:text-rose-700 font-medium flex items-center gap-1.5 px-2 py-1 hover:bg-rose-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear All
                </button>
                <button
                  onClick={onClose}
                  className="text-slate-600 font-semibold hover:text-slate-900 px-3 py-1 bg-white border border-slate-200 rounded-lg shadow-2xs"
                >
                  Done
                </button>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  );
};
