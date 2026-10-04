'use client';

import { FormEvent, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import {
  ConversationApiError,
  createConversation,
  listConversations,
  listMessages,
  sendMessage,
  type Conversation,
  type Message,
} from '@/lib/api/conversations';
import { clearAuthState, getAuthState } from '@/lib/auth-state';
import { clearSelectedMindSpaceId } from '@/lib/mindspace-selection';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

type ListStatus = 'loading' | 'empty' | 'success' | 'error';
type MessageStatus = 'idle' | 'loading' | 'empty' | 'success' | 'error';

export function Chat({ mindSpaceId }: { mindSpaceId: string }) {
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
  const [conversationSheetOpen, setConversationSheetOpen] = useState(false);
  const mindSpaceRef = useRef(mindSpaceId);
  const activeRef = useRef<string | null>(null);
  const listRequest = useRef(0);
  const messageRequest = useRef(0);
  const createRequest = useRef(0);
  const sendRequest = useRef(0);
  const messageScrollRef = useRef<HTMLDivElement>(null);
  const messageHeadingRef = useRef<HTMLHeadingElement>(null);
  const nearBottomRef = useRef(true);
  const pendingScroll = useRef<'bottom' | null>(null);

  function isNearBottom(element: HTMLElement | null) {
    if (!element) return true;
    return Math.max(0, element.scrollHeight - element.clientHeight - element.scrollTop) <= 80;
  }

  function scheduleBottomScroll() {
    pendingScroll.current = 'bottom';
  }

  function handleMessageScroll() {
    nearBottomRef.current = isNearBottom(messageScrollRef.current);
  }

  function focusMessageHeading() {
    requestAnimationFrame(() => messageHeadingRef.current?.focus());
  }

  useLayoutEffect(() => {
    if (pendingScroll.current !== 'bottom') return;
    const element = messageScrollRef.current;
    if (!element) return;
    element.scrollTop = element.scrollHeight;
    nearBottomRef.current = true;
    pendingScroll.current = null;
  }, [messages, messageStatus, activeId]);

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
    return () => {
      listRequest.current += 1;
      messageRequest.current += 1;
      createRequest.current += 1;
      sendRequest.current += 1;
      pendingScroll.current = null;
    };
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
    if (conversationSheetOpen) {
      setConversationSheetOpen(false);
      focusMessageHeading();
    }

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
      scheduleBottomScroll();
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
      scheduleBottomScroll();
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
    const nearAtSubmission = isNearBottom(messageScrollRef.current);
    const expectedMindSpace = mindSpaceRef.current;
    const expectedConversation = activeId;
    const token = getAuthState()?.accessToken;
    if (!token) return redirectToLogin();
    setSendError('');
    setIsSending(true);
    let sent = false;

    try {
      await sendMessage(token, expectedConversation, { content: trimmedContent });
      sent = true;
      if (
        requestId !== sendRequest.current ||
        mindSpaceRef.current !== expectedMindSpace ||
        activeRef.current !== expectedConversation
      ) return;
      setContent('');
      const refreshed = await listMessages(token, expectedConversation);
      if (
        requestId !== sendRequest.current ||
        mindSpaceRef.current !== expectedMindSpace ||
        activeRef.current !== expectedConversation
      ) return;
      const nearBeforeRefreshRender = isNearBottom(messageScrollRef.current);
      if (nearAtSubmission || nearBeforeRefreshRender) scheduleBottomScroll();
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

  function renderConversationControls(idPrefix: string) {
    const titleId = `${idPrefix}-conversation-title`;

    return (
      <>
        <form className="conversation-form" onSubmit={handleCreate} noValidate>
          <label htmlFor={titleId}>{t('newConversationLabel')}</label>
          <div className="inline-form">
            <input id={titleId} value={title} placeholder={t('newConversationPlaceholder')} onChange={(event) => setTitle(event.target.value)} aria-invalid={Boolean(titleError)} />
            <Button type="submit" disabled={isCreating}>{isCreating ? t('creatingConversation') : t('createConversation')}</Button>
          </div>
          {titleError ? <p className="chat-error" role="alert">{titleError}</p> : null}
        </form>
        <div className="min-h-0 overflow-y-auto overscroll-contain">
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
        </div>
      </>
    );
  }

  const conversationSheetSide = locale === 'ar' ? 'right' : 'left';

  return (
    <section className="chat h-full min-h-0 min-w-0 overflow-hidden" aria-labelledby="chat-title">
      <aside className="conversation-pane hidden min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden lg:grid">
        <h2 id="chat-title">{t('conversationsTitle')}</h2>
        {renderConversationControls('desktop')}
      </aside>

      <div className="message-pane grid min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
          <h2 ref={messageHeadingRef} tabIndex={-1}>{activeId ? conversations.find(({ id }) => id === activeId)?.title : t('title')}</h2>
          <Sheet open={conversationSheetOpen} onOpenChange={setConversationSheetOpen}>
            <SheetTrigger asChild>
              <Button className="lg:hidden" type="button" variant="outline">{t('conversationsTitle')}</Button>
            </SheetTrigger>
            <SheetContent side={conversationSheetSide} className="grid grid-rows-[auto_minmax(0,1fr)] gap-6 bg-card pt-10">
              <SheetHeader>
                <SheetTitle>{t('conversationsTitle')}</SheetTitle>
              </SheetHeader>
              <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4 overflow-hidden">
                {renderConversationControls('mobile')}
              </div>
            </SheetContent>
          </Sheet>
        </div>
        <div ref={messageScrollRef} className="min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain pr-1 auto-scrollbar" onScroll={handleMessageScroll} >
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
        </div>
        <form className="composer" onSubmit={handleSend} noValidate>
          <label className="sr-only" htmlFor="message-content">
            {t('composerLabel')}
          </label>

          <div className="relative rounded-2xl border bg-background auto-scrollbar">
            <textarea
              id="message-content"
              className="min-h-12 max-h-32 w-full resize-none bg-transparent px-4 py-3 pr-14 outline-none"
              value={content}
              placeholder={t('composerPlaceholder')}
              disabled={!activeId || isSending}
              onChange={(event) => {
                setContent(event.target.value);

                event.currentTarget.style.height = 'auto';
                event.currentTarget.style.height =
                  `${Math.min(event.currentTarget.scrollHeight, 128)}px`;
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              aria-invalid={Boolean(sendError)}
            />

            <Button
              type="submit"
              size="icon"
              disabled={!activeId || isSending}
              className="absolute bottom-2 right-2 h-8 w-8 rounded-full"
              aria-label={t('send')}
            >
              ↑
            </Button>
          </div>

          {sendError ? (
            <p className="chat-error" role="alert">
              {sendError}
            </p>
          ) : null}
        </form>
      </div>
    </section>
  );
}
