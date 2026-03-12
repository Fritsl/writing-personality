#!/bin/bash
# Auto-commit and push on Claude stop — generates descriptive commit messages
cd /Users/frits/Documents/GitHub/writing-personality

# Check if there are any changes to commit
if git diff --quiet HEAD && git diff --cached --quiet && [ -z "$(git ls-files --others --exclude-standard)" ]; then
  echo "No changes to commit."
  exit 0
fi

# Stage all changes
git add -A

# Nothing staged after add? (shouldn't happen, but safety check)
if git diff --cached --quiet; then
  exit 0
fi

# Build a descriptive commit message from the actual changes
changed_files=$(git diff --cached --name-only)
stat_summary=$(git diff --cached --stat | tail -1)

# Categorize changes
lib_changes=""
public_changes=""
config_changes=""
scripts_changes=""
other_changes=""

while IFS= read -r file; do
  case "$file" in
    lib/*) lib_changes="$lib_changes $(basename "$file" | sed 's/\.[^.]*$//')" ;;
    public/*) public_changes="$public_changes $(basename "$file" | sed 's/\.[^.]*$//')" ;;
    scripts/*) scripts_changes="$scripts_changes $(basename "$file" | sed 's/\.[^.]*$//')" ;;
    package.json | package-lock.json | .gitignore | .env* | *.config.*) config_changes="$config_changes $(basename "$file")" ;;
    .claude/*) config_changes="$config_changes $(basename "$file")" ;;
    *) other_changes="$other_changes $(basename "$file" | sed 's/\.[^.]*$//')" ;;
  esac
done <<< "$changed_files"

# Build message parts
parts=()
[ -n "$lib_changes" ] && parts+=("update lib:$lib_changes")
[ -n "$public_changes" ] && parts+=("update UI:$public_changes")
[ -n "$scripts_changes" ] && parts+=("update scripts:$scripts_changes")
[ -n "$config_changes" ] && parts+=("update config:$config_changes")
[ -n "$other_changes" ] && parts+=("update:$other_changes")

# Join parts into commit message
if [ ${#parts[@]} -eq 0 ]; then
  msg="Update project files"
elif [ ${#parts[@]} -eq 1 ]; then
  msg="${parts[0]}"
else
  msg=$(IFS=', '; echo "${parts[*]}")
fi

# Capitalize first letter
msg="$(echo "${msg:0:1}" | tr '[:lower:]' '[:upper:]')${msg:1}"

# Truncate if too long (keep under 72 chars for the subject line)
if [ ${#msg} -gt 72 ]; then
  msg="${msg:0:69}..."
fi

# Commit with descriptive message
git commit -m "$msg

$stat_summary

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"

# Push to GitHub
if ! git push origin main 2>/dev/null; then
  git pull --rebase origin main 2>/dev/null && git push origin main 2>/dev/null \
    || echo "Push failed but commit saved locally"
fi
