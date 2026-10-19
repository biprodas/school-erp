import { MIME, type AllowedMime } from './file-type';

export interface FilePurpose {
  /** Folder under `orgs/<orgId>/` in the bucket. */
  folder: string;
  mimes: readonly AllowedMime[];
  maxBytes: number;
}

const MB = 1024 * 1024;
const IMAGES = [MIME.png, MIME.jpeg, MIME.webp] as const;

/**
 * What can be stored, per use. Uploads are checked against their purpose:
 * the sniffed type must be listed and the size within `maxBytes` (and within
 * `UPLOAD_MAX_BYTES`). `generated` is for files the server creates
 * (exports, PDFs) and is never accepted from clients.
 */
export const FILE_PURPOSES = {
  student_photo: { folder: 'photos', mimes: IMAGES, maxBytes: 2 * MB },
  employee_photo: { folder: 'photos', mimes: IMAGES, maxBytes: 2 * MB },
  student_document: {
    folder: 'documents',
    mimes: [...IMAGES, MIME.pdf],
    maxBytes: 10 * MB,
  },
  org_logo: { folder: 'branding', mimes: IMAGES, maxBytes: 2 * MB },
  signature: { folder: 'branding', mimes: IMAGES, maxBytes: 1 * MB },
  attachment: {
    folder: 'attachments',
    mimes: [...IMAGES, MIME.pdf],
    maxBytes: 10 * MB,
  },
  import: {
    folder: 'imports',
    mimes: [MIME.xlsx, MIME.csv],
    maxBytes: 10 * MB,
  },
  generated: {
    folder: 'generated',
    mimes: [MIME.pdf, MIME.xlsx, MIME.csv, MIME.zip],
    maxBytes: 200 * MB,
  },
} as const satisfies Record<string, FilePurpose>;

export type FilePurposeName = keyof typeof FILE_PURPOSES;
export type UploadPurposeName = Exclude<FilePurposeName, 'generated'>;
