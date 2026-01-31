
export interface LoggedRequest {
  date: Date;
  time: string;
  x_edge_location?: string;
  sc_bytes?: number;
  c_ip?: string;
  cs_method: string;
  cs_host: string;
  cs_uri_stem: string;
  sc_status: number;
  cs_referer?: string;
  cs_user_agent?: string;
  cs_uri_query?: string;
  cs_cookie?: string;
  x_edge_result_type?: string;
  x_edge_request_id?: string;
  x_host_header?: string;
  cs_protocol?: string;
  cs_bytes?: number;
  time_taken?: number;
  x_forwarded_for?: string;
  ssl_protocol?: string;
  ssl_cipher?: string;
  x_edge_response_result_type?: string;
  cs_protocol_version?: string;
  fle_status?: string;
  fle_encrypted_fields?: string;
  c_port?: number;
  time_to_first_byte?: number;
  x_edge_detailed_result_type?: string;
  sc_content_type?: string;
  sc_content_len?: number;
  sc_range_start?: string;
  sc_range_end?: string;
}

export interface LogSlice {
  filename: string;
  requests: LoggedRequest[];
  numSkipped: number;
}

export interface SieveAnalytics {
  daily: SieveDailyStats[];
  monthly: SieveMonthlyStats[];
  created: number; // epoch ms
}

export interface SieveDailyStats {
  date: string;
  visitors: number;
  avgTimeOnSiteSecs: number;
}

export interface SieveMonthlyStats {
  id: string; // yyyy-MM
  name: string; // January 2022
  visitors: number;
  referrals: Record<string, number>;
  pages: Record<string, number>;
}

export function analyticsToJson(analytics: SieveAnalytics): string {
  return JSON.stringify(analytics, null, 2);
}
