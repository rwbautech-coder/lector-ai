import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Upload, FileText, AlertCircle, BookOpen, Clock, X, Cloud, LogOut, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, List, Download, Link as LinkIcon, Globe } from 'lucide-react';
import { AVAILABLE_VOICES, TextChunk, ReaderState, UserProfile, PREDEFINED_USERS, Book, AppSettings, Page, Chapter } from './types';
import { generateSpeechKokoro, initKokoro } from './services/kokoroService';
import { generateSpeechPiper, initPiper } from './services/piperService';
import { chunkText, organizePages } from './utils/audioUtils';
import { extractTextFromPdf } from './utils/pdfUtils';
import { detectLanguage } from './utils/textUtils';
import { Visualizer } from './components/Visualizer';
import { Controls } from './components/Controls';
import { LoginScreen } from './components/LoginScreen';
import { saveBookToLocal, getBooksForUser, saveSettings, getSettings, saveUser, getUser } from './utils/db';
import { initGapiClient, initGisClient, handleGoogleLogin, saveBookToDrive, syncBooksWithDrive } from './services/googleDriveService';

export default function App() {
  // --- USER & AUTH STATE ---
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [users, setUsers] = useState<UserProfile[]>(PREDEFINED_USERS);
  const [isDriveConnected, setIsDriveConnected] = useState(false);
  const [config, setConfig] = useState<AppSettings>({});

  // --- APP STATE ---
  const [myBooks, setMyBooks] = useState<Book[]>([]);
  const [currentBook, setCurrentBook] = useState<Book | null>(null);
  
  // --- READER STATE ---
  const [chunks, setChunks] = useState<TextChunk[]>([]);
  const [pages, setPages] = useState<Page[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  
  const [currentChunkIndex, setCurrentChunkIndex] = useState<number>(0);
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);
  
  const [readerState, setReaderState] = useState<ReaderState>(ReaderState.IDLE);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [selectedVoice, setSelectedVoice] = useState<string>('Kore');
  const [error, setError] = useState<string | null>(null);
  const [isApiLoading, setIsApiLoading] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  
  // Automation State
  const [pendingAutoReadUrl, setPendingAutoReadUrl] = useState<string | null>(null);
  
  // Theme & UI
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
  const [showLibrary, setShowLibrary] = useState<boolean>(false);
  const [showChapters, setShowChapters] = useState<boolean>(false);

  // --- REFS ---
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isPlayingRef = useRef<boolean>(false);
  const nextChunkRef = useRef<() => void>(() => {});
  // System TTS Ref
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const [isUsingSystemTTS, setIsUsingSystemTTS] = useState<boolean>(false);
  
  // Track PWA install prompt
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  // --- HELPER FUNCTIONS (DEFINED BEFORE USE) ---

  const setIsPlayingRef = (val: boolean) => {
      isPlayingRef.current = val;
  };

  const saveProgressToCloud = async () => {
     if (isDriveConnected && currentBook && currentUser) {
         await saveBookToDrive(currentBook);
     }
  };

  const updateProgress = async (index: number) => {
     if (!currentUser || !currentBook) return;
     
     const updatedBook = {
        ...currentBook,
        currentChunkIndex: index,
        lastRead: Date.now(),
        lastModified: Date.now()
     };
     setCurrentBook(updatedBook);
     await saveBookToLocal(currentUser.id, updatedBook);
  };

  const triggerSync = async (userId: string) => {
     if (!isDriveConnected) return;
     setIsSyncing(true);
     try {
       const localBooks = await getBooksForUser(userId);
       const syncedBooks = await syncBooksWithDrive(localBooks);
       for (const b of syncedBooks) {
         await saveBookToLocal(userId, b);
       }
       setMyBooks(syncedBooks);
     } catch (e) {
       console.error("Sync failed", e);
     } finally {
       setIsSyncing(false);
     }
  };

  const initAudio = () => {
    if (!audioRef.current) {
      console.log("[Audio] Initializing HTMLAudioElement...");
      audioRef.current = new Audio();
      audioRef.current.preservesPitch = true;
      audioRef.current.onended = () => {
        console.log("[Audio] Playback ended.");
        if (isPlayingRef.current) {
            nextChunkRef.current();
        }
      };
      audioRef.current.onerror = (e) => {
        console.error("[Audio] Error event fired:", audioRef.current?.error);
        setIsPlayingRef(false);
        setReaderState(ReaderState.IDLE);
      };
      audioRef.current.onloadedmetadata = () => {
        console.log(`[Audio] Metadata loaded. Duration: ${audioRef.current?.duration}s`);
      };
      audioRef.current.onplay = () => console.log("[Audio] Started playing.");
      audioRef.current.onpause = () => console.log("[Audio] Paused.");
    }
  };

  const performLogin = async (user: UserProfile, isAuto: boolean = false) => {
    try {
      let loadedUser = await getUser(user.id);
      if (!loadedUser) {
          loadedUser = { ...user };
          await saveUser(loadedUser);
      }
      
      setCurrentUser(loadedUser);
      setPlaybackSpeed(loadedUser.playbackSpeed ?? 1.3);
      setSelectedVoice(loadedUser.selectedVoice || 'Kore');
      setIsDarkMode(loadedUser.isDarkMode ?? true);

    } catch (dbError) {
      console.error("Database error during login:", dbError);
      setCurrentUser(user);
      setPlaybackSpeed(user.playbackSpeed ?? 1.3);
      setSelectedVoice(user.selectedVoice || 'Kore');
      setIsDarkMode(user.isDarkMode ?? true);
    }

    localStorage.setItem('lector_last_user_id', user.id);
    
    try {
      const books = await getBooksForUser(user.id);
      setMyBooks(books);
    } catch (e) {
      console.error("Failed to load books:", e);
      setMyBooks([]);
    }
    
    if (!isAuto && !pendingAutoReadUrl) {
      setShowLibrary(true); 
    }
  };

  const changePage = (offset: number) => {
      const newIndex = Math.max(0, Math.min(pages.length - 1, currentPageIndex + offset));
      if (newIndex !== currentPageIndex) {
          if (audioRef.current) audioRef.current.pause();
          setIsPlayingRef(false);
          setReaderState(ReaderState.IDLE);

          setCurrentPageIndex(newIndex);
          const firstChunkOfPage = pages[newIndex].startChunkIndex;
          setCurrentChunkIndex(firstChunkOfPage);
          updateProgress(firstChunkOfPage);
      }
  };

  const jumpToChapter = (chapter: Chapter) => {
      if (audioRef.current) audioRef.current.pause();
      setIsPlayingRef(false);
      setReaderState(ReaderState.IDLE);

      setCurrentPageIndex(chapter.pageIndex);
      setCurrentChunkIndex(chapter.chunkIndex);
      updateProgress(chapter.chunkIndex);
      setShowChapters(false);
  };

  const loadBook = (book: Book, autoPlay: boolean = false) => {
      setCurrentBook(book);
      
      const rawChunks = chunkText(book.content, 500);
      const textChunks: TextChunk[] = rawChunks.map((t, i) => ({
          id: i,
          text: t,
          status: 'pending'
      }));
      setChunks(textChunks);

      const { pages, chapters } = organizePages(textChunks);
      setPages(pages);
      setChapters(chapters);

      const startChunk = book.currentChunkIndex || 0;
      setCurrentChunkIndex(startChunk);
      
      const initialPage = pages.findIndex(p => startChunk >= p.startChunkIndex && startChunk <= p.endChunkIndex);
      setCurrentPageIndex(initialPage !== -1 ? initialPage : 0);

      setShowLibrary(false);
      setShowChapters(false);

      if (audioRef.current) {
          audioRef.current.pause();
          setIsPlayingRef(false);
      }

      // Force disable auto-play to ensure user interaction unlocks AudioContext on iOS
      /* if (autoPlay) {
        setTimeout(() => {
            setReaderState(ReaderState.PLAYING);
            setIsPlayingRef(true);
        }, 800);
      } else { */
        setReaderState(ReaderState.IDLE);
      /* } */
  };

  const processContent = async (text: string, title: string, autoPlay: boolean = false) => {
      if (!currentUser) return;
      
      const lang = detectLanguage(text);
      if (lang === 'pl') {
          setError("⚠️ Detected Polish text. Kokoro TTS supports only English and may read with a strong accent.");
      }

      const newBook: Book = {
         id: `${title.substring(0, 20).replace(/\s+/g, '_')}_${Date.now()}`,
         title: title,
         content: text,
         lastRead: Date.now(),
         currentChunkIndex: 0,
         totalChunks: 0, 
         lastModified: Date.now()
      };
      
      await saveBookToLocal(currentUser.id, newBook);
      setMyBooks(prev => [newBook, ...prev]);
      if (isDriveConnected) saveBookToDrive(newBook);

      loadBook(newBook, autoPlay);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !currentUser) return;
    
    setIsProcessingFile(true);
    setError(null);

    try {
      let text = '';
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        text = await extractTextFromPdf(file);
      } else {
        text = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsText(file);
        });
      }

      if (!text || text.trim().length === 0) {
        throw new Error("Could not extract text from this file.");
      }

      await processContent(text, file.name.replace(/\.(txt|pdf)$/i, ''));

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to process file.");
    } finally {
      setIsProcessingFile(false);
    }
  };

  const importContentFromUrl = async (url: string, autoPlay: boolean = false) => {
    if (!url.trim() || !currentUser) return;
    
    setIsProcessingFile(true);
    setError(null);
    setShowUrlInput(false);

    try {
      let response;
      let usedUrl = url;
      
      try {
          response = await fetch(url);
          if (!response.ok) throw new Error("Direct fetch failed");
      } catch (directError) {
          console.log("Direct fetch failed. Trying Proxy...");
          usedUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
          response = await fetch(usedUrl);
      }

      if (!response.ok) throw new Error(`Failed to fetch URL: ${response.statusText}`);
      
      const contentType = response.headers.get('content-type') || '';
      const blob = await response.blob();
      let text = '';
      
      let filename = url.split('/').pop() || 'Downloaded Content';
      if (filename.includes('?')) filename = filename.split('?')[0];
      if (filename.length > 30) filename = filename.substring(0, 30);
      filename = decodeURIComponent(filename);

      if (contentType.includes('pdf') || url.toLowerCase().endsWith('.pdf')) {
        text = await extractTextFromPdf(blob);
      } else {
        text = await blob.text();
      }

      if (!text || text.trim().length === 0) {
        throw new Error("Content appears empty or unsupported format.");
      }

      await processContent(text, filename, autoPlay);

    } catch (err: any) {
      console.error(err);
      setError(`Import failed: ${err.message}. If the link is private or blocks proxies, please download the file and upload it manually.`);
      setShowLibrary(true);
    } finally {
      setIsProcessingFile(false);
    }
  };

  // --- INITIALIZATION EFFECTS ---

  useEffect(() => {
    // Initial theme setting now comes from user profile after login
    getSettings().then(setConfig);
    
    // Detect Mobile Device
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    console.log(`[App] Device detection: ${isMobile ? 'Mobile' : 'Desktop'}`);
    
    // Start warming up models
    setTimeout(() => {
        if (isMobile) {
             console.log("[App] Skipping AI TTS warmup on mobile, using System TTS.");
             setIsUsingSystemTTS(true);
        } else {
            console.log("[App] Warming up AI models...");
            initKokoro().catch(e => console.warn("Kokoro warmup deferred:", e.message));
            initPiper().catch(e => console.warn("Piper warmup deferred:", e.message));
        }
    }, 1500);

    // PWA Install Event Listener

    const loadAllUsers = async () => {
        const initialUsers: UserProfile[] = [];
        for (const preUser of PREDEFINED_USERS) {
            const dbUser = await getUser(preUser.id);
            initialUsers.push(dbUser || preUser);
        }
        setUsers(initialUsers);
    };
    loadAllUsers();

    const params = new URLSearchParams(window.location.search);
    const readUrl = params.get('read') || params.get('url') || params.get('import');
    if (readUrl) {
      console.log("Found auto-read URL:", readUrl);
      setPendingAutoReadUrl(readUrl);
    }
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  useEffect(() => {
    if (currentUser) {
        setIsDarkMode(currentUser.isDarkMode);
    }
  }, [currentUser]);

  useEffect(() => {
    if (config.googleApiKey && config.googleClientId) {
      const initGoogle = async () => {
        try {
          await initGapiClient(config.googleApiKey!);
          initGisClient(config.googleClientId!, async (tokenResponse) => {
             if (tokenResponse && tokenResponse.access_token) {
                setIsDriveConnected(true);
                if (currentUser) triggerSync(currentUser.id);
             }
          });
        } catch (e) {
          console.error("Failed to init Google", e);
        }
      };
      initGoogle();
    }
  }, [config, currentUser]);

  useEffect(() => {
    if (currentUser && pendingAutoReadUrl && !isProcessingFile && !currentBook) {
      const urlToProcess = pendingAutoReadUrl;
      setPendingAutoReadUrl(null); 
      importContentFromUrl(urlToProcess, true); 
      
      const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
      window.history.pushState({path: newUrl}, '', newUrl);
    }
  }, [currentUser, pendingAutoReadUrl, isProcessingFile, currentBook]);

  useEffect(() => {
    if (currentUser) {
      const updatedUser: UserProfile = {
        ...currentUser,
        playbackSpeed: playbackSpeed,
        selectedVoice: selectedVoice,
        isDarkMode: isDarkMode
      };
      if (
        currentUser.playbackSpeed !== playbackSpeed ||
        currentUser.selectedVoice !== selectedVoice ||
        currentUser.isDarkMode !== isDarkMode
      ) {
        setCurrentUser(updatedUser); 
        saveUser(updatedUser);
      }
    }
  }, [playbackSpeed, selectedVoice, isDarkMode, currentUser]);

  // --- AUDIO LOGIC ---

  const nextChunk = useCallback(() => {
    setCurrentChunkIndex(prev => {
        const next = prev + 1;
        console.log(`[Reader] Advancing to chunk: ${next} / ${chunks.length}`);
        if (next >= chunks.length) {
            console.log("[Reader] Reached end of content.");
            setReaderState(ReaderState.IDLE);
            setIsPlayingRef(false);
            saveProgressToCloud();
            return prev;
        }
        return next;
    });
  }, [chunks.length]);

  // Handle progress updates in a separate effect to avoid nested state updates
  useEffect(() => {
    if (currentUser && currentBook && currentChunkIndex !== currentBook.currentChunkIndex) {
        updateProgress(currentChunkIndex);
    }
  }, [currentChunkIndex, currentUser, currentBook]);

  // Keep nextChunkRef updated to avoid stale closures in event listeners
  useEffect(() => {
    nextChunkRef.current = nextChunk;
  }, [nextChunk]);

  const triggerSync = async (userId: string) => {
    if (index >= chunks.length || index < 0) return;
    
    if (isUsingSystemTTS) {
       setChunks(prev => prev.map((c, i) => i === index ? { ...c, status: 'ready' } : c));
       return;
    }

    const chunkToCheck = chunks[index];
    if (!chunkToCheck) return;

    if (chunkToCheck.status === 'ready' || chunkToCheck.status === 'generating' || chunkToCheck.status === 'playing' || chunkToCheck.audioUrl || chunkToCheck.status === 'error') {
        return;
    }

    setChunks(prev => prev.map((c, i) => i === index ? { ...c, status: 'generating' } : c));
    
    try {
        if (index === currentChunkIndex) setIsApiLoading(true);

        const lang = detectLanguage(chunkToCheck.text);
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        let wavBlob: Blob;

        if (lang === 'pl') {
             wavBlob = await generateSpeechPiper(chunkToCheck.text, 'pl');
        } else if (isMobile) {
             // Piper is lighter and safer on mobile for now
             wavBlob = await generateSpeechPiper(chunkToCheck.text, 'en');
        } else {
             // Use Kokoro on desktop for English (better quality)
             wavBlob = await generateSpeechKokoro(chunkToCheck.text, selectedVoice);
        }

        const audioUrl = URL.createObjectURL(wavBlob);
        console.log(`[Reader] Chunk ${index} ready. Audio URL created.`);

        setChunks(prev => prev.map((c, i) => i === index ? { ...c, status: 'ready', audioUrl } : c));
    } catch (err: any) {
        console.error(`Error buffering chunk ${index}`, err);
        setError(`TTS Error: ${err.message || 'Unknown error'}. Switching to system fallback.`);
        setIsUsingSystemTTS(true);
        // Mark as ready so the reader can at least use system TTS for it
        setChunks(prev => prev.map((c, i) => i >= index ? { ...c, status: 'ready' } : c));
    } finally {
        if (index === currentChunkIndex) setIsApiLoading(false);
    }

  }, [chunks, selectedVoice, currentChunkIndex, isUsingSystemTTS]);

  useEffect(() => {
    if (!currentBook || chunks.length === 0) return;

    const BUFFER_BACK = 2;
    const BUFFER_FORWARD = 5;

    const startIndex = Math.max(0, currentChunkIndex - BUFFER_BACK);
    const endIndex = Math.min(chunks.length, currentChunkIndex + BUFFER_FORWARD);

    for (let i = currentChunkIndex; i < endIndex; i++) {
        const chunk = chunks[i];
        if (chunk && chunk.status === 'pending' && !chunk.audioUrl) {
            bufferChunk(i);
        }
    }
    for (let i = currentChunkIndex - 1; i >= startIndex; i--) {
        const chunk = chunks[i];
        if (chunk && chunk.status === 'pending' && !chunk.audioUrl) {
            bufferChunk(i);
        }
    }

  }, [currentChunkIndex, chunks, selectedVoice, isUsingSystemTTS, bufferChunk]);

  const playCurrentChunk = useCallback(async () => {
    const chunk = chunks[currentChunkIndex];
    if (!chunk) return;

    // --- SYSTEM TTS PLAYBACK ---
    if (isUsingSystemTTS || !chunk.audioUrl) {
        if (!isUsingSystemTTS && !chunk.audioUrl) {
            console.warn(`[Audio] Chunk ${currentChunkIndex} has no audioUrl, falling back to System TTS.`);
        }
        
        window.speechSynthesis.cancel();

        // Small delay after cancel to ensure the browser is ready for new speech
        await new Promise(resolve => setTimeout(resolve, 60));

        const utterance = new SpeechSynthesisUtterance(chunk.text);
        utterance.rate = playbackSpeed;
        
        const voices = window.speechSynthesis.getVoices();
        const lang = detectLanguage(chunk.text);
        const prefix = lang === 'pl' ? 'pl' : 'en';
        
        let voice = voices.find(v => v.lang.startsWith(prefix) && (v.name.includes("Google") || v.name.includes("Siri") || v.name.includes("Premium") || v.name.includes("Enhanced") || v.name.includes("Natural")));
        if (!voice) voice = voices.find(v => v.lang.startsWith(prefix));
        
        if (voice) utterance.voice = voice;

        utterance.onstart = () => {
            console.log(`[SystemTTS] Started chunk ${currentChunkIndex}`);
            setChunks(prev => prev.map((c, i) => i === currentChunkIndex ? { ...c, status: 'playing' } : c));
        };

        utterance.onend = () => {
            console.log(`[SystemTTS] Finished chunk ${currentChunkIndex}`);
            if (isPlayingRef.current) {
                // Use setTimeout to avoid potential stack overflow or race conditions
                setTimeout(() => nextChunkRef.current(), 10);
            }
        };

        utterance.onerror = (e) => {
            console.error("[SystemTTS] Error:", e);
            if (e.error !== 'interrupted' && isPlayingRef.current) {
                 setTimeout(() => nextChunkRef.current(), 100);
            }
        };

        utteranceRef.current = utterance;
        window.speechSynthesis.speak(utterance);
        
        setReaderState(ReaderState.PLAYING);
        setIsPlayingRef(true);
        return;
    }

    // --- KOKORO/AUDIO FILE PLAYBACK ---
    initAudio();
    const audio = audioRef.current!;

    if (audio.src !== chunk.audioUrl) {
        console.log(`[Audio] Setting new src for chunk ${currentChunkIndex}`);
        audio.src = chunk.audioUrl;
        audio.load();
    }
    
    audio.playbackRate = playbackSpeed;
    
    try {
        console.log(`[Audio] Attempting to play chunk ${currentChunkIndex}:`, chunk.audioUrl);
        
        // Use a small delay to ensure the browser has processed the new src
        await new Promise(resolve => setTimeout(resolve, 50));

        const playPromise = audio.play();
        
        // Add a safety timeout for play() to prevent hanging UI
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Audio play timeout")), 8000)
        );

        await Promise.race([playPromise, timeoutPromise]);
        
        console.log(`[Audio] Playback started for chunk ${currentChunkIndex}`);
        setReaderState(ReaderState.PLAYING);
        setIsPlayingRef(true);
        setChunks(prev => prev.map((c, i) => i === currentChunkIndex ? { ...c, status: 'playing' } : c));
    } catch (e: any) {
        console.warn("[Audio] Playback failed or blocked:", e);
        console.warn("[Audio] Switching to System TTS fallback for this chunk.");
        
        // Fallback to System TTS for this chunk if audio fails
        setIsUsingSystemTTS(true);
        
        // Try to trigger system TTS immediately
        const fallbackUtterance = new SpeechSynthesisUtterance(chunk.text);
        fallbackUtterance.rate = playbackSpeed;
        fallbackUtterance.onend = () => {
            if (isPlayingRef.current) nextChunkRef.current();
        };
        window.speechSynthesis.speak(fallbackUtterance);
    }
  }, [chunks, currentChunkIndex, playbackSpeed, isUsingSystemTTS]);

  useEffect(() => {
    const chunk = chunks[currentChunkIndex];
    // For system TTS, we can start even if status is pending, because it doesn't need to generate a blob first
    const isReady = isUsingSystemTTS ? (chunk?.status === 'ready' || chunk?.status === 'pending') : (chunk?.status === 'ready');
    
    if (readerState === ReaderState.PLAYING && isReady) {
       playCurrentChunk();
    }
  }, [chunks, currentChunkIndex, readerState, playCurrentChunk, isUsingSystemTTS]);

  const togglePlay = () => {
    initAudio();
    
    // Prime the audio element to allow async play() calls later (needed for Safari/iOS)
    if (audioRef.current && readerState !== ReaderState.PLAYING) {
        audioRef.current.play().then(() => {
            audioRef.current?.pause();
        }).catch(() => {
            // This might fail if src is not set, which is fine
        });
    }

    if (readerState === ReaderState.PLAYING) {
       if (isUsingSystemTTS) {
           window.speechSynthesis.cancel();
       } else {
           if (audioRef.current) audioRef.current.pause();
       }
       setIsPlayingRef(false);
       setReaderState(ReaderState.PAUSED);
       saveProgressToCloud(); 
    } else {
       setIsPlayingRef(true);
       setReaderState(ReaderState.PLAYING);
       
       if (isUsingSystemTTS) {
           playCurrentChunk();
       } else {
           if (chunks[currentChunkIndex]?.status === 'ready') {
               playCurrentChunk();
           } else if (chunks[currentChunkIndex]?.status === 'pending') {
               bufferChunk(currentChunkIndex);
           }
       }
    }
  };

  // --- EVENT HANDLERS ---

  const handleLogin = (user: UserProfile) => {
    performLogin(user, false);
  };

  const handleAddUser = (name: string) => {
    const newUser: UserProfile = {
      id: Date.now().toString(),
      name,
      avatarColor: 'bg-indigo-500',
      playbackSpeed: 1.0, 
      selectedVoice: 'Kore',
      isDarkMode: true
    };
    setUsers([...users, newUser]);
    saveUser(newUser);
  };

  const connectGoogle = () => {
     handleGoogleLogin();
  };

  const handleInstallClick = () => {
    if (installPrompt) {
      installPrompt.prompt();
      installPrompt.userChoice.then((choiceResult: any) => {
        setInstallPrompt(null);
      });
    }
  };

  const handleUrlInputSubmit = async () => {
    await importContentFromUrl(urlInput);
    setUrlInput('');
  };

  // --- RENDER ---

  if (!currentUser) {
    return (
      <LoginScreen 
        availableUsers={users}
        onLogin={handleLogin}
        onAddUser={handleAddUser}
        onUpdateSettings={(s) => setConfig(s)}
      />
    );
  }

  return (
    <div className="min-h-screen transition-colors duration-300 pb-20 font-sans">
      <header className="border-b border-gray-200 dark:border-white/10 bg-surface-light/80 dark:bg-surface-dark/80 backdrop-blur-md sticky top-0 z-50 transition-colors duration-300">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg">
              <BookOpen size={18} className="text-white" />
            </div>
            
            <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full ${currentUser.avatarColor} flex items-center justify-center text-white text-xs font-bold`}>
                    {currentUser.name[0]}
                </div>
                <div className="flex flex-col">
                    <span className="text-xs font-semibold text-gray-500 uppercase">Reading as</span>
                    <span className="text-sm font-bold text-gray-900 dark:text-white">{currentUser.name}</span>
                </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
             {installPrompt && (
               <button 
                 onClick={handleInstallClick}
                 className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-all text-xs font-medium animate-pulse"
               >
                 <Download size={14} /> Install
               </button>
             )}

             {isDriveConnected ? (
                <button 
                  onClick={() => currentUser && triggerSync(currentUser.id)}
                  className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border transition-all ${isSyncing ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' : 'bg-green-500/10 text-green-500 border-green-500/20 hover:bg-green-500/20'}`}
                >
                  <Cloud size={14} className={isSyncing ? 'animate-pulse' : ''} />
                  {isSyncing ? 'Syncing...' : 'Synced'}
                </button>
             ) : (
                config.googleClientId ? (
                  <button onClick={connectGoogle} className="flex items-center gap-2 px-3 py-1 rounded-full bg-gray-200 dark:bg-white/10 text-xs font-medium hover:bg-gray-300 dark:hover:bg-white/20 transition-colors">
                    <Cloud size={14} /> Drive
                  </button>
                ) : null
             )}

             <button 
                onClick={() => setShowLibrary(true)}
                className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-white/10 transition-colors text-gray-600 dark:text-gray-300"
                title="Library"
             >
                <BookOpen size={20} />
             </button>
             
             <button 
               onClick={() => { setCurrentUser(null); setCurrentBook(null); setIsDriveConnected(false); }}
               className="p-2 rounded-full hover:bg-red-100 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-colors"
               title="Logout"
             >
                <LogOut size={20} />
             </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-10 relative">
        {showLibrary && (
            <div className="absolute inset-0 z-40 bg-background-light dark:bg-background-dark/95 backdrop-blur-xl p-6 rounded-xl border border-gray-200 dark:border-white/10 shadow-2xl animate-fade-in min-h-[500px]">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold flex items-center gap-2"><BookOpen size={20}/> My Library</h2>
                    <button onClick={() => { setShowLibrary(false); setShowUrlInput(false); }}><X size={24} className="hover:text-primary"/></button>
                </div>
                
                {showUrlInput ? (
                  <div className="p-6 bg-surface-light dark:bg-surface-dark rounded-lg border border-gray-200 dark:border-white/5 animate-fade-in">
                      <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><LinkIcon size={18}/> Import from URL</h3>
                      <div className="flex gap-2">
                          <input 
                             type="url" 
                             className="flex-1 p-3 rounded-lg bg-background-light dark:bg-background-dark border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary"
                             placeholder="https://example.com/document.pdf or .txt"
                             value={urlInput}
                             onChange={e => setUrlInput(e.target.value)}
                             autoFocus
                          />
                          <button 
                             onClick={handleUrlInputSubmit}
                             className="px-6 py-3 bg-primary hover:bg-secondary text-white rounded-lg font-medium transition-colors"
                          >
                             Import
                          </button>
                      </div>
                      <p className="mt-3 text-xs text-gray-500">
                         Note: The URL must be publicly accessible. If direct import fails, we will try a proxy.
                      </p>
                      <button onClick={() => setShowUrlInput(false)} className="mt-4 text-sm text-gray-500 hover:text-gray-900 dark:hover:text-white">Cancel</button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                     {myBooks.map(book => (
                        <div 
                          key={book.id} 
                          onClick={() => loadBook(book)}
                          className="p-4 rounded-lg bg-surface-light dark:bg-surface-dark border border-gray-200 dark:border-white/5 hover:border-primary cursor-pointer transition-all shadow-sm hover:shadow-md group"
                        >
                           <h3 className="font-bold text-gray-900 dark:text-white truncate group-hover:text-primary">{book.title}</h3>
                           <div className="flex justify-between mt-2 text-xs text-gray-500">
                              <span>{Math.round((book.currentChunkIndex / (book.totalChunks || 100)) * 100)}%</span>
                              <span>{new Date(book.lastRead).toLocaleDateString()}</span>
                           </div>
                        </div>
                     ))}
                     
                     <label className={`flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer transition-colors ${isProcessingFile ? 'opacity-50 pointer-events-none' : ''}`}>
                        {isProcessingFile ? (
                          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin mb-2"></div>
                        ) : (
                          <Upload className="mb-2 text-gray-400" />
                        )}
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                          {isProcessingFile ? 'Processing...' : 'Upload File (TXT, PDF)'}
                        </span>
                        <input type="file" className="hidden" accept=".txt,.pdf" onChange={handleFileUpload} disabled={isProcessingFile} />
                     </label>

                     <button 
                       onClick={() => setShowUrlInput(true)}
                       className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer transition-colors"
                       disabled={isProcessingFile}
                     >
                       <Globe className="mb-2 text-gray-400" />
                       <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                          Import from URL
                       </span>
                     </button>
                  </div>
                )}
            </div>
        )}

        {showChapters && (
            <div className="absolute top-20 right-6 z-30 w-64 bg-surface-light dark:bg-surface-dark rounded-xl shadow-2xl border border-gray-200 dark:border-white/10 overflow-hidden animate-fade-in">
                <div className="p-3 bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/10 flex justify-between items-center">
                    <h3 className="font-bold text-sm">Table of Contents</h3>
                    <button onClick={() => setShowChapters(false)}><X size={16} /></button>
                </div>
                <div className="max-h-80 overflow-y-auto">
                    {chapters.length === 0 ? (
                        <p className="p-4 text-sm text-gray-500">No chapters detected.</p>
                    ) : (
                        chapters.map((chapter, i) => (
                            <button
                                key={i}
                                onClick={() => jumpToChapter(chapter)}
                                className={`w-full text-left p-3 text-sm hover:bg-gray-100 dark:hover:bg-white/5 border-b border-gray-100 dark:border-white/5 last:border-0 ${chapter.pageIndex === currentPageIndex ? 'text-primary font-medium bg-primary/5' : 'text-gray-700 dark:text-gray-300'}`}
                            >
                                {chapter.title} <span className="text-xs text-gray-400 float-right">Pg {chapter.pageIndex + 1}</span>
                            </button>
                        ))
                    )}
                </div>
            </div>
        )}

        {!currentBook ? (
           <div className="text-center pt-20">
              <h2 className="text-2xl font-bold text-gray-400">No book selected</h2>
              <p className="text-gray-500 mt-2">Open your library to start reading.</p>
              {pendingAutoReadUrl ? (
                 <div className="mt-6 flex flex-col items-center animate-pulse">
                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                    <span className="text-gray-400 text-sm">Waiting for login to auto-read content...</span>
                 </div>
              ) : (
                <button 
                   onClick={() => setShowLibrary(true)} 
                   className="mt-6 px-6 py-2 bg-primary hover:bg-secondary text-white rounded-lg transition-colors"
                >
                   Open Library
                </button>
              )}
           </div>
        ) : (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="relative">
              <Visualizer isPlaying={readerState === ReaderState.PLAYING} isDarkMode={isDarkMode} />
              {isApiLoading && (
                 <div className="absolute top-2 right-2 flex items-center gap-2 px-3 py-1 bg-black/60 rounded-full backdrop-blur-md z-10">
                    <div className="w-2 h-2 rounded-full bg-primary animate-ping"></div>
                    <span className="text-xs font-medium text-white">Generating...</span>
                 </div>
              )}
            </div>

            <Controls 
              isPlaying={readerState === ReaderState.PLAYING}
              onPlayPause={togglePlay}
              playbackSpeed={playbackSpeed}
              onSpeedChange={setPlaybackSpeed}
              selectedVoice={selectedVoice}
              onVoiceChange={(v) => {
                 setSelectedVoice(v);
                 setChunks(prev => prev.map((c, i) => i >= currentChunkIndex ? { ...c, status: 'pending', audioUrl: undefined } : c));
              }}
              availableVoices={AVAILABLE_VOICES}
              isDarkMode={isDarkMode}
              toggleTheme={() => setIsDarkMode(!isDarkMode)}
              skipForward={() => nextChunk()}
              skipBackward={() => setCurrentChunkIndex(prev => Math.max(prev - 1, 0))}
              isUsingSystemTTS={isUsingSystemTTS}
              onToggleSystemTTS={() => setIsUsingSystemTTS(!isUsingSystemTTS)}
            />

            {error && (
              <div className="flex items-center gap-2 p-4 rounded-lg bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-500/50 text-red-700 dark:text-red-200 text-sm">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            <div className="flex items-center justify-between bg-surface-light dark:bg-surface-dark p-3 rounded-t-xl border-x border-t border-gray-200 dark:border-white/10">
               <div className="flex items-center gap-2">
                   <button 
                      onClick={() => setShowChapters(!showChapters)} 
                      className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg text-gray-600 dark:text-gray-300 flex items-center gap-2 text-sm font-medium"
                   >
                       <List size={18}/> Chapters
                   </button>
               </div>
               
               <div className="flex items-center gap-2">
                  <button onClick={() => changePage(-5)} className="p-1 text-gray-400 hover:text-primary" title="-5 Pages"><ChevronsLeft size={20}/></button>
                  <button onClick={() => changePage(-1)} className="p-1 text-gray-400 hover:text-primary" title="-1 Page"><ChevronLeft size={20}/></button>
                  <span className="text-sm font-mono text-gray-600 dark:text-gray-300 w-24 text-center">
                      Page {currentPageIndex + 1} / {pages.length}
                  </span>
                  <button onClick={() => changePage(1)} className="p-1 text-gray-400 hover:text-primary" title="+1 Page"><ChevronRight size={20}/></button>
                  <button onClick={() => changePage(5)} className="p-1 text-gray-400 hover:text-primary" title="+5 Pages"><ChevronsRight size={20}/></button>
               </div>
            </div>

            <div className="min-h-[500px] bg-surface-light dark:bg-surface-dark/50 rounded-b-xl p-8 border border-gray-200 dark:border-white/5 shadow-inner transition-colors">
                {pages.length > 0 && pages[currentPageIndex] ? (
                    <div className="leading-relaxed text-lg text-gray-800 dark:text-gray-200 font-serif space-y-2 text-justify">
                        {pages[currentPageIndex].chunks.map((chunk, i) => {
                            const globalIndex = pages[currentPageIndex].startChunkIndex + i;
                            const isActive = globalIndex === currentChunkIndex;
                            const isCached = chunk.status === 'ready';
                            const isError = chunk.status === 'error';
                            return (
                                <span 
                                    key={chunk.id}
                                    onClick={() => {
                                        if (isError) {
                                            setChunks(prev => prev.map(c => c.id === chunk.id ? { ...c, status: 'pending' } : c));
                                            return;
                                        }
                                        if (globalIndex !== currentChunkIndex) {
                                            if (isUsingSystemTTS) {
                                                window.speechSynthesis.cancel();
                                            } else {
                                                if (audioRef.current) audioRef.current.pause();
                                            }
                                            setIsPlayingRef(false);
                                            setReaderState(ReaderState.IDLE);
                                            setCurrentChunkIndex(globalIndex);
                                        }
                                    }}
                                    className={`
                                        cursor-pointer transition-colors duration-200 py-0.5 px-0.5 rounded
                                        ${isActive 
                                            ? 'bg-yellow-200/50 dark:bg-yellow-500/30 text-gray-900 dark:text-white font-medium' 
                                            : 'hover:bg-gray-100 dark:hover:bg-white/5'}
                                        ${!isActive && isCached ? 'underline decoration-green-500/20 decoration-2' : ''}
                                        ${isError ? 'underline decoration-red-500 decoration-wavy text-red-700 dark:text-red-400' : ''}
                                    `}
                                    title={isCached ? "Audio buffered" : isError ? "Error generating audio. Click to retry." : "Click to read"}
                                >
                                    {chunk.text + " "}
                                </span>
                            );
                        })}
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-full text-gray-400">Empty Page</div>
                )}
            </div>

            <div className="text-center text-xs text-gray-400">
                {currentBook.title}
            </div>

          </div>
        )}
      </main>
    </div>
  );
}