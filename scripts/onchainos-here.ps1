# Runs onchainos scoped to THIS project's own session directory
# (.onchainos-home/) instead of the shared %USERPROFILE%\.onchainos config.
# The onchainos CLI persists login session to one global machine-wide
# location by default, so logging into a different project's account in
# any terminal silently overwrites every other project's session. Use
# this wrapper (instead of the bare `onchainos` command) for any command
# that touches login state, e.g.:
#   .\scripts\onchainos-here.ps1 wallet login
#   .\scripts\onchainos-here.ps1 agent heartbeat --chain-index 196
#   .\scripts\onchainos-here.ps1 agent profile 4962
$env:ONCHAINOS_HOME = Join-Path $PSScriptRoot "..\.onchainos-home"
New-Item -ItemType Directory -Force -Path $env:ONCHAINOS_HOME | Out-Null
& onchainos @args
