<?php
/**
 * Page template — renders the page's content (its <main> section) within the
 * shared chrome. The pipeline injects each page's HTML as the post content.
 */
get_header();
?>
<main>
  <?php
  while (have_posts()) :
    the_post();
    // Front page content is full-width (includes its own .hero); other pages
    // get a container wrapper.
    if (is_front_page()) {
      the_content();
    } else {
      echo '<div class="container">';
      echo '<h1>' . get_the_title() . '</h1>';
      the_content();
      echo '</div>';
    }
  endwhile;
  ?>
</main>
<?php get_footer(); ?>
