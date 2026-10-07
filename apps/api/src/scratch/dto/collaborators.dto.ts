import { IsString, MaxLength, MinLength } from 'class-validator';
import type { AddScratchCollaboratorRequest } from '@lms/contracts';

export class AddCollaboratorDto implements AddScratchCollaboratorRequest {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  userId!: string;
}

export class CollaboratorSearchDto {
  @IsString()
  @MaxLength(100)
  q!: string;
}
