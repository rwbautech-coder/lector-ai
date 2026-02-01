import React, { useState, useEffect } from 'react';
import { UserProfile, PREDEFINED_USERS, AppSettings } from '../types';
import { User, Plus, Settings, Check } from 'lucide-react';
import { saveSettings, getSettings } from '../utils/db';

interface LoginScreenProps {
  onLogin: (user: UserProfile) => void;
  availableUsers: UserProfile[];
  onAddUser: (name: string) => void;
  onUpdateSettings: (s: AppSettings) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, availableUsers, onAddUser, onUpdateSettings }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [config, setConfig] = useState<AppSettings>({ googleClientId: '', googleApiKey: '' });

  useEffect(() => {
    getSettings().then(setConfig);
  }, []);

  const handleAdd = () => {
    if (newUserName.trim()) {
      onAddUser(newUserName);
      setNewUserName('');
      setIsAdding(false);
    }
  };

  const saveConfig = () => {
    saveSettings(config).then(() => {
      onUpdateSettings(config);
      setShowSettings(false);
    });
  };

  if (showSettings) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark p-6">
        <div className="bg-surface-light dark:bg-surface-dark p-8 rounded-2xl shadow-xl border border-gray-200 dark:border-white/10 w-full max-w-md">
           <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white flex items-center gap-2">
             <Settings /> Configuration
           </h2>
           <p className="text-sm text-gray-500 mb-4">
             To enable Google Drive Sync, you must provide your own keys from Google Cloud Console.
             Ensure the keys have permissions for Google Drive API.
           </p>
           
           <div className="space-y-4">
             <div>
               <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Google Client ID</label>
               <input 
                 type="text" 
                 className="w-full p-2 rounded bg-background-light dark:bg-background-dark border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                 placeholder="Obtained from GCP"
                 value={config.googleClientId || ''}
                 onChange={e => setConfig({...config, googleClientId: e.target.value})}
               />
             </div>
             <div>
               <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Google API Key</label>
               <input 
                 type="text" 
                 className="w-full p-2 rounded bg-background-light dark:bg-background-dark border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                 placeholder="Obtained from GCP"
                 value={config.googleApiKey || ''}
                 onChange={e => setConfig({...config, googleApiKey: e.target.value})}
               />
             </div>
           </div>

           <div className="mt-8 flex justify-end gap-4">
             <button onClick={() => setShowSettings(false)} className="px-4 py-2 text-gray-500 hover:text-gray-700 dark:hover:text-white">Cancel</button>
             <button onClick={saveConfig} className="px-4 py-2 bg-primary hover:bg-secondary text-white rounded-lg flex items-center gap-2">
               <Check size={16} /> Save
             </button>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background-light dark:bg-background-dark p-6 relative">
      
      <button 
        onClick={() => setShowSettings(true)}
        className="absolute top-6 right-6 p-2 text-gray-400 hover:text-primary transition-colors"
      >
        <Settings size={24} />
      </button>

      <div className="text-center mb-12 animate-fade-in">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">Who is reading?</h1>
        <p className="text-gray-500 dark:text-gray-400">Select your profile to load your library</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
        {availableUsers.map((user) => (
          <div key={user.id} className="group flex flex-col items-center gap-3 animate-fade-in-up">
            <button 
              onClick={() => onLogin(user)}
              className={`w-24 h-24 rounded-full ${user.avatarColor} flex items-center justify-center shadow-lg transform transition-all duration-300 group-hover:scale-110 group-hover:ring-4 ring-primary/30`}
            >
              <span className="text-3xl font-bold text-white uppercase">{user.name[0]}</span>
            </button>
            <span className="text-lg font-medium text-gray-700 dark:text-gray-200 group-hover:text-primary transition-colors">
              {user.name}
            </span>
          </div>
        ))}

        {/* Add User Button */}
        <div className="flex flex-col items-center gap-3">
            {isAdding ? (
              <div className="w-24 h-24 flex items-center justify-center">
                 <input 
                   autoFocus
                   type="text" 
                   className="w-32 text-center bg-transparent border-b-2 border-primary outline-none text-gray-900 dark:text-white"
                   placeholder="Name"
                   value={newUserName}
                   onChange={e => setNewUserName(e.target.value)}
                   onKeyDown={e => e.key === 'Enter' && handleAdd()}
                   onBlur={() => !newUserName && setIsAdding(false)}
                 />
              </div>
            ) : (
              <button 
                onClick={() => setIsAdding(true)}
                className="w-24 h-24 rounded-full bg-gray-200 dark:bg-white/5 border-2 border-dashed border-gray-400 dark:border-gray-600 flex items-center justify-center hover:bg-gray-300 dark:hover:bg-white/10 transition-colors"
              >
                <Plus size={32} className="text-gray-500 dark:text-gray-400" />
              </button>
            )}
            <span className="text-lg font-medium text-gray-500 dark:text-gray-400">Add Profile</span>
        </div>
      </div>
    </div>
  );
};