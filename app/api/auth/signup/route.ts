import { NextRequest } from "next/server";
import { handleApiRoute } from "@/lib/api-helper";
import { SignUpSchema } from "@/lib/validation/schemas";
import { AuthService } from "@/features/auth/services/auth-service";

export async function POST(request: NextRequest) {
  return handleApiRoute(async () => {
    const body = await request.json();
    const validatedData = SignUpSchema.parse(body);

    const authService = new AuthService();
    const newUser = await authService.registerUser(
      validatedData.email,
      validatedData.password,
      validatedData.name
    );

    return newUser;
  });
}
