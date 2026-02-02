#!/bin/bash

#
# Validate arguments.
#

RequiredSieveEntry=app/sieve-main.ts

if [ ! -f $RequiredSieveEntry ]; then
  echo "error: missing required file $RequiredSieveEntry"
  exit 1
fi

if [ $# -lt 3 ]; then
  echo "usage: $0 <S3-bucket+path> <local-logs-dir> <outfile.json>"
  exit 1
fi

BucketAndPath="${1%/}/"
LogDirectory="${2%/}/"
OutputFile=$3

if [ ! -d $LogDirectory ]; then
  echo "error: $LogDirectory must be a directory"
  exit 1
fi

#
# Sync the trailing months of logs locally.
#

PreviousMonthsSync=3
bun run $RequiredSieveEntry months $PreviousMonthsSync | \
  while read prefix ; do
    echo "Syncing $prefix:"
    sync_output=$(aws s3 sync --exclude="*" --include="*$prefix*" s3://$BucketAndPath $LogDirectory)
    echo "$sync_output"
    
    # Count the number of files synced (lines starting with "download:")
    files_synced=$(echo "$sync_output" | grep -c "^download:")
    
    # If no files were synced, break early
    if [ "$files_synced" -eq 0 ]; then
      echo "No files synced for $prefix - stopping early"
      break
    fi
  done

#
# Compute the analytics from the local logs.
#

bun run $RequiredSieveEntry compute $LogDirectory $OutputFile
