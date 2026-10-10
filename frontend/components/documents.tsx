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

export function Documents({mindSpaceId}: {mindSpaceId: string}) {
  const t = useTranslations('documents');
  const locale = useLocale();
  const router = useRouter();
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [listStatus, setListStatus] = useState<ListStatus>('idle');
  const [listError, setListError] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [uploadSucceeded, setUploadSucceeded] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mindSpaceRef = useRef(mindSpaceId);
  const refreshDocuments = useRef<(afterUpload?: boolean) => void>(() => {});
  const uploadRequest = useRef(0);

  function redirectToLogin() {
    clearAuthState();
    clearSelectedMindSpaceId();
    router.replace(`/${locale}/login`);
  }

  useEffect(() => {
    let disposed = false;
    let inFlight = false;
    let refreshQueued = false;
    let needsPolling = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    mindSpaceRef.current = mindSpaceId;
    uploadRequest.current += 1;
    setDocuments([]);
    setListStatus('loading');
    setListError(false);
    setSelectedFile(null);
    setValidationError('');
    setUploadError('');
    setUploadSucceeded(false);
    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';

    const token = getAuthState()?.accessToken;
    const isCurrent = () => !disposed && getAuthState()?.accessToken === token;

    async function refresh(afterUpload = false) {
      if (!isCurrent()) return;
      if (!token) {
        redirectToLogin();
        return;
      }
      clearTimeout(timer);
      // Keep retrying if the first list refresh after an accepted upload fails.
      if (afterUpload) needsPolling = true;
      if (inFlight) {
        if (afterUpload) refreshQueued = true;
        return;
      }
      inFlight = true;
      try {
        const result = await listDocuments(token, mindSpaceId, controller.signal);
        if (!isCurrent() || refreshQueued) return;
        needsPolling = result.some(({status}) => status === 'PENDING' || status === 'PROCESSING');
        setDocuments(result);
        setListStatus(result.length > 0 ? 'success' : 'empty');
        setListError(false);
      } catch (error) {
        if (!isCurrent() || refreshQueued) return;
        if (error instanceof DocumentsApiError && error.code === 'unauthorized') {
          needsPolling = false;
          redirectToLogin();
          return;
        }
        setListError(true);
        setListStatus((current) => current === 'loading' ? 'error' : current);
      } finally {
        inFlight = false;
        if (isCurrent()) {
          if (refreshQueued) {
            refreshQueued = false;
            void refresh();
          } else if (needsPolling) {
            timer = setTimeout(() => void refresh(), 3000);
          }
        }
      }
    }

    refreshDocuments.current = refresh;
    // Let an immediately cleaned-up effect (React Strict Mode) skip its request.
    void Promise.resolve().then(() => refresh());

    return () => {
      disposed = true;
      clearTimeout(timer);
      controller.abort();
      refreshDocuments.current = () => {};
      uploadRequest.current += 1;
    };
  }, [mindSpaceId, locale, router]);

  function documentStatus(status: string) {
    if (status === 'PENDING') return t('statusPending');
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
      await uploadDocument(token, expectedMindSpace, selectedFile);
      if (requestId !== uploadRequest.current || mindSpaceRef.current !== expectedMindSpace) return;

      setUploadSucceeded(true);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      refreshDocuments.current(true);
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
        {listError ? (
          <div>
            <p className="documents-error" role="alert">{t('listError')}</p>
            <button type="button" onClick={() => refreshDocuments.current()}>{t('retry')}</button>
          </div>
        ) : null}
        {listStatus === 'success' ? (
          <ul className="documents-list">
            {documents.map((document) => (
              <li key={document.id}>
                <p><strong>{t('fileNameLabel')}:</strong> <span>{document.fileName}</span></p>
                <p><strong>{t('statusLabel')}:</strong> <span className="document-status" data-status={document.status} aria-live="polite">{documentStatus(document.status)}</span></p>
                {document.status === 'FAILED' ? <p className="documents-error">{t('processingError')}</p> : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
