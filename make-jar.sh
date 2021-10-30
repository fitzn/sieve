#!/bin/bash

OutputJarfile=app/target/sieve.jar

if [ ! -d app/target ] ; then
  mkdir app/target
fi

scalac app/*.scala -d $OutputJarfile

jar -uf $OutputJarfile app/resources/
