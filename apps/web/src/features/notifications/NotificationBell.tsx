import React, { useState, useRef, useEffect } from 'react';
import { useNotifications } from './useNotifications';

export const NotificationBell: React.FC = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead, isLoading } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        className="relative p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors focus:outline-none"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Thông báo"
        aria-expanded={isOpen}
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-xs font-bold text-white bg-amber-500 rounded-full shadow">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/80 backdrop-blur">
            <span className="font-semibold text-sm text-white flex items-center gap-2">
              <span>🔔</span> Thông báo
            </span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAllAsRead()}
                className="text-xs text-amber-400 hover:text-amber-300 font-medium hover:underline"
              >
                Đọc tất cả
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/60">
            {isLoading ? (
              <div className="p-4 text-center text-xs text-slate-400">Đang tải thông báo...</div>
            ) : notifications.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-400">
                <p>✨ Bạn chưa có thông báo nào mới.</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => {
                    if (!n.readAt) markAsRead(n.id);
                  }}
                  className={`p-3.5 transition-colors cursor-pointer text-left ${
                    n.readAt
                      ? 'bg-slate-900/40 hover:bg-slate-800/40 text-slate-400'
                      : 'bg-slate-800/60 hover:bg-slate-800 text-slate-200 font-medium'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold text-white">{n.title}</p>
                    {!n.readAt && (
                      <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0 mt-1" />
                    )}
                  </div>
                  <p className="text-xs mt-1 text-slate-300 line-clamp-2">{n.message}</p>
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    {new Date(n.createdAt).toLocaleString('vi-VN')}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
