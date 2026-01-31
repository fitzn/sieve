import { LoggedRequest, LogSlice } from './model';

export const CF_LOGS_VERSION_ONE_HEADER = '#Version: 1.0';

export async function readCloudFrontLogsDir(path: string): Promise<LogSlice[]> {
  const dir = new Bun.Glob('*').scanSync({ cwd: path, onlyFiles: true });
  const files = Array.from(dir).sort();

  const results: LogSlice[] = [];
  for (const filename of files) {
    const fullPath = `${path}/${filename}`;
    const contents = await readGzipFileLines(fullPath);
    const allRequests = contents.filter(line => !line.startsWith('#'));

    let requests: LoggedRequest[] = [];
    if (!contents[0] || contents[0] !== CF_LOGS_VERSION_ONE_HEADER) {
      console.log(`error: file (${filename}) has missing or unknown header, skipping`);
      requests = [];
    } else {
      requests = allRequests
        .map(parseCloudFrontLoggedRequestV1)
        .filter((req): req is LoggedRequest => req !== null);
    }

    results.push({
      filename,
      requests,
      numSkipped: allRequests.length - requests.length
    });
  }

  return results;
}

export function parseCloudFrontLoggedRequestV1(line: string): LoggedRequest | null {
  try {
    function clean(s: string): string | undefined {
      const trimmed = s.trim();
      if (trimmed.length === 0 || trimmed === '-') {
        return undefined;
      }
      return trimmed;
    }

    const parts = line.split('\t');
    
    return {
      date: new Date(parts[0]),
      time: parts[1],
      x_edge_location: clean(parts[2]),
      sc_bytes: clean(parts[3]) ? parseInt(clean(parts[3])!) : undefined,
      c_ip: clean(parts[4]),
      cs_method: parts[5],
      cs_host: parts[6],
      cs_uri_stem: parts[7],
      sc_status: parseInt(parts[8]),
      cs_referer: clean(parts[9]),
      cs_user_agent: clean(parts[10]),
      cs_uri_query: clean(parts[11]),
      cs_cookie: clean(parts[12]),
      x_edge_result_type: clean(parts[13]),
      x_edge_request_id: clean(parts[14]),
      x_host_header: clean(parts[15]),
      cs_protocol: clean(parts[16]),
      cs_bytes: clean(parts[17]) ? parseInt(clean(parts[17])!) : undefined,
      time_taken: clean(parts[18]) ? parseFloat(clean(parts[18])!) : undefined,
      x_forwarded_for: clean(parts[19]),
      ssl_protocol: clean(parts[20]),
      ssl_cipher: clean(parts[21]),
      x_edge_response_result_type: clean(parts[22]),
      cs_protocol_version: clean(parts[23]),
      fle_status: clean(parts[24]),
      fle_encrypted_fields: clean(parts[25]),
      c_port: clean(parts[26]) ? parseInt(clean(parts[26])!) : undefined,
      time_to_first_byte: clean(parts[27]) ? parseFloat(clean(parts[27])!) : undefined,
      x_edge_detailed_result_type: clean(parts[28]),
      sc_content_type: clean(parts[29]),
      sc_content_len: clean(parts[30]) ? parseInt(clean(parts[30])!) : undefined,
      sc_range_start: clean(parts[31]),
      sc_range_end: clean(parts[32])
    };
  } catch (e) {
    return null;
  }
}

// NOTE: This gunzips the whole file into memory.
// Our hope is that CF has some reasonable max size / # of requests for a single log file.
export async function readGzipFileLines(filepath: string): Promise<string[]> {
  const file = Bun.file(filepath);
  const bytes = await file.arrayBuffer();
  const decompressed = Bun.gunzipSync(new Uint8Array(bytes));
  const content = new TextDecoder().decode(decompressed);
  return content.split('\n');
}
