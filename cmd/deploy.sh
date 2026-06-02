#!/bin/bash
# 1. cd to project root and Switch to main branch
# 2. Build the project to dist/
# 3. Delete everything tracked but keeps CNAME
# 4. Move ./dist/ to ./
# 5. Commit with `-m "build deploy"` or arguments supplied and pushes to origin
# 6. Switch back to main branch

set -e  # exit on any error

if [[ -z "$@" ]]; then
  set -- -m "build: deploy"
  echo "No arguments supplied, using generic arguments '${@}'"
fi

# for elem in "${@}"
# do
#   echo $elem
# done

cd "$(git rev-parse --show-toplevel)"

git checkout main
git pull

npm run build

git checkout gh-pages
git pull 

# Remove all tracked files except CNAME
git rm -r .
git checkout gh-pages -- CNAME || :

mv dist/* .

git add .
git commit "${@}"
git push origin gh-pages

# remove new untracked objects?? (actl not untracked)
rm -r .vite/ 2>/dev/null || :

git checkout main

echo "Commited with arguments: ${@}"