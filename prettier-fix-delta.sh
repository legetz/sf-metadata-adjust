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

APEX_DELTA_LIST=$(git diff --name-only HEAD HEAD~${COMMIT_AMOUNT} | grep -E 'cls$|trigger$')
LIST_SIZE=$(echo "$APEX_DELTA_LIST" | wc -l | tr -d '[:space:]')

if [ -z "$APEX_DELTA_LIST" ]
then 
    echo "No changes done for classes/triggers"
else
    # Iterate over 10 items per round in the list if list is larger than 30
    if [ $LIST_SIZE -gt 30 ]
    then
        echo "Run Prettier for $LIST_SIZE items in 15 item rounds"
        for i in $(seq 1 15 $LIST_SIZE)
        do
            SUBLIST=$(echo "$APEX_DELTA_LIST" | head -n $i | tail -n 15)
            npx prettier --write --no-error-on-unmatched-pattern "$SUBLIST"
        done
    else
        echo "Run Prettier for $LIST_SIZE items"
        set -x
        npx prettier --write --no-error-on-unmatched-pattern "$APEX_DELTA_LIST"
    fi
fi