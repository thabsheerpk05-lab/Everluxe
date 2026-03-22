import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../api/client.js";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card.jsx";
import { Button } from "../components/ui/button.jsx";
import { Select } from "../components/ui/select.jsx";
import { Table, TableHead, TableRow, TableHeaderCell, TableCell } from "../components/ui/table.jsx";
import { formatCurrency } from "../utils/format.js";
import { exportIncomeStatementExcel } from "../utils/exportExcel.js";
import { exportIncomeStatementPdf } from "../utils/exportPdf.js";
import { cn } from "../utils/cn.js";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line,
  CartesianGrid
} from "recharts";
import { AlertTriangle, MapPin, Receipt, TrendingUp, Users, Wallet } from "lucide-react";
import { useToast } from "../context/ToastContext.jsx";

const formatCount = (value) => {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("en-US").format(value);
};

const getTrend = (current, previous, invert = false) => {
  if (current === null || current === undefined || previous === null || previous === undefined) {
    return null;
  }
  if (current === 0 && previous === 0) {
    return { label: "No change", tone: "neutral" };
  }
  if (previous === 0) {
    return { label: "New this month", tone: invert ? "negative" : "positive" };
  }
  const diff = current - previous;
  if (diff === 0) {
    return { label: "No change", tone: "neutral" };
  }
  const pct = Math.abs((diff / previous) * 100);
  const direction = diff > 0 ? "Up" : "Down";
  const isPositive = invert ? diff < 0 : diff > 0;
  return {
    label: `${direction} ${pct.toFixed(1)}% vs last month`,
    tone: isPositive ? "positive" : "negative"
  };
};

const getMargin = (profit, revenue) => {
  if (!revenue) return null;
  return (profit / revenue) * 100;
};

const trendStyles = {
  positive: "bg-oasis-100 text-oasis-700",
  negative: "bg-red-100 text-red-700",
  neutral: "bg-sand-100 text-sand-700"
};

const iconStyles = {
  oasis: "bg-oasis-100 text-oasis-700",
  sand: "bg-sand-100 text-sand-700",
  ink: "bg-ink/10 text-ink",
  danger: "bg-red-100 text-red-700"
};

const glowStyles = {
  oasis: "bg-oasis-100/70",
  sand: "bg-sand-100/70",
  ink: "bg-ink/10",
  danger: "bg-red-100/70"
};

function TrendPill({ trend, className }) {
  if (!trend) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold",
        trendStyles[trend.tone] || trendStyles.neutral,
        className
      )}
    >
      {trend.label}
    </span>
  );
}

function StatCard({ title, value, subtitle, icon: Icon, tone = "oasis", trend, isLoading }) {
  return (
    <Card className="relative overflow-hidden">
      <div
        className={cn(
          "pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full blur-2xl",
          glowStyles[tone] || glowStyles.oasis
        )}
      />
      <CardHeader className="flex items-start justify-between gap-3 pb-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sand-500">{title}</p>
        </div>
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", iconStyles[tone])}>
          <Icon size={18} />
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {isLoading ? (
          <div className="h-8 w-28 animate-pulse rounded-lg bg-sand-100" />
        ) : (
          <p className="text-2xl font-semibold text-ink">{value}</p>
        )}
        {subtitle ? <p className="text-xs text-sand-600">{subtitle}</p> : null}
        <TrendPill trend={trend} />
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value, trend, isLoading, children }) {
  return (
    <div className="rounded-2xl border border-sand-200 bg-white/80 p-4 shadow-soft">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sand-500">{label}</p>
      {isLoading ? (
        <div className="mt-3 h-6 w-24 animate-pulse rounded-lg bg-sand-100" />
      ) : (
        <p className="mt-2 text-xl font-semibold text-ink">{value}</p>
      )}
      {children}
      <TrendPill trend={trend} className="mt-2" />
    </div>
  );
}

export default function Dashboard() {
  const { toast } = useToast();
  const [data, setData] = useState(null);
  const [financial, setFinancial] = useState(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [statementMonth, setStatementMonth] = useState("ALL");
  const [error, setError] = useState("");
  const isLoading = !data && !error;

  useEffect(() => {
    const load = async () => {
      try {
        const summary = await apiFetch("/reports/summary");
        setData(summary);
      } catch (err) {
        setError(err.message);
        toast({ title: err.message, variant: "error" });
      }
    };
    load();
  }, [toast]);

  useEffect(() => {
    const loadFinancial = async () => {
      try {
        const report = await apiFetch(`/reports/financial?year=${year}`);
        setFinancial(report);
      } catch (err) {
        toast({ title: err.message, variant: "error" });
      }
    };
    loadFinancial();
  }, [year, toast]);

  const averageProfit = useMemo(() => {
    if (!data?.monthly?.length) return null;
    const total = data.monthly.reduce((sum, month) => sum + month.profit, 0);
    return total / data.monthly.length;
  }, [data]);

  const topRevenueMonth = useMemo(() => {
    if (!data?.monthly?.length) return null;
    return data.monthly.reduce((best, month) => (month.revenue > best.revenue ? month : best), data.monthly[0]);
  }, [data]);

  if (error) {
    return <div className="text-sm text-sand-600">Unable to load dashboard data.</div>;
  }

  const latestMonth = data?.monthly?.[data?.monthly.length - 1];
  const previousMonth = data?.monthly?.[data?.monthly.length - 2];
  const revenueTrend = getTrend(latestMonth?.revenue, previousMonth?.revenue);
  const expenseTrend = getTrend(latestMonth?.expenses, previousMonth?.expenses, true);
  const profitTrend = getTrend(latestMonth?.profit, previousMonth?.profit);
  const profitMargin = getMargin(latestMonth?.profit ?? 0, latestMonth?.revenue ?? 0);

  const overviewChips = [
    `Updated ${new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date())}`,
    "Last 12 months"
  ];

  const monthOptions = useMemo(
    () => [
      { label: "All months", value: "ALL" },
      ...Array.from({ length: 12 }, (_, idx) => ({
        label: new Date(2024, idx, 1).toLocaleString("en-GB", { month: "short" }),
        value: String(idx)
      }))
    ],
    []
  );

  const formatMonthLabel = (yearValue, monthIndex) => {
    const month = new Date(yearValue, monthIndex, 1).toLocaleString("en-GB", { month: "short" });
    const shortYear = String(yearValue).slice(-2);
    return `${month}-${shortYear}`;
  };

  const exportFinancial = () => {
    if (!financial) return;
    const baseMonths = financial.monthly.map((row, idx) => ({
      year: financial.year,
      monthIndex: idx,
      revenue: row.revenue,
      expenses: row.expenses,
      profit: row.profit,
      internalRevenue: row.internalRevenue,
      externalRevenue: row.externalRevenue,
      expenseByCategory: row.expenseByCategory
    }));
    const selectedMonths =
      statementMonth === "ALL"
        ? baseMonths
        : baseMonths.filter((_, idx) => String(idx) === String(statementMonth));
    const suffix =
      statementMonth === "ALL"
        ? String(financial.year)
        : `${financial.year}-${formatMonthLabel(financial.year, Number(statementMonth))}`;
    exportIncomeStatementExcel(`Profit-Loss-${suffix}.xlsx`, selectedMonths, {
      headerTitle: "WADINOOR",
      title: "PROFIT AND LOSS A/C"
    });
  };

  const exportFinancialPdf = () => {
    if (!financial) return;
    const baseMonths = financial.monthly.map((row, idx) => ({
      year: financial.year,
      monthIndex: idx,
      revenue: row.revenue,
      expenses: row.expenses,
      profit: row.profit,
      internalRevenue: row.internalRevenue,
      externalRevenue: row.externalRevenue,
      expenseByCategory: row.expenseByCategory
    }));
    const selectedMonths =
      statementMonth === "ALL"
        ? baseMonths
        : baseMonths.filter((_, idx) => String(idx) === String(statementMonth));
    const suffix =
      statementMonth === "ALL"
        ? String(financial.year)
        : `${financial.year}-${formatMonthLabel(financial.year, Number(statementMonth))}`;
    exportIncomeStatementPdf(`Profit-Loss-${suffix}.pdf`, selectedMonths, {
      headerTitle: "WADINOOR",
      title: "PROFIT AND LOSS A/C"
    });
  };

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl border border-sand-200 bg-white/80 p-6 shadow-soft backdrop-blur">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-oasis-50/80 via-white/70 to-sand-100/70" />
        <div className="relative grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-sand-500">Overview</p>
              <h1 className="font-display text-4xl text-ink">WadiNoor Dashboard</h1>
              <p className="mt-2 text-sm text-sand-700">Live overview of trips, travelers, and finance signals.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {overviewChips.map((chip) => (
                <span
                  key={chip}
                  className="rounded-full border border-sand-200 bg-white/80 px-3 py-1 text-xs font-semibold text-sand-600"
                >
                  {chip}
                </span>
              ))}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <MiniStat
              label={`${latestMonth?.month || "Current month"} revenue`}
              value={formatCurrency(latestMonth?.revenue)}
              trend={revenueTrend}
              isLoading={isLoading}
            />
            <MiniStat
              label={`${latestMonth?.month || "Current month"} profit`}
              value={formatCurrency(latestMonth?.profit)}
              trend={profitTrend}
              isLoading={isLoading}
            >
              {profitMargin !== null ? (
                <div className="mt-3">
                  <div className="h-2 w-full rounded-full bg-sand-100">
                    <div
                      className={cn(
                        "h-2 rounded-full",
                        profitMargin >= 0 ? "bg-oasis-500" : "bg-red-500"
                      )}
                      style={{ width: `${Math.min(Math.abs(profitMargin), 100)}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-sand-600">{Math.abs(profitMargin).toFixed(1)}% margin</p>
                </div>
              ) : null}
            </MiniStat>
            <MiniStat
              label={`${latestMonth?.month || "Current month"} expenses`}
              value={formatCurrency(latestMonth?.expenses)}
              trend={expenseTrend}
              isLoading={isLoading}
            >
              <p className="mt-2 text-xs text-sand-600">Operating spend this month</p>
            </MiniStat>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <StatCard
          title="Total Trips"
          value={formatCount(data?.totals.totalTrips)}
          subtitle="Active in system"
          icon={MapPin}
          tone="oasis"
          isLoading={isLoading}
        />
        <StatCard
          title="Total Travelers"
          value={formatCount(data?.totals.totalTravelers)}
          subtitle="Registered travelers"
          icon={Users}
          tone="sand"
          isLoading={isLoading}
        />
        <StatCard
          title="Total Revenue"
          value={formatCurrency(data?.totals.totalRevenue)}
          subtitle="Collected to date"
          icon={Wallet}
          tone="oasis"
          trend={revenueTrend}
          isLoading={isLoading}
        />
        <StatCard
          title="Total Expenses"
          value={formatCurrency(data?.totals.totalExpenses)}
          subtitle="Operational costs"
          icon={Receipt}
          tone="sand"
          trend={expenseTrend}
          isLoading={isLoading}
        />
        <StatCard
          title="Net Profit"
          value={formatCurrency(data?.totals.netProfit)}
          subtitle="After expenses"
          icon={TrendingUp}
          tone="ink"
          trend={profitTrend}
          isLoading={isLoading}
        />
        <StatCard
          title="Unpaid Amount"
          value={formatCurrency(data?.totals.totalUnpaid)}
          subtitle="Needs settlement"
          icon={AlertTriangle}
          tone="danger"
          isLoading={isLoading}
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card className="relative h-[380px] overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/70 via-white/60 to-oasis-50/60" />
          <CardHeader className="relative space-y-2">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <CardTitle>Monthly Revenue vs Expenses</CardTitle>
                <p className="text-xs text-sand-600">Track cash flow over the last 12 months.</p>
              </div>
              <div className="flex items-center gap-4 text-xs font-semibold text-sand-600">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-oasis-500" />
                  Revenue
                </span>
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-sand-400" />
                  Expenses
                </span>
              </div>
            </div>
            {topRevenueMonth ? (
              <p className="text-xs text-sand-600">
                Strongest month: {topRevenueMonth.month} ({formatCurrency(topRevenueMonth.revenue)})
              </p>
            ) : null}
          </CardHeader>
          <CardContent className="relative h-[280px]">
            {isLoading ? (
              <div className="flex h-full items-center justify-center text-sm text-sand-500">
                Loading monthly revenue...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.monthly || []} barGap={10} barSize={16}>
                  <defs>
                    <linearGradient id="revenueGradient" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#3ea784" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#3ea784" stopOpacity={0.4} />
                    </linearGradient>
                    <linearGradient id="expenseGradient" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#b9925c" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#b9925c" stopOpacity={0.4} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" stroke="#e4d4ba" />
                  <XAxis dataKey="month" tick={{ fill: "#7c5f38", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#7c5f38", fontSize: 11 }} />
                  <Tooltip
                    formatter={(value) => formatCurrency(value)}
                    contentStyle={{
                      borderRadius: "12px",
                      border: "1px solid #e4d4ba",
                      boxShadow: "0 12px 30px rgba(17, 24, 39, 0.12)"
                    }}
                  />
                  <Bar dataKey="revenue" fill="url(#revenueGradient)" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="expenses" fill="url(#expenseGradient)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card className="relative h-[380px] overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/70 via-white/60 to-sand-50/70" />
          <CardHeader className="relative space-y-2">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <CardTitle>Profit Trend</CardTitle>
                <p className="text-xs text-sand-600">Monthly net performance and stability.</p>
              </div>
              {averageProfit !== null ? (
                <div className="rounded-full border border-sand-200 bg-white/80 px-3 py-1 text-xs font-semibold text-sand-600">
                  Avg {formatCurrency(averageProfit)}
                </div>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="relative h-[280px]">
            {isLoading ? (
              <div className="flex h-full items-center justify-center text-sm text-sand-500">
                Loading profit trend...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data?.monthly || []}>
                  <defs>
                    <linearGradient id="profitGradient" x1="0" x2="1" y1="0" y2="0">
                      <stop offset="0%" stopColor="#1f2328" stopOpacity={0.8} />
                      <stop offset="100%" stopColor="#3ea784" stopOpacity={0.9} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" stroke="#e4d4ba" />
                  <XAxis dataKey="month" tick={{ fill: "#7c5f38", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#7c5f38", fontSize: 11 }} />
                  <Tooltip
                    formatter={(value) => formatCurrency(value)}
                    contentStyle={{
                      borderRadius: "12px",
                      border: "1px solid #e4d4ba",
                      boxShadow: "0 12px 30px rgba(17, 24, 39, 0.12)"
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="profit"
                    stroke="url(#profitGradient)"
                    strokeWidth={3}
                    dot={{ r: 3, fill: "#1f2328" }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle>Financial Reports</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <label className="text-xs font-semibold text-sand-600">Year</label>
                <Select value={year} onChange={(e) => setYear(Number(e.target.value))}>
                  {[year - 1, year, year + 1].map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </Select>
                <label className="text-xs font-semibold text-sand-600">Month</label>
                <Select value={statementMonth} onChange={(e) => setStatementMonth(e.target.value)}>
                  {monthOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={exportFinancialPdf} disabled={!financial}>
                  Export PDF
                </Button>
                <Button variant="outline" onClick={exportFinancial} disabled={!financial}>
                  Export Excel
                </Button>
              </div>
            </div>
            {financial ? (
              <div className="mt-4 space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-xl border border-sand-200 bg-white/80 p-4">
                    <p className="text-xs text-sand-600">Total Revenue</p>
                    <p className="text-xl font-semibold">{formatCurrency(financial.totalRevenue)}</p>
                  </div>
                  <div className="rounded-xl border border-sand-200 bg-white/80 p-4">
                    <p className="text-xs text-sand-600">Total Expenses</p>
                    <p className="text-xl font-semibold">{formatCurrency(financial.totalExpenses)}</p>
                  </div>
                  <div className="rounded-xl border border-sand-200 bg-white/80 p-4">
                    <p className="text-xs text-sand-600">Net Profit</p>
                    <p className="text-xl font-semibold">{formatCurrency(financial.netProfit)}</p>
                  </div>
                </div>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell>Month</TableHeaderCell>
                      <TableHeaderCell>Revenue</TableHeaderCell>
                      <TableHeaderCell>Expenses</TableHeaderCell>
                      <TableHeaderCell>Profit</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <tbody>
                    {financial.monthly.map((row) => (
                      <TableRow key={row.month}>
                        <TableCell>{row.month}</TableCell>
                        <TableCell>{formatCurrency(row.revenue)}</TableCell>
                        <TableCell>{formatCurrency(row.expenses)}</TableCell>
                        <TableCell>{formatCurrency(row.profit)}</TableCell>
                      </TableRow>
                    ))}
                  </tbody>
                </Table>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}



