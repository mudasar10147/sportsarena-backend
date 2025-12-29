# ☁️ CloudFront CDN Setup Guide

Complete guide for setting up AWS CloudFront CDN for image delivery in SportsArena.

---

## 📋 Overview

This guide explains how to configure AWS CloudFront to serve images stored in private S3 buckets. CloudFront provides:

- ✅ **Global CDN** - Faster image delivery worldwide
- ✅ **Caching** - Reduced S3 requests and costs
- ✅ **Compression** - Automatic gzip/brotli compression
- ✅ **Security** - Origin Access Control (OAC) for private S3 buckets
- ✅ **HTTPS** - SSL/TLS encryption by default

---

## 🎯 Prerequisites

- AWS account with appropriate permissions
- S3 bucket already configured (private bucket)
- Images already being uploaded to S3
- Domain name (optional, for custom CloudFront domain)

---

## 📝 Step-by-Step Setup

### Step 1: Create Origin Access Control (OAC)

**Why OAC?**  
OAC replaces the legacy Origin Access Identity (OAI) and provides better security for private S3 buckets.

1. **Navigate to CloudFront Console**
   - Go to AWS Console → CloudFront
   - Click "Create distribution"

2. **Create OAC (before creating distribution)**
   - In CloudFront console, go to "Origin access" → "Origin access control"
   - Click "Create control setting"
   - Name: `sportsarena-s3-oac`
   - Description: `Origin Access Control for SportsArena S3 bucket`
   - Signing behavior: `Sign requests (recommended)`
   - Click "Create"

**Note:** OAC settings are created during distribution creation in newer AWS Console.

---

### Step 2: Create CloudFront Distribution

1. **Origin Settings**
   - **Origin domain:** Select your S3 bucket from dropdown
     - Format: `{bucket-name}.s3.{region}.amazonaws.com`
     - Example: `sportsarena-images.s3.us-east-1.amazonaws.com`
   - **Name:** Auto-populated from bucket name
   - **Origin access:** Select "Origin access control settings (recommended)"
   - **Origin access control:** Select the OAC created in Step 1 (or create new)
   - **Origin type:** S3

2. **Default Cache Behavior**
   - **Viewer protocol policy:** `Redirect HTTP to HTTPS` (recommended)
   - **Allowed HTTP methods:** `GET, HEAD, OPTIONS`
   - **Cache policy:** `CachingOptimized` (recommended)
     - Or create custom policy with:
       - Cache key: Include `Origin` header
       - TTL: 86400 seconds (1 day) for images
   - **Origin request policy:** `CORS-S3Origin` (if CORS is needed)
   - **Response headers policy:** Create custom or use `SecurityHeadersPolicy`
     - Enable compression: `Yes`
     - Compress objects automatically: `Yes`

3. **Distribution Settings**
   - **Price class:** `Use all edge locations` (best performance) or `Use only North America and Europe` (cost savings)
   - **Alternate domain names (CNAMEs):** (Optional)
     - Add your custom domain: `cdn.sportsarena.com`
     - Requires SSL certificate (see Step 3)
   - **Default root object:** Leave blank (not needed for images)
   - **Comment:** `SportsArena Image CDN`

4. **Create Distribution**
   - Click "Create distribution"
   - Wait 5-15 minutes for distribution to deploy

---

### Step 3: Configure SSL Certificate (Optional - for Custom Domain)

If using a custom domain (CNAME):

1. **Request Certificate in ACM**
   - Go to AWS Certificate Manager (ACM)
   - Request public certificate
   - Domain: `cdn.sportsarena.com` (or your domain)
   - Validation: DNS or Email
   - **Important:** Certificate must be in `us-east-1` region for CloudFront

2. **Add Certificate to CloudFront**
   - In CloudFront distribution settings
   - Edit "Alternate domain names (CNAMEs)"
   - Add your domain
   - Select SSL certificate from ACM

---

### Step 4: Update S3 Bucket Policy

After creating CloudFront distribution, update S3 bucket policy to allow CloudFront OAC access:

1. **Get OAC ARN**
   - In CloudFront distribution → Origin settings
   - Copy the "Origin access control" ARN
   - Format: `arn:aws:cloudfront::ACCOUNT_ID:origin-access-control/OAC_ID`

2. **Update S3 Bucket Policy**
   - Go to S3 bucket → Permissions → Bucket policy
   - Add/update policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontServicePrincipal",
      "Effect": "Allow",
      "Principal": {
        "Service": "cloudfront.amazonaws.com"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "arn:aws:cloudfront::ACCOUNT_ID:distribution/DISTRIBUTION_ID"
        }
      }
    }
  ]
}
```

**Replace:**
- `YOUR-BUCKET-NAME` with your S3 bucket name
- `ACCOUNT_ID` with your AWS account ID
- `DISTRIBUTION_ID` with your CloudFront distribution ID

3. **Remove Public Access (if enabled)**
   - S3 bucket → Permissions → Block public access
   - Ensure "Block all public access" is enabled
   - CloudFront OAC will handle access, not public bucket access

---

### Step 5: Configure Backend Environment Variable

Add CloudFront distribution URL to backend environment:

```bash
# .env file
CDN_BASE_URL=https://d1234567890abc.cloudfront.net
```

Or with custom domain:

```bash
CDN_BASE_URL=https://cdn.sportsarena.com
```

**Get Distribution URL:**
- CloudFront console → Your distribution
- Copy "Distribution domain name"
- Format: `https://d1234567890abc.cloudfront.net`

---

### Step 6: Verify Setup

1. **Test Image URL Generation**
   - Upload an image via API
   - Check response: `publicUrl` should use CloudFront domain
   - Example: `https://cdn.sportsarena.com/facility/1/image.jpg`

2. **Test Image Access**
   - Open `publicUrl` in browser
   - Image should load successfully
   - Check browser DevTools → Network → Response headers:
     - `X-Cache: Hit from cloudfront` (after first request)
     - `Content-Encoding: gzip` or `br` (if compression enabled)

3. **Test Caching**
   - First request: `X-Cache: Miss from cloudfront`
   - Subsequent requests: `X-Cache: Hit from cloudfront`

---

## ⚙️ Advanced Configuration

### Custom Cache Policy

Create custom cache policy for optimal image caching:

1. **CloudFront Console → Policies → Cache policies → Create**
   - Name: `SportsArena-Image-Cache`
   - TTL settings:
     - Default TTL: `86400` (1 day)
     - Minimum TTL: `3600` (1 hour)
     - Maximum TTL: `31536000` (1 year)
   - Cache key settings:
     - Include: `Origin` header
     - Include: `Accept-Encoding` header (for compression)
   - Save and attach to distribution

### Compression Settings

Enable automatic compression in Response headers policy:

1. **CloudFront Console → Policies → Response headers policies → Create**
   - Name: `SportsArena-Compression`
   - Compression: `Enable`
   - Compress objects automatically: `Yes`
   - Content types to compress:
     - `image/jpeg`
     - `image/png`
     - `image/webp`
   - Save and attach to distribution

### Cache Invalidation

To force CloudFront to refresh cached images:

1. **CloudFront Console → Your distribution → Invalidations → Create invalidation**
   - Paths: `/facility/1/*` (specific path) or `/*` (all paths)
   - Click "Create invalidation"
   - Wait 1-5 minutes for completion

**Note:** First 1000 invalidations per month are free, then $0.005 per path.

---

## 🔒 Security Best Practices

1. **Private S3 Bucket**
   - ✅ Keep bucket private (Block all public access)
   - ✅ Use OAC for CloudFront access only
   - ❌ Never make bucket public

2. **HTTPS Only**
   - ✅ Use "Redirect HTTP to HTTPS" policy
   - ✅ Enforce SSL/TLS encryption

3. **Origin Access Control**
   - ✅ Always use OAC (not public bucket)
   - ✅ Restrict S3 bucket policy to CloudFront only

4. **Custom Domain with SSL**
   - ✅ Use custom domain with SSL certificate
   - ✅ Enables better branding and security

---

## 📊 Monitoring & Costs

### CloudWatch Metrics

Monitor CloudFront performance:

- **Requests:** Total requests to CloudFront
- **Bytes downloaded:** Data transfer out
- **4xx/5xx error rate:** Error rates
- **Cache hit ratio:** Percentage of requests served from cache

### Cost Optimization

- **Price class:** Use regional price class if global CDN not needed
- **Cache hit ratio:** Higher cache hit ratio = lower S3 requests = lower costs
- **Compression:** Reduces bandwidth costs
- **Invalidations:** Minimize invalidations (first 1000/month free)

---

## 🐛 Troubleshooting

### Images Not Loading

**Problem:** `403 Forbidden` or `Access Denied`

**Solutions:**
1. Check S3 bucket policy allows CloudFront OAC
2. Verify OAC is attached to CloudFront distribution
3. Ensure S3 bucket is private (not public)
4. Check CloudFront distribution is deployed (not "In Progress")

### Images Not Caching

**Problem:** `X-Cache: Miss from cloudfront` on every request

**Solutions:**
1. Check cache policy TTL settings
2. Verify cache headers in S3 response
3. Check if query strings are being included (should be excluded for images)

### Slow First Request

**Problem:** First request is slow, subsequent requests are fast

**Solution:** This is normal. CloudFront must fetch from S3 origin on cache miss. Subsequent requests are served from cache.

### Custom Domain Not Working

**Problem:** Custom domain returns SSL error

**Solutions:**
1. Verify SSL certificate is in `us-east-1` region
2. Check certificate is validated and active
3. Verify DNS CNAME points to CloudFront distribution domain
4. Wait 15-30 minutes for DNS propagation

---

## 📚 Additional Resources

- [AWS CloudFront Documentation](https://docs.aws.amazon.com/cloudfront/)
- [Origin Access Control (OAC)](https://docs.aws.amazon.com/cloudfront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html)
- [CloudFront Cache Policies](https://docs.aws.amazon.com/cloudfront/latest/DeveloperGuide/controlling-the-cache-key.html)
- [CloudFront Compression](https://docs.aws.amazon.com/cloudfront/latest/DeveloperGuide/ServingCompressedFiles.html)

---

## ✅ Checklist

- [ ] OAC created and configured
- [ ] CloudFront distribution created
- [ ] S3 bucket policy updated
- [ ] SSL certificate configured (if using custom domain)
- [ ] DNS CNAME configured (if using custom domain)
- [ ] Backend `CDN_BASE_URL` environment variable set
- [ ] Test image upload and verify `publicUrl` uses CDN
- [ ] Test image access via CDN URL
- [ ] Verify caching is working (`X-Cache: Hit`)
- [ ] Monitor CloudWatch metrics

---

## 🎉 Summary

Once configured:

1. **Backend** generates `publicUrl` using `CDN_BASE_URL`
2. **Frontend** uses `publicUrl` for all image display
3. **CloudFront** caches images globally for fast delivery
4. **S3** remains private, accessible only via CloudFront

The system is CDN-agnostic - you can switch CDN providers by changing `CDN_BASE_URL` without code changes.

