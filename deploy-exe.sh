#!/bin/bash
set -e

# Auto-generate version from datetime: YYYY.MMDD.HHmm
# e.g. 2026.0520.0748  — always increases, human-readable
VERSION=$(date +"%Y.%m%d.%H%M")

# Write version into desktop/package.json
node -e "
  const fs = require('fs');
  const p = JSON.parse(fs.readFileSync('./desktop/package.json'));
  p.version = '${VERSION}';
  fs.writeFileSync('./desktop/package.json', JSON.stringify(p, null, 2) + '\n');
"

FILENAME="EPM-Monitor-${VERSION}-win.zip"
DIST="./desktop/dist"
UNPACKED="$DIST/win-unpacked"
ZIPFILE="$DIST/$FILENAME"

echo "▶ Deploying EPM Monitor v${VERSION}"

# 1. Build
echo "\n[1/5] Building..."
cd desktop && npm install && npm run build:win && cd ..

# 2. Strip unnecessary files
echo "\n[2/5] Stripping unnecessary files..."
rm -f "$UNPACKED/LICENSES.chromium.html"
rm -f "$UNPACKED/vk_swiftshader.dll" "$UNPACKED/vk_swiftshader_icd.json"
rm -f "$UNPACKED/d3dcompiler_47.dll"
cd "$UNPACKED/locales"
for f in *.pak; do
  case "$f" in en-US.pak|en-GB.pak) ;; *) rm -f "$f" ;; esac
done
cd - > /dev/null

# 3. Zip
echo "\n[3/5] Zipping..."
rm -f "$ZIPFILE"
cd "$DIST" && zip -r "$FILENAME" win-unpacked/ && cd - > /dev/null
SIZE=$(du -sh "$ZIPFILE" | cut -f1)
echo "    $FILENAME — $SIZE"

# 4. Upload to R2 + update Supabase
echo "\n[4/5] Uploading to R2 and updating Supabase..."
python3 - <<PYEOF
import boto3, urllib.request, json

version = "${VERSION}"
filename = "${FILENAME}"
zipfile = "${ZIPFILE}"
bucket = "hisaab-releases"
pub_url = "https://pub-16c1f34c0efb439e86a8efbd83cbcc98.r2.dev"
svc_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjZmV6aG9heHFyb3VicGh6emZ6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODA0NzU3MCwiZXhwIjoyMDkzNjIzNTcwfQ.X4m2s_sbr6SCFRjutacvd3XWPNGpHWZNZf-LvviJY20"

s3 = boto3.client("s3",
    endpoint_url="https://56f6e88a4910144d0dad790d81c957e9.r2.cloudflarestorage.com",
    aws_access_key_id="dd13eb5bd61738c353b8f94e907737cb",
    aws_secret_access_key="e8972274b715d6554fdea1b45ecee8856934379e0a46f617b462b2cb45144107",
    region_name="auto"
)

extra = {"ContentType": "application/zip", "ContentDisposition": f'attachment; filename="{filename}"'}
for key in [f"epm-releases/{version}/{filename}", f"epm-releases/latest/{filename}"]:
    s3.upload_file(zipfile, bucket, key, ExtraArgs=extra)
    print(f"  ✓ R2: {key}")

download_url = f"{pub_url}/epm-releases/{version}/{filename}"
body = json.dumps({"platform": "windows", "version": version,
                   "download_url": download_url, "is_latest": True}).encode()
req = urllib.request.Request(
    "https://fcfezhoaxqroubphzzfz.supabase.co/rest/v1/download_releases",
    data=body, method="POST",
    headers={"apikey": svc_key, "Authorization": f"Bearer {svc_key}",
             "Content-Type": "application/json", "Prefer": "resolution=merge-duplicates,return=minimal"}
)
urllib.request.urlopen(req)
print(f"  ✓ Supabase updated")
print(f"  Download URL: {download_url}")
PYEOF

# 5. Push to Firebase RTDB — instant notification to all live clients
echo "\n[5/5] Pushing to Firebase RTDB (live client notification)..."
RTDB_URL="https://website-bf923-default-rtdb.asia-southeast1.firebasedatabase.app/epm_releases/latest.json"
DOWNLOAD_URL="https://pub-16c1f34c0efb439e86a8efbd83cbcc98.r2.dev/epm-releases/${VERSION}/${FILENAME}"
RELEASED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

if [ -n "$FIREBASE_DB_SECRET" ]; then
  RTDB_AUTH="?auth=${FIREBASE_DB_SECRET}"
else
  RTDB_AUTH=""
fi

HTTP_STATUS=$(curl -s -o /tmp/rtdb_response.txt -w "%{http_code}" \
  -X PUT "${RTDB_URL}${RTDB_AUTH}" \
  -H "Content-Type: application/json" \
  -d "{\"version\":\"${VERSION}\",\"downloadUrl\":\"${DOWNLOAD_URL}\",\"releasedAt\":\"${RELEASED_AT}\"}")

if [ "$HTTP_STATUS" = "200" ]; then
  echo "  ✓ Firebase RTDB updated — clients notified in real-time"
else
  echo "  ⚠ RTDB update failed (HTTP $HTTP_STATUS)"
  cat /tmp/rtdb_response.txt
fi

echo "\n✅ Done! v${VERSION} is live."
echo "   All connected clients will be notified within seconds."
