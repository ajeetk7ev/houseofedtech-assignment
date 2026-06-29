import { z } from "zod";
import { DocumentRole } from "@prisma/client";

// Authentication Schemas
export const SignUpSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  name: z.string().min(2, "Name must be at least 2 characters").optional(),
});

export const LoginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

// Document Schemas
export const CreateDocumentSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(1, "Title must be at least 1 character").max(200, "Title is too long"),
});

export const UpdateDocumentSchema = z.object({
  title: z.string().trim().min(1, "Title must be at least 1 character").max(200, "Title is too long").optional(),
  isArchived: z.boolean().optional(),
  latestSnapshot: z.string().optional(), // Expected as base64 string from client
});

// Document Membership Schemas
export const CreateMembershipSchema = z.object({
  userId: z.string().uuid("Invalid user ID"),
  role: z.nativeEnum(DocumentRole, {
    message: "Role must be OWNER, EDITOR, or VIEWER",
  }),
});

export const UpdateMembershipSchema = z.object({
  role: z.nativeEnum(DocumentRole, {
    message: "Role must be OWNER, EDITOR, or VIEWER",
  }),
});

// Operation Schemas
export const CreateOperationSchema = z.object({
  clientId: z.string().min(1, "ClientId is required"),
  sequenceNumber: z.number().int().nonnegative(),
  baseVersion: z.number().int().nonnegative(),
  operationType: z.string().default("UPDATE"),
  update: z.string().min(1, "Binary update string (base64) is required"), // Base64 updates
  checksum: z.string().optional(),
});

// Version Schemas
export const CreateVersionSchema = z.object({
  title: z.string().trim().min(1, "Version title is required"),
  description: z.string().optional(),
  snapshot: z.string().min(1, "Snapshot is required"), // Base64 snapshot
  isAutomatic: z.boolean().optional().default(false),
  parentVersionId: z.string().uuid().optional().nullable(),
});
