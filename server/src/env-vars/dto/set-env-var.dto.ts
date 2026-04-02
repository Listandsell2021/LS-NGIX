import { IsString, Matches } from 'class-validator';

export class SetEnvVarDto {
  @IsString()
  @Matches(/^[A-Z_][A-Z0-9_]*$/, { message: 'Key must be uppercase with underscores (e.g. DATABASE_URL)' })
  key: string;

  @IsString()
  value: string;
}
