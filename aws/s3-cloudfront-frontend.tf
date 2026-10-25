# ==============================================================================
# AWS S3 + CloudFront Global CDN Distribution for Frontend SPA
# Production-grade static hosting with Origin Access Control (OAC) & HTTPS
# ==============================================================================

variable "domain_name" {
  type        = string
  default     = "clinic.example.com"
  description = "Target domain name for the clinical dashboard"
}

# 1. Private S3 Bucket for static build artifacts
resource "aws_s3_bucket" "frontend_bucket" {
  bucket        = "ai-receptionist-frontend-${random_id.bucket_id.hex}"
  force_destroy = true
}

resource "random_id" "bucket_id" {
  byte_length = 4
}

# Block all direct public access to S3 (access only through CloudFront)
resource "aws_s3_bucket_public_access_block" "frontend_block" {
  bucket                  = aws_s3_bucket.frontend_bucket.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# 2. CloudFront Origin Access Control (OAC)
resource "aws_cloudfront_origin_access_control" "frontend_oac" {
  name                              = "frontend-oac"
  description                       = "OAC for static frontend S3 bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# 3. CloudFront Global Distribution
resource "aws_cloudfront_distribution" "frontend_cdn" {
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  comment             = "ABC Health Care Clinical Dashboard CDN"

  origin {
    domain_name              = aws_s3_bucket.frontend_bucket.bucket_regional_domain_name
    origin_id                = "S3-frontend-origin"
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend_oac.id
  }

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-frontend-origin"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 86400
    max_ttl                = 31536000
    compress               = true
  }

  # SPA Routing: Redirect 404 & 403 to index.html with HTTP 200
  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 10
  }

  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 10
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}

# 4. S3 Bucket Policy granting CloudFront read permission
resource "aws_s3_bucket_policy" "frontend_policy" {
  bucket = aws_s3_bucket.frontend_bucket.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowCloudFrontServicePrincipalReadOnly"
        Effect    = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.frontend_bucket.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.frontend_cdn.arn
          }
        }
      }
    ]
  })
}

output "cloudfront_domain_name" {
  value       = aws_cloudfront_distribution.frontend_cdn.domain_name
  description = "The public URL of the CloudFront distribution"
}
