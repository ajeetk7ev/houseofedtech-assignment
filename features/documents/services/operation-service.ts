import { OperationRepository } from "../repositories/operation-repository";
import { DocumentRepository } from "../repositories/document-repository";
import { MembershipRepository } from "../repositories/membership-repository";
import { AuthorizationError, NotFoundError } from "@/lib/errors";
import { Operation, DocumentRole } from "@prisma/client";

export class OperationService {
  private operationRepository: OperationRepository;
  private documentRepository: DocumentRepository;
  private membershipRepository: MembershipRepository;

  constructor() {
    this.operationRepository = new OperationRepository();
    this.documentRepository = new DocumentRepository();
    this.membershipRepository = new MembershipRepository();
  }

  private async verifyAccess(documentId: string, userId: string, allowedRoles: DocumentRole[]) {
    const membership = await this.membershipRepository.findMembership(documentId, userId);
    if (!membership) {
      throw new AuthorizationError("Access denied: You are not a collaborator on this document");
    }
    if (!allowedRoles.includes(membership.role)) {
      throw new AuthorizationError("Access denied: You do not have permission to access operation logs");
    }
  }

  async getOperationsSince(documentId: string, userId: string, sequenceNumber: number): Promise<Operation[]> {
    await this.verifyAccess(documentId, userId, [DocumentRole.OWNER, DocumentRole.EDITOR, DocumentRole.VIEWER]);
    return this.operationRepository.findOperationsSince(documentId, sequenceNumber);
  }

  async submitOperations(
    documentId: string,
    userId: string,
    ops: {
      clientId: string;
      sequenceNumber: number;
      baseVersion: number;
      update: Uint8Array;
      checksum?: string;
    }[]
  ): Promise<{ success: boolean; lastOperationNumber: number }> {
    // Only Owners and Editors can submit operations
    await this.verifyAccess(documentId, userId, [DocumentRole.OWNER, DocumentRole.EDITOR]);

    const document = await this.documentRepository.findById(documentId);
    if (!document) {
      throw new NotFoundError("Document not found");
    }

    if (ops.length === 0) {
      return { success: true, lastOperationNumber: document.lastOperationNumber };
    }

    // Sort operations by sequence number to ensure order
    const sortedOps = [...ops].sort((a, b) => a.sequenceNumber - b.sequenceNumber);

    // Basic sequence number integrity check
    const currentMaxSeq = await this.operationRepository.getLastOperationNumber(documentId);
    const firstNewSeq = sortedOps[0].sequenceNumber;

    if (firstNewSeq <= currentMaxSeq) {
      // Conflict: client is attempting to rewrite history or sending duplicate ops.
      // In a real local-first system, this triggers reconciliation, but for now we throw a conflict error
      // or filter out duplicates. Let's filter out operations that have already been stored.
      const freshOps = sortedOps.filter((op) => op.sequenceNumber > currentMaxSeq);
      
      if (freshOps.length === 0) {
        return { success: true, lastOperationNumber: currentMaxSeq };
      }

      return this.saveFreshOperations(documentId, userId, freshOps);
    }

    return this.saveFreshOperations(documentId, userId, sortedOps);
  }

  private async saveFreshOperations(
    documentId: string,
    userId: string,
    ops: {
      clientId: string;
      sequenceNumber: number;
      baseVersion: number;
      update: Uint8Array;
      checksum?: string;
    }[]
  ) {
    const newMaxSeq = ops[ops.length - 1].sequenceNumber;

    // Use prisma transaction to guarantee atomicity
    await this.documentRepository.updateDocument(documentId, {
      lastOperationNumber: newMaxSeq,
    });

    // Write operations
    const dbOps = ops.map((op) => ({
      documentId,
      userId, // Authenticated user who submitted the operations
      clientId: op.clientId,
      sequenceNumber: op.sequenceNumber,
      baseVersion: op.baseVersion,
      update: op.update,
      checksum: op.checksum ?? null,
    }));

    await this.operationRepository.bulkCreateOperations(dbOps);

    return { success: true, lastOperationNumber: newMaxSeq };
  }
}
