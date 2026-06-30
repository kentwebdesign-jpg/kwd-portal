<?php
/**
 * Fallback template.
 */
get_header();
?>
<main>
  <div class="container">
    <?php
    if (have_posts()) :
      while (have_posts()) :
        the_post();
        echo '<h1>' . get_the_title() . '</h1>';
        the_content();
      endwhile;
    endif;
    ?>
  </div>
</main>
<?php get_footer(); ?>
