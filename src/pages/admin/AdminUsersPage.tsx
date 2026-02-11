import { FormEvent, useEffect, useMemo, useState } from "react";
import { ShieldCheck, UserCog, UserPlus, UserRoundX } from "lucide-react";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import type { ManagedUser } from "@/types/admin";
import type { UserRole } from "@/types/auth";

interface UsersResponse {
  users: ManagedUser[];
}

const CREATION_ROLES: UserRole[] = ["user", "admin"];

export default function AdminUsersPage() {
  const { user } = useAuth();
  const isPrimaryAdmin = user?.role === "primary_admin";

  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("user");

  const [passwordDrafts, setPasswordDrafts] = useState<Record<string, string>>({});

  const canCreateRole = (role: UserRole) => role === "user" || (role === "admin" && isPrimaryAdmin);

  const loadUsers = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await apiGet<UsersResponse>("/api/admin/users");
      setUsers(response.users);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => a.username.localeCompare(b.username)),
    [users],
  );

  const handleCreateUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isPrimaryAdmin) {
      setError("Only primary admin can create users.");
      return;
    }

    if (!canCreateRole(newRole)) {
      setError("Invalid role selection.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      await apiPost("/api/admin/users", {
        username: newUsername,
        password: newPassword,
        role: newRole,
      });
      setNewUsername("");
      setNewPassword("");
      setNewRole("user");
      await loadUsers();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to create user");
    } finally {
      setBusy(false);
    }
  };

  const handleToggleActive = async (target: ManagedUser) => {
    if (!isPrimaryAdmin) {
      return;
    }

    setBusy(true);
    setError("");
    try {
      await apiPatch(`/api/admin/users/${encodeURIComponent(target.username)}`, {
        isActive: !target.isActive,
      });
      await loadUsers();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to update user status");
    } finally {
      setBusy(false);
    }
  };

  const handlePasswordUpdate = async (targetUsername: string) => {
    if (!isPrimaryAdmin) {
      return;
    }

    const password = passwordDrafts[targetUsername];
    if (!password) {
      setError("Enter a new password before saving.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      await apiPatch(`/api/admin/users/${encodeURIComponent(targetUsername)}`, {
        password,
      });

      setPasswordDrafts((prev) => {
        const next = { ...prev };
        delete next[targetUsername];
        return next;
      });

      await loadUsers();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to update password");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteUser = async (target: ManagedUser) => {
    if (!isPrimaryAdmin) {
      return;
    }

    if (!confirm(`Delete user "${target.username}"? This cannot be undone.`)) {
      return;
    }

    setBusy(true);
    setError("");

    try {
      await apiDelete(`/api/admin/users/${encodeURIComponent(target.username)}`);
      await loadUsers();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to delete user");
    } finally {
      setBusy(false);
    }
  };

  const handlePromote = async (target: ManagedUser) => {
    if (!isPrimaryAdmin || target.role !== "user") {
      return;
    }

    setBusy(true);
    setError("");

    try {
      await apiPost(`/api/admin/users/${encodeURIComponent(target.username)}/promote`);
      await loadUsers();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to promote user");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">User Management</h1>
          <p className="text-sm text-slate-500">
            Primary admin manages user lifecycle and promotions. Admins can view user states.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-600">
          <ShieldCheck size={14} />
          {isPrimaryAdmin ? "Primary Admin Mode" : "Admin Read-Only"}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      <form className="rounded-2xl border border-slate-200 bg-slate-50 p-4" onSubmit={handleCreateUser}>
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <UserPlus size={16} />
          Create User
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_180px_auto]">
          <input
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-cyan-600/50 focus:ring-2"
            placeholder="username"
            value={newUsername}
            onChange={(event) => setNewUsername(event.target.value)}
            disabled={!isPrimaryAdmin || busy}
            required
          />
          <input
            type="password"
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-cyan-600/50 focus:ring-2"
            placeholder="strong password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            disabled={!isPrimaryAdmin || busy}
            required
          />
          <select
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-cyan-600/50 focus:ring-2"
            value={newRole}
            onChange={(event) => setNewRole(event.target.value as UserRole)}
            disabled={!isPrimaryAdmin || busy}
          >
            {CREATION_ROLES.filter((role) => canCreateRole(role)).map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={!isPrimaryAdmin || busy}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Saving..." : "Create"}
          </button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3">Username</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Reset Password</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {loading ? (
              <tr>
                <td className="px-4 py-6 text-slate-500" colSpan={5}>
                  Loading users...
                </td>
              </tr>
            ) : sortedUsers.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-slate-500" colSpan={5}>
                  No users found.
                </td>
              </tr>
            ) : (
              sortedUsers.map((managedUser) => {
                const isProtected = managedUser.role === "primary_admin";

                return (
                  <tr key={managedUser.username}>
                    <td className="px-4 py-3 font-semibold text-slate-800">{managedUser.username}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                        {managedUser.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          managedUser.isActive
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {managedUser.isActive ? "active" : "deactivated"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {isPrimaryAdmin && !isProtected ? (
                        <div className="flex min-w-[230px] gap-2">
                          <input
                            type="password"
                            className="w-full rounded-lg border border-slate-300 px-2 py-1 text-xs outline-none ring-cyan-600/50 focus:ring-2"
                            placeholder="new password"
                            value={passwordDrafts[managedUser.username] ?? ""}
                            onChange={(event) =>
                              setPasswordDrafts((prev) => ({
                                ...prev,
                                [managedUser.username]: event.target.value,
                              }))
                            }
                          />
                          <button
                            className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                            onClick={() => void handlePasswordUpdate(managedUser.username)}
                            disabled={busy}
                            type="button"
                          >
                            Save
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">Not available</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isPrimaryAdmin && !isProtected ? (
                        <div className="flex flex-wrap gap-2">
                          {managedUser.role === "user" && (
                            <button
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                              onClick={() => void handlePromote(managedUser)}
                              type="button"
                              disabled={busy}
                            >
                              <UserCog size={12} />
                              Promote
                            </button>
                          )}
                          <button
                            className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                            onClick={() => void handleToggleActive(managedUser)}
                            type="button"
                            disabled={busy}
                          >
                            {managedUser.isActive ? "Deactivate" : "Activate"}
                          </button>
                          <button
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                            onClick={() => void handleDeleteUser(managedUser)}
                            type="button"
                            disabled={busy}
                          >
                            <UserRoundX size={12} />
                            Delete
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">
                          {isProtected ? "Protected account" : "Read-only"}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
