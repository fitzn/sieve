import { LoggedRequest, SieveAnalytics, SieveDailyStats, SieveMonthlyStats } from './Model';
import { SieveFilter } from './SieveFilter';

const MAX_SESSION_MS = 30 * 60 * 1000;

export class SieveAnalyzer {
  private state: State;

  constructor(private filter: SieveFilter) {
    this.state = {
      visitorsByDate: new Map(),
      referersByMonth: new Map(),
      pagesByMonth: new Map()
    };
  }

  ingest(request: LoggedRequest): void {
    const date = request.date;
    const formattedDate = formatDate(date);
    const month = formatMonth(date);
    const timestamp = parseDateTime(formattedDate, request.time);

    if (this.filter.isBlocked(request)) {
      return;
    }

    // Update metrics based on the visitor (if present).
    if (request.c_ip) {
      const clientIP = request.c_ip;
      
      if (!this.state.visitorsByDate.has(date.toDateString())) {
        this.state.visitorsByDate.set(date.toDateString(), {
          requestsByVisitor: new Map()
        });
      }

      const visitorsLog = this.state.visitorsByDate.get(date.toDateString())!;
      const knownTimestamps = visitorsLog.requestsByVisitor.get(clientIP)?.timestamps ?? [];

      const timestamps = knownTimestamps.includes(timestamp)
        ? knownTimestamps
        : [...knownTimestamps, timestamp].sort((a, b) => a - b);

      visitorsLog.requestsByVisitor.set(clientIP, { timestamps });
    }

    // Update metrics based on the referrer (if present).
    if (request.cs_referer) {
      const referer = request.cs_referer;
      let refererDomain = referer;
      
      try {
        const url = new URL(referer);
        refererDomain = url.hostname;
      } catch (e) {
        // If URL parsing fails, use the referer as-is
      }

      if (!this.state.referersByMonth.has(month)) {
        this.state.referersByMonth.set(month, {
          countByDomain: new Map()
        });
      }

      const refererLog = this.state.referersByMonth.get(month)!;
      const count = refererLog.countByDomain.get(refererDomain) ?? 0;
      refererLog.countByDomain.set(refererDomain, count + 1);
    }

    // Update metrics based on the page.
    const page = request.cs_uri_stem;
    
    if (!this.state.pagesByMonth.has(month)) {
      this.state.pagesByMonth.set(month, {
        countByPage: new Map()
      });
    }

    const pageLog = this.state.pagesByMonth.get(month)!;
    const count = pageLog.countByPage.get(page) ?? 0;
    pageLog.countByPage.set(page, count + 1);
  }

  compute(): SieveAnalytics {
    const dailyStats: SieveDailyStats[] = Array.from(this.state.visitorsByDate.entries())
      .map(([dateStr, visitorsLog]) => {
        const sessions = Array.from(visitorsLog.requestsByVisitor.values())
          .flatMap(log => getSessionDurations(log.timestamps));

        const avgTimeOnSiteSecs = sessions.length === 0 
          ? 0 
          : Math.floor(sessions.reduce((a, b) => a + b, 0) / sessions.length / 1000);

        return {
          date: formatDate(new Date(dateStr)),
          visitors: visitorsLog.requestsByVisitor.size,
          avgTimeOnSiteSecs
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    // Group visitors by month
    const visitorsByMonth = new Map<string, Set<string>>();
    for (const [dateStr, visitorsLog] of this.state.visitorsByDate.entries()) {
      const month = formatMonth(new Date(dateStr));
      if (!visitorsByMonth.has(month)) {
        visitorsByMonth.set(month, new Set());
      }
      for (const ip of visitorsLog.requestsByVisitor.keys()) {
        visitorsByMonth.get(month)!.add(ip);
      }
    }

    const monthlyStats: SieveMonthlyStats[] = Array.from(visitorsByMonth.entries())
      .map(([month, visitors]) => {
        const referrals: Record<string, number> = {};
        const refererLog = this.state.referersByMonth.get(month);
        if (refererLog) {
          for (const [domain, count] of refererLog.countByDomain.entries()) {
            referrals[domain] = count;
          }
        }

        const pages: Record<string, number> = {};
        const pageLog = this.state.pagesByMonth.get(month);
        if (pageLog) {
          for (const [path, count] of pageLog.countByPage.entries()) {
            pages[path] = count;
          }
        }

        return {
          id: month,
          name: getPrettyMonth(month),
          visitors: visitors.size,
          referrals,
          pages
        };
      })
      .sort((a, b) => a.id.localeCompare(b.id));

    return {
      daily: dailyStats,
      monthly: monthlyStats,
      created: Date.now()
    };
  }
}

//
// Internal Helper Functions
//

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatMonth(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function parseDateTime(formattedDate: string, time: string): number {
  const dateTime = `${formattedDate} ${time}`;
  return new Date(`${dateTime}Z`).getTime();
}

function getPrettyMonth(id: string): string {
  const date = new Date(`${id}-01`);
  const monthName = date.toLocaleString('en-US', { month: 'long' });
  const year = date.getFullYear();
  return `${monthName} ${year}`;
}

function getSessionDurations(timestamps: number[], durations: number[] = []): number[] {
  if (timestamps.length === 0) {
    return durations;
  }

  const start = Math.min(...timestamps);
  const inSession = timestamps.filter(t => t < start + MAX_SESSION_MS);
  const afterSession = timestamps.filter(t => t >= start + MAX_SESSION_MS);
  const durationMs = Math.max(...inSession) - start;

  return getSessionDurations(afterSession, [...durations, durationMs]);
}

interface State {
  visitorsByDate: Map<string, VisitorsLog>;
  referersByMonth: Map<string, RefererLog>;
  pagesByMonth: Map<string, PageLog>;
}

interface RefererLog {
  countByDomain: Map<string, number>;
}

interface PageLog {
  countByPage: Map<string, number>;
}

interface VisitorsLog {
  requestsByVisitor: Map<string, RequestLog>;
}

interface RequestLog {
  timestamps: number[];
}
