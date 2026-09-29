import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { SubmitAssignmentDto } from './dto/submit-assignment.dto';

@Injectable()
export class AssignmentsService {
  constructor(private prisma: PrismaService) {}

  private isAdminRole(role: string) {
    return role === 'SUPER_ADMIN' || role === 'ACADEMIC_COORDINATOR';
  }

  private async assertTeacherCanUseSubject(teacherId: string, subjectId: string, schoolId: string) {
    const subject = await this.prisma.subject.findFirst({
      where: { id: subjectId, class: { schoolId } },
      select: { id: true },
    });
    if (!subject) throw new ForbiddenException('Subject is not in your school');

    const assignment = await this.prisma.teacherSubject.findUnique({
      where: { teacherId_subjectId: { teacherId, subjectId } },
      select: { id: true },
    });
    if (!assignment) throw new ForbiddenException('Teacher is not assigned to this subject');
  }

  async create(dto: CreateAssignmentDto, userId: string, role: string, schoolId: string) {
    const subject = await this.prisma.subject.findFirst({
      where: { id: dto.subjectId, classId: dto.classId, class: { schoolId } },
      select: { id: true },
    });
    if (!subject) throw new ForbiddenException('Class and subject must belong to your school');

    if (!this.isAdminRole(role)) {
      await this.assertTeacherCanUseSubject(userId, dto.subjectId, schoolId);
    }

    const assignment = await this.prisma.assignment.create({
      data: {
        title: dto.title,
        instructions: dto.instructions,
        type: dto.type,
        subjectId: dto.subjectId,
        classId: dto.classId,
        sectionId: dto.sectionId,
        teacherId: userId,
        dueDate: new Date(dto.dueDate),
        totalMarks: dto.totalMarks,
        allowLate: dto.allowLate ?? false,
        latePenalty: dto.latePenalty,
        attachmentUrl: dto.attachmentUrl,
        academicSessionId: dto.academicSessionId,
      },
    });
    return this.findById(assignment.id, schoolId);
  }

  async findAll(filters: { classId?: string; subjectId?: string; teacherId?: string; academicSessionId?: string; isPublished?: string }, schoolId: string) {
    return this.prisma.assignment.findMany({
      where: {
        subject: { class: { schoolId } },
        ...(filters.classId && { classId: filters.classId }),
        ...(filters.subjectId && { subjectId: filters.subjectId }),
        ...(filters.teacherId && { teacherId: filters.teacherId }),
        ...(filters.academicSessionId && { academicSessionId: filters.academicSessionId }),
        ...(filters.isPublished !== undefined && { isPublished: filters.isPublished === 'true' }),
      },
      include: { subject: { select: { id: true, name: true, code: true } }, _count: { select: { submissions: true } } },
      orderBy: { dueDate: 'asc' },
    });
  }

  async findById(id: string, schoolId: string) {
    const assignment = await this.prisma.assignment.findFirst({
      where: { id, subject: { class: { schoolId } } },
      include: { subject: { select: { id: true, name: true, code: true } }, _count: { select: { submissions: true } } },
    });
    if (!assignment) throw new NotFoundException('Assignment not found');
    return assignment;
  }

  private async assertCanManage(id: string, userId: string, role: string, schoolId: string) {
    const assignment = await this.findById(id, schoolId);
    if (!this.isAdminRole(role) && assignment.teacherId !== userId) {
      throw new ForbiddenException('You can only manage your own assignments');
    }
    return assignment;
  }

  async update(id: string, dto: Partial<CreateAssignmentDto>, userId: string, role: string, schoolId: string) {
    await this.assertCanManage(id, userId, role, schoolId);
    if (dto.subjectId !== undefined && !this.isAdminRole(role)) {
      await this.assertTeacherCanUseSubject(userId, dto.subjectId, schoolId);
    }
    return this.prisma.assignment.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }), ...(dto.instructions !== undefined && { instructions: dto.instructions }),
        ...(dto.type !== undefined && { type: dto.type }), ...(dto.subjectId !== undefined && { subjectId: dto.subjectId }),
        ...(dto.classId !== undefined && { classId: dto.classId }), ...(dto.sectionId !== undefined && { sectionId: dto.sectionId }),
        ...(dto.dueDate !== undefined && { dueDate: new Date(dto.dueDate) }), ...(dto.totalMarks !== undefined && { totalMarks: dto.totalMarks }),
        ...(dto.allowLate !== undefined && { allowLate: dto.allowLate }), ...(dto.latePenalty !== undefined && { latePenalty: dto.latePenalty }),
        ...(dto.attachmentUrl !== undefined && { attachmentUrl: dto.attachmentUrl }),
      },
    });
  }

  async publish(id: string, userId: string, role: string, schoolId: string) {
    await this.assertCanManage(id, userId, role, schoolId);
    return this.prisma.assignment.update({ where: { id }, data: { isPublished: true } });
  }

  async submit(assignmentId: string, dto: SubmitAssignmentDto, submittingUserId: string, schoolId: string) {
    const assignment = await this.findById(assignmentId, schoolId);
    const student = await this.prisma.student.findFirst({
      where: { userId: submittingUserId, user: { schoolId } },
      select: { id: true, classId: true, sectionId: true, academicSessionId: true },
    });
    if (!student) throw new ForbiddenException('Only a linked student account can submit assignments');
    if (student.classId !== assignment.classId || student.academicSessionId !== assignment.academicSessionId || (assignment.sectionId && student.sectionId !== assignment.sectionId)) {
      throw new ForbiddenException('This assignment is not assigned to this student');
    }
    if (!assignment.isPublished) throw new ForbiddenException('This assignment is not available for submission');
    const isLate = new Date() > assignment.dueDate;
    if (isLate && !assignment.allowLate) throw new ForbiddenException('Late submissions are not allowed for this assignment');

    const existing = await this.prisma.assignmentSubmission.findUnique({ where: { assignmentId_studentId: { assignmentId, studentId: student.id } } });
    if (existing) {
      return this.prisma.assignmentSubmission.update({ where: { id: existing.id }, data: { content: dto.content, fileUrl: dto.fileUrl, submittedAt: new Date(), isLate, status: 'SUBMITTED' } });
    }
    return this.prisma.assignmentSubmission.create({ data: { assignmentId, studentId: student.id, content: dto.content, fileUrl: dto.fileUrl, isLate, status: 'SUBMITTED' } });
  }

  async getSubmissions(assignmentId: string, userId: string, role: string, schoolId: string) {
    await this.assertCanManage(assignmentId, userId, role, schoolId);
    return this.prisma.assignmentSubmission.findMany({ where: { assignmentId }, orderBy: { submittedAt: 'desc' } });
  }

  async gradeSubmission(submissionId: string, marksAwarded: number, feedback: string, gradedBy: string, role: string, schoolId: string) {
    const submission = await this.prisma.assignmentSubmission.findUnique({ where: { id: submissionId }, include: { assignment: true } });
    if (!submission) throw new NotFoundException('Submission not found');
    await this.assertCanManage(submission.assignmentId, gradedBy, role, schoolId);
    if (marksAwarded < 0 || marksAwarded > submission.assignment.totalMarks) {
      throw new ForbiddenException('Marks awarded must be within the assignment total');
    }
    return this.prisma.assignmentSubmission.update({
      where: { id: submissionId },
      data: { marksAwarded, feedback, status: 'GRADED', gradedAt: new Date(), gradedBy },
    });
  }
}
