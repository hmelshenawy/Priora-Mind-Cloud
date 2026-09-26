'use client';

import {type FormEvent, useEffect, useRef, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {useRouter} from 'next/navigation';
import {clearAuthState, getAuthState} from '@/lib/auth-state';
import {
  DocumentsApiError,
  listDocuments,
  type DocumentRecord,
  uploadDocument,
} from '@/lib/api/documents';
import {clearSelectedMindSpaceId} from '@/lib/mindspace-selection';

type ListStatus = 'idle' | 'loading' | 'empty' | 'success' | 'error';

function isDisplayableDocument(value: unknown): value is DocumentRecord {
  if (!value || typeof value !== 'object') return false;
  const document = value as Record<string, unknown>;
  return (
    typeof document.id === 'string' &&
    typeof document.mindSpaceId === 'string' &&
    typeof document.fileName === 'string' &&
    typeof document.status === 'string'
  );
}

export function Documents({mindSpaceId}: {mindSpaceId: string}) {
  const t = useTranslations('documents');
  const locale = useLocale();
  const router = useRouter();
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [listStatus, setListStatus] = useState<ListStatus>('idle');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [uploadSucceeded, setUploadSucceeded] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mindSpaceRef = useRef(mindSpaceId);
  const listRequest = useRef(0);
  const uploadRequest = useRef(0);

  function redirectToLogin() {
    clearAuthState();
    clearSelectedMindSpaceId();
    router.replace(`/${locale}/login`);
  }

  useEffect(() => {
    const requestId = ++listRequest.current;
    mindSpaceRef.current = mindSpaceId;
    uploadRequest.current += 1;
    setDocuments([]);
    setListStatus('loading');
    setSelectedFile(null);
    setValidationError('');
    setUploadError('');
    setUploadSucceeded(false);
    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';

    const cleanup = () => {
      listRequest.current += 1;
      uploadRequest.current += 1;
    };
    const token = getAuthState()?.accessToken;
    if (!token) {
      redirectToLogin();
      return cleanup;
    }

    listDocuments(token, mindSpaceId)
      .then((result) => {
        if (requestId !== listRequest.current || mindSpaceRef.current !== mindSpaceId) return;
        setDocuments((current) => {
          const resultIds = new Set(result.map(({id}) => id));
          return [...current.filter(({id}) => !resultIds.has(id)), ...result];
        });
        setListStatus((current) => current === 'success' || result.length > 0 ? 'success' : 'empty');
      })
      .catch((error: unknown) => {
        if (requestId !== listRequest.current || mindSpaceRef.current !== mindSpaceId) return;
        if (error instanceof DocumentsApiError && error.code === 'unauthorized') {
          redirectToLogin();
          return;
        }
        setListStatus((current) => current === 'success' ? current : 'error');
      });

    return cleanup;
  }, [mindSpaceId, locale, router]);

  function documentStatus(status: string) {
    if (status === 'PROCESSING') return t('statusProcessing');
    if (status === 'READY') return t('statusReady');
    if (status === 'FAILED') return t('statusFailed');
    return status;
  }

  function handleFileChange(file: File | null) {
    setSelectedFile(file);
    setValidationError('');
    setUploadError('');
    setUploadSucceeded(false);
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isUploading) return;

    if (!selectedFile) {
      setValidationError(t('missingFileValidation'));
      return;
    }
    const hasPdfName = selectedFile.name.toLowerCase().endsWith('.pdf');
    const hasPdfType = !selectedFile.type || selectedFile.type.toLowerCase() === 'application/pdf';
    if (!hasPdfName || !hasPdfType) {
      setValidationError(t('invalidPdfValidation'));
      return;
    }

    const requestId = ++uploadRequest.current;
    const expectedMindSpace = mindSpaceRef.current;
    const token = getAuthState()?.accessToken;
    if (!token) {
      if (requestId === uploadRequest.current && mindSpaceRef.current === expectedMindSpace) {
        redirectToLogin();
      }
      return;
    }

    setValidationError('');
    setUploadError('');
    setUploadSucceeded(false);
    setIsUploading(true);

    try {
      const response = await uploadDocument(token, expectedMindSpace, selectedFile);
      if (requestId !== uploadRequest.current || mindSpaceRef.current !== expectedMindSpace) return;

      const metadata: unknown = response.documentMetaData;
      if (isDisplayableDocument(metadata) && metadata.mindSpaceId === expectedMindSpace) {
        setDocuments((current) => [metadata, ...current.filter(({id}) => id !== metadata.id)]);
        setListStatus('success');
      }
      setUploadSucceeded(true);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error) {
      if (requestId !== uploadRequest.current || mindSpaceRef.current !== expectedMindSpace) return;
      if (error instanceof DocumentsApiError && error.code === 'unauthorized') {
        redirectToLogin();
      } else {
        setUploadError(t('uploadError'));
      }
    } finally {
      if (requestId === uploadRequest.current && mindSpaceRef.current === expectedMindSpace) {
        setIsUploading(false);
      }
    }
  }

  return (
    <section className="documents" aria-labelledby="documents-title">
      <div className="documents-heading">
        <h2 id="documents-title">{t('title')}</h2>
        <p>{t('description')}</p>
      </div>

      <form className="document-upload" onSubmit={handleUpload} noValidate>
        <h3>{t('uploadTitle')}</h3>
        <label htmlFor="document-file">{t('fileLabel')}</label>
        <input
          ref={fileInputRef}
          id="document-file"
          type="file"
          accept=".pdf,application/pdf"
          disabled={isUploading}
          aria-invalid={Boolean(validationError)}
          aria-describedby={validationError ? 'document-file-hint document-file-error' : 'document-file-hint'}
          onChange={(event) => handleFileChange(event.target.files?.[0] ?? null)}
        />
        <p id="document-file-hint" className="document-hint">{t('fileHint')}</p>
        {validationError ? <p id="document-file-error" className="documents-error" role="alert">{validationError}</p> : null}
        {uploadError ? <p className="documents-error" role="alert">{uploadError}</p> : null}
        <div className="document-upload-status" aria-live="polite">
          {isUploading ? <p>{t('uploading')}</p> : null}
          {uploadSucceeded ? <p className="documents-success">{t('uploadSuccess')}</p> : null}
        </div>
        <button type="submit" disabled={isUploading}>
          {isUploading ? t('uploading') : t('upload')}
        </button>
      </form>

      <div className="documents-list-panel">
        <h3>{t('listTitle')}</h3>
        <div className="documents-list-status" aria-live="polite">
          {listStatus === 'loading' ? <p>{t('listLoading')}</p> : null}
          {listStatus === 'empty' ? <p>{t('listEmpty')}</p> : null}
          {listStatus === 'success' ? <p>{t('listLoaded')}</p> : null}
        </div>
        {listStatus === 'error' ? <p className="documents-error" role="alert">{t('listError')}</p> : null}
        {listStatus === 'success' ? (
          <ul className="documents-list">
            {documents.map((document) => (
              <li key={document.id}>
                <p><strong>{t('fileNameLabel')}:</strong> <span>{document.fileName}</span></p>
                <p><strong>{t('statusLabel')}:</strong> <span>{documentStatus(document.status)}</span></p>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
