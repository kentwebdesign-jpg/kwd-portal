<?php
// KWD Canvas — blank theme for AI-designed client sites.

function kwd_canvas_setup() {
  add_theme_support('title-tag');
}
add_action('after_setup_theme', 'kwd_canvas_setup');

function kwd_canvas_assets() {
  wp_enqueue_style('kwd-canvas', get_stylesheet_uri(), array(), '0.1.0');
}
add_action('wp_enqueue_scripts', 'kwd_canvas_assets');

// The page content is raw, self-contained HTML + CSS. Don't let WordPress
// auto-wrap it in paragraphs or it will mangle the design.
remove_filter('the_content', 'wpautop');
remove_filter('the_content', 'shortcode_unautop');

// Per-page SEO head tags. The build sets each page's excerpt to its meta
// description; emit that plus a canonical URL and basic Open Graph so shared
// links look sharp. <title> is handled by title-tag; sitemap.xml and robots.txt
// are handled by WordPress core.
function kwd_canvas_seo_head() {
  if (!is_singular()) return;
  $desc = has_excerpt() ? wp_strip_all_tags(get_the_excerpt()) : '';
  $desc = trim(preg_replace('/\s+/', ' ', $desc));
  $url  = get_permalink();
  $title = wp_get_document_title();

  if ($desc !== '') {
    echo '<meta name="description" content="' . esc_attr($desc) . '">' . "\n";
  }
  if ($url) {
    echo '<link rel="canonical" href="' . esc_url($url) . '">' . "\n";
    echo '<meta property="og:url" content="' . esc_url($url) . '">' . "\n";
  }
  echo '<meta property="og:type" content="website">' . "\n";
  echo '<meta property="og:title" content="' . esc_attr($title) . '">' . "\n";
  echo '<meta property="og:site_name" content="' . esc_attr(get_bloginfo('name')) . '">' . "\n";
  if ($desc !== '') {
    echo '<meta property="og:description" content="' . esc_attr($desc) . '">' . "\n";
  }
}
add_action('wp_head', 'kwd_canvas_seo_head', 1);
