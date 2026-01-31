import { readFileSync } from 'fs';
import { LoggedRequest } from './Model';

export interface SieveFilterConfig {
  keepOnly2xx3xx: boolean;
  ipPrefixBlockFilePath?: string;
}

export class SieveFilter {
  private blockedPrefixIPs: Set<string>;

  constructor(private config: SieveFilterConfig) {
    this.blockedPrefixIPs = new Set();

    if (config.ipPrefixBlockFilePath) {
      try {
        const content = readFileSync(config.ipPrefixBlockFilePath, 'utf-8');
        const lines = content.split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0)
          .filter(line => !line.startsWith('#'));
        
        this.blockedPrefixIPs = new Set(lines);
      } catch (e) {
        console.log(`error: failed to load IP prefix block file ${config.ipPrefixBlockFilePath}`);
        this.blockedPrefixIPs = new Set();
      }
    }
  }

  isBlocked(request: LoggedRequest): boolean {
    const statusType = Math.floor(request.sc_status / 100);
    const isWrongStatusType = this.config.keepOnly2xx3xx && ![2, 3].includes(statusType);
    
    const hasBlockedIP = request.c_ip !== undefined && 
      Array.from(this.blockedPrefixIPs).some(prefix => request.c_ip!.startsWith(prefix));

    return isWrongStatusType || hasBlockedIP;
  }
}
