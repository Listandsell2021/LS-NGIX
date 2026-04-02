import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard';
import { FilesService } from './files.service';

@Controller('apps/:appId/files')
@UseGuards(JwtAuthGuard)
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Get('list')
  listFiles(
    @Param('appId') appId: string,
    @Query('path') filePath?: string,
  ) {
    return this.filesService.listFiles(appId, filePath || '');
  }

  @Get('read')
  readFile(
    @Param('appId') appId: string,
    @Query('path') filePath: string,
  ) {
    if (!filePath) throw new BadRequestException('path query is required');
    return this.filesService.readFile(appId, filePath);
  }

  @Post('write')
  writeFile(
    @Param('appId') appId: string,
    @Body() body: { path: string; content: string },
  ) {
    if (!body.path) throw new BadRequestException('path is required');
    return this.filesService.writeFile(appId, body.path, body.content);
  }

  @Post('create-folder')
  createFolder(
    @Param('appId') appId: string,
    @Body() body: { path: string },
  ) {
    if (!body.path) throw new BadRequestException('path is required');
    return this.filesService.createFolder(appId, body.path);
  }

  @Delete('delete')
  deleteFile(
    @Param('appId') appId: string,
    @Query('path') filePath: string,
  ) {
    if (!filePath) throw new BadRequestException('path query is required');
    return this.filesService.deleteFile(appId, filePath);
  }
}
