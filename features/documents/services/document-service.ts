import { DocumentRepository, FindDocumentsOptions } from "../repositories/document-repository";
import { MembershipRepository } from "../repositories/membership-repository";
import { AuthorizationError, ConflictError, NotFoundError } from "@/lib/errors";
import { Document, DocumentMembership, DocumentRole } from "@prisma/client";

export class DocumentService {
  private documentRepository: DocumentRepository;
  private membershipRepository: MembershipRepository;

  constructor() {
    this.documentRepository = new DocumentRepository();
    this.membershipRepository = new MembershipRepository();
  }

  /**
   * Helper to verify a user's role on a document, throwing appropriate HTTP exceptions.
   */
  async verifyAccess(documentId: string, userId: string, allowedRoles: DocumentRole[]): Promise<DocumentMembership> {
    const docExists = await this.documentRepository.findById(documentId);
    if (!docExists) {
      throw new NotFoundError("Document not found");
    }

    const membership = await this.membershipRepository.findMembership(documentId, userId);
    if (!membership) {
      throw new AuthorizationError("Access denied: You are not a collaborator on this document");
    }

    if (!allowedRoles.includes(membership.role)) {
      throw new AuthorizationError(`Access denied: Required role not met. Allowed roles: ${allowedRoles.join(", ")}`);
    }

    return membership;
  }

  async createDocument(title: string, userId: string, id?: string): Promise<Document> {
    if (id) {
      const existing = await this.documentRepository.findById(id);
      if (existing) {
        if (existing.createdBy === userId) {
          return existing;
        }
        throw new ConflictError("Document already exists and is owned by a different user");
      }
    }
    return this.documentRepository.createDocumentWithMembership(title, userId, id);
  }

  async getDocument(id: string, userId: string): Promise<Document> {
    await this.verifyAccess(id, userId, [DocumentRole.OWNER, DocumentRole.EDITOR, DocumentRole.VIEWER]);
    
    const doc = await this.documentRepository.findById(id);
    if (!doc) {
      throw new NotFoundError("Document not found");
    }
    return doc;
  }

  async updateDocument(id: string, userId: string, data: { title?: string; latestSnapshot?: Uint8Array; lastOperationNumber?: number; isArchived?: boolean }): Promise<Document> {
    // If attempting to archive/unarchive, require OWNER role. Otherwise, require OWNER or EDITOR.
    const allowedRoles = data.isArchived !== undefined ? [DocumentRole.OWNER] : [DocumentRole.OWNER, DocumentRole.EDITOR];
    await this.verifyAccess(id, userId, allowedRoles);
    return this.documentRepository.updateDocument(id, data);
  }

  async archiveDocument(id: string, userId: string, isArchived: boolean): Promise<Document> {
    return this.updateDocument(id, userId, { isArchived });
  }

  async deleteDocument(id: string, userId: string): Promise<Document> {
    // Only OWNER can delete the document
    await this.verifyAccess(id, userId, [DocumentRole.OWNER]);
    return this.documentRepository.deleteDocument(id);
  }

  async listDocuments(userId: string, options: FindDocumentsOptions = {}): Promise<{ items: Document[]; total: number }> {
    return this.documentRepository.findUserDocuments(userId, options);
  }
}
