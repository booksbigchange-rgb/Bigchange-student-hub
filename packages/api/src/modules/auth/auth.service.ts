import { Injectable, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { randomBytes, createHash } from 'crypto';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwtService: JwtService, private config: ConfigService) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !user.isActive || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.generateTokens(user);
  }

  private hashToken(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  async refreshTokens(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { token: tokenHash }, include: { user: true } });
    if (!stored || stored.expiresAt < new Date() || !stored.user.isActive) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    await this.prisma.refreshToken.delete({ where: { id: stored.id } });
    return this.generateTokens(stored.user);
  }

  async logout(userId: string) { await this.prisma.refreshToken.deleteMany({ where: { userId } }); }

  async requestPasswordReset(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) return { message: 'If this email exists, reset instructions have been sent.' };

    await this.prisma.passwordResetToken.deleteMany({ where: { email } });
    const otp = randomBytes(4).readUInt32BE(0) % 1000000;
    const otpString = otp.toString().padStart(6, '0');
    const otpHash = this.hashToken(otpString);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await this.prisma.passwordResetToken.create({ data: { email, otp: otpHash, expiresAt } });

    // Delivery must be implemented by the configured mail/SMS provider. Never log the OTP.
    return { message: 'If this email exists, reset instructions have been sent.' };
  }

  async verifyResetOtp(email: string, otp: string) {
    const token = await this.prisma.passwordResetToken.findFirst({ where: { email, otp: this.hashToken(otp), used: false } });
    if (!token || token.expiresAt < new Date()) throw new BadRequestException('Invalid or expired OTP');

    await this.prisma.passwordResetToken.update({ where: { id: token.id }, data: { used: true } });
    const resetToken = this.jwtService.sign({ email, purpose: 'password-reset', resetId: token.id }, { expiresIn: '10m' });
    return { resetToken, message: 'OTP verified successfully' };
  }

  async resetPassword(resetToken: string, newPassword: string) {
    if (!newPassword || newPassword.length < 10) throw new BadRequestException('Password must be at least 10 characters long');

    let payload: any;
    try { payload = await this.jwtService.verifyAsync(resetToken); }
    catch { throw new BadRequestException('Invalid or expired reset token'); }
    if (payload?.purpose !== 'password-reset' || !payload.email || !payload.resetId) throw new BadRequestException('Invalid reset token');

    const token = await this.prisma.passwordResetToken.findUnique({ where: { id: payload.resetId } });
    if (!token || token.email !== payload.email || !token.used || token.expiresAt < new Date()) throw new BadRequestException('Invalid or expired reset token');

    const user = await this.prisma.user.findUnique({ where: { email: payload.email } });
    if (!user || !user.isActive) throw new NotFoundException('User not found');
    const passwordHash = await bcrypt.hash(newPassword, 12);

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
      this.prisma.passwordResetToken.deleteMany({ where: { email: payload.email } }),
      this.prisma.refreshToken.deleteMany({ where: { userId: user.id } }),
    ]);
    return { message: 'Password reset successfully' };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    if (!newPassword || newPassword.length < 10) throw new BadRequestException('Password must be at least 10 characters long');
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) throw new UnauthorizedException('Current password is incorrect');
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
      this.prisma.refreshToken.deleteMany({ where: { userId } }),
    ]);
    return { message: 'Password changed successfully' };
  }

  private async generateTokens(user: { id: string; email: string; role: string; schoolId: string }) {
    const payload = { sub: user.id, email: user.email, role: user.role, schoolId: user.schoolId };
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = randomBytes(48).toString('base64url');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await this.prisma.refreshToken.create({ data: { token: this.hashToken(refreshToken), userId: user.id, expiresAt } });
    return { accessToken, refreshToken, user: { id: user.id, email: user.email, role: user.role } };
  }
}
