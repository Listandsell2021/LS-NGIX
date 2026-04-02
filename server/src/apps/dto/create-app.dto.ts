import { IsString, IsInt, IsOptional, Min, Max, Matches, MinLength } from 'class-validator';
import { IsSafeCommand } from '../../common/validators/safe-command.validator';

export class CreateAppDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsString()
  @Matches(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, {
    message: 'Slug must contain only lowercase letters, numbers, and hyphens. Cannot start or end with a hyphen.',
  })
  slug: string;

  @IsString()
  @Matches(/^(https:\/\/|git@)[\w.@:\/~-]+$/, {
    message: 'Git URL must be a valid HTTPS or SSH git URL',
  })
  gitUrl: string;

  @IsString()
  @IsOptional()
  @Matches(/^[a-zA-Z0-9._\/-]+$/, {
    message: 'Branch name contains invalid characters',
  })
  gitBranch?: string;

  @IsString()
  @IsOptional()
  @IsSafeCommand()
  installCommand?: string;

  @IsString()
  @IsOptional()
  @IsSafeCommand()
  buildCommand?: string;

  @IsString()
  @IsOptional()
  @IsSafeCommand()
  startCommand?: string;

  @IsInt()
  @Min(1024)
  @Max(65535)
  port: number;

  @IsInt()
  @IsOptional()
  sshKeyId?: number;
}
