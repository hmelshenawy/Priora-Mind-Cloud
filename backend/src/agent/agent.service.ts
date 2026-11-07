import { event, elapsed, failure, requestId } from '../logging/request-logging';
import { Injectable, Logger, RequestTimeoutException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RunAgentDto } from './dto/agent.dto';


@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);
  constructor(
    private readonly config: ConfigService,
  ) { }

  async runAgent(run: RunAgentDto) {
    const url = this.config.getOrThrow("AGENT_SERVICE_URL")
    const timeout = Number(this.config.getOrThrow("AGENT_TIMEOUT_MS"))
    const agentSecretKey = this.config.getOrThrow("AGENT_SECRET_KEY")
    const userMessage = run.message
    const history = run.history
    const token = run.accessToken
    const mindSpaceId = run.mindSpaceId
    const sourceMessageId = run.sourceMessageId
    const started = performance.now();
    const correlation = requestId();
    this.logger.debug(event('agent.call.started', { operation: 'chat', status: 'started', history_count: history.length }, correlation));
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
            'X-Request-ID': correlation,
            'X-Internal-Service-Key': agentSecretKey,
          },
          signal: AbortSignal.timeout(timeout)
        },
      )

      if (!response.ok) {
        const errorBody = await response.text();

        failure('agent_http_failed', 'agent_call', response.status < 500 ? 'warn' : 'error', response.status);

        throw new Error(`Agent request failed: HTTP ${response.status}`);
      }

      if (!response.body) {
        failure('agent_empty_stream', 'agent_call');
        throw new Error('Agent returned an empty stream')
      }

      this.logger.debug(event('agent.stream.opened', { operation: 'chat', status: 'completed', upstream_http_status: response.status, duration_ms: elapsed(started) }, correlation));
      return response.body


    } catch (error) {
      if (error instanceof DOMException && error.name === 'TimeoutError') {
        failure('agent_timeout', 'agent_call', 'warn');
        throw new RequestTimeoutException('Agent request timed out')
      }
      failure('agent_http_failed', 'agent_call');
      throw error
    }
  }
}
