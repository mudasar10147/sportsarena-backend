# 🔧 Image Processing Hooks - Implementation Guide

Complete guide for implementing image variant generation using Lambda functions or worker queues.

---

## 📋 Overview

This document describes how to implement automatic image variant generation after image upload. Two approaches are supported:

1. **AWS Lambda** (Recommended) - Serverless, event-driven processing
2. **Worker Queue** (Alternative) - Queue-based processing with workers

**Note:** This is a design document. Actual implementation code is not included in the backend.

---

## 🚀 Approach 1: AWS Lambda (Recommended)

### Architecture

```
S3 Upload (Original Image)
  ↓
S3 Event Trigger (ObjectCreated)
  ↓
Lambda Function (image-processor)
  ↓
1. Download original from S3
2. Generate variants (thumb, medium, full)
3. Upload variants to S3
4. (Optional) Update database metadata
```

### Lambda Function Setup

#### 1. Create Lambda Function

**Function Name:** `sportsarena-image-processor`

**Runtime:** Node.js 18.x or Python 3.11

**Memory:** 1024 MB (recommended for image processing)

**Timeout:** 30 seconds (adjust based on image size)

**Environment Variables:**
```bash
S3_BUCKET=sportsarena-images
AWS_REGION=us-east-1
DATABASE_URL=postgresql://... (optional, for metadata updates)
```

#### 2. S3 Event Trigger Configuration

**Trigger Type:** S3 Event

**Event Type:** `s3:ObjectCreated:*`

**Prefix Filter:** (Optional) Filter by entity type
- `facility/` - Process facility images
- `user/` - Process user images
- `court/` - Process court images

**Suffix Filter:** (Optional) Filter by file extension
- `.webp`
- `.jpg`
- `.png`

**Note:** Exclude variant files to avoid infinite loops:
- Exclude suffix: `_thumb.webp`, `_medium.webp`, `_full.webp`

#### 3. Lambda Function Code Structure

**Node.js Example (Pseudocode):**

```javascript
const AWS = require('aws-sdk');
const sharp = require('sharp'); // Image processing library
const s3 = new AWS.S3();

exports.handler = async (event) => {
  const bucket = event.Records[0].s3.bucket.name;
  const key = decodeURIComponent(event.Records[0].s3.object.key);
  
  // Skip if this is already a variant
  if (key.includes('_thumb.') || key.includes('_medium.') || key.includes('_full.')) {
    return { statusCode: 200, message: 'Skipped variant file' };
  }
  
  try {
    // 1. Download original image
    const originalImage = await s3.getObject({ Bucket: bucket, Key: key }).promise();
    
    // 2. Generate variants
    const variants = await generateVariants(originalImage.Body, key);
    
    // 3. Upload variants to S3
    await Promise.all([
      uploadVariant(bucket, key, 'thumb', variants.thumb),
      uploadVariant(bucket, key, 'medium', variants.medium),
      uploadVariant(bucket, key, 'full', variants.full)
    ]);
    
    return { statusCode: 200, message: 'Variants generated successfully' };
  } catch (error) {
    console.error('Error processing image:', error);
    throw error;
  }
};

async function generateVariants(imageBuffer, originalKey) {
  const image = sharp(imageBuffer);
  const metadata = await image.metadata();
  
  // Get extension from original key
  const extension = originalKey.split('.').pop();
  
  return {
    thumb: await image
      .resize(300, null, { withoutEnlargement: true })
      .webp({ quality: 75 })
      .toBuffer(),
    medium: await image
      .resize(800, null, { withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer(),
    full: await image
      .resize(1600, null, { withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer()
  };
}

async function uploadVariant(bucket, originalKey, variant, buffer) {
  const variantKey = generateVariantKey(originalKey, variant);
  
  await s3.putObject({
    Bucket: bucket,
    Key: variantKey,
    Body: buffer,
    ContentType: 'image/webp',
    CacheControl: 'max-age=31536000' // 1 year
  }).promise();
}

function generateVariantKey(originalKey, variant) {
  const lastDotIndex = originalKey.lastIndexOf('.');
  const baseKey = originalKey.substring(0, lastDotIndex);
  const extension = originalKey.substring(lastDotIndex + 1);
  return `${baseKey}_${variant}.${extension}`;
}
```

**Python Example (Pseudocode):**

```python
import boto3
from PIL import Image
import io

s3 = boto3.client('s3')

def lambda_handler(event, context):
    bucket = event['Records'][0]['s3']['bucket']['name']
    key = event['Records'][0]['s3']['object']['key']
    
    # Skip if this is already a variant
    if '_thumb.' in key or '_medium.' in key or '_full.' in key:
        return {'statusCode': 200, 'message': 'Skipped variant file'}
    
    try:
        # 1. Download original image
        response = s3.get_object(Bucket=bucket, Key=key)
        image_data = response['Body'].read()
        
        # 2. Generate variants
        variants = generate_variants(image_data, key)
        
        # 3. Upload variants to S3
        for variant_name, variant_data in variants.items():
            variant_key = generate_variant_key(key, variant_name)
            s3.put_object(
                Bucket=bucket,
                Key=variant_key,
                Body=variant_data,
                ContentType='image/webp',
                CacheControl='max-age=31536000'
            )
        
        return {'statusCode': 200, 'message': 'Variants generated successfully'}
    except Exception as e:
        print(f'Error processing image: {e}')
        raise

def generate_variants(image_data, original_key):
    image = Image.open(io.BytesIO(image_data))
    
    variants = {}
    sizes = {
        'thumb': 300,
        'medium': 800,
        'full': 1600
    }
    
    for variant_name, max_width in sizes.items():
        # Resize maintaining aspect ratio
        if image.width > max_width:
            ratio = max_width / image.width
            new_size = (max_width, int(image.height * ratio))
            variant_image = image.resize(new_size, Image.Resampling.LANCZOS)
        else:
            variant_image = image
        
        # Convert to WebP
        output = io.BytesIO()
        variant_image.save(output, format='WEBP', quality=75 if variant_name == 'thumb' else 85)
        variants[variant_name] = output.getvalue()
    
    return variants

def generate_variant_key(original_key, variant):
    base_key, extension = original_key.rsplit('.', 1)
    return f'{base_key}_{variant}.{extension}'
```

#### 4. IAM Permissions

Lambda function needs the following permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject"
      ],
      "Resource": "arn:aws:s3:::sportsarena-images/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:*"
    }
  ]
}
```

#### 5. Lambda Layer (for Sharp/Pillow)

**Node.js (Sharp):**
- Create Lambda layer with Sharp binary
- Or use pre-built layers from AWS Marketplace

**Python (Pillow):**
- Include Pillow in deployment package
- Or use Lambda layer with Pillow

---

## 🔄 Approach 2: Worker Queue (Alternative)

### Architecture

```
Upload Confirmation
  ↓
Enqueue Job (image-processing-queue)
  ↓
Worker Process (EC2/ECS/Fargate)
  ↓
1. Download original from S3
2. Generate variants
3. Upload variants to S3
4. Mark job complete
```

### Queue Setup

#### 1. Queue Service Options

- **AWS SQS** - Simple queue service
- **AWS SNS + SQS** - Pub/sub with queue
- **Redis Queue (RQ)** - Python-based queue
- **Bull Queue** - Node.js-based queue

#### 2. Job Enqueue (Backend Integration)

**Location:** After image upload confirmation

**Pseudocode:**
```javascript
// In imageController.confirmUpload or s3Service.confirmUpload
const { enqueueImageProcessing } = require('../services/queueService');

// After successful upload confirmation
await enqueueImageProcessing({
  imageId: image.id,
  s3Key: image.s3Key,
  bucket: S3_BUCKET
});
```

#### 3. Worker Implementation

**Node.js Worker Example (Pseudocode):**

```javascript
const AWS = require('aws-sdk');
const sharp = require('sharp');
const Queue = require('bull');

const s3 = new AWS.S3();
const imageQueue = new Queue('image-processing', {
  redis: { host: 'localhost', port: 6379 }
});

imageQueue.process(async (job) => {
  const { imageId, s3Key, bucket } = job.data;
  
  try {
    // 1. Download original
    const original = await s3.getObject({ Bucket: bucket, Key: s3Key }).promise();
    
    // 2. Generate variants
    const variants = await generateVariants(original.Body, s3Key);
    
    // 3. Upload variants
    await Promise.all([
      uploadVariant(bucket, s3Key, 'thumb', variants.thumb),
      uploadVariant(bucket, s3Key, 'medium', variants.medium),
      uploadVariant(bucket, s3Key, 'full', variants.full)
    ]);
    
    // 4. Update job status
    job.progress(100);
    return { success: true, imageId };
  } catch (error) {
    console.error('Error processing image:', error);
    throw error;
  }
});
```

---

## 🔍 Variant Key Generation

### Implementation Reference

The backend provides helper functions for variant key generation. Use the same logic in Lambda/Worker:

**Backend Function:**
```javascript
generateVariantS3Key(originalS3Key, variant)
```

**Example:**
```javascript
generateVariantS3Key('facility/1/image.webp', 'thumb')
// Returns: 'facility/1/image_thumb.webp'
```

**Implementation Logic:**
1. Extract base key (without extension)
2. Extract extension
3. Format: `{base_key}_{variant}.{extension}`

---

## 📊 Monitoring & Error Handling

### CloudWatch Metrics (Lambda)

Monitor:
- Invocation count
- Error rate
- Duration
- Throttles

### Error Handling

**Retry Strategy:**
- Lambda: Automatic retry (up to 2 retries)
- Queue: Configure retry attempts (3-5 retries)

**Dead Letter Queue:**
- Failed jobs after max retries
- Manual review and reprocessing

**Logging:**
- Log all processing steps
- Include image ID, S3 key, variant names
- Log errors with full stack traces

---

## ⚡ Performance Optimization

### Lambda Optimization

1. **Memory:** Increase memory for faster processing (up to 3008 MB)
2. **Concurrency:** Set reserved concurrency to limit parallel executions
3. **Timeout:** Set appropriate timeout (30-60 seconds)
4. **Layers:** Use Lambda layers for dependencies

### Queue Optimization

1. **Batch Processing:** Process multiple images in batch
2. **Priority Queue:** Process urgent images first
3. **Worker Scaling:** Auto-scale workers based on queue depth

---

## 🧪 Testing

### Local Testing

1. **Test Lambda locally:**
   ```bash
   sam local invoke ImageProcessorFunction -e event.json
   ```

2. **Test Worker locally:**
   ```bash
   node worker.js
   ```

### Integration Testing

1. Upload test image
2. Verify Lambda/Worker triggered
3. Check S3 for variant files
4. Verify variant URLs work

---

## ✅ Implementation Checklist

- [ ] Lambda function created and configured
- [ ] S3 event trigger configured
- [ ] IAM permissions set
- [ ] Lambda layer with image processing library
- [ ] Error handling and retry logic
- [ ] CloudWatch monitoring configured
- [ ] Dead letter queue configured (optional)
- [ ] Testing completed
- [ ] Documentation updated

---

## 📚 Additional Resources

- [AWS Lambda Documentation](https://docs.aws.amazon.com/lambda/)
- [Sharp Documentation](https://sharp.pixelplumbing.com/)
- [Pillow Documentation](https://pillow.readthedocs.io/)
- [AWS SQS Documentation](https://docs.aws.amazon.com/sqs/)

---

## 🎯 Summary

Two approaches for image variant generation:

1. **Lambda (Recommended):** Serverless, event-driven, automatic
2. **Worker Queue:** More control, can handle complex workflows

Both approaches:
- Generate variants asynchronously
- Use same naming convention
- Upload to S3 with proper metadata
- Handle errors gracefully

Choose based on your infrastructure and requirements.

