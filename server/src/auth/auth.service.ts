import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { User } from './entities/user.entity';
import { SetupDto } from './dto/setup.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  private jwtSecret: string;

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly jwtService: JwtService,
  ) {
    this.jwtSecret = this.loadOrCreateSecret();
  }

  private loadOrCreateSecret(): string {
    const secretPath = join(__dirname, '..', '..', 'data', 'jwt.secret');
    if (existsSync(secretPath)) {
      return readFileSync(secretPath, 'utf-8').trim();
    }
    const secret = randomBytes(64).toString('hex');
    writeFileSync(secretPath, secret, { mode: 0o600 });
    return secret;
  }

  getJwtSecret(): string {
    return this.jwtSecret;
  }

  async isSetupComplete(): Promise<boolean> {
    const count = await this.userRepo.count();
    return count > 0;
  }

  async setup(dto: SetupDto): Promise<{ access_token: string; refresh_token: string }> {
    const exists = await this.isSetupComplete();
    if (exists) {
      throw new ConflictException('Setup already completed');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = this.userRepo.create({
      username: dto.username,
      passwordHash,
    });
    await this.userRepo.save(user);

    return this.generateTokens(user);
  }

  async login(dto: LoginDto): Promise<{ access_token: string; refresh_token: string }> {
    const user = await this.userRepo.findOne({
      where: { username: dto.username },
    });

    if (!user) {
      await bcrypt.hash('dummy-password', 12);
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.generateTokens(user);
  }

  private generateTokens(user: User): { access_token: string; refresh_token: string } {
    const payload = { sub: user.id, username: user.username };
    return {
      access_token: this.jwtService.sign(payload, {
        secret: this.jwtSecret,
        expiresIn: '15m',
      }),
      refresh_token: this.jwtService.sign(payload, {
        secret: this.jwtSecret,
        expiresIn: '7d',
      }),
    };
  }

  async refresh(refreshToken: string): Promise<{ access_token: string }> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.jwtSecret,
      });
      const user = await this.findById(payload.sub);
      if (!user) throw new UnauthorizedException();

      return {
        access_token: this.jwtService.sign(
          { sub: user.id, username: user.username },
          { secret: this.jwtSecret, expiresIn: '15m' },
        ),
      };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async findById(id: number): Promise<User | null> {
    return this.userRepo.findOne({ where: { id } });
  }
}
