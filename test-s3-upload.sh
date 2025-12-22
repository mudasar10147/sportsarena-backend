#!/bin/bash

# Test S3 Upload Script
# Usage: ./test-s3-upload.sh <PRESIGNED_URL> <IMAGE_FILE>

if [ "$#" -ne 2 ]; then
    echo "Usage: $0 <PRESIGNED_URL> <IMAGE_FILE>"
    echo "Example: $0 'https://s3.amazonaws.com/...?X-Amz-Algorithm=...' ./test.jpg"
    exit 1
fi

PRESIGNED_URL="$1"
IMAGE_FILE="$2"

if [ ! -f "$IMAGE_FILE" ]; then
    echo "Error: Image file '$IMAGE_FILE' not found"
    exit 1
fi

# Detect content type from file extension
CONTENT_TYPE="image/jpeg"
case "$IMAGE_FILE" in
    *.png) CONTENT_TYPE="image/png" ;;
    *.webp) CONTENT_TYPE="image/webp" ;;
    *.jpg|*.jpeg) CONTENT_TYPE="image/jpeg" ;;
esac

echo "Uploading $IMAGE_FILE to S3..."
echo "Content-Type: $CONTENT_TYPE"
echo ""

# Upload using curl with minimal headers
curl -X PUT \
  -H "Content-Type: $CONTENT_TYPE" \
  --data-binary "@$IMAGE_FILE" \
  -v \
  "$PRESIGNED_URL"

echo ""
echo ""
if [ $? -eq 0 ]; then
    echo "✅ Upload successful!"
else
    echo "❌ Upload failed. Check the error above."
fi

