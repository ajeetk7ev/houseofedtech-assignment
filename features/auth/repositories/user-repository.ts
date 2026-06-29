import { prisma } from "@/lib/prisma";
import { User } from "@prisma/client";

export class UserRepository {
  async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { email },
    });
  }

  async createUser(email: string, passwordHash: string, name?: string): Promise<User> {
    return prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
      },
    });
  }

  async updateUser(id: string, data: Partial<Omit<User, "id" | "createdAt" | "updatedAt">>): Promise<User> {
    return prisma.user.update({
      where: { id },
      data,
    });
  }
}
