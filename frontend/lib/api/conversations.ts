export type Conversation = {
  id: string;
  mindSpaceId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type Message = {
  id: string;
  conversationId: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  createdAt: string;
};

export type AgentReply = {
  role: string;
  content: string;
};

export type ConversationApiErrorCode = 'unauthorized' | 'notFound' | 'requestFailed';

export class ConversationApiError extends Error {
  code: ConversationApiErrorCode;

  constructor(code: ConversationApiErrorCode) {
    super(code);
    this.code = code;
  }
}

const API_BASE_URL = process.env.NEXT_PUBLIC_NEST_API_BASE_URL ?? 'http://localhost:3000/api/v1';

function errorFromStatus(status: number) {
  if (status === 401) return new ConversationApiError('unauthorized');
  if (status === 404) return new ConversationApiError('notFound');
  return new ConversationApiError('requestFailed');
}

export async function listConversations(accessToken: string, mindSpaceId: string) {
  let response: Response;
  try {
    response = await fetch(
      `${API_BASE_URL}/conversations?minspaceId=${encodeURIComponent(mindSpaceId)}`,
      {headers: {Authorization: `Bearer ${accessToken}`}},
    );
  } catch {
    throw new ConversationApiError('requestFailed');
  }

  if (!response.ok) throw errorFromStatus(response.status);
  return response.json() as Promise<Conversation[]>;
}

export async function createConversation(
  accessToken: string,
  input: {title: string; mindSpaceId: string},
) {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/conversations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });
  } catch {
    throw new ConversationApiError('requestFailed');
  }

  if (!response.ok) throw errorFromStatus(response.status);
  return response.json() as Promise<Conversation>;
}

export async function listMessages(accessToken: string, conversationId: string) {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/conversations/${conversationId}/messages`, {
      headers: {Authorization: `Bearer ${accessToken}`},
    });
  } catch {
    throw new ConversationApiError('requestFailed');
  }

  if (!response.ok) throw errorFromStatus(response.status);
  return response.json() as Promise<Message[]>;
}

export async function sendMessage(
  accessToken: string,
  conversationId: string,
  input: {content: string},
) {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });
  } catch {
    throw new ConversationApiError('requestFailed');
  }

  if (!response.ok) throw errorFromStatus(response.status);
  return response.json() as Promise<AgentReply>;
}
