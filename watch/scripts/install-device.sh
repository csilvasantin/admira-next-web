#!/usr/bin/env bash
# Invoke only after Carlos has enabled Developer Mode on the target Watch.
set -euo pipefail
UDID="${1:?Uso: install-device.sh <UDID-del-Watch>}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
[ -s "$ROOT/Config/Device.plist" ] || { echo 'Falta configurar el enlace propio de ESTE Watch.' >&2; exit 1; }
xcodegen generate --spec "$ROOT/project.yml"
xcodebuild -project "$ROOT/AdmiraVisor.xcodeproj" -scheme AdmiraVisor \
  -destination "platform=watchOS,id=$UDID" -destination-timeout 30 \
  -derivedDataPath "$ROOT/.build/device" \
  -allowProvisioningUpdates -allowProvisioningDeviceRegistration build
xcrun devicectl device install app --device "$UDID" --timeout 30 \
  "$ROOT/.build/device/Build/Products/Debug-watchos/AdmiraVisor.app"
xcrun devicectl device process launch --device "$UDID" --timeout 30 com.admiranext.visor.watch
