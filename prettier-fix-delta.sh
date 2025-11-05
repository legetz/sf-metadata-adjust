#!/bin/bash
#
# Author: Leo Jokinen (2025-11-05)
# - Run Prettier fix for Apex classes/triggers inside PR commits
#
set -u

# Get commit amount from first argument, default to 0
COMMIT_AMOUNT="${1:-0}"

# Exit early if no commit amount or zero
if [ "$COMMIT_AMOUNT" -eq 0 ]
then
    echo "No commit amount specified, exiting"
    exit 0
fi

# Function to run prettier on a list of files
run_prettier() {
    local file_list="$1"
    local files_string=$(echo "$file_list" | tr '\n' ' ')
    npx prettier --write --no-error-on-unmatched-pattern $files_string
}

APEX_DELTA_LIST=$(git diff --name-only HEAD HEAD~${COMMIT_AMOUNT} | grep -E 'cls$|trigger$')
LIST_SIZE=$(echo "$APEX_DELTA_LIST" | wc -l | tr -d '[:space:]')

if [ -z "$APEX_DELTA_LIST" ]
then 
    echo "No changes done for classes/triggers"
else
    # Iterate 20 items per round in the list if list is larger than 20
    if [ $LIST_SIZE -gt 20 ]
    then
        echo "Run Prettier for $LIST_SIZE items in 20 item rounds"
        for i in $(seq 1 20 $LIST_SIZE)
        do
            SUBLIST=$(echo "$APEX_DELTA_LIST" | head -n $i | tail -n 20)
            run_prettier "$SUBLIST"
        done
    else
        echo "Run Prettier for $LIST_SIZE items"
        run_prettier "$APEX_DELTA_LIST"
    fi
fi