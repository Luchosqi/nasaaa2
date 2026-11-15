#!/bin/sh
# Abandoned but not Forgotten: start the local server and open the browser (Linux / macOS).
#   ./iniciar.sh            this computer only
#   ./iniciar.sh --lan      also phones and tablets on the same Wi-Fi (offline museum)
#   ./iniciar.sh 8643       another port
cd "$(dirname "$0")" || exit 1
if command -v node >/dev/null 2>&1; then
  exec node tools/serve.cjs "$@" --open
fi
# No Node.js: Python's built-in server (installed on macOS and most Linux systems).
PORT=8642; BIND=127.0.0.1
for a in "$@"; do
  case "$a" in
    --lan) BIND=0.0.0.0 ;;
    *[!0-9]*|'') ;;
    *) PORT="$a" ;;
  esac
done
PY=$(command -v python3 || command -v python)
if [ -z "$PY" ]; then echo "Instala Node.js o Python 3 para iniciar el servidor."; exit 1; fi
echo "Abre http://127.0.0.1:$PORT/"
[ "$BIND" = 0.0.0.0 ] && echo "Modo LAN: usa la direccion IP de este equipo, por ejemplo http://<ip>:$PORT/museo.html"
( sleep 1; (command -v xdg-open >/dev/null && xdg-open "http://127.0.0.1:$PORT/") || (command -v open >/dev/null && open "http://127.0.0.1:$PORT/") ) >/dev/null 2>&1 &
exec "$PY" -m http.server "$PORT" --bind "$BIND"
