import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export default function Dashboard() {
  const [stats, setStats] = useState<{ total: number; customers: number; agents: number; admins: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [all, customers, agents, admins] = await Promise.all([
          api.getUsers({ limit: 1 }),
          api.getUsers({ role: 'CUSTOMER', limit: 1 }),
          api.getUsers({ role: 'AGENT', limit: 1 }),
          api.getUsers({ role: 'ADMIN', limit: 1 }),
        ]);
        setStats({
          total: all.pagination.total,
          customers: customers.pagination.total,
          agents: agents.pagination.total,
          admins: admins.pagination.total,
        });
      } catch (err) {
        console.error('Failed to fetch stats:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  const cards = stats
    ? [
        { label: 'Total Users', value: stats.total, color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
        { label: 'Customers', value: stats.customers, color: 'bg-green-500/15 text-green-400 border-green-500/30' },
        { label: 'Agents', value: stats.agents, color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
        { label: 'Admins', value: stats.admins, color: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
      ]
    : [];

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-white mb-8">Dashboard</h1>

      {loading ? (
        <div className="text-gray-500">Loading stats...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {cards.map((card) => (
            <div key={card.label} className={`p-6 rounded-xl border ${card.color}`}>
              <p className="text-sm opacity-75 mb-1">{card.label}</p>
              <p className="text-3xl font-bold">{card.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
