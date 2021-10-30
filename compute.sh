#!/bin/bash

#
# Validate arguments.
#

RequiredSieveJar=app/target/sieve.jar

if [ ! -f $RequiredSieveJar ]; then
  echo "error: missing required file $RequiredSieveJar"
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
scala -cp $RequiredSieveJar SieveMain months $PreviousMonthsSync | \
  while read prefix ; do
    echo "Syncing $prefix:"
    aws s3 sync --exclude="*" --include="*$prefix*" s3://$BucketAndPath $LogDirectory
  done

#
# Compute the analytics from the local logs.
#

scala -cp $RequiredSieveJar SieveMain compute $LogDirectory $OutputFile
