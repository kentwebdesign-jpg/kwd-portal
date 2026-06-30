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
