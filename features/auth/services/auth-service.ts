import { UserRepository } from "../repositories/user-repository";
import bcrypt from "bcryptjs";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { User } from "@prisma/client";

export class AuthService {
  private userRepository: UserRepository;

  constructor() {
    this.userRepository = new UserRepository();
  }

  async registerUser(email: string, passwordPlain: string, name?: string): Promise<Omit<User, "passwordHash">> {
    const existingUser = await this.userRepository.findByEmail(email);
    if (existingUser) {
      throw new ConflictError("A user with this email address already exists");
    }

    // Hash the password securely
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(passwordPlain, saltRounds);

    const user = await this.userRepository.createUser(email, passwordHash, name);

    // Return user without sensitive data
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      image: user.image,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async getUserById(id: string): Promise<Omit<User, "passwordHash">> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundError("User not found");
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      image: user.image,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
