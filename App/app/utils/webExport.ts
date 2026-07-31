// app/utils/webExport.ts
//
// Helper condivisi per export/import/stampa file, con un ramo diverso per il
// web (dove non esistono file-system/condivisione nativi: expo-file-system e
// expo-sharing non funzionano) rispetto a nativo (comportamento invariato,
// stesso codice di prima). Usato da rosterFile.ts, calendarFile.ts,
// statistiche.tsx e convocazione.tsx.
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Alert, Platform } from 'react-native';

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const dataUrl = reader.result as string;
      resolve(dataUrl.slice(dataUrl.indexOf(',') + 1));
    };
    reader.readAsDataURL(blob);
  });
}

function downloadBlobOnWeb(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

type SaveFileOptions = {
  content: string;
  encoding: 'base64' | 'utf8';
  filename: string;
  mimeType: string;
  dialogTitle?: string;
};

/** Salva/condivide un file: su nativo scrive in cache e apre lo share sheet (comportamento invariato), su web lo scarica col download del browser. */
export async function saveOrShareFile(opts: SaveFileOptions): Promise<void> {
  if (Platform.OS === 'web') {
    const blob =
      opts.encoding === 'base64' ? base64ToBlob(opts.content, opts.mimeType) : new Blob([opts.content], { type: opts.mimeType });
    downloadBlobOnWeb(blob, opts.filename);
    return;
  }
  const fileUri = FileSystem.cacheDirectory + opts.filename;
  await FileSystem.writeAsStringAsync(fileUri, opts.content, {
    encoding: opts.encoding === 'base64' ? FileSystem.EncodingType.Base64 : FileSystem.EncodingType.UTF8,
  });
  await Sharing.shareAsync(fileUri, { mimeType: opts.mimeType, dialogTitle: opts.dialogTitle ?? opts.filename });
}

/** Apre il selettore file e ritorna il contenuto in base64 (null se l'utente annulla). */
export async function pickFileAsBase64(mimeTypes: string[]): Promise<string | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: mimeTypes, copyToCacheDirectory: true });
  if (res.canceled || !res.assets?.length) return null;
  const asset = res.assets[0];

  if (Platform.OS === 'web') {
    const file = (asset as any).file as Blob | undefined;
    const blob: Blob = file ?? (await fetch(asset.uri).then((r) => r.blob()));
    return blobToBase64(blob);
  }

  return FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
}

/** Genera un PDF da HTML: su web usa la stampa del browser (finestra + window.print), su nativo expo-print + expo-sharing come oggi. */
export async function printOrShareHtml(html: string): Promise<void> {
  if (Platform.OS === 'web') {
    const w = window.open('', '', 'width=1200,height=800');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.print();
    w.close();
    return;
  }
  const { uri } = await Print.printToFileAsync({ html });
  try {
    await Sharing.shareAsync(uri);
  } catch {
    Alert.alert('PDF creato', `File salvato in:\n${uri}`);
  }
}
