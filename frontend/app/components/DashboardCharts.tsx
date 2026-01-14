'use client';
import { useState, useEffect } from 'react';
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LineChart, Line, Area, AreaChart,
  RadialBarChart, RadialBar
} from 'recharts';
import { 
  TrendingUp, TrendingDown, DollarSign, Users, FileCheck, 
  AlertTriangle, CheckCircle, Clock, XCircle, Wallet,
  ArrowUpRight, ArrowDownRight, Activity, PieChart as PieIcon,
  BarChart2, RefreshCw
} from 'lucide-react';

// Color palette matching the app theme
const COLORS = {
  primary: '#00F5D4',
  secondary: '#00BBF9',
  accent: '#9B5DE5',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#3B82F6',
  muted: 'rgba(255,255,255,0.5)'
};

const STATUS_COLORS = {
  active: COLORS.success,
  pending: COLORS.warning,
  approved: COLORS.primary,
  denied: COLORS.danger,
  defaulted: '#DC2626',
  settled: COLORS.secondary
};

// Mock data - In production, this would come from API
const generateMockData = () => {
  const loanStatusData = [
    { name: 'Active', value: 45, color: STATUS_COLORS.active },
    { name: 'Pending', value: 12, color: STATUS_COLORS.pending },
    { name: 'Approved', value: 28, color: STATUS_COLORS.approved },
    { name: 'Denied', value: 8, color: STATUS_COLORS.denied },
    { name: 'Defaulted', value: 4, color: STATUS_COLORS.defaulted },
    { name: 'Settled', value: 23, color: STATUS_COLORS.settled },
  ];

  const riskDistribution = [
    { range: '0-20%', count: 35, risk: 'Low' },
    { range: '21-40%', count: 28, risk: 'Low-Med' },
    { range: '41-60%', count: 22, risk: 'Medium' },
    { range: '61-80%', count: 12, risk: 'Med-High' },
    { range: '81-100%', count: 3, risk: 'High' },
  ];

  const monthlyTrends = [
    { month: 'Jul', applications: 45, approved: 38, disbursed: 35, volume: 12.5 },
    { month: 'Aug', applications: 52, approved: 44, disbursed: 41, volume: 15.2 },
    { month: 'Sep', applications: 48, approved: 40, disbursed: 38, volume: 14.1 },
    { month: 'Oct', applications: 61, approved: 52, disbursed: 48, volume: 18.7 },
    { month: 'Nov', applications: 58, approved: 49, disbursed: 45, volume: 17.3 },
    { month: 'Dec', applications: 72, approved: 61, disbursed: 55, volume: 22.8 },
    { month: 'Jan', applications: 68, approved: 58, disbursed: 52, volume: 21.4 },
  ];

  const portfolioMetrics = {
    totalLoans: 120,
    totalValue: 458000000,
    avgLoanSize: 3816667,
    defaultRate: 3.3,
    approvalRate: 84.7,
    avgProcessingDays: 4.2,
    activeWalletBalance: 125000000,
    expenseWalletBalance: 8500000,
  };

  const recentTransactions = [
    { id: 1, type: 'disbursement', borrower: 'Acme Corp', amount: 5000000, date: '2026-01-13', status: 'completed' },
    { id: 2, type: 'repayment', borrower: 'TechStart Inc', amount: 250000, date: '2026-01-12', status: 'completed' },
    { id: 3, type: 'application', borrower: 'Global Trade Ltd', amount: 8000000, date: '2026-01-12', status: 'pending' },
    { id: 4, type: 'approval', borrower: 'SafeHaven LLC', amount: 3500000, date: '2026-01-11', status: 'approved' },
    { id: 5, type: 'transfer', borrower: 'Internal', amount: 1000000, date: '2026-01-10', status: 'completed' },
  ];

  const performanceRadial = [
    { name: 'Approval Rate', value: 84.7, fill: COLORS.primary },
    { name: 'On-Time Payments', value: 92.3, fill: COLORS.success },
    { name: 'Portfolio Health', value: 96.7, fill: COLORS.secondary },
  ];

  return { loanStatusData, riskDistribution, monthlyTrends, portfolioMetrics, recentTransactions, performanceRadial };
};

// Custom tooltip for charts
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: 'rgba(10, 22, 40, 0.95)',
        border: '1px solid rgba(0, 245, 212, 0.3)',
        borderRadius: 8,
        padding: '12px 16px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
      }}>
        <p style={{ color: '#fff', fontWeight: 600, marginBottom: 8 }}>{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} style={{ color: entry.color, fontSize: 13 }}>
            {entry.name}: {typeof entry.value === 'number' && entry.value > 1000 
              ? `$${(entry.value / 1000000).toFixed(1)}M` 
              : entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// Stat Card Component
const StatCard = ({ title, value, change, changeType, icon: Icon, color }: {
  title: string;
  value: string;
  change?: string;
  changeType?: 'up' | 'down';
  icon: any;
  color: string;
}) => (
  <div className="card" style={{ 
    background: `linear-gradient(135deg, var(--bg-card) 0%, ${color}10 100%)`,
    borderLeft: `3px solid ${color}`
  }}>
    <div className="flex justify-between items-start">
      <div>
        <p className="small opacity-60 mb-xs">{title}</p>
        <p className="h2" style={{ color }}>{value}</p>
        {change && (
          <div className="flex items-center gap-xs mt-sm">
            {changeType === 'up' ? (
              <ArrowUpRight size={14} style={{ color: COLORS.success }} />
            ) : (
              <ArrowDownRight size={14} style={{ color: COLORS.danger }} />
            )}
            <span className="small" style={{ color: changeType === 'up' ? COLORS.success : COLORS.danger }}>
              {change}
            </span>
            <span className="small opacity-50">vs last month</span>
          </div>
        )}
      </div>
      <div style={{ 
        background: `${color}20`, 
        padding: 12, 
        borderRadius: 12 
      }}>
        <Icon size={24} style={{ color }} />
      </div>
    </div>
  </div>
);

// Transaction Row Component
const TransactionRow = ({ tx }: { tx: any }) => {
  const icons: Record<string, any> = {
    disbursement: DollarSign,
    repayment: ArrowUpRight,
    application: FileCheck,
    approval: CheckCircle,
    transfer: RefreshCw
  };
  const Icon = icons[tx.type] || Activity;
  
  const statusColors: Record<string, string> = {
    completed: COLORS.success,
    pending: COLORS.warning,
    approved: COLORS.primary
  };

  return (
    <div className="flex items-center justify-between py-sm" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
      <div className="flex items-center gap-md">
        <div style={{ 
          background: `${statusColors[tx.status]}20`, 
          padding: 8, 
          borderRadius: 8 
        }}>
          <Icon size={18} style={{ color: statusColors[tx.status] }} />
        </div>
        <div>
          <p className="font-medium">{tx.borrower}</p>
          <p className="small opacity-50 capitalize">{tx.type}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="font-mono font-semibold" style={{ color: tx.type === 'repayment' ? COLORS.success : COLORS.primary }}>
          {tx.type === 'repayment' ? '+' : ''}${(tx.amount / 1000000).toFixed(2)}M
        </p>
        <p className="small opacity-50">{tx.date}</p>
      </div>
    </div>
  );
};

export default function DashboardCharts() {
  const [data, setData] = useState<ReturnType<typeof generateMockData> | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeChart, setActiveChart] = useState<'status' | 'risk' | 'trends'>('status');

  useEffect(() => {
    // Simulate API call
    setTimeout(() => {
      setData(generateMockData());
      setLoading(false);
    }, 500);
  }, []);

  if (loading || !data) {
    return (
      <div className="space-y-lg">
        <div className="grid grid-cols-4 gap-md">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card skeleton" style={{ height: 120 }} />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-lg">
          <div className="card skeleton" style={{ height: 350 }} />
          <div className="card skeleton" style={{ height: 350 }} />
        </div>
      </div>
    );
  }

  const { loanStatusData, riskDistribution, monthlyTrends, portfolioMetrics, recentTransactions, performanceRadial } = data;

  return (
    <div className="space-y-lg">
      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-md">
        <StatCard 
          title="Total Portfolio Value"
          value={`$${(portfolioMetrics.totalValue / 1000000).toFixed(0)}M`}
          change="+12.5%"
          changeType="up"
          icon={DollarSign}
          color={COLORS.primary}
        />
        <StatCard 
          title="Active Loans"
          value={portfolioMetrics.totalLoans.toString()}
          change="+8 loans"
          changeType="up"
          icon={FileCheck}
          color={COLORS.secondary}
        />
        <StatCard 
          title="Approval Rate"
          value={`${portfolioMetrics.approvalRate}%`}
          change="+2.3%"
          changeType="up"
          icon={CheckCircle}
          color={COLORS.success}
        />
        <StatCard 
          title="Default Rate"
          value={`${portfolioMetrics.defaultRate}%`}
          change="-0.5%"
          changeType="down"
          icon={AlertTriangle}
          color={COLORS.warning}
        />
      </div>

      {/* Charts Row */}
      <div className="grid gap-lg" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {/* Loan Status Distribution */}
        <div className="card">
          <div className="flex justify-between items-center mb-md">
            <h3 className="h3 flex items-center gap-sm">
              <PieIcon size={20} style={{ color: COLORS.primary }} />
              Loan Status Distribution
            </h3>
            <span className="badge small">{portfolioMetrics.totalLoans} Total</span>
          </div>
          <div style={{ height: 280, width: '100%', minWidth: 300 }}>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={loanStatusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={{ stroke: 'rgba(255,255,255,0.3)' }}
                >
                  {loanStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-md justify-center mt-sm">
            {loanStatusData.map((item, i) => (
              <div key={i} className="flex items-center gap-xs">
                <div style={{ width: 10, height: 10, borderRadius: 2, background: item.color }} />
                <span className="small opacity-70">{item.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Risk Score Distribution */}
        <div className="card">
          <div className="flex justify-between items-center mb-md">
            <h3 className="h3 flex items-center gap-sm">
              <BarChart2 size={20} style={{ color: COLORS.secondary }} />
              Risk Score Distribution
            </h3>
            <span className="badge small" style={{ background: COLORS.success + '30', color: COLORS.success }}>
              Avg: 38.2%
            </span>
          </div>
          <div style={{ height: 280, width: '100%', minWidth: 300 }}>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={riskDistribution} barSize={40}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="range" tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }} />
                <YAxis tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar 
                  dataKey="count" 
                  fill={COLORS.secondary}
                  radius={[4, 4, 0, 0]}
                  name="Loans"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Monthly Trends */}
      <div className="card">
        <div className="flex justify-between items-center mb-md">
          <h3 className="h3 flex items-center gap-sm">
            <TrendingUp size={20} style={{ color: COLORS.primary }} />
            Monthly Loan Trends
          </h3>
          <div className="flex gap-sm">
            <button className="btn secondary btn-sm">6M</button>
            <button className="btn primary btn-sm">1Y</button>
            <button className="btn secondary btn-sm">All</button>
          </div>
        </div>
        <div style={{ height: 300, width: '100%', minWidth: 400 }}>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={monthlyTrends}>
              <defs>
                <linearGradient id="colorApplications" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorApproved" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.success} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={COLORS.success} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="month" tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Area 
                type="monotone" 
                dataKey="applications" 
                stroke={COLORS.primary} 
                fillOpacity={1} 
                fill="url(#colorApplications)"
                name="Applications"
              />
              <Area 
                type="monotone" 
                dataKey="approved" 
                stroke={COLORS.success} 
                fillOpacity={1} 
                fill="url(#colorApproved)"
                name="Approved"
              />
              <Line 
                type="monotone" 
                dataKey="disbursed" 
                stroke={COLORS.secondary} 
                strokeWidth={2}
                dot={{ fill: COLORS.secondary, strokeWidth: 2 }}
                name="Disbursed"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom Row - Wallets & Transactions */}
      <div className="grid gap-lg" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
        {/* Wallet Summary */}
        <div className="card">
          <h3 className="h3 flex items-center gap-sm mb-md">
            <Wallet size={20} style={{ color: COLORS.accent }} />
            Wallet Summary
          </h3>
          <div className="space-y-md">
            <div className="p-md rounded-lg" style={{ background: 'var(--bg-primary)' }}>
              <div className="flex justify-between items-center mb-xs">
                <span className="small opacity-70">Loan Wallet</span>
                <span className="badge small" style={{ background: COLORS.success + '20', color: COLORS.success }}>Active</span>
              </div>
              <p className="h3" style={{ color: COLORS.primary }}>
                ${(portfolioMetrics.activeWalletBalance / 1000000).toFixed(1)}M
              </p>
              <div className="w-full h-1 rounded-full mt-sm" style={{ background: 'var(--bg-elevated)' }}>
                <div className="h-full rounded-full" style={{ width: '72%', background: COLORS.primary }} />
              </div>
            </div>
            <div className="p-md rounded-lg" style={{ background: 'var(--bg-primary)' }}>
              <div className="flex justify-between items-center mb-xs">
                <span className="small opacity-70">Expense Wallet</span>
                <span className="badge small">Operational</span>
              </div>
              <p className="h3" style={{ color: COLORS.secondary }}>
                ${(portfolioMetrics.expenseWalletBalance / 1000000).toFixed(1)}M
              </p>
              <div className="w-full h-1 rounded-full mt-sm" style={{ background: 'var(--bg-elevated)' }}>
                <div className="h-full rounded-full" style={{ width: '45%', background: COLORS.secondary }} />
              </div>
            </div>
            <button className="btn secondary w-full">
              <RefreshCw size={16} /> Transfer Funds
            </button>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="card">
          <h3 className="h3 flex items-center gap-sm mb-md">
            <Activity size={20} style={{ color: COLORS.success }} />
            Performance Metrics
          </h3>
          <div style={{ height: 200, width: '100%', minWidth: 200 }}>
            <ResponsiveContainer width="100%" height={200}>
              <RadialBarChart 
                cx="50%" 
                cy="50%" 
                innerRadius="30%" 
                outerRadius="90%" 
                barSize={12} 
                data={performanceRadial}
                startAngle={180}
                endAngle={0}
              >
                <RadialBar
                  background={{ fill: 'rgba(255,255,255,0.1)' }}
                  dataKey="value"
                  cornerRadius={6}
                />
                <Tooltip content={<CustomTooltip />} />
              </RadialBarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-around mt-sm">
            {performanceRadial.map((item, i) => (
              <div key={i} className="text-center">
                <p className="font-mono font-semibold" style={{ color: item.fill }}>{item.value}%</p>
                <p className="small opacity-50">{item.name}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="card">
          <div className="flex justify-between items-center mb-md">
            <h3 className="h3 flex items-center gap-sm">
              <Clock size={20} style={{ color: COLORS.warning }} />
              Recent Transactions
            </h3>
            <button className="btn-text small">View All</button>
          </div>
          <div className="space-y-0">
            {recentTransactions.slice(0, 4).map(tx => (
              <TransactionRow key={tx.id} tx={tx} />
            ))}
          </div>
        </div>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-6 gap-md">
        <div className="card text-center">
          <p className="h2" style={{ color: COLORS.primary }}>{portfolioMetrics.avgProcessingDays}</p>
          <p className="small opacity-50">Avg Processing Days</p>
        </div>
        <div className="card text-center">
          <p className="h2" style={{ color: COLORS.secondary }}>${(portfolioMetrics.avgLoanSize / 1000000).toFixed(1)}M</p>
          <p className="small opacity-50">Avg Loan Size</p>
        </div>
        <div className="card text-center">
          <p className="h2" style={{ color: COLORS.success }}>92.3%</p>
          <p className="small opacity-50">On-Time Payments</p>
        </div>
        <div className="card text-center">
          <p className="h2" style={{ color: COLORS.accent }}>4.8★</p>
          <p className="small opacity-50">Borrower Rating</p>
        </div>
        <div className="card text-center">
          <p className="h2" style={{ color: COLORS.warning }}>23</p>
          <p className="small opacity-50">Pending Reviews</p>
        </div>
        <div className="card text-center">
          <p className="h2" style={{ color: COLORS.info }}>156</p>
          <p className="small opacity-50">Total Borrowers</p>
        </div>
      </div>
    </div>
  );
}
