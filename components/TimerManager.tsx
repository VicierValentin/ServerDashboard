
import React, { useState } from 'react';
import type { SystemdTimer } from '../types';
import { mockApi } from '../services/mockApi';
import { Modal } from './Modal';
import { PlusIcon } from './icons/PlusIcon';
import { EditIcon } from './icons/EditIcon';
import { TrashIcon } from './icons/TrashIcon';
import { ClockIcon } from './icons/ClockIcon';

interface TimerManagerProps {
  timers: SystemdTimer[];
  setTimers: React.Dispatch<React.SetStateAction<SystemdTimer[]>>;
}

const TimerForm: React.FC<{ timer?: SystemdTimer | null; onSave: (timer: Omit<SystemdTimer, 'id' | 'nextElapse' | 'lastTriggered'> & { id?: string }) => void; onCancel: () => void }> = ({ timer, onSave, onCancel }) => {
  const [name, setName] = useState(timer?.name || '');
  const [onCalendar, setOnCalendar] = useState(timer?.onCalendar || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !onCalendar) {
        alert("Please fill in both fields.");
        return;
    }
    onSave({ id: timer?.id, name, onCalendar, active: timer?.active ?? true });
  };
  
  return (
    <form onSubmit={handleSubmit}>
        <div className="space-y-4">
            <div>
                <label htmlFor="timer-name" className="block text-sm font-medium text-gray-300">Timer Name</label>
                <input type="text" id="timer-name" value={name} onChange={e => setName(e.target.value)} className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-white" placeholder="e.g., Daily Shutdown" />
            </div>
            <div>
                <label htmlFor="timer-schedule" className="block text-sm font-medium text-gray-300">Schedule (OnCalendar)</label>
                <input type="text" id="timer-schedule" value={onCalendar} onChange={e => setOnCalendar(e.target.value)} className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-white" placeholder="e.g., *-*-* 02:00:00" />
                 <p className="text-xs text-gray-400 mt-1">Use systemd.time format.</p>
            </div>
        </div>
        <div className="mt-6 flex justify-end space-x-3">
            <button type="button" onClick={onCancel} className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-md">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-md">Save Timer</button>
        </div>
    </form>
  )
}

export const TimerManager: React.FC<TimerManagerProps> = ({ timers, setTimers }) => {
  const [isModalOpen, setModalOpen] = useState(false);
  const [editingTimer, setEditingTimer] = useState<SystemdTimer | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSaveTimer = async (timer: Omit<SystemdTimer, 'id' | 'nextElapse' | 'lastTriggered'> & { id?: string }) => {
    setLoading(true);
    try {
        const updatedTimers = await mockApi.addOrUpdateTimer(timer);
        setTimers(updatedTimers);
        setModalOpen(false);
        setEditingTimer(null);
    } catch (error) {
        alert("Failed to save timer.");
        console.error(error);
    } finally {
        setLoading(false);
    }
  }
  
  const handleRemoveTimer = async (id: string) => {
    if (window.confirm("Are you sure you want to remove this timer?")) {
        setLoading(true);
        try {
            const updatedTimers = await mockApi.removeTimer(id);
            setTimers(updatedTimers);
        } catch (error) {
            alert("Failed to remove timer.");
            console.error(error);
        } finally {
            setLoading(false);
        }
    }
  }

  const handleSkipTimer = async (id: string) => {
    setLoading(true);
    try {
        const updatedTimers = await mockApi.skipTimer(id);
        setTimers(updatedTimers);
    } catch (error) {
        alert("Failed to skip timer.");
        console.error(error);
    } finally {
        setLoading(false);
    }
  }

  return (
    <>
      <div className="bg-gray-800/50 rounded-lg shadow-lg p-6 backdrop-blur-sm h-full">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-white">Shutdown Timers</h2>
          <button onClick={() => { setEditingTimer(null); setModalOpen(true); }} className="flex items-center px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-md text-sm">
            <PlusIcon className="w-4 h-4 mr-2" />
            Add Timer
          </button>
        </div>
        <div className="space-y-3">
          {timers.length === 0 ? (
            <p className="text-gray-400 text-center py-4">No shutdown timers configured.</p>
          ) : (
            timers.map((timer) => (
            <div key={timer.id} className={`bg-gray-900/70 p-4 rounded-lg ${!timer.active ? 'opacity-50' : ''}`}>
              <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-white">{timer.name}</p>
                    <p className="text-sm text-gray-400">{timer.onCalendar}</p>
                    <p className="text-xs text-gray-500 mt-1">Next: {new Date(timer.nextElapse).toLocaleString()}</p>
                  </div>
                  <div className="flex space-x-2 flex-shrink-0">
                      <button onClick={() => { setEditingTimer(timer); setModalOpen(true);}} className="p-2 text-gray-400 hover:text-white"><EditIcon className="w-5 h-5"/></button>
                      <button onClick={() => handleRemoveTimer(timer.id)} className="p-2 text-gray-400 hover:text-red-400"><TrashIcon className="w-5 h-5"/></button>
                  </div>
              </div>
              {timer.active && (
                <button onClick={() => handleSkipTimer(timer.id)} disabled={loading} className="mt-3 flex items-center text-sm text-yellow-400 hover:text-yellow-300 disabled:opacity-50">
                    <ClockIcon className="w-4 h-4 mr-2"/>
                    Skip for Today
                </button>
              )}
               {!timer.active && (
                <p className="mt-3 text-sm text-gray-400">Skipped for today.</p>
              )}
            </div>
          )))}
        </div>
      </div>
      <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title={editingTimer ? "Edit Timer" : "Add New Timer"}>
        <TimerForm timer={editingTimer} onSave={handleSaveTimer} onCancel={() => setModalOpen(false)} />
      </Modal>
    </>
  );
};
