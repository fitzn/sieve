import { LoggedRequest } from './model';

export interface SieveFilterConfig {
  keepOnly2xx3xx: boolean;
  ipPrefixBlockFilePath?: string;
  excludePHPReqs: boolean;
}

export class SieveFilter {
  private blockedPrefixIPs: Set<string>;

  private constructor(private config: SieveFilterConfig, blockedPrefixes: Set<string>) {
    this.blockedPrefixIPs = blockedPrefixes;
  }

  static async create(config: SieveFilterConfig): Promise<SieveFilter> {
    let blockedPrefixIPs = new Set<string>();

    if (config.ipPrefixBlockFilePath) {
      try {
        const file = Bun.file(config.ipPrefixBlockFilePath);
        const content = await file.text();
        const lines = content.split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0)
          .filter(line => !line.startsWith('#'));
        
        blockedPrefixIPs = new Set(lines);
      } catch (e) {
        console.log(`error: failed to load IP prefix block file ${config.ipPrefixBlockFilePath}`);
        blockedPrefixIPs = new Set();
      }
    }

    return new SieveFilter(config, blockedPrefixIPs);
  }

  isBlocked(request: LoggedRequest): boolean {
    const statusType = Math.floor(request.sc_status / 100);
    const isWrongStatusType = this.config.keepOnly2xx3xx && ![2, 3].includes(statusType);
    
    const hasBlockedIP = request.c_ip !== undefined && 
      Array.from(this.blockedPrefixIPs).some(prefix => request.c_ip!.startsWith(prefix));

    const isPHPRequest = this.config.excludePHPReqs && request.cs_uri_stem.endsWith('.php');

    return isWrongStatusType || hasBlockedIP || isPHPRequest;
  }
}
