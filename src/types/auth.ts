export type UserRole = "primary_admin" | "admin" | "user";

export interface AuthUser {
  username: string;
  role: UserRole;
}
