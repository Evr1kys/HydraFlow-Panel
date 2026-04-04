import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateInternalSquadDto } from './dto/create-internal-squad.dto';
import { UpdateInternalSquadDto } from './dto/update-internal-squad.dto';

@Injectable()
export class InternalSquadsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.internalSquad.findMany({
      orderBy: { createdAt: 'desc' },
      include: { users: { select: { id: true, email: true, remark: true } } },
    });
  }

  async findOne(id: string) {
    const squad = await this.prisma.internalSquad.findUnique({
      where: { id },
      include: { users: { select: { id: true, email: true, remark: true } } },
    });
    if (!squad) {
      throw new NotFoundException('Internal squad not found');
    }
    return squad;
  }

  async create(dto: CreateInternalSquadDto) {
    const existing = await this.prisma.internalSquad.findUnique({
      where: { name: dto.name },
    });
    if (existing) {
      throw new ConflictException('Squad with this name already exists');
    }
    return this.prisma.internalSquad.create({
      data: {
        name: dto.name,
        description: dto.description,
        nodeIds: dto.nodeIds ?? [],
      },
      include: { users: { select: { id: true, email: true, remark: true } } },
    });
  }

  async update(id: string, dto: UpdateInternalSquadDto) {
    await this.findOne(id);
    return this.prisma.internalSquad.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        nodeIds: dto.nodeIds,
      },
      include: { users: { select: { id: true, email: true, remark: true } } },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.internalSquad.delete({ where: { id } });
    return { message: 'Internal squad deleted' };
  }

  async assignUsers(id: string, userIds: string[]) {
    await this.findOne(id);
    await this.prisma.user.updateMany({
      where: { id: { in: userIds } },
      data: { internalSquadId: id },
    });
    return this.findOne(id);
  }

  async removeUsers(id: string, userIds: string[]) {
    await this.findOne(id);
    await this.prisma.user.updateMany({
      where: { id: { in: userIds }, internalSquadId: id },
      data: { internalSquadId: null },
    });
    return this.findOne(id);
  }
}
