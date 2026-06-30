<?php
// KWD Starter theme — minimal classic theme for Kent Web Design client builds.

function kwd_setup() {
  add_theme_support('title-tag');
  add_theme_support('automatic-feed-links');
  register_nav_menus(array('primary' => 'Primary Menu'));
}
add_action('after_setup_theme', 'kwd_setup');

function kwd_assets() {
  wp_enqueue_style(
    'kwd-fonts',
    'https://fonts.googleapis.com/css2?family=Archivo:wght@600;700&family=Inter:wght@400;500;600&display=swap',
    array(),
    null
  );
  wp_enqueue_style('kwd-style', get_stylesheet_uri(), array('kwd-fonts'), '0.1.0');
}
add_action('wp_enqueue_scripts', 'kwd_assets');
