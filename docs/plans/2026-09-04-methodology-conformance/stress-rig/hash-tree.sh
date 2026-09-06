#!/usr/bin/env bash
# One digest over a whole tree, so "the plugin did not move during the run" is a
# comparison of two strings rather than a judgement call.
#
#   bash hash-tree.sh <dir>   ->  <sha256>  files=<n>
#
# Line endings are normalised to LF before hashing, because a checkout on
# Windows and the same bytes read back through Node disagree otherwise. Files
# containing a NUL byte are hashed raw — they are not text and must not be
# rewritten. The per-file digests are sorted by path under LC_ALL=C, so the
# result depends on content and names only, never on directory order.
#
# Run with Git Bash. Requires node.
set -euo pipefail

T="${1:?usage: hash-tree.sh <dir>}"
T="$(cd "$T" && pwd)"

find "$T" -type f | sed "s|^$T/||" | LC_ALL=C sort | while IFS= read -r rel; do
  printf '%s  %s\n' "$(node -e "
    const f=require('fs'),c=require('crypto');
    const b=f.readFileSync(process.argv[1]);
    const s=b.includes(0)?b:Buffer.from(b.toString('utf8').replace(/\r\n/g,'\n'));
    console.log(c.createHash('sha256').update(s).digest('hex'));
  " "$T/$rel")" "$rel"
done | node -e "
  const c=require('crypto');let d='';
  process.stdin.on('data',x=>d+=x).on('end',()=>{
    if(!d.trim()){console.error('hash-tree: no files found');process.exit(1);}
    console.log(c.createHash('sha256').update(d).digest('hex')+'  files='+d.trim().split('\n').length);
  });"
