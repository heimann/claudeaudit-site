#!/usr/bin/env bash
# Fetch the top 100 real software repos by stars for the Agent Readiness Index.
# Deterministic for a given date (star counts may shift slightly).
#
# Usage: ./index/fetch_repos.sh > index/repos.json

set -euo pipefail

EXCLUDE_LANGS='Markdown|HTML|Jupyter Notebook|CSS|SCSS|MDX|Roff|TeX|Vim Script'
EXCLUDE_TOPICS='awesome|awesome-list|list|lists|curated|tutorial|interview|cookbook|education|learn|learning|guide|cheatsheet|resource|resources|books|book'
EXCLUDE_DESC='(?i)awesome|curated list|cheat.?sheet|interview|cookbook|roadmap|free.*(book|course|resource)'
MIN_PUSH_DATE=$(date -d '90 days ago' +%Y-%m-%d 2>/dev/null || date -v-90d +%Y-%m-%d)

(gh api search/repositories --method GET \
  -f q="stars:>20000 pushed:>$MIN_PUSH_DATE fork:false archived:false" \
  -f sort=stars -f per_page=100 -f page=1 --jq '.items[]' ; \
 gh api search/repositories --method GET \
  -f q="stars:>20000 pushed:>$MIN_PUSH_DATE fork:false archived:false" \
  -f sort=stars -f per_page=100 -f page=2 --jq '.items[]') | \
jq -s --arg exclude "$EXCLUDE_LANGS" --arg exclude_topics "$EXCLUDE_TOPICS" --arg exclude_desc "$EXCLUDE_DESC" '
  [.[] | select(
    .language != null and
    (.language | test($exclude) | not) and
    ((.topics // []) | map(test($exclude_topics)) | any | not) and
    (.description // "" | test($exclude_desc) | not)
  )] |
  sort_by(-.stargazers_count) |
  .[0:100] |
  {
    generated_at: (now | strftime("%Y-%m-%dT%H:%M:%SZ")),
    count: length,
    repos: [.[] | {
      full_name,
      stars: .stargazers_count,
      language,
      description,
      license: (.license // {}).spdx_id,
      created_at,
      pushed_at,
      open_issues: .open_issues_count,
      forks: .forks_count,
      topics,
      default_branch
    }]
  }
'
