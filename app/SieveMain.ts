import { writeFileSync } from 'fs';
import { SieveAnalyzer } from './SieveAnalyzer';
import { SieveFilter } from './SieveFilter';
import { readCloudFrontLogsDir } from './SieveRead';
import { analyticsToJson } from './Model';

const COMMAND_MONTHS = 'months';
const COMMAND_COMPUTE = 'compute';

type SieveTask = MonthsTask | ComputeTask;

interface MonthsTask {
  type: 'months';
  previous: number;
}

interface ComputeTask {
  type: 'compute';
  logsDirPath: string;
  outputFile: string;
}

function main() {
  const args = process.argv.slice(2);
  const task = validateArgs(args);
  
  if (task.type === 'months') {
    runMonthsTask(task);
  } else {
    runComputeTask(task);
  }
}

//
// Internal
//

function runMonthsTask(task: MonthsTask): void {
  const current = new Date();
  const prev = task.previous >= 0 ? task.previous : 0;

  const prefixes: string[] = [];
  for (let i = 0; i <= prev; i++) {
    const date = new Date(current.getFullYear(), current.getMonth() - i, 1);
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    prefixes.push(`${year}-${month}-`);
  }

  prefixes.forEach(prefix => console.log(prefix));
}

function runComputeTask(task: ComputeTask): void {
  console.log(`Computing SieveAnalytics from ${task.logsDirPath}`);
  
  const filter = new SieveFilter({
    keepOnly2xx3xx: true,
    ipPrefixBlockFilePath: 'app/resources/blocked-ip-prefixes.txt'
  });

  const analyzer = new SieveAnalyzer(filter);

  const slices = readCloudFrontLogsDir(task.logsDirPath);
  
  for (const slice of slices) {
    if (slice.numSkipped > 0) {
      console.log(`error: file (${slice.filename}) had ${slice.numSkipped} skipped lines`);
    }

    // Feed them into the analyzer.
    slice.requests.forEach(request => analyzer.ingest(request));
  }

  console.log('Finished ingestion; computing analytics.');

  const analytics = analyzer.compute();
  const json = analyticsToJson(analytics);
  writeFileSync(task.outputFile, json, 'utf-8');

  console.log(`Analytics written to ${task.outputFile}`);
}

function validateArgs(args: string[]): SieveTask {
  const command = args[0];
  
  if (command === COMMAND_MONTHS && args.length >= 2) {
    return { type: 'months', previous: parseInt(args[1]) };
  } else if (command === COMMAND_COMPUTE && args.length >= 3) {
    return { type: 'compute', logsDirPath: args[1], outputFile: args[2] };
  } else {
    printUsageAndExit();
    // TypeScript needs this for type checking, but it's unreachable
    return { type: 'months', previous: 0 };
  }
}

function printUsageAndExit(): never {
  console.log('usage: SieveMain <command> [<args>]');
  console.log('commands:');
  console.log(`   ${COMMAND_MONTHS} <count>               - print the previous <months> YEAR-MONTH prefixes`);
  console.log(`   ${COMMAND_COMPUTE} <in-dir> <out.json>  - compute analytics from <in-dir> and write to <out.json>`);
  process.exit(1);
}

main();
