import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RunAgentDto } from './dto/agent.dto';
import { json } from 'stream/consumers';

@Injectable()
export class AgentService {
  constructor(
    private readonly config: ConfigService,
  ) { }

  async runAgent(run: RunAgentDto) {
    const url = this.config.getOrThrow("AGENT_SERVICE_URL")
    const timeout = this.config.getOrThrow("AGENT_TIMEOUT_MS")
    const userMessage = run.message
    const history = run.history
    const token = run.accessToken
    const mindSpaceId = run.mindSpaceId

    const response = await fetch(
      url,
      {
        method: "POST",
        body: JSON.stringify({
          message: userMessage,
          history: history,
          accessToken: token,
          mindSpaceId: mindSpaceId,
        }),
        headers: {
          'Content-Type': 'application/json',
        }
      }
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
  }

}
