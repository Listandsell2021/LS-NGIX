import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SshKey } from './entities/ssh-key.entity';
import { SshKeysService } from './ssh-keys.service';
import { SshKeysController } from './ssh-keys.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([SshKey]), AuthModule],
  controllers: [SshKeysController],
  providers: [SshKeysService],
  exports: [SshKeysService],
})
export class SshKeysModule {}
