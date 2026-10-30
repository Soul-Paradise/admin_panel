import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Filter, Search, UserCheck, UserX, Users as UsersIcon } from 'lucide-react';
import { api, type User, type UserRole, type PaginatedUsers } from '../lib/api';
import { useAccess } from '../hooks/useAccess';
import { Alert, Badge, EmptyState, HeroStat, PageHeader, Pagination, Panel, Spinner } from '../components/ui';
import { INPUT, PAGE, SELECT, TABLE_HEAD, TBODY, TH, TROW, type Tone } from '../lib/ui-styles';

const ROLES: UserRole[] = ['USER', 'AGENT', 'ADMIN'];

// AGENT is filterable but NOT directly assignable. The role only works alongside
// an approved AgentProfile - granting it here would leave the user with no
// profile, and the login gate fails closed on exactly that, locking them out.
// Agents are promoted by approving their application on the Agents page.
const ASSIGNABLE_ROLES: UserRole[] = ['USER', 'ADMIN'];

const roleTone: Record<UserRole, Tone> = {
  USER: 'green',
  AGENT: 'amber',
  ADMIN: 'purple',
  SUPER_ADMIN: 'blue',
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

  const activeOnPage = data?.users.filter((u) => u.isActive).length ?? 0;

  return (
    <div className={PAGE}>
      <PageHeader
        eyebrow="People"
        title="User Details"
        subtitle="Customer accounts and ticket history"
        note={!editable ? 'You have read-only access to this page.' : undefined}
        stats={
          <>
            <HeroStat icon={UsersIcon} label={search || roleFilter ? 'Matching users' : 'Total users'} value={data ? data.pagination.total.toLocaleString('en-IN') : null} />
            <HeroStat icon={UserCheck} label="Active on this page" value={data && !loading ? activeOnPage.toLocaleString('en-IN') : null} />
            <HeroStat icon={Filter} label="Showing" value={roleFilter || 'All roles'} />
          </>
        }
      />

      {message && (
        <div className="mb-4">
          <Alert tone={message.type} onClose={() => setMessage(null)}>
            {message.text}
          </Alert>
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-inactive" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${INPUT} pl-10`}
          />
        </div>
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className={`${SELECT} sm:w-44`}>
          <option value="">All Roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <Panel
        title="All users"
        aside={data && <span className="text-xs font-semibold text-inactive">{data.pagination.total} total</span>}
        flush
      >
        {loading ? (
          <Spinner label="Loading users…" />
        ) : !data?.users.length ? (
          <EmptyState icon={UserX} title="No users found" message="Try a different name, email or role." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px]">
              <thead className={TABLE_HEAD}>
                <tr className="border-b border-tertiary-button">
                  <th className={TH}>User</th>
                  <th className={TH}>Provider</th>
                  <th className={TH}>Status</th>
                  <th className={TH}>Current Role</th>
                  <th className={TH}>Assign Role</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className={TBODY}>
                {data.users.map((user) => (
                  <tr key={user.id} onClick={() => navigate(`/users/${user.id}`)} className={`group cursor-pointer ${TROW}`}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-button text-sm font-bold text-peace">
                          {user.profilePicture ? (
                            <img src={user.profilePicture} alt="" className="h-9 w-9 rounded-full object-cover" />
                          ) : (
                            user.name.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-foreground">{user.name}</p>
                          <p className="truncate text-xs text-inactive">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm text-inactive capitalize">{user.provider.toLowerCase()}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge tone={user.isActive ? 'green' : 'red'} dot>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge tone={roleTone[user.role]}>{user.role}</Badge>
                    </td>
                    {/* The row navigates on click, so the control inside it must not
                        bubble - changing a role should never also change the page. */}
                    <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                      {user.role === 'AGENT' ? (
                        // Rendering a <select> here would be actively dangerous: its
                        // value (AGENT) isn't among the options, so the browser would
                        // display "USER" and a stray click would demote a verified agent.
                        <span className="text-xs text-inactive">Managed on Booking Partners</span>
                      ) : user.role === 'SUPER_ADMIN' ? (
                        // Same hazard as AGENT above, with a worse blast radius: a
                        // super admin is the only account that can grant page access,
                        // so a mis-click that demoted one could leave nobody able to
                        // administer the panel. The role is not assignable from here
                        // at all - the backend refuses it too.
                        <span className="text-xs text-inactive">Super admin - not editable</span>
                      ) : (
                        <select
                          value={user.role}
                          onChange={(e) => handleRoleChange(user, e.target.value as UserRole)}
                          disabled={!editable || updatingId === user.id}
                          className={`${SELECT} w-32 !py-1.5`}
                        >
                          {ASSIGNABLE_ROLES.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="inline-flex items-center gap-0.5 text-sm font-bold text-links">
                        Details
                        <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && data.pagination.totalPages > 1 && (
          <Pagination page={page} totalPages={data.pagination.totalPages} total={data.pagination.total} onPage={setPage} />
        )}
      </Panel>
    </div>
  );
}
