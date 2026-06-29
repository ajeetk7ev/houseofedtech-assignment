import { NextResponse } from "next/server";
import { AppError, ValidationError } from "./errors";
import { ZodError } from "zod";

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code: string;
    details?: Record<string, string[]>;
  };
}

export async function handleApiRoute<T>(
  handler: () => Promise<NextResponse<ApiResponse<T>> | T>
): Promise<NextResponse<ApiResponse<T>>> {
  try {
    const result = await handler();
    if (result instanceof NextResponse) {
      return result;
    }
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("API Error:", error);

    if (error instanceof AppError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: error.message,
            code: error.code || "INTERNAL_ERROR",
            details: error instanceof ValidationError ? error.details : undefined,
          },
        },
        { status: error.statusCode }
      );
    }

    if (error instanceof ZodError) {
      const details: Record<string, string[]> = {};
      error.issues.forEach((issue) => {
        const path = issue.path.join(".") || "body";
        if (!details[path]) {
          details[path] = [];
        }
        details[path].push(issue.message);
      });
      return NextResponse.json(
        {
          success: false,
          error: {
            message: "Validation failed",
            code: "VALIDATION_ERROR",
            details,
          },
        },
        { status: 400 }
      );
    }

    // Default error mapping
    return NextResponse.json(
      {
        success: false,
        error: {
          message: error instanceof Error ? error.message : "Internal Server Error",
          code: "INTERNAL_ERROR",
        },
      },
      { status: 500 }
    );
  }
}
