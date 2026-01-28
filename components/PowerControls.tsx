
import React, { useState } from 'react';
import { api } from '../services/api';
import { Modal } from './Modal';
import { PowerIcon } from './icons/PowerIcon';
import { RestartIcon } from './icons/RestartIcon';

export const PowerControls: React.FC = () => {
  const [isShutdownModalOpen, setShutdownModalOpen] = useState(false);
  const [isRestartModalOpen, setRestartModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePowerAction = async (action: 'shutdown' | 'restart') => {
    setIsSubmitting(true);
    try {
      await api.performPowerAction(action);
    } catch (error) {
      console.error(`Failed to ${action} server`, error);
      alert(`Error: Could not ${action} the server.`);
    } finally {
      setIsSubmitting(false);
      setShutdownModalOpen(false);
      setRestartModalOpen(false);
    }
  };

  return (
    <>
      <div className="bg-gray-800/50 rounded-lg shadow-lg p-6 backdrop-blur-sm">
        <h2 className="text-xl font-semibold text-white mb-4">Power Controls</h2>
        <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
          <button
            onClick={() => setShutdownModalOpen(true)}
            className="flex-1 flex items-center justify-center px-4 py-3 bg-red-800 hover:bg-red-700 text-white font-bold rounded-lg transition-colors duration-200 disabled:opacity-50"
          >
            <PowerIcon className="w-5 h-5 mr-2" />
            Shutdown
          </button>
          <button
            onClick={() => setRestartModalOpen(true)}
            className="flex-1 flex items-center justify-center px-4 py-3 bg-yellow-600 hover:bg-yellow-500 text-white font-bold rounded-lg transition-colors duration-200 disabled:opacity-50"
          >
            <RestartIcon className="w-5 h-5 mr-2" />
            Restart
          </button>
        </div>
      </div>

      <Modal
        isOpen={isShutdownModalOpen}
        onClose={() => setShutdownModalOpen(false)}
        title="Confirm Shutdown"
        description="Are you sure you want to shut down the server? This action is irreversible."
      >
        <div className="mt-4 flex justify-end space-x-3">
          <button onClick={() => setShutdownModalOpen(false)} className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-md">Cancel</button>
          <button onClick={() => handlePowerAction('shutdown')} disabled={isSubmitting} className="px-4 py-2 bg-red-700 hover:bg-red-600 rounded-md disabled:bg-red-900">
            {isSubmitting ? 'Shutting Down...' : 'Confirm'}
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={isRestartModalOpen}
        onClose={() => setRestartModalOpen(false)}
        title="Confirm Restart"
        description="Are you sure you want to restart the server?"
      >
        <div className="mt-4 flex justify-end space-x-3">
          <button onClick={() => setRestartModalOpen(false)} className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-md">Cancel</button>
          <button onClick={() => handlePowerAction('restart')} disabled={isSubmitting} className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 rounded-md disabled:bg-yellow-800">
            {isSubmitting ? 'Restarting...' : 'Confirm'}
          </button>
        </div>
      </Modal>
    </>
  );
};
