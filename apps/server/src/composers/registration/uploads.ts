import 'server-only';
import type { UploadedFile } from '../../registration/RegistrationService';

/*
 * Reads the files in a form post. An empty file input posts a zero-byte file, which is not an upload, so it is skipped here. Every
 * other file is read in full and checked by the service (type by its bytes, size, name), never trusted as posted.
 */

async function readOne(file: File): Promise<UploadedFile> {
  return { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) };
}

/** The files posted under one name, such as `attachments`. */
export async function filesNamed(form: FormData, name: string): Promise<UploadedFile[]> {
  const files: UploadedFile[] = [];
  for (const entry of form.getAll(name)) {
    if (entry instanceof File && entry.size > 0) {
      files.push(await readOne(entry));
    }
  }

  return files;
}

/** The files a family posted for document questions: `custom.<key>` entries that are files, keyed by the question's key. */
export async function documentFilesOf(form: FormData): Promise<Record<string, UploadedFile>> {
  const documents: Record<string, UploadedFile> = {};
  for (const [name, entry] of form.entries()) {
    if (name.startsWith('custom.') && entry instanceof File && entry.size > 0) {
      documents[name.slice('custom.'.length)] = await readOne(entry);
    }
  }

  return documents;
}
