'use client';

import {FormEvent, useEffect, useRef, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {useRouter} from 'next/navigation';
import {
  ConversationApiError,
  createConversation,
  listConversations,
  listMessages,
  sendMessage,
  type Conversation,
  type Message,
} from '@/lib/api/conversations';
import {clearAuthState, getAuthState} from '@/lib/auth-state';
import {clearSelectedMindSpaceId} from '@/lib/mindspace-selection';

type ListStatus = 'loading' | 'empty' | 'success' | 'error';
type MessageStatus = 'idle' | 'loading' | 'empty' | 'success' | 'error';

export function Chat({mindSpaceId}: {mindSpaceId: string}) {
  const t = useTranslations('chat');
  const locale = useLocale();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [listStatus, setListStatus] = useState<ListStatus>('loading');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageStatus, setMessageStatus] = useState<MessageStatus>('idle');
  const [title, setTitle] = useState('');
  const [titleError, setTitleError] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [content, setContent] = useState('');
  const [sendError, setSendError] = useState('');
  const [isSending, setIsSending] = useState(false);
  const mindSpaceRef = useRef(mindSpaceId);
  const activeRef = useRef<string | null>(null);
  const listRequest = useRef(0);
  const messageRequest = useRef(0);
  const createRequest = useRef(0);
  const sendRequest = useRef(0);

  function redirectToLogin() {
    clearAuthState();
    clearSelectedMindSpaceId();
    router.replace(`/${locale}/login`);
  }

  function resetActiveConversation() {
    activeRef.current = null;
    setActiveId(null);
    setMessages([]);
    setMessageStatus('idle');
    setContent('');
    setSendError('');
  }

  useEffect(() => {
    const requestId = ++listRequest.current;
    mindSpaceRef.current = mindSpaceId;
    messageRequest.current += 1;
    createRequest.current += 1;
    sendRequest.current += 1;
    setConversations([]);
    setListStatus('loading');
    setTitle('');
    setTitleError('');
    setIsCreating(false);
    setIsSending(false);
    resetActiveConversation();

    const token = getAuthState()?.accessToken;
    if (!token) {
      redirectToLogin();
      return;
    }

    listConversations(token, mindSpaceId)
      .then((result) => {
        if (requestId !== listRequest.current || mindSpaceRef.current !== mindSpaceId) return;
        setConversations(result);
        setListStatus(result.length === 0 ? 'empty' : 'success');
      })
      .catch((error: unknown) => {
        if (requestId !== listRequest.current || mindSpaceRef.current !== mindSpaceId) return;
        if (error instanceof ConversationApiError && error.code === 'unauthorized') {
          redirectToLogin();
          return;
        }
        setListStatus('error');
      });
  }, [mindSpaceId, locale, router]);

  async function openConversation(conversationId: string) {
    const requestId = ++messageRequest.current;
    sendRequest.current += 1;
    const expectedMindSpace = mindSpaceRef.current;
    activeRef.current = conversationId;
    setActiveId(conversationId);
    setMessages([]);
    setMessageStatus('loading');
    setContent('');
    setSendError('');
    setIsSending(false);

    const token = getAuthState()?.accessToken;
    if (!token) return redirectToLogin();

    try {
      const result = await listMessages(token, conversationId);
      if (
        requestId !== messageRequest.current ||
        mindSpaceRef.current !== expectedMindSpace ||
        activeRef.current !== conversationId
      ) return;
      setMessages(result);
      setMessageStatus(result.length === 0 ? 'empty' : 'success');
    } catch (error) {
      if (requestId !== messageRequest.current || activeRef.current !== conversationId) return;
      if (error instanceof ConversationApiError && error.code === 'unauthorized') {
        redirectToLogin();
      } else if (error instanceof ConversationApiError && error.code === 'notFound') {
        resetActiveConversation();
      } else {
        setMessageStatus('error');
      }
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isCreating) return;
    const trimmedTitle = title.trim();
    if (trimmedTitle.length < 3) return setTitleError(t('titleValidation'));

    const requestId = ++createRequest.current;
    const expectedMindSpace = mindSpaceRef.current;
    const token = getAuthState()?.accessToken;
    if (!token) return redirectToLogin();
    setTitleError('');
    setIsCreating(true);

    try {
      const created = await createConversation(token, {
        title: trimmedTitle,
        mindSpaceId: expectedMindSpace,
      });
      if (requestId !== createRequest.current || mindSpaceRef.current !== expectedMindSpace) return;
      setConversations((current) => [created, ...current]);
      setListStatus('success');
      messageRequest.current += 1;
      sendRequest.current += 1;
      activeRef.current = created.id;
      setActiveId(created.id);
      setMessages([]);
      setMessageStatus('empty');
      setTitle('');
      setContent('');
      setIsSending(false);
    } catch (error) {
      if (requestId !== createRequest.current || mindSpaceRef.current !== expectedMindSpace) return;
      if (error instanceof ConversationApiError && error.code === 'unauthorized') {
        redirectToLogin();
      } else {
        setTitleError(t('createError'));
      }
    } finally {
      if (requestId === createRequest.current) setIsCreating(false);
    }
  }

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSending || !activeId) return;
    const trimmedContent = content.trim();
    if (!trimmedContent) return setSendError(t('messageValidation'));

    const requestId = ++sendRequest.current;
    const expectedMindSpace = mindSpaceRef.current;
    const expectedConversation = activeId;
    const token = getAuthState()?.accessToken;
    if (!token) return redirectToLogin();
    setSendError('');
    setIsSending(true);
    let sent = false;

    try {
      await sendMessage(token, expectedConversation, {content: trimmedContent});
      sent = true;
      if (
        requestId !== sendRequest.current ||
        mindSpaceRef.current !== expectedMindSpace ||
        activeRef.current !== expectedConversation
      ) return;
      setContent('');
      setMessageStatus('loading');
      const refreshed = await listMessages(token, expectedConversation);
      if (
        requestId !== sendRequest.current ||
        mindSpaceRef.current !== expectedMindSpace ||
        activeRef.current !== expectedConversation
      ) return;
      setMessages(refreshed);
      setMessageStatus(refreshed.length === 0 ? 'empty' : 'success');
    } catch (error) {
      if (requestId !== sendRequest.current || activeRef.current !== expectedConversation) return;
      if (error instanceof ConversationApiError && error.code === 'unauthorized') {
        redirectToLogin();
      } else if (error instanceof ConversationApiError && error.code === 'notFound') {
        resetActiveConversation();
      } else if (sent) {
        setMessageStatus('error');
      } else {
        setSendError(t('sendError'));
      }
    } finally {
      if (requestId === sendRequest.current) setIsSending(false);
    }
  }

  return (
    <section className="chat" aria-labelledby="chat-title">
      <aside className="conversation-pane">
        <h2 id="chat-title">{t('conversationsTitle')}</h2>
        <form className="conversation-form" onSubmit={handleCreate} noValidate>
          <label htmlFor="conversation-title">{t('newConversationLabel')}</label>
          <div className="inline-form">
            <input id="conversation-title" value={title} placeholder={t('newConversationPlaceholder')} onChange={(event) => setTitle(event.target.value)} aria-invalid={Boolean(titleError)} />
            <button type="submit" disabled={isCreating}>{isCreating ? t('creatingConversation') : t('createConversation')}</button>
          </div>
          {titleError ? <p className="chat-error" role="alert">{titleError}</p> : null}
        </form>
        {listStatus === 'loading' ? <p aria-live="polite">{t('conversationsLoading')}</p> : null}
        {listStatus === 'empty' ? <p>{t('conversationsEmpty')}</p> : null}
        {listStatus === 'error' ? <p className="chat-error" role="alert">{t('conversationsError')}</p> : null}
        {listStatus === 'success' ? (
          <ul className="conversation-list">
            {conversations.map((conversation) => (
              <li key={conversation.id}>
                <button className={activeId === conversation.id ? 'active' : ''} type="button" onClick={() => openConversation(conversation.id)}>{conversation.title}</button>
              </li>
            ))}
          </ul>
        ) : null}
      </aside>

      <div className="message-pane">
        <h2>{activeId ? conversations.find(({id}) => id === activeId)?.title : t('title')}</h2>
        {messageStatus === 'idle' ? <p>{t('selectConversation')}</p> : null}
        {messageStatus === 'loading' ? <p aria-live="polite">{t('messagesLoading')}</p> : null}
        {messageStatus === 'empty' ? <p>{t('messagesEmpty')}</p> : null}
        {messageStatus === 'error' ? <p className="chat-error" role="alert">{t('messagesError')}</p> : null}
        {messageStatus === 'success' ? (
          <ol className="message-list">
            {messages.map((message) => (
              <li className={message.role === 'USER' ? 'user-message' : 'assistant-message'} key={message.id}>
                <strong>{message.role === 'USER' ? t('userRole') : t('assistantRole')}</strong>
                <p>{message.content}</p>
              </li>
            ))}
          </ol>
        ) : null}
        <form className="composer" onSubmit={handleSend} noValidate>
          <label htmlFor="message-content">{t('composerLabel')}</label>
          <textarea id="message-content" value={content} placeholder={t('composerPlaceholder')} disabled={!activeId || isSending} onChange={(event) => setContent(event.target.value)} aria-invalid={Boolean(sendError)} />
          {sendError ? <p className="chat-error" role="alert">{sendError}</p> : null}
          <button type="submit" disabled={!activeId || isSending}>{isSending ? t('sending') : t('send')}</button>
        </form>
      </div>
    </section>
  );
}
