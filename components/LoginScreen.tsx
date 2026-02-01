import React, { useState, useEffect } from 'react';
import { UserProfile, PREDEFINED_USERS, AppSettings } from '../types';
import { User, Plus, Settings, Check, LogIn } from 'lucide-react';
import { saveSettings, getSettings } from '../utils/db';
import { initGapiClient, initGisClient, getUserInfo } from '../services/googleDriveService';

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
  const [isGoogleReady, setIsGoogleReady] = useState(false);

  useEffect(() => {
    getSettings().then((c) => {
      setConfig(c);
      if (c.googleClientId && c.googleApiKey) {
        initGapiClient(c.googleApiKey).then(() => {
          initGisClient(c.googleClientId!, () => {}); // Pre-init logic mainly
          setIsGoogleReady(true);
        });
      }
    });
  }, []);

  const handleAdd = () => {
    if (newUserName.trim()) {
      onAddUser(newUserName);
      setNewUserName('');
      setIsAdding(false);
    }
  };

  const handleGoogleSignIn = () => {
    if (!config.googleClientId) return;

    // Re-init mainly to attach callback for this specific action if needed, 
    // but here we use a temporary client or existing structure.
    // For simplicity, we assume initGisClient sets up a global tokenClient.
    // However, initGisClient in our service takes a callback. Let's create a specialized one here or modify service.
    // Actually, initGisClient overwrites the global callback. So we call it again with OUR callback.
    
    initGisClient(config.googleClientId, async (tokenResponse) => {
      if (tokenResponse && tokenResponse.access_token) {
        try {
          const userInfo = await getUserInfo(tokenResponse.access_token);
          // userInfo has { name, email, picture, ... }
          
          // Check if user exists by email (if we stored email) or name
          // Since our UserProfile didn't have email enforced, we'll check by name/id collision or create new
          // Best logic: Search availableUsers for matching name or create new
          
          const existingUser = availableUsers.find(u => u.name === userInfo.name || (u.email === userInfo.email && userInfo.email));
          
          if (existingUser) {
            onLogin(existingUser);
          } else {
            // Create new user profile from Google
            const newUser: UserProfile = {
              id: 'google_' + userInfo.sub, // Unique Google ID
              name: userInfo.name,
              avatarColor: 'bg-blue-600', // Default or could use picture
              email: userInfo.email,
              playbackSpeed: 1.3,
              selectedVoice: 'Kore',
              isDarkMode: true
            };
            // Use onAddUser logic but passing full object would be better. 
            // Since onAddUser only takes name, we might need to bypass it or invoke onLogin directly 
            // after ensuring App.tsx saves it.
            // But App.tsx's performLogin saves the user if not exists! So we can just call onLogin(newUser).
            onLogin(newUser);
          }
        } catch (err) {
          console.error("Google Sign-In failed", err);
        }
      }
    });
    
    // Trigger the popup
    // We need to access the handleGoogleLogin-like trigger but with the callback we just set.
    // In our service, handleGoogleLogin() calls tokenClient.requestAccessToken().
    // We can import handleGoogleLogin and call it.
    const { handleGoogleLogin } = require('../services/googleDriveService');
    handleGoogleLogin();
  };

  const saveConfig = () => {
    saveSettings(config).then(() => {
      onUpdateSettings(config);
      setShowSettings(false);
      // Try to init google if keys provided
      if (config.googleClientId && config.googleApiKey) {
          initGapiClient(config.googleApiKey).then(() => {
              setIsGoogleReady(true);
          });
      }
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
             To enable Google Sign-In and Drive Sync, provide your keys from Google Cloud Console.
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
        className="absolute top-6 right-6 p-2 text-gray-400 hover:text-primary transition-colors z-20"
      >
        <Settings size={24} />
      </button>

      <div className="text-center mb-12 animate-fade-in">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">Who is reading?</h1>
        <p className="text-gray-500 dark:text-gray-400">Select your profile to load your library</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-8 max-w-4xl mx-auto mb-10">
        {availableUsers.map((user) => (
          <div key={user.id} className="group flex flex-col items-center gap-3 animate-fade-in-up">
            <button 
              onClick={() => onLogin(user)}
              className={`w-24 h-24 rounded-full ${user.avatarColor} flex items-center justify-center shadow-lg transform transition-all duration-300 group-hover:scale-110 group-hover:ring-4 ring-primary/30 cursor-pointer`}
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
                className="w-24 h-24 rounded-full bg-gray-200 dark:bg-white/5 border-2 border-dashed border-gray-400 dark:border-gray-600 flex items-center justify-center hover:bg-gray-300 dark:hover:bg-white/10 transition-colors cursor-pointer"
              >
                <Plus size={32} className="text-gray-500 dark:text-gray-400" />
              </button>
            )}
            <span className="text-lg font-medium text-gray-500 dark:text-gray-400">Add Profile</span>
        </div>
      </div>

      {/* Google Sign In Button */}
      {isGoogleReady && (
        <div className="animate-fade-in-up delay-200">
           <button 
             onClick={handleGoogleSignIn}
             className="flex items-center gap-3 px-6 py-3 bg-white dark:bg-white/10 text-gray-700 dark:text-white rounded-full shadow-md hover:shadow-lg transition-all border border-gray-200 dark:border-transparent"
           >
             <LogIn size={20} />
             <span className="font-medium">Sign in with Google</span>
           </button>
        </div>
      )}
    </div>
  );
};