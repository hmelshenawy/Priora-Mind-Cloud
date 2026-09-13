import { PartialType, PickType } from '@nestjs/mapped-types';
import { CreateConversationDto } from './create-conversation.dto';


export class UpdateConversationDto extends PartialType( PickType(CreateConversationDto, ['title'] as const)) {

       
}
