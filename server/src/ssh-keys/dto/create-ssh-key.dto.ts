import { IsString, MinLength, IsOptional } from 'class-validator';

export class CreateSshKeyDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsString()
  @IsOptional()
  privateKey?: string; // If provided, import existing key. If not, generate new one.
}
