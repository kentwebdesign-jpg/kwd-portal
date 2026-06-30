<?php
/**
 * Header — shared chrome for every page.
 */
?><!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
  <meta charset="<?php bloginfo('charset'); ?>">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>
<header class="site-header">
  <div class="container bar">
    <a class="brand" href="<?php echo esc_url(home_url('/')); ?>"><?php bloginfo('name'); ?></a>
    <?php if (get_bloginfo('description')) : ?>
      <span class="tagline"><?php bloginfo('description'); ?></span>
    <?php endif; ?>
    <nav class="site-nav">
      <?php
        wp_nav_menu(array(
          'theme_location' => 'primary',
          'container' => false,
          'items_wrap' => '%3$s',
          'fallback_cb' => false,
          'depth' => 1,
        ));
      ?>
    </nav>
  </div>
</header>
