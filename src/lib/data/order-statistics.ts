import type { Order } from "./orders";

/** Shop orders have no payment ledger. These are order values, NOT paid revenue. */
export function orderStatistics(orders: Order[], now = new Date()) {
  const dayOf = (date: Date) => new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(date);
  const dateOf = (order: Order) => dayOf(new Date(order.createdAt));
  const accepted = (order: Order) => ["confirmed", "shipped", "delivered"].includes(order.status);
  const sum = (items: Order[]) => items.filter(accepted).reduce((total, order) => total + order.total.fa, 0);
  const days = Array.from({ length: 7 }, (_, i) => dayOf(new Date(now.getTime() - (6 - i) * 86400000)));
  const dailyRevenue = days.map((date) => {
    const items = orders.filter((order) => dateOf(order) === date);
    return { date, revenue: sum(items), count: items.length };
  });
  const statusCount = Object.fromEntries(
    ["pending", "confirmed", "shipped", "delivered", "cancelled"].map((status) => [status, orders.filter((order) => order.status === status).length]),
  );
  return {
    stats: {
      totalOrders: orders.length,
      pendingOrders: statusCount.pending,
      totalRevenue: sum(orders),
      todayRevenue: dailyRevenue.at(-1)?.revenue ?? 0,
      statusCount,
    },
    dailyRevenue,
    recentOrders: [...orders].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 8),
  };
}
