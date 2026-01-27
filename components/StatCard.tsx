
import React from 'react';

interface StatCardProps {
  icon: React.ReactNode;
  title: string;
  value: string;
  progress?: number;
}

export const StatCard: React.FC<StatCardProps> = ({ icon, title, value, progress }) => {
  const getProgressColor = (p: number) => {
    if (p > 90) return 'bg-red-500';
    if (p > 70) return 'bg-yellow-500';
    return 'bg-green-500';
  };
  
  return (
    <div className="bg-gray-900/70 p-4 rounded-lg flex flex-col justify-between h-full">
      <div>
        <div className="flex items-center text-gray-400 mb-2">
          <div className="w-6 h-6 mr-3">{icon}</div>
          <span className="font-medium">{title}</span>
        </div>
        <p className="text-2xl font-bold text-white truncate">{value}</p>
      </div>
      {progress !== undefined && (
        <div className="mt-4">
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${getProgressColor(progress)}`}
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      )}
    </div>
  );
};
