import { Controller, Post, Get, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard';
import { SshKeysService } from './ssh-keys.service';
import { CreateSshKeyDto } from './dto/create-ssh-key.dto';

@Controller('ssh-keys')
@UseGuards(JwtAuthGuard)
export class SshKeysController {
  constructor(private readonly sshKeysService: SshKeysService) {}

  @Post()
  generate(@Body() dto: CreateSshKeyDto) {
    return this.sshKeysService.generate(dto);
  }

  @Get()
  findAll() {
    return this.sshKeysService.findAll();
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.sshKeysService.remove(Number(id));
  }
}
