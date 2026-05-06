/**
 * Asset Optimization Service
 *
 * Strategies and utilities for optimizing images, fonts, and other assets.
 * Includes lazy loading, responsive images, format optimization, and caching.
 *
 * Key Areas:
 * 1. Image optimization (webp, srcset, lazy loading)
 * 2. Font optimization (woff2, font-display, subsetting)
 * 3. SVG optimization (inline, sprite sheets)
 * 4. Cache headers and CDN configuration
 * 5. Compression (gzip, brotli)
 */

// ============================================================================
// IMAGE OPTIMIZATION
// ============================================================================

export interface ImageOptimizationConfig {
  /**
   * Enable WebP format with fallback
   */
  enableWebp: boolean;

  /**
   * Enable lazy loading (loading="lazy")
   */
  enableLazyLoad: boolean;

  /**
   * Generate responsive sizes
   */
  responsiveSizes: number[];

  /**
   * Image quality (0-100)
   */
  quality: number;

  /**
   * Enable blur-up placeholder
   */
  enableBlurPlaceholder: boolean;
}

export const DEFAULT_IMAGE_CONFIG: ImageOptimizationConfig = {
  enableWebp: true,
  enableLazyLoad: true,
  responsiveSizes: [320, 640, 960, 1280, 1920],
  quality: 85,
  enableBlurPlaceholder: true,
};

/**
 * Generate optimized image srcset
 */
export function generateImageSrcset(
  imageUrl: string,
  sizes: number[] = DEFAULT_IMAGE_CONFIG.responsiveSizes,
  quality: number = DEFAULT_IMAGE_CONFIG.quality
): string {
  return sizes
    .map(size => `${generateOptimizedImageUrl(imageUrl, size, quality)} ${size}w`)
    .join(', ');
}

/**
 * Generate optimized image URL
 */
export function generateOptimizedImageUrl(
  imageUrl: string,
  width: number,
  quality: number = 85,
  format: 'auto' | 'webp' | 'jpg' | 'png' = 'auto'
): string {
  // Example using Cloudinary or similar service
  // In production, replace with your CDN
  const params = [
    `w_${width}`,
    `q_${quality}`,
    `f_${format}`,
    'c_fill',
    'g_auto',
  ];
  
  return `${imageUrl}?${params.join('&')}`;
}

/**
 * Generate blur placeholder (LQIP - Low Quality Image Placeholder)
 */
export function generateBlurPlaceholder(imageUrl: string): string {
  // Generate a tiny (8x8) blurred image
  return generateOptimizedImageUrl(imageUrl, 8, 60);
}

/**
 * HTML template for optimized image
 */
export function optimizedImageHtml(
  src: string,
  alt: string,
  config: Partial<ImageOptimizationConfig> = {}
): string {
  const finalConfig = { ...DEFAULT_IMAGE_CONFIG, ...config };
  
  const srcset = finalConfig.enableWebp
    ? generateImageSrcset(src, finalConfig.responsiveSizes, finalConfig.quality)
    : '';

  const blurPlaceholder = finalConfig.enableBlurPlaceholder
    ? generateBlurPlaceholder(src)
    : '';

  const lazyLoad = finalConfig.enableLazyLoad ? 'loading="lazy"' : '';

  return `
    <picture>
      ${
        finalConfig.enableWebp
          ? `<source type="image/webp" srcset="${srcset}">`
          : ''
      }
      <img
        src="${src}"
        alt="${alt}"
        ${srcset ? `srcset="${srcset}"` : ''}
        sizes="(max-width: 320px) 320px, (max-width: 640px) 640px, (max-width: 960px) 960px, 1280px"
        ${blurPlaceholder ? `style="background-image: url('${blurPlaceholder}'); background-size: cover;"` : ''}
        ${lazyLoad}
        decoding="async"
      />
    </picture>
  `;
}

// ============================================================================
// FONT OPTIMIZATION
// ============================================================================

export interface FontOptimizationConfig {
  /**
   * Use woff2 format (best compression)
   */
  useWoff2: boolean;

  /**
   * Font display strategy
   * - 'auto': Default, block text until font loads
   * - 'swap': Show fallback immediately, swap when loaded
   * - 'fallback': Brief block (100ms), swap if available
   * - 'optional': Brief block, don't swap
   */
  fontDisplay: 'auto' | 'swap' | 'fallback' | 'optional';

  /**
   * Preload fonts (improves perceived performance)
   */
  preload: boolean;

  /**
   * Font subsetting (only needed characters)
   */
  subset: 'latin' | 'latin-ext' | 'cyrillic' | 'all';

  /**
   * Weights to load
   */
  weights: (300 | 400 | 500 | 600 | 700 | 800 | 900)[];
}

export const DEFAULT_FONT_CONFIG: FontOptimizationConfig = {
  useWoff2: true,
  fontDisplay: 'swap',
  preload: true,
  subset: 'latin',
  weights: [400, 600, 700],
};

/**
 * Generate font-face CSS
 */
export function generateFontFaceCSS(
  fontFamily: string,
  fontUrl: string,
  config: Partial<FontOptimizationConfig> = {}
): string {
  const finalConfig = { ...DEFAULT_FONT_CONFIG, ...config };
  
  const formats = finalConfig.useWoff2
    ? 'woff2'
    : 'woff';

  const display = finalConfig.fontDisplay;

  return `
    @font-face {
      font-family: '${fontFamily}';
      src: url('${fontUrl}.${formats}') format('${formats}');
      font-display: ${display};
      font-weight: normal;
      font-style: normal;
    }
  `;
}

/**
 * Generate font preload link
 */
export function generateFontPreloadLink(
  fontUrl: string,
  fontFamily: string
): string {
  return `<link rel="preload" as="font" type="font/woff2" href="${fontUrl}.woff2" crossorigin>`;
}

/**
 * Recommended font optimization HTML
 */
export const FONT_OPTIMIZATION_HTML = `
  <!-- Preload fonts -->
  <link rel="preload" as="font" type="font/woff2" href="/fonts/inter-regular.woff2" crossorigin>
  <link rel="preload" as="font" type="font/woff2" href="/fonts/inter-bold.woff2" crossorigin>

  <!-- Font faces with font-display: swap for better performance -->
  <style>
    @font-face {
      font-family: 'Inter';
      src: url('/fonts/inter-regular.woff2') format('woff2');
      font-display: swap;
      font-weight: 400;
    }
    
    @font-face {
      font-family: 'Inter';
      src: url('/fonts/inter-bold.woff2') format('woff2');
      font-display: swap;
      font-weight: 700;
    }
  </style>
`;

// ============================================================================
// SVG OPTIMIZATION
// ============================================================================

/**
 * Inline SVG with optimization
 */
export function inlineSvg(
  svgContent: string,
  className?: string
): string {
  // Remove unnecessary attributes
  let optimized = svgContent
    .replace(/<!--[\s\S]*?-->/g, '') // Remove comments
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/>\s+</g, '><') // Remove space between tags
    .trim();

  // Add class if provided
  if (className) {
    optimized = optimized.replace('<svg', `<svg class="${className}"`);
  }

  return optimized;
}

/**
 * Create SVG sprite sheet
 */
export function generateSvgSprite(
  icons: Record<string, string>
): string {
  const symbols = Object.entries(icons)
    .map(
      ([id, content]) =>
        `<symbol id="icon-${id}">${inlineSvg(content)}</symbol>`
    )
    .join('\n');

  return `
    <svg style="display: none;" xmlns="http://www.w3.org/2000/svg">
      ${symbols}
    </svg>
  `;
}

/**
 * Use SVG icon from sprite
 */
export function useSvgIcon(iconId: string, className?: string): string {
  return `
    <svg class="${className || ''}">
      <use href="#icon-${iconId}"></use>
    </svg>
  `;
}

// ============================================================================
// COMPRESSION & CACHING
// ============================================================================

export interface CacheConfig {
  /**
   * Cache time for static assets (seconds)
   */
  staticAssets: number;

  /**
   * Cache time for HTML (seconds)
   */
  html: number;

  /**
   * Cache time for API responses (seconds)
   */
  api: number;

  /**
   * Enable compression
   */
  enableCompression: boolean;

  /**
   * Compression level (1-11, higher = better compression but slower)
   */
  compressionLevel: number;
}

export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  staticAssets: 31536000, // 1 year
  html: 3600, // 1 hour
  api: 300, // 5 minutes
  enableCompression: true,
  compressionLevel: 6,
};

/**
 * Generate cache headers for different asset types
 */
export function getCacheHeaders(
  assetType: 'static' | 'html' | 'api',
  config: CacheConfig = DEFAULT_CACHE_CONFIG
): Record<string, string> {
  const maxAge = config[
    assetType === 'api' ? 'api' : assetType === 'html' ? 'html' : 'staticAssets'
  ];

  return {
    'Cache-Control': `public, max-age=${maxAge}`,
    'ETag': `"${Date.now()}"`,
    'Vary': 'Accept-Encoding',
  };
}

/**
 * Nginx configuration for compression and caching
 */
export const NGINX_CONFIG = `
# nginx.conf - Asset optimization configuration

gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css text/xml text/javascript 
            application/x-javascript application/xml+rss 
            application/json image/svg+xml;
gzip_comp_level 6;

# Brotli compression (better than gzip)
brotli on;
brotli_comp_level 6;
brotli_types text/plain text/css text/xml text/javascript 
             application/x-javascript application/xml+rss 
             application/json image/svg+xml;

# Cache headers
location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|webp|woff|woff2)$ {
  expires 1y;
  add_header Cache-Control "public, immutable";
  access_log off;
}

location ~* \\.html?$ {
  expires 1h;
  add_header Cache-Control "public, must-revalidate";
}

# API responses
location /api {
  expires 5m;
  add_header Cache-Control "public, max-age=300";
}
`;

/**
 * CDN configuration for Cloudflare
 */
export const CLOUDFLARE_RULES = `
// Page Rules for Cloudflare

1. Cache Static Assets
   URL: example.com/static/*
   Settings:
   - Cache Level: Cache Everything
   - Edge Cache TTL: 1 month
   - Browser Cache TTL: 1 year
   - Compress with Brotli: On

2. Cache API Responses
   URL: example.com/api/*
   Settings:
   - Cache Level: Cache on Cookie (if needed)
   - Browser Cache TTL: 5 minutes
   - Edge Cache TTL: 1 hour

3. HTML Pages
   URL: example.com/*
   Settings:
   - Cache Level: Bypass
   - Browser Cache TTL: 30 minutes
`;

// ============================================================================
// PERFORMANCE METRICS
// ============================================================================

export interface AssetMetrics {
  totalSize: number;
  compressedSize: number;
  compressionRatio: number;
  imageCount: number;
  fontCount: number;
  averageLoadTime: number;
}

/**
 * Calculate asset optimization metrics
 */
export function calculateAssetMetrics(
  assets: Array<{ size: number; compressedSize?: number }>
): AssetMetrics {
  const totalSize = assets.reduce((sum, asset) => sum + asset.size, 0);
  const compressedSize = assets.reduce((sum, asset) => sum + (asset.compressedSize || asset.size), 0);
  const compressionRatio = (totalSize - compressedSize) / totalSize;

  return {
    totalSize,
    compressedSize,
    compressionRatio: Math.round(compressionRatio * 100),
    imageCount: 0,
    fontCount: 0,
    averageLoadTime: 0,
  };
}

// ============================================================================
// OPTIMIZATION CHECKLIST
// ============================================================================

export const ASSET_OPTIMIZATION_CHECKLIST = [
  {
    category: 'Images',
    items: [
      'Convert to WebP format with PNG/JPG fallback',
      'Generate responsive srcsets (320px, 640px, 960px, 1280px)',
      'Enable lazy loading (loading="lazy")',
      'Add blur placeholder for perceived performance',
      'Compress with TinyPNG or similar',
      'Remove EXIF data',
    ],
  },
  {
    category: 'Fonts',
    items: [
      'Use WOFF2 format (best compression)',
      'Preload critical fonts',
      'Use font-display: swap for better UX',
      'Subset fonts to only needed characters',
      'Limit to essential weights (400, 600, 700)',
      'Host fonts on same domain or use preconnect',
    ],
  },
  {
    category: 'SVGs',
    items: [
      'Inline critical SVGs',
      'Create sprite sheets for common icons',
      'Minify SVG code',
      'Remove unnecessary attributes',
      'Use proper viewBox',
    ],
  },
  {
    category: 'Compression',
    items: [
      'Enable Gzip compression (all assets)',
      'Enable Brotli compression (if supported)',
      'Configure proper cache headers',
      'Enable CDN compression',
      'Minify CSS and JavaScript',
    ],
  },
  {
    category: 'Caching',
    items: [
      'Set 1-year cache for fingerprinted assets',
      'Set 1-hour cache for HTML',
      'Set 5-minute cache for API',
      'Use versioning/fingerprinting for assets',
      'Configure CDN caching rules',
    ],
  },
];

// ============================================================================
// EXPORTS
// ============================================================================

export type { ImageOptimizationConfig, FontOptimizationConfig, CacheConfig, AssetMetrics };
export {
  DEFAULT_IMAGE_CONFIG,
  DEFAULT_FONT_CONFIG,
  DEFAULT_CACHE_CONFIG,
};
