
import React from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  size?: 'md' | 'lg' | 'xl' | '3xl';
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, description, children, size = 'md' }) => {
  if (!isOpen) return null;

  const sizeClasses = {
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '3xl': 'max-w-3xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75" aria-modal="true" role="dialog">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true"></div>
      <div className={`relative bg-gray-800 rounded-lg shadow-xl w-full mx-4 p-6 text-white ${sizeClasses[size]}`}>
        <h3 className="text-lg font-medium leading-6">{title}</h3>
        {description && (
          <div className="mt-2">
            <p className="text-sm text-gray-400">{description}</p>
          </div>
        )}
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
};
