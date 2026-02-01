import { Book } from '../types';

declare global {
  interface Window {
    google: any;
    gapi: any;
  }
}

const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';

let tokenClient: any;
let gapiInited = false;
let gisInited = false;

// 1. Initialize GAPI (for making requests)
export const initGapiClient = (apiKey: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    window.gapi.load('client', async () => {
      try {
        await window.gapi.client.init({
          apiKey: apiKey,
          discoveryDocs: [DISCOVERY_DOC],
        });
        gapiInited = true;
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  });
};

// 2. Initialize GIS (for logging in)
export const initGisClient = (clientId: string, callback: (token: any) => void): void => {
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPES,
    callback: (tokenResponse: any) => {
      callback(tokenResponse);
    },
  });
  gisInited = true;
};

// 3. Trigger Login
export const handleGoogleLogin = (): void => {
  if (tokenClient) {
    // Prompt the user to select an account
    tokenClient.requestAccessToken({ prompt: 'consent' });
  } else {
    console.error("Google Client not initialized");
  }
};

// --- DRIVE OPERATIONS ---

const APP_FOLDER_NAME = 'LectorAI_Data';

// Find or Create the App Folder
const getAppFolderId = async (): Promise<string> => {
  const response = await window.gapi.client.drive.files.list({
    q: `mimeType='application/vnd.google-apps.folder' and name='${APP_FOLDER_NAME}' and trashed=false`,
    fields: 'files(id, name)',
  });

  if (response.result.files && response.result.files.length > 0) {
    return response.result.files[0].id;
  } else {
    // Create folder
    const createRes = await window.gapi.client.drive.files.create({
      resource: {
        name: APP_FOLDER_NAME,
        mimeType: 'application/vnd.google-apps.folder',
      },
      fields: 'id',
    });
    return createRes.result.id;
  }
};

// Save (Upload/Update) Book to Drive
export const saveBookToDrive = async (book: Book) => {
  if (!window.gapi?.client?.drive) return;

  try {
    const folderId = await getAppFolderId();
    const fileName = `${book.id}.json`;

    // Check if file exists
    const listRes = await window.gapi.client.drive.files.list({
      q: `name='${fileName}' and '${folderId}' in parents and trashed=false`,
      fields: 'files(id)',
    });

    const fileContent = JSON.stringify(book);
    const fileMetadata = {
      name: fileName,
      parents: [folderId],
      mimeType: 'application/json'
    };

    if (listRes.result.files && listRes.result.files.length > 0) {
      // Update existing
      const fileId = listRes.result.files[0].id;
      // Note: GAPI client update is complex with multipart. 
      // For simplicity in this demo, we delete and recreate or use a simple upload endpoint wrapper.
      // Standard upload method:
      await updateFileContent(fileId, fileContent);
    } else {
      // Create new
      await createFile(folderId, fileName, fileContent);
    }
  } catch (error) {
    console.error("Drive Save Error", error);
  }
};

// Helper for Create
const createFile = async (folderId: string, name: string, content: string) => {
   const boundary = '-------314159265358979323846';
   const delimiter = "\r\n--" + boundary + "\r\n";
   const close_delim = "\r\n--" + boundary + "--";

   const metadata = {
     name: name,
     mimeType: 'application/json',
     parents: [folderId]
   };

   const multipartRequestBody =
     delimiter +
     'Content-Type: application/json\r\n\r\n' +
     JSON.stringify(metadata) +
     delimiter +
     'Content-Type: application/json\r\n\r\n' +
     content +
     close_delim;

   await window.gapi.client.request({
     'path': '/upload/drive/v3/files',
     'method': 'POST',
     'params': {'uploadType': 'multipart'},
     'headers': {
       'Content-Type': 'multipart/related; boundary="' + boundary + '"'
     },
     'body': multipartRequestBody
   });
};

// Helper for Update
const updateFileContent = async (fileId: string, content: string) => {
    // Simple update (media only)
    await window.gapi.client.request({
        path: `/upload/drive/v3/files/${fileId}`,
        method: 'PATCH',
        params: { uploadType: 'media' },
        body: content
    });
};


// Sync Logic: Compare Local vs Drive
export const syncBooksWithDrive = async (localBooks: Book[]): Promise<Book[]> => {
  if (!window.gapi?.client?.drive) return localBooks;

  const folderId = await getAppFolderId();
  const listRes = await window.gapi.client.drive.files.list({
    q: `'${folderId}' in parents and trashed=false and mimeType='application/json'`,
    fields: 'files(id, name, modifiedTime)',
  });

  const driveFiles = listRes.result.files || [];
  const mergedBooks: Book[] = [...localBooks];

  for (const driveFile of driveFiles) {
    // Download content to check modified time inside JSON (or use drive metadata)
    const response = await window.gapi.client.drive.files.get({
      fileId: driveFile.id,
      alt: 'media',
    });
    
    const driveBook = response.result as Book;
    const localBookIndex = mergedBooks.findIndex(b => b.id === driveBook.id);

    if (localBookIndex === -1) {
      // New book from cloud
      mergedBooks.push(driveBook);
    } else {
      // Conflict resolution: Newest modified wins
      const localBook = mergedBooks[localBookIndex];
      if (driveBook.lastModified > localBook.lastModified) {
         mergedBooks[localBookIndex] = driveBook;
         console.log(`Sync: Updated ${localBook.title} from Cloud`);
      } else if (localBook.lastModified > driveBook.lastModified) {
         // Local is newer, push to cloud
         await saveBookToDrive(localBook);
         console.log(`Sync: Pushed ${localBook.title} to Cloud`);
      }
    }
  }

  // Check for books that are local but not in cloud -> push to cloud
  for (const localBook of localBooks) {
     const existsInDrive = driveFiles.some((f: any) => f.name === `${localBook.id}.json`);
     if (!existsInDrive) {
        await saveBookToDrive(localBook);
     }
  }

  return mergedBooks;
};