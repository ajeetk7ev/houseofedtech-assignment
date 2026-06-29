import { MembershipRepository } from "../repositories/membership-repository";
import { DocumentRepository } from "../repositories/document-repository";
import { AuthorizationError, ConflictError, NotFoundError } from "@/lib/errors";
import { DocumentMembership, DocumentRole } from "@prisma/client";

export class MembershipService {
  private membershipRepository: MembershipRepository;
  private documentRepository: DocumentRepository;

  constructor() {
    this.membershipRepository = new MembershipRepository();
    this.documentRepository = new DocumentRepository();
  }

  private async verifyOwner(documentId: string, requestUserId: string): Promise<void> {
    const membership = await this.membershipRepository.findMembership(documentId, requestUserId);
    if (!membership || membership.role !== DocumentRole.OWNER) {
      throw new AuthorizationError("Access denied: Only document owners can manage memberships");
    }
  }

  async listCollaborators(documentId: string, userId: string) {
    const membership = await this.membershipRepository.findMembership(documentId, userId);
    if (!membership) {
      throw new AuthorizationError("Access denied: You are not a collaborator on this document");
    }

    return this.membershipRepository.findDocumentMembers(documentId);
  }

  async addCollaborator(
    documentId: string,
    requestUserId: string,
    targetUserId: string,
    role: DocumentRole
  ): Promise<DocumentMembership> {
    await this.verifyOwner(documentId, requestUserId);

    const existing = await this.membershipRepository.findMembership(documentId, targetUserId);
    if (existing) {
      throw new ConflictError("User is already a collaborator on this document");
    }

    return this.membershipRepository.createMembership(documentId, targetUserId, role);
  }

  async updateCollaboratorRole(
    documentId: string,
    requestUserId: string,
    targetUserId: string,
    newRole: DocumentRole
  ): Promise<DocumentMembership> {
    await this.verifyOwner(documentId, requestUserId);

    if (requestUserId === targetUserId) {
      throw new ConflictError("Owners cannot change their own membership role directly to prevent document lockout");
    }

    const existing = await this.membershipRepository.findMembership(documentId, targetUserId);
    if (!existing) {
      throw new NotFoundError("Collaborator membership not found");
    }

    return this.membershipRepository.updateMembership(documentId, targetUserId, newRole);
  }

  async removeCollaborator(
    documentId: string,
    requestUserId: string,
    targetUserId: string
  ): Promise<DocumentMembership> {
    const membership = await this.membershipRepository.findMembership(documentId, requestUserId);
    if (!membership) {
      throw new AuthorizationError("Access denied: You are not a collaborator");
    }

    // A collaborator can remove themselves, or the owner can remove any collaborator
    const isSelfRemoval = requestUserId === targetUserId;
    const isOwnerAction = membership.role === DocumentRole.OWNER;

    if (!isSelfRemoval && !isOwnerAction) {
      throw new AuthorizationError("Access denied: You do not have permission to remove this collaborator");
    }

    const targetMembership = await this.membershipRepository.findMembership(documentId, targetUserId);
    if (!targetMembership) {
      throw new NotFoundError("Collaborator membership not found");
    }

    // Prevent removing the last owner
    if (targetMembership.role === DocumentRole.OWNER) {
      const allMembers = await this.membershipRepository.findDocumentMembers(documentId);
      const owners = allMembers.filter((m) => m.role === DocumentRole.OWNER);
      if (owners.length <= 1) {
        throw new ConflictError("Cannot remove the last owner of the document. Transfer ownership first");
      }
    }

    return this.membershipRepository.deleteMembership(documentId, targetUserId);
  }
}
