# summary

Detect conflicts

# description

Detect GIT conflict markers in the specified directory

# flags.target-dir.summary

Target directory to process

# flags.target-dir.description

Directory containing Salesforce project files. Defaults to current directory.

# examples

- Check GIT conflict files within current folder:

  <%= config.bin %> <%= command.id %>

- Check GIT conflict files within given folder:

  <%= config.bin %> <%= command.id %> ./force-app/main/default

# info.hello

Hello %s at %s.
