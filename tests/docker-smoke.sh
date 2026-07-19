#!/bin/sh
set -eu

image_name="jpdhome-smoke"
container_name="jpdhome-smoke-${GITHUB_RUN_ID:-local}"

cleanup() {
  docker rm -f "$container_name" >/dev/null 2>&1 || true
}

trap cleanup EXIT INT TERM
docker build --tag "$image_name" .
docker run --detach --name "$container_name" --publish 127.0.0.1:18080:80 "$image_name" >/dev/null

attempt=0
until curl --fail --silent --show-error http://127.0.0.1:18080/ >/dev/null; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 20 ]; then
    docker logs "$container_name"
    exit 1
  fi
  sleep 1
done

curl --fail --silent --show-error http://127.0.0.1:18080/jpdhome/ >/dev/null
curl --fail --silent --show-error http://127.0.0.1:18080/manifest.webmanifest >/dev/null
status="$(curl --silent --output /dev/null --write-out '%{http_code}' http://127.0.0.1:18080/missing-page)"
test "$status" = "404"
