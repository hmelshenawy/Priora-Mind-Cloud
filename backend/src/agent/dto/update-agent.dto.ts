import { PartialType } from '@nestjs/mapped-types';
import { RunAgentDto } from './agent.dto';

export class UpdateAgentDto extends PartialType(RunAgentDto) { }
