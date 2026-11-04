#!/bin/bash
# Usage: bash scripts/set-keys.sh NAME [NAME...]
# For each NAME: paste the value (hidden), it is saved to .env (ignored by git) and added to the Vercel project's production env.
# Press Enter with nothing to reuse the value already in .env.
cd "$(dirname "$0")/.." || exit 1
touch .env && chmod 600 .env
for n in "$@"; do
  read -rsp "Pega $n (Enter vacio = usar el de .env): " v; echo
  if [ -z "$v" ]; then v=$(grep "^$n=" .env | head -1 | cut -d= -f2-); fi
  [ -z "$v" ] && { echo "  $n vacio, lo salto"; continue; }
  grep -v "^$n=" .env > .env.tmp; mv .env.tmp .env; printf '%s=%s\n' "$n" "$v" >> .env
  printf '%s' "$v" | npx -y vercel@latest env add "$n" production --force >/dev/null 2>&1 && echo "  $n guardada en .env y en Vercel" || echo "  $n guardada en .env; Vercel fallo"
done
unset v
echo "Listo. Avisa a Claude para que vuelva a desplegar."
