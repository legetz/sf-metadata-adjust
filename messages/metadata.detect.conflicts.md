# description
Detect GIT conflict markers in the specified directory

# args.path.description
Path to the directory containing Salesforce project files. Defaults to current directory if not specified.

# flags.target-dir.description
Directory containing Salesforce project files. Defaults to current directory.

# examples
- Check GIT conflict files within current folder:
  <%= config.bin %> <%= command.id %>

- Check GIT conflict files within given folder:
  <%= config.bin %> <%= command.id %> ./force-app/main/default

# info.hello

Hello %s at %s.
