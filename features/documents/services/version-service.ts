import { VersionRepository } from "../repositories/version-repository";
import { DocumentRepository } from "../repositories/document-repository";
import { MembershipRepository } from "../repositories/membership-repository";
import { AuthorizationError, NotFoundError } from "@/lib/errors";
import { Version, DocumentRole } from "@prisma/client";

export class VersionService {
  private versionRepository: VersionRepository;
  private membershipRepository: MembershipRepository;
  private documentRepository: DocumentRepository;

  constructor() {
    this.versionRepository = new VersionRepository();
    this.membershipRepository = new MembershipRepository();
    this.documentRepository = new DocumentRepository();
  }

  private async verifyAccess(documentId: string, userId: string, allowedRoles: DocumentRole[]) {
    const membership = await this.membershipRepository.findMembership(documentId, userId);
    if (!membership) {
      throw new AuthorizationError("Access denied: You are not a collaborator on this document");
    }
    if (!allowedRoles.includes(membership.role)) {
      throw new AuthorizationError("Access denied: You do not have permission to view or manage versions");
    }
  }

  async listVersions(documentId: string, userId: string): Promise<any[]> {
    await this.verifyAccess(documentId, userId, [DocumentRole.OWNER, DocumentRole.EDITOR, DocumentRole.VIEWER]);
    return this.versionRepository.findVersionsByDocumentId(documentId);
  }

  async createVersion(
    documentId: string,
    userId: string,
    data: {
      title: string;
      description?: string | null;
      snapshot: Buffer;
      isAutomatic?: boolean;
      parentVersionId?: string | null;
    }
  ): Promise<Version> {
    // Only Owners and Editors can create new versions
    await this.verifyAccess(documentId, userId, [DocumentRole.OWNER, DocumentRole.EDITOR]);

    return this.versionRepository.createVersion({
      documentId,
      title: data.title,
      description: data.description,
      snapshot: data.snapshot,
      createdBy: userId,
      isAutomatic: data.isAutomatic ?? false,
      parentVersionId: data.parentVersionId,
    });
  }

  async getVersion(versionId: string, userId: string): Promise<Version> {
    const version = await this.versionRepository.findById(versionId);
    if (!version) {
      throw new NotFoundError("Version not found");
    }

    // Check if the user has access to the version's parent document
    await this.verifyAccess(version.documentId, userId, [DocumentRole.OWNER, DocumentRole.EDITOR, DocumentRole.VIEWER]);
    return version;
  }

  async restoreVersion(versionId: string, userId: string): Promise<Version> {
    const version = await this.versionRepository.findById(versionId);
    if (!version) {
      throw new NotFoundError("Version not found");
    }

    // Only OWNER can restore versions
    await this.verifyAccess(version.documentId, userId, [DocumentRole.OWNER]);

    // Update document snapshot in DB
    await this.documentRepository.updateDocument(version.documentId, {
      latestSnapshot: version.snapshot,
    });

    // Create a new Version entry representing the restore action
    return this.versionRepository.createVersion({
      documentId: version.documentId,
      title: `Restored from ${version.title}`,
      description: `Restored version created at ${new Date(version.createdAt).toLocaleString()}`,
      snapshot: version.snapshot,
      createdBy: userId,
      isAutomatic: false,
    });
  }

  async deleteVersion(versionId: string, userId: string): Promise<Version> {
    const version = await this.versionRepository.findById(versionId);
    if (!version) {
      throw new NotFoundError("Version not found");
    }

    // Only OWNER can delete versions
    await this.verifyAccess(version.documentId, userId, [DocumentRole.OWNER]);

    return this.versionRepository.deleteVersion(versionId);
  }
}
