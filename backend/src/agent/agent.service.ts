import { Injectable, RequestTimeoutException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RunAgentDto } from './dto/agent.dto';


@Injectable()
export class AgentService {
  constructor(
    private readonly config: ConfigService,
  ) { }

  async runAgent(run: RunAgentDto) {
    const url = this.config.getOrThrow("AGENT_SERVICE_URL")
    const timeout = Number(this.config.getOrThrow("AGENT_TIMEOUT_MS"))
    const userMessage = run.message
    const history = run.history
    const token = run.accessToken
    const mindSpaceId = run.mindSpaceId
    const sourceMessageId = run.sourceMessageId
    try {
      const response = await fetch(
        url,
        {
          method: "POST",
          body: JSON.stringify({
            message: userMessage,
            history: history,
            accessToken: token,
            mindSpaceId: mindSpaceId,
            sourceMessageId: sourceMessageId,
          }),
          headers: {
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(timeout)
        },
      )

      if (!response.ok) {
        throw new Error('Agent request failed');
      }

      const data = await response.json()
      console.log(data)

      if (!data?.content?.trim()) {
        throw new Error('Agent returned an empty response');
      }
      return data

    } catch (error) {
      if (error instanceof DOMException && error.name === 'TimeoutError') {
        console.log(error)
        throw new RequestTimeoutException('Agent request timed out')
      }
      throw error
    }
  }
}
