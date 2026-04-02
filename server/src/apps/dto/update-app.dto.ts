import { IsString, IsInt, IsOptional, Min, Max, Matches, MinLength } from 'class-validator';
import { IsSafeCommand } from '../../common/validators/safe-command.validator';

export class UpdateAppDto {
  @IsString()
  @MinLength(1)
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  @Matches(/^(https:\/\/|git@)[\w.@:\/~-]+\.git$/, {
    message: 'Git URL must be a valid HTTPS or SSH git URL ending in .git',
  })
  gitUrl?: string;

  @IsString()
  @IsOptional()
  @Matches(/^[a-zA-Z0-9._\/-]+$/)
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
  @IsOptional()
  port?: number;
}
