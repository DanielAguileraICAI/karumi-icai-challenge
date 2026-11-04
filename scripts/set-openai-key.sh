#!/bin/bash
# Saves the OpenAI key to .env at the repo root (ignored by git). The key is not shown while you paste it.
cd "$(dirname "$0")/.." || exit 1
read -rsp "Pega la OpenAI key y pulsa Enter: " k; echo
[ -z "$k" ] && { echo "Vacia, no guardo nada"; exit 1; }
touch .env && grep -v '^OPENAI_API_KEY=' .env > .env.tmp; mv .env.tmp .env
printf 'OPENAI_API_KEY=%s\n' "$k" >> .env && chmod 600 .env
echo "Guardada en $(pwd)/.env (git la ignora). Empieza por ${k:0:7}..."
