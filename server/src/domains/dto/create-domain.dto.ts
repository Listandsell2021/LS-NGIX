import { IsString, Matches } from 'class-validator';

export class CreateDomainDto {
  @IsString()
  @Matches(/^[a-zA-Z0-9][a-zA-Z0-9.-]+[a-zA-Z0-9]$/, { message: 'Invalid domain format' })
  domain: string;
}
