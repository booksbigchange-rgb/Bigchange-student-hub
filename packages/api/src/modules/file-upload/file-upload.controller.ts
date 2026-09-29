import {
  Controller, Post, Get, Delete, Param, Query, UploadedFile, UseInterceptors,
  UseGuards, BadRequestException, NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiConsumes, ApiBody, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { FileUploadService } from './file-upload.service';
import { randomUUID } from 'crypto';
import * as path from 'path';

const ALLOWED_EXTENSIONS = new Set(['pdf', 'doc', 'docx', 'ppt', 'pptx', 'mp4', 'mp3', 'jpg', 'jpeg', 'png', 'webp']);
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'video/mp4', 'audio/mpeg', 'audio/mp3', 'image/jpeg', 'image/png', 'image/webp',
]);
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB during stabilization

@ApiTags('File Upload')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('files')
export class FileUploadController {
  constructor(private readonly fileUploadService: FileUploadService) {}

  private scopedName(schoolId: string, fileName: string): string {
    const normalized = fileName.replace(/\\/g, '/').replace(/^\/+/, '');
    if (!normalized || normalized.includes('..') || normalized.includes('\0')) {
      throw new BadRequestException('Invalid file name');
    }
    return `schools/${schoolId}/${normalized}`;
  }

  private safeFolder(folder?: string): string {
    if (!folder) return '';
    const normalized = folder.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    if (normalized.includes('..') || normalized.includes('\0')) {
      throw new BadRequestException('Invalid folder');
    }
    return normalized ? `${normalized}/` : '';
  }

  @Post('upload')
  @Roles('SUPER_ADMIN', 'IT_ADMIN', 'ACADEMIC_COORDINATOR', 'CLASS_TEACHER', 'SUBJECT_TEACHER', 'STUDENT')
  @ApiOperation({ summary: 'Upload a file to private school-scoped storage' })
  @ApiConsumes('multipart/form-data')
  @ApiQuery({ name: 'folder', required: false })
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_SIZE } }))
  async uploadFile(@UploadedFile() file: Express.Multer.File, @CurrentUser('schoolId') schoolId: string, @Query('folder') folder?: string) {
    if (!file) throw new BadRequestException('No file provided');
    if (file.size > MAX_FILE_SIZE) throw new BadRequestException('File exceeds the 50 MB limit');

    const ext = path.extname(file.originalname).replace('.', '').toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext) || !ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException('File type is not allowed');
    }

    const relativeName = `${this.safeFolder(folder)}${randomUUID()}.${ext}`;
    const objectName = this.scopedName(schoolId, relativeName);
    await this.fileUploadService.uploadFile(file.buffer, objectName, file.mimetype);

    return { success: true, fileName: relativeName, originalName: file.originalname, mimeType: file.mimetype, size: file.size };
  }

  @Get('browse')
  @Roles('SUPER_ADMIN', 'IT_ADMIN', 'ACADEMIC_COORDINATOR')
  async browseFiles(@CurrentUser('schoolId') schoolId: string, @Query('prefix') prefix?: string) {
    const relativePrefix = this.safeFolder(prefix);
    const storagePrefix = this.scopedName(schoolId, relativePrefix || 'root').replace(/root$/, '');
    const result = await this.fileUploadService.listByFolder(storagePrefix);
    return { prefix: relativePrefix, folders: result.folders.map((f) => f.replace(`schools/${schoolId}/`, '')), files: result.files.map((f) => ({ name: f.name?.replace(`schools/${schoolId}/`, ''), size: f.size, lastModified: f.lastModified, etag: f.etag })) };
  }

  @Get('stats')
  @Roles('SUPER_ADMIN', 'IT_ADMIN')
  async getStorageStats(@CurrentUser('schoolId') schoolId: string) {
    return this.fileUploadService.getStorageStats(`schools/${schoolId}/`);
  }

  @Get()
  @Roles('SUPER_ADMIN', 'IT_ADMIN', 'ACADEMIC_COORDINATOR')
  async listFiles(@CurrentUser('schoolId') schoolId: string, @Query('prefix') prefix?: string) {
    const relativePrefix = this.safeFolder(prefix);
    const files = await this.fileUploadService.listFiles(`schools/${schoolId}/${relativePrefix}`);
    return { files: files.map((f) => ({ name: f.name?.replace(`schools/${schoolId}/`, ''), size: f.size, lastModified: f.lastModified, etag: f.etag })), total: files.length };
  }

  @Get('info/:fileName(*)')
  async getFileInfo(@Param('fileName') fileName: string, @CurrentUser('schoolId') schoolId: string) {
    if (!fileName) throw new BadRequestException('File name is required');
    try {
      const info = await this.fileUploadService.getFileInfo(this.scopedName(schoolId, fileName));
      return { ...info, name: fileName };
    } catch { throw new NotFoundException('File not found'); }
  }

  @Get(':fileName(*)')
  async getSignedUrl(@Param('fileName') fileName: string, @CurrentUser('schoolId') schoolId: string) {
    if (!fileName) throw new BadRequestException('File name is required');
    try {
      const url = await this.fileUploadService.getSignedUrl(this.scopedName(schoolId, fileName), 300);
      return { fileName, signedUrl: url };
    } catch { throw new NotFoundException('File not found'); }
  }

  @Delete(':fileName(*)')
  @Roles('SUPER_ADMIN', 'IT_ADMIN', 'ACADEMIC_COORDINATOR')
  async deleteFile(@Param('fileName') fileName: string, @CurrentUser('schoolId') schoolId: string) {
    if (!fileName) throw new BadRequestException('File name is required');
    await this.fileUploadService.deleteFile(this.scopedName(schoolId, fileName));
    return { success: true, message: 'File deleted successfully' };
  }
}
