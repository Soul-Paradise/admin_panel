import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type User, type UserRole, type PaginatedUsers } from '../lib/api';
import { useAccess } from '../hooks/useAccess';

const ROLES: UserRole[] = ['USER', 'AGENT', 'ADMIN'];

// AGENT is filterable but NOT directly assignable. The role only works alongside
// an approved AgentProfile — granting it here would leave the user with no
// profile, and the login gate fails closed on exactly that, locking them out.
// Agents are promoted by approving their application on the Agents page.
const ASSIGNABLE_ROLES: UserRole[] = ['USER', 'ADMIN'];

const roleBadgeColors: Record<UserRole, string> = {
  USER: 'bg-green-500/15 text-green-400 border-green-500/30',
  AGENT: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  ADMIN: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  SUPER_ADMIN: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
};

export default function Users() {
  const navigate = useNavigate();
  const { canWrite } = useAccess();
  const editable = canWrite('USERS');

  const [data, setData] = useState<PaginatedUsers | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.getUsers({ search: search || undefined, role: roleFilter || undefined, page, limit: 15 });
      setData(result);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, page]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, roleFilter]);

  const handleRoleChange = async (user: User, newRole: UserRole) => {
    if (user.role === newRole) return;

    setUpdatingId(user.id);
    setMessage(null);
    try {
      await api.updateUserRole(user.id, newRole);
      setMessage({ type: 'success', text: `${user.name}'s role updated to ${newRole}` });
      await fetchUsers();
    } catch {
      setMessage({ type: 'error', text: `Failed to update role for ${user.name}` });
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">User Details</h1>
        <p className="text-sm text-gray-500 mt-0.5">Customer accounts and ticket history</p>
        {!editable && (
          <p className="text-xs text-gray-600 mt-2">You have read-only access to this page.</p>
        )}
      </div>

      {/* Message banner */}
      {message && (
        <div
          className={`mb-4 p-3 rounded-lg text-sm flex justify-between items-center ${
            message.type === 'success'
              ? 'bg-green-500/10 border border-green-500/30 text-green-400'
              : 'bg-red-500/10 border border-red-500/30 text-red-400'
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="hover:opacity-75 ml-2">&times;</button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">All Roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">User</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Provider</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Status</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Current Role</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Assign Role</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-gray-500">Loading...</td>
                </tr>
              ) : !data?.users.length ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-gray-500">No users found</td>
                </tr>
              ) : (
                data.users.map((user) => (
                  <tr
                    key={user.id}
                    onClick={() => navigate(`/users/${user.id}`)}
                    className="cursor-pointer hover:bg-gray-800/30 transition-colors"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-gray-700 rounded-full flex items-center justify-center text-white text-sm font-medium shrink-0">
                          {user.profilePicture ? (
                            <img src={user.profilePicture} alt="" className="w-9 h-9 rounded-full object-cover" />
                          ) : (
                            user.name.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white truncate">{user.name}</p>
                          <p className="text-xs text-gray-500 truncate">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-gray-400 capitalize">{user.provider.toLowerCase()}</span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`inline-block w-2 h-2 rounded-full ${user.isActive ? 'bg-green-400' : 'bg-red-400'}`} />
                        <span className="text-sm text-gray-400">{user.isActive ? 'Active' : 'Inactive'}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full border ${roleBadgeColors[user.role]}`}>
                        {user.role}
                      </span>
                    </td>
                    {/* The row navigates on click, so the control inside it must not
                        bubble — changing a role should never also change the page. */}
                    <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
                      {user.role === 'AGENT' ? (
                        // Rendering a <select> here would be actively dangerous: its
                        // value (AGENT) isn't among the options, so the browser would
                        // display "USER" and a stray click would demote a verified agent.
                        <span className="text-xs text-gray-500">
                          Managed on Booking Partners
                        </span>
                      ) : user.role === 'SUPER_ADMIN' ? (
                        // Same hazard as AGENT above, with a worse blast radius: a
                        // super admin is the only account that can grant page access,
                        // so a mis-click that demoted one could leave nobody able to
                        // administer the panel. The role is not assignable from here
                        // at all — the backend refuses it too.
                        <span className="text-xs text-gray-500">
                          Super admin — not editable
                        </span>
                      ) : (
                        <select
                          value={user.role}
                          onChange={(e) => handleRoleChange(user, e.target.value as UserRole)}
                          disabled={!editable || updatingId === user.id}
                          className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {ASSIGNABLE_ROLES.map((r) => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors">
                        Details →
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-800">
            <p className="text-sm text-gray-500">
              Showing {(data.pagination.page - 1) * data.pagination.limit + 1} - {Math.min(data.pagination.page * data.pagination.limit, data.pagination.total)} of {data.pagination.total}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-sm bg-gray-800 text-gray-400 rounded-lg hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= data.pagination.totalPages}
                className="px-3 py-1.5 text-sm bg-gray-800 text-gray-400 rounded-lg hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
