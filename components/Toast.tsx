import React, { useEffect } from 'react';
import { CheckCircle, AlertTriangle, XCircle, X } from 'lucide-react';

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'warning';
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`fixed top-4 right-4 z-50 flex items-center p-4 mb-4 text-sm rounded-lg shadow-lg border animate-in slide-in-from-top-5 duration-300 ${
      type === 'success' ? 'bg-green-50 text-green-800 border-green-200' :
      type === 'warning' ? 'bg-yellow-50 text-yellow-800 border-yellow-200' :
      'bg-red-50 text-red-800 border-red-200'
    }`} role="alert">
      <div className="flex-shrink-0">
        {type === 'success' && <CheckCircle className="w-5 h-5" />}
        {type === 'warning' && <AlertTriangle className="w-5 h-5" />}
        {type === 'error' && <XCircle className="w-5 h-5" />}
      </div>
      <div className="ms-3 text-sm font-medium mr-8">
        {message}
      </div>
      <button 
        type="button" 
        className={`ms-auto -mx-1.5 -my-1.5 rounded-lg focus:ring-2 p-1.5 inline-flex items-center justify-center h-8 w-8 ${
           type === 'success' ? 'bg-green-50 text-green-500 hover:bg-green-200 focus:ring-green-400' :
           type === 'warning' ? 'bg-yellow-50 text-yellow-500 hover:bg-yellow-200 focus:ring-yellow-400' :
           'bg-red-50 text-red-500 hover:bg-red-200 focus:ring-red-400'
        }`} 
        onClick={onClose}
        aria-label="Close"
      >
        <span className="sr-only">Close</span>
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
